import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

export function HeaderCard() {
  return (
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
  );
}