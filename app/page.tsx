"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LeftToolbar } from "@/components/panels/LeftToolbar";
import { RightControls } from "@/components/panels/RightControls";
import { SummaryPanel } from "@/components/panels/SummaryPanel";
import { WelcomePanel } from "@/components/panels/WelcomePanel";
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
      <div className="absolute left-4 top-16 bottom-4 z-10 overflow-y-auto pr-1">
        <LeftToolbar />
      </div>

      {/* right controls */}
      <div className="absolute right-4 top-16 bottom-4 z-10 overflow-y-auto pl-1">
        <RightControls />
      </div>

      {/* bottom summary */}
      <div className="absolute bottom-4 left-1/2 z-10 w-[min(900px,calc(100vw-580px))] -translate-x-1/2">
        <SummaryPanel />
      </div>

      <Toasts />
    </main>
  );
}
