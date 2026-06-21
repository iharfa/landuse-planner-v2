"use client";

import { useState } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";
import {
  LAND_USE_COLORS,
  LAND_USE_LABELS,
  LEGEND_ORDER,
} from "@/lib/generation/constants";
import { ChevronDown, ChevronUp } from "lucide-react";

export function LayerLegend() {
  const layerVisible = usePlanningStore((s) => s.layerVisible);
  const toggleLayer = usePlanningStore((s) => s.toggleLayer);
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur p-2 text-[11px] w-40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-1 pb-1 font-semibold uppercase tracking-wide text-slate-400"
      >
        <span>Legend</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
      <div className={`space-y-0.5 ${open ? "" : "hidden"}`}>
        {LEGEND_ORDER.map((use) => (
          <button
            key={use}
            onClick={() => toggleLayer(use)}
            className={`flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5 ${
              layerVisible[use] ? "text-slate-200" : "text-slate-500 line-through"
            }`}
          >
            <span
              className="h-3 w-3 rounded-sm border border-white/20"
              style={{ backgroundColor: LAND_USE_COLORS[use] }}
            />
            {LAND_USE_LABELS[use]}
          </button>
        ))}
      </div>
    </div>
  );
}
