"use client";

import { BasemapSwitcher } from "./BasemapSwitcher";
import { LayerLegend } from "./LayerLegend";

export function MapControls({ coords }: { coords: [number, number] }) {
  return (
    <>
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-3">
        <BasemapSwitcher />
      </div>
      <div className="absolute bottom-28 right-4 z-10">
        <LayerLegend />
      </div>
      <div className="absolute bottom-4 left-4 z-10 rounded-md bg-slate-900/80 backdrop-blur px-3 py-1.5 text-[11px] font-mono text-slate-300 border border-white/10 pointer-events-none">
        {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
      </div>
    </>
  );
}
