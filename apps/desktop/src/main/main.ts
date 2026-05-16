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
    filters: [{ name: "DICOM", extensions: ["dcm", "dicom", "*"] }]
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
