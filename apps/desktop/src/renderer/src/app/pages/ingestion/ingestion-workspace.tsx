import { useRef } from "react";
import type { ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import SvgIcon from "@mui/material/SvgIcon";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { format, isValid, parse } from "date-fns";
import type { DicomMetadataSummary } from "@dicom-pipeline/contracts";
import { useIngestionStore } from "./use-ingestion-store";

export function IngestionWorkspace() {
  const backendUrl = useIngestionStore((s) => s.backendUrl);
  const backendUrlReady = useIngestionStore((s) => s.backendUrlReady);
  const backendUrlError = useIngestionStore((s) => s.backendUrlError);
  const knownUrls = useIngestionStore((s) => s.knownUrls);
  const correlationId = useIngestionStore((s) => s.correlationId);
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const dicomInspection = useIngestionStore((s) => s.dicomInspection);
  const uploadSession = useIngestionStore((s) => s.uploadSession);
  const storageRecord = useIngestionStore((s) => s.storageRecord);
  const uploadStatus = useIngestionStore((s) => s.uploadStatus);
  const uploadProgress = useIngestionStore((s) => s.uploadProgress);
  const auditEvents = useIngestionStore((s) => s.auditEvents);
  const messages = useIngestionStore((s) => s.messages);
  const setBackendUrl = useIngestionStore((s) => s.setBackendUrl);
  const persistBackendUrl = useIngestionStore((s) => s.persistBackendUrl);
  const selectFile = useIngestionStore((s) => s.selectFile);
  const requestUploadSession = useIngestionStore((s) => s.requestUploadSession);
  const uploadFile = useIngestionStore((s) => s.uploadFile);
  const refreshTraceability = useIngestionStore((s) => s.refreshTraceability);

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
          <Typography variant="h2" sx={{ mb: 1.5 }}>How it works</Typography>
          <Stack spacing={1}>
            <Typography color="text.secondary">
              <strong>1. Select</strong> — Choose a local DICOM file. Metadata is inspected locally and a de-identification preview is generated.
            </Typography>
            <Typography color="text.secondary">
              <strong>2. Create session</strong> — Request a signed upload URL from the backend. The session is time-limited and auditable.
            </Typography>
            <Typography color="text.secondary">
              <strong>3. Upload</strong> — Stream the file to the signed URL. Every step is recorded in an append-only audit timeline for regulatory traceability.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Autocomplete
                freeSolo
                disableClearable
                options={knownUrls}
                value={backendUrl}
                onInputChange={(_, value) => setBackendUrl(value)}
                onBlur={persistBackendUrl}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Backend URL"
                    error={!backendUrlReady}
                    helperText={backendUrlError}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button fullWidth variant="contained" size="large" onClick={selectFile} disabled={!backendUrlReady}>
                Select DICOM
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={requestUploadSession}
                disabled={!backendUrlReady || !selectedFile}
              >
                Create session
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button
                fullWidth
                variant="contained"
                color={uploadStatus === "failed" ? "warning" : "secondary"}
                size="large"
                onClick={uploadFile}
                disabled={!backendUrlReady || !selectedFile || !uploadSession || uploadStatus === "uploading" || uploadStatus === "uploaded"}
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
                  ["Expires", formatTimestamp(uploadSession.expiresAt, "yyyy-MM-dd HH:mm:ss zzz")],
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
          {messages.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>No workflow events yet.</Typography>
          ) : (
            <VirtualList height={240} items={messages} estimateSize={48}>
              {(message, index) => (
                <ListItem key={`${message.text}-${index}`} disableGutters sx={{ py: 0.5 }}>
                  <Chip
                    size="small"
                    label={message.level}
                    color={message.level === "error" ? "error" : message.level === "success" ? "success" : "info"}
                    sx={{ mr: 1.5, minWidth: 72 }}
                  />
                  <ListItemText primary={message.text} />
                </ListItem>
              )}
            </VirtualList>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="h2">Audit Timeline</Typography>
              {auditEvents.length > 0 && (
                <Chip size="small" label={`${auditEvents.length}`} color="primary" variant="outlined" />
              )}
            </Stack>
            <IconButton
              size="small"
              onClick={refreshTraceability}
              disabled={!selectedFile}
              title="Refresh trace"
            >
              <RefreshIcon />
            </IconButton>
          </Stack>
          <Divider />
          {auditEvents.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 1 }}>No persisted audit events loaded.</Typography>
          ) : (
            <VirtualList height={240} items={auditEvents} estimateSize={48} getItemKey={(event) => event.eventId}>
              {(event) => (
                <ListItem disableGutters sx={{ py: 0.5 }}>
                  <Chip
                    size="small"
                    label={event.result}
                    color={event.result === "success" ? "success" : "error"}
                    sx={{ mr: 1.5, minWidth: 72 }}
                  />
                  <ListItemText
                    primary={event.action}
                    secondary={`${formatTimestamp(event.occurredAt)} | ${event.target.kind}: ${event.target.id}`}
                  />
                </ListItem>
              )}
            </VirtualList>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function metadataRows(metadata: DicomMetadataSummary): readonly (readonly [string, string])[] {
  return [
    ["Patient", metadata.patientName ?? "not present"],
    ["Patient ID", metadata.patientId ?? "not present"],
    ["Birth Date", formatDicomDate(metadata.patientBirthDate)],
    ["Modality", metadata.modality ?? "not present"],
    ["Study Date", formatDicomDate(metadata.studyDate)],
    ["Study UID", metadata.studyInstanceUid ?? "not present"],
    ["Series UID", metadata.seriesInstanceUid ?? "not present"],
    ["SOP UID", metadata.sopInstanceUid ?? "not present"],
    ["Image Size", metadata.rows && metadata.columns ? `${metadata.columns} x ${metadata.rows}` : "not present"]
  ];
}

function formatDicomDate(value?: string): string {
  if (!value) {
    return "not present";
  }

  const parsed = parse(value, "yyyyMMdd", new Date());
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : value;
}

function formatTimestamp(value: string, pattern = "yyyy-MM-dd HH:mm:ss"): string {
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, pattern) : value;
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

function RefreshIcon() {
  return (
    <SvgIcon fontSize="small">
      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </SvgIcon>
  );
}

function VirtualList<T>(props: {
  readonly height: number;
  readonly items: readonly T[];
  readonly estimateSize: number;
  readonly getItemKey?: (item: T) => string;
  readonly children: (item: T, index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: props.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => props.estimateSize,
    getItemKey: props.getItemKey ? (index) => props.getItemKey!(props.items[index]) : undefined
  });

  return (
    <Box ref={parentRef} sx={{ height: props.height, overflow: "auto" }}>
      <Box sx={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <Box
            key={virtualItem.key}
            sx={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualItem.start}px)` }}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
          >
            {props.children(props.items[virtualItem.index], virtualItem.index)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}