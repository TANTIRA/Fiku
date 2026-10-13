#!/usr/bin/env python3
"""Renders a specimen sheet from a *compiled* Fuku Mech binary.

Usage:
    font-specimen.py <font.woff2> <out.svg> [--title "..."]

Outlines are read back out of the generated font rather than from the authored
source, so the sheet shows exactly what ships: it catches winding bugs (missing
counters), missing coverage and shape problems that the source alone would hide.
Rasterise with `rsvg-convert` to inspect.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

INK = "#1c2230"
PAPER = "#fffdf6"
GRID = "#d8d2c4"
LABEL = "#8a8272"

# Strings the app actually renders, so the sheet doubles as a coverage check.
UI_STRINGS = [
    "Ringkasan · Transaksi · Asisten",
    "−Rp 25.000  +Rp 7.500.000  ×3  ≤30%",
    "Kirim ▶  ◀  Memuat…  Lihat semua →",
    "Catat uang masuk & keluar cukup dengan ngobrol.",
    "Halo, aku Fuku! Ceritakan uang yang masuk hari ini.",
]

LADDER = [14, 16, 18, 24, 36, 60]


def glyph_path(font: TTFont, name: str, scale: float) -> str:
    pen = SVGPathPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(pen)
    return pen.getCommands()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("out")
    ap.add_argument("--title", default=None)
    args = ap.parse_args()

    font = TTFont(args.font)
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    title = args.title or [r.toUnicode() for r in font["name"].names if r.nameID == 4][0]

    pad = 32
    width = 1200
    rows_of_grid = 8
    cols = 12
    cell = 92
    y = pad + 40

    parts: list[str] = []
    parts.append(f'<rect width="{width}" height="100%" fill="{PAPER}"/>')
    parts.append(
        f'<text x="{pad}" y="{pad + 8}" font-family="monospace" font-size="15" '
        f'fill="{INK}">{title} — {len(cmap)} glyphs</text>'
    )

    def draw(ch: str, x: float, baseline: float, size: float, fill: str = INK) -> float:
        """Draws one character and returns the x after its advance."""
        name = cmap.get(ord(ch))
        if name is None:
            return x
        scale = size / upem
        d = glyph_path(font, name, scale)
        if d:
            parts.append(
                f'<path transform="translate({x:.2f} {baseline:.2f}) scale({scale:.6f} -{scale:.6f})" '
                f'd="{d}" fill="{fill}"/>'
            )
        return x + hmtx[name][0] * scale

    def draw_string(text: str, x: float, baseline: float, size: float, fill: str = INK) -> float:
        for ch in text:
            x = draw(ch, x, baseline, size, fill)
        return x

    def measure(text: str, size: float) -> float:
        return sum(hmtx[cmap[ord(c)]][0] * size / upem for c in text if ord(c) in cmap)

    # --- glyph grid -----------------------------------------------------------
    y += 34
    parts.append(
        f'<text x="{pad}" y="{y}" font-family="monospace" font-size="11" fill="{LABEL}">GLYPH GRID · 64px em</text>'
    )
    y += 16
    ordered = sorted(cmap.items(), key=lambda kv: kv[0])
    for i, (cp, name) in enumerate(ordered):
        col = i % cols
        row = i // cols
        cx = pad + col * (cell + 8)
        cy = y + row * (cell + 26)
        parts.append(
            f'<rect x="{cx}" y="{cy}" width="{cell}" height="{cell}" fill="none" stroke="{GRID}"/>'
        )
        scale = 64 / upem
        d = glyph_path(font, name, scale)
        if d:
            parts.append(
                f'<path transform="translate({cx + 14} {cy + cell - 16}) scale({scale:.6f} -{scale:.6f})" '
                f'd="{d}" fill="{INK}"/>'
            )
        label = chr(cp) if 33 <= cp <= 126 else f"U+{cp:04X}"
        parts.append(
            f'<text x="{cx + 4}" y="{cy + cell + 14}" font-family="monospace" font-size="10" '
            f'fill="{LABEL}">{label}</text>'
        )
    rows_used = (len(ordered) + cols - 1) // cols
    y += rows_used * (cell + 26) + 40

    # --- size ladder ----------------------------------------------------------
    sample = "Hamburger 0123 −Rp 25.000 ×3"
    parts.append(
        f'<text x="{pad}" y="{y}" font-family="monospace" font-size="11" fill="{LABEL}">SIZE LADDER · {sample}</text>'
    )
    y += 20
    for size in LADDER:
        parts.append(
            f'<text x="{pad - 28}" y="{y + size * 0.72}" font-family="monospace" font-size="10" '
            f'fill="{LABEL}">{size}</text>'
        )
        draw_string(sample, pad, y + size * 0.72, size)
        y += size * 1.35 + 10

    # --- real UI strings ------------------------------------------------------
    y += 24
    parts.append(
        f'<text x="{pad}" y="{y}" font-family="monospace" font-size="11" fill="{LABEL}">REAL UI STRINGS · 16px</text>'
    )
    y += 22
    for line in UI_STRINGS:
        draw_string(line, pad, y, 16)
        y += 26

    # --- uppercase vs lowercase ----------------------------------------------
    y += 24
    parts.append(
        f'<text x="{pad}" y="{y}" font-family="monospace" font-size="11" fill="{LABEL}">CASE COMPARISON · 48px</text>'
    )
    y += 54
    upper = "ABCDEFGHIJKLM"
    lower = "abcdefghijklm"
    draw_string(upper, pad, y, 48)
    y += 58
    draw_string(lower, pad, y, 48)
    y += 40

    height = y + pad
    parts[0] = f'<rect width="{width}" height="{height}" fill="{PAPER}"/>'
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">' + "".join(parts) + "</svg>"
    )
    Path(args.out).write_text(svg, encoding="utf8")
    print(f"{args.out}: {len(cmap)} glyphs, {width}x{height}")


if __name__ == "__main__":
    main()
