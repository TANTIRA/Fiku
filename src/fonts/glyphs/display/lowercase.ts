/**
 * Display cut, lowercase. The same skeletons as the caps, undetailed, with the
 * shorter x-height body.
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
