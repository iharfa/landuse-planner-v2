import * as turf from "@turf/turf";
import type {
  Feature,
  Polygon,
  MultiPolygon,
  LineString,
  Position,
} from "geojson";

/** A short, collision-resistant id without external deps. */
export function makeId(prefix = "f"): string {
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  const t = Date.now().toString(36);
  return `${prefix}_${t}_${rand}`;
}

export function polygonArea(geom: Polygon | MultiPolygon): number {
  try {
    return turf.area(turf.feature(geom));
  } catch {
    return 0;
  }
}

export function lineLength(geom: LineString): number {
  try {
    return turf.length(turf.feature(geom), { units: "meters" });
  } catch {
    return 0;
  }
}

/** Safe polygon difference (a − b). Returns null if result is empty/invalid. */
export function safeDifference(
  a: Feature<Polygon | MultiPolygon>,
  b: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null {
  try {
    const result = turf.difference(turf.featureCollection([a, b]));
    return result ?? null;
  } catch {
    return a;
  }
}

/** Safe intersection. Returns null if no overlap or on error. */
export function safeIntersect(
  a: Feature<Polygon | MultiPolygon>,
  b: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> | null {
  try {
    const result = turf.intersect(turf.featureCollection([a, b]));
    return result ?? null;
  } catch {
    return null;
  }
}

/** Safe union of many polygons. Returns null if nothing valid. */
export function safeUnion(
  polys: Feature<Polygon | MultiPolygon>[],
): Feature<Polygon | MultiPolygon> | null {
  const valid = polys.filter(Boolean);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  try {
    let acc: Feature<Polygon | MultiPolygon> = valid[0];
    for (let i = 1; i < valid.length; i++) {
      const u = turf.union(turf.featureCollection([acc, valid[i]]));
      if (u) acc = u;
    }
    return acc;
  } catch {
    return valid[0];
  }
}

export function safeBuffer(
  geom: Feature<Polygon | MultiPolygon | LineString>,
  meters: number,
  steps = 2,
): Feature<Polygon | MultiPolygon> | null {
  try {
    // Low `steps` keeps the buffer geometry light, which makes the downstream
    // intersection/difference work (and PNG export) dramatically faster.
    const b = turf.buffer(geom, meters, { units: "meters", steps });
    return (b as Feature<Polygon | MultiPolygon>) ?? null;
  } catch {
    return null;
  }
}

/** Light polygon simplification to speed up downstream clipping. */
export function safeSimplify(
  f: Feature<Polygon | MultiPolygon>,
  toleranceDeg = 0.00002,
): Feature<Polygon | MultiPolygon> {
  try {
    return turf.simplify(f, {
      tolerance: toleranceDeg,
      highQuality: false,
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>;
  } catch {
    return f;
  }
}

export function booleanOverlapOrTouch(
  a: Feature<Polygon | MultiPolygon>,
  b: Feature<Polygon | MultiPolygon>,
): boolean {
  try {
    if (turf.booleanIntersects(a, b)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Iterate the constituent single polygons of a Polygon/MultiPolygon. */
export function explodePolygons(
  feature: Feature<Polygon | MultiPolygon> | null,
): Feature<Polygon>[] {
  if (!feature) return [];
  const g = feature.geometry;
  if (g.type === "Polygon") {
    return [turf.polygon(g.coordinates)];
  }
  return g.coordinates.map((coords) => turf.polygon(coords));
}

/** Centroid position [lng, lat] of a polygon. */
export function centroidOf(geom: Polygon): Position {
  try {
    return turf.centroid(turf.feature(geom)).geometry.coordinates;
  } catch {
    return geom.coordinates[0][0];
  }
}

export { turf };
