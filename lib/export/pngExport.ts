import html2canvas from "html2canvas";

/** Export a DOM element (the map area) to a downloaded PNG. */
export async function exportElementToPng(
  element: HTMLElement,
  projectName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#0b1220",
    logging: false,
    scale: window.devicePixelRatio || 1,
  });

  const date = new Date().toISOString().slice(0, 10);
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scenario";
  const filename = `island-layout-studio-${slug}-${date}.png`;

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
