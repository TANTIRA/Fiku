/** Text cut, punctuation and the non-ASCII glyphs the app renders. */
import type { GlyphFactory } from "../../lib/types";

export const PUNCTUATION: Record<string, GlyphFactory> = {
  space: (s) => ({ name: "space", advance: s.space, contours: [] }),
};
