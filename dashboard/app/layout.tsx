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

// Runs before hydration (blocking, tiny, no external request) so a returning
// visitor's saved theme applies with zero flash of the wrong theme. Default
// is light -- we only ever need to *add* data-theme="dark"; light is the
// baseline defined directly on :root in globals.css.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('dashboard-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
