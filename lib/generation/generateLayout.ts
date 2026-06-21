import type { Feature, Polygon, MultiPolygon, Position } from "geojson";
import type {
  BoundaryFeature,
  RoadFeature,
  PlanningControls,
  PlanningFeature,
  ScenarioSummary,
  GenerationWarning,
  LandUseType,
} from "@/lib/types";
import {
  turf,
  safeUnion,
  safeIntersect,
  safeDifference,
  polygonArea,
  explodePolygons,
  makeId,
  centroidOf,
} from "@/lib/geometry/turfHelpers";
import { validateInputs } from "./validation";
import { buildRoadGeometry } from "./roads";
import { generatePlotCandidates, type PlotCandidate } from "./plots";
import { computeFacilityPlan } from "./facilities";
import {
  PERSONS_PER_RESIDENTIAL_PLOT,
  FACILITY_RULES,
  SLIVER_FRACTION,
} from "./constants";

export interface GenerationResult {
  features: PlanningFeature[];
  summary: ScenarioSummary;
}

export interface GenerationInput {
  boundary: BoundaryFeature | null;
  parcels: BoundaryFeature[];
  roads: RoadFeature[];
  controls: PlanningControls;
  /** Locked features to preserve (their geometry is subtracted from buildable). */
  lockedFeatures?: PlanningFeature[];
}

/** Full rule-based layout generator (Steps 1–7). */
export function generateLayout(input: GenerationInput): GenerationResult {
  const { boundary, parcels, roads, controls } = input;
  const lockedFeatures = input.lockedFeatures ?? [];
  const warnings: GenerationWarning[] = [];

  // --- Step 1: validate ---
  const validation = validateInputs(boundary, roads);
  warnings.push(...validation.warnings);
  if (!validation.ok || !boundary) {
    return {
      features: lockedFeatures,
      summary: emptySummary(boundary, warnings),
    };
  }

  const boundaryFeature = turf.polygon(boundary.geometry.coordinates);
  const activityCenter = centroidOf(boundary.geometry);

  // --- Step 2: prepare buildable land ---
  let buildable: Feature<Polygon | MultiPolygon>;
  if (parcels.length > 0) {
    const clipped = parcels
      .map((p) => safeIntersect(turf.polygon(p.geometry.coordinates), boundaryFeature))
      .filter(Boolean) as Feature<Polygon | MultiPolygon>[];
    buildable = safeUnion(clipped) ?? boundaryFeature;
  } else {
    buildable = boundaryFeature;
    warnings.push({
      id: makeId("w"),
      severity: "info",
      message: "No internal parcels — using the main boundary as one parcel.",
    });
  }

  // Subtract locked features so regeneration leaves them untouched.
  for (const lf of lockedFeatures) {
    const diff = safeDifference(buildable, toFeature(lf.geometry));
    if (diff) buildable = diff;
  }

  // --- Step 2/3: roads + frontage bands ---
  const roadGeom = buildRoadGeometry(roads, buildable, controls);
  let developable = buildable;
  if (roadGeom.roadPolygon) {
    const diff = safeDifference(buildable, roadGeom.roadPolygon);
    if (diff) developable = diff;
  }
  const developableArea = polygonArea(developable.geometry);

  // --- Step 4: plot candidates ---
  const candidates = generatePlotCandidates(roads, developable, controls);

  // Distance-from-center for allocation ordering.
  const withDist = candidates.map((c) => ({
    c,
    dist: turf.distance(turf.point(c.centroid), turf.point(activityCenter), {
      units: "meters",
    }),
  }));

  // --- Step 5: allocate land use ---
  // Residential/commercial/industrial split the actual *plottable* supply
  // (plots only cover road frontage bands, not the whole parcel). Green space
  // is taken from the leftover open land, sized by the green slider.
  const supply = candidates.reduce((sum, c) => sum + c.areaSqm, 0);
  const mixTotal = Math.max(
    1,
    controls.residentialPct + controls.commercialPct + controls.industrialPct,
  );
  const resTarget = (supply * controls.residentialPct) / mixTotal;
  const comTarget = (supply * controls.commercialPct) / mixTotal;
  const indTarget = (supply * controls.industrialPct) / mixTotal;
  const greenTarget = (developableArea * controls.greenPct) / 100;

  const assigned: PlanningFeature[] = [];
  const used = new Set<PlotCandidate>();

  // Industrial: farthest-from-center, non-arterial preferred.
  let indArea = 0;
  if (indTarget > 0) {
    const farFirst = [...withDist].sort((a, b) => b.dist - a.dist);
    for (const { c } of farFirst) {
      if (indArea >= indTarget) break;
      if (used.has(c)) continue;
      used.add(c);
      indArea += c.areaSqm;
      assigned.push(toPlanning(c, "industrial"));
    }
  }

  // Commercial: arterial-fronting, closest-to-center first.
  let comArea = 0;
  const commercialFirst = [...withDist]
    .filter(({ c }) => c.arterial)
    .sort((a, b) => a.dist - b.dist);
  for (const { c } of commercialFirst) {
    if (comArea >= comTarget) break;
    if (used.has(c)) continue;
    used.add(c);
    comArea += c.areaSqm;
    assigned.push(toPlanning(c, "commercial"));
  }

  // Residential: remaining candidates, closest-to-center first.
  let resArea = 0;
  const residentialPool: PlanningFeature[] = [];
  const remaining = [...withDist]
    .filter(({ c }) => !used.has(c))
    .sort((a, b) => a.dist - b.dist);
  const minResidential = Math.max(0, controls.minResidentialPlots);
  for (const { c } of remaining) {
    used.add(c);
    // keep filling residential until the area target is met OR we reach the
    // requested minimum plot count, whichever needs more land
    if (resArea < resTarget || residentialPool.length < minResidential) {
      resArea += c.areaSqm;
      const pf = toPlanning(c, "residential");
      residentialPool.push(pf);
      assigned.push(pf);
    } else {
      assigned.push(toPlanning(c, "unassigned"));
    }
  }

  // --- Facilities: convert residential plots into facility blocks ---
  const facilityPlan = computeFacilityPlan(controls, developableArea);
  const facilityFeatures: PlanningFeature[] = [];
  const consumed = new Set<string>();

  function carveFacility(
    count: number,
    use: LandUseType,
    targetArea: number,
    anchor: Position,
  ) {
    // Average residential plot area, used to bound how many plots a facility
    // may absorb so a large reserve target can never eat the whole pool.
    const avgArea =
      residentialPool.length > 0
        ? residentialPool.reduce((s, p) => s + p.areaSqm, 0) /
          residentialPool.length
        : 1;
    const maxPlotsPerFacility = Math.max(
      1,
      Math.min(10, Math.ceil(targetArea / avgArea)),
    );
    for (let k = 0; k < count; k++) {
      // never consume more than ~40% of the residential pool on facilities
      if (consumed.size >= residentialPool.length * 0.4) break;
      // and never drop the residential count below the requested minimum
      if (residentialPool.length - consumed.size <= minResidential) break;
      const pool = residentialPool.filter((p) => !consumed.has(p.id));
      if (pool.length === 0) break;
      // nearest residential plots to the anchor, accumulate to target area
      const sorted = pool
        .map((p) => ({
          p,
          d: turf.distance(
            turf.centroid(toFeature(p.geometry)),
            turf.point(anchor),
            { units: "meters" },
          ),
        }))
        .sort((a, b) => a.d - b.d);
      const group: PlanningFeature[] = [];
      let area = 0;
      for (const { p } of sorted) {
        group.push(p);
        area += p.areaSqm;
        if (area >= targetArea || group.length >= maxPlotsPerFacility) break;
      }
      if (group.length === 0) break;
      group.forEach((p) => consumed.add(p.id));
      const merged = safeUnion(group.map((p) => toFeature(p.geometry)));
      if (!merged) continue;
      facilityFeatures.push({
        id: makeId(use),
        landUse: use,
        geometry: merged.geometry,
        areaSqm: polygonArea(merged.geometry),
        locked: false,
        generated: true,
        label: capitalize(use),
      });
    }
  }

  // schools near residential mass, mosques near center, recreation distributed,
  // utilities near edge (farthest point). Average the residential centroids
  // (cheap) instead of unioning all plots.
  const resCentroid: Position =
    residentialPool.length > 0
      ? averageCentroid(residentialPool)
      : activityCenter;

  carveFacility(facilityPlan.schools, "school", FACILITY_RULES.schoolAreaSqm, resCentroid);
  carveFacility(facilityPlan.mosques, "mosque", FACILITY_RULES.mosqueAreaSqm, activityCenter);
  carveFacility(
    facilityPlan.recreation,
    "recreation",
    FACILITY_RULES.recreationAreaSqm,
    resCentroid,
  );
  if (facilityPlan.utilityReserveSqm > 0) {
    const edgePoint = farthestVertex(boundary.geometry, activityCenter);
    carveFacility(1, "utility", facilityPlan.utilityReserveSqm, edgePoint);
  }

  // Remove residential plots consumed by facilities.
  const finalResidential = residentialPool.filter((p) => !consumed.has(p.id));
  const otherAssigned = assigned.filter(
    (p) => p.landUse !== "residential" || !consumed.has(p.id),
  );

  // --- Step 6: green / unassigned from leftover developable ---
  // Plots only occupy the road frontage band; the interior land beyond it is
  // the leftover. Computed with a single cheap difference (no N-way union).
  let leftover: Feature<Polygon | MultiPolygon> | null = developable;
  if (roadGeom.frontageBand) {
    leftover = safeDifference(developable, roadGeom.frontageBand) ?? developable;
  }

  const greenFeatures: PlanningFeature[] = [];
  let greenArea = 0;
  if (leftover) {
    const chunks = explodePolygons(leftover)
      .map((poly) => ({ poly, area: polygonArea(poly.geometry) }))
      .filter((c) => c.area > 20)
      .sort((a, b) => b.area - a.area);
    for (const { poly, area } of chunks) {
      const use: LandUseType = greenArea < greenTarget ? "green" : "unassigned";
      if (use === "green") greenArea += area;
      greenFeatures.push({
        id: makeId(use),
        landUse: use,
        geometry: poly.geometry,
        areaSqm: area,
        locked: false,
        generated: true,
      });
    }
  }

  // --- Assemble all features ---
  const features: PlanningFeature[] = [
    ...lockedFeatures,
    ...roadGeom.roadFeatures,
    ...otherAssigned,
    ...finalResidential.filter((p) => !otherAssigned.includes(p)),
    ...facilityFeatures,
    ...greenFeatures,
  ];

  // --- Step 7: summary + warnings ---
  const summary = buildSummary({
    boundary,
    features,
    controls,
    developableArea,
    roadArea: roadGeom.roadAreaSqm,
    facilityPlan,
    warnings,
    greenArea,
    greenTarget,
    resArea,
    resTarget,
    comArea,
    comTarget,
    minResidential,
  });

  return { features, summary };
}

// ---------- helpers ----------

function toPlanning(c: PlotCandidate, use: LandUseType): PlanningFeature {
  return {
    id: makeId(use),
    landUse: use,
    geometry: c.geometry,
    areaSqm: c.areaSqm,
    locked: false,
    generated: true,
  };
}

function toFeature(g: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> {
  return turf.feature(g);
}

function averageCentroid(feats: PlanningFeature[]): Position {
  let x = 0;
  let y = 0;
  for (const f of feats) {
    const c = centroidOf(f.geometry as Polygon);
    x += c[0];
    y += c[1];
  }
  return [x / feats.length, y / feats.length];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function farthestVertex(poly: Polygon, from: Position): Position {
  let best = poly.coordinates[0][0];
  let bestD = -1;
  for (const ring of poly.coordinates) {
    for (const pt of ring) {
      const d = turf.distance(turf.point(pt), turf.point(from), {
        units: "meters",
      });
      if (d > bestD) {
        bestD = d;
        best = pt;
      }
    }
  }
  return best;
}

function emptySummary(
  boundary: BoundaryFeature | null,
  warnings: GenerationWarning[],
): ScenarioSummary {
  return {
    boundaryAreaSqm: boundary?.areaSqm ?? 0,
    buildableAreaSqm: 0,
    roadAreaSqm: 0,
    residentialAreaSqm: 0,
    commercialAreaSqm: 0,
    industrialAreaSqm: 0,
    greenAreaSqm: 0,
    recreationAreaSqm: 0,
    residentialPlots: 0,
    commercialPlots: 0,
    estimatedPopulation: 0,
    schools: 0,
    mosques: 0,
    warnings,
  };
}

interface SummaryInput {
  boundary: BoundaryFeature;
  features: PlanningFeature[];
  controls: PlanningControls;
  developableArea: number;
  roadArea: number;
  facilityPlan: { schools: number; mosques: number };
  warnings: GenerationWarning[];
  greenArea: number;
  greenTarget: number;
  resArea: number;
  resTarget: number;
  comArea: number;
  comTarget: number;
  minResidential: number;
}

function buildSummary(i: SummaryInput): ScenarioSummary {
  const areaBy = (use: LandUseType) =>
    i.features.filter((f) => f.landUse === use).reduce((s, f) => s + f.areaSqm, 0);
  const countBy = (use: LandUseType) =>
    i.features.filter((f) => f.landUse === use).length;

  const residentialAreaSqm = areaBy("residential");
  const commercialAreaSqm = areaBy("commercial");
  const residentialPlots = countBy("residential");
  const commercialPlots = countBy("commercial");
  const estimatedPopulation = Math.round(
    residentialPlots * PERSONS_PER_RESIDENTIAL_PLOT[i.controls.density],
  );

  const warnings = [...i.warnings];
  const addW = (severity: GenerationWarning["severity"], message: string) =>
    warnings.push({ id: makeId("w"), severity, message });

  const plotsWithoutAccess = 0; // generator guarantees frontage; informational
  if (i.greenArea < i.greenTarget * 0.9 && i.controls.greenPct > 0)
    addW("warning", "Green-space target not met.");
  if (i.resArea < i.resTarget * 0.85 && i.controls.residentialPct > 0)
    addW("warning", "Residential target not met — add more roads or parcels.");
  if (i.comArea < i.comTarget * 0.85 && i.controls.commercialPct > 0)
    addW("warning", "Commercial target not met — draw main roads through the center.");
  if (i.roadArea > i.developableArea * 0.45)
    addW("warning", "Road area too high relative to buildable land.");
  if (estimatedPopulation < i.controls.population * 0.6)
    addW("warning", "Not enough land for the selected population target.");
  if (i.minResidential > 0 && residentialPlots < i.minResidential)
    addW(
      "warning",
      `Only ${residentialPlots} of ${i.minResidential} minimum residential plots could be placed.`,
    );
  if (plotsWithoutAccess > 0)
    addW("warning", "Some plots lack road access.");

  return {
    boundaryAreaSqm: i.boundary.areaSqm,
    buildableAreaSqm: i.developableArea,
    roadAreaSqm: i.roadArea,
    residentialAreaSqm,
    commercialAreaSqm,
    industrialAreaSqm: areaBy("industrial"),
    greenAreaSqm: areaBy("green"),
    recreationAreaSqm: areaBy("recreation"),
    residentialPlots,
    commercialPlots,
    estimatedPopulation,
    schools: countBy("school"),
    mosques: countBy("mosque"),
    warnings,
  };
}
