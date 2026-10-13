/**
 * Letter-level vocabulary built on the mech primitives. Glyph modules work
 * through these so the same skeleton produces a display cut and a text cut.
 */

import { blade, ellipse, octagon, plate, type Chamfer, type Slot } from "./mech";
import type { Contour, Style } from "./types";

/** Standard left sidebearing for full-width letters. */
export const LS = 60;

/** Standard ink width of a full-width letter in its 586-unit advance. */
export const INK = 465;

/** Left edge of the standard ink box. */
export const X0 = LS;

/** Right edge of the standard ink box. */
export const X1 = LS + INK;

/** Ink box of a narrow letter such as i, l or the period. */
export function narrowBox(s: Style) {
  const x0 = (s.narrow - s.stroke) / 2;
  return { x0, x1: x0 + s.stroke };
}

/** Ink box of a wide letter such as M or W. */
export function wideBox(s: Style) {
  return { x0: LS, x1: s.wide - LS };
}

/** Corner cut for the round forms: hard on the display cut, none on the text cut. */
export function roundCut(w: number, h: number): number {
  return Math.min(w, h) * 0.32;
}

/**
 * A round form. The display cut uses an octagon - a squarish circle that reads
 * as machined - while the text cut uses a true ellipse for open counters.
 */
export function round(s: Style, x: number, y: number, w: number, h: number): Contour {
  return s.cut === "display"
    ? octagon(x, y, w, h, roundCut(w, h))
    : ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
}

/** A round form with its counter: the bowl of o, O and 0. */
export function ring(s: Style, x: number, y: number, w: number, h: number): Contour[] {
  return [
    round(s, x, y, w, h),
    round(s, x + s.stroke, y + s.stroke, w - 2 * s.stroke, h - 2 * s.stroke),
  ];
}

/** Options shared by the member helpers. */
export type MemberOpts = {
  /** Cut a vent into the terminal. Display cut only; ignored elsewhere. */
  readonly vent?: boolean;
  /** Vents along the length, for wide members. */
  readonly vents?: number;
  /** Per-corner chamfer override. */
  readonly chamfer?: Chamfer;
  /** Extra slots, appended after any generated vent. */
  readonly slots?: readonly Slot[];
};

/** A vertical member with chamfered ends and, on the display cut, a terminal vent. */
export function stem(
  s: Style,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: MemberOpts = {},
): Contour {
  const slots: Slot[] = [...(opts.slots ?? [])];
  if (s.detail && opts.vent) {
    slots.push({
      edge: "top",
      at: w * 0.32,
      width: w * 0.36,
      depth: Math.min(h * 0.22, s.stroke * 1.3),
    });
  }
  return plate(x, y, w, h, { chamfer: opts.chamfer ?? s.chamfer, slots });
}

/** A horizontal member, optionally vented along its lower edge. */
export function bar(
  s: Style,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: MemberOpts = {},
): Contour {
  const slots: Slot[] = [...(opts.slots ?? [])];
  const n = s.detail ? (opts.vents ?? (opts.vent ? 2 : 0)) : 0;
  if (n > 0) {
    const pitch = w / (n + 1);
    const slotW = Math.min(pitch * 0.42, h * 0.9);
    for (let i = 1; i <= n; i++) {
      slots.push({ edge: "bottom", at: i * pitch - slotW / 2, width: slotW, depth: h * 0.42 });
    }
  }
  return plate(x, y, w, h, { chamfer: opts.chamfer ?? s.chamfer, slots });
}

/** A diagonal member. The display cut slants its far end for the mech look. */
export function diag(
  s: Style,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t = s.stroke,
): Contour {
  return blade(x1, y1, x2, y2, t, { cap: s.detail });
}
