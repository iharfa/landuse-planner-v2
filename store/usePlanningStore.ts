"use client";

import { create } from "zustand";
import type {
  BoundaryFeature,
  RoadFeature,
  RoadClass,
  PlanningFeature,
  PlanningControls,
  PlanningScenario,
  ScenarioSummary,
  DrawMode,
  LandUseType,
} from "@/lib/types";
import { DEFAULT_CONTROLS } from "@/lib/types";
import {
  computeRoadWidth,
  ROAD_CLASS_DEFAULTS,
  defaultPlotParams,
  findSubtype,
} from "@/lib/generation/constants";
import { subdivideParcel as subdivideParcelGeom } from "@/lib/generation/subdivide";
import type { ParcelPlotParams } from "@/lib/types";
import { generateLayout } from "@/lib/generation/generateLayout";
import {
  makeId,
  polygonArea,
  lineLength,
  snapLineEndpoints,
  safeUnion,
  turf,
} from "@/lib/geometry/turfHelpers";
import { generateRoadGrid } from "@/lib/generation/roadGrid";
import type { Polygon, MultiPolygon } from "geojson";

function mergePolys(
  a: PlanningFeature,
  b: PlanningFeature,
): Polygon | MultiPolygon | null {
  const u = safeUnion([turf.feature(a.geometry), turf.feature(b.geometry)]);
  return u ? u.geometry : null;
}
import type { BasemapId } from "@/lib/map/basemaps";
import { MALDIVES_CENTER, DEFAULT_ZOOM } from "@/lib/map/basemaps";
import {
  saveScenario as persistScenario,
} from "@/lib/storage/scenarioStorage";

export interface Toast {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
}

interface PlanningState {
  scenarioId: string;
  projectName: string;
  boundary: BoundaryFeature | null;
  parcels: BoundaryFeature[];
  roads: RoadFeature[];
  features: PlanningFeature[];
  controls: PlanningControls;
  summary: ScenarioSummary | null;

  drawMode: DrawMode;
  selectedId: string | null;
  /** land use applied to the next parcel drawn */
  parcelDraftUse: LandUseType;
  /** class / lanes applied to the next road drawn */
  roadDraft: { roadClass: RoadClass; lanes: number; widthM: number };
  basemap: BasemapId;
  mapCenter: [number, number];
  mapZoom: number;
  layerVisible: Record<LandUseType, boolean>;
  autoGenerate: boolean;
  toasts: Toast[];

  // setters
  setProjectName: (name: string) => void;
  setControls: (patch: Partial<PlanningControls>) => void;
  setDrawMode: (mode: DrawMode) => void;
  setSelected: (id: string | null) => void;
  setParcelDraftUse: (use: LandUseType) => void;
  setRoadDraft: (patch: Partial<{ roadClass: RoadClass; lanes: number; widthM: number }>) => void;
  setBasemap: (id: BasemapId) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  toggleLayer: (use: LandUseType) => void;

  // drawing results from the map
  addBoundary: (geometry: BoundaryFeature["geometry"]) => void;
  addParcel: (geometry: BoundaryFeature["geometry"]) => void;
  addRoad: (geometry: RoadFeature["geometry"]) => void;
  clearRoads: () => void;

  // parcel editing
  changeParcelLandUse: (id: string, use: LandUseType) => void;
  deleteParcel: (id: string) => void;
  updateParcelGeometry: (id: string, geometry: BoundaryFeature["geometry"]) => void;

  // parcel subdivision into plots
  setParcelSubtype: (id: string, subtypeId: string) => void;
  setParcelPlotParams: (id: string, patch: Partial<ParcelPlotParams>) => void;
  subdivideParcel: (id: string) => void;
  clearParcelPlots: (id: string) => void;

  // road editing
  setRoadClass: (id: string, roadClass: RoadClass) => void;
  setRoadLanes: (id: string, lanes: number) => void;
  setRoadWidth: (id: string, widthM: number) => void;
  deleteRoad: (id: string) => void;
  fillRoadGrid: (spacingM: number, angleDeg: number) => void;

  // generation
  generate: () => void;
  regenerateUnlocked: (silent?: boolean) => void;
  clearGenerated: () => void;
  setAutoGenerate: (v: boolean) => void;

  // feature editing
  changeLandUse: (id: string, use: LandUseType) => void;
  toggleLock: (id: string) => void;
  deleteFeature: (id: string) => void;
  mergeFeatures: (idA: string, idB: string) => void;
  updateFeatureGeometry: (id: string, geometry: PlanningFeature["geometry"]) => void;

  // scenarios
  toScenario: () => PlanningScenario;
  loadScenario: (s: PlanningScenario) => void;
  newScenario: () => void;
  saveCurrent: () => void;

  // toasts
  pushToast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
}

const allLayersVisible: Record<LandUseType, boolean> = {
  residential: true,
  commercial: true,
  industrial: true,
  school: true,
  mosque: true,
  utility: true,
  recreation: true,
  green: true,
  road: true,
  unassigned: true,
  locked: true,
};

export const usePlanningStore = create<PlanningState>((set, get) => ({
  scenarioId: makeId("scn"),
  projectName: "Untitled Island Plan",
  boundary: null,
  parcels: [],
  roads: [],
  features: [],
  controls: { ...DEFAULT_CONTROLS },
  summary: null,
  drawMode: "none",
  selectedId: null,
  parcelDraftUse: "residential",
  roadDraft: { roadClass: "main", lanes: 4, widthM: computeRoadWidth("main", 4) },
  basemap: "satellite",
  mapCenter: MALDIVES_CENTER,
  mapZoom: DEFAULT_ZOOM,
  layerVisible: { ...allLayersVisible },
  autoGenerate: true,
  toasts: [],

  setProjectName: (name) => set({ projectName: name }),
  setControls: (patch) => set({ controls: { ...get().controls, ...patch } }),
  setDrawMode: (mode) => set({ drawMode: mode, selectedId: null }),
  setSelected: (id) => set({ selectedId: id }),
  setParcelDraftUse: (use) => set({ parcelDraftUse: use }),
  setRoadDraft: (patch) => {
    const next = { ...get().roadDraft, ...patch };
    // picking a new class resets lanes to that class's default
    if (patch.roadClass && patch.lanes === undefined) {
      next.lanes = ROAD_CLASS_DEFAULTS[patch.roadClass].lanes;
    }
    // class or lanes changes recompute the auto width unless width was set
    // explicitly in the same patch (manual override)
    if ((patch.roadClass || patch.lanes !== undefined) && patch.widthM === undefined) {
      next.widthM = computeRoadWidth(next.roadClass, next.lanes);
    }
    set({ roadDraft: next });
  },
  setBasemap: (id) => set({ basemap: id }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),
  toggleLayer: (use) =>
    set({ layerVisible: { ...get().layerVisible, [use]: !get().layerVisible[use] } }),

  addBoundary: (geometry) =>
    set({
      boundary: {
        id: makeId("bnd"),
        kind: "boundary",
        geometry,
        areaSqm: polygonArea(geometry),
      },
      drawMode: "none",
    }),

  addParcel: (geometry) => {
    const id = makeId("parcel");
    const use = get().parcelDraftUse;
    set({
      parcels: [
        ...get().parcels,
        {
          id,
          kind: "parcel",
          geometry,
          areaSqm: polygonArea(geometry),
          landUse: use,
          plotParams: defaultPlotParams(use),
        },
      ],
      // select the new parcel so its use can be edited immediately
      selectedId: id,
      drawMode: "select",
    });
  },

  addRoad: (geometry) => {
    const existing = get().roads;
    // snap the new road's endpoints onto the existing network so it connects
    // (a safety net on top of the live snapping done while drawing)
    const snapped: RoadFeature["geometry"] = {
      type: "LineString",
      coordinates: snapLineEndpoints(
        geometry.coordinates,
        existing.map((r) => r.geometry),
      ),
    };
    const len = lineLength(snapped);
    const draft = get().roadDraft;
    set({
      roads: [
        ...existing,
        {
          id: makeId("road"),
          geometry: snapped,
          lengthM: len,
          roadClass: draft.roadClass,
          lanes: draft.lanes,
          widthM: draft.widthM,
          arterial: draft.roadClass === "main",
        },
      ],
      drawMode: "none",
    });
  },

  clearRoads: () => {
    set({ roads: [] });
    get().pushToast("Roads cleared.", "info");
  },

  changeParcelLandUse: (id, use) =>
    set({
      // changing the use invalidates the subtype (subtypes are use-specific),
      // so reset plot params to that use's default and drop any old plots
      parcels: get().parcels.map((p) =>
        p.id === id
          ? { ...p, landUse: use, plotParams: defaultPlotParams(use) }
          : p,
      ),
      features: get().features.filter((f) => f.parcelId !== id),
    }),

  deleteParcel: (id) =>
    set({
      parcels: get().parcels.filter((p) => p.id !== id),
      // remove any plots subdivided from this parcel
      features: get().features.filter((f) => f.parcelId !== id),
      selectedId: null,
    }),

  updateParcelGeometry: (id, geometry) =>
    set({
      parcels: get().parcels.map((p) =>
        p.id === id
          ? { ...p, geometry, areaSqm: polygonArea(geometry) }
          : p,
      ),
    }),

  setParcelSubtype: (id, subtypeId) =>
    set({
      parcels: get().parcels.map((p) =>
        p.id === id
          ? { ...p, plotParams: defaultPlotParams(p.landUse, subtypeId) }
          : p,
      ),
    }),

  setParcelPlotParams: (id, patch) =>
    set({
      parcels: get().parcels.map((p) => {
        if (p.id !== id) return p;
        const base = p.plotParams ?? defaultPlotParams(p.landUse);
        if (!base) return p;
        return { ...p, plotParams: { ...base, ...patch } };
      }),
    }),

  subdivideParcel: (id) => {
    const parcel = get().parcels.find((p) => p.id === id);
    if (!parcel || !parcel.landUse) {
      get().pushToast("Select a parcel with a land use first.", "error");
      return;
    }
    const params = parcel.plotParams ?? defaultPlotParams(parcel.landUse);
    if (!params) {
      get().pushToast("This land use can’t be subdivided into plots.", "error");
      return;
    }
    const { plots, roads, truncated } = subdivideParcelGeom(
      parcel.geometry,
      params,
    );
    if (plots.length === 0) {
      get().pushToast("No plots fit — try smaller plot sizes.", "error");
      return;
    }
    const subtype = findSubtype(parcel.landUse, params.subtypeId);
    const label = subtype?.label ?? "Plot";
    const plotFeatures: PlanningFeature[] = plots.map((geometry) => ({
      id: makeId("plot"),
      landUse: parcel.landUse as LandUseType,
      geometry,
      areaSqm: polygonArea(geometry),
      locked: false,
      generated: false,
      parcelId: id,
      subtype: params.subtypeId,
      label,
    }));
    // walkable access roads between plot rows
    const roadFeatures: PlanningFeature[] = roads.map((geometry) => ({
      id: makeId("plot-road"),
      landUse: "road" as LandUseType,
      geometry,
      areaSqm: polygonArea(geometry),
      locked: false,
      generated: false,
      parcelId: id,
      subtype: params.subtypeId,
      label: "Access road",
    }));
    set({
      features: [
        ...get().features.filter((f) => f.parcelId !== id),
        ...roadFeatures,
        ...plotFeatures,
      ],
    });
    get().pushToast(
      truncated
        ? `Added ${plotFeatures.length} plots (capped — increase plot size).`
        : `Subdivided into ${plotFeatures.length} ${label.toLowerCase()} plots.`,
      truncated ? "info" : "success",
    );
  },

  clearParcelPlots: (id) => {
    set({ features: get().features.filter((f) => f.parcelId !== id) });
    get().pushToast("Cleared plots for this parcel.", "info");
  },

  setRoadClass: (id, roadClass) =>
    set({
      roads: get().roads.map((r) =>
        r.id === id
          ? {
              ...r,
              roadClass,
              lanes: ROAD_CLASS_DEFAULTS[roadClass].lanes,
              widthM: computeRoadWidth(roadClass, ROAD_CLASS_DEFAULTS[roadClass].lanes),
              arterial: roadClass === "main",
            }
          : r,
      ),
    }),

  setRoadLanes: (id, lanes) =>
    set({
      roads: get().roads.map((r) =>
        r.id === id
          ? { ...r, lanes, widthM: computeRoadWidth(r.roadClass, lanes) }
          : r,
      ),
    }),

  setRoadWidth: (id, widthM) =>
    set({
      roads: get().roads.map((r) => (r.id === id ? { ...r, widthM } : r)),
    }),

  deleteRoad: (id) =>
    set({
      roads: get().roads.filter((r) => r.id !== id),
      selectedId: null,
    }),

  fillRoadGrid: (spacingM, angleDeg) => {
    const boundary = get().boundary;
    if (!boundary) {
      get().pushToast("Draw a boundary first.", "error");
      return;
    }
    const grid = generateRoadGrid(boundary, spacingM, angleDeg);
    if (grid.length === 0) {
      get().pushToast("Could not build a grid for this boundary.", "error");
      return;
    }
    set({ roads: grid, drawMode: "none" });
    get().pushToast(`Road grid added (${grid.length} segments).`, "success");
  },

  generate: () => {
    const { boundary, parcels, roads, controls, features } = get();
    // parcel plots (and any other non-generated features) survive generation;
    // only generated features are replaced. Locked generated features are
    // preserved via the generator's lockedFeatures path.
    const preserved = features.filter((f) => !f.generated);
    const lockedGenerated = features.filter((f) => f.generated && f.locked);
    const { features: gen, summary } = generateLayout({
      boundary,
      parcels,
      roads,
      controls,
      lockedFeatures: lockedGenerated,
    });
    set({
      features: [...preserved, ...gen],
      summary,
      drawMode: "none",
      selectedId: null,
    });
    const errors = summary.warnings.filter((w) => w.severity === "error");
    if (errors.length > 0) get().pushToast(errors[0].message, "error");
    else get().pushToast("Layout generated.", "success");
  },

  regenerateUnlocked: (silent = false) => {
    const { boundary, parcels, roads, controls, features } = get();
    const preserved = features.filter((f) => !f.generated);
    const lockedGenerated = features.filter((f) => f.generated && f.locked);
    const { features: next, summary } = generateLayout({
      boundary,
      parcels,
      roads,
      controls,
      lockedFeatures: lockedGenerated,
    });
    set({ features: [...preserved, ...next], summary, selectedId: null });
    if (!silent) get().pushToast("Regenerated unlocked areas.", "success");
  },

  setAutoGenerate: (v) => set({ autoGenerate: v }),

  clearGenerated: () => {
    set({
      // keep parcel plots / non-generated features and any locked features
      features: get().features.filter((f) => !f.generated || f.locked),
      summary: null,
      selectedId: null,
    });
    get().pushToast("Cleared generated layout.", "info");
  },

  changeLandUse: (id, use) =>
    set({
      features: get().features.map((f) =>
        f.id === id ? { ...f, landUse: use } : f,
      ),
    }),

  toggleLock: (id) =>
    set({
      features: get().features.map((f) =>
        f.id === id ? { ...f, locked: !f.locked } : f,
      ),
    }),

  deleteFeature: (id) =>
    set({
      features: get().features.filter((f) => f.id !== id),
      selectedId: null,
    }),

  mergeFeatures: (idA, idB) => {
    const feats = get().features;
    const a = feats.find((f) => f.id === idA);
    const b = feats.find((f) => f.id === idB);
    if (!a || !b || a.id === b.id) return;
    const merged = mergePolys(a, b);
    if (!merged) {
      get().pushToast("Could not merge those features.", "error");
      return;
    }
    set({
      features: feats
        .filter((f) => f.id !== b.id)
        .map((f) =>
          f.id === a.id
            ? { ...f, geometry: merged, areaSqm: polygonArea(merged) }
            : f,
        ),
      selectedId: a.id,
      drawMode: "select",
    });
    get().pushToast("Features merged.", "success");
  },

  updateFeatureGeometry: (id, geometry) =>
    set({
      features: get().features.map((f) =>
        f.id === id
          ? { ...f, geometry, areaSqm: polygonArea(geometry) }
          : f,
      ),
    }),

  toScenario: () => {
    const s = get();
    const now = new Date().toISOString();
    return {
      id: s.scenarioId,
      name: s.projectName,
      boundary: s.boundary,
      parcels: s.parcels,
      roads: s.roads,
      features: s.features,
      controls: s.controls,
      mapCenter: s.mapCenter,
      mapZoom: s.mapZoom,
      createdAt: now,
      updatedAt: now,
    };
  },

  loadScenario: (s) =>
    set({
      scenarioId: s.id,
      projectName: s.name,
      boundary: s.boundary,
      // backfill fields added after older scenarios were saved
      parcels: s.parcels.map((p) => ({
        ...p,
        landUse: p.landUse ?? "unassigned",
      })),
      roads: s.roads.map((r) => {
        const roadClass: RoadClass =
          r.roadClass ?? (r.arterial ? "main" : "service");
        const lanes = r.lanes ?? ROAD_CLASS_DEFAULTS[roadClass].lanes;
        return {
          ...r,
          roadClass,
          lanes,
          widthM: r.widthM ?? computeRoadWidth(roadClass, lanes),
          arterial: r.arterial ?? roadClass === "main",
        };
      }),
      features: s.features,
      // merge with defaults so scenarios saved by older versions still work
      controls: { ...DEFAULT_CONTROLS, ...s.controls },
      mapCenter: s.mapCenter,
      mapZoom: s.mapZoom,
      summary: null,
      selectedId: null,
      drawMode: "none",
    }),

  newScenario: () =>
    set({
      scenarioId: makeId("scn"),
      projectName: "Untitled Island Plan",
      boundary: null,
      parcels: [],
      roads: [],
      features: [],
      controls: { ...DEFAULT_CONTROLS },
      summary: null,
      selectedId: null,
      drawMode: "none",
    }),

  saveCurrent: () => {
    try {
      persistScenario(get().toScenario());
      get().pushToast("Scenario saved to this browser.", "success");
    } catch {
      get().pushToast("Could not save scenario.", "error");
    }
  },

  pushToast: (message, kind = "info") => {
    const id = makeId("toast");
    set({ toasts: [...get().toasts, { id, message, kind }] });
    setTimeout(() => get().dismissToast(id), 3500);
  },

  dismissToast: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// Dev-only handle for debugging/automated checks. Tree-shaken in production.
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production"
) {
  (window as unknown as { __ils?: unknown }).__ils = usePlanningStore;
}
