#!/usr/bin/env python3
"""
Generate a 180x180 Apple Touch Icon PNG from the SVG favicon.

Caches the output in _data/ alongside a checksum file so the PNG is only
regenerated when the source SVG changes.

Usage:
    python3 _scripts/generate_apple_touch_icon.py

Requires: cairosvg (pip3 install cairosvg)
"""

import hashlib
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

SVG_SOURCE = os.path.join(PROJECT_ROOT, "assets", "images", "logo-favicon.svg")
OUTPUT_PNG = os.path.join(PROJECT_ROOT, "_data", "apple-touch-icon.png")
CHECKSUM_FILE = os.path.join(PROJECT_ROOT, "_data", ".apple-touch-icon-checksum")
SIZE = 180


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def needs_regeneration():
    if not os.path.exists(OUTPUT_PNG):
        return True
    if not os.path.exists(CHECKSUM_FILE):
        return True
    current = sha256(SVG_SOURCE)
    with open(CHECKSUM_FILE, "r") as f:
        cached = f.read().strip()
    return current != cached


def generate():
    try:
        import cairosvg
    except ImportError:
        print("ERROR: cairosvg is required. Install with: pip3 install cairosvg", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(SVG_SOURCE):
        print(f"ERROR: SVG source not found: {SVG_SOURCE}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUTPUT_PNG), exist_ok=True)

    if not needs_regeneration():
        print("Apple Touch Icon is up to date, skipping generation.")
        return

    print(f"Generating {SIZE}x{SIZE} Apple Touch Icon from {SVG_SOURCE}...")
    cairosvg.svg2png(
        url=SVG_SOURCE,
        write_to=OUTPUT_PNG,
        output_width=SIZE,
        output_height=SIZE,
    )

    checksum = sha256(SVG_SOURCE)
    with open(CHECKSUM_FILE, "w") as f:
        f.write(checksum)

    print(f"Apple Touch Icon written to {OUTPUT_PNG}")


if __name__ == "__main__":
    generate()
