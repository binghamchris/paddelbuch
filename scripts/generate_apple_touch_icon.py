#!/usr/bin/env python3
"""
Generate a 180x180 Apple Touch Icon PNG from the SVG favicon.

Caches a checksum file alongside the output so the PNG is only
regenerated when the source SVG changes.

Usage:
    python3 scripts/generate_apple_touch_icon.py

Requires: rsvg-convert (brew install librsvg)
"""

import hashlib
import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

SVG_SOURCE = os.path.join(PROJECT_ROOT, "assets", "images", "logo-favicon.svg")
OUTPUT_PNG = os.path.join(PROJECT_ROOT, "assets", "images", "apple-touch-icon.png")
CHECKSUM_FILE = os.path.join(PROJECT_ROOT, "assets", "images", ".apple-touch-icon-checksum")
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
    if not os.path.exists(SVG_SOURCE):
        print(f"ERROR: SVG source not found: {SVG_SOURCE}", file=sys.stderr)
        sys.exit(1)

    if not needs_regeneration():
        print("Apple Touch Icon is up to date, skipping generation.")
        return

    print(f"Generating {SIZE}x{SIZE} Apple Touch Icon from {SVG_SOURCE}...")
    try:
        subprocess.run(
            ["rsvg-convert", "-w", str(SIZE), "-h", str(SIZE), SVG_SOURCE, "-o", OUTPUT_PNG],
            check=True,
        )
    except FileNotFoundError:
        print("ERROR: rsvg-convert not found. Install with: brew install librsvg", file=sys.stderr)
        sys.exit(1)

    checksum = sha256(SVG_SOURCE)
    with open(CHECKSUM_FILE, "w") as f:
        f.write(checksum)

    print(f"Apple Touch Icon written to {OUTPUT_PNG}")


if __name__ == "__main__":
    generate()
