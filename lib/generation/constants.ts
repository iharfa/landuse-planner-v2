import type {
  LandUseType,
  DensityLevel,
  RoadClass,
  ParcelSizing,
  ParcelPlotParams,
} from "@/lib/types";

/**
 * Editable rule-based planning constants. Tune these to change how the
 * generator scales facilities and sizes plots. All assumptions live here.
 */

/** Population-scaled facility provision rules. */
export const FACILITY_RULES = {
  /** 1 mosque per N residents (minimum 1 if enabled). */
  residentsPerMosque: 1500,
  /** 1 school per N residents (minimum 1 if enabled). */
  residentsPerSchool: 3000,
  /** 1 recreation area per N residents (minimum 1 if enabled). */
  residentsPerRecreation: 2000,
  /** 1 health facility (clinic/hospital) per N residents (minimum 1 if enabled). */
  residentsPerHealth: 10000,
  /** 1 community / essential-services facility per N residents (min 1 if enabled). */
  residentsPerCommunity: 5000,
  /** Typical built footprint targets (sqm). */
  mosqueAreaSqm: 1200,
  schoolAreaSqm: 6000,
  recreationAreaSqm: 4000,
  healthAreaSqm: 5000,
  communityAreaSqm: 1500,
};

/** Utility reserve as a fraction of site area, by density. */
export const UTILITY_RESERVE_FRACTION: Record<DensityLevel, number> = {
  low: 0.02,
  medium: 0.035,
  high: 0.05,
};

/** Persons per residential plot, by density (used to estimate population). */
export const PERSONS_PER_RESIDENTIAL_PLOT: Record<DensityLevel, number> = {
  low: 4,
  medium: 7,
  high: 14,
};

/** Density multiplier applied to target plot sizes (smaller = denser). */
export const DENSITY_PLOT_SCALE: Record<DensityLevel, number> = {
  low: 1.4,
  medium: 1.0,
  high: 0.7,
};

/** Frontage band depth (m) measured from the road edge into buildable land. */
export const FRONTAGE_DEPTH_M: Record<DensityLevel, number> = {
  low: 35,
  medium: 28,
  high: 22,
};

/** Conversion factor: 1 square foot = 0.092903 square metres. */
export const SQFT_TO_SQM = 0.092903;

/** Minimum boundary area (sqm) required to run the generator. */
export const MIN_BOUNDARY_AREA_SQM = 5000;

/** Plots smaller than this fraction of their target are dropped as slivers. */
export const SLIVER_FRACTION = 0.35;

/** Colors used across map + legend, keyed by land use. */
export const LAND_USE_COLORS: Record<LandUseType, string> = {
  residential: "#e6c79c", // warm sand
  commercial: "#ff7f6b", // coral
  industrial: "#8b7fb0", // muted purple
  school: "#4a90e2", // blue
  mosque: "#2ecc8f", // emerald
  health: "#e11d48", // crimson (hospitals/clinics)
  community: "#7c3aed", // violet (community / essential services)
  utility: "#f4a236", // orange
  recreation: "#37d4d4", // aqua
  green: "#5bbf5b", // green
  road: "#c9ced6", // light grey
  unassigned: "#64748b", // muted
  locked: "#94a3b8", // striped overlay base
};

export const LAND_USE_LABELS: Record<LandUseType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  school: "School",
  mosque: "Mosque",
  health: "Health",
  community: "Community",
  utility: "Utility",
  recreation: "Recreation",
  green: "Green space",
  road: "Road",
  unassigned: "Unassigned",
  locked: "Locked",
};

/**
 * Per-class road defaults. Carriageway width is derived from lanes:
 *   widthM = lanes * laneWidthM + 2 * vergeM
 * `computeRoadWidth` is the single source of truth for that formula.
 */
export const ROAD_CLASS_DEFAULTS: Record<
  RoadClass,
  { lanes: number; laneWidthM: number; vergeM: number; color: string; label: string }
> = {
  main: { lanes: 4, laneWidthM: 3.5, vergeM: 2, color: "#fde047", label: "Main road" },
  service: { lanes: 2, laneWidthM: 3.0, vergeM: 1, color: "#e2e8f0", label: "Service road" },
  "vehicle-free": {
    lanes: 1,
    laneWidthM: 3.0,
    vergeM: 0.5,
    color: "#34d399",
    label: "Vehicle-free",
  },
};

export const ROAD_CLASS_ORDER: RoadClass[] = ["main", "service", "vehicle-free"];

/** Auto carriageway width (m) for a road class and lane count. */
export function computeRoadWidth(roadClass: RoadClass, lanes: number): number {
  const d = ROAD_CLASS_DEFAULTS[roadClass];
  const safeLanes = Math.max(1, Math.round(lanes));
  return Math.round((safeLanes * d.laneWidthM + 2 * d.vergeM) * 10) / 10;
}

/**
 * Plot subtypes per developable land use. Each carries default sizing the user
 * can override per parcel. `defaultSizing` decides whether the subtype is sized
 * by width×depth or by target area out of the box.
 */
export interface ParcelSubtype {
  id: string;
  label: string;
  defaultSizing: ParcelSizing;
  widthM: number;
  depthM: number;
  areaSqm: number;
  gapM: number;
  setbackM: number;
  roadWidthM: number;
}

export const PARCEL_SUBTYPES: Partial<Record<LandUseType, ParcelSubtype[]>> = {
  residential: [
    { id: "row-house", label: "Row houses", defaultSizing: "dimensions", widthM: 6, depthM: 18, areaSqm: 108, gapM: 0, setbackM: 0.5, roadWidthM: 4 },
    { id: "private-home", label: "Private homes", defaultSizing: "dimensions", widthM: 15, depthM: 25, areaSqm: 375, gapM: 2, setbackM: 2, roadWidthM: 6 },
    { id: "social-housing", label: "Social housing", defaultSizing: "dimensions", widthM: 8, depthM: 16, areaSqm: 128, gapM: 1, setbackM: 1, roadWidthM: 5 },
    { id: "luxury-housing", label: "Luxury housing", defaultSizing: "area", widthM: 30, depthM: 40, areaSqm: 1200, gapM: 4, setbackM: 3, roadWidthM: 6 },
    { id: "apartment-complex", label: "Apartment complexes", defaultSizing: "area", widthM: 40, depthM: 60, areaSqm: 2500, gapM: 5, setbackM: 4, roadWidthM: 8 },
  ],
  commercial: [
    { id: "retail-strip", label: "Retail strip", defaultSizing: "dimensions", widthM: 10, depthM: 25, areaSqm: 250, gapM: 0, setbackM: 0.5, roadWidthM: 6 },
    { id: "shopping-mall", label: "Shopping mall", defaultSizing: "area", widthM: 80, depthM: 100, areaSqm: 8000, gapM: 6, setbackM: 5, roadWidthM: 8 },
    { id: "mixed-use", label: "Mixed-use blocks", defaultSizing: "dimensions", widthM: 20, depthM: 30, areaSqm: 600, gapM: 3, setbackM: 2, roadWidthM: 6 },
  ],
  industrial: [
    { id: "light-industrial", label: "Light industrial", defaultSizing: "area", widthM: 40, depthM: 50, areaSqm: 2000, gapM: 4, setbackM: 3, roadWidthM: 8 },
    { id: "heavy-industrial", label: "Heavy industrial", defaultSizing: "area", widthM: 70, depthM: 70, areaSqm: 5000, gapM: 6, setbackM: 5, roadWidthM: 10 },
    { id: "warehouse", label: "Warehouses", defaultSizing: "dimensions", widthM: 40, depthM: 60, areaSqm: 2400, gapM: 4, setbackM: 3, roadWidthM: 10 },
  ],
};

/** Land uses that support subtype-based subdivision. */
export const SUBDIVIDABLE_USES = Object.keys(PARCEL_SUBTYPES) as LandUseType[];

export function getSubtypes(use: LandUseType | undefined): ParcelSubtype[] {
  return (use && PARCEL_SUBTYPES[use]) || [];
}

export function findSubtype(
  use: LandUseType | undefined,
  subtypeId: string,
): ParcelSubtype | undefined {
  return getSubtypes(use).find((s) => s.id === subtypeId);
}

/** Build default plot params for the first (or named) subtype of a use. */
export function defaultPlotParams(
  use: LandUseType | undefined,
  subtypeId?: string,
): ParcelPlotParams | undefined {
  const list = getSubtypes(use);
  if (list.length === 0) return undefined;
  const st = (subtypeId && list.find((s) => s.id === subtypeId)) || list[0];
  return {
    subtypeId: st.id,
    sizing: st.defaultSizing,
    widthM: st.widthM,
    depthM: st.depthM,
    areaSqm: st.areaSqm,
    gapM: st.gapM,
    setbackM: st.setbackM,
    roadWidthM: st.roadWidthM,
  };
}

/**
 * Placeable facility presets (standard sporting arenas). Dimensions are the
 * official playing area in metres (length = longer side). Placed blocks are
 * recreation land use, so they count toward recreation provision.
 */
export interface SportsPreset {
  id: string;
  label: string;
  lengthM: number;
  widthM: number;
  /**
   * Default surround/run-off buffer (metres) added on every side — space for
   * the perimeter boundary, team benches, lighting and safety run-off. Based
   * on typical governing-body run-off recommendations.
   */
  bufferM: number;
}

export const SPORTS_PRESETS: SportsPreset[] = [
  { id: "football", label: "Football Pitch", lengthM: 105, widthM: 68, bufferM: 5 },
  { id: "futsal", label: "Futsal Pitch", lengthM: 40, widthM: 20, bufferM: 2 },
  { id: "basketball", label: "Basketball Court", lengthM: 28, widthM: 15, bufferM: 2 },
  { id: "basketball-half", label: "Basketball Half Court", lengthM: 15, widthM: 14, bufferM: 2 },
  { id: "netball", label: "Netball Court", lengthM: 30.5, widthM: 15.25, bufferM: 3 },
  { id: "tennis", label: "Tennis Court", lengthM: 23.77, widthM: 10.97, bufferM: 4 },
  { id: "volleyball", label: "Volleyball Court", lengthM: 18, widthM: 9, bufferM: 3 },
  { id: "badminton", label: "Badminton Court", lengthM: 13.4, widthM: 6.1, bufferM: 2 },
];

export function findSportsPreset(id: string): SportsPreset | undefined {
  return SPORTS_PRESETS.find((p) => p.id === id);
}

/** Order shown in the legend. */
export const LEGEND_ORDER: LandUseType[] = [
  "residential",
  "commercial",
  "industrial",
  "school",
  "mosque",
  "health",
  "community",
  "utility",
  "recreation",
  "green",
  "road",
  "unassigned",
];
