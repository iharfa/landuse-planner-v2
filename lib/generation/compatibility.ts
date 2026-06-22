import type { LandUseType } from "@/lib/types";

/**
 * Land-use dependency / compatibility matrix and radius-of-influence rules.
 *
 * These encode the concepts from Mohamed (2025), "Applying Evolutionary
 * Algorithms for Optimization of Land Use Planning": some land uses depend on
 * being near others (residential ↔ commercial/school/mosque/green) while some
 * repel (industrial ↔ residential/school). Scores range roughly −3 (strong
 * repel) … +2 (strong dependency). A pair scoring below VIOLATION_THRESHOLD
 * within its radius of influence is counted as a planning violation.
 *
 * All values here are editable constants — tune them to change how the
 * optimizer trades off the layout.
 */

const TYPES: LandUseType[] = [
  "residential",
  "commercial",
  "industrial",
  "school",
  "mosque",
  "utility",
  "recreation",
  "green",
];

/** diagonal (same-type adjacency) scores */
const SELF: Partial<Record<LandUseType, number>> = {
  residential: 1,
  commercial: 1,
  industrial: 2, // industrial likes to cluster
  school: -2, // avoid clustering schools
  mosque: -2, // avoid clustering mosques
  utility: 1,
  recreation: 0,
  green: 1,
};

/** unordered pairs → symmetric compatibility score */
const PAIRS: [LandUseType, LandUseType, number][] = [
  ["residential", "commercial", 2],
  ["residential", "school", 2],
  ["residential", "mosque", 2],
  ["residential", "recreation", 2],
  ["residential", "green", 2],
  ["residential", "utility", -1],
  ["residential", "industrial", -3],
  ["commercial", "school", 1],
  ["commercial", "mosque", 1],
  ["commercial", "recreation", 1],
  ["commercial", "green", 1],
  ["commercial", "utility", 0],
  ["commercial", "industrial", 1],
  ["school", "mosque", 1],
  ["school", "recreation", 1],
  ["school", "green", 2],
  ["school", "utility", -1],
  ["school", "industrial", -3],
  ["mosque", "recreation", 1],
  ["mosque", "green", 1],
  ["mosque", "utility", -1],
  ["mosque", "industrial", -2],
  ["recreation", "green", 2],
  ["recreation", "utility", -1],
  ["recreation", "industrial", -2],
  ["green", "utility", 0],
  ["green", "industrial", 0],
  ["utility", "industrial", 2],
];

function buildMatrix(): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const a of TYPES) {
    m[a] = {};
    for (const b of TYPES) m[a][b] = 0;
  }
  for (const t of TYPES) m[t][t] = SELF[t] ?? 0;
  for (const [a, b, s] of PAIRS) {
    m[a][b] = s;
    m[b][a] = s;
  }
  return m;
}

export const DEPENDENCY_MATRIX = buildMatrix();

/** Highest value in the matrix — used to normalise the compatibility %. */
export const MAX_COMPAT = 2;

/** Pairs scoring below this within range count as violations. */
export const VIOLATION_THRESHOLD = 0;

export function compatScore(a: LandUseType, b: LandUseType): number {
  return DEPENDENCY_MATRIX[a]?.[b] ?? 0;
}

/**
 * Radius of influence (m) for the neighbour graph, derived from the user's
 * walkability target and clamped to a sensible adjacency range. This is the
 * "radius of effect" concept from the thesis (≈200 m in Hulhumalé).
 */
export function influenceRadiusM(walkability: number): number {
  return Math.min(300, Math.max(150, walkability));
}

/** Land uses that participate in compatibility scoring/optimization. */
export const SCORED_USES = new Set<LandUseType>(TYPES);

/** Bulk uses the optimizer is allowed to re-label (counts preserved). */
export const OPTIMIZABLE_USES = new Set<LandUseType>([
  "residential",
  "commercial",
  "industrial",
]);
