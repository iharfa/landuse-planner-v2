"use client";

import { useState } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";
import { Panel, Button, LabeledNumber } from "@/components/ui/Controls";
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
} from "lucide-react";
import type { DrawMode } from "@/lib/types";
import { FeatureEditor } from "./FeatureEditor";

function ToolButton({
  mode,
  active,
  onClick,
  icon,
  label,
}: {
  mode: DrawMode;
  active: boolean;
  onClick: (m: DrawMode) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={() => onClick(mode)}
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

  const toggle = (m: DrawMode) => setDrawMode(drawMode === m ? "none" : m);

  return (
    <div className="flex flex-col gap-3 w-64">
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
          />
          <ToolButton
            mode="parcel"
            active={drawMode === "parcel"}
            onClick={toggle}
            icon={<Grid2x2 className="h-4 w-4" />}
            label="Parcel"
          />
          <ToolButton
            mode="road"
            active={drawMode === "road"}
            onClick={toggle}
            icon={<Spline className="h-4 w-4" />}
            label="Road"
          />
          <ToolButton
            mode="curve"
            active={drawMode === "curve"}
            onClick={toggle}
            icon={<PenTool className="h-4 w-4" />}
            label="Curve"
          />
          <ToolButton
            mode="ring"
            active={drawMode === "ring"}
            onClick={toggle}
            icon={<Circle className="h-4 w-4" />}
            label="Ring"
          />
          <ToolButton
            mode="select"
            active={drawMode === "select"}
            onClick={toggle}
            icon={<MousePointer2 className="h-4 w-4" />}
            label="Select"
          />
          <ToolButton
            mode="merge"
            active={drawMode === "merge"}
            onClick={toggle}
            icon={<Combine className="h-4 w-4" />}
            label="Merge"
          />
        </div>
        {drawMode !== "none" && (
          <p className="text-[11px] text-cyan-300/90 leading-snug">
            {drawMode === "boundary" &&
              "Click to add vertices, double-click to finish the island boundary."}
            {drawMode === "parcel" &&
              "Draw an internal parcel inside the boundary. Double-click to finish."}
            {drawMode === "road" &&
              "Click to sketch a road centerline. Double-click to finish."}
            {drawMode === "curve" &&
              "Click and drag to draw a freehand curved or arched road."}
            {drawMode === "ring" &&
              "Click and drag to draw a circular ring road. Plots fill inside and outside."}
            {drawMode === "select" && "Click any generated feature to edit it."}
            {drawMode === "merge" &&
              "Select a feature, then click an adjacent one to merge them."}
          </p>
        )}
      </Panel>

      <Panel title="Road network">
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
      </Panel>

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
