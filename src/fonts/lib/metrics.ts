/**
 * The metrics contract for the Fuku Mech family.
 *
 * These numbers are matched to the fonts this family replaces so the swap is
 * size-neutral: Pixelify Sans (display) reported upem 1000, cap 700, x-height
 * 450, hhea 920/-280, space 200, default advance 586; DM Sans (text) reported
 * x-height 504, hhea 992/-310, space 266. Changing any value here will move
 * text on screen.
 */

import type { Cut, Style } from "./types";

/** Em size shared by every master. */
export const UPEM = 1000;

/** Codepoints from printable ASCII, mapped to PostScript glyph names. */
export const ASCII_NAMES: ReadonlyArray<readonly [number, string]> = [
  [0x20, "space"], [0x21, "exclam"], [0x22, "quotedbl"], [0x23, "numbersign"],
  [0x24, "dollar"], [0x25, "percent"], [0x26, "ampersand"], [0x27, "quotesingle"],
  [0x28, "parenleft"], [0x29, "parenright"], [0x2a, "asterisk"], [0x2b, "plus"],
  [0x2c, "comma"], [0x2d, "hyphen"], [0x2e, "period"], [0x2f, "slash"],
  [0x30, "zero"], [0x31, "one"], [0x32, "two"], [0x33, "three"], [0x34, "four"],
  [0x35, "five"], [0x36, "six"], [0x37, "seven"], [0x38, "eight"], [0x39, "nine"],
  [0x3a, "colon"], [0x3b, "semicolon"], [0x3c, "less"], [0x3d, "equal"],
  [0x3e, "greater"], [0x3f, "question"], [0x40, "at"],
  [0x41, "A"], [0x42, "B"], [0x43, "C"], [0x44, "D"], [0x45, "E"], [0x46, "F"],
  [0x47, "G"], [0x48, "H"], [0x49, "I"], [0x4a, "J"], [0x4b, "K"], [0x4c, "L"],
  [0x4d, "M"], [0x4e, "N"], [0x4f, "O"], [0x50, "P"], [0x51, "Q"], [0x52, "R"],
  [0x53, "S"], [0x54, "T"], [0x55, "U"], [0x56, "V"], [0x57, "W"], [0x58, "X"],
  [0x59, "Y"], [0x5a, "Z"],
  [0x5b, "bracketleft"], [0x5c, "backslash"], [0x5d, "bracketright"],
  [0x5e, "asciicircum"], [0x5f, "underscore"], [0x60, "grave"],
  [0x61, "a"], [0x62, "b"], [0x63, "c"], [0x64, "d"], [0x65, "e"], [0x66, "f"],
  [0x67, "g"], [0x68, "h"], [0x69, "i"], [0x6a, "j"], [0x6b, "k"], [0x6c, "l"],
  [0x6d, "m"], [0x6e, "n"], [0x6f, "o"], [0x70, "p"], [0x71, "q"], [0x72, "r"],
  [0x73, "s"], [0x74, "t"], [0x75, "u"], [0x76, "v"], [0x77, "w"], [0x78, "x"],
  [0x79, "y"], [0x7a, "z"],
  [0x7b, "braceleft"], [0x7c, "bar"], [0x7d, "braceright"], [0x7e, "asciitilde"],
];

/**
 * The non-ASCII characters the app actually renders, extracted from `src/`.
 * `U+2212` matters most: it is the sign on every amount, so a missing glyph
 * would drop the display face mid-number.
 */
export const EXTRA_GLYPHS: ReadonlyArray<readonly [number, string, string]> = [
  [0x00b7, "periodcentered", "·"],
  [0x00d7, "multiply", "×"],
  [0x2014, "emdash", "—"],
  [0x2022, "bullet", "•"],
  [0x2026, "ellipsis", "…"],
  [0x2192, "arrowright", "→"],
  [0x2212, "minus", "−"],
  [0x2264, "lessequal", "≤"],
  [0x25b6, "triangleright", "▶"],
  [0x25c0, "triangleleft", "◀"],
  [0x2713, "checkmark", "✓"],
];

/** Every codepoint the family must cover. */
export const COVERAGE: ReadonlyArray<readonly [number, string]> = [
  ...ASCII_NAMES,
  ...EXTRA_GLYPHS.map(([cp, name]) => [cp, name] as const),
];

/** Vertical and horizontal metrics per cut. */
export const METRICS = {
  display: {
    cap: 700,
    xHeight: 450,
    ascender: 700,
    descender: -200,
    hheaAscent: 920,
    hheaDescent: -280,
    winAscent: 922,
    winDescent: 289,
    space: 200,
    defaultAdvance: 586,
    narrowAdvance: 222,
    wideAdvance: 767,
    stroke: { 400: 96, 700: 152 },
    chamfer: { 400: 48, 700: 62 },
    underlinePosition: -75,
    underlineThickness: 50,
    detail: true,
  },
  text: {
    cap: 700,
    xHeight: 504,
    ascender: 700,
    descender: -310,
    hheaAscent: 992,
    hheaDescent: -310,
    winAscent: 1012,
    winDescent: 310,
    space: 266,
    defaultAdvance: 586,
    narrowAdvance: 240,
    wideAdvance: 700,
    stroke: { 400: 76, 700: 130 },
    chamfer: { 400: 0, 700: 0 },
    underlinePosition: -100,
    underlineThickness: 50,
    detail: false,
  },
} as const satisfies Record<Cut, Record<string, unknown>>;

/** Builds the drawing parameters for one master. */
export function styleFor(cut: Cut, weight: 400 | 700): Style {
  const m = METRICS[cut];
  return {
    cut,
    weight,
    stroke: m.stroke[weight],
    chamfer: m.chamfer[weight],
    cap: m.cap,
    xHeight: m.xHeight,
    descender: m.descender,
    advance: m.defaultAdvance,
    space: m.space,
    narrow: m.narrowAdvance,
    wide: m.wideAdvance,
    detail: m.detail,
  };
}

/** Family and PostScript names for the four generated binaries. */
export const MASTERS = [
  { cut: "display", weight: 400, family: "Fuku Mech Display", style: "Regular", psName: "FukuMechDisplay-Regular", fileName: "fuku-mech-display-regular" },
  { cut: "display", weight: 700, family: "Fuku Mech Display", style: "Bold", psName: "FukuMechDisplay-Bold", fileName: "fuku-mech-display-bold" },
  { cut: "text", weight: 400, family: "Fuku Mech Text", style: "Regular", psName: "FukuMechText-Regular", fileName: "fuku-mech-text-regular" },
  { cut: "text", weight: 700, family: "Fuku Mech Text", style: "Bold", psName: "FukuMechText-Bold", fileName: "fuku-mech-text-bold" },
] as const;
