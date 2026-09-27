import { createTheme } from "@mui/material/styles";

// ---------------------------------------------------------------------
// MUI theme, light mode only (no dark mode / toggle -- product decision).
// Design tokens below are carried over 1:1 from the previous "editorial
// gold" system: same hex values, same reserved-accent discipline (gold
// used sparingly: headline KPI, active states), same Fraunces/Inter
// pairing (loaded via next/font in layout.tsx, referenced here through the
// CSS custom properties next/font already writes on <html>, so no font
// config is duplicated).
// ---------------------------------------------------------------------

declare module "@mui/material/styles" {
  interface Palette {
    custom: {
      goldSoft: string;
      goldBorder: string;
      goldStrong: string;
      goldContrast: string;
      seriesA: string;
      seriesB: string;
      surfaceMuted: string;
      borderStrong: string;
      negative: string;
    };
  }
  interface PaletteOptions {
    custom?: Palette["custom"];
  }
}

const fontSans =
  'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const fontSerif = 'var(--font-serif), Georgia, "Times New Roman", serif';

const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#f6f5f1", paper: "#ffffff" },
    text: { primary: "#17171a", secondary: "#5c5c64", disabled: "#86868d" },
    divider: "rgba(17, 17, 20, 0.09)",
    primary: { main: "#a97e2e", dark: "#8a6522", contrastText: "#ffffff" },
    custom: {
      goldSoft: "rgba(169, 126, 46, 0.1)",
      goldBorder: "rgba(169, 126, 46, 0.35)",
      goldStrong: "#8a6522",
      goldContrast: "#ffffff",
      seriesA: "#6b6c76",
      seriesB: "#b7b8c0",
      surfaceMuted: "#f1f0eb",
      borderStrong: "rgba(17, 17, 20, 0.16)",
      negative: "#b0524a",
    },
  },
  shape: { borderRadius: 10 },
  spacing: 4,
  typography: {
    fontFamily: fontSans,
    h1: { fontFamily: fontSerif, fontWeight: 600, fontSize: "2rem", letterSpacing: "-0.01em" },
    h2: { fontFamily: fontSerif, fontWeight: 600, fontSize: "1.15rem" },
    h3: { fontFamily: fontSerif, fontWeight: 600, fontSize: "0.98rem" },
    subtitle1: { fontSize: "0.88rem", lineHeight: 1.6 },
    subtitle2: { fontSize: "0.8rem" },
    body2: { fontSize: "0.85rem", lineHeight: 1.6 },
    button: { textTransform: "none", fontWeight: 500 },
    overline: { letterSpacing: "0.06em" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontFamily: fontSans },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: fontSans, fontWeight: 500 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontFamily: fontSans },
      },
    },
  },
});

export default theme;
