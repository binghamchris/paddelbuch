#!/usr/bin/env python3
"""
One-off script to recalculate the 'length' field for rivers in Contentful
from their GeoJSON geometry, using geodesic distance.

Only processes waterways where navigableByPaddlers is NOT false (i.e. true
or null/unset).

API efficiency measures:
  - Server-side filter: fields.navigableByPaddlers[ne]=false
  - select= to fetch only the fields we need (slug, geometry, length)
  - PATCH to update only the length field (not PUT with full entry)
  - Skips entries whose length already matches the calculated value

Usage:
    python3 scripts/recalculate_river_lengths.py [--dry-run] [--slug SLUG]

Options:
    --dry-run      Preview changes without writing to Contentful
    --slug SLUG    Process only the river with the given slug

Dependencies:
    pip3 install pyproj requests python-dotenv
"""

import json
import math
import os
import sys
import time

import requests
from dotenv import load_dotenv
from pyproj import Geod

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
        print("Error: --slug requires a value, e.g. --slug aare", file=sys.stderr)
        sys.exit(1)
    TARGET_SLUG = sys.argv[idx + 1]

# WGS84 ellipsoid for geodesic calculations
GEOD = Geod(ellps="WGS84")


# ---------------------------------------------------------------------------
# Contentful Management API
# ---------------------------------------------------------------------------

def cma_headers(version=None):
    headers = {
        "Authorization": f"Bearer {CMA_TOKEN}",
        "Content-Type": "application/vnd.contentful.management.v1+json",
    }
    if version is not None:
        headers["X-Contentful-Version"] = str(version)
    return headers


def fetch_navigable_waterways():
    """Fetch waterways where navigableByPaddlers is not false.

    Uses server-side filtering and field selection to minimise API payload.
    """
    entries = []
    skip = 0
    limit = 100
    # Only fetch the fields we actually need
    select_fields = "sys,fields.slug,fields.geometry,fields.length"

    while True:
        url = (
            f"{BASE_URL}/entries"
            f"?content_type=waterway"
            f"&fields.navigableByPaddlers[ne]=false"
            f"&select={select_fields}"
            f"&limit={limit}&skip={skip}"
        )
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


def patch_entry(entry_id, version, ops):
    """PATCH a Contentful entry using JSON Patch (RFC 6902).

    More efficient than PUT because we only send the changed fields.
    """
    url = f"{BASE_URL}/entries/{entry_id}"
    headers = cma_headers(version)
    headers["Content-Type"] = "application/json-patch+json"
    return requests.patch(url, headers=headers, json=ops)


def publish_entry(entry_id, version):
    """Publish a Contentful entry."""
    url = f"{BASE_URL}/entries/{entry_id}/published"
    return requests.put(url, headers=cma_headers(version))


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


def line_length_km(coords):
    """Calculate geodesic length of a coordinate sequence in km.

    coords: list of [lng, lat] pairs (GeoJSON order).
    """
    total = 0.0
    for i in range(len(coords) - 1):
        lng1, lat1 = coords[i][0], coords[i][1]
        lng2, lat2 = coords[i + 1][0], coords[i + 1][1]
        _, _, dist = GEOD.inv(lng1, lat1, lng2, lat2)
        total += dist
    return total / 1000.0


def geometry_length_km(geo_dict):
    """Calculate the geodesic length of a GeoJSON LineString or MultiLineString in km."""
    geom_type = geo_dict.get("type")
    coords = geo_dict.get("coordinates")

    if geom_type == "LineString":
        return line_length_km(coords)
    elif geom_type == "MultiLineString":
        return sum(line_length_km(line) for line in coords)
    else:
        return None  # Not a line geometry (e.g. Polygon for lakes)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== {mode} - {'no changes will be written' if DRY_RUN else 'changes will be written to Contentful'} ===")
    if TARGET_SLUG:
        print(f"=== Target: slug '{TARGET_SLUG}' ===")
    print()

    # Fetch waterways (server-side filtered: navigableByPaddlers != false)
    print("Fetching navigable waterway entries from Contentful CMA...")
    waterways = fetch_navigable_waterways()
    print(f"  Found {len(waterways)} navigable waterway entries")

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
    updated = 0
    skipped_not_line = 0
    skipped_no_geo = 0
    skipped_unchanged = 0
    errors = 0

    for idx, entry in enumerate(waterways):
        entry_id = entry["sys"]["id"]
        version = entry["sys"]["version"]
        fields = entry.get("fields", {})

        geo_field = fields.get("geometry", {})
        if not geo_field:
            skipped_no_geo += 1
            continue

        # Get geometry from first available locale
        locale = next(iter(geo_field), None)
        if not locale:
            skipped_no_geo += 1
            continue

        geo_dict = parse_geometry(geo_field[locale])
        if not geo_dict:
            skipped_no_geo += 1
            continue

        # Resolve slug for logging
        slug_field = fields.get("slug", {})
        slug = slug_field.get(locale) or slug_field.get("en") or entry_id

        # Only process line geometries (rivers), skip polygons (lakes)
        calc_km = geometry_length_km(geo_dict)
        if calc_km is None:
            skipped_not_line += 1
            continue

        new_length = round(calc_km)

        # Check existing length
        length_field = fields.get("length", {})
        existing_length = length_field.get(locale) if length_field else None

        if existing_length is not None and existing_length == new_length:
            skipped_unchanged += 1
            print(f"  [{idx+1}/{len(waterways)}] {slug}: {new_length} km (unchanged)")
            continue

        old_str = f"{existing_length} km" if existing_length is not None else "unset"
        print(f"  [{idx+1}/{len(waterways)}] {slug}: {old_str} -> {new_length} km")

        if DRY_RUN:
            updated += 1
            continue

        # Build PATCH operations - set length for all locales present in geometry
        ops = []
        for loc in geo_field:
            ops.append({"op": "replace", "path": f"/fields/length/{loc}", "value": new_length})

        resp = patch_entry(entry_id, version, ops)
        if not resp.ok:
            # If PATCH with "replace" fails because the path doesn't exist yet, retry with "add"
            if resp.status_code == 422:
                ops_add = [{"op": "add", "path": f"/fields/length/{loc}", "value": new_length}
                           for loc in geo_field]
                resp = patch_entry(entry_id, version, ops_add)

            if not resp.ok:
                print(f"    ERROR updating {slug}: {resp.status_code} {resp.text}")
                errors += 1
                continue

        # Publish
        new_version = resp.json()["sys"]["version"]
        pub_resp = publish_entry(entry_id, new_version)
        if pub_resp.ok:
            updated += 1
        else:
            print(f"    ERROR publishing {slug}: {pub_resp.status_code} {pub_resp.text}")
            errors += 1

        # Rate limiting - CMA allows ~10 req/s, we make 2 per entry (patch + publish)
        time.sleep(0.25)

    print()
    print("=== Summary ===")
    print(f"  Updated:                {updated}")
    print(f"  Skipped (not a river):  {skipped_not_line}")
    print(f"  Skipped (no geometry):  {skipped_no_geo}")
    print(f"  Skipped (unchanged):    {skipped_unchanged}")
    print(f"  Errors:                 {errors}")
    print(f"  Mode:                   {mode}")


if __name__ == "__main__":
    main()
