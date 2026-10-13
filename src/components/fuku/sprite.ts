// Fuku 福 — an 8-bit chibi mecha critter with a V-fin and armor plates. 16×16 pixel grid.

export type Mood = "idle" | "blink" | "happy" | "thinking" | "worried" | "sleepy";

export const PALETTE = {
  o: "#1c2230", // outline
  w: "#f4f6f9", // armor white
  W: "#c3ccda", // armor white, shaded
  b: "#2f6fd0", // armor blue
  B: "#1e4a95", // armor blue, shaded
  r: "#e04444", // red trim
  R: "#a82626", // red trim, shaded
  y: "#f6c344", // V-fin / cockpit
  Y: "#c99a1e", // yellow, shaded
  g: "#8ef07a", // eye glow
  e: "#1c2230", // eyes, shut
  p: "#ff8fa3", // blush
  m: "#2b3444", // face mask / vent
  d: "#6cc4ff", // sweat drop
  z: "#9aa4b2", // zzz
} as const;

export type Color = keyof typeof PALETTE;

// Body without a face. '.' is transparent.
const BODY = [
  "....y......y....",
  ".....y....y.....",
  "......y..y......",
  "..oooooooooooo..",
  "..owwwwrrwwwWo..",
  "..owwwwwwwwwWo..",
  "..owwwwwwwwwWo..",
  "..owwwwwwwwwWo..",
  "....oooooooo....",
  ".obbbwwwwwWbbbo.",
  ".obbowyyYYWobbo.",
  ".obbowwwwwWobbo.",
  "...owrrrrrRwo...",
  "...obbo..obbo...",
  "...owWo..owWo...",
  "...obBo..obBo...",
];

type Pixel = [x: number, y: number, c: Color];

const blush: Pixel[] = [
  [4, 6, "p"],
  [11, 6, "p"],
];

// Lower-face mask with a vent gap; every mood wears it.
const mask: Pixel[] = [
  [6, 6, "m"], [7, 6, "m"], [8, 6, "m"], [9, 6, "m"],
  [5, 7, "m"], [6, 7, "m"], [9, 7, "m"], [10, 7, "m"],
];

const FACES: Record<Mood, Pixel[]> = {
  idle: [
    [5, 5, "g"], [6, 5, "g"], [9, 5, "g"], [10, 5, "g"],
    ...mask,
    ...blush,
  ],
  blink: [
    [5, 5, "e"], [6, 5, "e"], [9, 5, "e"], [10, 5, "e"],
    ...mask,
    ...blush,
  ],
  happy: [
    [5, 5, "g"], [6, 4, "g"], [9, 4, "g"], [10, 5, "g"],
    [7, 7, "m"], [8, 7, "m"],
    ...mask,
    ...blush,
  ],
  thinking: [
    [5, 4, "g"], [6, 4, "g"], [9, 4, "g"], [10, 4, "g"],
    ...mask,
    ...blush,
  ],
  worried: [
    [5, 4, "g"], [6, 5, "g"], [9, 5, "g"], [10, 4, "g"],
    ...mask,
    ...blush,
    [14, 4, "d"], [14, 5, "d"], [15, 5, "d"],
  ],
  sleepy: [
    [5, 5, "e"], [6, 5, "e"], [7, 5, "e"], [8, 5, "e"], [9, 5, "e"], [10, 5, "e"],
    ...mask,
    ...blush,
    [14, 0, "z"], [15, 0, "z"], [15, 1, "z"], [14, 2, "z"], [15, 2, "z"],
  ],
};

export function spritePixels(mood: Mood): Pixel[] {
  const pixels: Pixel[] = [];
  BODY.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c !== ".") pixels.push([x, y, c as Color]);
    }
  });
  const map = new Map(pixels.map((p) => [`${p[0]},${p[1]}`, p]));
  for (const p of FACES[mood]) map.set(`${p[0]},${p[1]}`, p);
  return [...map.values()];
}

/** Merge horizontal runs of same-colored pixels into rects (fewer DOM nodes). */
export function spriteRects(mood: Mood) {
  const grid = new Map(spritePixels(mood).map(([x, y, c]) => [`${x},${y}`, c]));
  const rects: { x: number; y: number; w: number; c: Color }[] = [];
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      const c = grid.get(`${x},${y}`);
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (grid.get(`${x + w},${y}`) === c) w++;
      rects.push({ x, y, w, c });
      x += w;
    }
  }
  return rects;
}

export function spriteSvg(mood: Mood = "happy", size = 64): string {
  const body = spriteRects(mood)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${PALETTE[r.c]}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${body}</svg>`;
}
