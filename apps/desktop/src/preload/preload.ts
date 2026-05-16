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

type DicomInspection = {
  readonly isDicom: boolean;
  readonly metadata: DicomMetadataSummary;
  readonly deidentificationReport: DeidentificationReport;
  readonly pixelPreview?: DicomPixelPreview;
  readonly warnings: readonly string[];
};

export type DesktopApi = {
  readonly selectDicomFile: () => Promise<SelectedDicomFile | undefined>;
  readonly inspectDicomFile: (filePath: string) => Promise<DicomInspection>;
  readonly uploadDicomFile: (
    input: UploadDicomFileInput,
    onProgress: (progress: UploadProgress) => void
  ) => Promise<UploadDicomFileResult>;
};

const api: DesktopApi = {
  selectDicomFile: () => ipcRenderer.invoke("dicom:select-file") as Promise<SelectedDicomFile | undefined>,
  inspectDicomFile: (filePath) => ipcRenderer.invoke("dicom:inspect-file", filePath) as Promise<DicomInspection>,
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
