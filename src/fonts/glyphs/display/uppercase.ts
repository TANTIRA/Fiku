/**
 * Display cut, uppercase. Each cap carries at least one structural mech detail -
 * a terminal vent or a clipped corner - so the caps read as a set.
 */

import { bar, stem, X0, X1 } from "../../lib/parts";
import type { GlyphFactory } from "../../lib/types";

/** Cap height member thickness, shared by the uppercase skeletons. */
export const UPPERCASE: Record<string, GlyphFactory> = {
  H: (s) => ({
    name: "H",
    advance: s.advance,
    contours: [
      stem(s, X0, 0, s.stroke, s.cap, { vent: true }),
      stem(s, X1 - s.stroke, 0, s.stroke, s.cap, { vent: true }),
      bar(s, X0, (s.cap - s.stroke) / 2, X1 - X0, s.stroke, { vents: 3 }),
    ],
  }),
};
