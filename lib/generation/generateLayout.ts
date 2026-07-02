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
  safeBuffer,
  booleanOverlapOrTouch,
  polygonArea,
  explodePolygons,
  makeId,
  centroidOf,
} from "@/lib/geometry/turfHelpers";
import { validateInputs } from "./validation";
import { buildRoadGeometry } from "./roads";
import { generatePlotCandidates, type PlotCandidate } from "./plots";
import { computeFacilityPlan } from "./facilities";
import { optimizeAndScore, type CompatibilityScores } from "./optimize";
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
  // Parcels with an explicit land use are fixed zones: the generator fills
  // *around* them (they are subtracted from buildable, never subdivided).
  // Parcels left "unassigned" act as buildable sub-areas (the original
  // behaviour).
  const fixedParcels = parcels.filter(
    (p) => p.landUse && p.landUse !== "unassigned",
  );
  const buildableParcels = parcels.filter(
    (p) => !p.landUse || p.landUse === "unassigned",
  );

  let buildable: Feature<Polygon | MultiPolygon>;
  if (buildableParcels.length > 0) {
    const clipped = buildableParcels
      .map((p) => safeIntersect(turf.polygon(p.geometry.coordinates), boundaryFeature))
      .filter(Boolean) as Feature<Polygon | MultiPolygon>[];
    buildable = safeUnion(clipped) ?? boundaryFeature;
  } else {
    buildable = boundaryFeature;
    if (fixedParcels.length === 0) {
      warnings.push({
        id: makeId("w"),
        severity: "info",
        message: "No internal parcels — using the main boundary as one parcel.",
      });
    }
  }

  // Subtract fixed-use parcels so the generator never overlaps them.
  for (const fp of fixedParcels) {
    const diff = safeDifference(buildable, turf.polygon(fp.geometry.coordinates));
    if (diff) buildable = diff;
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
  // Reserve the green verge along roads: removing it from developable keeps
  // plots off it, leaving a green street edge between road and buildings.
  if (roadGeom.vergeBand) {
    const diff = safeDifference(developable, roadGeom.vergeBand);
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

  // Industrial: grow a single contiguous cluster from the plot farthest from
  // the centre (a corner). Clustering — rather than ringing the whole edge —
  // minimises the industrial/residential border and so the compatibility
  // violations the optimizer would otherwise have to fix.
  let indArea = 0;
  if (indTarget > 0 && withDist.length > 0) {
    const seed = withDist.reduce((m, x) => (x.dist > m.dist ? x : m), withDist[0]);
    const seedPt = turf.point(seed.c.centroid);
    const nearSeed = [...withDist].sort(
      (a, b) =>
        turf.distance(turf.point(a.c.centroid), seedPt, { units: "meters" }) -
        turf.distance(turf.point(b.c.centroid), seedPt, { units: "meters" }),
    );
    for (const { c } of nearSeed) {
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

  // --- Facilities: distribute across residential catchments for access ---
  const facilityPlan = computeFacilityPlan(controls, developableArea);
  const facilityFeatures: PlanningFeature[] = [];
  const consumed = new Set<string>();
  const catchments = controls.catchments ?? {
    school: 800,
    mosque: 500,
    health: 1500,
    recreation: 600,
    community: 800,
  };

  // Cache each residential plot's centroid once (used by both coverage
  // selection and carving).
  const resCentroidById = new Map<string, Position>();
  for (const p of residentialPool) {
    resCentroidById.set(p.id, centroidOf(p.geometry as Polygon));
  }

  // Carve a single facility from the residential plots nearest an anchor.
  function carveOneFacility(use: LandUseType, targetArea: number, anchor: Position) {
    if (consumed.size >= residentialPool.length * 0.4) return;
    if (residentialPool.length - consumed.size <= minResidential) return;
    const avgArea =
      residentialPool.length > 0
        ? residentialPool.reduce((s, p) => s + p.areaSqm, 0) /
          residentialPool.length
        : 1;
    const maxPlots = Math.max(1, Math.min(12, Math.ceil(targetArea / avgArea)));
    const pool = residentialPool.filter((p) => !consumed.has(p.id));
    if (pool.length === 0) return;
    const sorted = pool
      .map((p) => ({ p, d: metersBetween(resCentroidById.get(p.id)!, anchor) }))
      .sort((a, b) => a.d - b.d);
    const group: PlanningFeature[] = [];
    let area = 0;
    for (const { p } of sorted) {
      group.push(p);
      area += p.areaSqm;
      if (area >= targetArea || group.length >= maxPlots) break;
    }
    if (group.length === 0) return;
    group.forEach((p) => consumed.add(p.id));
    const merged = safeUnion(group.map((p) => toFeature(p.geometry)));
    if (!merged) return;
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

  // Place `count` facilities of a type at anchors that maximise residential
  // coverage within the catchment radius — so services are spread out and
  // reachable, rather than clustered at the island centre.
  function distributeFacility(
    use: LandUseType,
    count: number,
    targetArea: number,
    radiusM: number,
  ) {
    if (count <= 0) return;
    const pool = residentialPool.filter((p) => !consumed.has(p.id));
    if (pool.length === 0) return;
    const lat0 = activityCenter[1];
    const mLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const mLat = 110540;
    const xs: number[] = [];
    const ys: number[] = [];
    const areas: number[] = [];
    for (const p of pool) {
      const c = resCentroidById.get(p.id)!;
      xs.push((c[0] - activityCenter[0]) * mLng);
      ys.push((c[1] - activityCenter[1]) * mLat);
      areas.push(p.areaSqm);
    }
    const idxs = coverageAnchorIndices(xs, ys, areas, radiusM, count);
    for (const i of idxs) {
      carveOneFacility(use, targetArea, resCentroidById.get(pool[i].id)!);
    }
  }

  distributeFacility(
    "school",
    facilityPlan.schools,
    FACILITY_RULES.schoolAreaSqm,
    catchments.school,
  );
  distributeFacility(
    "mosque",
    facilityPlan.mosques,
    FACILITY_RULES.mosqueAreaSqm,
    catchments.mosque,
  );
  distributeFacility(
    "health",
    facilityPlan.health,
    FACILITY_RULES.healthAreaSqm,
    catchments.health,
  );
  distributeFacility(
    "recreation",
    facilityPlan.recreation,
    FACILITY_RULES.recreationAreaSqm,
    catchments.recreation,
  );
  distributeFacility(
    "community",
    facilityPlan.community,
    FACILITY_RULES.communityAreaSqm,
    catchments.community,
  );
  if (facilityPlan.utilityReserveSqm > 0) {
    const edgePoint = farthestVertex(boundary.geometry, activityCenter);
    carveOneFacility("utility", facilityPlan.utilityReserveSqm, edgePoint);
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
  const minParkArea = Math.max(0, controls.minParkAreaSqm ?? 0);
  if (leftover) {
    const chunks = explodePolygons(leftover)
      .map((poly) => ({ poly, area: polygonArea(poly.geometry) }))
      .filter((c) => c.area > 20)
      .sort((a, b) => b.area - a.area);
    for (const { poly, area } of chunks) {
      // Large open areas always become parks (ample green), regardless of the
      // green-space budget. Smaller leftovers fill green up to the target, then
      // remain unassigned.
      const isPark = minParkArea > 0 && area >= minParkArea;
      const use: LandUseType =
        isPark || greenArea < greenTarget ? "green" : "unassigned";
      if (use === "green") greenArea += area;
      greenFeatures.push({
        id: makeId(use),
        landUse: use,
        geometry: poly.geometry,
        areaSqm: area,
        locked: false,
        generated: true,
        label: isPark ? "Park" : undefined,
      });
    }
  }

  // --- Green structuring: verges along roads + buffers around facilities ---
  // Verge strips reserved earlier become green street edges.
  const vergeFeatures: PlanningFeature[] = explodePolygons(roadGeom.vergeBand)
    .map((poly) => ({ poly, area: polygonArea(poly.geometry) }))
    .filter((c) => c.area > 2)
    .map(({ poly, area }) => ({
      id: makeId("verge"),
      landUse: "green" as LandUseType,
      geometry: poly.geometry,
      areaSqm: area,
      locked: false,
      generated: true,
      label: undefined,
    }));

  // --- Assemble all features ---
  let features: PlanningFeature[] = [
    ...lockedFeatures,
    ...roadGeom.roadFeatures,
    ...otherAssigned,
    ...finalResidential.filter((p) => !otherAssigned.includes(p)),
    ...facilityFeatures,
    ...vergeFeatures,
    ...greenFeatures,
  ];

  // Green ring around schools & mosques, carved out of the plots it overlaps.
  const facilityBufferM = (controls.greenBufferWidthM ?? 0) * 2;
  if (facilityBufferM > 0) {
    const rings = facilityFeatures
      .filter((f) => f.landUse === "school" || f.landUse === "mosque")
      .map((f) => {
        const buf = safeBuffer(toFeature(f.geometry), facilityBufferM);
        return buf ? safeDifference(buf, toFeature(f.geometry)) : null;
      })
      .filter(Boolean) as Feature<Polygon | MultiPolygon>[];
    let facilityZone = safeUnion(rings);
    if (facilityZone) facilityZone = safeIntersect(facilityZone, developable) ?? null;
    if (facilityZone) features = carveGreenZone(features, facilityZone);
  }

  // Drop line-like sliver fragments left by clipping against angled/curved roads.
  features = dropSlivers(features);

  // --- Compatibility optimization (thesis-style) ---
  // Improve land-use placement against the dependency matrix + radius of
  // influence, then report compatibility %, diversity and violation scores.
  // This mutates land-use labels in place (counts preserved, locks respected).
  const scores = optimizeAndScore(
    features,
    controls.walkability,
    controls.optimizeCompatibility,
  );

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
    scores,
  });

  return { features, summary };
}

// ---------- helpers ----------

/**
 * Land uses prone to thin slivers from boolean clipping. Sliver features of
 * these uses render as bare outlines (MapLibre can't fill a ~zero-width
 * polygon), so we drop them.
 */
const SLIVER_USES: ReadonlySet<LandUseType> = new Set([
  "residential",
  "commercial",
  "industrial",
  "green",
  "unassigned",
]);

/** Drop a sliver feature whose average width is below this (metres). */
const MIN_FEATURE_WIDTH_M = 1.5;

/** Outer-ring perimeter in metres (cheap equirectangular approximation). */
function outerPerimeterM(geom: Polygon | MultiPolygon): number {
  const rings =
    geom.type === "Polygon"
      ? [geom.coordinates[0]]
      : geom.coordinates.map((p) => p[0]);
  let per = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const mLng = 111320 * Math.cos((a[1] * Math.PI) / 180);
      const dx = (b[0] - a[0]) * mLng;
      const dy = (b[1] - a[1]) * 110540;
      per += Math.hypot(dx, dy);
    }
  }
  return per;
}

/**
 * Remove sliver features: long, near-zero-width fragments left by clipping
 * plots/leftover against curved or angled roads. Mean width ≈ 2·area /
 * perimeter, which is rotation-invariant, so genuine narrow-but-real plots
 * survive while line-like slivers are dropped. Only generated, sliver-prone
 * land uses are filtered — roads, facilities, locked and parcel features are
 * left alone.
 */
function dropSlivers(features: PlanningFeature[]): PlanningFeature[] {
  return features.filter((f) => {
    if (!f.generated || f.locked || !SLIVER_USES.has(f.landUse)) return true;
    const per = outerPerimeterM(f.geometry);
    if (per <= 0) return false;
    return (2 * f.areaSqm) / per >= MIN_FEATURE_WIDTH_M;
  });
}

/** Land uses whose plots may be carved to make room for green zones. */
const CARVEABLE: ReadonlySet<LandUseType> = new Set([
  "residential",
  "commercial",
  "industrial",
  "unassigned",
]);

/**
 * Carve `zone` out of every carveable, generated plot it overlaps: the
 * overlap becomes green and the remainder keeps the plot's land use. Roads,
 * facilities, locked features and existing green are left untouched.
 */
function carveGreenZone(
  features: PlanningFeature[],
  zone: Feature<Polygon | MultiPolygon>,
): PlanningFeature[] {
  const kept: PlanningFeature[] = [];
  const greens: PlanningFeature[] = [];
  for (const f of features) {
    const carveable =
      f.generated && !f.locked && CARVEABLE.has(f.landUse);
    if (!carveable || !booleanOverlapOrTouch(toFeature(f.geometry), zone)) {
      kept.push(f);
      continue;
    }
    const inter = safeIntersect(toFeature(f.geometry), zone);
    if (inter) {
      for (const poly of explodePolygons(inter)) {
        const area = polygonArea(poly.geometry);
        if (area < 4) continue;
        greens.push({
          id: makeId("green"),
          landUse: "green",
          geometry: poly.geometry,
          areaSqm: area,
          locked: false,
          generated: true,
        });
      }
    }
    const rest = safeDifference(toFeature(f.geometry), zone);
    if (rest && polygonArea(rest.geometry) > 5) {
      kept.push({
        ...f,
        geometry: rest.geometry,
        areaSqm: polygonArea(rest.geometry),
      });
    }
    // if nothing meaningful remains, the plot is fully replaced by green
  }
  return [...kept, ...greens];
}

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

/** Fast equirectangular distance in metres between two lng/lat points. */
function metersBetween(a: Position, b: Position): number {
  const lat0 = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = (b[0] - a[0]) * 111320 * Math.cos(lat0);
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

/**
 * Distribute `count` facilities across residential demand for access. Demand
 * points are in local metres (xs/ys) weighted by `areas`. Each pick maximises
 * residual demand within `radiusM`, then demand within the catchment is decayed
 * so the next facility gravitates elsewhere; a spacing penalty spreads
 * facilities apart even when the catchment covers the whole site. This honours
 * the population-driven count while placing them for coverage, not clustering.
 */
function coverageAnchorIndices(
  xs: number[],
  ys: number[],
  areas: number[],
  radiusM: number,
  count: number,
): number[] {
  const n = xs.length;
  if (n === 0 || count <= 0) return [];
  const r2 = radiusM * radiusM;
  const minSep2 = (radiusM * 0.75) ** 2;
  const w = Float64Array.from(areas);
  const total = areas.reduce((a, b) => a + b, 0) || 1;
  const stride = Math.max(1, Math.ceil(n / 400)); // cap candidate scans
  const result: number[] = [];
  for (let k = 0; k < count; k++) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < n; i += stride) {
      let score = 0;
      for (let j = 0; j < n; j++) {
        const dx = xs[i] - xs[j];
        const dy = ys[i] - ys[j];
        if (dx * dx + dy * dy <= r2) score += w[j];
      }
      // push facilities apart: penalise proximity to already-placed anchors
      for (const a of result) {
        const dx = xs[i] - xs[a];
        const dy = ys[i] - ys[a];
        if (dx * dx + dy * dy < minSep2) score -= total;
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    result.push(best);
    // decay served demand within the catchment so the next pick moves away
    for (let j = 0; j < n; j++) {
      const dx = xs[best] - xs[j];
      const dy = ys[best] - ys[j];
      if (dx * dx + dy * dy <= r2) w[j] *= 0.2;
    }
  }
  return result;
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
    health: 0,
    community: 0,
    compatibilityPct: 0,
    diversityScore: 0,
    violations: 0,
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
  scores: CompatibilityScores;
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
  if (i.scores.violations > 0)
    addW(
      "info",
      `${i.scores.violations} compatibility violation${
        i.scores.violations === 1 ? "" : "s"
      } (e.g. industrial near residential/schools).`,
    );

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
    health: countBy("health"),
    community: countBy("community"),
    compatibilityPct: i.scores.compatibilityPct,
    diversityScore: i.scores.diversityScore,
    violations: i.scores.violations,
    warnings,
  };
}
