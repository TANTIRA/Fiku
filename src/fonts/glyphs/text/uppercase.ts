/**
 * Text cut, uppercase. Same skeleton as the display caps with the mech detail
 * removed, for reading at body sizes.
 */

import { bar, stem, X0, X1 } from "../../lib/parts";
import type { GlyphFactory } from "../../lib/types";

export const UPPERCASE: Record<string, GlyphFactory> = {
  H: (s) => ({
    name: "H",
    advance: s.advance,
    contours: [
      stem(s, X0, 0, s.stroke, s.cap),
      stem(s, X1 - s.stroke, 0, s.stroke, s.cap),
      bar(s, X0, (s.cap - s.stroke) / 2, X1 - X0, s.stroke),
    ],
  }),
};
