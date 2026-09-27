"use client";

import * as React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

// AppRouterCacheProvider wires Emotion's style-tag insertion into Next's App
// Router streaming so SSR'd class names hydrate without a flash of
// unstyled/mismatched styles. ThemeProvider applies the single light theme
// from theme.ts -- there is no dark mode / toggle, per product decision.
export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
