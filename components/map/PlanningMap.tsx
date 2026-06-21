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
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { usePlanningStore } from "@/store/usePlanningStore";
import { BASEMAPS } from "@/lib/map/basemaps";
import { LAND_USE_COLORS } from "@/lib/generation/constants";
import { MapControls } from "./MapControls";

const SRC_FEATURES = "ils-features";
const SRC_BOUNDARY = "ils-boundary";
const SRC_PARCELS = "ils-parcels";
const SRC_ROADS = "ils-roads";

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

    map.on("mousemove", (e) =>
      setCoords([e.lngLat.lng, e.lngLat.lat]),
    );
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
      if (dm !== "none" && dm !== "select" && dm !== "merge") return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: ["ils-features-fill"],
      });
      const id = hits.length > 0 ? (hits[0].properties?.id as string) : null;
      if (dm === "merge" && st.selectedId && id && id !== st.selectedId) {
        st.mergeFeatures(st.selectedId, id);
        return;
      }
      st.setSelected(id);
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
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawLineStringMode(),
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
      // idle / select / merge: terra-draw stays inactive
      draw.clear();
      draw.setMode("static");
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
      fc(s.parcels.map((p) => feat(p.geometry, {}))),
    );
    (map.getSource(SRC_ROADS) as maplibregl.GeoJSONSource).setData(
      fc(s.roads.map((r) => feat(r.geometry, { arterial: r.arterial ? 1 : 0 }))),
    );

    // selected outline filter
    if (map.getLayer("ils-features-selected")) {
      map.setFilter("ils-features-selected", [
        "==",
        ["get", "id"],
        s.selectedId ?? "__none__",
      ]);
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
  // parcels
  if (!map.getLayer("ils-parcels-line")) {
    map.addLayer({
      id: "ils-parcels-line",
      type: "line",
      source: SRC_PARCELS,
      paint: { "line-color": "#fbbf24", "line-width": 1.5, "line-dasharray": [3, 2] },
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
  // roads centerlines
  if (!map.getLayer("ils-roads-line")) {
    map.addLayer({
      id: "ils-roads-line",
      type: "line",
      source: SRC_ROADS,
      paint: {
        "line-color": ["case", ["==", ["get", "arterial"], 1], "#fde047", "#e2e8f0"],
        "line-width": ["case", ["==", ["get", "arterial"], 1], 3, 1.5],
        "line-dasharray": [1, 1],
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
