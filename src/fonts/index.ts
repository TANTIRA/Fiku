/**
 * The Fuku Mech typeface, assembled from authored glyph data.
 *
 * Glyphs are defined once per cut against a `Style`, so a weight or a cut is a
 * parameter change rather than a redraw.
 */

import { DISPLAY } from "./glyphs/display";
import { TEXT } from "./glyphs/text";
import { COVERAGE, MASTERS, METRICS, UPEM, styleFor } from "./lib/metrics";
import type { Cut, Glyph, GlyphFactory, Weight } from "./lib/types";

const CUTS: Record<Cut, Record<string, GlyphFactory>> = { display: DISPLAY, text: TEXT };

/**
 * Instantiates every glyph of one master, in coverage order.
 *
 * @param cut - Which cut of the family to build.
 * @param weight - Which weight to build.
 * @param only - Optional subset of glyph names, for fast iteration.
 * @throws If a covered glyph has not been authored yet.
 */
export function buildMaster(cut: Cut, weight: Weight, only?: readonly string[]): Glyph[] {
  const style = styleFor(cut, weight);
  const set = CUTS[cut];
  return COVERAGE.filter(([, name]) => !only || only.includes(name)).map(([, name]) => {
    const factory = set[name];
    if (!factory) throw new Error(`${cut}: no glyph authored for "${name}"`);
    return factory(style);
  });
}

/** Glyph names that still need authoring for a cut. */
export function missingGlyphs(cut: Cut): string[] {
  const set = CUTS[cut];
  return COVERAGE.filter(([, name]) => !set[name]).map(([, name]) => name);
}

export { COVERAGE, MASTERS, METRICS, UPEM, styleFor };
export type { Cut, Glyph, Weight };
