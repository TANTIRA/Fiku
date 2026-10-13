/** Assembles the text cut from its parts. */
import type { GlyphFactory } from "../../lib/types";
import { DIGITS } from "./digits";
import { LOWERCASE } from "./lowercase";
import { PUNCTUATION } from "./punctuation";
import { UPPERCASE } from "./uppercase";

export const TEXT: Record<string, GlyphFactory> = {
  ...UPPERCASE,
  ...LOWERCASE,
  ...DIGITS,
  ...PUNCTUATION,
};
