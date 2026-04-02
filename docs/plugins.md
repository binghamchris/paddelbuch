# Jekyll Plugin Reference

Paddel Buch uses 20 custom Jekyll plugins in `_plugins/`. This document describes each plugin's purpose, configuration, inputs, outputs, and dependencies.

## Plugin Execution Order

Plugins run in priority order. Hooks run at specific lifecycle points.

| Phase | Plugin | Priority / Hook |
|-------|--------|-----------------|
| `after_init` | `EnvLoader` | Site hook |
| `after_init` | `BuildTimer` | Site hook |
| `after_init` | `I18nPatch` | Site hook |
| `after_init` | `SSLPatch` | Load-time |
| Generate | `ContentfulFetcher` | `:highest` |
| Generate | `CollectionGenerator` | `:high` |
| Generate | `ColorGenerator` | `:high` |
| Generate | `PrecomputeGenerator` | `:normal` |
| Generate | `DashboardMetricsGenerator` | `:normal` |
| Generate | `StatisticsMetricsGenerator` | `:normal` |
| Generate | `ApiGenerator` | `:low` |
| Generate | `TileGenerator` | `:low` |
| Generate | `SitemapGenerator` | `:low` |
| Generate | `FaviconGenerator` | `:low` |

---

## Generators

### ContentfulFetcher

**File:** `contentful_fetcher.rb`
**Priority:** `:highest`
**Purpose:** Fetches content from the Contentful CMS and writes it to `_data/` as YAML files.

**Configuration:**
- `CONTENTFUL_SPACE_ID` (env var) — Contentful space ID
- `CONTENTFUL_ACCESS_TOKEN` (env var) — Contentful API token
- `CONTENTFUL_ENVIRONMENT` (env var, default: `master`) — Contentful environment
- `CONTENTFUL_FORCE_SYNC` (env var) — Set to `true` to force a full re-fetch
- `force_contentful_sync` (`_config.yml`) — Set to `true` to force a full re-fetch
- `skip_contentful_fetch` (`_config.yml`) — Set to `true` to skip fetching (used by locale-specific builds)

**Inputs:** Contentful API (remote)

**Outputs:**
- `_data/spots.yml`, `_data/waterways.yml`, `_data/obstacles.yml`, `_data/protected_areas.yml`, `_data/notices.yml`, `_data/static_pages.yml`
- `_data/types/*.yml` (dimension tables)
- `_data/.contentful_sync_cache.yml` (sync state)
- `site.config['contentful_data_changed']` (boolean flag for downstream plugins)

**Dependencies:** `SyncChecker`, `CacheMetadata`, `ContentfulMappers`, `BatchFetcher`

**Sync strategy:**
1. If `skip_contentful_fetch` is true: skips entirely (parallel build mode)
2. If force sync requested: full fetch
3. If no valid cache: full fetch
4. If environment mismatch: full fetch
5. Otherwise: incremental sync check via Contentful Sync API
6. If no changes: uses cached data, sets `contentful_data_changed = false`
7. If changes and delta items classifiable: attempts delta merge first
   - Groups changed entry IDs by content type and fetches them in batches via `BatchFetcher.fetch_changed_entries_batched`, using `client.entries()` with `sys.id[in]` filtering — reducing HTTP requests from O(N) per-entry to O(C) per-content-type
   - Falls back to individual `client.entry()` calls per entry if a batch request fails
   - Maps through `ContentfulMappers.flatten_entry` and upserts rows in YAML data files
   - Looks up deleted entries in Entry ID Index and removes rows
   - Falls back to full fetch if any step fails
8. If changes but no classifiable delta items: full fetch
9. Computes content hash and sets `contentful_data_changed` flag

---

### CollectionGenerator

**File:** `collection_generator.rb`
**Priority:** `:high`
**Purpose:** Creates Jekyll collection documents from the YAML data files written by `ContentfulFetcher`. Jekyll collections require documents in their collection directories to generate pages — this plugin bridges that gap by creating virtual `Jekyll::Document` objects.

**Configuration:** None (reads from `site.data` populated by `ContentfulFetcher`)

**Inputs:** `site.data['spots']`, `site.data['waterways']`, `site.data['obstacles']`, `site.data['notices']`, `site.data['static_pages']`

**Outputs:** Virtual `Jekyll::Document` objects added to each collection. Pre-computes per-document fields:
- Spots: resolved type name, craft type names, icon name/alt text, waterway name
- Obstacles: resolved type name, waterway name, geometry centre point, exit/re-entry spots
- Waterways: active event notices
- Notices: resolved waterway objects

**Exclusions:** Whitewater waterways (`paddlingEnvironmentType_slug == 'wildwasser'`) and non-navigable waterways (`navigableByPaddlers == false`) are excluded from page generation. Obstacles linked to these waterways are also excluded.

**Dependencies:** `ContentfulFetcher` (must run first to populate `site.data`)

---

### ColorGenerator

**File:** `color_generator.rb`
**Priority:** `:high`
**Purpose:** Parses SCSS colour variables from `_sass/settings/_paddelbuch_colours.scss` and exposes them as `site.data['paddelbuch_colors']` for use in JavaScript via CSS custom properties.

**Inputs:** `_sass/settings/_paddelbuch_colours.scss`

**Outputs:** `site.data['paddelbuch_colors']` — a hash of camelCase colour names to hex values

**Dependencies:** None

---

### PrecomputeGenerator

**File:** `precompute_generator.rb`
**Priority:** `:normal`
**Purpose:** Pre-computes site-level data that is identical across all pages within a locale, avoiding redundant computation during Liquid rendering. Runs once per language pass.

**Outputs:**
- `site.data['nav_top_lakes']` — Top 10 lakes by area, sorted alphabetically
- `site.data['nav_top_rivers']` — Top 10 rivers by length, sorted alphabetically
- `site.data['nav_open_data_pages']` — Static pages for the Open Data menu
- `site.data['nav_about_pages']` — Static pages for the About menu
- `site.data['map_data_config_json']` — JSON string with filter dimensions, layer labels
- `site.data['layer_control_config_json']` — JSON string with layer control config
- `site.config['locale_prefix']` — Empty string for `de`, `/en` for `en`

**Dependencies:** `CollectionGenerator` (needs populated `site.data`)

---

### ApiGenerator

**File:** `api_generator.rb`
**Priority:** `:low`
**Purpose:** Generates the public JSON API files. Produces fact tables (spots, obstacles, waterway events, protected areas, waterways) and dimension tables (types) per locale, plus a `lastUpdateIndex.json` with timestamps.

**Outputs:**
- `api/{table}-{locale}.json` — Per-locale JSON files for each fact and dimension table
- `api/lastUpdateIndex.json` — Timestamps for all tables
- `site.data['last_updates']` — Exposed to Liquid for rendering timestamps on the API page

**Caching:** Uses `_data/.api_cache/` to skip regeneration when `contentful_data_changed` is `false`.

**Dependencies:** `ContentfulFetcher` (data), `GeneratorCache` (caching mixin)

**Note:** The API output format maintains backward compatibility with the project's previous Gatsby-based API. Transformer methods wrap fields in structures like `{"raw": "..."}` and `{"internal": {"content": "..."}}` to match the legacy schema.

---

### TileGenerator

**File:** `tile_generator.rb`
**Priority:** `:low`
**Purpose:** Generates spatial tile files for viewport-based map data loading. Divides Switzerland into a grid and assigns each data item to its tile based on location.

**Configuration (constants):**
- `SWITZERLAND_BOUNDS` — Bounding box: north 47.8°, south 45.8°, east 10.5°, west 5.9°
- `TILE_SIZE` — 0.25° latitude × 0.46° longitude per tile
- Grid size: 10 columns × 8 rows

**Outputs:**
- `api/tiles/{layer}/{locale}/index.json` — Tile index with bounds and item counts
- `api/tiles/{layer}/{locale}/{x}_{y}.json` — Individual tile data (non-empty tiles only)

**Layers:** `spots`, `notices`, `obstacles`, `protected`

**Exclusions:** Obstacles linked to whitewater waterways (`paddlingEnvironmentType_slug == 'wildwasser'`) or non-navigable waterways (`navigableByPaddlers == false`) are excluded from obstacle tiles.

**Caching:** Uses `_data/.tile_cache/` to skip regeneration when `contentful_data_changed` is `false`.

**Dependencies:** `ContentfulFetcher` (data), `GeneratorCache` (caching mixin)

---

### DashboardMetricsGenerator

**File:** `dashboard_metrics_generator.rb`
**Priority:** `:normal`
**Purpose:** Pre-computes data quality dashboard metrics at build time. Computes freshness (median age + colour gradient) and coverage (segment classification) metrics for every waterway, then exposes them as JSON for the frontend dashboards.

**Inputs:** `site.data['spots']`, `site.data['waterways']`, `site.data['paddelbuch_colors']`

**Outputs:**
- `site.data['dashboard_freshness_metrics']` — Per-waterway freshness data (median age, colour, spot count)
- `site.data['dashboard_coverage_metrics']` — Per-waterway coverage segments (covered/uncovered GeoJSON)

**Caching:** Uses the compute-once-cache-across-locales pattern. Numerical computations run once on the first locale pass and are cached in class-level variables. Subsequent locale passes only swap in localised waterway names.

**Exclusions:** Wildwasser waterways and non-navigable waterways (`navigableByPaddlers == false`) are excluded from metrics.

**Dependencies:** `ContentfulFetcher` (data), `ColorGenerator` (colour palette)

---

### StatisticsMetricsGenerator

**File:** `statistics_metrics_generator.rb`
**Priority:** `:normal`
**Purpose:** Pre-computes statistics dashboard metrics at build time. Computes counts for spots (by type), obstacles (by portage route), protected areas (by type), paddle craft types, data source types, and data license types. Also computes spot freshness map data (per-spot coordinates, age, and category) and obstacle portage route map data.

**Inputs:** `site.data['spots']`, `site.data['obstacles']`, `site.data['protected_areas']`, `site.data['waterways']`, `site.data['types/*']`

**Outputs:**
- `site.data['dashboard_statistics_metrics']` — Localised statistics counts per section
- `site.data['dashboard_spot_freshness_map_data']` — Per-spot freshness data with coordinates for map rendering
- `site.data['dashboard_obstacle_portage_map_data']` — Per-obstacle portage route data with coordinates for map rendering

**Exclusions:** Obstacles linked to whitewater waterways (`paddlingEnvironmentType_slug == 'wildwasser'`) or non-navigable waterways (`navigableByPaddlers == false`) are excluded from statistics and portage map data.

**Caching:** Uses the same compute-once-cache-across-locales pattern as `DashboardMetricsGenerator`.

**Dependencies:** `ContentfulFetcher` (data)

---

### SitemapGenerator

**File:** `sitemap_generator.rb`
**Priority:** `:low`
**Purpose:** Generates XML sitemap files following the sitemaps.org protocol. Produces bilingual URLs (German at root, English under `/en/`).

**Outputs:**
- `sitemap-index.xml` — Sitemap index referencing sub-sitemaps
- `sitemap-{N}.xml` — Sub-sitemaps (max 50,000 URLs each)

**Excluded pages:** 404, assets, API files, pages with `sitemap: false`

**Dependencies:** `CollectionGenerator` (needs populated collections)

---

### FaviconGenerator

**File:** `favicon_generator.rb`
**Priority:** `:low`
**Purpose:** Copies the SVG favicon to `/favicon.ico` and the Apple Touch Icon PNG to `/apple-touch-icon.png` at the site root.

**Inputs:**
- `assets/images/logo-favicon.svg`
- `assets/images/apple-touch-icon.png`

**Dependencies:** None. The PNG is pre-generated and checked into the repo. Regenerate with `python3 scripts/generate_apple_touch_icon.py` if the SVG changes.

---

## Hooks and Patches

### EnvLoader

**File:** `env_loader.rb`
**Hook:** `:site, :after_init`
**Purpose:** Loads environment variables from `.env` files into `ENV` and maps them to Jekyll site config.

**Priority chain (highest wins):**
1. System environment variables
2. `.env.{JEKYLL_ENV}` file (e.g. `.env.development`)
3. `.env` file

**Mapped variables:**
| Env Var | Site Config |
|---------|-------------|
| `CONTENTFUL_SPACE_ID` | `site.contentful.spaces[0].space` |
| `CONTENTFUL_ACCESS_TOKEN` | `site.contentful.spaces[0].access_token` |
| `CONTENTFUL_ENVIRONMENT` | `site.contentful.spaces[0].environment` |
| `MAPBOX_URL` | `site.mapbox_url` |
| `SITE_URL` | `site.url` |

---

### BuildTimer

**File:** `build_timer.rb`
**Hook:** Multiple site hooks + `Site.prepend`
**Purpose:** Instruments the Jekyll build to track time spent in each phase (translation loading, rendering, writing) per language pass. Output appears inline with Jekyll's messages.

---

### I18nPatch

**File:** `i18n_patch.rb`
**Hook:** `:site, :after_init`
**Purpose:** Patches `jekyll-multiple-languages-plugin` 1.8.x for Ruby 3.4+ compatibility. Ruby 3.4 removed `String.new(nil)`, which the plugin's `TranslatedString` class relied on. This patch converts `nil` to an empty string.

**Version guard:** Only applies when the plugin version starts with `1.8`. Skips and logs a warning for other versions.

---

### SSLPatch

**File:** `ssl_patch.rb`
**Hook:** Load-time (runs when the file is loaded)
**Purpose:** Fixes CRL verification errors on macOS with Ruby 3.4+ / OpenSSL 3.x during local development. Monkey-patches `HTTP::Connection#start_tls` to disable CRL checking while keeping `VERIFY_PEER` mode.

**Activation conditions (all must be true):**
1. `JEKYLL_ENV` is `development` (the default)
2. Ruby ≥ 3.4 or OpenSSL 3.x detected
3. `HTTP::Connection#start_tls` is defined (http gem loaded)

Skipped entirely in production/CI environments.

---

## Liquid Filters

### LocaleFilter

**File:** `locale_filter.rb`
**Purpose:** Provides Liquid filters for locale-aware data filtering and date formatting.

**Filters:**
- `filter_by_locale` — Filter an array by locale: `{{ site.data.spots | filter_by_locale: site.lang }}`
- `localized_data` — Get locale-specific data: `{{ site.data | localized_data: 'spots', site.lang }}`
- `localized_date` — Format a date per locale: `{{ page.date | localized_date }}`
- `localized_datetime` — Format a datetime per locale: `{{ page.date | localized_datetime }}`
- `matches_locale` — Check if an item matches the current locale

**Date formats:** `DD MMM YYYY` with localised month abbreviations (e.g. "Mär" for March in German).

---

### WaterwayFilters

**File:** `waterway_filters.rb`
**Purpose:** Provides Liquid filters for waterway menu sorting and list pages.

**Filters:**
- `top_lakes_by_area` — Top N lakes by area, then alphabetical: `{{ site.data.waterways | top_lakes_by_area: site.lang, 10 }}`
- `top_rivers_by_length` — Top N rivers by length, then alphabetical
- `sort_waterways_alphabetically` — Alphabetical sort by name
- `lakes_alphabetically` — All lakes for a locale, alphabetical
- `rivers_alphabetically` — All rivers for a locale, alphabetical

---

## Support Modules

### ContentfulMappers

**File:** `contentful_mappers.rb`
**Purpose:** Transforms Contentful entries into Jekyll-friendly hashes. Each content type has a mapper method (`map_spot`, `map_waterway`, etc.) that extracts and normalises fields. The `flatten_entry` method produces one hash per locale from entries fetched with `locale: '*'`.

**Key features:**
- Rich text rendering: converts Contentful rich text documents to HTML (paragraphs, lists, headings, tables, marks, hyperlinks)
- HTML sanitisation: escapes special characters, validates URI schemes
- Locale fallback: resolves fields per locale with `de → en` fallback chain
- Raw serialisation: preserves raw rich text JSON for API output alongside rendered HTML

### SyncChecker

**File:** `sync_checker.rb`
**Purpose:** Wraps the Contentful Sync API. Provides `check_for_changes` (incremental sync) and `initial_sync` (full sync) methods that return a `SyncResult` struct.

**`SyncResult` struct fields:**
- `success` — Boolean, whether the sync API call succeeded
- `has_changes` — Boolean, whether the delta contains any items
- `new_token` — String, new sync token for next incremental sync
- `items_count` — Integer, total number of items in the delta
- `error` — Exception or `nil`
- `changed_entries` — Hash `{ content_type_id => [entry, ...] }` of entries to upsert
- `deleted_entries` — Hash `{ content_type_id => [entry, ...] }` of entries to remove
- `unknown_content_types` — Array of content type IDs found in delta but not in `CONTENT_TYPES`

**`check_for_changes` method:**
- Signature: `check_for_changes(client, sync_token, known_content_types = nil, entry_id_index = {})`
- When `known_content_types` is provided, classifies delta items by `sys.type` (`Entry` → changed, `DeletedEntry` → deleted, `Asset`/`DeletedAsset` → ignored) and groups by content type ID
- `DeletedEntry` items from the Sync API do not carry `sys.contentType`. When the content type is missing, the method falls back to the `entry_id_index` to resolve the content type by entry ID. Entries that cannot be resolved are skipped.
- Entries with unknown content type IDs are excluded and collected in `unknown_content_types`
- When `known_content_types` is `nil`, maintains backward-compatible behavior (no delta classification)

### BatchFetcher

**File:** `batch_fetcher.rb`
**Purpose:** Provides batch-optimized entry fetching for delta sync using `sys.id[in]` filtering. Groups changed entry IDs by content type and fetches them in batched `client.entries()` calls, reducing HTTP requests from O(N) per-entry to O(C) per-content-type. Falls back to individual `client.entry()` calls on failure.

**Public method:**
- `fetch_changed_entries_batched(client, changed_entries)` — Returns `{ content_type_id => [Contentful::Entry, ...] }`

**Constants:**
- `ID_BATCH_SIZE = 300` — Max entry IDs per `sys.id[in]` filter (derived from CDA URI length limit of ~7600 chars)
- `PAGE_SIZE = 1000` — CDA max entries per response; triggers pagination when reached

**Private methods:** `fetch_content_type_batch`, `fetch_sub_batch`, `fetch_entries_individually`

### CacheMetadata

**File:** `cache_metadata.rb`
**Purpose:** Persists sync state between builds. Stores sync token, timestamp, space/environment IDs, a SHA-256 content hash, and the Entry ID Index in `_data/.contentful_sync_cache.yml`.

**`entry_id_index` field:** Persistent mapping of Contentful `sys.id` → `{ slug, content_type }` used to locate entries in YAML data files for deletion (deleted entries from Contentful contain only `sys` metadata, no `fields` or `slug`).

**Index methods:**
- `add_to_entry_id_index(entry_id, slug, content_type)` — adds or updates an entry in the index
- `remove_from_entry_id_index(entry_id)` — removes an entry from the index
- `lookup_entry_id(entry_id)` — returns `{ 'slug' => ..., 'content_type' => ... }` or `nil`

### GeneratorCache

**File:** `generator_cache.rb`
**Purpose:** Mixin module providing file-based caching for `ApiGenerator` and `TileGenerator`. Methods: `cache_available?`, `write_cache_file`, `read_cache_files`, `clear_cache`, `get_data_for_locale`.
