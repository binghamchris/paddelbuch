# Frontend Guide

Paddel Buch's frontend is vanilla JavaScript with no build toolchain (no Webpack, no Babel, no framework). Scripts are loaded via `<script>` tags in Jekyll layouts and communicate through global functions and the DOM.

## Vendor Assets

Third-party libraries are installed via npm but served locally (no CDN dependencies at runtime):

| Library | Version | Purpose |
|---------|---------|---------|
| Bootstrap | 5.3.x | CSS framework and JS components |
| Leaflet | 1.9.x | Interactive map rendering |
| Leaflet.locatecontrol | 0.89.x | "Locate me" button on the map |
| MapLibre GL JS | 4.x | Vector tile rendering for dashboard maps (Positron basemap) |
| leaflet-maplibre-gl | 0.0.x | Bridge plugin to use MapLibre GL layers inside Leaflet maps |
| Chart.js | 4.5.x | Canvas-based chart rendering for statistics dashboards |

### Asset Pipeline

Two Node.js scripts manage vendor assets during the build:

- `scripts/copy-vendor-assets.js` — Copies Bootstrap JS, Leaflet JS/CSS/images, and Leaflet.locatecontrol to `assets/js/vendor/` and `assets/css/vendor/`
- `scripts/download-google-fonts.js` — Downloads Google Fonts (Fredoka, Quicksand) as self-hosted woff2 files and generates `assets/css/vendor/fonts.css`

Both run during the Amplify preBuild phase (`npm run copy-assets` and `npm run download-fonts`). For local development, run them after `npm install`:

```bash
npm run download-fonts
npm run copy-assets
```

## JavaScript Modules

All modules live in `assets/js/`. They are plain scripts that attach functions to the global scope or operate on DOM elements.

### Map Core

| Module | Purpose |
|--------|---------|
| `paddelbuch-map.js` | Creates the Leaflet map instance, sets Swiss bounds, adds tile layer and locate control |
| `map-data-init.js` | Orchestrates layer creation, tile-based data loading, filter setup (including `spotTipType` match function), and layer control |
| `data-loader.js` | Fetches spatial tile JSON files based on the current map viewport |
| `spatial-utils.js` | GeoJSON geometry utilities (centroid calculation, bounds checking) |

### Filtering System

| Module | Purpose |
|--------|---------|
| `filter-engine.js` | Core filter logic: multi-dimension AND filtering across spot type, paddle craft type, spot tip type, and semantic search |
| `filter-panel.js` | Renders the filter toggle UI panel and handles user interactions |
| `semantic-search.js` | Free-text semantic search over spots, expressed as a filter dimension so it AND-combines with the checkbox dimensions. See "Semantic Search" below |
| `layer-control.js` | Custom Leaflet control for toggling map layers, includes date-based event notice filtering and the SVG halo Composite_Icon builder for spots with tip types |
| `zoom-layer-manager.js` | Shows/hides detail layers (obstacles, protected areas) based on zoom level (threshold: zoom 12) |

### Popups and Markers

| Module | Purpose |
|--------|---------|
| `spot-popup.js` | Generates HTML for spot marker popups |
| `obstacle-popup.js` | Generates HTML for obstacle marker popups |
| `event-notice-popup.js` | Generates HTML for event notice popups |
| `marker-registry.js` | Deduplicates markers by slug, manages marker add/remove lifecycle |
| `marker-styles.js` | Defines Leaflet icon styles per spot type (entry/exit, entry-only, etc.), the tip modifier configuration (`TIP_MODIFIER_CONFIG`), and the SVG Composite_Icon builder (`buildTipModifierSvg`) plus the palette colour resolver (`resolveTipColor`) |
| `layer-styles.js` | Defines colours and styles for GeoJSON layers (obstacles, protected areas, notices) |

### Utilities

| Module | Purpose |
|--------|---------|
| `date-utils.js` | Locale-aware date formatting (de-CH: `DD.MM.YYYY`, en-GB: `DD/MM/YYYY`) |
| `html-utils.js` | HTML escaping and sanitisation helpers |
| `color-vars.js` | Reads CSS custom properties set by the `ColorGenerator` Jekyll plugin |
| `locale-filter.js` | Client-side locale detection from the URL path |
| `clipboard.js` | Copy-to-clipboard for GPS coordinates and addresses |

### Detail Page Maps

| Module | Purpose |
|--------|---------|
| `spot-map.js` | Map for spot detail pages (single marker) |
| `waterway-map.js` | Map for waterway detail pages (GeoJSON geometry) |
| `obstacle-map.js` | Map for obstacle detail pages (geometry + portage route) |
| `notice-map.js` | Map for event notice detail pages (affected area) |
| `home-map.js` | Main homepage map with all layers |

### Data Quality Dashboards

| Module | Purpose |
|--------|---------|
| `dashboard-data.js` | Parses JSON data blocks embedded in the page for dashboard consumption |
| `dashboard-map.js` | Creates Leaflet map instances with Positron vector tiles (via MapLibre GL) for dashboard views |
| `dashboard-switcher.js` | Tab-style switcher that auto-discovers dashboard containers and toggles visibility |
| `coverage-dashboard.js` | Waterway coverage dashboard: renders covered/uncovered GeoJSON segments on a map |
| `freshness-dashboard.js` | Waterway freshness dashboard: renders waterways coloured by median spot age |
| `spot-freshness-dashboard.js` | Spot freshness dashboard: Chart.js doughnut chart + map markers with SVG shapes per age category |
| `statistics-dashboard.js` | Statistics dashboard: Chart.js horizontal bar charts for spot types, obstacles, protected areas, craft types |
| `obstacle-portage-dashboard.js` | Obstacle portage routes dashboard: renders portage route data on a map |

## Map Initialisation Flow

On the homepage, the map initialisation follows this sequence:

1. `paddelbuch-map.js` creates the Leaflet map with Swiss bounds and the tile layer
2. `map-data-init.js` reads the `mapDataConfig` JSON (injected by `PrecomputeGenerator`) and:
   - Creates Leaflet layer groups for each data layer (spots by type, obstacles, protected areas, notices)
   - Initialises the `data-loader` with the tile index URL
   - Sets up the `filter-engine` with dimension configs (spot type, paddle craft type)
   - Creates the `filter-panel` UI
   - Attaches the `layer-control` with toggle checkboxes
   - Registers the `zoom-layer-manager` to show detail layers at zoom ≥ 12
3. On map move/zoom, `data-loader.js` calculates which tiles overlap the viewport, fetches any unfetched tiles, and passes the data to marker creation functions
4. `marker-registry.js` deduplicates markers (same slug = same marker) and adds them to the appropriate layer group
5. `filter-engine.js` applies active filters by showing/hiding markers based on their spot type, paddle craft type, and spot tip type attributes

## Marker tip modifiers (the Composite_Icon)

Spots that carry one or more advisory tips are drawn with a **Composite_Icon**: a single
inline `<svg>` Leaflet `DivIcon` that composes the base marker pin with an open **Halo**
(a horseshoe arc hugging the pin head from shoulder to shoulder, open at the bottom so the
neck stays clear) and one **Bead** per tip, each Bead carrying the tip's glyph (a green leaf
for the Eco tip, a navy cross for the Swiss Canoe tip). This redesign superseded the earlier
floating corner-disc badges, which obscured the pin head and relied on CSP-blocked inline
`style` offsets.

Key pieces:

- **`marker-styles.js` — `TIP_MODIFIER_CONFIG`** is the single authoritative map from each
  tip slug to its glyph asset and colour. Each entry is
  `{ glyphUrl, colorKey, colorFallback }` — no per-tip position/size offsets (Bead and Halo
  geometry is computed from the number and order of applicable tips, not stored per tip).
  - `glyphUrl` points at `assets/images/markers/tip-modifier-{slug}.svg` (glyph only,
    transparent background — the Bead disc is drawn by the SVG, not the asset).
  - `colorKey` indexes `window.PaddelbuchColors` (the palette single source of truth generated
    from `_sass/settings/_paddelbuch_colours.scss`; the generator emits camelCase keys, so
    `$green-1` → `green1` and `$swisscanoe-blue` → `swisscanoeBlue`).
  - `colorFallback` mirrors the palette token as a hard-coded hex so the marker still renders
    in the correct colour if the palette is unavailable.
- **`marker-styles.js` — `resolveTipColor(cfg)`** resolves `PaddelbuchColors[cfg.colorKey]`,
  falling back to `cfg.colorFallback`.
- **`marker-styles.js` — `buildTipModifierSvg(baseIconUrl, tipSlugs, ariaLabel)`** builds the
  Composite_Icon markup. It filters the slugs to those with a config entry (unknown slugs are
  skipped), caps at two tips (a bounded, documented fallback with a single extension point for
  a future 3+ layout), and positions every part with SVG geometry and presentation attributes
  only — **no inline `style`** — so it is CSP-clean. It also sets `role="img"` and an escaped
  `aria-label`. `getCompositeIconSizing()` derives the `DivIcon` `iconSize`/`iconAnchor`/
  `popupAnchor` from the geometry and scale so a tipped pin renders at the same on-screen size
  as a standard marker and stays anchored at the pin tip.
- **`layer-control.js` — `createCompositeIcon(baseIconUrl, tipSlugs, ariaLabel)`** wraps the
  markup from `buildTipModifierSvg` in an `L.divIcon` (`className: 'composite-marker-icon'`),
  returning `null` when no tips apply so `addSpotMarker` falls back to the standard icon.
  `addSpotMarker` builds the localised accessible label from `spot.name` plus the localised tip
  names (sourced from build-time config via `layer-control-config`, not hard-coded in JS).

The approved visual specification (exact geometry, sizing, and colours) lives in the reference
mockup [`marker-modifier-mockups.html`](../.kiro/specs/spot-tip-marker-redesign/reference/marker-modifier-mockups.html)
(symbols `m-opt3b`, `m-opt3b-1tip`, `m-opt3b-rest`) — open it directly in a browser. It is the
visual source of truth for the marker tip design; the geometry constants are held in
`COMPOSITE_GEOMETRY` in `marker-styles.js`. Sizes are tuned for on-map legibility: the pin
head is a circle at (26,26) r25, the Halo is a larger concentric open ring (r34) leaving a
clear gap around the head, and the Beads sit just beyond the halo's outer edge (~42 from the
head centre) so their inner edge reads clearly without covering the pin icon.

The same Bead glyphs are surfaced in the Filter_Panel "Spot Tips" section: each tip option
renders the glyph inside a **filter bead** (a white disc with a coloured border matching the
tip palette — `.filter-icon-bead` / `.filter-icon-bead--{slug}`), mirroring the map markers.
The glyph path and bead class are attached to the `spotTipType` dimension options in
`precompute_generator.rb` (kept in sync with `TIP_MODIFIER_CONFIG`); the synthetic
`__no_tips__` option carries no icon.

## Includes

### spot-tip-banners.html

The `_includes/spot-tip-banners.html` partial renders advisory tip banners on spot detail pages. For each spot tip type associated with a spot, it renders a Bootstrap alert with:
- A CSS class `alert-spot-tip-{slug}` for per-type styling
- An SVG icon from `assets/images/tips/tip-banner-{slug}.svg`
- The localised tip type name
- The rich text description (when present)

Included conditionally in `_layouts/spot.html` when `page.spot_tip_types` is non-empty.

## Colour System

Colours are defined in SCSS (`_sass/settings/_paddelbuch_colours.scss`) and made available to JavaScript through a two-step process:

1. `ColorGenerator` (Jekyll plugin) parses the SCSS file and writes colour values to `site.data['paddelbuch_colors']`
2. The `color-vars.html` include outputs CSS custom properties (`--pb-color-name: #hex`)
3. `color-vars.js` reads these CSS custom properties at runtime for use in JavaScript (e.g., layer styles)

This ensures a single source of truth for colours across SCSS, HTML, and JavaScript.

## SCSS Structure

```
_sass/
├── settings/
│   ├── _colors.scss                 ← Bootstrap colour overrides
│   ├── _paddelbuch_colours.scss     ← Project-specific colours (source of truth)
│   ├── _dimensions.scss             ← Spacing, sizing variables
│   ├── _fonts.scss                  ← Font family definitions
│   └── _settings.scss               ← Barrel file
├── util/
│   ├── _helpers.scss                ← Utility classes
│   └── _util.scss                   ← Barrel file
├── components/
│   ├── _header.scss                 ← Site navigation
│   ├── _map.scss                    ← Map container and controls
│   ├── _filter-panel.scss           ← Filter panel UI
│   ├── _container.scss              ← Layout containers
│   ├── _waterway-list.scss          ← Waterway list pages
│   ├── _dashboard-legend.scss       ← Shared legend styles for data quality dashboards
│   ├── _dashboard-switcher.scss     ← Dashboard tab switcher styles
│   ├── _statistics-dashboard.scss   ← Statistics dashboard chart and figure layout
│   └── _components.scss             ← Barrel file
└── pages/
    ├── _home.scss                   ← Homepage
    ├── _spot-details.scss           ← Spot detail pages (includes spot tip banner styles)
    ├── _waterway-details.scss       ← Waterway detail pages
    ├── _obstacle-details.scss       ← Obstacle detail pages
    ├── _notice-details.scss         ← Notice detail pages
    ├── _lakes.scss, _rivers.scss    ← Waterway list pages
    ├── _api.scss                    ← API documentation page
    ├── _static.scss                 ← CMS-driven static pages
    └── _pages.scss                  ← Barrel file
```

The main entry point is `assets/css/application.scss`, which imports Bootstrap and then the project's settings, utilities, components, and page styles.

## Semantic Search

Free-text search over spots on the home-page map, backed by the separate
`paddelbuch-searchengine` service (API Gateway + Lambda + Bedrock Titan
embeddings + a DynamoDB vector store).

### How it fits the filter system

Search is a **filter dimension**, not a separate rendering path. The module turns
a query into a set of spot slugs, hands that set to `filter-engine.js` via
`setDimensionSelection('search', slugs)`, and the engine's existing AND
evaluation does the rest. A marker is visible only when it matches the search AND
every active checkbox dimension.

Two consequences worth knowing:

- **An empty selection means "inactive", not "match nothing".** That is the
  engine's pre-existing convention, and search relies on it: clearing the box, a
  too-short query, a zero-result query, and a failed request all converge on an
  empty set and all correctly restore the checkbox-only view.
- **The search dimension is registered with the engine but not the panel.** It
  has no options, so rendering it as a fieldset would produce an empty box. That
  asymmetry lives in `map-data-init.js`.

Search results also drive `map.fitBounds`. This is functional, not cosmetic: the
marker registry only holds spots whose viewport tiles have loaded, so without
moving the map a match in another region has no marker to reveal.

### Why not render markers straight from the API response?

The response carries enough to draw a marker, but the backend does not map
`spotTipType_slugs`. Markers built from API data would look like "no tips" and
would break AND-combination for the tip dimension. Filtering the tile-loaded
markers avoids this, since each already carries correct metadata.

### Configuration

```
Amplify parameter -> Amplify env var -> _plugins/env_loader.rb
  -> site.search_api_endpoint / site.search_api_key / site.search_enabled
  -> #semantic-search-config JSON block -> JSON.parse in semantic-search.js
```

Templates gate on `site.search_enabled`, never on the endpoint directly. It is
derived once in the plugin as "an endpoint is configured AND the feature is not
disabled", so the decision is made in testable Ruby rather than in Liquid.

| Variable / parameter | Purpose |
|---|---|
| `SEARCH_API_ENDPOINT` / `EnvVarSearchApiEndpoint` | Full search endpoint URL. **The search UI renders only when this is non-empty.** |
| `SEARCH_API_KEY` / `EnvVarSearchApiKey` | API Gateway usage-plan key |
| `SearchApiCspHost` | Search API origin added to CSP `connect-src` |
| `SEARCH_DISABLED` / `SearchDisabled` | Feature flag. `true` removes search from the build entirely, keeping the endpoint configured |
| `site.search.timeout_ms` | Per-attempt request budget, default 6000 |

#### Turning search off

Set the `SearchDisabled` stack parameter to `"true"`. That removes the config
block and the `semantic-search.js` script tag, so the module is never downloaded,
and empties the search host from the CSP `connect-src`, so the endpoint cannot be
reached even by injected script. The endpoint parameter is left intact, so
switching search back on does not mean recovering the URL.

The flag is negative deliberately: its absence has to mean "behave as today", and
a positive `SEARCH_ENABLED` would silently disable search on the next deploy of
every existing environment. An unrecognised value disables and warns in the build
log, because someone who types a value into a kill switch intended to use it.

Note the parameter is **app-wide**, not per-branch: flipping it affects every
branch of the Amplify app.

### Graceful degradation

The governing rule: a search backend problem may cost the user search, and nothing
else. What that means concretely:

- **No request is made at page load.** The first call happens on user input, so a
  backend that is down when the site loads has no effect on loading the site.
  There is deliberately no availability probe -- it would cost a request per page
  view and can be wrong in both directions.
- **Search init cannot break the map.** Both calls into the module during map
  initialisation are individually guarded, because the initial data load happens
  further down the same function and a throw would otherwise leave the map with no
  markers at all.
- **A malformed response is a failure, not an empty result.** A `2xx` whose body is
  not an array is rejected. Treating it as zero results would apply the no-match
  sentinel and hide every marker, reporting a backend fault as "no spots match".
- **Every failure deactivates the search dimension**, so a failure degrades to "no
  search" rather than a stale or empty view.
- **Timeout is 6000 ms per attempt**, above the measured ~5.0s cold-start ceiling
  and strictly below the Lambda's own 10s, so the client gives up before the
  server does rather than racing it.
- **One retry after 1s** on a network error, timeout, or `5xx`. Never on a `4xx`:
  `429` in particular is not retried, because retrying a rate limit is what caused
  it. The status keeps reading "searching" across the retry so no failure is
  flashed before a success.
- **The notice's action follows the state**: clear the search for "nothing
  matched", try again for a failure.
- **Results are cached in memory and in `localStorage`.** The persisted key carries
  the spots table's `lastUpdatedAt`, so a content change orphans every entry at
  once; a 7-day TTL is the backstop. Any storage failure disables persistence for
  the page and the in-memory tier carries on.

Known limitation: `Retry-After` is not a CORS-safelisted response header and the
search API does not send `Access-Control-Expose-Headers`, so the browser cannot
read it. The rate-limit message therefore always uses its generic form rather than
naming a wait time. The frontend handles both forms; making the specific one
reachable needs one header added to the API's responses.

Empty and whitespace-only values are treated as unset, because CloudFormation
supplies `""` for an omitted parameter and `""` is truthy in both Ruby and Liquid.
A build with none of these set omits the search box entirely and leaves the
filter panel unchanged.

**On the API key.** It is rendered into the public HTML, because the site is
statically generated with no server-side rendering layer. That is acceptable only
because an API Gateway API key is a usage-plan identifier for throttling and
quota attribution, not an authorisation secret. Access control for the endpoint
is its Origin allow-list plus WAF. Never route an IAM credential through this
path.

**Local development.** The deployed API validates the request Origin against an
allow-list in SSM (`/paddelbuch-search/allowed-origins`). Localhost is not on
that list by default, so searches from a local build return HTTP 403 until it is
added.

### Tuning

`limit` (default 40) and `minScore` (default 0.25) are sent with every request
and are configurable via `site.search.*`. The threshold comes from the backend's
own e2e query set, which treats 0.2 as the relevance floor and 0.3 as the
expected top-match score.

Note the tension: a tight `limit` can interact badly with restrictive checkbox
filters, because the AND may empty out when a qualifying spot ranked just outside
the limit. Raising `limit` widens the pool at the cost of payload size.

## Content Security Policy

The site enforces a strict Content Security Policy (CSP) via the CloudFormation template (`deploy/frontend-deploy.yaml`). This is a deliberate design constraint that shapes how frontend code can be written.

### Active Policy

```
default-src 'self';
img-src 'self' data: raw.githubusercontent.com api.mapbox.com;
style-src 'self';
script-src 'self' https://tinylytics.app;
font-src 'self' data:;
connect-src 'self' tiles.openfreemap.org https://tinylytics.app ${SearchApiCspHost};
worker-src 'self' blob:
```

`${SearchApiCspHost}` is substituted by CloudFormation from the `SearchApiCspHost`
template parameter, which must hold the scheme and host of the search API (no
path) whenever semantic search is enabled. The `CustomHeaders` block is a `!Sub`
block for this reason; it is the only placeholder in it, and a test pins that so
a stray `${` cannot silently break every header on the site. When the parameter
is empty the directive simply has no extra source.

### Design Decisions

- No `'unsafe-inline'` for `script-src` or `style-src`. All JavaScript must be in `.js` files, all CSS in `.css`/`.scss` files. Inline `<script>` blocks and inline `style=""` attributes are blocked by the browser.
- No `'unsafe-eval'`. No `eval()`, `new Function()`, or similar dynamic code execution.
- No CDN dependencies for vendor libraries. All vendor assets (Bootstrap, Leaflet, Chart.js, fonts) are self-hosted. The `copy-vendor-assets.js` and `download-google-fonts.js` scripts exist specifically to support this constraint.
- Allowlisted external domains are limited to what the map layers and analytics require:
  - `raw.githubusercontent.com` and `api.mapbox.com` — image sources for map tiles and markers
  - `tiles.openfreemap.org` — vector tile data fetched by MapLibre GL
  - `tinylytics.app` — lightweight analytics script and beacon endpoint
- `worker-src 'self' blob:` — required by MapLibre GL JS, which spawns web workers from blob URLs for vector tile parsing.
- `font-src 'self' data:` — allows self-hosted font files and data URIs (used by some icon fonts).

### Implications for Development

- JSON configuration is injected into pages via `<script type="application/json">` data blocks (not inline JS), then parsed by external `.js` files at runtime. This is how `PrecomputeGenerator` output reaches the frontend without violating `script-src 'self'`.
- Adding a new external service (e.g., analytics, a new tile provider) requires updating the CSP in the CloudFormation template — it cannot be done in frontend code alone.
- The `style-src 'self'` directive means Leaflet plugins or libraries that inject inline styles may break. Test any new vendor library against the CSP before integrating.

### Other Security Headers

The CloudFormation template also sets these headers on all responses (`**/*`):

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year |
| `X-Frame-Options` | `DENY` | Prevents embedding in iframes |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information to external sites |
| `Permissions-Policy` | (restrictive) | Only `fullscreen`, `geolocation`, and `vertical-scroll` are allowed for `self`; all other browser features are disabled |

## Search analytics

Each completed search emits one Tinylytics event carrying both the query and the result
count in a single value:

```
search.query  →  "parkplatz|429"
                  ^query     ^count
```

**Why one event rather than two.** Tinylytics events carry no session, request or visitor
identifier, so `search.query` and a separate `search.results` could never be joined back
together — and *which queries return nothing* is the whole point. The pair has to be atomic.

**Reading the values.** Split on the last `|`. The query is case-folded, whitespace-collapsed,
and capped at 100 characters; the count is an integer. `Parkplatz` and `parkplatz` are one
row, deliberately: the backend folds before embedding, so they return identical results, and
splitting them would make the top-queries list wrong.

**A count of 500 means "at least 500".** The frontend requests `limit: 500`, so that value is
a cap rather than a total.

**The count is last on purpose.** The Tinylytics client applies no truncation — verified by
reading the deployed script — but server-side handling is unverified, so anything that
truncates eats query text before it reaches the count.

### Why the dashboard can show nothing while the code is correct

Three reasons, in the order they are likely:

1. **Your own hits are ignored.** Tinylytics does not fire events when hit tracking is
   disabled, whether via site settings or `?ignore`. This is the most likely cause and looks
   exactly like a broken implementation.
2. **The beacon was blocked.** Delivery uses `navigator.sendBeacon`, which some privacy
   browsers and ad blockers block. Event counts are therefore a **floor**, not a total — this
   is already true of the site's other events.
3. **Event tracking is a beta feature** and documented as subject to change.

To check dispatch without the dashboard, watch for the synthetic click and the outbound
request to `tinylytics.app` in the browser's network panel.

### The 1500 ms settle window

Analytics reports a query only after it has sat unchanged for 1500 ms — not on every search.
Two independent reasons:

- The search debounce is 350 ms, so typing `parkplatz` with one pause runs two searches,
  `park` and `parkplatz`. Reporting each would record prefixes nobody meant to search.
- **The Tinylytics client debounces events at 500 ms, keyed on
  `target.id || target.className || target.tagName`.** `tinylytics-beacon.js` sets
  `className = 'tinylytics-beacon'` and no id, so *every* dispatch through the beacon shares
  one key and any two within 500 ms are dropped — silently, and regardless of event name.
  The settle window keeps dispatches outside that window as a consequence rather than by
  luck.

That second point has a consequence beyond search, **not** addressed here: two `marker.click`
events within 500 ms also lose one, and a search event colliding with a marker click is
possible for the same reason. Fixing it means giving the beacon element a unique `id` per
dispatch, which changes behaviour for six existing call sites.

### `search.focus` versus `search.query`

`search.query` used to be set as an attribute on the search **input**. Tinylytics fires on
click, so it recorded a visitor *clicking into the box* — not a query, and with no value.
It is now `search.focus`, and is kept: open-the-box-but-never-search is a funnel signal
available nowhere else, and comparing it against `search.query` gives an engagement rate
neither provides alone.

**Historical `search.query` data is a focus count and is not comparable** with the new event,
even though the dashboard shows one continuous series across the rename.

Failed searches are **not** reported: no results were returned, so there is no count. Logging
refusal codes (`quota_exceeded`, `rate_limited`, `throttled`) is deferred — see
`.kiro/specs/search-event-analytics/`.
