import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { BrowserWindow, app, dialog, ipcMain } from "electron";

declare const __dirname: string;

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
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
