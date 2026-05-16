import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { useIngestionStore } from "./use-ingestion-store";

export function ActionCard() {
  const backendUrl = useIngestionStore((s) => s.backendUrl);
  const backendUrlReady = useIngestionStore((s) => s.backendUrlReady);
  const backendUrlError = useIngestionStore((s) => s.backendUrlError);
  const knownUrls = useIngestionStore((s) => s.knownUrls);
  const selectedFile = useIngestionStore((s) => s.selectedFile);
  const uploadSession = useIngestionStore((s) => s.uploadSession);
  const uploadStatus = useIngestionStore((s) => s.uploadStatus);
  const setBackendUrl = useIngestionStore((s) => s.setBackendUrl);
  const persistBackendUrl = useIngestionStore((s) => s.persistBackendUrl);
  const selectFile = useIngestionStore((s) => s.selectFile);
  const requestUploadSession = useIngestionStore((s) => s.requestUploadSession);
  const uploadFile = useIngestionStore((s) => s.uploadFile);

  return (
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
  );
}