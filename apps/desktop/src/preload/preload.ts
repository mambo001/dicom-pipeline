import { contextBridge, ipcRenderer } from "electron";

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

type UploadProgress = {
  readonly uploadedBytes: number;
  readonly totalBytes: number;
};

type UploadDicomFileResult = {
  readonly ok: boolean;
  readonly statusCode: number;
  readonly responseBody: string;
};

export type DesktopApi = {
  readonly selectDicomFile: () => Promise<SelectedDicomFile | undefined>;
  readonly uploadDicomFile: (
    input: UploadDicomFileInput,
    onProgress: (progress: UploadProgress) => void
  ) => Promise<UploadDicomFileResult>;
};

const api: DesktopApi = {
  selectDicomFile: () => ipcRenderer.invoke("dicom:select-file") as Promise<SelectedDicomFile | undefined>,
  uploadDicomFile: async (input, onProgress) => {
    const channel = `dicom:upload-progress:${input.uploadId}`;
    const listener = (_event: Electron.IpcRendererEvent, progress: UploadProgress) => onProgress(progress);

    ipcRenderer.on(channel, listener);

    try {
      return (await ipcRenderer.invoke("dicom:upload-file", input)) as UploadDicomFileResult;
    } finally {
      ipcRenderer.removeListener(channel, listener);
    }
  }
};

contextBridge.exposeInMainWorld("dicomDesktop", api);
