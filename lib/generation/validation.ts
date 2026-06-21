import type {
  BoundaryFeature,
  RoadFeature,
  GenerationWarning,
} from "@/lib/types";
import { MIN_BOUNDARY_AREA_SQM } from "./constants";
import { makeId } from "@/lib/geometry/turfHelpers";

export interface ValidationResult {
  ok: boolean;
  warnings: GenerationWarning[];
}

/** Step 1 of the generator: validate the inputs before doing geometry work. */
export function validateInputs(
  boundary: BoundaryFeature | null,
  roads: RoadFeature[],
): ValidationResult {
  const warnings: GenerationWarning[] = [];

  if (!boundary) {
    warnings.push({
      id: makeId("w"),
      severity: "error",
      message: "Invalid boundary — draw an island boundary first.",
    });
    return { ok: false, warnings };
  }

  if (boundary.areaSqm < MIN_BOUNDARY_AREA_SQM) {
    warnings.push({
      id: makeId("w"),
      severity: "error",
      message: `Boundary too small (${Math.round(
        boundary.areaSqm,
      )} m²). Minimum is ${MIN_BOUNDARY_AREA_SQM} m².`,
    });
    return { ok: false, warnings };
  }

  if (roads.length === 0) {
    warnings.push({
      id: makeId("w"),
      severity: "warning",
      message: "No roads drawn — sketch road centerlines for best results.",
    });
  }

  return { ok: true, warnings };
}
