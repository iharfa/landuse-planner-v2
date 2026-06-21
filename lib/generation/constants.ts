import type { LandUseType, DensityLevel } from "@/lib/types";

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
  /** Typical built footprint targets (sqm). */
  mosqueAreaSqm: 1200,
  schoolAreaSqm: 6000,
  recreationAreaSqm: 4000,
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
  utility: "Utility",
  recreation: "Recreation",
  green: "Green space",
  road: "Road",
  unassigned: "Unassigned",
  locked: "Locked",
};

/** Order shown in the legend. */
export const LEGEND_ORDER: LandUseType[] = [
  "residential",
  "commercial",
  "industrial",
  "school",
  "mosque",
  "utility",
  "recreation",
  "green",
  "road",
  "unassigned",
];
