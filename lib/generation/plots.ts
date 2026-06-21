import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type { RoadFeature, PlanningControls } from "@/lib/types";
import { turf, polygonArea } from "@/lib/geometry/turfHelpers";
import {
  DENSITY_PLOT_SCALE,
  FRONTAGE_DEPTH_M,
  SLIVER_FRACTION,
} from "./constants";

/** A raw plot candidate before land-use allocation. */
export interface PlotCandidate {
  geometry: Polygon;
  areaSqm: number;
  /** true when fronting a main/arterial road (commercial-preferred) */
  arterial: boolean;
  /** centroid [lng, lat] used for allocation ordering */
  centroid: Position;
}

/**
 * Step 4: generate rectangular plot candidates along road centerlines.
 *
 * Each plot is a rectangle that starts at the road edge (offset by half the
 * road width) and extends into the land. A candidate is kept only when all of
 * its corners fall inside the buildable land — this is a cheap point-in-polygon
 * test (no per-plot polygon clipping), which keeps generation fast while still
 * guaranteeing road frontage and no overhang past the boundary.
 */
export function generatePlotCandidates(
  roads: RoadFeature[],
  buildable: Feature<Polygon | MultiPolygon>,
  controls: PlanningControls,
): PlotCandidate[] {
  const scale = DENSITY_PLOT_SCALE[controls.density];
  const maxDepth = FRONTAGE_DEPTH_M[controls.density];
  const halfWidth = controls.roadWidthM / 2;
  const candidates: PlotCandidate[] = [];

  for (const road of roads) {
    const targetArea =
      (road.arterial ? controls.commercialPlotSqm : controls.residentialPlotSqm) *
      scale;
    const depth = Math.min(maxDepth, Math.max(14, Math.sqrt(targetArea) * 1.3));
    const width = Math.max(8, targetArea / depth);

    const coords = road.geometry.coordinates;
    for (let s = 0; s < coords.length - 1; s++) {
      const a = coords[s];
      const b = coords[s + 1];
      const segLen = turf.distance(turf.point(a), turf.point(b), {
        units: "meters",
      });
      if (segLen < 6) continue;
      const bearing = turf.bearing(turf.point(a), turf.point(b));
      const n = Math.max(1, Math.floor(segLen / width));
      const step = segLen / n;

      for (let i = 0; i < n; i++) {
        for (const side of [1, -1] as const) {
          const rect = makeRect(a, bearing, i * step, step, halfWidth, depth, side);
          if (!rect) continue;
          const ring = rect.geometry.coordinates[0];
          let inside = true;
          for (let k = 0; k < 4; k++) {
            if (!turf.booleanPointInPolygon(turf.point(ring[k]), buildable)) {
              inside = false;
              break;
            }
          }
          if (!inside) continue;
          const area = polygonArea(rect.geometry);
          if (area < targetArea * SLIVER_FRACTION) continue;
          candidates.push({
            geometry: rect.geometry,
            areaSqm: area,
            arterial: road.arterial,
            centroid: centroidOfRing(ring),
          });
        }
      }
    }
  }

  return dedupeOverlaps(candidates);
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
    // front edge sits at the road edge (offset from the centerline)
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
  // ring has 5 points (closed); average the first 4 corners
  for (let i = 0; i < 4; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / 4, y / 4];
}

/**
 * Drop near-duplicate candidates using a centroid grid (O(n)). Two plots whose
 * centroids fall in the same small cell are treated as the same plot — this
 * removes overlaps where frontage bands from parallel roads meet.
 */
function dedupeOverlaps(cands: PlotCandidate[]): PlotCandidate[] {
  const seen = new Set<string>();
  const kept: PlotCandidate[] = [];
  const cell = 12 / 111_320; // ~12 m in degrees
  for (const c of cands) {
    const key = `${Math.round(c.centroid[0] / cell)}:${Math.round(
      c.centroid[1] / cell,
    )}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(c);
  }
  return kept;
}
