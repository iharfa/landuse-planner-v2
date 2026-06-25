"use client";

import { useState } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";
import {
  Panel,
  CollapsiblePanel,
  Button,
  LabeledNumber,
  SegmentedControl,
} from "@/components/ui/Controls";
import {
  Hexagon,
  Grid2x2,
  Spline,
  MousePointer2,
  Sparkles,
  RefreshCw,
  Trash2,
  Combine,
  Grid3x3,
  Eraser,
  PenTool,
  Circle,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
} from "lucide-react";
import type { DrawMode, LandUseType, RoadClass } from "@/lib/types";
import {
  LAND_USE_LABELS,
  ROAD_CLASS_DEFAULTS,
  ROAD_CLASS_ORDER,
} from "@/lib/generation/constants";
import { FeatureEditor } from "./FeatureEditor";

function ToolButton({
  mode,
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  mode: DrawMode;
  active: boolean;
  onClick: (m: DrawMode) => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={() => onClick(mode)}
      title={`${label} — ${hint}`}
      aria-label={`${label}: ${hint}`}
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition-colors ${
        active
          ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
          : "border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const PARCEL_USES: LandUseType[] = [
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

/** Land-use picker shown when the Parcel tool is active. */
function ParcelDraftControls() {
  const parcelDraftUse = usePlanningStore((s) => s.parcelDraftUse);
  const setParcelDraftUse = usePlanningStore((s) => s.setParcelDraftUse);
  return (
    <Panel title="Parcel land use">
      <label className="block">
        <div className="text-xs text-slate-300 mb-1">
          New parcels are drawn as
        </div>
        <select
          value={parcelDraftUse}
          onChange={(e) => setParcelDraftUse(e.target.value as LandUseType)}
          className="w-full rounded-md bg-slate-800/80 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          {PARCEL_USES.map((u) => (
            <option key={u} value={u}>
              {LAND_USE_LABELS[u]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-slate-500 leading-snug">
        You can change a parcel’s use anytime — select it and pick a new use.
      </p>
    </Panel>
  );
}

/** Class / lanes / width picker shown when the Road or Curve tool is active. */
function RoadDraftControls() {
  const roadDraft = usePlanningStore((s) => s.roadDraft);
  const setRoadDraft = usePlanningStore((s) => s.setRoadDraft);
  return (
    <Panel title="Road parameters">
      <SegmentedControl<RoadClass>
        label="Road type"
        value={roadDraft.roadClass}
        onChange={(c) => setRoadDraft({ roadClass: c })}
        options={ROAD_CLASS_ORDER.map((c) => ({
          label: ROAD_CLASS_DEFAULTS[c].label.replace(" road", ""),
          value: c,
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <LabeledNumber
          label="Lanes"
          value={roadDraft.lanes}
          min={1}
          max={8}
          step={1}
          onChange={(v) => setRoadDraft({ lanes: v })}
        />
        <LabeledNumber
          label="Width"
          value={roadDraft.widthM}
          min={2}
          max={60}
          step={0.5}
          suffix="m"
          onChange={(v) => setRoadDraft({ widthM: v })}
        />
      </div>
      <p className="text-[10px] text-slate-500 leading-snug">
        Width auto-updates from the type and lanes; override it above. Roads snap
        to the existing network as you draw.
      </p>
    </Panel>
  );
}

export function LeftToolbar() {
  const projectName = usePlanningStore((s) => s.projectName);
  const setProjectName = usePlanningStore((s) => s.setProjectName);
  const drawMode = usePlanningStore((s) => s.drawMode);
  const setDrawMode = usePlanningStore((s) => s.setDrawMode);
  const generate = usePlanningStore((s) => s.generate);
  const regenerate = usePlanningStore((s) => s.regenerateUnlocked);
  const clearGenerated = usePlanningStore((s) => s.clearGenerated);
  const boundary = usePlanningStore((s) => s.boundary);
  const hasGenerated = usePlanningStore((s) => s.features.some((f) => f.generated));
  const selectedId = usePlanningStore((s) => s.selectedId);
  const roadCount = usePlanningStore((s) => s.roads.length);
  const clearRoads = usePlanningStore((s) => s.clearRoads);
  const fillRoadGrid = usePlanningStore((s) => s.fillRoadGrid);

  const [gridSpacing, setGridSpacing] = useState(90);
  const [gridAngle, setGridAngle] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (m: DrawMode) => setDrawMode(drawMode === m ? "none" : m);

  // collapsed: just a compact bar with an expand button
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Expand tools"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md px-3 py-2 text-sm text-slate-200 shadow-lg hover:bg-slate-800/80"
      >
        <PanelLeftOpen className="h-4 w-4 text-cyan-300" /> Tools
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-64">
      {/* single toolbar header with collapse toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-200">
          <Wrench className="h-4 w-4 text-cyan-300" /> Studio tools
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse tools"
          className="text-slate-400 hover:text-cyan-300"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <Panel title="Project">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full rounded-md bg-slate-800/80 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          placeholder="Project name"
        />
      </Panel>

      <Panel title="Drawing tools">
        <div className="grid grid-cols-3 gap-2">
          <ToolButton
            mode="boundary"
            active={drawMode === "boundary"}
            onClick={toggle}
            icon={<Hexagon className="h-4 w-4" />}
            label="Boundary"
            hint="Draw the island's outer planning boundary. Click to add vertices, double-click to finish."
          />
          <ToolButton
            mode="parcel"
            active={drawMode === "parcel"}
            onClick={toggle}
            icon={<Grid2x2 className="h-4 w-4" />}
            label="Parcel"
            hint="Draw a land-use zone inside the boundary with the use chosen below. Edit its use or delete it anytime."
          />
          <ToolButton
            mode="road"
            active={drawMode === "road"}
            onClick={toggle}
            icon={<Spline className="h-4 w-4" />}
            label="Road"
            hint="Sketch a straight-segment road centerline. Snaps to the existing network as you draw."
          />
          <ToolButton
            mode="curve"
            active={drawMode === "curve"}
            onClick={toggle}
            icon={<PenTool className="h-4 w-4" />}
            label="Curve"
            hint="Draw a freehand curved or arched road by clicking and dragging."
          />
          <ToolButton
            mode="ring"
            active={drawMode === "ring"}
            onClick={toggle}
            icon={<Circle className="h-4 w-4" />}
            label="Ring"
            hint="Drag out a circular ring road. Plots fill both inside and outside it."
          />
          <ToolButton
            mode="select"
            active={drawMode === "select"}
            onClick={toggle}
            icon={<MousePointer2 className="h-4 w-4" />}
            label="Select"
            hint="Click any feature, parcel, or road to edit its properties or delete it."
          />
          <ToolButton
            mode="merge"
            active={drawMode === "merge"}
            onClick={toggle}
            icon={<Combine className="h-4 w-4" />}
            label="Merge"
            hint="Select a feature, then click an adjacent one to combine them into a single feature."
          />
        </div>
        {drawMode !== "none" && (
          <p className="text-[11px] text-cyan-300/90 leading-snug">
            {drawMode === "boundary" &&
              "Click to add vertices, double-click to finish the island boundary."}
            {drawMode === "parcel" &&
              "Draw a parcel inside the boundary. It’s created with the land use chosen below; double-click to finish."}
            {drawMode === "road" &&
              "Click to sketch a road centerline. It snaps to nearby roads. Double-click to finish."}
            {drawMode === "curve" &&
              "Click and drag to draw a freehand curved or arched road."}
            {drawMode === "ring" &&
              "Click and drag to draw a circular ring road. Plots fill inside and outside."}
            {drawMode === "select" &&
              "Click any feature, parcel, or road to edit it."}
            {drawMode === "merge" &&
              "Select a feature, then click an adjacent one to merge them."}
          </p>
        )}
      </Panel>

      {/* contextual controls for the active draw tool */}
      {drawMode === "parcel" && <ParcelDraftControls />}
      {(drawMode === "road" || drawMode === "curve" || drawMode === "ring") && (
        <RoadDraftControls />
      )}

      <CollapsiblePanel title="Road network">
        <div className="grid grid-cols-2 gap-2">
          <LabeledNumber
            label="Block spacing"
            value={gridSpacing}
            min={40}
            max={400}
            step={10}
            suffix="m"
            onChange={setGridSpacing}
          />
          <LabeledNumber
            label="Grid angle"
            value={gridAngle}
            min={0}
            max={90}
            step={5}
            suffix="°"
            onChange={setGridAngle}
          />
        </div>
        <Button
          variant="primary"
          onClick={() => fillRoadGrid(gridSpacing, gridAngle)}
          disabled={!boundary}
        >
          <Grid3x3 className="h-4 w-4" /> Fill boundary with grid
        </Button>
        <Button onClick={clearRoads} disabled={roadCount === 0}>
          <Eraser className="h-4 w-4" /> Clear roads ({roadCount})
        </Button>
        <p className="text-[11px] text-slate-500 leading-snug">
          Drawn roads snap to nearby roads so they connect. A grid gives every
          block road frontage on all sides.
        </p>
      </CollapsiblePanel>

      <Panel title="Generate">
        <Button variant="primary" onClick={generate} disabled={!boundary}>
          <Sparkles className="h-4 w-4" /> Generate layout
        </Button>
        <Button onClick={regenerate} disabled={!hasGenerated}>
          <RefreshCw className="h-4 w-4" /> Regenerate unlocked
        </Button>
        <Button variant="danger" onClick={clearGenerated} disabled={!hasGenerated}>
          <Trash2 className="h-4 w-4" /> Clear generated
        </Button>
      </Panel>

      {selectedId && <FeatureEditor />}
    </div>
  );
}
