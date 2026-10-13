/**
 * Geometry types for the Fuku Mech typeface.
 *
 * All coordinates are in font units on the 1000-unit em grid: the baseline is
 * `y = 0`, the cap height is `y = 700`, and `y` grows upwards.
 */

/** A point in font units. */
export type Pt = readonly [x: number, y: number];

/** A straight or cubic segment. Every contour is closed, so there is no `close` op. */
export type Seg =
  | { readonly op: "l"; readonly to: Pt }
  | { readonly op: "c"; readonly c1: Pt; readonly c2: Pt; readonly to: Pt };

/** A closed contour: a start point followed by one or more segments. */
export type Contour = {
  readonly start: Pt;
  readonly segs: readonly Seg[];
};

/** One glyph outline. `contours[0]` is the outer shape; later contours are counters. */
export type Glyph = {
  /** PostScript glyph name, unique within a master. */
  readonly name: string;
  /** Advance width in font units. */
  readonly advance: number;
  readonly contours: readonly Contour[];
};

/** The two cuts of the family. */
export type Cut = "display" | "text";

/** The two generated weights. */
export type Weight = 400 | 700;

/**
 * Per-master drawing parameters. Glyphs are authored once against a `Style`, so
 * a new weight or cut is a parameter change rather than a redraw.
 */
export type Style = {
  readonly cut: Cut;
  readonly weight: Weight;
  /** Vertical stem / horizontal bar thickness. */
  readonly stroke: number;
  /** 45 degree corner cut for chamfered corners. */
  readonly chamfer: number;
  /** Cap height. */
  readonly cap: number;
  /** x-height. */
  readonly xHeight: number;
  /** Depth below the baseline for round forms and descenders. */
  readonly descender: number;
  /** Advance for a full-width letter. */
  readonly advance: number;
  /** Advance for the space glyph. */
  readonly space: number;
  /** Advance for narrow letters such as i, l and the period. */
  readonly narrow: number;
  /** Advance for wide letters such as M and W. */
  readonly wide: number;
  /** When true, uppercase glyphs carry structural mech detail. */
  readonly detail: boolean;
};

/** A glyph factory: the skeleton of a letter, instantiated per master. */
export type GlyphFactory = (style: Style) => Glyph;

/** Metadata for one generated font binary. */
export type Master = {
  readonly cut: Cut;
  readonly weight: Weight;
  readonly family: string;
  readonly style: string;
  readonly psName: string;
  readonly fileName: string;
};
