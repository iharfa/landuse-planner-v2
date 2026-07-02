import { renderOgImage } from "@/lib/og";

export const runtime = "edge";
export const alt =
  "Island Layout Studio — a browser-based urban island planning studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage();
}
