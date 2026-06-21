"use client";

import { useEffect, useRef } from "react";
import { usePlanningStore } from "@/store/usePlanningStore";

/**
 * Renderless helper: when "Auto-generate" is on and a layout already exists,
 * re-run the generator (preserving locked zones) shortly after any planning
 * control changes — so plots update live as you move the sliders.
 */
export function AutoGenerator() {
  const controls = usePlanningStore((s) => s.controls);
  const autoGenerate = usePlanningStore((s) => s.autoGenerate);
  const hasGenerated = usePlanningStore((s) =>
    s.features.some((f) => f.generated),
  );
  const regenerate = usePlanningStore((s) => s.regenerateUnlocked);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    // skip the very first run (nothing to regenerate yet)
    if (first.current) {
      first.current = false;
      return;
    }
    if (!autoGenerate || !hasGenerated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => regenerate(true), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, autoGenerate]);

  return null;
}
