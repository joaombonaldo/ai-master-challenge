import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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
  title: "Social Media Engagement Dashboard",
  description:
    "Filterable engagement dashboard over pre-aggregated post data (platform x category x creator tier x sponsorship x month).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
