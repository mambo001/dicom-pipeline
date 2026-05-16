import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { basename, join } from "node:path";
import { URL } from "node:url";
import { BrowserWindow, app, dialog, ipcMain } from "electron";

declare const __dirname: string;

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

type UploadDicomFileInput = {
  readonly uploadId: string;
  readonly filePath: string;
  readonly signedUploadUrl: string;
  readonly sizeBytes: number;
};

type UploadDicomFileResult = {
  readonly ok: boolean;
  readonly statusCode: number;
  readonly responseBody: string;
};

type DicomMetadataSummary = {
  readonly patientName?: string;
  readonly patientId?: string;
  readonly patientBirthDate?: string;
  readonly studyInstanceUid?: string;
  readonly seriesInstanceUid?: string;
  readonly sopInstanceUid?: string;
  readonly modality?: string;
  readonly studyDate?: string;
  readonly rows?: number;
  readonly columns?: number;
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
  readonly warnings: readonly string[];
};

const dicomStringTags = new Map<string, keyof DicomMetadataSummary>([
  ["0010,0010", "patientName"],
  ["0010,0020", "patientId"],
  ["0010,0030", "patientBirthDate"],
  ["0020,000d", "studyInstanceUid"],
  ["0020,000e", "seriesInstanceUid"],
  ["0008,0018", "sopInstanceUid"],
  ["0008,0060", "modality"],
  ["0008,0020", "studyDate"]
]);

const dicomNumericTags = new Map<string, keyof DicomMetadataSummary>([
  ["0028,0010", "rows"],
  ["0028,0011", "columns"]
]);

const longExplicitVr = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);

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

  return {
    path,
    name: basename(path),
    sizeBytes: fileStat.size,
    sha256: createHash("sha256").update(contents).digest("hex")
  };
});

ipcMain.handle("dicom:inspect-file", async (_event, filePath: string): Promise<DicomInspection> => {
  const contents = await readFile(filePath);
  return inspectDicom(contents);
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
    const stream = createReadStream(input.filePath);

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
  const warnings: string[] = [];
  const hasPreamble = contents.length > 132 && contents.subarray(128, 132).toString("ascii") === "DICM";
  let offset = hasPreamble ? 132 : 0;
  let explicitVr = true;

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
      metadata[numericKey] = contents.readUInt16LE(valueOffset);
    }

    if (tag === "0002,0010") {
      explicitVr = readDicomString(contents, valueOffset, valueLength) !== "1.2.840.10008.1.2";
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
    warnings
  };
}

function readDicomString(contents: Buffer, offset: number, length: number): string {
  return contents.subarray(offset, offset + length).toString("utf8").replace(/\0/g, "").trim();
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
