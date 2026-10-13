/**
 * Geometry helpers used by the generator to prepare authored contours for the
 * font compiler: flattening curves, measuring, and normalising contour winding.
 */

import { reverse } from "./mech";
import type { Contour, Glyph, Pt } from "./types";

/** Samples a contour into a polygon, so curves can be measured like straight edges. */
export function flatten(c: Contour, steps = 8): Pt[] {
  const pts: Pt[] = [c.start];
  let from = c.start;
  for (const s of c.segs) {
    if (s.op === "l") {
      pts.push(s.to);
    } else {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const d = 3 * u * t * t;
        const e = t * t * t;
        pts.push([
          a * from[0] + b * s.c1[0] + d * s.c2[0] + e * s.to[0],
          a * from[1] + b * s.c1[1] + d * s.c2[1] + e * s.to[1],
        ]);
      }
    }
    from = s.to;
  }
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) pts.pop();
  }
  return pts;
}

/** Shoelace area. Positive is counter-clockwise in the y-up font space. */
export function signedArea(poly: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/** Ray-casting containment test. */
export function pointInPolygon(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Integer bounds of a glyph's ink, or null when it has none. */
export function bounds(contours: readonly Contour[]) {
  const pts = contours.flatMap((c) => flatten(c));
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    xMin: Math.floor(Math.min(...xs)),
    yMin: Math.floor(Math.min(...ys)),
    xMax: Math.ceil(Math.max(...xs)),
    yMax: Math.ceil(Math.max(...ys)),
  };
}

/**
 * Forces every contour to wind the way TrueType expects: outer contours
 * clockwise, counters counter-clockwise. Nesting is decided by full
 * containment, not by a shared test point, so overlapping strokes that union
 * into one letter keep the same direction and do not punch holes in each other.
 */
export function normalizeWinding(contours: readonly Contour[]): Contour[] {
  const polys = contours.map((c) => flatten(c));
  const areas = polys.map(signedArea);
  const depth = polys.map(() => 0);

  for (let a = 0; a < polys.length; a++) {
    for (let b = 0; b < polys.length; b++) {
      if (a === b) continue;
      if (Math.abs(areas[a]) >= Math.abs(areas[b])) continue;
      if (polys[a].every((p) => pointInPolygon(p, polys[b]))) depth[a]++;
    }
  }

  return contours.map((c, i) => {
    const wantClockwise = depth[i] % 2 === 0;
    return areas[i] < 0 === wantClockwise ? c : reverse(c);
  });
}

/** Asserts authored data is structurally sound before it reaches the compiler. */
export function validate(glyph: Glyph, expectedAdvanceFloor: number): string[] {
  const problems: string[] = [];
  if (!glyph.name) problems.push("missing name");
  if (glyph.contours.length === 0) return problems;
  for (const [i, c] of glyph.contours.entries()) {
    if (c.segs.length === 0) problems.push(`contour ${i} has no segments`);
    const b = bounds([c]);
    if (!b) problems.push(`contour ${i} is empty`);
  }
  const b = bounds(glyph.contours);
  if (b) {
    if (b.xMin < 0) problems.push(`ink starts left of the origin (xMin ${b.xMin})`);
    if (b.xMax > glyph.advance) problems.push(`ink overflows the advance (xMax ${b.xMax} > ${glyph.advance})`);
    if (b.yMin < -400) problems.push(`ink descends too far (yMin ${b.yMin})`);
    if (b.yMax > 900) problems.push(`ink ascends too far (yMax ${b.yMax})`);
    if (b.xMax - b.xMin > glyph.advance - expectedAdvanceFloor) {
      problems.push(`sidebearings collapsed (ink ${b.xMax - b.xMin} in advance ${glyph.advance})`);
    }
  }
  return problems;
}
