import type { PlanningControls, DensityLevel } from "@/lib/types";
import {
  FACILITY_RULES,
  UTILITY_RESERVE_FRACTION,
} from "./constants";

export interface FacilityPlan {
  schools: number;
  mosques: number;
  health: number;
  community: number;
  recreation: number;
  utilityReserveSqm: number;
}

/** Step 5 inputs: derive how many of each facility the population needs. */
export function computeFacilityPlan(
  controls: PlanningControls,
  siteAreaSqm: number,
): FacilityPlan {
  const pop = Math.max(0, controls.population);

  const schools = controls.schools
    ? Math.max(1, Math.round(pop / FACILITY_RULES.residentsPerSchool))
    : 0;
  const mosques = controls.mosques
    ? Math.max(1, Math.round(pop / FACILITY_RULES.residentsPerMosque))
    : 0;
  const recreation = controls.recreation
    ? Math.max(1, Math.round(pop / FACILITY_RULES.residentsPerRecreation))
    : 0;
  const health = controls.health
    ? Math.max(1, Math.round(pop / FACILITY_RULES.residentsPerHealth))
    : 0;
  const community = controls.community
    ? Math.max(1, Math.round(pop / FACILITY_RULES.residentsPerCommunity))
    : 0;

  const reserveFraction: number =
    UTILITY_RESERVE_FRACTION[controls.density as DensityLevel];
  const utilityReserveSqm = controls.utilities
    ? siteAreaSqm * reserveFraction
    : 0;

  return { schools, mosques, health, community, recreation, utilityReserveSqm };
}
