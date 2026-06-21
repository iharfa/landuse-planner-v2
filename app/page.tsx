"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LeftToolbar } from "@/components/panels/LeftToolbar";
import { RightControls } from "@/components/panels/RightControls";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { WelcomePanel } from "@/components/panels/WelcomePanel";
import { AutoGenerator } from "@/components/panels/AutoGenerator";
import { Toasts } from "@/components/ui/Toasts";
import { Compass, Info } from "lucide-react";

// MapLibre cannot render on the server.
const PlanningMap = dynamic(
  () => import("@/components/map/PlanningMap").then((m) => m.PlanningMap),
  { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center text-slate-500">Loading map…</div> },
);

export default function Home() {
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

      {/* left toolbar */}
      <div className="absolute left-4 top-16 z-10 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
        <LeftToolbar />
      </div>

      {/* right controls */}
      <div className="absolute right-4 top-16 z-10 max-h-[calc(100vh-5rem)] overflow-y-auto pl-1">
        <RightControls />
      </div>

      {/* bottom summary — kept strictly between the two sidebars */}
      <div className="pointer-events-none absolute bottom-4 left-[288px] right-[320px] z-10">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          <SummaryPanel />
        </div>
      </div>

      <Toasts />
    </main>
  );
}
