// Fuku 福 — an 8-bit coin critter with a savings sprout. 16×16 pixel grid.

export type Mood = "idle" | "blink" | "happy" | "thinking" | "worried" | "sleepy";

export const PALETTE = {
  o: "#3b2417", // outline
  b: "#f5b942", // body (gold)
  h: "#ffe08a", // highlight
  s: "#d98e2b", // shade
  l: "#5cc26b", // leaf
  L: "#2f8f4e", // leaf dark
  e: "#3b2417", // eyes
  p: "#ff8fa3", // blush
  m: "#c2410c", // mouth
  w: "#ffffff", // eye shine / sparkle
  d: "#6cc4ff", // sweat drop
  z: "#9aa4b2", // zzz
} as const;

export type Color = keyof typeof PALETTE;

// Body without a face. '.' is transparent.
const BODY = [
  "........ooo.....",
  ".......ollLo....",
  "......olLLo.....",
  "....ooooLoooo...",
  "...ohhbbbbbbbo..",
  "..ohhbbbbbbbbbo.",
  "..ohbbbbbbbbbbo.",
  "..obbbbbbbbbbbo.",
  "..obbbbbbbbbbbo.",
  ".oobbbbbbbbbbsoo",
  ".oobbbbbbbbbbsoo",
  "..osbbbbbbbbsso.",
  "...ossssssssso..",
  "....ooooooooo...",
  ".....o.o.o.o....",
  ".....o.o.o.o....",
];

type Pixel = [x: number, y: number, c: Color];

const blush: Pixel[] = [
  [4, 9, "p"],
  [11, 9, "p"],
];

const FACES: Record<Mood, Pixel[]> = {
  idle: [
    [5, 7, "e"], [5, 8, "e"], [10, 7, "e"], [10, 8, "e"],
    [5, 7, "w"], [10, 7, "w"],
    ...blush,
    [7, 10, "m"], [8, 10, "m"],
  ],
  blink: [
    [4, 8, "e"], [5, 8, "e"], [10, 8, "e"], [11, 8, "e"],
    ...blush,
    [7, 10, "m"], [8, 10, "m"],
  ],
  happy: [
    [5, 7, "e"], [4, 8, "e"], [6, 8, "e"],
    [10, 7, "e"], [9, 8, "e"], [11, 8, "e"],
    ...blush,
    [6, 10, "m"], [9, 10, "m"], [7, 11, "m"], [8, 11, "m"],
  ],
  thinking: [
    [6, 6, "e"], [6, 7, "e"], [11, 6, "e"], [11, 7, "e"],
    ...blush,
    [8, 10, "m"],
  ],
  worried: [
    [4, 6, "e"], [11, 6, "e"],
    [5, 8, "e"], [10, 8, "e"],
    ...blush,
    [6, 11, "m"], [7, 10, "m"], [8, 10, "m"], [9, 11, "m"],
    [13, 4, "d"], [13, 5, "d"], [12, 5, "d"],
  ],
  sleepy: [
    [4, 8, "e"], [5, 8, "e"], [10, 8, "e"], [11, 8, "e"],
    ...blush,
    [7, 10, "m"],
    [13, 0, "z"], [14, 0, "z"], [15, 0, "z"], [15, 1, "z"], [14, 2, "z"], [13, 3, "z"], [14, 3, "z"], [15, 3, "z"],
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
  const face = FACES[mood].filter(([, , c]) => c !== "w"); // eye shine reserved for large renders
  const map = new Map(pixels.map((p) => [`${p[0]},${p[1]}`, p]));
  for (const p of face) map.set(`${p[0]},${p[1]}`, p);
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
