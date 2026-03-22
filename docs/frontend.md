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
| `map-data-init.js` | Orchestrates layer creation, tile-based data loading, filter setup, and layer control |
| `data-loader.js` | Fetches spatial tile JSON files based on the current map viewport |
| `spatial-utils.js` | GeoJSON geometry utilities (centroid calculation, bounds checking) |

### Filtering System

| Module | Purpose |
|--------|---------|
| `filter-engine.js` | Core filter logic: multi-dimension AND filtering across spot type and paddle craft type |
| `filter-panel.js` | Renders the filter toggle UI panel and handles user interactions |
| `layer-control.js` | Custom Leaflet control for toggling map layers, includes date-based event notice filtering |
| `zoom-layer-manager.js` | Shows/hides detail layers (obstacles, protected areas) based on zoom level (threshold: zoom 12) |

### Popups and Markers

| Module | Purpose |
|--------|---------|
| `spot-popup.js` | Generates HTML for spot marker popups |
| `obstacle-popup.js` | Generates HTML for obstacle marker popups |
| `event-notice-popup.js` | Generates HTML for event notice popups |
| `marker-registry.js` | Deduplicates markers by slug, manages marker add/remove lifecycle |
| `marker-styles.js` | Defines Leaflet icon styles per spot type (entry/exit, entry-only, etc.) |
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
5. `filter-engine.js` applies active filters by showing/hiding markers based on their spot type and paddle craft type attributes

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
    ├── _spot-details.scss           ← Spot detail pages
    ├── _waterway-details.scss       ← Waterway detail pages
    ├── _obstacle-details.scss       ← Obstacle detail pages
    ├── _notice-details.scss         ← Notice detail pages
    ├── _lakes.scss, _rivers.scss    ← Waterway list pages
    ├── _api.scss                    ← API documentation page
    ├── _static.scss                 ← CMS-driven static pages
    └── _pages.scss                  ← Barrel file
```

The main entry point is `assets/css/application.scss`, which imports Bootstrap and then the project's settings, utilities, components, and page styles.

## Content Security Policy

The site enforces a strict Content Security Policy (CSP) via the CloudFormation template (`deploy/frontend-deploy.yaml`). This is a deliberate design constraint that shapes how frontend code can be written.

### Active Policy

```
default-src 'self';
img-src 'self' data: raw.githubusercontent.com api.mapbox.com;
style-src 'self';
script-src 'self';
font-src 'self' data:;
connect-src 'self' tiles.openfreemap.org;
worker-src 'self' blob:
```

### Design Decisions

- No `'unsafe-inline'` for `script-src` or `style-src`. All JavaScript must be in `.js` files, all CSS in `.css`/`.scss` files. Inline `<script>` blocks and inline `style=""` attributes are blocked by the browser.
- No `'unsafe-eval'`. No `eval()`, `new Function()`, or similar dynamic code execution.
- No CDN dependencies. All vendor assets (Bootstrap, Leaflet, Chart.js, fonts) are self-hosted. The `copy-vendor-assets.js` and `download-google-fonts.js` scripts exist specifically to support this constraint.
- Allowlisted external domains are limited to what the map layers require:
  - `raw.githubusercontent.com` and `api.mapbox.com` — image sources for map tiles and markers
  - `tiles.openfreemap.org` — vector tile data fetched by MapLibre GL
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
