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
  createAuditEvent,
  createUploadSessionRequest,
  type CreateUploadSessionResponse
} from "@dicom-pipeline/contracts";

type SelectedDicomFile = {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

type DicomDesktopApi = {
  readonly selectDicomFile: () => Promise<SelectedDicomFile | undefined>;
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
  const [uploadSession, setUploadSession] = useState<CreateUploadSessionResponse>();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messages, setMessages] = useState<readonly WorkflowMessage[]>([]);

  async function selectFile() {
    const file = await getDesktopApi().selectDicomFile();

    if (!file) {
      return;
    }

    const nextCorrelationId = crypto.randomUUID();
    setCorrelationId(nextCorrelationId);
    setSelectedFile(file);
    setUploadSession(undefined);
    setUploadStatus("idle");
    setUploadProgress(0);
    addMessage("success", `Selected ${file.name}`);

    await appendAuditEvent(nextCorrelationId, "dicom.file.selected", "local_file", file.sha256, {
      fileName: file.name,
      sizeBytes: file.sizeBytes
    });
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
        createUploadSessionRequest({
          correlationId,
          fileName: selectedFile.name,
          fileSha256: selectedFile.sha256,
          sizeBytes: selectedFile.sizeBytes
        })
      )
    });

    if (!response.ok) {
      addMessage("error", "Backend rejected upload session request.");
      return;
    }

    const session = (await response.json()) as CreateUploadSessionResponse;
    setUploadSession(session);
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
    }
  }

  async function appendAuditEvent(
    eventCorrelationId: string,
    action: Parameters<typeof createAuditEvent>[0]["action"],
    targetKind: Parameters<typeof createAuditEvent>[0]["target"]["kind"],
    targetId: string,
    details?: Record<string, string | number | boolean | null>,
    result: Parameters<typeof createAuditEvent>[0]["result"] = "success",
    errorCode?: string
  ) {
    const event = createAuditEvent({
      correlationId: eventCorrelationId,
      actor: { kind: "desktop", id: "local-prototype-client" },
      action,
      target: { kind: targetKind, id: targetId },
      result,
      details,
      errorCode
    });

    const response = await fetch(`${backendUrl}/api/audit-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      addMessage("error", `Failed to write audit event: ${action}`);
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
                  ["Status", uploadStatus]
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
    </Stack>
  );
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
