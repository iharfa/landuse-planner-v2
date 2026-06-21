import type { Feature, Polygon, MultiPolygon, LineString } from "geojson";

/** All land-use categories supported by the studio. */
export type LandUseType =
  | "residential"
  | "commercial"
  | "industrial"
  | "school"
  | "mosque"
  | "utility"
  | "recreation"
  | "green"
  | "road"
  | "unassigned"
  | "locked";

/** User-drawn main planning boundary. */
export interface BoundaryFeature {
  id: string;
  kind: "boundary" | "parcel";
  geometry: Polygon;
  areaSqm: number;
}

/** User-drawn road centerline. */
export interface RoadFeature {
  id: string;
  geometry: LineString;
  lengthM: number;
  /** main arterial vs secondary branch — inferred or user-set */
  arterial: boolean;
}

/** A generated (or generated-then-edited) land-use feature. */
export interface PlanningFeature {
  id: string;
  landUse: LandUseType;
  geometry: Polygon | MultiPolygon;
  areaSqm: number;
  locked: boolean;
  /** true when produced by the generator (vs user roads/boundary) */
  generated: boolean;
  label?: string;
}

export type DensityLevel = "low" | "medium" | "high";
export type WalkabilityTarget = 250 | 400 | 600;

/** All planning controls exposed in the right panel. */
export interface PlanningControls {
  residentialPct: number;
  commercialPct: number;
  industrialPct: number;
  greenPct: number;
  /** residential plot size in square feet (1,200–3,000 typical) */
  residentialPlotSqft: number;
  /** commercial plot size in square feet */
  commercialPlotSqft: number;
  roadWidthM: number;
  /** front setback from the road edge, in metres */
  frontSetbackM: number;
  /** side setback / gap between adjacent plots, in metres */
  sideSetbackM: number;
  /** opacity of the land-use overlay over the basemap (0.1–0.9) */
  overlayOpacity: number;
  density: DensityLevel;
  walkability: WalkabilityTarget;
  population: number;
  schools: boolean;
  mosques: boolean;
  utilities: boolean;
  recreation: boolean;
}

export interface GenerationWarning {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ScenarioSummary {
  boundaryAreaSqm: number;
  buildableAreaSqm: number;
  roadAreaSqm: number;
  residentialAreaSqm: number;
  commercialAreaSqm: number;
  industrialAreaSqm: number;
  greenAreaSqm: number;
  recreationAreaSqm: number;
  residentialPlots: number;
  commercialPlots: number;
  estimatedPopulation: number;
  schools: number;
  mosques: number;
  warnings: GenerationWarning[];
}

/** A full, serializable scenario stored in localStorage. */
export interface PlanningScenario {
  id: string;
  name: string;
  boundary: BoundaryFeature | null;
  parcels: BoundaryFeature[];
  roads: RoadFeature[];
  features: PlanningFeature[];
  controls: PlanningControls;
  mapCenter: [number, number];
  mapZoom: number;
  createdAt: string;
  updatedAt: string;
}

export type DrawMode =
  | "none"
  | "boundary"
  | "parcel"
  | "road"
  | "select"
  | "merge";

export const DEFAULT_CONTROLS: PlanningControls = {
  residentialPct: 55,
  commercialPct: 15,
  industrialPct: 8,
  greenPct: 12,
  residentialPlotSqft: 2000,
  commercialPlotSqft: 8000,
  roadWidthM: 12,
  frontSetbackM: 3,
  sideSetbackM: 1.5,
  overlayOpacity: 0.55,
  density: "medium",
  walkability: 400,
  population: 5000,
  schools: true,
  mosques: true,
  utilities: true,
  recreation: true,
};
