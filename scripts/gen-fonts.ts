/**
 * Regenerates the Fuku Mech font binaries from the authored glyph data:
 *
 *   npx tsx scripts/gen-fonts.ts
 *   npx tsx scripts/gen-fonts.ts --only H,o,space
 *
 * The glyph source in src/fonts/ is the source of truth; the WOFF2 files in
 * src/app/fonts/ are build artifacts and are committed so the Next build has
 * them without running Python.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildMaster, COVERAGE, MASTERS, METRICS, UPEM } from "../src/fonts";
import { bounds, normalizeWinding, validate } from "../src/fonts/lib/geometry";
import type { Contour, Glyph } from "../src/fonts/lib/types";

const OUT_DIR = "src/app/fonts";

/** One glyph, ready for the compiler: winding fixed, sidebearing measured. */
type Prepared = {
  name: string;
  advance: number;
  lsb: number;
  contours: Contour[];
};

function prepare(glyph: Glyph): Prepared {
  const contours = normalizeWinding(glyph.contours);
  const box = bounds(contours);
  return { name: glyph.name, advance: glyph.advance, lsb: box ? box.xMin : 0, contours };
}

function parseOnly(argv: string[]): string[] | undefined {
  const i = argv.indexOf("--only");
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (!value) throw new Error("--only needs a comma-separated list of glyph names");
  return value.split(",").map((s) => s.trim());
}

function main(): void {
  const only = parseOnly(process.argv.slice(2));
  const work = mkdtempSync(join(tmpdir(), "fuku-fonts-"));
  const failures: string[] = [];

  for (const master of MASTERS) {
    const glyphs = buildMaster(master.cut, master.weight, only);
    const prepared: Prepared[] = [];

    for (const glyph of glyphs) {
      const problems = validate(glyph, 24);
      if (problems.length > 0) {
        failures.push(`${master.cut}/${glyph.name}: ${problems.join("; ")}`);
        continue;
      }
      prepared.push(prepare(glyph));
    }
    if (failures.length > 0) continue;

    const metrics = METRICS[master.cut];
    const names = new Set(prepared.map((g) => g.name));
    const spec = {
      meta: {
        family: master.family,
        style: master.style,
        psName: master.psName,
        weight: master.weight,
        upem: UPEM,
        cap: metrics.cap,
        xHeight: metrics.xHeight,
        ascender: metrics.ascender,
        descender: metrics.descender,
        hheaAscent: metrics.hheaAscent,
        hheaDescent: metrics.hheaDescent,
        winAscent: metrics.winAscent,
        winDescent: metrics.winDescent,
        underlinePosition: metrics.underlinePosition,
        underlineThickness: metrics.underlineThickness,
      },
      cmap: Object.fromEntries(
        COVERAGE.filter(([, name]) => names.has(name)).map(([cp, name]) => [String(cp), name]),
      ),
      glyphs: prepared,
    };

    const specPath = join(work, `${master.fileName}.json`);
    writeFileSync(specPath, JSON.stringify(spec));
    mkdirSync(OUT_DIR, { recursive: true });

    const run = spawnSync(
      "python3",
      ["scripts/build-font.py", specPath, join(OUT_DIR, `${master.fileName}.woff2`)],
      { stdio: "inherit" },
    );
    if (run.status !== 0) throw new Error(`build-font.py failed for ${master.fileName}`);
  }

  if (failures.length > 0) {
    console.error("\nglyph validation failed:");
    for (const f of failures) console.error(`  ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nwrote ${MASTERS.length} masters to ${OUT_DIR}/`);
}

main();
