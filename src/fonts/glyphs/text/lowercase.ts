/**
 * Text cut, lowercase. The taller x-height body, drawn with true ellipses so
 * counters stay open at body sizes.
 */

import { ring, X0, X1 } from "../../lib/parts";
import type { GlyphFactory } from "../../lib/types";

export const LOWERCASE: Record<string, GlyphFactory> = {
  o: (s) => ({
    name: "o",
    advance: s.advance,
    contours: ring(s, X0, 0, X1 - X0, s.xHeight),
  }),
};
