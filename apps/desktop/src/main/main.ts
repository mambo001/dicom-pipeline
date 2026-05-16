import { createHash } from "node:crypto";
import { createReadStream, writeFileSync, unlinkSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { URL } from "node:url";
import { BrowserWindow, app, dialog, ipcMain } from "electron";

declare const __dirname: string;

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly scrubbedPath: string;
  readonly scrubbedSha256: string;
};

type UploadDicomFileInput = {
  readonly uploadId: string;
  readonly scrubbedFilePath: string;
  readonly signedUploadUrl: string;
  readonly sizeBytes: number;
};

type UploadDicomFileResult = {
  readonly ok: boolean;
  readonly statusCode: number;
  readonly responseBody: string;
};

type ReadDicomFileResult = {
  readonly name: string;
  readonly data: ArrayBuffer;
};

type DicomMetadataSummary = {
  readonly patientName?: string;
  readonly patientId?: string;
  readonly patientBirthDate?: string;
  readonly studyInstanceUid?: string;
  readonly seriesInstanceUid?: string;
  readonly sopInstanceUid?: string;
  readonly sopClassUid?: string;
  readonly modality?: string;
  readonly studyDate?: string;
  readonly rows?: number;
  readonly columns?: number;
  readonly samplesPerPixel?: number;
  readonly photometricInterpretation?: string;
  readonly bitsAllocated?: number;
  readonly bitsStored?: number;
  readonly highBit?: number;
  readonly pixelRepresentation?: number;
  readonly seriesNumber?: number;
  readonly instanceNumber?: number;
  readonly transferSyntax?: string;
};

type DicomPixelPreview = {
  readonly width: number;
  readonly height: number;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly photometricInterpretation?: string;
  readonly bitsAllocated?: number;
  readonly samplesPerPixel?: number;
  readonly pixels: readonly number[];
};

type DeidentificationReport = {
  readonly version: 1;
  readonly kind: "deidentification_report";
  readonly rulesetId: string;
  readonly findings: readonly {
    readonly tag: string;
    readonly name: string;
    readonly action: "removed" | "replaced" | "retained";
  }[];
};

type DicomInspection = {
  readonly isDicom: boolean;
  readonly metadata: DicomMetadataSummary;
  readonly deidentificationReport: DeidentificationReport;
  readonly pixelPreview?: DicomPixelPreview;
  readonly warnings: readonly string[];
};

const dicomStringTags = new Map<string, keyof DicomMetadataSummary>([
  ["0010,0010", "patientName"],
  ["0010,0020", "patientId"],
  ["0010,0030", "patientBirthDate"],
  ["0020,000d", "studyInstanceUid"],
  ["0020,000e", "seriesInstanceUid"],
  ["0008,0018", "sopInstanceUid"],
  ["0008,0016", "sopClassUid"],
  ["0008,0060", "modality"],
  ["0008,0020", "studyDate"],
  ["0028,0004", "photometricInterpretation"],
  ["0002,0010", "transferSyntax"]
]);

const dicomNumericTags = new Map<string, keyof DicomMetadataSummary>([
  ["0020,0011", "seriesNumber"],
  ["0020,0013", "instanceNumber"],
  ["0028,0002", "samplesPerPixel"],
  ["0028,0010", "rows"],
  ["0028,0011", "columns"],
  ["0028,0100", "bitsAllocated"],
  ["0028,0101", "bitsStored"],
  ["0028,0102", "highBit"],
  ["0028,0103", "pixelRepresentation"]
]);

const dicomPreviewNumericTags = new Map<string, "samplesPerPixel" | "bitsAllocated" | "bitsStored" | "pixelRepresentation">([
  ["0028,0002", "samplesPerPixel"],
  ["0028,0100", "bitsAllocated"],
  ["0028,0101", "bitsStored"],
  ["0028,0103", "pixelRepresentation"]
]);

const longExplicitVr = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);

// Tags to scrub from DICOM before upload (HIPAA Safe Harbor patient identifiers)
const phiTags = new Set(["0010,0010", "0010,0020", "0010,0030"]);

function scrubDicom(contents: Buffer): Buffer {
  const scrubbed = Buffer.from(contents);
  const hasPreamble = scrubbed.length > 132 && scrubbed.subarray(128, 132).toString("ascii") === "DICM";
  let offset = hasPreamble ? 132 : 0;
  let explicitVr = true;

  while (offset + 8 <= scrubbed.length) {
    const group = scrubbed.readUInt16LE(offset);
    const element = scrubbed.readUInt16LE(offset + 2);
    const tag = `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`;
    const vr = explicitVr ? scrubbed.subarray(offset + 4, offset + 6).toString("ascii") : "UN";
    const headerLength: number = explicitVr && longExplicitVr.has(vr) ? 12 : 8;
    const valueLength: number = explicitVr
      ? longExplicitVr.has(vr)
        ? scrubbed.readUInt32LE(offset + 8)
        : scrubbed.readUInt16LE(offset + 6)
      : scrubbed.readUInt32LE(offset + 4);

    if (valueLength === 0xffffffff || offset + headerLength + valueLength > scrubbed.length) {
      break;
    }

    const valueOffset = offset + headerLength;

    if (phiTags.has(tag)) {
      // Fill value bytes with spaces (0x20) — keeps structure, removes content
      scrubbed.fill(0x20, valueOffset, valueOffset + valueLength);
    }

    if (tag === "0002,0010") {
      explicitVr = scrubbed.subarray(valueOffset, valueOffset + valueLength).toString("ascii").replace(/\0/g, "").trim() !== "1.2.840.10008.1.2";
    }

    if (tag === "7fe0,0010") {
      break;
    }

    offset = valueOffset + valueLength + (valueLength % 2);
  }

  return scrubbed;
}

// Track temp files for cleanup
const tempFiles: string[] = [];

function cleanupTempFiles(): void {
  for (const path of tempFiles) {
    try {
      unlinkSync(path);
    } catch {
      // ignore
    }
  }
}

app.on("before-quit", cleanupTempFiles);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  await window.loadFile(join(__dirname, "../renderer/index.html"));
}

ipcMain.handle("dicom:select-file", async (): Promise<SelectedDicomFile | undefined> => {
  const result = await dialog.showOpenDialog({
    title: "Select DICOM file",
    properties: ["openFile"],
    filters: [{ name: "DICOM", extensions: ["dcm", "dicom"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return undefined;
  }

  const path = result.filePaths[0];
  const [fileStat, contents] = await Promise.all([stat(path), readFile(path)]);

  // Scrub PHI tags from DICOM before any upload
  const scrubbed = scrubDicom(contents);
  const scrubbedPath = join(tmpdir(), `dicom-scrubbed-${Date.now()}.dcm`);
  writeFileSync(scrubbedPath, scrubbed);
  tempFiles.push(scrubbedPath);

  return {
    path,
    name: basename(path),
    sizeBytes: fileStat.size,
    sha256: createHash("sha256").update(contents).digest("hex"),
    scrubbedPath,
    scrubbedSha256: createHash("sha256").update(scrubbed).digest("hex")
  };
});

ipcMain.handle("dicom:inspect-file", async (_event, filePath: string): Promise<DicomInspection> => {
  const contents = await readFile(filePath);
  return inspectDicom(contents);
});

ipcMain.handle("dicom:read-file", async (_event, filePath: string): Promise<ReadDicomFileResult> => {
  const contents = await readFile(filePath);
  return {
    name: basename(filePath),
    data: contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer
  };
});

ipcMain.handle("dicom:upload-file", async (event, input: UploadDicomFileInput): Promise<UploadDicomFileResult> => {
  const uploadUrl = new URL(input.signedUploadUrl);
  const transport = uploadUrl.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = transport(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/dicom",
          "Content-Length": String(input.sizeBytes)
        }
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: string | Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
            statusCode: response.statusCode ?? 0,
            responseBody: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("error", reject);

    let uploadedBytes = 0;
    const stream = createReadStream(input.scrubbedFilePath);

    stream.on("data", (chunk: string | Buffer) => {
      uploadedBytes += Buffer.byteLength(chunk);
      event.sender.send(`dicom:upload-progress:${input.uploadId}`, {
        uploadedBytes,
        totalBytes: input.sizeBytes
      });
    });
    stream.on("error", reject);
    stream.pipe(request);
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

function inspectDicom(contents: Buffer): DicomInspection {
  const metadata: Record<string, string | number> = {};
  const previewMetadata: Record<string, string | number> = {};
  const warnings: string[] = [];
  const hasPreamble = contents.length > 132 && contents.subarray(128, 132).toString("ascii") === "DICM";
  let offset = hasPreamble ? 132 : 0;
  let explicitVr = true;
  let pixelData: { readonly offset: number; readonly length: number } | undefined;

  while (offset + 8 <= contents.length) {
    const group = contents.readUInt16LE(offset);
    const element = contents.readUInt16LE(offset + 2);
    const tag = `${group.toString(16).padStart(4, "0")},${element.toString(16).padStart(4, "0")}`;
    const vr = explicitVr ? contents.subarray(offset + 4, offset + 6).toString("ascii") : "UN";
    const headerLength: number = explicitVr && longExplicitVr.has(vr) ? 12 : 8;
    const valueLength: number = explicitVr
      ? longExplicitVr.has(vr)
        ? contents.readUInt32LE(offset + 8)
        : contents.readUInt16LE(offset + 6)
      : contents.readUInt32LE(offset + 4);

    if (valueLength === 0xffffffff || offset + headerLength + valueLength > contents.length) {
      break;
    }

    const valueOffset: number = offset + headerLength;
    const stringKey = dicomStringTags.get(tag);
    const numericKey = dicomNumericTags.get(tag);

    if (stringKey) {
      metadata[stringKey] = readDicomString(contents, valueOffset, valueLength);
    }

    if (numericKey && valueLength >= 2) {
      metadata[numericKey] = readDicomNumber(contents, valueOffset, valueLength, vr);
    }

    const previewNumericKey = dicomPreviewNumericTags.get(tag);
    if (previewNumericKey && valueLength >= 2) {
      previewMetadata[previewNumericKey] = readDicomNumber(contents, valueOffset, valueLength, vr);
    }

    if (tag === "0028,0004") {
      previewMetadata.photometricInterpretation = readDicomString(contents, valueOffset, valueLength);
    }

    if (tag === "0002,0010") {
      explicitVr = readDicomString(contents, valueOffset, valueLength) !== "1.2.840.10008.1.2";
    }

    if (tag === "7fe0,0010") {
      pixelData = { offset: valueOffset, length: valueLength };
      break;
    }

    offset = valueOffset + valueLength + (valueLength % 2);
  }

  if (!hasPreamble) {
    warnings.push("DICOM preamble marker was not found; parsed file as raw little-endian dataset.");
  }

  return {
    isDicom: hasPreamble || Object.keys(metadata).length > 0,
    metadata: metadata as DicomMetadataSummary,
    deidentificationReport: buildDeidentificationReport(metadata as DicomMetadataSummary),
    pixelPreview: buildPixelPreview(contents, metadata as DicomMetadataSummary, previewMetadata, pixelData, warnings),
    warnings
  };
}

function readDicomString(contents: Buffer, offset: number, length: number): string {
  return contents.subarray(offset, offset + length).toString("utf8").replace(/\0/g, "").trim();
}

function readDicomNumber(contents: Buffer, offset: number, length: number, vr: string): number {
  if (vr === "IS") {
    const value = Number.parseInt(readDicomString(contents, offset, length), 10);
    return Number.isFinite(value) ? value : 0;
  }
  return contents.readUInt16LE(offset);
}

function buildDeidentificationReport(metadata: DicomMetadataSummary): DeidentificationReport {
  return {
    version: 1,
    kind: "deidentification_report",
    rulesetId: "prototype-basic-phi-v1",
    findings: [
      ...(metadata.patientName ? [{ tag: "0010,0010", name: "Patient Name", action: "replaced" as const }] : []),
      ...(metadata.patientId ? [{ tag: "0010,0020", name: "Patient ID", action: "replaced" as const }] : []),
      ...(metadata.patientBirthDate ? [{ tag: "0010,0030", name: "Patient Birth Date", action: "removed" as const }] : []),
      ...(metadata.studyDate ? [{ tag: "0008,0020", name: "Study Date", action: "retained" as const }] : [])
    ]
  };
}

function buildPixelPreview(
  contents: Buffer,
  metadata: DicomMetadataSummary,
  previewMetadata: Record<string, string | number>,
  pixelData: { readonly offset: number; readonly length: number } | undefined,
  warnings: string[]
): DicomPixelPreview | undefined {
  const rows = metadata.rows;
  const columns = metadata.columns;
  const samplesPerPixel = numberFromPreview(previewMetadata.samplesPerPixel, 1);
  const bitsAllocated = numberFromPreview(previewMetadata.bitsAllocated, 8);
  const pixelRepresentation = numberFromPreview(previewMetadata.pixelRepresentation, 0);
  const photometricInterpretation = typeof previewMetadata.photometricInterpretation === "string"
    ? previewMetadata.photometricInterpretation
    : undefined;

  if (!rows || !columns || !pixelData) {
    warnings.push("Pixel preview unavailable; required rows, columns, or pixel data were not found.");
    return undefined;
  }

  if (samplesPerPixel !== 1) {
    warnings.push("Pixel preview supports single-sample grayscale DICOM images only in this prototype.");
    return undefined;
  }

  if (bitsAllocated !== 1 && bitsAllocated !== 8 && bitsAllocated !== 16) {
    warnings.push(`Pixel preview supports 1-bit, 8-bit, and 16-bit grayscale images; this file uses ${bitsAllocated}-bit pixels.`);
    return undefined;
  }

  const bytesPerPixel = bitsAllocated <= 8 ? 1 : 2;
  const requiredBytes = rows * columns * samplesPerPixel * bytesPerPixel;
  if (pixelData.length < requiredBytes || pixelData.offset + requiredBytes > contents.length) {
    warnings.push("Pixel preview unavailable; pixel data length is shorter than expected for the image dimensions.");
    return undefined;
  }

  const scale = Math.max(1, Math.ceil(Math.max(columns, rows) / 256));
  const width = Math.ceil(columns / scale);
  const height = Math.ceil(rows / scale);
  const rawValues: number[] = [];

  if (bitsAllocated === 1) {
    const bitSamples = samplesPerPixel;
    const totalBits = rows * columns * bitSamples;
    for (let y = 0; y < height; y += 1) {
      const sourceY = Math.min(rows - 1, y * scale);
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.min(columns - 1, x * scale);
        const bitIndex = (sourceY * columns + sourceX) * bitSamples;
        const byteIndex = pixelData.offset + Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        if (byteIndex < contents.length) {
          rawValues.push((contents[byteIndex] >> bitOffset) & 1);
        }
      }
    }
  } else {
    const bytesPerPixel = bitsAllocated <= 8 ? 1 : 2;
    for (let y = 0; y < height; y += 1) {
      const sourceY = Math.min(rows - 1, y * scale);
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.min(columns - 1, x * scale);
        const pixelOffset = pixelData.offset + (sourceY * columns + sourceX) * bytesPerPixel;
        rawValues.push(readPixelValue(contents, pixelOffset, bitsAllocated, pixelRepresentation));
      }
    }
  }

  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const inverted = photometricInterpretation === "MONOCHROME1";
  const pixels = rawValues.map((value) => {
    const normalized = max === min ? 0 : Math.round(((value - min) / (max - min)) * 255);
    return inverted ? 255 - normalized : normalized;
  });

  return {
    width,
    height,
    sourceWidth: columns,
    sourceHeight: rows,
    photometricInterpretation,
    bitsAllocated,
    samplesPerPixel,
    pixels
  };
}

function numberFromPreview(value: string | number | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function readPixelValue(contents: Buffer, offset: number, bitsAllocated: number, pixelRepresentation: number): number {
  if (bitsAllocated === 8) {
    return pixelRepresentation === 1 ? contents.readInt8(offset) : contents.readUInt8(offset);
  }
  return pixelRepresentation === 1 ? contents.readInt16LE(offset) : contents.readUInt16LE(offset);
}
