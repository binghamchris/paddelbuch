# Implementation Plan: Data Quality Dashboards

## Overview

Build two map-based data quality dashboards (Data Freshness and Waterway Coverage) for the Paddelbuch site. The implementation follows a bottom-up approach: Ruby build-time metric computation first, then vendor assets and layout changes, then the Jekyll page and browser-side JS modules, then navigation and i18n integration, and finally CSP and deployment updates. Ruby (Jekyll plugin + RSpec) and JavaScript (browser modules + Jest) are the implementation languages.

## Tasks

- [x] 1. Implement the Dashboard Metrics Generator plugin
  - [x] 1.1 Create `_plugins/dashboard_metrics_generator.rb` with class skeleton and cross-locale caching
    - Create the `Jekyll::DashboardMetricsGenerator < Generator` class with `safe true`, `priority :normal`
    - Implement `@@cached_freshness` and `@@cached_coverage` class-level cache variables (initialised to `nil`)
    - Implement the `generate(site)` method: detect locale, compute-once on first pass, cache, localise per pass
    - Implement `deduplicate_by_slug(waterways)` — returns one waterway per unique slug
    - Implement `deduplicate_spots_by_waterway(spots_by_waterway)` — one spot per unique slug per waterway group
    - Implement `build_waterway_name_lookup(waterways, locale)` — returns `{ slug => name }` hash for locale
    - Implement `localize_metrics(cached_metrics, waterway_names)` — deep-clone cached metrics, swap in locale-specific names
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Implement freshness metric computation helpers
    - Implement `median_age(timestamps, now)` — compute median age in days from ISO 8601 timestamps; return `nil` for empty arrays
    - Implement `freshness_color(days, colors)` — per-channel sRGB interpolation between green-1/warning-yellow/danger-red anchors; clamp negatives to 0; return purple-1 for nil days
    - Implement `compute_freshness_metrics(unique_waterways, unique_spots_by_waterway, colors)` — iterate waterways, compute median age and colour, parse geometry JSON, build metric hashes keyed by slug
    - Handle malformed geometry JSON gracefully (skip with `Jekyll.logger.warn`)
    - Read colour hex values from `site.data['paddelbuch_colors']` keys: `green1`, `warningYellow`, `dangerRed`, `purple1`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 9.1, 9.2, 9.3, 9.4_

  - [x] 1.3 Implement coverage metric computation helpers
    - Implement `haversine_distance(lat1, lon1, lat2, lon2)` — Haversine distance in metres with Earth radius 6371 km
    - Implement `classify_segments(geometry, spots, radius)` — walk coordinate array, classify each segment by midpoint distance to nearest spot; handle LineString and Polygon (outer ring) geometries; skip unknown types with warning
    - Implement `compute_coverage_metrics(unique_waterways, unique_spots_by_waterway)` — iterate waterways, classify segments, build covered/uncovered GeoJSON arrays keyed by slug
    - Handle empty spots array (entire geometry uncovered) and malformed geometry
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.1, 10.2, 10.3, 10.4_

  - [x] 1.4 Write Ruby unit tests for the Dashboard Metrics Generator
    - Create `spec/plugins/dashboard_metrics_generator_spec.rb`
    - Test `median_age`: empty array returns nil, odd count returns middle, even count returns average of two middle values
    - Test `freshness_color` at anchor points: 0 days = green-1, 1095 = warning-yellow, 1826 = danger-red, nil = purple-1
    - Test `classify_segments`: empty spots → entire geometry uncovered; single spot covers nearby segments
    - Test malformed geometry JSON is skipped gracefully
    - Test `deduplicate_by_slug` returns one entry per unique slug
    - Test `deduplicate_spots_by_waterway` returns one spot per unique slug per waterway group
    - Test `localize_metrics` swaps names correctly and falls back to slug when name is missing
    - Test cross-locale caching: metrics output identical except `name` field regardless of locale pass order
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.4, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 1.5 Write property test for median age computation correctness (Property 1)
    - **Property 1: Median age computation correctness**
    - Create/extend `spec/plugins/dashboard_metrics_generator_property_spec.rb`
    - Generate random non-empty arrays of valid ISO 8601 timestamps and a reference time
    - Assert `median_age` returns the correct median (middle for odd, average of two middle for even)
    - Minimum 100 iterations via `property_of { ... }.check(100)`
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 1.6 Write property test for median age bounded by min and max (Property 2)
    - **Property 2: Median age bounded by min and max**
    - Generate random non-empty arrays of valid timestamps and a reference time
    - Assert computed median age ≥ minimum age and ≤ maximum age in the array
    - Minimum 100 iterations
    - **Validates: Requirements 9.5**

  - [x] 1.7 Write property test for freshness colour gradient correctness (Property 3)
    - **Property 3: Freshness colour gradient correctness**
    - Generate random non-negative day values
    - Assert colour matches expected interpolation range and anchor points
    - Minimum 100 iterations
    - **Validates: Requirements 3.4, 3.5, 3.6**

  - [x] 1.8 Write property test for coverage segment classification correctness (Property 4)
    - **Property 4: Coverage segment classification correctness**
    - Generate random LineString/Polygon geometries and spot locations
    - Assert every "covered" segment midpoint is within 2000m of a spot and every "uncovered" midpoint is farther
    - Minimum 100 iterations
    - **Validates: Requirements 10.1, 10.2, 4.2, 4.3, 4.4**

  - [x] 1.9 Write property test for Haversine distance accuracy (Property 5)
    - **Property 5: Haversine distance accuracy**
    - Generate random coordinate pairs within valid lat/lon ranges
    - Assert computed distance is within 0.5% of reference Haversine formula (Earth radius 6371 km)
    - Minimum 100 iterations
    - **Validates: Requirements 10.3**

  - [x] 1.10 Write property test for single-spot coverage contiguity (Property 6)
    - **Property 6: Single-spot coverage contiguity**
    - Generate random waterway geometries and a single spot location
    - Assert covered segments form a contiguous run (no uncovered segments between two covered segments)
    - Minimum 100 iterations
    - **Validates: Requirements 10.5**

- [x] 2. Checkpoint - Ensure all Ruby tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add vendor dependencies and update default layout
  - [x] 3.1 Add MapLibre GL vendor assets
    - Add `assets/js/vendor/maplibre-gl.js` (MapLibre GL JS library)
    - Add `assets/css/vendor/maplibre-gl.css` (MapLibre GL CSS)
    - Add `assets/js/vendor/leaflet-maplibre-gl.js` (maplibre-gl-leaflet bridge plugin)
    - _Requirements: 8.3_

  - [x] 3.2 Update `_layouts/default.html` to load MapLibre GL assets
    - Add `<link rel="stylesheet" href="{{ '/assets/css/vendor/maplibre-gl.css' | relative_url }}">` in `<head>` after Leaflet CSS
    - Add `<script src="{{ '/assets/js/vendor/maplibre-gl.js' | relative_url }}"></script>` in `<body>` after `leaflet.js` and before `L.Control.Locate.min.js`
    - Add `<script src="{{ '/assets/js/vendor/leaflet-maplibre-gl.js' | relative_url }}"></script>` after `maplibre-gl.js`
    - _Requirements: 2.1, 8.3_

- [ ] 4. Implement browser-side JS modules
  - [x] 4.1 Create `assets/js/dashboard-data.js`
    - Implement `PaddelbuchDashboardData` global that parses `#freshness-data` and `#coverage-data` JSON blocks
    - Expose `{ freshnessMetrics, coverageMetrics }` — no computation, data is pre-computed
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Create `assets/js/dashboard-map.js`
    - Implement `PaddelbuchDashboardMap` global that creates a Leaflet map in `#dashboard-map`
    - Use `L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/positron' })` for Positron vector tiles
    - Centre: `[46.801111, 8.226667]`, zoom: `8`, max bounds: `[[45.8, 5.9], [47.8, 10.5]]`, minZoom: `7`
    - Zoom control: bottom-right, attribution: `© OpenStreetMap contributors`
    - Expose `{ map, getMap() }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.3 Create `assets/js/freshness-dashboard.js`
    - Implement freshness dashboard module conforming to the dashboard interface (`id`, `getName`, `usesMap`, `activate`, `deactivate`)
    - On activate: read `PaddelbuchDashboardData.freshnessMetrics`, create `L.geoJSON` layers with pre-computed colour, bind popups (waterway name, spot count, median age), render legend
    - On deactivate: remove all layers, clear legend
    - Register on `PaddelbuchDashboardRegistry`
    - Use existing popup CSS classes (`popup-icon-div`, `popup-title`, `popup-btn`)
    - _Requirements: 3.1, 3.9, 3.10, 6.5, 7.1_

  - [x] 4.4 Create `assets/js/coverage-dashboard.js`
    - Implement coverage dashboard module conforming to the dashboard interface
    - On activate: read `PaddelbuchDashboardData.coverageMetrics`, create `L.geoJSON` layers for covered (green-1) and uncovered (danger-red) segments, bind popups, render legend
    - On deactivate: remove all layers, clear legend
    - Register on `PaddelbuchDashboardRegistry`
    - _Requirements: 4.1, 4.6, 4.7, 6.5, 7.1_

  - [x] 4.5 Create `assets/js/dashboard-switcher.js`
    - Implement `PaddelbuchDashboardSwitcher` that reads `PaddelbuchDashboardRegistry`
    - Create Bootstrap-styled tab buttons inside `#dashboard-switcher`, one per registered dashboard
    - On load: activate first registered dashboard (freshness)
    - On tab click: deactivate current, activate selected
    - Show/hide map container vs content container based on `usesMap`
    - _Requirements: 1.5, 1.6, 1.7, 7.2, 7.4, 7.5, 7.6_

  - [x] 4.6 Write JS unit tests for dashboard modules
    - Create `_tests/unit/dashboard-data.test.js` — test JSON block parsing, empty data handling
    - Create `_tests/unit/dashboard-map.test.js` — test Positron tile config via `L.maplibreGL`, map centre/bounds
    - Create `_tests/unit/dashboard-freshness.test.js` — test legend DOM structure, popup HTML classes
    - Create `_tests/unit/dashboard-coverage.test.js` — test legend DOM structure, popup HTML classes
    - Create `_tests/unit/dashboard-switcher.test.js` — test tab creation, activation/deactivation flow
    - _Requirements: 2.1, 2.2, 2.3, 3.9, 4.6, 6.5_

  - [x] 4.7 Write property test for switcher state management (Property 7)
    - **Property 7: Switcher state management**
    - Create `_tests/property/dashboard-switcher-state.property.test.js`
    - Generate random sequences of dashboard selections from a registry
    - Assert only the most recently selected dashboard is active with no residual layers/DOM
    - Minimum 100 iterations via `{ numRuns: 100 }`
    - **Validates: Requirements 1.9, 7.6**

  - [x] 4.8 Write property test for switcher auto-discovery (Property 8)
    - **Property 8: Switcher auto-discovery**
    - Create `_tests/property/dashboard-switcher-discovery.property.test.js`
    - Generate random numbers of dashboard modules registered in the registry
    - Assert switcher creates exactly that many tab buttons
    - Minimum 100 iterations
    - **Validates: Requirements 7.2**

  - [~] 4.9 Write property test for map/content container visibility (Property 9)
    - **Property 9: Map/content container visibility**
    - Create `_tests/property/dashboard-switcher-visibility.property.test.js`
    - Generate dashboards with random `usesMap` values
    - Assert correct container visibility on activation
    - Minimum 100 iterations
    - **Validates: Requirements 7.4, 7.5**

- [ ] 5. Checkpoint - Ensure all JS tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create the dashboard page and integrate navigation and i18n
  - [~] 6.1 Create `offene-daten/datenqualitaet.html`
    - Add front matter: layout default, pageName data-quality, permalink `/offene-daten/datenqualitaet/`, scripts array with all 5 JS modules
    - Add `#dashboard-switcher`, `#dashboard-map`, `#dashboard-content`, `#dashboard-legend` containers
    - Add two `<script type="application/json">` blocks: `#freshness-data` with `{{ site.data.dashboard_freshness_metrics | jsonify }}` and `#coverage-data` with `{{ site.data.dashboard_coverage_metrics | jsonify }}`
    - _Requirements: 1.1, 1.6, 5.1, 5.2_

  - [~] 6.2 Add navigation link in `_includes/header.html`
    - Add a new `<li>` in the Open Data dropdown menu linking to the dashboard page
    - Use `{{ locale_prefix | append: '/offene-daten/datenqualitaet/' }}` for the href
    - Use `{% t nav.data_quality_dashboards %}` for the link text
    - Place it alongside the existing API page link
    - _Requirements: 1.2_

  - [~] 6.3 Add i18n translation keys to `_i18n/de.yml` and `_i18n/en.yml`
    - Add `nav.data_quality_dashboards` key
    - Add all `dashboards.*` keys: title, freshness (name, legend_title, fresh, aging, stale, no_data, popup_spots, popup_median_age, popup_days, popup_no_data), coverage (name, legend_title, covered, not_covered, popup_spots)
    - German values in `de.yml`, English values in `en.yml`
    - _Requirements: 1.3, 1.5_

  - [~] 6.4 Write property test for translation key completeness (Property 10)
    - **Property 10: Translation key completeness**
    - Create `_tests/property/dashboard-i18n.property.test.js`
    - For every translation key referenced in the dashboard page and JS modules, assert it exists in both `de.yml` and `en.yml` with a non-empty string value
    - Minimum 100 iterations
    - **Validates: Requirements 1.5**

- [ ] 7. Update CSP headers for OpenFreeMap vector tiles
  - [~] 7.1 Update `deploy/frontend-deploy.yaml` Content-Security-Policy header
    - Add `connect-src 'self' tiles.openfreemap.org;` for fetching Positron style JSON and vector tile PBF data
    - Add `worker-src 'self' blob:;` for MapLibre GL JS web workers
    - No changes to `img-src` needed (vector tiles use `connect-src`)
    - _Requirements: 8.2, 8.4_

  - [~] 7.2 Write JS unit test for CSP configuration
    - Create or extend `_tests/unit/dashboard-csp.test.js`
    - Parse the CSP header from `deploy/frontend-deploy.yaml` and assert `connect-src` includes `tiles.openfreemap.org` and `worker-src` includes `blob:`
    - _Requirements: 8.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (Properties 1–10 from the design)
- Unit tests validate specific examples and edge cases
- Ruby tests use RSpec + rantly; JS tests use Jest + fast-check
- The Ruby plugin must run after `color_generator.rb` (priority :high) to access `paddelbuch_colors`
- Vendor assets (MapLibre GL JS, CSS, bridge plugin) must be downloaded/vendored manually before task 3.1 can complete
