"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import {
  Panel,
  Button,
  LabeledNumber,
  SegmentedControl,
  formatArea,
} from "@/components/ui/Controls";
import {
  LAND_USE_LABELS,
  ROAD_CLASS_DEFAULTS,
  ROAD_CLASS_ORDER,
} from "@/lib/generation/constants";
import type { LandUseType, RoadClass } from "@/lib/types";
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

function LandUseSelect({
  value,
  onChange,
}: {
  value: LandUseType;
  onChange: (u: LandUseType) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-300 mb-1">Land use</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LandUseType)}
        className="w-full rounded-md bg-slate-800/80 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        {EDITABLE_USES.map((u) => (
          <option key={u} value={u}>
            {LAND_USE_LABELS[u]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Editor for a generated land-use feature. */
function GeneratedFeatureEditor() {
  const feature = usePlanningStore((s) =>
    s.features.find((f) => f.id === s.selectedId),
  );
  const changeLandUse = usePlanningStore((s) => s.changeLandUse);
  const toggleLock = usePlanningStore((s) => s.toggleLock);
  const deleteFeature = usePlanningStore((s) => s.deleteFeature);
  if (!feature) return null;

  return (
    <Panel title="Edit feature">
      <div className="text-[11px] text-slate-400">
        Area:{" "}
        <span className="font-mono text-slate-200">
          {formatArea(feature.areaSqm)}
        </span>
      </div>
      <LandUseSelect
        value={feature.landUse}
        onChange={(u) => changeLandUse(feature.id, u)}
      />
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

/** Editor for a user-drawn parcel (a standalone land-use zone). */
function ParcelEditor() {
  const parcel = usePlanningStore((s) =>
    s.parcels.find((p) => p.id === s.selectedId),
  );
  const changeParcelLandUse = usePlanningStore((s) => s.changeParcelLandUse);
  const deleteParcel = usePlanningStore((s) => s.deleteParcel);
  if (!parcel) return null;

  return (
    <Panel title="Edit parcel">
      <div className="text-[11px] text-slate-400">
        Area:{" "}
        <span className="font-mono text-slate-200">
          {formatArea(parcel.areaSqm)}
        </span>
      </div>
      <LandUseSelect
        value={parcel.landUse ?? "unassigned"}
        onChange={(u) => changeParcelLandUse(parcel.id, u)}
      />
      <Button variant="danger" onClick={() => deleteParcel(parcel.id)}>
        <Trash2 className="h-4 w-4" /> Delete parcel
      </Button>
      <p className="text-[10px] text-slate-500 leading-snug">
        Parcels with a land use are kept as fixed zones — the generator fills
        around them. Leave a parcel “Unassigned” to let the generator subdivide
        it.
      </p>
    </Panel>
  );
}

/** Editor for a user-drawn road (class / lanes / width). */
function RoadEditor() {
  const road = usePlanningStore((s) =>
    s.roads.find((r) => r.id === s.selectedId),
  );
  const setRoadClass = usePlanningStore((s) => s.setRoadClass);
  const setRoadLanes = usePlanningStore((s) => s.setRoadLanes);
  const setRoadWidth = usePlanningStore((s) => s.setRoadWidth);
  const deleteRoad = usePlanningStore((s) => s.deleteRoad);
  if (!road) return null;

  return (
    <Panel title="Edit road">
      <div className="text-[11px] text-slate-400">
        Length:{" "}
        <span className="font-mono text-slate-200">
          {Math.round(road.lengthM)} m
        </span>
      </div>
      <SegmentedControl<RoadClass>
        label="Road type"
        value={road.roadClass}
        onChange={(c) => setRoadClass(road.id, c)}
        options={ROAD_CLASS_ORDER.map((c) => ({
          label: ROAD_CLASS_DEFAULTS[c].label.replace(" road", ""),
          value: c,
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <LabeledNumber
          label="Lanes"
          value={road.lanes}
          min={1}
          max={8}
          step={1}
          onChange={(v) => setRoadLanes(road.id, v)}
        />
        <LabeledNumber
          label="Width"
          value={road.widthM}
          min={2}
          max={60}
          step={0.5}
          suffix="m"
          onChange={(v) => setRoadWidth(road.id, v)}
        />
      </div>
      <Button variant="danger" onClick={() => deleteRoad(road.id)}>
        <Trash2 className="h-4 w-4" /> Delete road
      </Button>
      <p className="text-[10px] text-slate-500 leading-snug">
        Width is set automatically from the type and lane count; edit it to
        override. Vehicle-free roads render dashed.
      </p>
    </Panel>
  );
}

export function FeatureEditor() {
  const kind = usePlanningStore((s) => {
    if (!s.selectedId) return null;
    if (s.features.some((f) => f.id === s.selectedId)) return "feature";
    if (s.parcels.some((p) => p.id === s.selectedId)) return "parcel";
    if (s.roads.some((r) => r.id === s.selectedId)) return "road";
    return null;
  });

  if (kind === "feature") return <GeneratedFeatureEditor />;
  if (kind === "parcel") return <ParcelEditor />;
  if (kind === "road") return <RoadEditor />;
  return null;
}
