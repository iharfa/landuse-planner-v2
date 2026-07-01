"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawLineStringMode,
  TerraDrawFreehandLineStringMode,
  TerraDrawCircleMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { usePlanningStore } from "@/store/usePlanningStore";
import { BASEMAPS } from "@/lib/map/basemaps";
import {
  LAND_USE_COLORS,
  ROAD_CLASS_DEFAULTS,
  findSportsPreset,
} from "@/lib/generation/constants";
import { pitchMarkings } from "@/lib/generation/pitchMarkings";
import { turf, orientedRectMeters } from "@/lib/geometry/turfHelpers";
import { MapControls } from "./MapControls";

const SRC_FEATURES = "ils-features";
const SRC_BOUNDARY = "ils-boundary";
const SRC_PARCELS = "ils-parcels";
const SRC_ROADS = "ils-roads";
const SRC_SPORT_PITCH = "ils-sport-pitch";
const SRC_SPORT_MARKINGS = "ils-sport-markings";
const SRC_PLACE_PREVIEW = "ils-place-preview";

export function PlanningMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const [coords, setCoords] = useState<[number, number]>([0, 0]);
  const [ready, setReady] = useState(false);

  const store = usePlanningStore;

  // --- init map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const s = store.getState();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[s.basemap].style,
      center: s.mapCenter,
      zoom: s.mapZoom,
      attributionControl: { compact: true },
      // required so html2canvas can capture the WebGL map for PNG export
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: maplibregl.Map }).__map = map;
    }

    map.on("mousemove", (e) => {
      setCoords([e.lngLat.lng, e.lngLat.lat]);
      updatePlacePreview(map, [e.lngLat.lng, e.lngLat.lat]);
      // MapLibre resets the canvas cursor on pointer events, so re-assert the
      // placement crosshair here each move while in place mode.
      if (store.getState().drawMode === "place") {
        map.getCanvas().style.cursor = "crosshair";
      }
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      store.getState().setMapView([c.lng, c.lat], map.getZoom());
    });

    map.on("load", () => {
      addOverlayLayers(map);
      setupDraw(map);
      setReady(true);
      pushData();
    });

    map.on("click", (e) => {
      const st = store.getState();
      const dm = st.drawMode;
      if (dm === "place") {
        st.placeFacility([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      if (dm !== "none" && dm !== "select" && dm !== "merge") return;

      // generated features take click priority, then parcels, then roads.
      const featureHits = map.queryRenderedFeatures(e.point, {
        layers: ["ils-features-fill"],
      });
      const featureId =
        featureHits.length > 0 ? (featureHits[0].properties?.id as string) : null;

      if (dm === "merge" && st.selectedId && featureId && featureId !== st.selectedId) {
        st.mergeFeatures(st.selectedId, featureId);
        return;
      }

      if (featureId) {
        st.setSelected(featureId);
        return;
      }

      // parcels
      const parcelHits = map.queryRenderedFeatures(e.point, {
        layers: ["ils-parcels-fill"],
      });
      if (parcelHits.length > 0) {
        st.setSelected(parcelHits[0].properties?.id as string);
        return;
      }

      // roads — query a small box so thin centerlines are easy to hit
      const pad = 6;
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - pad, e.point.y - pad],
        [e.point.x + pad, e.point.y + pad],
      ];
      const roadHits = map.queryRenderedFeatures(box, {
        layers: ["ils-roads-line", "ils-roads-vehiclefree"],
      });
      if (roadHits.length > 0) {
        st.setSelected(roadHits[0].properties?.id as string);
        return;
      }

      st.setSelected(null);
    });

    return () => {
      drawRef.current?.stop();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- terra-draw setup ---
  function setupDraw(map: maplibregl.Map) {
    // Live snapping: while drawing a road or parcel, snap the cursor onto the
    // nearest vertex / segment of the existing road + parcel network so lines
    // connect cleanly. Reads the live store so it always sees the latest geometry.
    const snapToNetwork = (event: { lng: number; lat: number }) =>
      snapPositionToNetwork([event.lng, event.lat], map.getZoom());

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({ snapping: { toCustom: snapToNetwork } }),
        new TerraDrawLineStringMode({ snapping: { toCustom: snapToNetwork } }),
        // freehand line → curved/arched roads; circle → ring roads
        new TerraDrawFreehandLineStringMode(),
        new TerraDrawCircleMode(),
      ],
    });
    draw.start();
    drawRef.current = draw;

    draw.on("finish", (id) => {
      const snapshot = draw.getSnapshot();
      const feat = snapshot.find((f) => f.id === id);
      if (!feat) return;
      const dm = store.getState().drawMode;
      const geom = feat.geometry as Geometry;
      if (geom.type === "Polygon" && dm === "boundary") {
        store.getState().addBoundary(geom);
      } else if (geom.type === "Polygon" && dm === "parcel") {
        store.getState().addParcel(geom);
      } else if (geom.type === "Polygon" && dm === "ring") {
        // a circle's perimeter becomes a ring-road centerline
        store.getState().addRoad({
          type: "LineString",
          coordinates: geom.coordinates[0],
        });
      } else if (
        geom.type === "LineString" &&
        (dm === "road" || dm === "curve")
      ) {
        store.getState().addRoad(geom);
      }
      // clear terra-draw scratch geometry; our own layers render the result
      setTimeout(() => draw.clear(), 0);
    });
  }

  // --- react to drawMode changes ---
  const drawMode = usePlanningStore((s) => s.drawMode);
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    if (drawMode === "boundary" || drawMode === "parcel") {
      draw.setMode("polygon");
    } else if (drawMode === "road") {
      draw.setMode("linestring");
    } else if (drawMode === "curve") {
      draw.setMode("freehand-linestring");
    } else if (drawMode === "ring") {
      draw.setMode("circle");
    } else {
      // idle / select / merge / place: terra-draw stays inactive
      draw.clear();
      draw.setMode("static");
    }
    // placement cursor + clear the preview when leaving place mode
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = drawMode === "place" ? "crosshair" : "";
      if (drawMode !== "place") {
        const src = map.getSource(SRC_PLACE_PREVIEW) as
          | maplibregl.GeoJSONSource
          | undefined;
        src?.setData(fc([]));
      }
    }
  }, [drawMode]);

  // --- push data to map when store changes ---
  const features = usePlanningStore((s) => s.features);
  const boundary = usePlanningStore((s) => s.boundary);
  const parcels = usePlanningStore((s) => s.parcels);
  const roads = usePlanningStore((s) => s.roads);
  const selectedId = usePlanningStore((s) => s.selectedId);
  const layerVisible = usePlanningStore((s) => s.layerVisible);

  function pushData() {
    const map = mapRef.current;
    if (!map || !map.getSource(SRC_FEATURES)) return;
    const s = store.getState();

    const visibleFeatures = s.features.filter(
      (f) => s.layerVisible[f.landUse] !== false,
    );
    (map.getSource(SRC_FEATURES) as maplibregl.GeoJSONSource).setData(
      fc(
        visibleFeatures.map((f) =>
          feat(f.geometry, {
            id: f.id,
            landUse: f.landUse,
            color: LAND_USE_COLORS[f.landUse],
            locked: f.locked ? 1 : 0,
            label: f.label ?? "",
          }),
        ),
      ),
    );

    (map.getSource(SRC_BOUNDARY) as maplibregl.GeoJSONSource).setData(
      fc(s.boundary ? [feat(s.boundary.geometry, {})] : []),
    );
    (map.getSource(SRC_PARCELS) as maplibregl.GeoJSONSource).setData(
      fc(
        s.parcels.map((p) =>
          feat(p.geometry, {
            id: p.id,
            landUse: p.landUse ?? "unassigned",
            color: LAND_USE_COLORS[p.landUse ?? "unassigned"],
          }),
        ),
      ),
    );
    (map.getSource(SRC_ROADS) as maplibregl.GeoJSONSource).setData(
      fc(
        s.roads.map((r) =>
          feat(r.geometry, {
            id: r.id,
            arterial: r.arterial ? 1 : 0,
            roadClass: r.roadClass ?? "service",
            color: ROAD_CLASS_DEFAULTS[r.roadClass ?? "service"].color,
            widthM: r.widthM ?? 8,
            vehicleFree: r.roadClass === "vehicle-free" ? 1 : 0,
          }),
        ),
      ),
    );

    // derived sports pitch + line markings for placed facilities
    const pitchSrc = map.getSource(SRC_SPORT_PITCH) as
      | maplibregl.GeoJSONSource
      | undefined;
    const markSrc = map.getSource(SRC_SPORT_MARKINGS) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (pitchSrc && markSrc) {
      const sports = s.features.filter(
        (f) =>
          f.landUse === "recreation" &&
          f.subtype &&
          findSportsPreset(f.subtype) &&
          s.layerVisible["recreation"] !== false,
      );
      const pitchFeats: Feature[] = [];
      const markFeats: Feature[] = [];
      for (const f of sports) {
        const { center, rotDeg } = deriveCenterRotation(f.geometry as Geometry);
        const ov = sportOverlay(center, rotDeg, f.subtype!);
        if (!ov) continue;
        pitchFeats.push(ov.pitch);
        markFeats.push(...ov.markings);
      }
      pitchSrc.setData(fc(pitchFeats));
      markSrc.setData(fc(markFeats));
    }

    // selected outline filters (features, parcels, roads share one selectedId)
    const sel = s.selectedId ?? "__none__";
    for (const layer of [
      "ils-features-selected",
      "ils-parcels-selected",
      "ils-roads-selected",
    ]) {
      if (map.getLayer(layer)) {
        map.setFilter(layer, ["==", ["get", "id"], sel]);
      }
    }
  }

  useEffect(() => {
    pushData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, boundary, parcels, roads, selectedId, layerVisible, ready]);

  // --- overlay opacity ---
  const overlayOpacity = usePlanningStore((s) => s.controls.overlayOpacity);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("ils-features-fill")) return;
    map.setPaintProperty("ils-features-fill", "fill-opacity", [
      "case",
      ["==", ["get", "landUse"], "unassigned"],
      overlayOpacity * 0.3,
      overlayOpacity,
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpacity, ready]);

  // --- basemap switching ---
  const basemap = usePlanningStore((s) => s.basemap);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(BASEMAPS[basemap].style);
    map.once("styledata", () => {
      addOverlayLayers(map);
      pushData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // --- delete the selected feature/parcel/road with Delete or Backspace ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const st = store.getState();
      if (!st.selectedId) return;
      e.preventDefault();
      st.deleteSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" id="map-capture-target" />
      <MapControls coords={coords} />
    </div>
  );
}

// ---------- map layer helpers ----------

function addOverlayLayers(map: maplibregl.Map) {
  ensureSource(map, SRC_FEATURES);
  ensureSource(map, SRC_BOUNDARY);
  ensureSource(map, SRC_PARCELS);
  ensureSource(map, SRC_ROADS);
  ensureSource(map, SRC_SPORT_PITCH);
  ensureSource(map, SRC_SPORT_MARKINGS);
  ensureSource(map, SRC_PLACE_PREVIEW);

  if (!map.getLayer("ils-features-fill")) {
    map.addLayer({
      id: "ils-features-fill",
      type: "fill",
      source: SRC_FEATURES,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": [
          "case",
          ["==", ["get", "landUse"], "unassigned"],
          0.15,
          0.55,
        ],
      },
    });
  }
  if (!map.getLayer("ils-features-line")) {
    map.addLayer({
      id: "ils-features-line",
      type: "line",
      source: SRC_FEATURES,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1,
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer("ils-features-locked")) {
    map.addLayer({
      id: "ils-features-locked",
      type: "line",
      source: SRC_FEATURES,
      filter: ["==", ["get", "locked"], 1],
      paint: {
        "line-color": "#f8fafc",
        "line-width": 2,
        "line-dasharray": [2, 2],
      },
    });
  }
  if (!map.getLayer("ils-features-selected")) {
    map.addLayer({
      id: "ils-features-selected",
      type: "line",
      source: SRC_FEATURES,
      filter: ["==", ["get", "id"], "__none__"],
      paint: { "line-color": "#22d3ee", "line-width": 3 },
    });
  }
  if (!map.getLayer("ils-features-label")) {
    map.addLayer({
      id: "ils-features-label",
      type: "symbol",
      source: SRC_FEATURES,
      filter: ["!=", ["get", "label"], ""],
      minzoom: 13,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "text-padding": 8,
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "#0f172a",
        "text-halo-width": 1.5,
      },
    });
  }
  // parcels — filled by their assigned land use, faint when unassigned
  if (!map.getLayer("ils-parcels-fill")) {
    map.addLayer({
      id: "ils-parcels-fill",
      type: "fill",
      source: SRC_PARCELS,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": [
          "case",
          ["==", ["get", "landUse"], "unassigned"],
          0.12,
          0.45,
        ],
      },
    });
  }
  if (!map.getLayer("ils-parcels-line")) {
    map.addLayer({
      id: "ils-parcels-line",
      type: "line",
      source: SRC_PARCELS,
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "landUse"], "unassigned"],
          "#fbbf24",
          ["get", "color"],
        ],
        "line-width": 1.5,
        "line-dasharray": [3, 2],
      },
    });
  }
  if (!map.getLayer("ils-parcels-selected")) {
    map.addLayer({
      id: "ils-parcels-selected",
      type: "line",
      source: SRC_PARCELS,
      filter: ["==", ["get", "id"], "__none__"],
      paint: { "line-color": "#22d3ee", "line-width": 3 },
    });
  }
  // boundary
  if (!map.getLayer("ils-boundary-line")) {
    map.addLayer({
      id: "ils-boundary-line",
      type: "line",
      source: SRC_BOUNDARY,
      paint: { "line-color": "#22d3ee", "line-width": 2.5 },
    });
  }
  // roads centerlines — colored by class, width scaled by carriageway width,
  // vehicle-free roads drawn dashed
  if (!map.getLayer("ils-roads-line")) {
    map.addLayer({
      id: "ils-roads-line",
      type: "line",
      source: SRC_ROADS,
      filter: ["!=", ["get", "vehicleFree"], 1],
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          ["max", 1.5, ["*", ["get", "widthM"], 0.15]],
          18,
          ["max", 2.5, ["*", ["get", "widthM"], 0.7]],
        ],
        "line-opacity": 0.95,
      },
    });
  }
  // vehicle-free roads: dashed, so they read as pedestrian-only routes
  if (!map.getLayer("ils-roads-vehiclefree")) {
    map.addLayer({
      id: "ils-roads-vehiclefree",
      type: "line",
      source: SRC_ROADS,
      filter: ["==", ["get", "vehicleFree"], 1],
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          ["max", 1.5, ["*", ["get", "widthM"], 0.15]],
          18,
          ["max", 2.5, ["*", ["get", "widthM"], 0.7]],
        ],
        "line-opacity": 0.95,
        "line-dasharray": [2, 2],
      },
    });
  }
  if (!map.getLayer("ils-roads-selected")) {
    map.addLayer({
      id: "ils-roads-selected",
      type: "line",
      source: SRC_ROADS,
      filter: ["==", ["get", "id"], "__none__"],
      paint: { "line-color": "#22d3ee", "line-width": 5, "line-opacity": 0.6 },
    });
  }
  // sports pitch fill (grass) beneath white line markings
  if (!map.getLayer("ils-sport-pitch-fill")) {
    map.addLayer({
      id: "ils-sport-pitch-fill",
      type: "fill",
      source: SRC_SPORT_PITCH,
      paint: { "fill-color": "#3f9b46", "fill-opacity": 0.85 },
    });
  }
  if (!map.getLayer("ils-sport-markings-line")) {
    map.addLayer({
      id: "ils-sport-markings-line",
      type: "line",
      source: SRC_SPORT_MARKINGS,
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 19, 2],
        "line-opacity": 0.95,
      },
    });
  }
  // placement preview (follows the cursor in "place" mode)
  if (!map.getLayer("ils-place-preview-fill")) {
    map.addLayer({
      id: "ils-place-preview-fill",
      type: "fill",
      source: SRC_PLACE_PREVIEW,
      filter: ["==", ["get", "kind"], "lot"],
      paint: { "fill-color": "#22d3ee", "fill-opacity": 0.15 },
    });
  }
  if (!map.getLayer("ils-place-preview-pitch")) {
    map.addLayer({
      id: "ils-place-preview-pitch",
      type: "fill",
      source: SRC_PLACE_PREVIEW,
      filter: ["==", ["get", "kind"], "pitch"],
      paint: { "fill-color": "#3f9b46", "fill-opacity": 0.4 },
    });
  }
  if (!map.getLayer("ils-place-preview-line")) {
    map.addLayer({
      id: "ils-place-preview-line",
      type: "line",
      source: SRC_PLACE_PREVIEW,
      paint: {
        "line-color": "#22d3ee",
        "line-width": 1.5,
        "line-dasharray": [2, 1],
      },
    });
  }
}

function ensureSource(map: maplibregl.Map, id: string) {
  if (!map.getSource(id)) {
    map.addSource(id, { type: "geojson", data: fc([]) });
  }
}

function fc(features: Feature[]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

function feat(geometry: Geometry, properties: Record<string, unknown>): Feature {
  return { type: "Feature", geometry, properties };
}

function lineFeat(coords: Position[]): Feature {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
    properties: {},
  };
}

/** Centre [lng,lat] and orientation (deg) of a rectangle-like polygon. */
function deriveCenterRotation(geom: Geometry): {
  center: Position;
  rotDeg: number;
} {
  const ring =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : (geom as { coordinates: Position[][][] }).coordinates[0][0];
  const c0 = ring[0];
  const c1 = ring[1];
  const center: Position = [
    (ring[0][0] + ring[2][0]) / 2,
    (ring[0][1] + ring[2][1]) / 2,
  ];
  const mLng = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const dx = (c1[0] - c0[0]) * mLng;
  const dy = (c1[1] - c0[1]) * 110540;
  return { center, rotDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Project a local-metre point (rotated) to lng/lat around a centre. */
function localToGeo(center: Position, rotRad: number, p: [number, number]): Position {
  const mLng = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const mLat = 110540;
  const rx = p[0] * Math.cos(rotRad) - p[1] * Math.sin(rotRad);
  const ry = p[0] * Math.sin(rotRad) + p[1] * Math.cos(rotRad);
  return [center[0] + rx / mLng, center[1] + ry / mLat];
}

/** Build the pitch polygon + line-marking features for a facility. */
function sportOverlay(
  center: Position,
  rotDeg: number,
  presetId: string,
): { pitch: Feature; markings: Feature[] } | null {
  const preset = findSportsPreset(presetId);
  if (!preset) return null;
  const rotRad = (rotDeg * Math.PI) / 180;
  const pitch = feat(
    orientedRectMeters(center, preset.lengthM, preset.widthM, rotDeg),
    {},
  );
  const markings = pitchMarkings(presetId, preset.lengthM, preset.widthM).map(
    (line) => lineFeat(line.map((pt) => localToGeo(center, rotRad, pt))),
  );
  return { pitch, markings };
}

/** Update the placement-preview source to follow the cursor in "place" mode. */
function updatePlacePreview(map: maplibregl.Map, at: Position) {
  const src = map.getSource(SRC_PLACE_PREVIEW) as
    | maplibregl.GeoJSONSource
    | undefined;
  if (!src) return;
  const st = usePlanningStore.getState();
  if (st.drawMode !== "place" || !st.placementPreset) {
    src.setData(fc([]));
    return;
  }
  const preset = findSportsPreset(st.placementPreset);
  if (!preset) {
    src.setData(fc([]));
    return;
  }
  const buffer = Math.max(0, st.placementBufferM);
  const lot = orientedRectMeters(
    at,
    preset.lengthM + 2 * buffer,
    preset.widthM + 2 * buffer,
    st.placementRotation,
  );
  const ov = sportOverlay(at, st.placementRotation, st.placementPreset);
  const feats: Feature[] = [feat(lot, { kind: "lot" })];
  if (ov) {
    feats.push(feat(ov.pitch.geometry, { kind: "pitch" }));
    for (const m of ov.markings)
      feats.push({ ...m, properties: { kind: "mark" } });
  }
  src.setData(fc(feats));
}

/**
 * Snap a cursor position onto the nearest vertex (preferred) or segment of the
 * existing road + parcel + boundary network, within a zoom-aware tolerance.
 * Returns undefined when nothing is close enough (so the cursor stays free).
 */
function snapPositionToNetwork(
  pos: Position,
  zoom: number,
): Position | undefined {
  const s = usePlanningStore.getState();

  // tolerance: ~14 screen px converted to metres at this zoom/latitude
  const lat = pos[1];
  const metresPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const tolM = Math.max(2, metresPerPixel * 14);

  const lines: Position[][] = [
    ...s.roads.map((r) => r.geometry.coordinates),
    ...s.parcels.map((p) => p.geometry.coordinates[0]),
  ];
  if (s.boundary) lines.push(s.boundary.geometry.coordinates[0]);
  if (lines.length === 0) return undefined;

  const pt = turf.point(pos);

  // 1) nearest existing vertex
  let bestVertex: Position | null = null;
  let bestVertexDist = tolM;
  for (const line of lines) {
    for (const v of line) {
      const d = turf.distance(pt, turf.point(v), { units: "meters" });
      if (d < bestVertexDist) {
        bestVertexDist = d;
        bestVertex = v;
      }
    }
  }
  if (bestVertex) return bestVertex;

  // 2) otherwise nearest point along a segment
  let bestOnLine: Position | null = null;
  let bestOnLineDist = tolM;
  for (const line of lines) {
    if (line.length < 2) continue;
    try {
      const snap = turf.nearestPointOnLine(turf.lineString(line), pt, {
        units: "meters",
      });
      const d = snap.properties.dist ?? Infinity;
      if (d < bestOnLineDist) {
        bestOnLineDist = d;
        bestOnLine = snap.geometry.coordinates;
      }
    } catch {
      /* ignore degenerate lines */
    }
  }
  return bestOnLine ?? undefined;
}
