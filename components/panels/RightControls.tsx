"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import {
  Panel,
  LabeledSlider,
  LabeledNumber,
  Toggle,
  SegmentedControl,
} from "@/components/ui/Controls";
import { ScenarioPanel } from "./ScenarioPanel";
import { ExportPanel } from "@/components/tools/ExportPanel";
import { SlidersHorizontal, Users, Building2, Eye, EyeOff } from "lucide-react";
import type { DensityLevel, WalkabilityTarget, LandUseType } from "@/lib/types";
import { LAND_USE_COLORS, LAND_USE_LABELS } from "@/lib/generation/constants";

export function RightControls() {
  const controls = usePlanningStore((s) => s.controls);
  const setControls = usePlanningStore((s) => s.setControls);
  const autoGenerate = usePlanningStore((s) => s.autoGenerate);
  const setAutoGenerate = usePlanningStore((s) => s.setAutoGenerate);

  return (
    <div className="flex flex-col gap-3 w-72">
      <Panel title="Planning controls" icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
        <Toggle
          label="Auto-generate on change"
          checked={autoGenerate}
          onChange={setAutoGenerate}
        />
        <Toggle
          label="Optimize compatibility"
          checked={controls.optimizeCompatibility}
          onChange={(v) => setControls({ optimizeCompatibility: v })}
        />
        <div className="h-px bg-white/10" />
        <LabeledSlider
          label="Residential"
          value={controls.residentialPct}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setControls({ residentialPct: v })}
        />
        <LabeledSlider
          label="Commercial"
          value={controls.commercialPct}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setControls({ commercialPct: v })}
        />
        <LabeledSlider
          label="Industrial"
          value={controls.industrialPct}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setControls({ industrialPct: v })}
        />
        <LabeledSlider
          label="Green space"
          value={controls.greenPct}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setControls({ greenPct: v })}
        />
        <LabeledSlider
          label="Green verge width"
          value={controls.greenBufferWidthM}
          min={0}
          max={8}
          step={0.5}
          suffix="m"
          onChange={(v) => setControls({ greenBufferWidthM: v })}
        />
        <LabeledNumber
          label="Min. park size"
          value={controls.minParkAreaSqm}
          min={0}
          max={50000}
          step={250}
          suffix="m²"
          onChange={(v) => setControls({ minParkAreaSqm: v })}
        />
        <div className="h-px bg-white/10 my-1" />
        <LabeledSlider
          label="Residential plot size"
          value={controls.residentialPlotSqft}
          min={1200}
          max={3000}
          step={50}
          suffix=" sqft"
          onChange={(v) => setControls({ residentialPlotSqft: v })}
        />
        <LabeledSlider
          label="Commercial plot size"
          value={controls.commercialPlotSqft}
          min={3000}
          max={20000}
          step={250}
          suffix=" sqft"
          onChange={(v) => setControls({ commercialPlotSqft: v })}
        />
        <LabeledNumber
          label="Min. residential plots"
          value={controls.minResidentialPlots}
          min={0}
          max={5000}
          step={10}
          onChange={(v) => setControls({ minResidentialPlots: v })}
        />
        <LabeledNumber
          label="Road width"
          value={controls.roadWidthM}
          min={4}
          max={40}
          step={1}
          suffix="m"
          onChange={(v) => setControls({ roadWidthM: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <LabeledNumber
            label="Front setback"
            value={controls.frontSetbackM}
            min={0}
            max={15}
            step={0.5}
            suffix="m"
            onChange={(v) => setControls({ frontSetbackM: v })}
          />
          <LabeledNumber
            label="Side setback"
            value={controls.sideSetbackM}
            min={0}
            max={10}
            step={0.5}
            suffix="m"
            onChange={(v) => setControls({ sideSetbackM: v })}
          />
        </div>
        <LabeledSlider
          label="Overlay opacity"
          value={Math.round(controls.overlayOpacity * 100)}
          min={10}
          max={90}
          step={5}
          suffix="%"
          onChange={(v) => setControls({ overlayOpacity: v / 100 })}
        />
        <SegmentedControl<DensityLevel>
          label="Density"
          value={controls.density}
          options={[
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ]}
          onChange={(v) => setControls({ density: v })}
        />
        <SegmentedControl<WalkabilityTarget>
          label="Walkability target"
          value={controls.walkability}
          options={[
            { label: "250 m", value: 250 },
            { label: "400 m", value: 400 },
            { label: "600 m", value: 600 },
          ]}
          onChange={(v) => setControls({ walkability: v })}
        />
      </Panel>

      <Panel title="Population rules" icon={<Users className="h-3.5 w-3.5" />}>
        <LabeledNumber
          label="Population served"
          value={controls.population}
          min={0}
          step={250}
          onChange={(v) => setControls({ population: v })}
        />
        <Toggle
          label="Provide schools"
          checked={controls.schools}
          onChange={(v) => setControls({ schools: v })}
        />
        <Toggle
          label="Provide mosques"
          checked={controls.mosques}
          onChange={(v) => setControls({ mosques: v })}
        />
        <Toggle
          label="Provide utilities"
          checked={controls.utilities}
          onChange={(v) => setControls({ utilities: v })}
        />
        <Toggle
          label="Provide recreation"
          checked={controls.recreation}
          onChange={(v) => setControls({ recreation: v })}
        />
        <p className="text-[10px] text-slate-500 leading-snug">
          1 mosque / 1,500 · 1 school / 3,000 · 1 recreation / 2,000 residents.
          Utilities reserve 2–5% of site by density.
        </p>
      </Panel>

      <LayerToggles />
      <ScenarioPanel />
      <ExportPanel />
    </div>
  );
}

function LayerToggles() {
  const layerVisible = usePlanningStore((s) => s.layerVisible);
  const toggleLayer = usePlanningStore((s) => s.toggleLayer);
  const uses = (Object.keys(layerVisible) as LandUseType[]).filter(
    (u) => u !== "locked",
  );
  return (
    <Panel title="Layers" icon={<Building2 className="h-3.5 w-3.5" />}>
      <div className="grid grid-cols-2 gap-1.5">
        {uses.map((u) => {
          const on = layerVisible[u];
          return (
            <button
              key={u}
              type="button"
              onClick={() => toggleLayer(u)}
              title={`${on ? "Hide" : "Show"} ${LAND_USE_LABELS[u]}`}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] transition-colors ${
                on
                  ? "border-white/10 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70"
                  : "border-white/5 bg-slate-900/40 text-slate-500 hover:bg-slate-800/40"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: LAND_USE_COLORS[u],
                  opacity: on ? 1 : 0.35,
                }}
              />
              <span className="flex-1 truncate">{LAND_USE_LABELS[u]}</span>
              {on ? (
                <Eye className="h-3 w-3 shrink-0 text-cyan-300" />
              ) : (
                <EyeOff className="h-3 w-3 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
