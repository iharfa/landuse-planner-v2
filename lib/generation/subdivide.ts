import type { Polygon, Position } from "geojson";
import type { ParcelPlotParams } from "@/lib/types";
import { turf } from "@/lib/geometry/turfHelpers";

/** Hard cap so a tiny plot size on a huge parcel can't lock up the browser. */
export const MAX_PLOTS_PER_PARCEL = 3000;

export interface SubdivisionResult {
  plots: Polygon[];
  /** true when the MAX_PLOTS cap was hit (result is truncated) */
  truncated: boolean;
}

/**
 * Subdivide a parcel polygon into a grid of plots.
 *
 * The grid is oriented to the parcel's longest edge (so plots line up with the
 * dominant frontage rather than north/south), then each cell is clipped to the
 * parcel and edge slivers are dropped. All geometry work happens in a local
 * metric plane around the parcel centroid, so metre-based sizes are exact.
 */
export function subdivideParcel(
  parcel: Polygon,
  params: ParcelPlotParams,
): SubdivisionResult {
  const ring = parcel.coordinates[0];
  if (!ring || ring.length < 4) return { plots: [], truncated: false };

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
  const targetArea = w * d;

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

  // --- tile the bounding box and clip each cell to the parcel ---
  const plots: Polygon[] = [];
  let truncated = false;
  const stepX = w + gap;
  const stepY = d + gap;

  for (let y = minY; y < maxY && !truncated; y += stepY) {
    for (let x = minX; x < maxX; x += stepX) {
      if (plots.length >= MAX_PLOTS_PER_PARCEL) {
        truncated = true;
        break;
      }
      const rect = turf.polygon([
        [
          [x, y],
          [x + w, y],
          [x + w, y + d],
          [x, y + d],
          [x, y],
        ],
      ]);
      let piece: ReturnType<typeof turf.intersect>;
      try {
        piece = turf.intersect(turf.featureCollection([rect, parcelRot]));
      } catch {
        piece = null;
      }
      if (!piece) continue;

      const polys =
        piece.geometry.type === "Polygon"
          ? [piece.geometry.coordinates]
          : piece.geometry.coordinates;

      for (const rings of polys) {
        const area = planarArea(rings[0]);
        if (area < targetArea * 0.4) continue; // drop edge slivers
        const geoRings = rings.map((r) =>
          r.map((pt) => toGeo(unrot([pt[0], pt[1]]))),
        );
        plots.push({ type: "Polygon", coordinates: geoRings });
      }
    }
  }

  return { plots, truncated };
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
