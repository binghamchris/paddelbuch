#!/usr/bin/env python3
"""
One-off script to subtract a GeoJSON polygon from river geometries in Contentful.

Uses locally cached build data (_data/waterways.yml and
_data/.contentful_sync_cache.yml) to identify affected rivers and resolve
Contentful entry IDs. Only rivers whose geometry actually intersects the
polygon trigger CMA requests, keeping API usage to a minimum.

For each affected river:
  1. Reads geometry from the local cache to test intersection
  2. Fetches the entry from Contentful CMA (to get current version + fields)
  3. Subtracts the polygon using Shapely difference
  4. Updates the geometry field in Contentful and publishes the entry

Usage:
    python3 scripts/subtract_polygon_from_rivers.py <polygon.geojson> [OPTIONS]

Arguments:
    polygon.geojson    Path to a GeoJSON file containing a Polygon or
                       MultiPolygon to subtract from river geometries

Options:
    --dry-run              Preview changes without writing to Contentful
    --slug SLUG            Process only the river with the given slug
    --from-contentful      Fetch geometry from Contentful CMA instead of
                           the local build cache

Dependencies:
    pip3 install shapely requests python-dotenv pyyaml
"""

import json
import os
import sys
import time

import requests
import yaml
from dotenv import load_dotenv
from pyproj import Geod
from shapely.geometry import (
    shape, mapping, MultiLineString, LineString, GeometryCollection,
)
from shapely.ops import unary_union
from shapely.validation import make_valid

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.join(SCRIPT_DIR, '..')
DATA_DIR = os.path.join(PROJECT_ROOT, '_data')

load_dotenv(os.path.join(PROJECT_ROOT, '.env.development'))

SPACE_ID = os.environ['CONTENTFUL_SPACE_ID']
ENVIRONMENT = os.environ.get('CONTENTFUL_ENVIRONMENT', 'dev')
CMA_TOKEN = os.environ['CONTENTFUL_MANAGEMENT_TOKEN']
BASE_URL = f"https://api.contentful.com/spaces/{SPACE_ID}/environments/{ENVIRONMENT}"

# WGS84 ellipsoid for geodesic length calculations
GEOD = Geod(ellps="WGS84")

# River type slugs
RIVER_TYPE_SLUGS = {"fluss", "wildwasser"}


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def parse_args():
    """Parse CLI arguments and return (polygon_path, dry_run, target_slug, from_contentful)."""
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    if dry_run:
        args.remove('--dry-run')

    from_contentful = '--from-contentful' in args
    if from_contentful:
        args.remove('--from-contentful')

    target_slug = None
    if '--slug' in args:
        idx = args.index('--slug')
        if idx + 1 >= len(args):
            print("Error: --slug requires a value, e.g. --slug aare", file=sys.stderr)
            sys.exit(1)
        target_slug = args[idx + 1]
        del args[idx:idx + 2]

    if not args:
        print("Error: a GeoJSON polygon file is required as the first argument.", file=sys.stderr)
        print(f"Usage: python3 {sys.argv[0]} <polygon.geojson> [--dry-run] [--slug SLUG] [--from-contentful]",
              file=sys.stderr)
        sys.exit(1)

    polygon_path = args[0]
    if not os.path.isfile(polygon_path):
        print(f"Error: file not found: {polygon_path}", file=sys.stderr)
        sys.exit(1)

    return polygon_path, dry_run, target_slug, from_contentful


# ---------------------------------------------------------------------------
# Local cache readers
# ---------------------------------------------------------------------------

def load_waterways_cache():
    """Load _data/waterways.yml and return the list of waterway dicts."""
    path = os.path.join(DATA_DIR, 'waterways.yml')
    if not os.path.isfile(path):
        print(f"Error: local cache not found at {path}", file=sys.stderr)
        print("Run a Jekyll build first to populate the cache.", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return yaml.safe_load(f)


def load_entry_id_index():
    """Load _data/.contentful_sync_cache.yml and return slug -> entry_id map
    for waterway entries."""
    path = os.path.join(DATA_DIR, '.contentful_sync_cache.yml')
    if not os.path.isfile(path):
        print(f"Error: sync cache not found at {path}", file=sys.stderr)
        print("Run a Jekyll build first to populate the cache.", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        cache = yaml.safe_load(f)

    slug_to_id = {}
    for entry_id, info in (cache.get('entry_id_index') or {}).items():
        if info.get('content_type') == 'waterway':
            slug_to_id[info['slug']] = entry_id
    return slug_to_id


# ---------------------------------------------------------------------------
# Contentful Management API
# ---------------------------------------------------------------------------

def cma_headers():
    return {
        "Authorization": f"Bearer {CMA_TOKEN}",
        "Content-Type": "application/vnd.contentful.management.v1+json",
    }


def fetch_entry(entry_id):
    """Fetch a single entry from Contentful CMA."""
    url = f"{BASE_URL}/entries/{entry_id}"
    resp = requests.get(url, headers=cma_headers())
    if not resp.ok:
        print(f"ERROR fetching entry {entry_id}: {resp.status_code} {resp.text}",
              file=sys.stderr)
        return None
    return resp.json()


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


def build_type_slug_map():
    """Fetch paddlingEnvironmentType entries and build id -> slug map."""
    entries = fetch_entries("paddlingEnvironmentType")
    id_to_slug = {}
    for entry in entries:
        entry_id = entry["sys"]["id"]
        fields = entry.get("fields", {})
        slug_field = fields.get("slug", {})
        slug = next(iter(slug_field.values()), None) if slug_field else None
        if slug:
            id_to_slug[entry_id] = slug
    return id_to_slug


def get_slug(fields, locale):
    """Extract slug from CMA entry fields."""
    slug_field = fields.get("slug", {})
    return slug_field.get(locale) or slug_field.get("en") or "unknown"


def get_link_id(fields, field_name, locale):
    """Extract the linked entry ID from a reference field."""
    ref_field = fields.get(field_name, {})
    ref = ref_field.get(locale) or ref_field.get("en")
    if ref and isinstance(ref, dict):
        return ref.get("sys", {}).get("id")
    return None


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


def safe_shape(geo_dict):
    """Parse a GeoJSON dict into a valid Shapely geometry."""
    geom = shape(geo_dict)
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom


def extract_lines(geom):
    """Extract only LineString/MultiLineString parts from a geometry.

    Shapely's difference() can produce a GeometryCollection containing
    a mix of LineStrings and stray Points. This filters to lines only.
    """
    if isinstance(geom, (LineString, MultiLineString)):
        return geom

    if isinstance(geom, GeometryCollection):
        lines = [g for g in geom.geoms if isinstance(g, (LineString, MultiLineString))]
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


def load_polygon(path):
    """Load a GeoJSON file and return a Shapely polygon geometry.

    Accepts a bare Polygon/MultiPolygon geometry, a Feature, or a
    FeatureCollection (polygons are merged via unary_union).
    """
    with open(path) as f:
        data = json.load(f)

    geom_type = data.get("type")

    if geom_type in ("Polygon", "MultiPolygon"):
        return safe_shape(data)

    if geom_type == "Feature":
        return safe_shape(data["geometry"])

    if geom_type == "FeatureCollection":
        polys = []
        for feat in data.get("features", []):
            g = feat.get("geometry", {})
            if g.get("type") in ("Polygon", "MultiPolygon"):
                polys.append(safe_shape(g))
        if not polys:
            print("Error: FeatureCollection contains no Polygon/MultiPolygon features.",
                  file=sys.stderr)
            sys.exit(1)
        return unary_union(polys)

    print(f"Error: unsupported GeoJSON type '{geom_type}'. "
          "Expected Polygon, MultiPolygon, Feature, or FeatureCollection.", file=sys.stderr)
    sys.exit(1)


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
    return None


# ---------------------------------------------------------------------------
# Discovery helpers
# ---------------------------------------------------------------------------

def _preview_subtraction(slug, geo_dict, river_geom, subtract_poly):
    """Compute and print a preview of the subtraction result.

    Returns True and appends nothing on failure; the caller decides whether
    to append to the affected list based on the return value.
    """
    try:
        preview_geom = river_geom.difference(subtract_poly)
        preview_geom = extract_lines(preview_geom)
    except Exception as e:
        print(f"  {slug}: ERROR computing difference - {e}")
        return False

    if preview_geom.is_empty:
        print(f"  {slug}: geometry would be empty after subtraction - skipping")
        return False

    orig_length = river_geom.length
    cut_length = preview_geom.length
    pct = (cut_length / orig_length * 100) if orig_length > 0 else 0

    new_geo_dict = mapping(preview_geom)
    old_km = geometry_length_km(geo_dict)
    new_km = geometry_length_km(new_geo_dict)
    old_km_str = f"{round(old_km)} km" if old_km is not None else "?"
    new_km_str = f"{round(new_km)} km" if new_km is not None else "?"

    print(f"  {slug}: intersects polygon - {pct:.1f}% retained, "
          f"length {old_km_str} -> {new_km_str}, "
          f"{river_geom.geom_type} -> {preview_geom.geom_type}")
    return True


def _discover_from_cache(subtract_poly, target_slug):
    """Identify affected rivers using the local build cache (zero API calls)."""
    print("Loading local build cache...")
    waterways = load_waterways_cache()
    slug_to_entry_id = load_entry_id_index()
    print(f"  Loaded {len(waterways)} waterway rows from _data/waterways.yml")
    print(f"  Loaded {len(slug_to_entry_id)} waterway entry IDs from sync cache")
    print()

    # Deduplicate by slug (cache has one row per locale) and filter to rivers
    seen_slugs = set()
    rivers = []
    for row in waterways:
        slug = row.get('slug')
        if not slug or slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        if row.get('paddlingEnvironmentType_slug', '') not in RIVER_TYPE_SLUGS:
            continue
        rivers.append(row)

    print(f"  Found {len(rivers)} unique rivers in local cache")
    print()

    if target_slug:
        rivers = [r for r in rivers if r.get('slug') == target_slug]
        if not rivers:
            print(f"Error: no river found with slug '{target_slug}'", file=sys.stderr)
            sys.exit(1)
        print(f"  Filtered to {len(rivers)} river matching slug '{target_slug}'")
        print()

    print("Checking intersections against local geometry...")
    affected = []
    skipped_no_geo = 0
    skipped_no_intersect = 0

    for row in rivers:
        slug = row['slug']
        geo_str = row.get('geometry')
        if not geo_str:
            skipped_no_geo += 1
            continue

        geo_dict = parse_geometry(geo_str)
        if not geo_dict:
            skipped_no_geo += 1
            continue

        try:
            river_geom = safe_shape(geo_dict)
        except Exception as e:
            print(f"  {slug}: ERROR parsing cached geometry - {e}")
            continue

        if not river_geom.intersects(subtract_poly):
            skipped_no_intersect += 1
            continue

        entry_id = slug_to_entry_id.get(slug)
        if not entry_id:
            print(f"  {slug}: WARNING - no entry ID in sync cache, skipping")
            continue

        if _preview_subtraction(slug, geo_dict, river_geom, subtract_poly):
            affected.append((slug, entry_id))

    return affected, skipped_no_geo, skipped_no_intersect


def _discover_from_contentful(subtract_poly, target_slug):
    """Identify affected rivers by fetching all waterways from Contentful CMA."""
    print("Fetching paddlingEnvironmentType entries from Contentful...")
    type_slug_map = build_type_slug_map()
    print(f"  Found {len(type_slug_map)} type entries")
    print()

    print("Fetching all waterway entries from Contentful CMA...")
    waterways = fetch_entries("waterway")
    print(f"  Found {len(waterways)} waterway entries")
    print()

    # Filter to rivers
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
        if type_slug_map.get(type_id, "") in RIVER_TYPE_SLUGS:
            rivers.append(entry)

    print(f"  Found {len(rivers)} rivers")
    print()

    if target_slug:
        rivers = [
            e for e in rivers
            if any(v == target_slug for v in (e.get("fields", {}).get("slug", {}) or {}).values())
        ]
        if not rivers:
            print(f"Error: no river found with slug '{target_slug}'", file=sys.stderr)
            sys.exit(1)
        print(f"  Filtered to {len(rivers)} river matching slug '{target_slug}'")
        print()

    print("Checking intersections against Contentful geometry...")
    affected = []
    skipped_no_geo = 0
    skipped_no_intersect = 0

    for entry in rivers:
        entry_id = entry["sys"]["id"]
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
            print(f"  {slug}: ERROR parsing geometry - {e}")
            continue

        if not river_geom.intersects(subtract_poly):
            skipped_no_intersect += 1
            continue

        if _preview_subtraction(slug, geo_dict, river_geom, subtract_poly):
            affected.append((slug, entry_id))

    return affected, skipped_no_geo, skipped_no_intersect


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    polygon_path, dry_run, target_slug, from_contentful = parse_args()

    mode = "DRY RUN" if dry_run else "LIVE"
    source = "Contentful CMA" if from_contentful else "local cache"
    print(f"=== {mode} - {'no changes will be written' if dry_run else 'changes will be written to Contentful'} ===")
    print(f"=== Polygon file: {polygon_path} ===")
    print(f"=== Geometry source: {source} ===")
    if target_slug:
        print(f"=== Target: slug '{target_slug}' ===")
    print()

    # Load the subtraction polygon
    print("Loading polygon...")
    subtract_poly = load_polygon(polygon_path)
    print(f"  Loaded {subtract_poly.geom_type} "
          f"(bounds: {', '.join(f'{v:.4f}' for v in subtract_poly.bounds)})")
    print()

    # -----------------------------------------------------------------------
    # Discovery phase: build a list of (slug, entry_id) for affected rivers
    # -----------------------------------------------------------------------

    if from_contentful:
        affected, skipped_no_geo, skipped_no_intersect = \
            _discover_from_contentful(subtract_poly, target_slug)
    else:
        affected, skipped_no_geo, skipped_no_intersect = \
            _discover_from_cache(subtract_poly, target_slug)

    print()
    print(f"  {len(affected)} river(s) need updating, "
          f"{skipped_no_intersect} have no intersection, "
          f"{skipped_no_geo} have no geometry")
    print()

    if not affected:
        print("Nothing to do.")
        return

    if dry_run:
        print("=== Summary ===")
        print(f"  Would subtract & update: {len(affected)}")
        print(f"  Skipped (no geo):        {skipped_no_geo}")
        print(f"  Skipped (no intersect):  {skipped_no_intersect}")
        print(f"  Mode:                    {mode}")
        return

    # -----------------------------------------------------------------------
    # Update phase: fetch fresh entry, apply subtraction, update + publish
    # -----------------------------------------------------------------------
    print(f"Fetching {len(affected)} entries from Contentful and applying subtraction...")
    processed = 0
    errors = 0

    for idx, (slug, entry_id) in enumerate(affected):
        # Fetch current entry from CMA (need fresh version + locale fields)
        entry = fetch_entry(entry_id)
        if not entry:
            print(f"  [{idx+1}/{len(affected)}] {slug}: ERROR fetching from CMA - skipping")
            errors += 1
            continue

        version = entry["sys"]["version"]
        fields = entry.get("fields", {})
        geo_field = fields.get("geometry", {})

        # Build updated fields - apply subtraction for ALL locales
        updated_fields = dict(fields)
        updated_fields["geometry"] = {}
        any_changed = False
        new_length = None

        for loc in geo_field:
            loc_geo_dict = parse_geometry(geo_field[loc])
            if loc_geo_dict:
                try:
                    loc_geom = safe_shape(loc_geo_dict)
                    loc_cut = loc_geom.difference(subtract_poly)
                    loc_cut = extract_lines(loc_cut)
                    if not loc_cut.is_empty:
                        cut_mapped = mapping(loc_cut)
                        updated_fields["geometry"][loc] = cut_mapped
                        any_changed = True
                        # Recalculate length from the first locale we process
                        if new_length is None:
                            km = geometry_length_km(cut_mapped)
                            if km is not None:
                                new_length = round(km)
                    else:
                        updated_fields["geometry"][loc] = loc_geo_dict
                except Exception:
                    updated_fields["geometry"][loc] = loc_geo_dict
            else:
                updated_fields["geometry"][loc] = geo_field[loc]

        if not any_changed:
            print(f"  [{idx+1}/{len(affected)}] {slug}: no change after subtraction on live data - skipping")
            continue

        # Update length field for all locales
        if new_length is not None:
            length_field = fields.get("length", {})
            old_length = next(iter(length_field.values()), None) if length_field else None
            updated_fields["length"] = {}
            for loc in geo_field:
                updated_fields["length"][loc] = new_length
            length_msg = f", length {old_length} -> {new_length} km"
        else:
            length_msg = ""

        # PUT update
        resp = update_entry(entry_id, version, updated_fields)
        if not resp.ok:
            print(f"  [{idx+1}/{len(affected)}] {slug}: ERROR updating: {resp.status_code} {resp.text}")
            errors += 1
            continue

        # Publish
        new_version = resp.json()["sys"]["version"]
        pub_resp = publish_entry(entry_id, new_version)
        if pub_resp.ok:
            processed += 1
            print(f"  [{idx+1}/{len(affected)}] {slug}: updated & published{length_msg}")
        else:
            print(f"  [{idx+1}/{len(affected)}] {slug}: ERROR publishing: {pub_resp.status_code} {pub_resp.text}")
            errors += 1

        # Rate limiting
        time.sleep(0.25)

    print()
    print("=== Summary ===")
    print(f"  Subtracted & updated:   {processed}")
    print(f"  Skipped (no geo):       {skipped_no_geo}")
    print(f"  Skipped (no intersect): {skipped_no_intersect}")
    print(f"  Errors:                 {errors}")
    print(f"  CMA requests:           {len(affected) * 3} (fetch + update + publish)")
    print(f"  Mode:                   {mode}")


if __name__ == "__main__":
    main()
