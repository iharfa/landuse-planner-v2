"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { Panel, Button } from "@/components/ui/Controls";
import { exportElementToPng } from "@/lib/export/pngExport";
import { Image, Download, Lock } from "lucide-react";

const DISABLED_EXPORTS = ["GeoJSON", "CSV", "DXF", "PDF", "Shapefile", "Excel"];

export function ExportPanel() {
  const projectName = usePlanningStore((s) => s.projectName);
  const pushToast = usePlanningStore((s) => s.pushToast);

  async function exportPng() {
    const el = document.getElementById("map-capture-target");
    if (!el) {
      pushToast("Map not ready for export.", "error");
      return;
    }
    try {
      await exportElementToPng(el, projectName);
      pushToast("PNG exported.", "success");
    } catch {
      pushToast("PNG export failed.", "error");
    }
  }

  return (
    <Panel title="Export" icon={<Download className="h-3.5 w-3.5" />}>
      <Button variant="primary" onClick={exportPng}>
        <Image className="h-4 w-4" /> Export PNG
      </Button>
      <div className="grid grid-cols-2 gap-2">
        {DISABLED_EXPORTS.map((label) => (
          <Button
            key={label}
            disabled
            title="Coming in next version"
            variant="ghost"
            className="opacity-50"
          >
            <Lock className="h-3 w-3" /> {label}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
