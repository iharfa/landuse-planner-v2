"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { Panel, Button, formatArea } from "@/components/ui/Controls";
import { LAND_USE_LABELS } from "@/lib/generation/constants";
import type { LandUseType } from "@/lib/types";
import { Lock, Unlock, Trash2, Scissors } from "lucide-react";

const EDITABLE_USES: LandUseType[] = [
  "residential",
  "commercial",
  "industrial",
  "school",
  "mosque",
  "utility",
  "recreation",
  "green",
  "unassigned",
];

export function FeatureEditor() {
  const selectedId = usePlanningStore((s) => s.selectedId);
  const feature = usePlanningStore((s) =>
    s.features.find((f) => f.id === s.selectedId),
  );
  const changeLandUse = usePlanningStore((s) => s.changeLandUse);
  const toggleLock = usePlanningStore((s) => s.toggleLock);
  const deleteFeature = usePlanningStore((s) => s.deleteFeature);

  if (!selectedId || !feature) return null;

  return (
    <Panel title="Edit feature">
      <div className="text-[11px] text-slate-400">
        Area: <span className="font-mono text-slate-200">{formatArea(feature.areaSqm)}</span>
      </div>
      <label className="block">
        <div className="text-xs text-slate-300 mb-1">Land use</div>
        <select
          value={feature.landUse}
          onChange={(e) => changeLandUse(feature.id, e.target.value as LandUseType)}
          className="w-full rounded-md bg-slate-800/80 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          {EDITABLE_USES.map((u) => (
            <option key={u} value={u}>
              {LAND_USE_LABELS[u]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => toggleLock(feature.id)}>
          {feature.locked ? (
            <>
              <Unlock className="h-4 w-4" /> Unlock
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Lock
            </>
          )}
        </Button>
        <Button variant="danger" onClick={() => deleteFeature(feature.id)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      <Button
        disabled
        title="Coming in next version"
        variant="ghost"
        className="opacity-50"
      >
        <Scissors className="h-4 w-4" /> Split (beta)
      </Button>
      <p className="text-[10px] text-slate-500 leading-snug">
        Merge: pick the Merge tool, select this feature, then click an adjacent
        feature. Split is reserved for the next version.
      </p>
    </Panel>
  );
}
