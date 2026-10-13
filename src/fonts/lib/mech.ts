/**
 * The mech vocabulary: parametric primitives that every glyph in the family is
 * assembled from. Working through these instead of raw coordinates is what
 * keeps 106 glyphs consistent, and what makes a new weight or cut a parameter
 * change rather than a redraw.
 *
 * Coordinates are font units on the 1000-unit em: baseline `y = 0`, cap `y = 700`.
 * Contour direction is normalised later by the generator, so authoring order
 * never matters.
 */

import type { Contour, Pt, Seg } from "./types";

/** Point constructor. */
export const P = (x: number, y: number): Pt => [x, y];

/** A straight segment. */
export const line = (to: Pt): Seg => ({ op: "l", to });

/** A cubic segment. */
export const curve = (c1: Pt, c2: Pt, to: Pt): Seg => ({ op: "c", c1, c2, to });

/** A closed contour from a polygon of points. */
export function poly(points: readonly Pt[]): Contour {
  const [start, ...rest] = points;
  return { start, segs: rest.map(line) };
}

/** A closed contour from a start point and explicit segments. */
export function path(start: Pt, ...segs: Seg[]): Contour {
  return { start, segs };
}

/** Per-corner cut amount, or a single amount for all four corners. */
export type Chamfer = number | readonly [tl: number, tr: number, br: number, bl: number];

/** A rectangular slot cut into an edge. `at` is measured from the edge's start. */
export type Slot = {
  readonly edge: "top" | "bottom";
  readonly at: number;
  readonly width: number;
  readonly depth: number;
};

/** Options for `plate`. */
export type PlateOpts = {
  readonly chamfer?: Chamfer;
  readonly slots?: readonly Slot[];
};

const spread = (c: Chamfer): [number, number, number, number] =>
  typeof c === "number" ? [c, c, c, c] : [c[0], c[1], c[2], c[3]];

/**
 * An armor plate: a rectangle with 45 degree corner cuts and optional slots
 * bitten out of the top or bottom edge. This is the workhorse of the family -
 * stems, bars, bowls and panels are all plates.
 */
export function plate(x: number, y: number, w: number, h: number, opts: PlateOpts = {}): Contour {
  const [tl, tr, br, bl] = spread(opts.chamfer ?? 0);
  const slots = opts.slots ?? [];
  const x1 = x + w;
  const y1 = y + h;
  const pts: Pt[] = [];

  pts.push(P(x + tl, y1));
  for (const s of slots.filter((s) => s.edge === "top").sort((a, b) => a.at - b.at)) {
    const a = x + s.at;
    const b = a + s.width;
    pts.push(P(a, y1), P(a, y1 - s.depth), P(b, y1 - s.depth), P(b, y1));
  }
  pts.push(P(x1 - tr, y1));
  if (tr) pts.push(P(x1, y1 - tr));

  pts.push(P(x1, y + br));
  if (br) pts.push(P(x1 - br, y));

  for (const s of slots.filter((s) => s.edge === "bottom").sort((a, b) => b.at - a.at)) {
    const b = x1 - s.at;
    const a = b - s.width;
    pts.push(P(b, y), P(b, y + s.depth), P(a, y + s.depth), P(a, y));
  }
  pts.push(P(x + bl, y));
  if (bl) pts.push(P(x, y + bl));

  pts.push(P(x, y1 - tl));
  return poly(pts);
}

/** A squarish round form: a plate whose corners are cut hard enough to read as a circle. */
export function octagon(x: number, y: number, w: number, h: number, cut: number): Contour {
  return plate(x, y, w, h, { chamfer: cut });
}

/**
 * A diagonal member of constant perpendicular thickness, for A K M N V W X Y Z
 * and their lowercase relatives. `cap` slants the far end at 45 degrees for the
 * mech look.
 */
export function blade(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
  opts: { cap?: boolean } = {},
): Contour {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const half = t / 2;

  const a1 = P(x1 + nx * half, y1 + ny * half);
  const b1 = P(x1 - nx * half, y1 - ny * half);
  const a2 = P(x2 + nx * half, y2 + ny * half);
  const b2 = P(x2 - nx * half, y2 - ny * half);

  if (!opts.cap) return poly([a1, a2, b2, b1]);
  const bx = x2 - ux * t;
  const by = y2 - uy * t;
  return poly([a1, a2, P(bx - nx * half, by - ny * half), P(bx + nx * half, by + ny * half), b1]);
}

/** The point on an ellipse at `angle` degrees. */
export function arcStart(cx: number, cy: number, rx: number, ry: number, angle: number): Pt {
  const a = (angle * Math.PI) / 180;
  return P(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
}

/**
 * Cubic segments approximating an elliptical arc. Angles are degrees, measured
 * counter-clockwise from the positive x axis. The arc is split so no single
 * cubic spans more than 90 degrees.
 */
export function arcSegs(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
): Seg[] {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90));
  const segs: Seg[] = [];
  for (let i = 0; i < steps; i++) {
    const s = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    const e = ((a0 + ((a1 - a0) * (i + 1)) / steps) * Math.PI) / 180;
    const alpha = (4 / 3) * Math.tan((e - s) / 4);
    const p0 = P(cx + rx * Math.cos(s), cy + ry * Math.sin(s));
    const p1 = P(cx + rx * Math.cos(e), cy + ry * Math.sin(e));
    segs.push(
      curve(
        P(p0[0] - alpha * rx * Math.sin(s), p0[1] + alpha * ry * Math.cos(s)),
        P(p1[0] + alpha * rx * Math.sin(e), p1[1] - alpha * ry * Math.cos(e)),
        p1,
      ),
    );
  }
  return segs;
}

/** A full ellipse as a closed contour. */
export function ellipse(cx: number, cy: number, rx: number, ry: number): Contour {
  return path(P(cx + rx, cy), ...arcSegs(cx, cy, rx, ry, 0, 360));
}

/** A closed contour built from an arc plus a chord back to the start. */
export function arcShape(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
): Contour {
  return path(arcStart(cx, cy, rx, ry, a0), ...arcSegs(cx, cy, rx, ry, a0, a1));
}

/** Moves a contour. */
export function translate(c: Contour, dx: number, dy: number): Contour {
  const mv = (p: Pt): Pt => P(p[0] + dx, p[1] + dy);
  return {
    start: mv(c.start),
    segs: c.segs.map((s) =>
      s.op === "l"
        ? { op: "l" as const, to: mv(s.to) }
        : { op: "c" as const, c1: mv(s.c1), c2: mv(s.c2), to: mv(s.to) },
    ),
  };
}

/**
 * Flips a contour's winding direction. Cubic control points swap roles, so the
 * shape is unchanged and only the traversal direction differs.
 */
export function reverse(c: Contour): Contour {
  const nodes: { p: Pt; in?: Pt; out?: Pt }[] = [{ p: c.start }];
  for (const s of c.segs) {
    if (s.op === "c") nodes[nodes.length - 1].out = s.c1;
    const node: { p: Pt; in?: Pt; out?: Pt } = { p: s.to };
    if (s.op === "c") node.in = s.c2;
    nodes.push(node);
  }
  const segs: Seg[] = [];
  for (let j = nodes.length - 1; j >= 1; j--) {
    const from = nodes[j];
    const to = nodes[j - 1];
    segs.push(from.in && to.out ? curve(from.in, to.out, to.p) : line(to.p));
  }
  return { start: nodes[nodes.length - 1].p, segs };
}

/** Mirrors a contour about a vertical axis at `x`. Winding flips; the generator normalises it. */
export function mirrorX(c: Contour, x: number): Contour {
  const mv = (p: Pt): Pt => P(2 * x - p[0], p[1]);
  return {
    start: mv(c.start),
    segs: c.segs.map((s) =>
      s.op === "l"
        ? { op: "l" as const, to: mv(s.to) }
        : { op: "c" as const, c1: mv(s.c1), c2: mv(s.c2), to: mv(s.to) },
    ),
  };
}
