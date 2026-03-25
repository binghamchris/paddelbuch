# Scripts

Utility scripts for the Paddel Buch project. These cover build-time asset preparation, icon generation, and one-off Contentful data processing tasks.

All scripts are run from the project root.

## Build Helper Scripts

### `copy-vendor-assets.js`

Copies third-party JS and CSS from `node_modules/` into `assets/js/vendor/` and `assets/css/vendor/` so the site has no external CDN dependencies at runtime.

```bash
node scripts/copy-vendor-assets.js
```

No options. Requires `npm install` to have been run first.

### `download-google-fonts.js`

Downloads Google Fonts (Fredoka and Quicksand) as self-hosted `.woff2` files and generates `assets/css/vendor/fonts.css`.

```bash
node scripts/download-google-fonts.js
```

No options. Requires internet access. Downloads only the `latin` subset for each weight.

### `generate_apple_touch_icon.py`

Generates a 180×180 Apple Touch Icon PNG from `assets/images/logo-favicon.svg`. Caches a SHA-256 checksum so the PNG is only regenerated when the source SVG changes.

```bash
python3 scripts/generate_apple_touch_icon.py
```

No options. Requires `rsvg-convert` (`brew install librsvg`).

## Contentful Geometry Scripts

These scripts modify waterway geometry data in Contentful via the Content Management API. They all read credentials from `.env.development` (`CONTENTFUL_SPACE_ID`, `CONTENTFUL_ENVIRONMENT`, `CONTENTFUL_MANAGEMENT_TOKEN`).

### `simplify_waterway_geometry.rb`

Simplifies waterway geometry using Douglas-Peucker (25 m tolerance, 6 decimal places). Copies the original geometry to `fullGeometry` before overwriting `geometry` with the simplified version.

```bash
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && \
  ruby scripts/simplify_waterway_geometry.rb [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing to Contentful |
| `--slug SLUG` | Process only the waterway with the given slug |

### `restore_geometry_from_full.rb`

Restores simplified geometry from `fullGeometry`. Re-applies Douglas-Peucker simplification from the original unclipped source of truth, effectively undoing any clipping that was applied to the `geometry` field.

```bash
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && \
  ruby scripts/restore_geometry_from_full.rb [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing to Contentful |
| `--slug SLUG` | Process only the waterway with the given slug |
| `--type TYPE` | Limit to a waterway type: `rivers` or `lakes` |

### `clip_waterways_to_switzerland.py`

Clips waterway geometries at the Swiss border using Shapely intersection. Skips waterways that are already fully inside Switzerland. Some border-running waterways (e.g. Rhein, Doubs) are excluded by default.

```bash
python3 scripts/clip_waterways_to_switzerland.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing to Contentful |
| `--slug SLUG` | Process only the waterway with the given slug |
| `--type TYPE` | Limit to a waterway type: `rivers` or `lakes` |

Dependencies: `pip3 install shapely requests python-dotenv`

### `cut_rivers_at_lakes.py`

Subtracts lake geometries from river geometries so rivers don't visually overlap lakes on the map. Uses Shapely `difference()` and filters the result to retain only line geometries.

```bash
python3 scripts/cut_rivers_at_lakes.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing to Contentful |
| `--slug SLUG` | Process only the river with the given slug |

Dependencies: `pip3 install shapely requests python-dotenv`

### `recalculate_river_lengths.py`

Recalculates the `length` field for rivers from their GeoJSON geometry using geodesic distance (WGS84 ellipsoid). Only processes waterways where `navigableByPaddlers` is not `false`. Skips entries whose length already matches the calculated value.

Uses server-side filtering (`fields.navigableByPaddlers[ne]=false`), field selection (`select=`), and JSON Patch (`PATCH`) to minimise API quota usage.

```bash
python3 scripts/recalculate_river_lengths.py [OPTIONS]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without writing to Contentful |
| `--slug SLUG` | Process only the river with the given slug |

Dependencies: `pip3 install pyproj requests python-dotenv`

### `clip_geometry_to_switzerland.py`

Standalone CLI tool to clip any GeoJSON file to the Swiss border. Not Contentful-specific — operates on local files.

```bash
python3 scripts/clip_geometry_to_switzerland.py <input.geojson> [output.geojson]
```

| Argument | Description |
|----------|-------------|
| `input.geojson` | Path to the input GeoJSON file (required) |
| `output.geojson` | Path for the clipped output (optional; defaults to `<input>_clipped.geojson`) |

Dependencies: `pip3 install shapely requests`

## Cache

The `.cache/` subdirectory stores a downloaded copy of the Swiss border GeoJSON used by the clipping scripts. It is populated automatically on first run and can be safely deleted to force a re-download.
