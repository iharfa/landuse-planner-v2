/**
 * Court/pitch line markings for placed sports facilities.
 *
 * Each function returns an array of polylines in LOCAL metres, centred on the
 * pitch (x = length axis, −L/2..L/2; y = width axis, −W/2..W/2). The caller
 * rotates + projects them to lng/lat. Circles/arcs are approximated with
 * polylines. Internal dimensions follow common governing-body standards.
 */

type Line = [number, number][];

function rect(x0: number, y0: number, x1: number, y1: number): Line {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
}

function seg(x0: number, y0: number, x1: number, y1: number): Line {
  return [
    [x0, y0],
    [x1, y1],
  ];
}

function circle(cx: number, cy: number, r: number, steps = 40): Line {
  const pts: Line = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function arc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  steps = 24,
): Line {
  const pts: Line = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Return the marking polylines (local metres) for a preset id and size. */
export function pitchMarkings(id: string, L: number, W: number): Line[] {
  const hl = L / 2;
  const hw = W / 2;
  const border = rect(-hl, -hw, hl, hw);

  switch (id) {
    case "football": {
      return [
        border,
        seg(0, -hw, 0, hw),
        circle(0, 0, 9.15),
        circle(0, 0, 0.3, 10),
        rect(-hl, -20.15, -hl + 16.5, 20.15),
        rect(hl - 16.5, -20.15, hl, 20.15),
        rect(-hl, -9.16, -hl + 5.5, 9.16),
        rect(hl - 5.5, -9.16, hl, 9.16),
        arc(-hl + 11, 0, 9.15, -0.93, 0.93),
        arc(hl - 11, 0, 9.15, Math.PI - 0.93, Math.PI + 0.93),
      ];
    }
    case "futsal": {
      return [
        border,
        seg(0, -hw, 0, hw),
        circle(0, 0, 3),
        arc(-hl, 0, 6, -1.3, 1.3),
        arc(hl, 0, 6, Math.PI - 1.3, Math.PI + 1.3),
      ];
    }
    case "basketball":
    case "basketball-half": {
      const half = id === "basketball-half";
      const lines: Line[] = [border];
      if (!half) {
        lines.push(seg(0, -hw, 0, hw), circle(0, 0, 1.8));
      }
      const baskets = half ? [-1] : [-1, 1];
      for (const s of baskets) {
        const base = s * hl; // baseline x
        const dir = -s; // toward centre
        lines.push(rect(base, -2.45, base + dir * 5.8, 2.45)); // key
        lines.push(circle(base + dir * 5.8, 0, 1.8)); // free-throw circle
        const hoop = base + dir * 1.575;
        lines.push(
          s < 0
            ? arc(hoop, 0, 6.75, -1.19, 1.19)
            : arc(hoop, 0, 6.75, Math.PI - 1.19, Math.PI + 1.19),
        );
      }
      return lines;
    }
    case "netball": {
      const third = L / 3;
      return [
        border,
        circle(0, 0, 0.45),
        seg(-hl + third, -hw, -hl + third, hw),
        seg(hl - third, -hw, hl - third, hw),
        arc(-hl, 0, 4.9, -Math.PI / 2, Math.PI / 2),
        arc(hl, 0, 4.9, Math.PI / 2, (3 * Math.PI) / 2),
      ];
    }
    case "tennis": {
      const singles = hw - 1.37; // singles sideline offset
      return [
        border,
        seg(-hl, singles, hl, singles),
        seg(-hl, -singles, hl, -singles),
        seg(0, -hw, 0, hw), // net
        seg(-6.4, -singles, -6.4, singles),
        seg(6.4, -singles, 6.4, singles),
        seg(-6.4, 0, 6.4, 0), // centre service line
      ];
    }
    case "volleyball": {
      return [
        border,
        seg(0, -hw, 0, hw),
        seg(-3, -hw, -3, hw),
        seg(3, -hw, 3, hw),
      ];
    }
    case "badminton": {
      const singles = hw - 0.46;
      const longDoubles = hl - 0.76;
      return [
        border,
        seg(0, -hw, 0, hw), // net
        seg(-hl, singles, hl, singles),
        seg(-hl, -singles, hl, -singles),
        seg(-1.98, -hw, -1.98, hw), // short service lines
        seg(1.98, -hw, 1.98, hw),
        seg(-longDoubles, -hw, -longDoubles, hw), // long service (doubles)
        seg(longDoubles, -hw, longDoubles, hw),
        seg(-1.98, 0, -hl, 0), // centre lines
        seg(1.98, 0, hl, 0),
      ];
    }
    default:
      return [border];
  }
}
