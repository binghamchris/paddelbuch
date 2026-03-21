# Implementation Plan: Spot Freshness Dashboard

## Overview

Implement the Spot Freshness Dashboard as a new dashboard module on the data quality page. The work proceeds bottom-up: build-time data pipeline first, then the data parsing layer, then the new dashboard module (chart, map markers, legend), then the switcher modification for dual-container support, and finally the Statistics Dashboard cleanup. Each step wires into the previous one so there is no orphaned code.

## Tasks

- [x] 1. Extend the build-time data pipeline
  - [x] 1.1 Add `compute_spot_freshness_map_data` to `statistics_metrics_generator.rb`
    - Add a new method that iterates non-rejected spots, filters for valid `location` (non-nil `lat`/`lon`) and non-nil `updatedAt`, computes the freshness category using the existing thresholds (≤ 730.5 → fresh, ≤ 1826.25 → aging, else stale), and returns an array of `{ slug, lat, lon, category }` hashes
    - Expose the result as `site.data['dashboard_spot_freshness_map_data']` alongside the existing metrics
    - _Requirements: 6.1_

  - [x] 1.2 Write property test for `compute_spot_freshness_map_data` (RSpec)
    - **Property 9: Generator produces correct per-spot freshness data**
    - **Validates: Requirements 6.1**
    - Use randomly generated spot arrays; assert output contains only non-rejected spots with valid location and updatedAt, and that each category matches the threshold rules

- [x] 2. Embed spot freshness data in the HTML page and parse it
  - [x] 2.1 Add JSON data block and i18n block to `datenqualitaet.html`
    - Add `<script type="application/json" id="spot-freshness-map-data">{{ site.data.dashboard_spot_freshness_map_data | jsonify }}</script>`
    - Add `<script type="application/json" id="spot-freshness-i18n">` block with `{% t %}` tags for keys: `name`, `description`, `fresh`, `aging`, `stale`, `chart_title`
    - Add `spot-freshness-dashboard.js` to the `scripts` front matter list (after `coverage-dashboard.js`, before `dashboard-switcher.js`)
    - _Requirements: 6.2, 7.1_

  - [x] 2.2 Extend `dashboard-data.js` to parse the new JSON block
    - Parse `#spot-freshness-map-data` using the existing `parseJsonBlock` function
    - Expose it as `PaddelbuchDashboardData.spotFreshnessMapData`
    - _Requirements: 6.3_

- [x] 3. Implement the Spot Freshness Dashboard module
  - [x] 3.1 Create `assets/js/spot-freshness-dashboard.js` with registration and i18n
    - Register on `PaddelbuchDashboardRegistry` with id `spot-freshness`
    - Implement `getName()` reading from `#spot-freshness-i18n` JSON block with German fallback defaults
    - Set `usesMap: true` and `usesBoth: true`
    - Implement `activate(context)` and `deactivate()` stubs
    - _Requirements: 1.1, 1.2, 1.3, 2.3, 7.2_

  - [x] 3.2 Write property test for i18n fallback
    - **Property 10: i18n fallback to German defaults**
    - **Validates: Requirements 7.2, 1.2**
    - Use fast-check to generate arbitrary i18n JSON content (missing block, empty object, partial keys); assert `getStrings()` always returns a complete object with non-empty values

  - [x] 3.3 Implement the spot freshness chart in `activate()`
    - Read aggregate freshness counts from `PaddelbuchDashboardData.statisticsMetrics.spots.freshness`
    - Render a horizontal stacked bar chart using Chart.js with segments for Fresh (`PaddelbuchColors.green1`), Aging (`PaddelbuchColors.warningYellow`), Stale (`PaddelbuchColors.dangerRed`)
    - Render chart inside `#dashboard-content` using the canvas + pending-chart pattern from `statistics-dashboard.js`
    - Destroy Chart.js instance in `deactivate()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.2_

  - [x] 3.4 Write property tests for chart colours and data
    - **Property 3: Chart colours match PaddelbuchColors**
    - **Validates: Requirements 3.2, 5.4**
    - **Property 4: Chart data reflects pre-computed metrics**
    - **Validates: Requirements 3.3**

  - [x] 3.5 Write property test for chart destruction
    - **Property 5: Chart destroyed on deactivation**
    - **Validates: Requirements 3.4, 8.2**

  - [x] 3.6 Implement map markers in `activate()`
    - Read spot data from `PaddelbuchDashboardData.spotFreshnessMapData`
    - For each entry with valid `lat`, `lon`, and `category`, create a Leaflet `divIcon` marker with inline SVG shape (circle for fresh, triangle for aging, square for stale) filled with the corresponding `PaddelbuchColors` colour
    - Add all markers to a `L.layerGroup` on the map
    - Remove the layer group in `deactivate()`
    - Skip entries with null/missing `updatedAt` or `location` (already filtered at build time, but guard at runtime too)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1_

  - [x] 3.7 Write property tests for marker count and shape/colour
    - **Property 6: Marker count equals valid spots**
    - **Validates: Requirements 4.1, 4.5, 4.6**
    - **Property 7: Marker shape and colour match freshness category**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 3.8 Implement the shared legend in `activate()`
    - Render exactly three legend entries (Fresh, Aging, Stale) in `#dashboard-legend`
    - Each entry uses an SVG shape indicator (circle, triangle, square) filled with the corresponding `PaddelbuchColors` colour — no plain colour swatches
    - Clear `#dashboard-legend` in `deactivate()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 3.9 Write property test for legend entries
    - **Property 8: Legend has exactly three entries**
    - **Validates: Requirements 5.2**

  - [x] 3.10 Complete `deactivate()` cleanup
    - Ensure `deactivate()` clears `#dashboard-legend`, `#dashboard-content`, `#dashboard-title`, `#dashboard-description`
    - Ensure all map markers are removed and all Chart.js instances are destroyed
    - Make `deactivate()` idempotent
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 3.11 Write property test for full deactivation cleanup
    - **Property 11: All UI elements cleared on deactivation**
    - **Validates: Requirements 8.1, 8.3, 5.5**

  - [x] 3.12 Write property test for CSP compliance
    - **Property 12: No inline style attributes in rendered HTML**
    - **Validates: Requirements 9.2, 9.4**
    - Assert that rendered legend, chart container, and marker HTML contain no `style="..."` attributes

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Modify the dashboard switcher for dual-container support
  - [~] 5.1 Update `updateContainerVisibility` in `dashboard-switcher.js`
    - Accept the dashboard module object (instead of just `usesMap` boolean)
    - Check for `usesBoth` flag: if true, show both `#dashboard-map` and `#dashboard-content`
    - Existing dashboards with only `usesMap: true` or `usesMap: false` continue to work as before
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 5.2 Write property tests for container visibility
    - **Property 1: Dual-container visibility on activation**
    - **Validates: Requirements 2.1**
    - **Property 2: Container visibility reverts on dashboard switch**
    - **Validates: Requirements 2.2**

- [ ] 6. Remove freshness chart from the Statistics Dashboard
  - [~] 6.1 Clean up `statistics-dashboard.js`
    - Remove `FRESHNESS_COLOR_MAP`
    - Remove `buildFreshnessSegments()` function
    - Remove the freshness `renderBarSection()` call from `activate()`
    - Remove freshness-related i18n key defaults (`spot_freshness_title`, `freshness_fresh`, `freshness_aging`, `freshness_stale`) from `getStrings()`
    - _Requirements: 3.5_

  - [~] 6.2 Remove freshness i18n keys from the `#statistics-i18n` block in `datenqualitaet.html`
    - Remove `spot_freshness_title`, `freshness_fresh`, `freshness_aging`, `freshness_stale` keys
    - _Requirements: 3.5_

- [ ] 7. Add i18n translation keys
  - [~] 7.1 Add `dashboards.spot_freshness` keys to the i18n data files
    - Add keys for `name`, `description`, `fresh`, `aging`, `stale`, `chart_title` in all supported locales (de, en)
    - _Requirements: 7.1, 7.2_

- [~] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check (JavaScript) and RSpec (Ruby) as per existing project conventions
- All colours must come from `PaddelbuchColors` — no hardcoded hex values in application code
- The `usesBoth` flag is a backward-compatible addition to the dashboard module interface
