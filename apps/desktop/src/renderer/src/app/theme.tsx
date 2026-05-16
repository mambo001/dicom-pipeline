import { alpha, createTheme } from "@mui/material/styles";

const ink = "#022B3A";
const teal = "#1F7A8C";
const ice = "#BFDBF7";
const mist = "#E1E5F2";
const white = "#FFFFFF";

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: ink,
      light: teal
    },
    secondary: {
      main: teal
    },
    info: {
      main: ice
    },
    success: {
      main: "#247A4D"
    },
    warning: {
      main: "#B7791F"
    },
    error: {
      main: "#B42318"
    },
    background: {
      default: mist,
      paper: white
    },
    text: {
      primary: ink,
      secondary: alpha(ink, 0.72)
    },
    divider: alpha(ink, 0.12)
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: "clamp(2rem, 5vw, 3.6rem)",
      fontWeight: 800,
      letterSpacing: "-0.055em",
      lineHeight: 0.96
    },
    h2: {
      fontSize: "1.2rem",
      fontWeight: 800
    },
    h3: {
      fontSize: "1rem",
      fontWeight: 800
    },
    overline: {
      fontWeight: 800,
      letterSpacing: "0.16em"
    },
    button: {
      fontWeight: 800,
      textTransform: "none"
    }
  },
  shape: {
    borderRadius: 16
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: mist
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: white,
          color: ink,
          boxShadow: "none",
          borderBottom: `1px solid ${alpha(ink, 0.1)}`
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${alpha(ink, 0.1)}`,
          boxShadow: `0 12px 32px ${alpha(ink, 0.08)}`
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: white
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 800
        }
      }
    }
  }
});
