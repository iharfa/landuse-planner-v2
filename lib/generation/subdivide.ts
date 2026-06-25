import type { Polygon, Position } from "geojson";
import type { ParcelPlotParams } from "@/lib/types";
import { turf } from "@/lib/geometry/turfHelpers";

/** Hard cap so a tiny plot size on a huge parcel can't lock up the browser. */
export const MAX_PLOTS_PER_PARCEL = 3000;

/** A plot is kept only if at least this fraction of its full area fits the
 * parcel. Keeps plots uniform and drops clipped edge fragments / slivers. */
const KEEP_FRACTION = 0.9;

export interface SubdivisionResult {
  plots: Polygon[];
  /** walkable access-road strips between plot rows, clipped to the parcel */
  roads: Polygon[];
  /** true when the MAX_PLOTS cap was hit (result is truncated) */
  truncated: boolean;
}

/**
 * Subdivide a parcel polygon into a grid of uniform plots.
 *
 * The grid is oriented to the parcel's longest edge. Rows of plots are
 * separated by a walkable access road; within a row plots are separated by a
 * lateral gap; each plot is inset by a setback. Only plots whose full footprint
 * fits the parcel are kept, so edge fragments and slivers are dropped. All work
 * happens in a local metric plane around the centroid, so metre sizes are exact.
 */
export function subdivideParcel(
  parcel: Polygon,
  params: ParcelPlotParams,
): SubdivisionResult {
  const ring = parcel.coordinates[0];
  if (!ring || ring.length < 4) return { plots: [], roads: [], truncated: false };

  // --- local planar projection (metres) around the centroid ---
  const c = turf.centroid(turf.polygon(parcel.coordinates)).geometry
    .coordinates as Position;
  const lng0 = c[0];
  const lat0 = c[1];
  const mPerDegLat = 110540;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const toLocal = (p: Position): [number, number] => [
    (p[0] - lng0) * mPerDegLng,
    (p[1] - lat0) * mPerDegLat,
  ];
  const toGeo = (p: [number, number]): Position => [
    lng0 + p[0] / mPerDegLng,
    lat0 + p[1] / mPerDegLat,
  ];

  // --- target plot dimensions ---
  let w: number;
  let d: number;
  if (params.sizing === "area") {
    const side = Math.sqrt(Math.max(1, params.areaSqm));
    w = side;
    d = side;
  } else {
    w = Math.max(1, params.widthM);
    d = Math.max(1, params.depthM);
  }
  const gap = Math.max(0, params.gapM ?? 0);
  const road = Math.max(0, params.roadWidthM ?? 0);
  // setback can't eat more than ~45% of the smaller side
  const setback = Math.min(
    Math.max(0, params.setbackM ?? 0),
    Math.min(w, d) * 0.45,
  );

  const plotW = w - 2 * setback;
  const plotD = d - 2 * setback;
  const plotArea = plotW * plotD;
  if (plotArea <= 0) return { plots: [], roads: [], truncated: false };

  // --- orient the grid to the parcel's longest edge ---
  const localRing = ring.map(toLocal);
  let alpha = 0;
  let longest = -1;
  for (let i = 0; i < localRing.length - 1; i++) {
    const [x1, y1] = localRing[i];
    const [x2, y2] = localRing[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > longest) {
      longest = len;
      alpha = Math.atan2(y2 - y1, x2 - x1);
    }
  }
  const cosNeg = Math.cos(-alpha);
  const sinNeg = Math.sin(-alpha);
  const rot = ([x, y]: [number, number]): [number, number] => [
    x * cosNeg - y * sinNeg,
    x * sinNeg + y * cosNeg,
  ];
  const cosPos = Math.cos(alpha);
  const sinPos = Math.sin(alpha);
  const unrot = ([x, y]: [number, number]): [number, number] => [
    x * cosPos - y * sinPos,
    x * sinPos + y * cosPos,
  ];

  const rotRing = localRing.map(rot);
  const parcelRot = turf.polygon([closeRing(rotRing)]);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of rotRing) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // convert a rotated-local polygon ring set back to geographic coordinates
  const ringsToGeo = (rings: Position[][]): Position[][] =>
    rings.map((r) => r.map((pt) => toGeo(unrot([pt[0], pt[1]]))));

  // clip a rotated-local rectangle to the parcel; return kept geo polygons
  const clipRect = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    minKeepArea: number,
  ): Polygon[] => {
    const rect = turf.polygon([
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ],
    ]);
    let piece: ReturnType<typeof turf.intersect>;
    try {
      piece = turf.intersect(turf.featureCollection([rect, parcelRot]));
    } catch {
      piece = null;
    }
    if (!piece) return [];
    const polys =
      piece.geometry.type === "Polygon"
        ? [piece.geometry.coordinates]
        : piece.geometry.coordinates;
    const out: Polygon[] = [];
    for (const rings of polys) {
      if (planarArea(rings[0]) < minKeepArea) continue;
      out.push({ type: "Polygon", coordinates: ringsToGeo(rings) });
    }
    return out;
  };

  // --- tile rows (separated by access roads) of plots (separated by gaps) ---
  const plots: Polygon[] = [];
  const roads: Polygon[] = [];
  let truncated = false;
  const stepX = w + gap;
  const stepY = d + road;

  for (let y = minY; y < maxY && !truncated; y += stepY) {
    // plots in this row
    for (let x = minX; x + w <= maxX + 1e-6; x += stepX) {
      if (plots.length >= MAX_PLOTS_PER_PARCEL) {
        truncated = true;
        break;
      }
      // inset the plot inside its cell by the setback
      const px0 = x + setback;
      const py0 = y + setback;
      const kept = clipRect(
        px0,
        py0,
        px0 + plotW,
        py0 + plotD,
        plotArea * KEEP_FRACTION,
      );
      plots.push(...kept);
    }
    // access road strip between this row and the next (skip if it would be
    // the trailing strip past the parcel)
    if (road > 0 && y + d < maxY) {
      const lane = clipRect(minX, y + d, maxX, y + d + road, road * 4);
      roads.push(...lane);
    }
  }

  return { plots, roads, truncated };
}

function closeRing(coords: [number, number][]): [number, number][] {
  if (coords.length === 0) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, first];
  }
  return coords;
}

/** Shoelace area (m²) for a planar ring in local metric coordinates. */
function planarArea(ringCoords: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ringCoords.length - 1; i++) {
    const [x1, y1] = ringCoords[i];
    const [x2, y2] = ringCoords[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
