"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { BASEMAPS, type BasemapId } from "@/lib/map/basemaps";
import { Layers } from "lucide-react";

export function BasemapSwitcher() {
  const basemap = usePlanningStore((s) => s.basemap);
  const setBasemap = usePlanningStore((s) => s.setBasemap);
  const ids = Object.keys(BASEMAPS) as BasemapId[];

  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur overflow-hidden text-xs">
      <span className="flex items-center gap-1 px-2 text-slate-400">
        <Layers className="h-3.5 w-3.5" />
      </span>
      {ids.map((id) => (
        <button
          key={id}
          onClick={() => setBasemap(id)}
          className={`px-3 py-1.5 transition-colors ${
            basemap === id
              ? "bg-cyan-500 text-slate-900 font-semibold"
              : "text-slate-300 hover:bg-white/5"
          }`}
        >
          {BASEMAPS[id].label}
        </button>
      ))}
    </div>
  );
}
