import { create } from "zustand";
import {
  validateUnknown,
  BackendUrlSchema,
  CreateUploadSessionResponseSchema,
  StorageObjectRecordSchema,
  AuditEventSchema
} from "@dicom-pipeline/contracts";
import type { AuditEvent, CreateUploadSessionResponse, StorageObjectRecord } from "@dicom-pipeline/contracts";

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

type DicomInspection = {
  readonly isDicom: boolean;
  readonly metadata: import("@dicom-pipeline/contracts").DicomMetadataSummary;
  readonly deidentificationReport: import("@dicom-pipeline/contracts").DeidentificationReport;
  readonly pixelPreview?: {
    readonly width: number;
    readonly height: number;
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly photometricInterpretation?: string;
    readonly bitsAllocated?: number;
    readonly samplesPerPixel?: number;
    readonly pixels: readonly number[];
  };
  readonly warnings: readonly string[];
};

type DicomDesktopApi = {
  readonly selectDicomFile: () => Promise<SelectedDicomFile | undefined>;
  readonly inspectDicomFile: (filePath: string) => Promise<DicomInspection>;
  readonly uploadDicomFile: (
    input: {
      readonly uploadId: string;
      readonly filePath: string;
      readonly signedUploadUrl: string;
      readonly sizeBytes: number;
    },
    onProgress: (progress: { readonly uploadedBytes: number; readonly totalBytes: number }) => void
  ) => Promise<{ readonly ok: boolean; readonly statusCode: number; readonly responseBody: string }>;
};

type WorkflowMessage = {
  readonly level: "info" | "success" | "error";
  readonly text: string;
};

type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

function getDesktopApi(): DicomDesktopApi {
  return (window as Window & { readonly dicomDesktop: DicomDesktopApi }).dicomDesktop;
}

function loadKnownUrls(): readonly string[] {
  const stored = localStorage.getItem("dicom-known-urls");
  if (stored) {
    try {
      return JSON.parse(stored) as string[];
    } catch {
      return defaultKnownUrls;
    }
  }
  return defaultKnownUrls;
}

const defaultKnownUrls = [
  "http://localhost:8080",
  "https://dicom-pipeline-backend-wnlvetmltq-uc.a.run.app"
];

function persistKnownUrl(url: string) {
  const stored = localStorage.getItem("dicom-known-urls");
  let urls: string[] = [...defaultKnownUrls];
  if (stored) {
    try {
      urls = JSON.parse(stored) as string[];
    } catch {
      // ignore
    }
  }
  if (!urls.includes(url)) {
    urls = [url, ...urls].slice(0, 10);
  }
  localStorage.setItem("dicom-known-urls", JSON.stringify(urls));
}

export type IngestionState = {
  readonly backendUrl: string;
  readonly backendUrlReady: boolean;
  readonly backendUrlError: string | undefined;
  readonly knownUrls: readonly string[];
  readonly correlationId: string;
  readonly selectedFile: SelectedDicomFile | undefined;
  readonly dicomInspection: DicomInspection | undefined;
  readonly uploadSession: CreateUploadSessionResponse | undefined;
  readonly storageRecord: StorageObjectRecord | undefined;
  readonly uploadStatus: UploadStatus;
  readonly uploadProgress: number;
  readonly auditEvents: readonly AuditEvent[];
  readonly messages: readonly WorkflowMessage[];
  readonly viewerSource: "local" | "uploaded";
  readonly signedReadUrl: string | undefined;

  readonly setBackendUrl: (url: string) => void;
  readonly persistBackendUrl: () => void;
  readonly selectFile: () => Promise<void>;
  readonly requestUploadSession: () => Promise<void>;
  readonly uploadFile: () => Promise<void>;
  readonly setViewerSource: (source: "local" | "uploaded") => void;
  readonly loadSignedReadUrl: () => Promise<void>;
  readonly refreshTraceability: () => Promise<void>;
};

export const useIngestionStore = create<IngestionState>((set, get) => ({
  backendUrl: localStorage.getItem("dicom-backend-url") || "http://localhost:8080",
  backendUrlReady: true,
  backendUrlError: undefined,
  knownUrls: loadKnownUrls(),
  correlationId: crypto.randomUUID(),
  selectedFile: undefined,
  dicomInspection: undefined,
  uploadSession: undefined,
  storageRecord: undefined,
  uploadStatus: "idle" as UploadStatus,
  uploadProgress: 0,
  auditEvents: [],
  messages: [],
  viewerSource: "local" as const,
  signedReadUrl: undefined,

  setBackendUrl: (url: string) => {
    const validated = validateUnknown(BackendUrlSchema, url);
    set({
      backendUrl: url,
      backendUrlReady: validated.ok,
      backendUrlError: validated.ok ? undefined : "Backend URL required to enable actions"
    });
  },

  persistBackendUrl: () => {
    const { backendUrl } = get();
    localStorage.setItem("dicom-backend-url", backendUrl);
    const trimmed = backendUrl.trim();
    if (trimmed) {
      persistKnownUrl(trimmed);
    }
  },

  selectFile: async () => {
    const file = await getDesktopApi().selectDicomFile();
    if (!file) {
      return;
    }

    const nextCorrelationId = crypto.randomUUID();
    set({
      correlationId: nextCorrelationId,
      selectedFile: file,
      dicomInspection: undefined,
      uploadSession: undefined,
      storageRecord: undefined,
      uploadStatus: "idle" as UploadStatus,
      uploadProgress: 0,
      auditEvents: [],
      viewerSource: "local" as const,
      signedReadUrl: undefined
    });
    addMessage(set, "success", `Selected ${file.name}`);

    await appendAuditEvent(set, get, nextCorrelationId, "dicom.file.selected", "local_file", file.sha256, {
      fileName: file.name,
      sizeBytes: file.sizeBytes
    });

    await inspectSelectedFile(set, get, file, nextCorrelationId);
  },

  requestUploadSession: async () => {
    const { backendUrl, selectedFile, correlationId, dicomInspection } = get();
    if (!selectedFile) {
      addMessage(set, "error", "Select a DICOM file before requesting an upload session.");
      return;
    }

    await appendAuditEvent(set, get, correlationId, "upload.session.requested", "local_file", selectedFile.sha256, {
      fileName: selectedFile.name
    });

    const response = await fetch(`${backendUrl}/api/upload-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        kind: "create_upload_session_request",
        correlationId,
        fileName: selectedFile.name,
        contentType: "application/dicom",
        dicomMetadata: dicomInspection?.metadata,
        fileSha256: selectedFile.sha256,
        sizeBytes: selectedFile.sizeBytes
      })
    });

    if (!response.ok) {
      addMessage(set, "error", "Backend rejected upload session request.");
      return;
    }

    const body = await response.json();
    const validated = validateUnknown(CreateUploadSessionResponseSchema, body);
    if (!validated.ok) {
      addMessage(set, "error", `Invalid upload session response: ${validated.errors}`);
      return;
    }

    const session = validated.value as CreateUploadSessionResponse;
    set({ uploadSession: session });
    await loadStorageRecord(set, get, session.uploadSessionId);
    set({ uploadStatus: "idle" as UploadStatus, uploadProgress: 0 });
    addMessage(set, "success", "Upload session created with signed storage URL.");
  },

  uploadFile: async () => {
    const { backendUrl, selectedFile, uploadSession, correlationId, uploadStatus } = get();
    if (!selectedFile || !uploadSession) {
      addMessage(set, "error", "Create an upload session before uploading the file.");
      return;
    }

    const uploadId = crypto.randomUUID();

    set({ uploadStatus: "uploading" as UploadStatus, uploadProgress: 0 });
    await updateUploadStatus(set, get, backendUrl, uploadSession.uploadSessionId, "uploading");
    await appendAuditEvent(set, get, correlationId, "upload.started", "upload_session", uploadSession.uploadSessionId, {
      objectName: uploadSession.objectName
    });

    try {
      const result = await getDesktopApi().uploadDicomFile(
        {
          uploadId,
          filePath: selectedFile.path,
          signedUploadUrl: uploadSession.signedUploadUrl,
          sizeBytes: selectedFile.sizeBytes
        },
        (progress) => {
          if (progress.totalBytes > 0) {
            set({ uploadProgress: Math.round((progress.uploadedBytes / progress.totalBytes) * 100) });
          }
        }
      );

      if (!result.ok) {
        throw new Error(`Upload failed with HTTP ${result.statusCode}`);
      }

      set({ uploadStatus: "uploaded" as UploadStatus, uploadProgress: 100 });
      await updateUploadStatus(set, get, backendUrl, uploadSession.uploadSessionId, "uploaded");
      await appendAuditEvent(set, get, correlationId, "upload.succeeded", "storage_object", uploadSession.objectName, {
        uploadSessionId: uploadSession.uploadSessionId,
        sizeBytes: selectedFile.sizeBytes
      });
      addMessage(set, "success", "File uploaded to signed storage URL.");
    } catch (error) {
      set({ uploadStatus: "failed" as UploadStatus });
      await updateUploadStatus(set, get, backendUrl, uploadSession.uploadSessionId, "failed");
      await appendAuditEvent(
        set, get, correlationId, "upload.failed", "upload_session", uploadSession.uploadSessionId,
        { message: error instanceof Error ? error.message : "Unknown upload error" },
        "failure", "upload_failed"
      );
      addMessage(set, "error", error instanceof Error ? error.message : "Upload failed.");
    }
  },

  setViewerSource: (source: "local" | "uploaded") => {
    set({ viewerSource: source });
  },

  loadSignedReadUrl: async () => {
    const { backendUrl, uploadSession, uploadStatus } = get();
    if (!uploadSession || uploadStatus !== "uploaded") {
      addMessage(set, "error", "Upload a DICOM file before viewing.");
      return;
    }

    const response = await fetch(`${backendUrl}/api/upload-sessions/${uploadSession.uploadSessionId}/signed-read`);
    if (!response.ok) {
      addMessage(set, "error", "Failed to get signed read URL for uploaded file.");
      return;
    }

    const body = await response.json();
    if (typeof body.signedReadUrl === "string") {
      set({ signedReadUrl: body.signedReadUrl, viewerSource: "uploaded" });
      addMessage(set, "info", "Loaded uploaded file into viewer.");
    } else {
      addMessage(set, "error", "Invalid signed read URL response.");
    }
  },

  refreshTraceability: async () => {
    const { backendUrl, correlationId, uploadSession } = get();
    await loadAuditEvents(set, get, backendUrl, correlationId);
    if (uploadSession) {
      await loadStorageRecord(set, get, uploadSession.uploadSessionId);
    }
  }
}));

async function appendAuditEvent(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  get: () => IngestionState,
  eventCorrelationId: string,
  action: AuditEvent["action"],
  targetKind: AuditEvent["target"]["kind"],
  targetId: string,
  details?: Record<string, string | number | boolean | null>,
  result: AuditEvent["result"] = "success",
  errorCode?: string
) {
  const { backendUrl, correlationId } = get();
  const event: AuditEvent = {
    version: 1,
    kind: "audit_event",
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    correlationId: eventCorrelationId,
    actor: { kind: "desktop", id: "local-prototype-client" },
    action,
    target: { kind: targetKind, id: targetId },
    result,
    details,
    errorCode
  };

  const response = await fetch(`${backendUrl}/api/audit-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    addMessage(set, "error", `Failed to write audit event: ${action}`);
    return;
  }

  const body = await response.json();
  const validated = validateUnknown(AuditEventSchema, body);
  if (validated.ok) {
    const appended = validated.value as AuditEvent;
    if (appended.correlationId === correlationId || appended.correlationId === eventCorrelationId) {
      set((state) => ({ auditEvents: [...state.auditEvents, appended] }));
    }
  }
}

async function loadAuditEvents(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  get: () => IngestionState,
  backendUrl: string,
  correlationId: string
) {
  const response = await fetch(`${backendUrl}/api/audit-events/${correlationId}`);
  if (!response.ok) {
    addMessage(set, "error", "Failed to load audit timeline.");
    return;
  }
  const body = await response.json() as { readonly events: readonly AuditEvent[] };
  set({ auditEvents: body.events });
}

async function loadStorageRecord(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  get: () => IngestionState,
  uploadSessionId: string
) {
  const { backendUrl } = get();
  const response = await fetch(`${backendUrl}/api/upload-sessions/${uploadSessionId}`);
  if (!response.ok) {
    addMessage(set, "error", "Failed to load upload session status.");
    return;
  }

  const body = await response.json();
  const validated = validateUnknown(StorageObjectRecordSchema, body);
  if (validated.ok) {
    const record = validated.value as StorageObjectRecord;
    set({
      storageRecord: record,
      uploadStatus: record.status === "created" ? "idle" as UploadStatus : record.status as UploadStatus
    });
  } else {
    addMessage(set, "error", `Invalid storage record response: ${validated.errors}`);
  }
}

async function updateUploadStatus(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  get: () => IngestionState,
  backendUrl: string,
  uploadSessionId: string,
  status: "uploading" | "uploaded" | "failed"
) {
  const response = await fetch(`${backendUrl}/api/upload-sessions/${uploadSessionId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    addMessage(set, "error", `Failed to update upload status: ${status}`);
    return;
  }

  const body = await response.json();
  const validated = validateUnknown(StorageObjectRecordSchema, body);
  if (validated.ok) {
    set({ storageRecord: validated.value as StorageObjectRecord });
  }
}

async function inspectSelectedFile(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  get: () => IngestionState,
  file: SelectedDicomFile,
  nextCorrelationId: string
) {
  try {
    const inspection = await getDesktopApi().inspectDicomFile(file.path);
    set({ dicomInspection: inspection });

    if (!inspection.isDicom) {
      addMessage(set, "error", "File does not look like a parseable DICOM dataset.");
      return;
    }

    await appendAuditEvent(set, get, nextCorrelationId, "dicom.metadata.parsed", "local_file", file.sha256, {
      modality: inspection.metadata.modality ?? null,
      studyInstanceUid: inspection.metadata.studyInstanceUid ?? null,
      pixelPreviewAvailable: Boolean(inspection.pixelPreview),
      phiFindingCount: inspection.deidentificationReport.findings.length
    });

    if (inspection.deidentificationReport.findings.length > 0) {
      await appendAuditEvent(set, get, nextCorrelationId, "dicom.phi.detected", "local_file", file.sha256, {
        findingCount: inspection.deidentificationReport.findings.length,
        rulesetId: inspection.deidentificationReport.rulesetId
      });
    }

    await appendAuditEvent(set, get, nextCorrelationId, "dicom.deidentified", "local_file", file.sha256, {
      mode: "preview_only",
      rulesetId: inspection.deidentificationReport.rulesetId
    });
    addMessage(set, "success", "DICOM metadata inspected and de-identification preview generated.");
  } catch (error) {
    addMessage(set, "error", error instanceof Error ? error.message : "DICOM inspection failed.");
  }
}

function addMessage(
  set: (partial: Partial<IngestionState> | ((state: IngestionState) => Partial<IngestionState>)) => void,
  level: WorkflowMessage["level"],
  text: string
) {
  set((state) => ({ messages: [{ level, text }, ...state.messages] }));
}
