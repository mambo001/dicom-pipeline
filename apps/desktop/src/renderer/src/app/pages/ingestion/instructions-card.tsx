import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export function InstructionsCard() {
  return (
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
  );
}