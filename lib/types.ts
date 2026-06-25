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

/** How a subtype's plot size is specified. */
export type ParcelSizing = "dimensions" | "area";

/** Per-parcel subdivision settings (chosen subtype + editable plot sizing). */
export interface ParcelPlotParams {
  /** id of the chosen subtype within its land use (see PARCEL_SUBTYPES) */
  subtypeId: string;
  sizing: ParcelSizing;
  /** plot frontage width in metres (sizing === "dimensions") */
  widthM: number;
  /** plot depth in metres (sizing === "dimensions") */
  depthM: number;
  /** target plot area in m² (sizing === "area") */
  areaSqm: number;
  /** lateral gap between adjacent plots in the same row, in metres */
  gapM: number;
  /** inset applied to every plot inside its cell, in metres */
  setbackM: number;
  /** width of the walkable access road inserted between plot rows (0 = none) */
  roadWidthM: number;
}

/** User-drawn main planning boundary. */
export interface BoundaryFeature {
  id: string;
  kind: "boundary" | "parcel";
  geometry: Polygon;
  areaSqm: number;
  /**
   * For parcels: the land use assigned to this zone. "unassigned" parcels are
   * treated as buildable land for the generator; any explicit use makes the
   * parcel a fixed land-use zone that the generator preserves.
   */
  landUse?: LandUseType;
  /** subtype + sizing used to subdivide this parcel into plots */
  plotParams?: ParcelPlotParams;
}

/** Road hierarchy / type the user can designate per road. */
export type RoadClass = "main" | "service" | "vehicle-free";

/** User-drawn road centerline. */
export interface RoadFeature {
  id: string;
  geometry: LineString;
  lengthM: number;
  /** road hierarchy / type designated by the user */
  roadClass: RoadClass;
  /** number of lanes (drives the auto width) */
  lanes: number;
  /** carriageway width in metres (auto from class+lanes, user-overridable) */
  widthM: number;
  /**
   * main arterial vs secondary branch — kept for the generator (commercial
   * frontage). Derived from roadClass === "main".
   */
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
  /** set when this feature is a plot subdivided from a parcel */
  parcelId?: string;
  /** subtype id this plot was generated from (e.g. "row-house") */
  subtype?: string;
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
  /** force at least this many residential plots when land allows */
  minResidentialPlots: number;
  roadWidthM: number;
  /** front setback from the road edge, in metres */
  frontSetbackM: number;
  /** side setback / gap between adjacent plots, in metres */
  sideSetbackM: number;
  /** opacity of the land-use overlay over the basemap (0.1–0.9) */
  overlayOpacity: number;
  /** width of green verges along roads / edges, in metres (0 disables) */
  greenBufferWidthM: number;
  /** leftover green areas at least this large are designated parks, in m² */
  minParkAreaSqm: number;
  density: DensityLevel;
  walkability: WalkabilityTarget;
  population: number;
  schools: boolean;
  mosques: boolean;
  utilities: boolean;
  recreation: boolean;
  /** run the compatibility optimizer after allocation */
  optimizeCompatibility: boolean;
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
  /** compatibility / diversity / violation scores (thesis-style evaluation) */
  compatibilityPct: number;
  diversityScore: number;
  violations: number;
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
  | "curve"
  | "ring"
  | "select"
  | "merge"
  | "place";

export const DEFAULT_CONTROLS: PlanningControls = {
  residentialPct: 55,
  commercialPct: 15,
  industrialPct: 8,
  greenPct: 12,
  residentialPlotSqft: 2000,
  commercialPlotSqft: 8000,
  minResidentialPlots: 0,
  roadWidthM: 12,
  frontSetbackM: 3,
  sideSetbackM: 1.5,
  overlayOpacity: 0.55,
  greenBufferWidthM: 2,
  minParkAreaSqm: 2000,
  density: "medium",
  walkability: 400,
  population: 5000,
  schools: true,
  mosques: true,
  utilities: true,
  recreation: true,
  optimizeCompatibility: true,
};
