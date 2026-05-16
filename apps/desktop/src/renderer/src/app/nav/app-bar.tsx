import AppBar from "@mui/material/AppBar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export function DesktopAppBar() {
  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ justifyContent: "space-between", py: 1 }}>
        <Stack spacing={0.25}>
          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 900 }}>
            DICOM Pipeline
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Local ingestion and secure upload prototype
          </Typography>
        </Stack>

        <Chip label="Desktop Client" color="secondary" variant="outlined" />
      </Toolbar>
    </AppBar>
  );
}
