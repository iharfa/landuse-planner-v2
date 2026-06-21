import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { RoadFeature, PlanningControls } from "@/lib/types";
import { turf, polygonArea } from "@/lib/geometry/turfHelpers";
import {
  DENSITY_PLOT_SCALE,
  FRONTAGE_DEPTH_M,
  SLIVER_FRACTION,
  SQFT_TO_SQM,
} from "./constants";

/** A raw plot candidate before land-use allocation. */
export interface PlotCandidate {
  geometry: Polygon;
  areaSqm: number;
  /** true when fronting a main/arterial road (commercial-preferred) */
  arterial: boolean;
  /** centroid [lng, lat] used for allocation ordering */
  centroid: Position;
  /** the 4 rectangle corners, used for overlap resolution */
  corners: Position[];
}

/**
 * Step 4: generate rectangular plot candidates along road centerlines.
 *
 * Each plot is a rectangle that starts at the road edge (offset by half the
 * road width plus the front setback) and extends into the land.
 *
 * Two cheap, clip-free tests keep the output clean and fast:
 *  1. Containment — a candidate is kept only if a 3×3 grid of sample points
 *     (corners, edge midpoints, centre) all fall inside the developable land.
 *     Because `developable` already has the road surface removed, this rejects
 *     plots that hang past the boundary *or* straddle a road.
 *  2. Overlap resolution — candidates are placed in order (arterial road first)
 *     into a spatial hash; a candidate is dropped if it overlaps one already
 *     placed. This removes the inter-road overlaps seen near intersections.
 */
export function generatePlotCandidates(
  roads: RoadFeature[],
  developable: Feature<Polygon | MultiPolygon>,
  controls: PlanningControls,
): PlotCandidate[] {
  const scale = DENSITY_PLOT_SCALE[controls.density];
  const maxDepth = FRONTAGE_DEPTH_M[controls.density];
  const offset = controls.roadWidthM / 2 + Math.max(0, controls.frontSetbackM);
  const sideGap = Math.max(0, controls.sideSetbackM);
  const candidates: PlotCandidate[] = [];

  for (const road of roads) {
    // plot sizes are entered in square feet; convert to m² for the geometry
    const targetSqft = road.arterial
      ? controls.commercialPlotSqft
      : controls.residentialPlotSqft;
    const targetArea = targetSqft * SQFT_TO_SQM * scale;
    const depth = Math.min(maxDepth, Math.max(14, Math.sqrt(targetArea) * 1.3));
    const stride = Math.max(8, targetArea / depth);
    const plotWidth = Math.max(6, stride - sideGap);

    const coords = road.geometry.coordinates;
    for (let s = 0; s < coords.length - 1; s++) {
      const a = coords[s];
      const b = coords[s + 1];
      const segLen = turf.distance(turf.point(a), turf.point(b), {
        units: "meters",
      });
      if (segLen < 6) continue;
      const bearing = turf.bearing(turf.point(a), turf.point(b));
      const n = Math.max(1, Math.floor(segLen / stride));
      const step = segLen / n;

      for (let i = 0; i < n; i++) {
        for (const side of [1, -1] as const) {
          const rect = makeRect(a, bearing, i * step, plotWidth, offset, depth, side);
          if (!rect) continue;
          const ring = rect.geometry.coordinates[0];
          if (!fullyInside(ring, developable)) continue;
          const area = polygonArea(rect.geometry);
          if (area < targetArea * SLIVER_FRACTION) continue;
          candidates.push({
            geometry: rect.geometry,
            areaSqm: area,
            arterial: road.arterial,
            centroid: centroidOfRing(ring),
            corners: ring.slice(0, 4),
          });
        }
      }
    }
  }

  return resolveOverlaps(candidates);
}

/** True when corners, edge midpoints and the centre are all inside `poly`. */
function fullyInside(
  ring: Position[],
  poly: Feature<Polygon | MultiPolygon>,
): boolean {
  const c = ring.slice(0, 4);
  const samples: Position[] = [
    ...c,
    mid(c[0], c[1]),
    mid(c[1], c[2]),
    mid(c[2], c[3]),
    mid(c[3], c[0]),
    [(c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4],
  ];
  for (const p of samples) {
    if (!turf.booleanPointInPolygon(turf.point(p), poly)) return false;
  }
  return true;
}

function mid(a: Position, b: Position): Position {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function makeRect(
  origin: Position,
  bearing: number,
  along: number,
  width: number,
  offset: number,
  depth: number,
  side: 1 | -1,
): Feature<Polygon> | null {
  try {
    const p = turf.point(origin);
    const perp = bearing + 90 * side;
    const flBase = turf.destination(p, along, bearing, { units: "meters" });
    const frBase = turf.destination(p, along + width, bearing, { units: "meters" });
    const fl = turf.destination(flBase, offset, perp, { units: "meters" });
    const fr = turf.destination(frBase, offset, perp, { units: "meters" });
    const bl = turf.destination(fl, depth, perp, { units: "meters" });
    const br = turf.destination(fr, depth, perp, { units: "meters" });
    return turf.polygon([
      [
        fl.geometry.coordinates,
        fr.geometry.coordinates,
        br.geometry.coordinates,
        bl.geometry.coordinates,
        fl.geometry.coordinates,
      ],
    ]);
  } catch {
    return null;
  }
}

function centroidOfRing(ring: Position[]): Position {
  let x = 0;
  let y = 0;
  for (let i = 0; i < 4; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / 4, y / 4];
}

/**
 * Ordered, geometry-aware overlap removal via a spatial hash. Candidates keep
 * their input order (arterial/commercial road first), so when two plots from
 * different roads conflict near an intersection the first-placed one wins. Two
 * plots are considered overlapping when a representative point of one lies
 * inside the other — accurate enough for axis-aligned and rotated rectangles
 * without the cost of polygon intersection.
 */
function resolveOverlaps(cands: PlotCandidate[]): PlotCandidate[] {
  const CELL = 28 / 111_320; // ~28 m grid in degrees
  const grid = new Map<string, { poly: Feature<Polygon>; c: PlotCandidate }[]>();
  const kept: PlotCandidate[] = [];

  const cellOf = (p: Position) =>
    [Math.floor(p[0] / CELL), Math.floor(p[1] / CELL)] as [number, number];

  for (const c of cands) {
    const poly = turf.polygon(c.geometry.coordinates);
    const [cx, cy] = cellOf(c.centroid);
    let overlaps = false;

    outer: for (let dx = -1; dx <= 1 && !overlaps; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const n of bucket) {
          if (rectsOverlap(c, poly, n.c, n.poly)) {
            overlaps = true;
            break outer;
          }
        }
      }
    }
    if (overlaps) continue;

    kept.push(c);
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push({ poly, c });
    else grid.set(key, [{ poly, c }]);
  }

  return kept;
}

function rectsOverlap(
  a: PlotCandidate,
  aPoly: Feature<Polygon>,
  b: PlotCandidate,
  bPoly: Feature<Polygon>,
): boolean {
  // a point of A inside B, or a point of B inside A → they overlap
  for (const p of [a.centroid, ...a.corners]) {
    if (turf.booleanPointInPolygon(turf.point(p), bPoly)) return true;
  }
  for (const p of [b.centroid, ...b.corners]) {
    if (turf.booleanPointInPolygon(turf.point(p), aPoly)) return true;
  }
  return false;
}
