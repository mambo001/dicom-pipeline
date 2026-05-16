import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { DesktopAppBar } from "./nav";
import { IngestionWorkspace } from "./pages";
import { appTheme } from "./theme";

export function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100svh", bgcolor: "background.default" }}>
        <DesktopAppBar />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <IngestionWorkspace />
        </Container>
      </Box>
    </ThemeProvider>
  );
}
