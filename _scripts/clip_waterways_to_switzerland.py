#!/usr/bin/env python3
"""
One-off script to clip waterway geometries at the Swiss border in Contentful.

For each waterway entry in Contentful:
  1. Reads the geometry field
  2. Checks if the geometry extends beyond the Swiss border
  3. If it does, clips it to the Swiss border using Shapely intersection
  4. Updates the geometry field in Contentful and publishes the entry

Usage:
    python3 _scripts/clip_waterways_to_switzerland.py [--dry-run] [--slug SLUG]

Options:
    --dry-run      Preview changes without writing to Contentful
    --slug SLUG    Process only the waterway with the given slug

Dependencies:
    pip3 install shapely requests python-dotenv
"""

import json
import os
import sys
import time

import requests
from dotenv import load_dotenv
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.development'))

SPACE_ID = os.environ['CONTENTFUL_SPACE_ID']
ENVIRONMENT = os.environ.get('CONTENTFUL_ENVIRONMENT', 'dev')
CMA_TOKEN = os.environ['CONTENTFUL_MANAGEMENT_TOKEN']
BASE_URL = f"https://api.contentful.com/spaces/{SPACE_ID}/environments/{ENVIRONMENT}"

DRY_RUN = '--dry-run' in sys.argv
TARGET_SLUG = None
if '--slug' in sys.argv:
    idx = sys.argv.index('--slug')
    if idx + 1 >= len(sys.argv):
        print("Error: --slug requires a value, e.g. --slug langensee", file=sys.stderr)
        sys.exit(1)
    TARGET_SLUG = sys.argv[idx + 1]

# Slugs to exclude from clipping (e.g. waterways running along the border
# where intersection produces incorrect results)
EXCLUDED_SLUGS = {
    "rhein",
    "doubs",
    "alter-rhein",
    "lutzel"
}

# Swiss border cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache')
CACHE_FILE = os.path.join(CACHE_DIR, 'switzerland_border.geojson')

SWISS_BORDER_URLS = [
    "https://raw.githubusercontent.com/ZHB/switzerland-geojson/master/country/switzerland.geojson",
]


# ---------------------------------------------------------------------------
# Swiss border
# ---------------------------------------------------------------------------

def download_swiss_border():
    """Download and cache the Swiss border GeoJSON."""
    if os.path.exists(CACHE_FILE):
        print(f"  Using cached Swiss border from {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)

    os.makedirs(CACHE_DIR, exist_ok=True)
    for url in SWISS_BORDER_URLS:
        print(f"  Downloading Swiss border from {url} ...")
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            with open(CACHE_FILE, "w") as f:
                json.dump(data, f)
            print("  Download successful.")
            return data
        except Exception as e:
            print(f"  Failed: {e}")

    print("ERROR: Could not download Swiss border.", file=sys.stderr)
    sys.exit(1)


def load_swiss_border():
    """Load the Swiss border as a Shapely geometry."""
    data = download_swiss_border()
    if data.get("type") == "FeatureCollection":
        geoms = [shape(f["geometry"]) for f in data["features"]]
        geom = unary_union(geoms)
    elif data.get("type") == "Feature":
        geom = shape(data["geometry"])
    else:
        geom = shape(data)
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def parse_geometry(value):
    """Parse a geometry value (JSON string or dict) into a dict."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return None
    elif isinstance(value, dict):
        return value
    return None


def geometry_needs_clipping(geom, swiss_border):
    """Check if a geometry extends beyond the Swiss border."""
    return not swiss_border.contains(geom)


def clip_geometry(geom, swiss_border):
    """Clip a Shapely geometry to the Swiss border."""
    clipped = geom.intersection(swiss_border)
    return clipped


# ---------------------------------------------------------------------------
# Contentful Management API
# ---------------------------------------------------------------------------

def cma_headers():
    return {
        "Authorization": f"Bearer {CMA_TOKEN}",
        "Content-Type": "application/vnd.contentful.management.v1+json",
    }


def fetch_all_waterways():
    """Fetch all waterway entries from Contentful CMA."""
    entries = []
    skip = 0
    limit = 100

    while True:
        url = f"{BASE_URL}/entries?content_type=waterway&limit={limit}&skip={skip}"
        resp = requests.get(url, headers=cma_headers())
        if not resp.ok:
            print(f"ERROR fetching waterways (skip={skip}): {resp.status_code} {resp.text}",
                  file=sys.stderr)
            sys.exit(1)
        data = resp.json()
        entries.extend(data["items"])
        total = data["total"]
        skip += limit
        if skip >= total:
            break

    return entries


def update_entry(entry_id, version, fields):
    """Update a Contentful entry via CMA PUT."""
    url = f"{BASE_URL}/entries/{entry_id}"
    headers = cma_headers()
    headers["X-Contentful-Version"] = str(version)
    resp = requests.put(url, headers=headers, json={"fields": fields})
    return resp


def publish_entry(entry_id, version):
    """Publish a Contentful entry."""
    url = f"{BASE_URL}/entries/{entry_id}/published"
    headers = cma_headers()
    headers["X-Contentful-Version"] = str(version)
    resp = requests.put(url, headers=headers)
    return resp


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== {mode} — {'no changes will be written' if DRY_RUN else 'changes will be written to Contentful'} ===")
    if TARGET_SLUG:
        print(f"=== Target: slug '{TARGET_SLUG}' ===")
    print()

    # Load Swiss border
    print("Loading Swiss border...")
    swiss_border = load_swiss_border()
    print(f"  Swiss border type: {swiss_border.geom_type}")
    print()

    # Fetch waterways
    print("Fetching all waterway entries from Contentful CMA...")
    waterways = fetch_all_waterways()
    print(f"  Found {len(waterways)} waterway entries")

    # Filter by slug if requested
    if TARGET_SLUG:
        waterways = [
            e for e in waterways
            if any(v == TARGET_SLUG for v in (e.get("fields", {}).get("slug", {}) or {}).values())
        ]
        if not waterways:
            print(f"Error: no waterway found with slug '{TARGET_SLUG}'", file=sys.stderr)
            sys.exit(1)
        print(f"  Filtered to {len(waterways)} entry matching slug '{TARGET_SLUG}'")

    print()

    # Counters
    processed = 0
    skipped_no_geo = 0
    skipped_inside = 0
    skipped_empty = 0
    errors = 0

    for idx, entry in enumerate(waterways):
        entry_id = entry["sys"]["id"]
        version = entry["sys"]["version"]
        fields = entry.get("fields", {})

        geo_field = fields.get("geometry")
        if not geo_field:
            skipped_no_geo += 1
            continue

        # Get geometry from first available locale
        locale = next(iter(geo_field), None)
        if not locale:
            skipped_no_geo += 1
            continue

        geometry_value = geo_field[locale]
        geo_dict = parse_geometry(geometry_value)
        if not geo_dict:
            skipped_no_geo += 1
            continue

        # Resolve slug for logging
        slug_field = fields.get("slug", {})
        slug = slug_field.get(locale) or slug_field.get("en") or entry_id

        # Check exclusion list
        if slug in EXCLUDED_SLUGS:
            print(f"  [{idx+1}/{len(waterways)}] {slug}: excluded — skipping")
            continue

        # Parse into Shapely
        try:
            geom = shape(geo_dict)
            if not geom.is_valid:
                geom = make_valid(geom)
        except Exception as e:
            print(f"  [{idx+1}/{len(waterways)}] {slug}: ERROR parsing geometry — {e}")
            errors += 1
            continue

        # Check if clipping is needed
        if not geometry_needs_clipping(geom, swiss_border):
            skipped_inside += 1
            print(f"  [{idx+1}/{len(waterways)}] {slug}: fully inside Switzerland — skipping")
            continue

        # Clip
        try:
            clipped = clip_geometry(geom, swiss_border)
        except Exception as e:
            print(f"  [{idx+1}/{len(waterways)}] {slug}: ERROR clipping — {e}")
            errors += 1
            continue

        if clipped.is_empty:
            skipped_empty += 1
            print(f"  [{idx+1}/{len(waterways)}] {slug}: clipped geometry is empty — skipping")
            continue

        # Stats
        original_area = geom.area
        clipped_area = clipped.area
        pct = (clipped_area / original_area * 100) if original_area > 0 else 0
        clipped_geojson = mapping(clipped)

        print(f"  [{idx+1}/{len(waterways)}] {slug}: needs clipping — {pct:.1f}% area retained, "
              f"type {geom.geom_type} -> {clipped.geom_type}")

        if DRY_RUN:
            processed += 1
            continue

        # Build updated fields — update geometry for ALL locales
        updated_fields = dict(fields)
        updated_fields["geometry"] = {}
        for loc in geo_field:
            loc_geo_dict = parse_geometry(geo_field[loc])
            if loc_geo_dict:
                try:
                    loc_geom = shape(loc_geo_dict)
                    if not loc_geom.is_valid:
                        loc_geom = make_valid(loc_geom)
                    loc_clipped = clip_geometry(loc_geom, swiss_border)
                    if not loc_clipped.is_empty:
                        updated_fields["geometry"][loc] = mapping(loc_clipped)
                    else:
                        # Keep original if clipping empties it
                        updated_fields["geometry"][loc] = loc_geo_dict
                except Exception:
                    updated_fields["geometry"][loc] = loc_geo_dict
            else:
                updated_fields["geometry"][loc] = geo_field[loc]

        # PUT update
        resp = update_entry(entry_id, version, updated_fields)
        if not resp.ok:
            print(f"    ERROR updating {slug}: {resp.status_code} {resp.text}")
            errors += 1
            continue

        # Publish
        new_version = resp.json()["sys"]["version"]
        pub_resp = publish_entry(entry_id, new_version)
        if pub_resp.ok:
            processed += 1
        else:
            print(f"    ERROR publishing {slug}: {pub_resp.status_code} {pub_resp.text}")
            errors += 1

        # Rate limiting — CMA allows ~10 req/s, we make 2 per entry
        time.sleep(0.25)

    print()
    print("=== Summary ===")
    print(f"  Clipped & updated:    {processed}")
    print(f"  Skipped (no geo):     {skipped_no_geo}")
    print(f"  Skipped (inside CH):  {skipped_inside}")
    print(f"  Skipped (empty clip): {skipped_empty}")
    print(f"  Errors:               {errors}")
    print(f"  Mode:                 {mode}")


if __name__ == "__main__":
    main()
