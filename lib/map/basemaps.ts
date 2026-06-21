import type { StyleSpecification } from "maplibre-gl";

export type BasemapId = "satellite" | "osm";

/**
 * Free, no-key raster basemaps. To swap in MapTiler / Google / a private
 * source later, replace the `tiles` URL (and attribution) below.
 */
export const BASEMAPS: Record<
  BasemapId,
  { label: string; style: StyleSpecification }
> = {
  satellite: {
    label: "Satellite",
    style: {
      version: 8,
      glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      sources: {
        "esri-imagery": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution:
            "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxzoom: 19,
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#0b1220" } },
        { id: "esri-imagery", type: "raster", source: "esri-imagery" },
      ],
    },
  },
  osm: {
    label: "OSM",
    style: {
      version: 8,
      glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
          maxzoom: 19,
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#0b1220" } },
        { id: "osm", type: "raster", source: "osm" },
      ],
    },
  },
};

/** Malé / Hulhumalé area — a sensible Maldives default. */
export const MALDIVES_CENTER: [number, number] = [73.5361, 4.2105];
export const DEFAULT_ZOOM = 13.5;
