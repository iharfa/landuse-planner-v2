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
import { computeRoadWidth, ROAD_CLASS_DEFAULTS } from "@/lib/generation/constants";
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
    set({
      parcels: [
        ...get().parcels,
        {
          id,
          kind: "parcel",
          geometry,
          areaSqm: polygonArea(geometry),
          landUse: get().parcelDraftUse,
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
      parcels: get().parcels.map((p) =>
        p.id === id ? { ...p, landUse: use } : p,
      ),
    }),

  deleteParcel: (id) =>
    set({
      parcels: get().parcels.filter((p) => p.id !== id),
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
    const { boundary, parcels, roads, controls } = get();
    const { features, summary } = generateLayout({
      boundary,
      parcels,
      roads,
      controls,
    });
    set({ features, summary, drawMode: "none", selectedId: null });
    const errors = summary.warnings.filter((w) => w.severity === "error");
    if (errors.length > 0) get().pushToast(errors[0].message, "error");
    else get().pushToast("Layout generated.", "success");
  },

  regenerateUnlocked: (silent = false) => {
    const { boundary, parcels, roads, controls, features } = get();
    const lockedFeatures = features.filter((f) => f.locked);
    const { features: next, summary } = generateLayout({
      boundary,
      parcels,
      roads,
      controls,
      lockedFeatures,
    });
    set({ features: next, summary, selectedId: null });
    if (!silent) get().pushToast("Regenerated unlocked areas.", "success");
  },

  setAutoGenerate: (v) => set({ autoGenerate: v }),

  clearGenerated: () => {
    set({
      features: get().features.filter((f) => f.locked),
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
