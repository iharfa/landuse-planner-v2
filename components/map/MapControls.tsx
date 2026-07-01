"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { BasemapSwitcher } from "./BasemapSwitcher";
import { LayerLegend } from "./LayerLegend";

export function MapControls({ coords }: { coords: [number, number] }) {
  const leftOpen = usePlanningStore((s) => s.leftPanelOpen);
  return (
    <>
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-3">
        <BasemapSwitcher />
      </div>
      <div
        className={`absolute bottom-4 z-10 flex flex-col gap-2 transition-[left] duration-300 ${
          leftOpen ? "left-[312px]" : "left-4"
        }`}
      >
        <LayerLegend />
        <div className="rounded-md bg-slate-900/80 backdrop-blur px-3 py-1.5 text-[11px] font-mono text-slate-300 border border-white/10">
          {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
        </div>
      </div>
    </>
  );
}
