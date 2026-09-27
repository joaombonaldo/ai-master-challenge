import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import ThemeRegistry from "./ThemeRegistry";
import "./globals.css";

// Self-hosted at build time by next/font (no runtime request, no extra npm
// dependency). Fraunces: editorial serif for headings/big numbers -- the
// "engraving/authority" register. Inter: clean sans for body/data/labels.
// Only the weights actually used are loaded to keep the bundle light.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
