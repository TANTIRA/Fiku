#!/usr/bin/env python3
"""Compiles one Fuku Mech master from generated glyph JSON into a WOFF2.

Usage:
    build-font.py <glyphs.json> <out.woff2> [--ttf <out.ttf>]

The JSON is produced by scripts/gen-fonts.ts, which has already normalised
contour winding and computed each glyph's bounding box and left side bearing.
This script is deliberately a dumb compiler: it does not invent geometry, it
only translates it into sfnt tables.

Output is reproducible: head.created/modified are pinned, so regenerating from
unchanged glyph data yields byte-identical files.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Pinned timestamp so regeneration is byte-for-byte reproducible. sfnt stores
# seconds since 1904-01-01, so this is a fixed date rather than a Unix epoch.
EPOCH = 3786912000  # 2024-01-01T00:00:00Z

# Both replaced fonts (Pixelify Sans, DM Sans) shipped fsSelection 0xC0:
# REGULAR (0x40) plus USE_TYPO_METRICS (0x80). We match so line spacing agrees.
FS_REGULAR = 0xC0
FS_BOLD = 0xA0

NOTDEF_ADVANCE = 600
NOTDEF_LSB = 60


def notdef_glyph():
    """A hollow box, the conventional missing-glyph shape."""
    pen = TTGlyphPen(None)
    pen.moveTo((60, -20))
    pen.lineTo((60, 720))
    pen.lineTo((540, 720))
    pen.lineTo((540, -20))
    pen.closePath()
    pen.moveTo((120, 40))
    pen.lineTo((480, 40))
    pen.lineTo((480, 660))
    pen.lineTo((120, 660))
    pen.closePath()
    return pen.glyph()


def draw(contours, tolerance=1.0):
    """Converts authored contours into a TrueType glyph, cubic curves included."""
    pen = TTGlyphPen(None)
    quad = Cu2QuPen(pen, tolerance, reverse_direction=False)
    for contour in contours:
        quad.moveTo(tuple(contour["start"]))
        for seg in contour["segs"]:
            if seg["op"] == "l":
                quad.lineTo(tuple(seg["to"]))
            else:
                quad.curveTo(tuple(seg["c1"]), tuple(seg["c2"]), tuple(seg["to"]))
        quad.closePath()
    return pen.glyph()


def build(spec: dict, out_path: Path, ttf_path: Path | None = None) -> dict:
    meta = spec["meta"]
    glyphs = spec["glyphs"]
    upem = meta["upem"]
    weight = meta["weight"]

    fb = FontBuilder(upem, isTTF=True)
    order = [".notdef"] + [g["name"] for g in glyphs]
    fb.setupGlyphOrder(order)

    cmap = {int(cp): name for cp, name in spec["cmap"].items()}
    fb.setupCharacterMap(cmap)

    glyf = {".notdef": notdef_glyph()}
    metrics = {".notdef": (NOTDEF_ADVANCE, NOTDEF_LSB)}
    for g in glyphs:
        glyf[g["name"]] = draw(g["contours"])
        metrics[g["name"]] = (g["advance"], g["lsb"])
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(metrics)

    fb.setupHorizontalHeader(
        ascent=meta["hheaAscent"], descent=meta["hheaDescent"], lineGap=0
    )

    fb.setupNameTable(
        {
            "familyName": meta["family"],
            "styleName": meta["style"],
            "psName": meta["psName"],
            "fullName": f"{meta['family']} {meta['style']}",
            "version": "Version 1.000",
            "copyright": "Copyright (c) Fuku. Original outlines; all rights reserved.",
            "designer": "Fuku",
            "description": "Fuku Mech - a mech-inspired display and text family.",
            "uniqueFontIdentifier": f"{meta['psName']};1.000",
        }
    )

    fb.setupOS2(
        sTypoAscender=meta["ascender"],
        sTypoDescender=meta["descender"],
        sTypoLineGap=0,
        usWinAscent=meta["winAscent"],
        usWinDescent=meta["winDescent"],
        sxHeight=meta["xHeight"],
        sCapHeight=meta["cap"],
        usWeightClass=weight,
        fsSelection=FS_BOLD if weight == 700 else FS_REGULAR,
        achVendID="FUKU",
    )
    fb.setupPost(keepGlyphNames=False, underlinePosition=meta["underlinePosition"],
                 underlineThickness=meta["underlineThickness"])
    fb.setupMaxp()

    # USE_TYPO_METRICS (fsSelection bit 7) is only defined from OS/2 version 4,
    # and both replaced fonts set it, so line spacing agrees with them.
    fb.font["OS/2"].version = 4

    head = fb.font["head"]
    head.created = EPOCH
    head.modified = EPOCH
    head.macStyle = 1 if weight == 700 else 0

    fb.font.flavor = "woff2"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fb.save(str(out_path))

    if ttf_path is not None:
        fb.font.flavor = None
        ttf_path.parent.mkdir(parents=True, exist_ok=True)
        fb.save(str(ttf_path))

    return {"glyphs": len(order), "bytes": out_path.stat().st_size}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("out")
    ap.add_argument("--ttf", default=None)
    args = ap.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf8"))
    result = build(spec, Path(args.out), Path(args.ttf) if args.ttf else None)
    print(f"{args.out}: {result['glyphs']} glyphs, {result['bytes']} bytes")


if __name__ == "__main__":
    main()
