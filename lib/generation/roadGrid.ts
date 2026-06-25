import type { Feature, Polygon, LineString, Position } from "geojson";
import type { BoundaryFeature, RoadFeature } from "@/lib/types";
import { turf, lineLength, makeId } from "@/lib/geometry/turfHelpers";
import { computeRoadWidth } from "@/lib/generation/constants";

/**
 * Generate a connected grid of road centerlines that fills the boundary.
 *
 * Two perpendicular families of parallel lines are laid across the boundary's
 * bounding box at the requested angle and spacing, then clipped to the
 * boundary. The lines cross each other, so the result is fully connected and
 * every block it forms has road frontage on all sides. The two lines nearest
 * the centre become arterials (commercial frontage); the rest are branches.
 */
export function generateRoadGrid(
  boundary: BoundaryFeature,
  spacingM: number,
  angleDeg: number,
): RoadFeature[] {
  const poly = turf.polygon(boundary.geometry.coordinates);
  const bbox = turf.bbox(poly);
  const center = turf.center(poly).geometry.coordinates as Position;

  // half-diagonal of the bbox, with margin, so lines fully span the boundary
  const corner = turf.point([bbox[0], bbox[1]]);
  const R =
    (turf.distance(corner, turf.point([bbox[2], bbox[3]]), { units: "meters" }) /
      2) *
    1.25;

  const spacing = Math.max(40, spacingM);
  const lines: { line: Feature<LineString>; offset: number; bearing: number }[] = [];

  for (const bearing of [angleDeg, angleDeg + 90]) {
    const perp = bearing + 90;
    for (let o = -R; o <= R; o += spacing) {
      const base = turf.destination(turf.point(center), o, perp, {
        units: "meters",
      });
      const p1 = turf.destination(base, R, bearing, { units: "meters" });
      const p2 = turf.destination(base, -R, bearing, { units: "meters" });
      lines.push({
        line: turf.lineString([
          p1.geometry.coordinates,
          p2.geometry.coordinates,
        ]),
        offset: Math.abs(o),
        bearing,
      });
    }
  }

  // smallest |offset| per bearing → arterial avenue
  const minOffsetByBearing = new Map<number, number>();
  for (const l of lines) {
    const cur = minOffsetByBearing.get(l.bearing);
    if (cur === undefined || l.offset < cur)
      minOffsetByBearing.set(l.bearing, l.offset);
  }

  const roads: RoadFeature[] = [];
  for (const l of lines) {
    for (const seg of clipLineToPolygon(l.line, poly)) {
      const len = lineLength(seg.geometry);
      if (len < 12) continue;
      const arterial = l.offset === minOffsetByBearing.get(l.bearing);
      const roadClass = arterial ? "main" : "service";
      const lanes = arterial ? 4 : 2;
      roads.push({
        id: makeId("road"),
        geometry: seg.geometry,
        lengthM: len,
        roadClass,
        lanes,
        widthM: computeRoadWidth(roadClass, lanes),
        arterial,
      });
    }
  }
  return roads;
}

/** Split a line by a polygon boundary and keep only the inside pieces. */
function clipLineToPolygon(
  line: Feature<LineString>,
  poly: Feature<Polygon>,
): Feature<LineString>[] {
  try {
    const split = turf.lineSplit(line, poly);
    const inside: Feature<LineString>[] = [];
    for (const piece of split.features) {
      const coords = piece.geometry.coordinates;
      const mid = coords[Math.floor(coords.length / 2)];
      // use the midpoint of the segment to decide if it lies inside the polygon
      const midPoint = turf.midpoint(
        turf.point(coords[0]),
        turf.point(coords[coords.length - 1]),
      );
      if (
        turf.booleanPointInPolygon(midPoint, poly) ||
        turf.booleanPointInPolygon(turf.point(mid), poly)
      ) {
        inside.push(piece as Feature<LineString>);
      }
    }
    return inside;
  } catch {
    return [];
  }
}
