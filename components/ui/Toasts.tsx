"use client";

import { usePlanningStore } from "@/store/usePlanningStore";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export function Toasts() {
  const toasts = usePlanningStore((s) => s.toasts);
  const dismiss = usePlanningStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => {
        const Icon =
          t.kind === "success"
            ? CheckCircle2
            : t.kind === "error"
              ? AlertTriangle
              : Info;
        const color =
          t.kind === "success"
            ? "text-emerald-400"
            : t.kind === "error"
              ? "text-red-400"
              : "text-cyan-300";
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/90 backdrop-blur px-4 py-2 text-sm text-slate-100 shadow-xl"
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-2 text-slate-500 hover:text-slate-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
