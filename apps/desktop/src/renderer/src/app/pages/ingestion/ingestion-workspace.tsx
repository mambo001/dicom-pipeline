import { useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import {
  type AuditEvent,
  type CreateUploadSessionResponse,
  type DeidentificationReport,
  type DicomMetadataSummary,
  type StorageObjectRecord
} from "@dicom-pipeline/contracts";

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
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

type DicomInspection = {
  readonly isDicom: boolean;
  readonly metadata: DicomMetadataSummary;
  readonly deidentificationReport: DeidentificationReport;
  readonly warnings: readonly string[];
};

function getDesktopApi(): DicomDesktopApi {
  return (window as Window & { readonly dicomDesktop: DicomDesktopApi }).dicomDesktop;
}

type WorkflowMessage = {
  readonly level: "info" | "success" | "error";
  readonly text: string;
};

type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

export function IngestionWorkspace() {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8080");
  const [correlationId, setCorrelationId] = useState(() => crypto.randomUUID());
  const [selectedFile, setSelectedFile] = useState<SelectedDicomFile>();
  const [dicomInspection, setDicomInspection] = useState<DicomInspection>();
  const [uploadSession, setUploadSession] = useState<CreateUploadSessionResponse>();
  const [storageRecord, setStorageRecord] = useState<StorageObjectRecord>();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [auditEvents, setAuditEvents] = useState<readonly AuditEvent[]>([]);
  const [messages, setMessages] = useState<readonly WorkflowMessage[]>([]);

  async function selectFile() {
    const file = await getDesktopApi().selectDicomFile();

    if (!file) {
      return;
    }

    const nextCorrelationId = crypto.randomUUID();
    setCorrelationId(nextCorrelationId);
    setSelectedFile(file);
    setDicomInspection(undefined);
    setUploadSession(undefined);
    setStorageRecord(undefined);
    setUploadStatus("idle");
    setUploadProgress(0);
    setAuditEvents([]);
    addMessage("success", `Selected ${file.name}`);

    await appendAuditEvent(nextCorrelationId, "dicom.file.selected", "local_file", file.sha256, {
      fileName: file.name,
      sizeBytes: file.sizeBytes
    });

    await inspectSelectedFile(file, nextCorrelationId);
  }

  async function inspectSelectedFile(file: SelectedDicomFile, nextCorrelationId: string) {
    try {
      const inspection = await getDesktopApi().inspectDicomFile(file.path);
      setDicomInspection(inspection);

      if (!inspection.isDicom) {
        addMessage("error", "File does not look like a parseable DICOM dataset.");
        return;
      }

      await appendAuditEvent(nextCorrelationId, "dicom.metadata.parsed", "local_file", file.sha256, {
        modality: inspection.metadata.modality ?? null,
        studyInstanceUid: inspection.metadata.studyInstanceUid ?? null,
        phiFindingCount: inspection.deidentificationReport.findings.length
      });

      if (inspection.deidentificationReport.findings.length > 0) {
        await appendAuditEvent(nextCorrelationId, "dicom.phi.detected", "local_file", file.sha256, {
          findingCount: inspection.deidentificationReport.findings.length,
          rulesetId: inspection.deidentificationReport.rulesetId
        });
      }

      await appendAuditEvent(nextCorrelationId, "dicom.deidentified", "local_file", file.sha256, {
        mode: "preview_only",
        rulesetId: inspection.deidentificationReport.rulesetId
      });
      addMessage("success", "DICOM metadata inspected and de-identification preview generated.");
    } catch (error) {
      addMessage("error", error instanceof Error ? error.message : "DICOM inspection failed.");
    }
  }

  async function requestUploadSession() {
    if (!selectedFile) {
      addMessage("error", "Select a DICOM file before requesting an upload session.");
      return;
    }

    await appendAuditEvent(correlationId, "upload.session.requested", "local_file", selectedFile.sha256, {
      fileName: selectedFile.name
    });

    const response = await fetch(`${backendUrl}/api/upload-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          version: 1,
          kind: "create_upload_session_request",
          correlationId,
          fileName: selectedFile.name,
          contentType: "application/dicom",
          fileSha256: selectedFile.sha256,
          sizeBytes: selectedFile.sizeBytes
        }
      )
    });

    if (!response.ok) {
      addMessage("error", "Backend rejected upload session request.");
      return;
    }

    const session = (await response.json()) as CreateUploadSessionResponse;
    setUploadSession(session);
    await loadStorageRecord(session.uploadSessionId);
    setUploadStatus("idle");
    setUploadProgress(0);
    addMessage("success", "Upload session created with signed storage URL.");
  }

  async function uploadFile() {
    if (!selectedFile || !uploadSession) {
      addMessage("error", "Create an upload session before uploading the file.");
      return;
    }

    const uploadId = crypto.randomUUID();

    setUploadStatus("uploading");
    setUploadProgress(0);
    await updateUploadStatus(uploadSession.uploadSessionId, "uploading");
    await appendAuditEvent(correlationId, "upload.started", "upload_session", uploadSession.uploadSessionId, {
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
            setUploadProgress(Math.round((progress.uploadedBytes / progress.totalBytes) * 100));
          }
        }
      );

      if (!result.ok) {
        throw new Error(`Upload failed with HTTP ${result.statusCode}`);
      }

      setUploadStatus("uploaded");
      setUploadProgress(100);
      await updateUploadStatus(uploadSession.uploadSessionId, "uploaded");
      await appendAuditEvent(correlationId, "upload.succeeded", "storage_object", uploadSession.objectName, {
        uploadSessionId: uploadSession.uploadSessionId,
        sizeBytes: selectedFile.sizeBytes
      });
      addMessage("success", "File uploaded to signed storage URL.");
    } catch (error) {
      setUploadStatus("failed");
      await updateUploadStatus(uploadSession.uploadSessionId, "failed");
      await appendAuditEvent(
        correlationId,
        "upload.failed",
        "upload_session",
        uploadSession.uploadSessionId,
        { message: error instanceof Error ? error.message : "Unknown upload error" },
        "failure",
        "upload_failed"
      );
      addMessage("error", error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function updateUploadStatus(uploadSessionId: string, status: "uploading" | "uploaded" | "failed") {
    const response = await fetch(`${backendUrl}/api/upload-sessions/${uploadSessionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      addMessage("error", `Failed to update upload status: ${status}`);
      return;
    }

    const record = (await response.json()) as StorageObjectRecord;
    setStorageRecord(record);
  }

  async function loadStorageRecord(uploadSessionId: string) {
    const response = await fetch(`${backendUrl}/api/upload-sessions/${uploadSessionId}`);

    if (!response.ok) {
      addMessage("error", "Failed to load upload session status.");
      return;
    }

    const record = (await response.json()) as StorageObjectRecord;
    setStorageRecord(record);
    setUploadStatus(record.status === "created" ? "idle" : record.status);
  }

  async function loadAuditEvents() {
    const response = await fetch(`${backendUrl}/api/audit-events/${correlationId}`);

    if (!response.ok) {
      addMessage("error", "Failed to load audit timeline.");
      return;
    }

    const body = (await response.json()) as { readonly events: readonly AuditEvent[] };
    setAuditEvents(body.events);
  }

  async function refreshTraceability() {
    await loadAuditEvents();

    if (uploadSession) {
      await loadStorageRecord(uploadSession.uploadSessionId);
    }
  }

  async function appendAuditEvent(
    eventCorrelationId: string,
    action: AuditEvent["action"],
    targetKind: AuditEvent["target"]["kind"],
    targetId: string,
    details?: Record<string, string | number | boolean | null>,
    result: AuditEvent["result"] = "success",
    errorCode?: string
  ) {
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
      addMessage("error", `Failed to write audit event: ${action}`);
      return;
    }

    const appended = (await response.json()) as AuditEvent;

    if (appended.correlationId === correlationId || appended.correlationId === eventCorrelationId) {
      setAuditEvents((current) => [...current, appended]);
    }
  }

  function addMessage(level: WorkflowMessage["level"], text: string) {
    setMessages((current) => [{ level, text }, ...current].slice(0, 8));
  }

  return (
    <Stack spacing={3}>
      <Card
        sx={(theme) => ({
          bgcolor: "primary.main",
          color: "common.white",
          borderColor: alpha(theme.palette.common.white, 0.16)
        })}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2} sx={{ maxWidth: 820 }}>
            <Typography variant="overline" color="info.main">
              Medical Imaging Ingestion
            </Typography>
            <Typography variant="h1">DICOM intake, audit, and cloud upload.</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.78)", maxWidth: 680 }}>
              Select a local DICOM file, write audit events, and request a signed upload session
              for cloud-native storage.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Grid container spacing={2} sx={{ alignItems: "end" }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Backend URL"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button fullWidth variant="contained" size="large" onClick={selectFile}>
                Select DICOM
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={requestUploadSession}
                disabled={!selectedFile}
              >
                Create session
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                fullWidth
                variant="contained"
                color={uploadStatus === "failed" ? "warning" : "secondary"}
                size="large"
                onClick={uploadFile}
                disabled={!selectedFile || !uploadSession || uploadStatus === "uploading" || uploadStatus === "uploaded"}
              >
                {uploadStatus === "failed" ? "Retry upload" : "Upload file"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <InfoCard title="Selected File" emptyText="No DICOM file selected.">
            {selectedFile && (
              <Details
                rows={[
                  ["Name", selectedFile.name],
                  ["Size", `${selectedFile.sizeBytes.toLocaleString()} bytes`],
                  ["SHA-256", selectedFile.sha256],
                  ["Correlation ID", correlationId]
                ]}
              />
            )}
          </InfoCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <InfoCard title="Upload Session" emptyText="Request a session after selecting a file.">
            {uploadSession && (
              <Details
                rows={[
                  ["Session ID", uploadSession.uploadSessionId],
                  ["Object", uploadSession.objectName],
                  ["Expires", uploadSession.expiresAt],
                  ["UI Status", uploadStatus],
                  ["Stored Status", storageRecord?.status ?? "not loaded"]
                ]}
              />
            )}
            {uploadSession && uploadStatus !== "idle" && (
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.75 }}>
                  <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
                    Upload Progress
                  </Typography>
                  <Typography color="text.secondary">{uploadProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
          </InfoCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <InfoCard title="DICOM Metadata" emptyText="Select a DICOM file to inspect metadata.">
            {dicomInspection && (
              <Stack spacing={2}>
                <Chip
                  size="small"
                  label={dicomInspection.isDicom ? "Parseable DICOM" : "DICOM not confirmed"}
                  color={dicomInspection.isDicom ? "success" : "warning"}
                  sx={{ alignSelf: "flex-start" }}
                />
                <Details rows={metadataRows(dicomInspection.metadata)} />
                {dicomInspection.warnings.map((warning) => (
                  <Typography key={warning} color="warning.main">
                    {warning}
                  </Typography>
                ))}
              </Stack>
            )}
          </InfoCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <InfoCard title="De-Identification Preview" emptyText="Metadata inspection will generate a de-id preview.">
            {dicomInspection && (
              <Stack spacing={2}>
                <Details rows={[["Ruleset", dicomInspection.deidentificationReport.rulesetId]]} />
                <List disablePadding>
                  {dicomInspection.deidentificationReport.findings.length === 0 ? (
                    <ListItem disableGutters>
                      <ListItemText primary="No configured PHI tags found." />
                    </ListItem>
                  ) : (
                    dicomInspection.deidentificationReport.findings.map((finding) => (
                      <ListItem key={`${finding.tag}-${finding.name}`} disableGutters>
                        <Chip size="small" label={finding.action} sx={{ mr: 1.5, minWidth: 76 }} />
                        <ListItemText primary={finding.name} secondary={finding.tag} />
                      </ListItem>
                    ))
                  )}
                </List>
              </Stack>
            )}
          </InfoCard>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h2">Workflow Log</Typography>
            <Chip size="small" label={`${messages.length} events`} />
          </Stack>
          <Divider />
          <List disablePadding>
            {messages.length === 0 ? (
              <ListItem disableGutters>
                <ListItemText primary="No workflow events yet." />
              </ListItem>
            ) : (
              messages.map((message, index) => (
                <ListItem key={`${message.text}-${index}`} disableGutters>
                  <Chip
                    size="small"
                    label={message.level}
                    color={message.level === "error" ? "error" : message.level === "success" ? "success" : "info"}
                    sx={{ mr: 1.5, minWidth: 72 }}
                  />
                  <ListItemText primary={message.text} />
                </ListItem>
              ))
            )}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h2">Audit Timeline</Typography>
            <Button variant="outlined" size="small" onClick={refreshTraceability} disabled={!selectedFile}>
              Refresh trace
            </Button>
          </Stack>
          <Divider />
          <List disablePadding>
            {auditEvents.length === 0 ? (
              <ListItem disableGutters>
                <ListItemText primary="No persisted audit events loaded." />
              </ListItem>
            ) : (
              auditEvents.map((event) => (
                <ListItem key={event.eventId} disableGutters>
                  <Chip
                    size="small"
                    label={event.result}
                    color={event.result === "success" ? "success" : "error"}
                    sx={{ mr: 1.5, minWidth: 72 }}
                  />
                  <ListItemText
                    primary={event.action}
                    secondary={`${event.occurredAt} | ${event.target.kind}: ${event.target.id}`}
                  />
                </ListItem>
              ))
            )}
          </List>
        </CardContent>
      </Card>
    </Stack>
  );
}

function metadataRows(metadata: DicomMetadataSummary): readonly (readonly [string, string])[] {
  return [
    ["Patient", metadata.patientName ?? "not present"],
    ["Patient ID", metadata.patientId ?? "not present"],
    ["Birth Date", metadata.patientBirthDate ?? "not present"],
    ["Modality", metadata.modality ?? "not present"],
    ["Study Date", metadata.studyDate ?? "not present"],
    ["Study UID", metadata.studyInstanceUid ?? "not present"],
    ["Series UID", metadata.seriesInstanceUid ?? "not present"],
    ["SOP UID", metadata.sopInstanceUid ?? "not present"],
    ["Image Size", metadata.rows && metadata.columns ? `${metadata.columns} x ${metadata.rows}` : "not present"]
  ];
}

function InfoCard(props: {
  readonly title: string;
  readonly emptyText: string;
  readonly children?: ReactNode;
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h2" sx={{ mb: 2 }}>
          {props.title}
        </Typography>
        {props.children ?? <Typography color="text.secondary">{props.emptyText}</Typography>}
      </CardContent>
    </Card>
  );
}

function Details(props: { readonly rows: readonly (readonly [string, string])[] }) {
  return (
    <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 1 }}>
      {props.rows.map(([label, value]) => (
        <Box component="div" key={label} sx={{ display: "contents" }}>
          <Typography component="dt" color="text.secondary" sx={{ fontWeight: 800 }}>
            {label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, overflowWrap: "anywhere", fontFamily: label.includes("ID") || label === "SHA-256" ? "monospace" : undefined }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
