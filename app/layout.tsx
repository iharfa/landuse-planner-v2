import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Island Layout Studio",
  description:
    "A futuristic browser-based urban island planning studio for Maldives-style land-use planning.",
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
