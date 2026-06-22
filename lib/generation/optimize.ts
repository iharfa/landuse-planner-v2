import type { Position } from "geojson";
import type { LandUseType, PlanningFeature } from "@/lib/types";
import {
  compatScore,
  influenceRadiusM,
  MAX_COMPAT,
  VIOLATION_THRESHOLD,
  SCORED_USES,
  OPTIMIZABLE_USES,
} from "./compatibility";
import { centroidOf } from "@/lib/geometry/turfHelpers";

export interface CompatibilityScores {
  compatibilityPct: number;
  diversityScore: number;
  violations: number;
}

interface Node {
  feature: PlanningFeature;
  centroid: Position;
  use: LandUseType;
  optimizable: boolean;
  neighbors: number[];
}

const PENALTY_VIOLATION = 6; // extra cost added to each violating pair
const MAX_NEIGHBORS = 14; // cap per node — keeps the graph (and cost) bounded
const TIME_BUDGET_MS = 120; // optimizer wall-clock budget

/** Inline haversine distance in metres (avoids per-call turf allocation). */
function haversine(a: Position, b: Position): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cost contribution of a neighbouring pair — lower is better. */
function pairCost(a: LandUseType, b: LandUseType): number {
  const s = compatScore(a, b);
  return (s < VIOLATION_THRESHOLD ? PENALTY_VIOLATION : 0) - s;
}

/** Build a capped, radius-limited neighbour graph over the scored plots. */
function buildNodes(features: PlanningFeature[], radiusM: number): Node[] {
  const scored = features.filter(
    (f) => SCORED_USES.has(f.landUse) && f.geometry.type === "Polygon",
  );
  const nodes: Node[] = scored.map((f) => ({
    feature: f,
    centroid: centroidOf(f.geometry as GeoJSON.Polygon),
    use: f.landUse,
    optimizable: f.generated && !f.locked && OPTIMIZABLE_USES.has(f.landUse),
    neighbors: [],
  }));

  // spatial hash keyed by ~radius-sized cells
  const cell = radiusM / 111_320;
  const grid = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const key = `${Math.floor(n.centroid[0] / cell)}:${Math.floor(
      n.centroid[1] / cell,
    )}`;
    const b = grid.get(key);
    if (b) b.push(i);
    else grid.set(key, [i]);
  });

  const range = radiusM * 1.2;
  const sets: Set<number>[] = nodes.map(() => new Set<number>());
  nodes.forEach((n, i) => {
    const cx = Math.floor(n.centroid[0] / cell);
    const cy = Math.floor(n.centroid[1] / cell);
    for (let dx = -1; dx <= 1 && sets[i].size < MAX_NEIGHBORS; dx++) {
      for (let dy = -1; dy <= 1 && sets[i].size < MAX_NEIGHBORS; dy++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          if (haversine(n.centroid, nodes[j].centroid) <= range) {
            // symmetric edge: changing either node's use affects this pair, so
            // both adjacency lists must contain the other (required for the
            // local-cost delta in the optimizer to be correct)
            sets[i].add(j);
            sets[j].add(i);
            if (sets[i].size >= MAX_NEIGHBORS) break;
          }
        }
      }
    }
  });
  nodes.forEach((n, i) => {
    n.neighbors = Array.from(sets[i]);
  });

  return nodes;
}

function localCost(nodes: Node[], i: number): number {
  let c = 0;
  const a = nodes[i].use;
  for (const j of nodes[i].neighbors) c += pairCost(a, nodes[j].use);
  return c;
}

/**
 * Bounded hill-climbing optimizer. Repeatedly swaps the land-use labels of two
 * optimizable plots of different type and keeps the swap when it lowers the
 * total compatibility cost. Land-use *counts* are preserved (so the percentage
 * mix is untouched) and locked / facility / green plots stay fixed.
 */
export function optimizeAndScore(
  features: PlanningFeature[],
  walkability: number,
  enabled: boolean,
): CompatibilityScores {
  const radiusM = influenceRadiusM(walkability);
  const nodes = buildNodes(features, radiusM);
  const optimizable = nodes
    .map((n, i) => (n.optimizable ? i : -1))
    .filter((i) => i >= 0);

  if (enabled && optimizable.length > 2) {
    const start = Date.now();
    const maxAttempts = Math.min(40_000, optimizable.length * 150);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if ((attempt & 1023) === 0 && Date.now() - start > TIME_BUDGET_MS) break;
      const ii = optimizable[(Math.random() * optimizable.length) | 0];
      const jj = optimizable[(Math.random() * optimizable.length) | 0];
      if (ii === jj || nodes[ii].use === nodes[jj].use) continue;
      const before = localCost(nodes, ii) + localCost(nodes, jj);
      const ui = nodes[ii].use;
      nodes[ii].use = nodes[jj].use;
      nodes[jj].use = ui;
      const after = localCost(nodes, ii) + localCost(nodes, jj);
      if (after < before) {
        // keep swap — write back to the feature's land use
        nodes[ii].feature.landUse = nodes[ii].use;
        nodes[jj].feature.landUse = nodes[jj].use;
      } else {
        // revert
        nodes[jj].use = nodes[ii].use;
        nodes[ii].use = ui;
      }
    }
  }

  return computeScores(nodes);
}

function computeScores(nodes: Node[]): CompatibilityScores {
  let actual = 0;
  let max = 0;
  let violations = 0;
  let pairs = 0;
  const seen = new Set<string>();
  const uses = new Set<LandUseType>();

  nodes.forEach((n, i) => {
    uses.add(n.use);
    for (const j of n.neighbors) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = compatScore(n.use, nodes[j].use);
      actual += s;
      max += MAX_COMPAT;
      pairs++;
      if (s < VIOLATION_THRESHOLD) violations++;
    }
  });

  const compatibilityPct =
    max > 0 ? Math.max(0, Math.min(100, (actual / max) * 100)) : 0;

  return {
    compatibilityPct: Math.round(compatibilityPct * 10) / 10,
    diversityScore: uses.size,
    violations,
  };
}
