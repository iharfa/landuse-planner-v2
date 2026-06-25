import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { RoadFeature, PlanningControls } from "@/lib/types";
import {
  turf,
  safeBuffer,
  safeUnion,
  safeIntersect,
  safeDifference,
  safeSimplify,
  polygonArea,
  makeId,
} from "@/lib/geometry/turfHelpers";
import type { PlanningFeature } from "@/lib/types";
import { FRONTAGE_DEPTH_M } from "./constants";

/**
 * Step 2 (roads portion) + Step 3 (frontage bands).
 * Converts road centerlines into a road polygon and a set of frontage bands.
 */
export interface RoadGeometry {
  /** unioned road surface clipped to the buildable area */
  roadPolygon: Feature<Polygon | MultiPolygon> | null;
  /** band on both sides of roads, used to place plots with frontage */
  frontageBand: Feature<Polygon | MultiPolygon> | null;
  /** green verge ring hugging the roads (street greenery), clipped to land */
  vergeBand: Feature<Polygon | MultiPolygon> | null;
  /** road surface as individual planning features (for editing) */
  roadFeatures: PlanningFeature[];
  roadAreaSqm: number;
}

export function buildRoadGeometry(
  roads: RoadFeature[],
  buildable: Feature<Polygon | MultiPolygon>,
  controls: PlanningControls,
): RoadGeometry {
  const frontageDepth = FRONTAGE_DEPTH_M[controls.density];
  const vergeWidth = Math.max(0, controls.greenBufferWidthM ?? 0);

  const roadBuffers: Feature<Polygon | MultiPolygon>[] = [];
  const bandBuffers: Feature<Polygon | MultiPolygon>[] = [];
  const vergeBuffers: Feature<Polygon | MultiPolygon>[] = [];

  for (const road of roads) {
    // Each road carries its own width (from its class + lanes); fall back to the
    // global default for scenarios saved before per-road widths existed.
    const halfWidth = (road.widthM ?? controls.roadWidthM) / 2;
    const line = turf.feature(road.geometry);
    const rb = safeBuffer(line, halfWidth);
    if (rb) roadBuffers.push(rb);
    const band = safeBuffer(line, halfWidth + frontageDepth);
    if (band) bandBuffers.push(band);
    if (vergeWidth > 0) {
      const wide = safeBuffer(line, halfWidth + vergeWidth);
      if (wide) vergeBuffers.push(wide);
    }
  }

  let roadUnion = safeUnion(roadBuffers);
  let bandUnion = safeUnion(bandBuffers);

  // Clip road surface to buildable land.
  if (roadUnion) {
    const clipped = safeIntersect(roadUnion, buildable);
    roadUnion = clipped ?? roadUnion;
  }

  // Frontage band = band minus road surface, clipped to buildable.
  let frontageBand: Feature<Polygon | MultiPolygon> | null = null;
  if (bandUnion) {
    const clippedBand = safeIntersect(bandUnion, buildable) ?? bandUnion;
    if (roadUnion) {
      const diff = turf.difference(
        turf.featureCollection([clippedBand, roadUnion]),
      );
      frontageBand = (diff as Feature<Polygon | MultiPolygon>) ?? clippedBand;
    } else {
      frontageBand = clippedBand;
    }
  }

  const roadFeatures: PlanningFeature[] = [];
  if (roadUnion) {
    const area = polygonArea(roadUnion.geometry);
    // store as a single road feature for legend/summary; geometry may be multipolygon
    roadFeatures.push({
      id: makeId("road"),
      landUse: "road",
      geometry: roadUnion.geometry,
      areaSqm: area,
      locked: false,
      generated: true,
    });
  }

  // Simplify the band once — it is the hot clip target for every plot rectangle.
  if (frontageBand) frontageBand = safeSimplify(frontageBand);

  // Verge ring = (road buffered by verge width) − road surface, clipped to land.
  let vergeBand: Feature<Polygon | MultiPolygon> | null = null;
  if (vergeWidth > 0 && roadUnion) {
    const wideUnion = safeUnion(vergeBuffers);
    if (wideUnion) {
      const clippedWide = safeIntersect(wideUnion, buildable) ?? wideUnion;
      const ring = safeDifference(clippedWide, roadUnion);
      if (ring) vergeBand = safeSimplify(ring);
    }
  }

  return {
    roadPolygon: roadUnion,
    frontageBand,
    vergeBand,
    roadFeatures,
    roadAreaSqm: roadUnion ? polygonArea(roadUnion.geometry) : 0,
  };
}
