"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { formatArea } from "@/components/ui/Controls";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function SummaryPanel() {
  const summary = usePlanningStore((s) => s.summary);
  const boundary = usePlanningStore((s) => s.boundary);
  const [open, setOpen] = useState(true);

  if (!summary && !boundary) return null;

  const cards: { label: string; value: string }[] = summary
    ? [
        { label: "Boundary area", value: formatArea(summary.boundaryAreaSqm) },
        { label: "Buildable area", value: formatArea(summary.buildableAreaSqm) },
        { label: "Road area", value: formatArea(summary.roadAreaSqm) },
        { label: "Residential", value: formatArea(summary.residentialAreaSqm) },
        { label: "Commercial", value: formatArea(summary.commercialAreaSqm) },
        { label: "Industrial", value: formatArea(summary.industrialAreaSqm) },
        { label: "Green space", value: formatArea(summary.greenAreaSqm) },
        { label: "Recreation", value: formatArea(summary.recreationAreaSqm) },
        { label: "Residential plots", value: String(summary.residentialPlots) },
        { label: "Commercial plots", value: String(summary.commercialPlots) },
        { label: "Est. population", value: summary.estimatedPopulation.toLocaleString() },
        { label: "Schools", value: String(summary.schools) },
        { label: "Mosques", value: String(summary.mosques) },
        { label: "Compatibility", value: `${summary.compatibilityPct}%` },
        { label: "Diversity", value: String(summary.diversityScore) },
        { label: "Violations", value: String(summary.violations) },
      ]
    : [
        {
          label: "Boundary area",
          value: boundary ? formatArea(boundary.areaSqm) : "—",
        },
      ];

  const warnings = summary?.warnings ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/75 backdrop-blur-md shadow-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300"
      >
        <span>Scenario summary</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cards.map((c) => (
              <div
                key={c.label}
                className="min-w-[110px] rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  {c.label}
                </div>
                <div className="text-sm font-semibold text-slate-100 font-mono">
                  {c.value}
                </div>
              </div>
            ))}
          </div>
          {warnings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {warnings.map((w) => (
                <span
                  key={w.id}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
                    w.severity === "error"
                      ? "bg-red-500/20 text-red-200"
                      : w.severity === "warning"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-slate-600/30 text-slate-300"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {w.message}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
