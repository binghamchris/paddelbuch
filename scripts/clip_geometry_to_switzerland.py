#!/usr/bin/env python3
"""
Clip a GeoJSON geometry to the Swiss border.

Downloads the Swiss border from Natural Earth (via GitHub) and computes
the intersection so only the portion inside Switzerland remains.

Usage:
    python3 scripts/clip_geometry_to_switzerland.py input.geojson output.geojson

Dependencies:
    pip3 install shapely requests
"""

import json
import sys
import os
import requests
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

# Natural Earth 10m admin-0 countries (individual country file for Switzerland)
# Fallback: ZHB/switzerland-geojson on GitHub
SWISS_BORDER_URLS = [
    "https://raw.githubusercontent.com/georgique/world-geojson/develop/countries/CHE.json",
    "https://raw.githubusercontent.com/ZHB/switzerland-geojson/master/country/switzerland.geojson",
]

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
CACHE_FILE = os.path.join(CACHE_DIR, "switzerland_border.geojson")


def download_swiss_border():
    """Download and cache the Swiss border GeoJSON."""
    if os.path.exists(CACHE_FILE):
        print(f"Using cached Swiss border from {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)

    os.makedirs(CACHE_DIR, exist_ok=True)

    for url in SWISS_BORDER_URLS:
        print(f"Downloading Swiss border from {url} ...")
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            with open(CACHE_FILE, "w") as f:
                json.dump(data, f)
            print("Download successful.")
            return data
        except Exception as e:
            print(f"  Failed: {e}")

    print("ERROR: Could not download Swiss border from any source.", file=sys.stderr)
    sys.exit(1)


def extract_geometry(geojson_data):
    """Extract a Shapely geometry from various GeoJSON structures."""
    if geojson_data.get("type") == "FeatureCollection":
        geoms = [shape(f["geometry"]) for f in geojson_data["features"]]
        return unary_union(geoms)
    elif geojson_data.get("type") == "Feature":
        return shape(geojson_data["geometry"])
    else:
        return shape(geojson_data)


def clip_to_switzerland(input_path, output_path):
    """Clip the input GeoJSON to the Swiss border and write the result."""
    # Load input
    with open(input_path) as f:
        input_data = json.load(f)

    input_geom = extract_geometry(input_data)
    if not input_geom.is_valid:
        print("Input geometry is invalid, repairing...")
        input_geom = make_valid(input_geom)
    print(f"Input geometry type: {input_geom.geom_type}")
    print(f"Input bounding box:  {input_geom.bounds}")

    # Load Swiss border
    swiss_data = download_swiss_border()
    swiss_geom = extract_geometry(swiss_data)
    if not swiss_geom.is_valid:
        print("Swiss border geometry is invalid, repairing...")
        swiss_geom = make_valid(swiss_geom)
    print(f"Swiss border type:   {swiss_geom.geom_type}")

    # Clip
    clipped = input_geom.intersection(swiss_geom)
    print(f"Clipped geometry type: {clipped.geom_type}")

    if clipped.is_empty:
        print("WARNING: The clipped geometry is empty - no overlap with Switzerland.")

    # Approximate area comparison (in degrees^2, just for a ratio)
    original_area = input_geom.area
    clipped_area = clipped.area
    if original_area > 0:
        pct = (clipped_area / original_area) * 100
        print(f"Approximate area retained: {pct:.1f}%")

    # Write output
    result = {
        "type": "Feature",
        "properties": {
            "clipped_to": "Switzerland",
            "source": "clip_geometry_to_switzerland.py",
        },
        "geometry": mapping(clipped),
    }

    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Clipped geometry written to {output_path}")


def main():
    if len(sys.argv) == 3:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    elif len(sys.argv) == 2:
        input_path = sys.argv[1]
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_clipped{ext}"
    else:
        print(f"Usage: python3 {sys.argv[0]} <input.geojson> [output.geojson]")
        sys.exit(1)

    clip_to_switzerland(input_path, output_path)


if __name__ == "__main__":
    main()
