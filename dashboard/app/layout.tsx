import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
