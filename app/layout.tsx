import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://landuse-planner-v2.vercel.app";

const DESCRIPTION =
  "A futuristic, browser-based urban planning studio for Maldives-style islands. Draw a boundary, sketch roads and parcels, then generate a complete rule-based land-use layout — residential, commercial, schools, mosques, green space and sports. No backend, no API keys.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Island Layout Studio — browser-based island planning",
    template: "%s — Island Layout Studio",
  },
  description: DESCRIPTION,
  applicationName: "Island Layout Studio",
  keywords: [
    "urban planning",
    "land-use planning",
    "island planning",
    "Maldives",
    "site layout",
    "zoning",
    "master plan",
    "MapLibre",
  ],
  authors: [{ name: "iHarfa" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Island Layout Studio",
    title: "Island Layout Studio — browser-based island planning",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Island Layout Studio — browser-based island planning",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
