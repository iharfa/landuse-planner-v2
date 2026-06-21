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
import { SlidersHorizontal, Users, Building2 } from "lucide-react";
import type { DensityLevel, WalkabilityTarget } from "@/lib/types";

export function RightControls() {
  const controls = usePlanningStore((s) => s.controls);
  const setControls = usePlanningStore((s) => s.setControls);

  return (
    <div className="flex flex-col gap-3 w-72">
      <Panel title="Planning controls" icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
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
        <div className="h-px bg-white/10 my-1" />
        <LabeledSlider
          label="Residential plot size"
          value={controls.residentialPlotSqm}
          min={100}
          max={1500}
          step={50}
          suffix=" m²"
          onChange={(v) => setControls({ residentialPlotSqm: v })}
        />
        <LabeledSlider
          label="Commercial plot size"
          value={controls.commercialPlotSqm}
          min={300}
          max={3000}
          step={100}
          suffix=" m²"
          onChange={(v) => setControls({ commercialPlotSqm: v })}
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
  const uses = Object.keys(layerVisible) as (keyof typeof layerVisible)[];
  return (
    <Panel title="Layers" icon={<Building2 className="h-3.5 w-3.5" />}>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {uses
          .filter((u) => u !== "locked")
          .map((u) => (
            <Toggle
              key={u}
              label={u.charAt(0).toUpperCase() + u.slice(1)}
              checked={layerVisible[u]}
              onChange={() => toggleLayer(u)}
            />
          ))}
      </div>
    </Panel>
  );
}
