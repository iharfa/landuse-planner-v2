import type { PlanningScenario } from "@/lib/types";
import { makeId } from "@/lib/geometry/turfHelpers";

const KEY = "island-layout-studio:scenarios";

function read(): PlanningScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlanningScenario[];
  } catch {
    return [];
  }
}

function write(list: PlanningScenario[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function listScenarios(): PlanningScenario[] {
  return read().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function saveScenario(scenario: PlanningScenario): PlanningScenario {
  const list = read();
  const now = new Date().toISOString();
  const idx = list.findIndex((s) => s.id === scenario.id);
  const next = { ...scenario, updatedAt: now };
  if (idx >= 0) list[idx] = next;
  else list.push({ ...next, createdAt: now });
  write(list);
  return next;
}

export function deleteScenario(id: string) {
  write(read().filter((s) => s.id !== id));
}

export function duplicateScenario(id: string): PlanningScenario | null {
  const list = read();
  const src = list.find((s) => s.id === id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: PlanningScenario = {
    ...src,
    id: makeId("scn"),
    name: `${src.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  list.push(copy);
  write(list);
  return copy;
}

export function renameScenario(id: string, name: string) {
  const list = read();
  const s = list.find((x) => x.id === id);
  if (s) {
    s.name = name;
    s.updatedAt = new Date().toISOString();
    write(list);
  }
}
