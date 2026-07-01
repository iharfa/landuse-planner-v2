"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LeftToolbar } from "@/components/panels/LeftToolbar";
import { RightControls } from "@/components/panels/RightControls";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { WelcomePanel } from "@/components/panels/WelcomePanel";
import { AutoGenerator } from "@/components/panels/AutoGenerator";
import { Toasts } from "@/components/ui/Toasts";
import { usePlanningStore } from "@/store/usePlanningStore";
import { Compass, Info, PanelLeftOpen } from "lucide-react";

// MapLibre cannot render on the server.
const PlanningMap = dynamic(
  () => import("@/components/map/PlanningMap").then((m) => m.PlanningMap),
  { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-slate-500">Loading map…</div> },
);

export default function Home() {
  const leftOpen = usePlanningStore((s) => s.leftPanelOpen);
  const setLeftOpen = usePlanningStore((s) => s.setLeftPanelOpen);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <PlanningMap />
      <AutoGenerator />
      <WelcomePanel />

      {/* top bar */}
      <header className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur px-3 py-1.5">
          <Compass className="h-4 w-4 text-cyan-300" />
          <span className="text-sm font-semibold text-slate-100">
            Island Layout Studio
          </span>
          <Link
            href="/about"
            className="ml-1 text-slate-400 hover:text-cyan-300"
            title="About"
          >
            <Info className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* left tool drawer — slides off-screen when collapsed */}
      <div
        className={`absolute left-0 top-14 bottom-3 z-20 w-[300px] transition-transform duration-300 ease-in-out ${
          leftOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="ml-2 h-full overflow-y-auto pr-1 pb-1">
          <LeftToolbar />
        </div>
      </div>

      {/* open tab shown when the drawer is collapsed */}
      {!leftOpen && (
        <button
          onClick={() => setLeftOpen(true)}
          title="Open tools"
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 flex items-center gap-1 rounded-r-lg border border-l-0 border-white/10 bg-slate-900/90 backdrop-blur px-2 py-3 text-slate-200 shadow-lg hover:bg-slate-800"
        >
          <PanelLeftOpen className="h-4 w-4 text-cyan-300" />
          <span className="text-[11px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
            Tools
          </span>
        </button>
      )}

      {/* right controls */}
      <div className="absolute right-4 top-16 z-10 max-h-[calc(100vh-5rem)] overflow-y-auto pl-1">
        <RightControls />
      </div>

      {/* bottom summary — kept between the drawer/legend and the right controls */}
      <div
        className={`pointer-events-none absolute bottom-4 right-[320px] z-10 transition-[left] duration-300 ${
          leftOpen ? "left-[470px]" : "left-[200px]"
        }`}
      >
        <div className="pointer-events-auto mx-auto max-w-4xl">
          <SummaryPanel />
        </div>
      </div>

      <Toasts />
    </main>
  );
}
