import AppBar from "@mui/material/AppBar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export function DesktopAppBar() {
  return (
    <AppBar position="sticky" elevation={0} >
      <Toolbar variant="dense" sx={{ justifyContent: "space-between", py: 1 }}>
        <Stack spacing={0.25}>
          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 900 }}>
            DICOM Pipeline
          </Typography>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
