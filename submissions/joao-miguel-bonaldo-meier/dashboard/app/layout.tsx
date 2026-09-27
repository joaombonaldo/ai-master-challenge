import type { Metadata } from "next";
import localFont from "next/font/local";
import ThemeRegistry from "./ThemeRegistry";
import "./globals.css";

// Self-hosted woff2 files (app/fonts/) instead of next/font/google.
// next/font/google fetches font metadata/files from Google at BUILD TIME;
// on Vercel's build network this call can fail/timeout and crashes webpack
// with an opaque "Cannot read properties of null (reading '1')" error.
// Self-hosting via next/font/local removes that live-network dependency
// entirely while keeping the same zero-layout-shift behavior, the same
// family/weights/styles, and the same --font-serif/--font-sans variable
// names, so no other component needs to change.
// Files downloaded once from the static (not API) fonts.gstatic.com host,
// latin subset only, exactly the weights/styles previously requested:
// Fraunces 500/600 normal+italic, Inter 400/500/600/700 normal.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/fraunces-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard de Engajamento em Redes Sociais",
  description:
    "Dashboard de engajamento filtrável sobre dados de posts pré-agregados (plataforma x categoria x tier de criador x patrocínio x mês).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
