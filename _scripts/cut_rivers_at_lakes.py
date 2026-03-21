#!/usr/bin/env python3
"""
One-off script to cut river geometries where they pass through lakes in Contentful.

For each river (paddlingEnvironmentType = "fluss" or "wildwasser"):
  1. Reads the geometry field (LineString/MultiLineString)
  2. Checks if it intersects any lake geometry (paddlingEnvironmentType = "see")
  3. If it does, subtracts the lake geometry using Shapely difference
  4. Updates the geometry field in Contentful and publishes the entry

Usage:
    python3 _scripts/cut_rivers_at_lakes.py [--dry-run] [--slug SLUG]

Options:
    --dry-run      Preview changes without writing to Contentful
    --slug SLUG    Process only the river with the given slug

Dependencies:
    pip3 install shapely requests python-dotenv
"""

import json
import os
import sys
import time

import requests
from dotenv import load_dotenv
from shapely.geometry import shape, mapping, MultiLineString, LineString, GeometryCollection
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
        print("Error: --slug requires a value, e.g. --slug aare", file=sys.stderr)
        sys.exit(1)
    TARGET_SLUG = sys.argv[idx + 1]

# Lake type slug
LAKE_TYPE_SLUG = "see"
# River type slugs
RIVER_TYPE_SLUGS = {"fluss", "wildwasser"}


# ---------------------------------------------------------------------------
# Contentful Management API
# ---------------------------------------------------------------------------

def cma_headers():
    return {
        "Authorization": f"Bearer {CMA_TOKEN}",
        "Content-Type": "application/vnd.contentful.management.v1+json",
    }


def fetch_entries(content_type, limit=100):
    """Fetch all entries of a given content type from Contentful CMA."""
    entries = []
    skip = 0
    while True:
        url = f"{BASE_URL}/entries?content_type={content_type}&limit={limit}&skip={skip}"
        resp = requests.get(url, headers=cma_headers())
        if not resp.ok:
            print(f"ERROR fetching {content_type} (skip={skip}): {resp.status_code} {resp.text}",
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
    return requests.put(url, headers=headers, json={"fields": fields})


def publish_entry(entry_id, version):
    """Publish a Contentful entry."""
    url = f"{BASE_URL}/entries/{entry_id}/published"
    headers = cma_headers()
    headers["X-Contentful-Version"] = str(version)
    return requests.put(url, headers=headers)


# ---------------------------------------------------------------------------
# Helpers
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


def get_slug(fields, locale):
    """Extract slug from entry fields."""
    slug_field = fields.get("slug", {})
    return slug_field.get(locale) or slug_field.get("en") or "unknown"


def get_link_id(fields, field_name, locale):
    """Extract the linked entry ID from a reference field."""
    ref_field = fields.get(field_name, {})
    ref = ref_field.get(locale) or ref_field.get("en")
    if ref and isinstance(ref, dict):
        return ref.get("sys", {}).get("id")
    return None


def build_type_slug_map():
    """Fetch paddlingEnvironmentType entries and build id -> slug map."""
    entries = fetch_entries("paddlingEnvironmentType")
    id_to_slug = {}
    for entry in entries:
        entry_id = entry["sys"]["id"]
        fields = entry.get("fields", {})
        slug_field = fields.get("slug", {})
        # Get slug from any locale
        slug = next(iter(slug_field.values()), None) if slug_field else None
        if slug:
            id_to_slug[entry_id] = slug
    return id_to_slug


def safe_shape(geo_dict):
    """Parse a GeoJSON dict into a valid Shapely geometry."""
    geom = shape(geo_dict)
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


def extract_lines(geom):
    """Extract only LineString/MultiLineString parts from a geometry.

    Shapely's difference() can produce a GeometryCollection containing
    a mix of LineStrings and stray Points. This filters to lines only,
    returning a MultiLineString (or LineString if just one).
    """
    if isinstance(geom, (LineString, MultiLineString)):
        return geom

    if isinstance(geom, GeometryCollection):
        lines = [g for g in geom.geoms if isinstance(g, (LineString, MultiLineString))]
        # Flatten any MultiLineStrings
        flat = []
        for g in lines:
            if isinstance(g, MultiLineString):
                flat.extend(g.geoms)
            else:
                flat.append(g)
        if not flat:
            return LineString()  # empty
        if len(flat) == 1:
            return flat[0]
        return MultiLineString(flat)

    return geom


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    print(f"=== {mode} — {'no changes will be written' if DRY_RUN else 'changes will be written to Contentful'} ===")
    if TARGET_SLUG:
        print(f"=== Target: slug '{TARGET_SLUG}' ===")
    print()

    # Step 1: Build type ID -> slug map
    print("Fetching paddlingEnvironmentType entries...")
    type_slug_map = build_type_slug_map()
    print(f"  Found {len(type_slug_map)} type entries: {dict(list(type_slug_map.items())[:10])}")
    print()

    # Step 2: Fetch all waterways
    print("Fetching all waterway entries from Contentful CMA...")
    waterways = fetch_entries("waterway")
    print(f"  Found {len(waterways)} waterway entries")
    print()

    # Step 3: Classify into lakes and rivers
    lakes = []
    rivers = []

    for entry in waterways:
        fields = entry.get("fields", {})
        geo_field = fields.get("geometry")
        if not geo_field:
            continue

        locale = next(iter(geo_field), None)
        if not locale:
            continue

        type_id = get_link_id(fields, "paddlingEnvironmentType", locale)
        type_slug = type_slug_map.get(type_id, "")

        if type_slug == LAKE_TYPE_SLUG:
            lakes.append(entry)
        elif type_slug in RIVER_TYPE_SLUGS:
            rivers.append(entry)

    print(f"  Classified: {len(lakes)} lakes, {len(rivers)} rivers")
    print()

    # Step 4: Build combined lake geometry
    print("Building combined lake geometry (using fullGeometry where available)...")
    lake_geoms = []
    for entry in lakes:
        fields = entry.get("fields", {})
        # Prefer fullGeometry (original unclipped/unsimplified), fall back to geometry
        full_geo_field = fields.get("fullGeometry", {})
        geo_field = fields.get("geometry", {})
        source_field = full_geo_field if full_geo_field else geo_field
        locale = next(iter(source_field), None)
        if not locale:
            continue
        geo_dict = parse_geometry(source_field[locale])
        if not geo_dict:
            continue
        try:
            geom = safe_shape(geo_dict)
            if not geom.is_empty:
                lake_geoms.append(geom)
        except Exception as e:
            slug = get_slug(fields, locale)
            print(f"  WARNING: could not parse lake '{slug}': {e}")

    if not lake_geoms:
        print("  No lake geometries found. Nothing to do.")
        return

    combined_lakes = unary_union(lake_geoms)
    print(f"  Combined {len(lake_geoms)} lake geometries into {combined_lakes.geom_type}")
    print()

    # Filter rivers by slug if requested
    if TARGET_SLUG:
        rivers = [
            e for e in rivers
            if any(v == TARGET_SLUG for v in (e.get("fields", {}).get("slug", {}) or {}).values())
        ]
        if not rivers:
            print(f"Error: no river found with slug '{TARGET_SLUG}'", file=sys.stderr)
            sys.exit(1)
        print(f"  Filtered to {len(rivers)} river matching slug '{TARGET_SLUG}'")
        print()

    # Step 5: Process rivers
    processed = 0
    skipped_no_intersect = 0
    skipped_no_geo = 0
    errors = 0

    for idx, entry in enumerate(rivers):
        entry_id = entry["sys"]["id"]
        version = entry["sys"]["version"]
        fields = entry.get("fields", {})
        geo_field = fields.get("geometry", {})

        locale = next(iter(geo_field), None)
        if not locale:
            skipped_no_geo += 1
            continue

        geo_dict = parse_geometry(geo_field[locale])
        if not geo_dict:
            skipped_no_geo += 1
            continue

        slug = get_slug(fields, locale)

        try:
            river_geom = safe_shape(geo_dict)
        except Exception as e:
            print(f"  [{idx+1}/{len(rivers)}] {slug}: ERROR parsing geometry — {e}")
            errors += 1
            continue

        # Check intersection
        if not river_geom.intersects(combined_lakes):
            skipped_no_intersect += 1
            print(f"  [{idx+1}/{len(rivers)}] {slug}: no lake intersection — skipping")
            continue

        # Cut out lake portions
        try:
            cut_geom = river_geom.difference(combined_lakes)
            cut_geom = extract_lines(cut_geom)
        except Exception as e:
            print(f"  [{idx+1}/{len(rivers)}] {slug}: ERROR computing difference — {e}")
            errors += 1
            continue

        if cut_geom.is_empty:
            print(f"  [{idx+1}/{len(rivers)}] {slug}: geometry empty after cutting — skipping")
            errors += 1
            continue

        # Stats
        orig_length = river_geom.length
        cut_length = cut_geom.length
        pct = (cut_length / orig_length * 100) if orig_length > 0 else 0
        print(f"  [{idx+1}/{len(rivers)}] {slug}: cut at lakes — {pct:.1f}% length retained, "
              f"{river_geom.geom_type} -> {cut_geom.geom_type}")

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
                    loc_geom = safe_shape(loc_geo_dict)
                    loc_cut = loc_geom.difference(combined_lakes)
                    loc_cut = extract_lines(loc_cut)
                    if not loc_cut.is_empty:
                        updated_fields["geometry"][loc] = mapping(loc_cut)
                    else:
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

        # Rate limiting
        time.sleep(0.25)

    print()
    print("=== Summary ===")
    print(f"  Cut & updated:          {processed}")
    print(f"  Skipped (no geo):       {skipped_no_geo}")
    print(f"  Skipped (no intersect): {skipped_no_intersect}")
    print(f"  Errors:                 {errors}")
    print(f"  Mode:                   {mode}")


if __name__ == "__main__":
    main()
