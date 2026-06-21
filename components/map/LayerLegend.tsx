"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import {
  LAND_USE_COLORS,
  LAND_USE_LABELS,
  LEGEND_ORDER,
} from "@/lib/generation/constants";

export function LayerLegend() {
  const layerVisible = usePlanningStore((s) => s.layerVisible);
  const toggleLayer = usePlanningStore((s) => s.toggleLayer);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur p-2 text-[11px] w-40">
      <div className="px-1 pb-1 font-semibold uppercase tracking-wide text-slate-400">
        Legend
      </div>
      <div className="space-y-0.5">
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
