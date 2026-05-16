import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useIngestionStore } from "./use-ingestion-store";
import { InfoCard, Details } from "./shared/info-card";
import { formatTimestamp } from "./shared/format-helpers";

export function SelectedFileCard() {
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const correlationId = useIngestionStore((s) => s.correlationId);

  return (
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
  );
}

export function UploadSessionCard() {
  const uploadSession = useIngestionStore((s) => s.uploadSession);
  const storageRecord = useIngestionStore((s) => s.storageRecord);
  const uploadStatus = useIngestionStore((s) => s.uploadStatus);
  const uploadProgress = useIngestionStore((s) => s.uploadProgress);

  return (
    <InfoCard title="Upload Session" emptyText="Request a session after selecting a file.">
      {uploadSession && (
        <>
          <Details
            rows={[
              ["Session ID", uploadSession.uploadSessionId],
              ["Object", uploadSession.objectName],
              ["Expires", formatTimestamp(uploadSession.expiresAt, "yyyy-MM-dd HH:mm:ss zzz")],
              ["UI Status", uploadStatus],
              ["Stored Status", storageRecord?.status ?? "not loaded"]
            ]}
          />
          {uploadStatus !== "idle" && (
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
        </>
      )}
    </InfoCard>
  );
}