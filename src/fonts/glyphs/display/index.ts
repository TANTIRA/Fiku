/** Assembles the display cut from its parts. */
import type { GlyphFactory } from "../../lib/types";
import { DIGITS } from "./digits";
import { LOWERCASE } from "./lowercase";
import { PUNCTUATION } from "./punctuation";
import { UPPERCASE } from "./uppercase";

export const DISPLAY: Record<string, GlyphFactory> = {
  ...UPPERCASE,
  ...LOWERCASE,
  ...DIGITS,
  ...PUNCTUATION,
};
