# Island Layout Studio

A futuristic, browser-based **urban island planning studio** for Maldives-style
land-use planning. Draw a planning boundary, sketch internal parcels and road
centerlines, then generate a complete rule-based land-use layout — residential
and commercial plots, industrial areas, schools, mosques, utilities, recreation,
green space and roads — all inside the browser.

> This is an MVP. It uses rule-based geometry to produce believable planning
> concepts, not survey drawings.

## Features

- 🛰️ **Satellite basemap by default** (Esri World Imagery) with an OSM fallback —
  no API keys, no backend, no login.
- ✏️ **Drawing tools**: main island boundary, internal parcels, and road
  centerlines (powered by MapLibre GL + Terra Draw).
- ⚙️ **Rule-based layout generator**: builds buildable land, buffers roads into
  road polygons, generates road-fronting plots, allocates land use by your
  sliders, and places population-scaled facilities.
- 🧮 **Population-scaled facilities**: schools, mosques, recreation and utility
  reserves derived from the population served (editable constants).
- 🎛️ **Planning controls**: residential / commercial / industrial / green
  percentages, plot sizes, road width, density, walkability, and provision
  toggles.
- 🧩 **Editing**: select any feature, change its land use, lock/unlock, delete,
  and **merge** adjacent features. (Split is reserved for the next version.)
- 🔒 **Lock & regenerate**: lock zones you like, then regenerate only the
  unlocked areas.
- 💾 **Scenarios in localStorage**: save, load, duplicate, rename, delete.
- 🖼️ **PNG export** of the map and overlays (`html2canvas`).
- 📊 **Scenario summary** with areas, plot counts, estimated population, and
  non-blocking planning warnings.
- 🟦 Clean **legend**, layer toggles, scale-aware view, and live cursor
  coordinates over a dark glass UI.

Other exports (GeoJSON, CSV, DXF, PDF, Shapefile, Excel) appear as disabled
buttons labelled *“Coming in next version.”*

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **MapLibre GL JS** for the map, **Terra Draw** for drawing/editing
- **Turf.js** for all geometry (area, length, buffer, clip, intersect)
- **Zustand** for state
- **Tailwind CSS** for the UI, **Lucide React** for icons
- **html2canvas** for PNG export

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Deploy to Vercel

This is a frontend-only Next.js app with no environment variables.

1. Push this repository to GitHub.
2. In Vercel, **New Project → Import** the repo.
3. Framework preset: **Next.js** (defaults are correct). No env vars needed.
4. Deploy.

## Replacing the basemap

Basemaps live in [`lib/map/basemaps.ts`](lib/map/basemaps.ts). To use MapTiler,
Google, or a private tile source, replace the `tiles` URL (and `attribution`)
for the `satellite` style. The rest of the app is basemap-agnostic.

## Editable planning rules

All facility and sizing assumptions are constants in
[`lib/generation/constants.ts`](lib/generation/constants.ts):

- Mosque: 1 per 1,500 residents (min 1 if enabled)
- School: 1 per 3,000 residents (min 1 if enabled)
- Recreation: 1 per 2,000 residents (min 1 if enabled)
- Utilities: 2–5% of site area by density
- Green space: driven by the green-space slider

## Manual test checklist

1. Draw an island boundary.
2. Draw an internal parcel.
3. Draw one or more roads (first road = main arterial).
4. Click **Generate layout**.
5. Select a generated feature and change its land use.
6. Lock a plot.
7. Click **Regenerate unlocked** — the locked plot is preserved.
8. **Save** the scenario.
9. Reload the page (or **New**) and **Load** the scenario.
10. **Export PNG**.
11. Run `npm run build` — it should succeed with no TypeScript errors.

## Known limitations

- This MVP uses rule-based geometry.
- Outputs are planning concepts, not survey drawings.
- Generation quality depends on road sketch quality and boundary shape.
- Advanced CAD and GIS exports are reserved for the next version.

## Next version features

- Real polygon split tool and richer vertex editing.
- GeoJSON / CSV / DXF / PDF / Shapefile / Excel export.
- Smarter road hierarchy and intersection-aware commercial zoning.
- Walkability isochrones and per-facility catchment checks.
- Optional MapTiler / Google / private tile sources.
