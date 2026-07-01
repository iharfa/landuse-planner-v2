"use client";

import { useState } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";
import { X, Compass, MessageCircle } from "lucide-react";

const STEPS = [
  "Draw island boundary",
  "Draw internal parcels",
  "Draw main roads and branches",
  "Adjust planning controls",
  "Generate layout",
  "Edit, save, export PNG",
];

export function WelcomePanel() {
  const boundary = usePlanningStore((s) => s.boundary);
  const setDrawMode = usePlanningStore((s) => s.setDrawMode);
  const [dismissed, setDismissed] = useState(false);

  if (boundary || dismissed) return null;

  return (
    <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-slate-500 hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 text-cyan-300">
        <Compass className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Island Layout Studio</h2>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        A futuristic urban planning studio for Maldives-style islands. Sketch the
        land, then generate a complete land-use layout.
      </p>
      <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90 leading-snug">
        🚧 This project is a work in progress. Got comments or feedback? Message
        me on WhatsApp{" "}
        <a
          href="https://wa.me/9609690600"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-200"
        >
          <MessageCircle className="h-3 w-3" /> +960 969 0600
        </a>
        .
      </div>
      <ol className="mt-4 space-y-2">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm text-slate-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-semibold text-cyan-300">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <button
        onClick={() => {
          setDrawMode("boundary");
          setDismissed(true);
        }}
        className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-cyan-400"
      >
        Start by drawing the boundary
      </button>
    </div>
  );
}
