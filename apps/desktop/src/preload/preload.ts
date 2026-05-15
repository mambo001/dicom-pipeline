import { contextBridge, ipcRenderer } from "electron";

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

export type DesktopApi = {
  readonly selectDicomFile: () => Promise<SelectedDicomFile | undefined>;
};

const api: DesktopApi = {
  selectDicomFile: () => ipcRenderer.invoke("dicom:select-file") as Promise<SelectedDicomFile | undefined>
};

contextBridge.exposeInMainWorld("dicomDesktop", api);
