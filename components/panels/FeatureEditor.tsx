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
  getSubtypes,
  defaultPlotParams,
} from "@/lib/generation/constants";
import type { LandUseType, RoadClass, ParcelSizing } from "@/lib/types";
import { Lock, Unlock, Trash2, Scissors, Grid3x3, Eraser } from "lucide-react";

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
  const plotCount = usePlanningStore(
    (s) =>
      s.features.filter(
        (f) => f.parcelId === s.selectedId && f.landUse !== "road",
      ).length,
  );
  const changeParcelLandUse = usePlanningStore((s) => s.changeParcelLandUse);
  const deleteParcel = usePlanningStore((s) => s.deleteParcel);
  if (!parcel) return null;

  return (
    <>
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
          around them. Leave a parcel “Unassigned” to let the generator
          subdivide it.
        </p>
      </Panel>
      <ParcelSubdivision parcelId={parcel.id} plotCount={plotCount} />
    </>
  );
}

/** Subtype + plot-sizing controls and the Subdivide action for a parcel. */
function ParcelSubdivision({
  parcelId,
  plotCount,
}: {
  parcelId: string;
  plotCount: number;
}) {
  const parcel = usePlanningStore((s) =>
    s.parcels.find((p) => p.id === parcelId),
  );
  const setParcelSubtype = usePlanningStore((s) => s.setParcelSubtype);
  const setParcelPlotParams = usePlanningStore((s) => s.setParcelPlotParams);
  const subdivideParcel = usePlanningStore((s) => s.subdivideParcel);
  const clearParcelPlots = usePlanningStore((s) => s.clearParcelPlots);

  if (!parcel) return null;
  const use = parcel.landUse;
  const subtypes = getSubtypes(use);
  if (subtypes.length === 0) return null; // use not subdividable

  const params = parcel.plotParams ?? defaultPlotParams(use)!;
  const derivedArea =
    params.sizing === "dimensions"
      ? params.widthM * params.depthM
      : params.areaSqm;

  return (
    <Panel title="Subdivide into plots">
      <label className="block">
        <div className="text-xs text-slate-300 mb-1">Plot type</div>
        <select
          value={params.subtypeId}
          onChange={(e) => setParcelSubtype(parcel.id, e.target.value)}
          className="w-full rounded-md bg-slate-800/80 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          {subtypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
      </label>

      <SegmentedControl<ParcelSizing>
        label="Size by"
        value={params.sizing}
        onChange={(v) => setParcelPlotParams(parcel.id, { sizing: v })}
        options={[
          { label: "Width × Depth", value: "dimensions" },
          { label: "Area", value: "area" },
        ]}
      />

      {params.sizing === "dimensions" ? (
        <div className="grid grid-cols-2 gap-2">
          <LabeledNumber
            label="Width"
            value={params.widthM}
            min={2}
            max={200}
            step={0.5}
            suffix="m"
            onChange={(v) => setParcelPlotParams(parcel.id, { widthM: v })}
          />
          <LabeledNumber
            label="Depth"
            value={params.depthM}
            min={2}
            max={200}
            step={0.5}
            suffix="m"
            onChange={(v) => setParcelPlotParams(parcel.id, { depthM: v })}
          />
        </div>
      ) : (
        <LabeledNumber
          label="Target plot area"
          value={params.areaSqm}
          min={20}
          max={50000}
          step={10}
          suffix="m²"
          onChange={(v) => setParcelPlotParams(parcel.id, { areaSqm: v })}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <LabeledNumber
          label="Plot setback"
          value={params.setbackM}
          min={0}
          max={20}
          step={0.5}
          suffix="m"
          onChange={(v) => setParcelPlotParams(parcel.id, { setbackM: v })}
        />
        <LabeledNumber
          label="Lateral gap"
          value={params.gapM}
          min={0}
          max={20}
          step={0.5}
          suffix="m"
          onChange={(v) => setParcelPlotParams(parcel.id, { gapM: v })}
        />
      </div>
      <LabeledNumber
        label="Access road width (between rows)"
        value={params.roadWidthM}
        min={0}
        max={30}
        step={0.5}
        suffix="m"
        onChange={(v) => setParcelPlotParams(parcel.id, { roadWidthM: v })}
      />

      <div className="text-[11px] text-slate-400">
        ≈{" "}
        <span className="font-mono text-slate-200">
          {formatArea(derivedArea)}
        </span>{" "}
        per plot
        {plotCount > 0 && (
          <>
            {" · "}
            <span className="font-mono text-cyan-300">{plotCount}</span> plots
          </>
        )}
      </div>

      <Button variant="primary" onClick={() => subdivideParcel(parcel.id)}>
        <Grid3x3 className="h-4 w-4" />{" "}
        {plotCount > 0 ? "Re-subdivide" : "Subdivide"}
      </Button>
      {plotCount > 0 && (
        <Button onClick={() => clearParcelPlots(parcel.id)}>
          <Eraser className="h-4 w-4" /> Clear plots
        </Button>
      )}
      <p className="text-[10px] text-slate-500 leading-snug">
        Rows are separated by walkable access roads; each plot is inset by its
        setback. Only full-size plots are kept, so edge slivers are dropped.
        Plots and roads are individual features — select one to change its use
        or delete it.
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
