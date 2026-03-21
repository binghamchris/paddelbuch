# Implementation Plan: Statistics Dashboard

## Overview

Add a Statistics Dashboard to the Data Quality page that displays summary figures and horizontal stacked bar charts for spots, obstacles, protected areas, paddle craft types, data source types, and data license types. All metrics are computed at Jekyll build time by a new Ruby generator plugin. The dashboard registers first in the registry to become the default view.

Implementation follows the existing dashboard module pattern (IIFE, registry push, activate/deactivate) and the compute-once-cache-across-locales pattern from `DashboardMetricsGenerator`.

## Tasks

- [x] 1. Add colour variables and i18n keys
  - [x] 1.1 Add statistics dashboard colour variables to `_sass/settings/_paddelbuch_colours.scss`
    - Add spot type colours: `$spot-type-entry-exit`, `$spot-type-entry-only`, `$spot-type-exit-only`, `$spot-type-rest`, `$spot-type-emergency`, `$spot-type-no-entry`
    - Add obstacle colours: `$obstacle-with-portage`, `$obstacle-without-portage`
    - Add protected area type colours: `$pa-type-naturschutzgebiet`, `$pa-type-fahrverbotzone`, `$pa-type-schilfgebiet`, `$pa-type-schwimmbereich`, `$pa-type-industriegebiet`, `$pa-type-schiesszone`, `$pa-type-teleskizone`, `$pa-type-privatbesitz`, `$pa-type-wasserskizone`
    - The existing `color_generator.rb` will automatically expose these to JS via `site.data['paddelbuch_colors']`
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

  - [x] 1.2 Add statistics dashboard i18n keys to `_i18n/de.yml` and `_i18n/en.yml`
    - Add `dashboards.statistics` section with keys: `name`, `description`, `spots_title`, `obstacles_title`, `protected_areas_title`, `paddle_craft_title`, `data_source_title`, `data_license_title`, `with_portage`, `without_portage`, `no_entry`
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 2. Implement the StatisticsMetricsGenerator Ruby plugin
  - [x] 2.1 Create `_plugins/statistics_metrics_generator.rb`
    - Implement `Jekyll::StatisticsMetricsGenerator < Generator` with `safe true`, `priority :normal`
    - Use class-level `@@cached_metrics = nil` for compute-once-cache-across-locales pattern
    - In `generate(site)`: compute metrics on first locale pass, cache, then localize type names for each locale pass
    - Implement `deduplicate_by_slug(entities)` — group by slug, keep first occurrence, skip nil slugs
    - Implement spot counting: deduplicate spots by slug, classify each into spot type segment or "no-entry" segment (when `rejected: true`), compute total and per-type counts
    - Implement obstacle counting: deduplicate obstacles by slug, partition into "with portage route" (non-null `portageRoute`) and "without portage route" (null `portageRoute`), compute total and per-segment counts
    - Implement protected area counting: deduplicate protected areas by slug, group by `protectedAreaType_slug`, compute total and per-type counts
    - Implement paddle craft type counting: for each paddle craft type slug, count unique spots whose `paddleCraftTypes` array contains that slug
    - Implement data source type counting: for each data source type slug, sum unique entities (spots, obstacles, protected areas, waterways, notices) whose `dataSourceType_slug` matches
    - Implement data license type counting: for each data license type slug, sum unique entities (spots, obstacles, protected areas, waterways, notices) whose `dataLicenseType_slug` matches
    - Implement `localize_metrics(cached_metrics, locale)` — clone cached metrics and replace type names with locale-appropriate `name_de`/`name_en` from type definition files
    - Expose output as `site.data['dashboard_statistics_metrics']`
    - Read type definitions from `site.data['types']` subdirectory (spot_types, protected_area_types, paddle_craft_types, data_source_types, data_license_types)
    - Handle missing data files gracefully (treat as empty arrays, no build failure)
    - Handle entities with missing slug, type slug, or data source/license slug gracefully (skip or log warning)
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.3, 3.4, 4.1, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 2.2 Write property test: Deduplication correctness (Property 1)
    - **Property 1: Deduplication correctness**
    - Generate random entity lists with duplicate slugs across 2 locales using Rantly; verify dedup count equals unique slug count
    - Create `spec/plugins/statistics_metrics_generator_spec.rb`
    - **Validates: Requirements 2.1, 3.1, 4.1, 8.3, 8.4, 8.5, 8.6, 8.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

  - [x] 2.3 Write property test: Spot type partitioning (Property 2)
    - **Property 2: Spot type partitioning**
    - Generate random spots with varying `rejected` and `spotType_slug` using Rantly; verify every spot is classified into exactly one segment and segment counts sum to total
    - **Validates: Requirements 2.4, 2.5**

  - [x] 2.4 Write property test: Obstacle portage partitioning (Property 3)
    - **Property 3: Obstacle portage partitioning**
    - Generate random obstacles with nil/non-nil `portageRoute` using Rantly; verify partitioning into exactly two segments and counts sum to total
    - **Validates: Requirements 3.3, 3.4**

  - [x] 2.5 Write property test: Paddle craft type counting (Property 4)
    - **Property 4: Paddle craft type counting**
    - Generate random spots with random `paddleCraftTypes` arrays using Rantly; verify count per craft type equals number of unique spots containing that slug
    - **Validates: Requirements 5.2, 5.3**

  - [x] 2.6 Write property test: Data source type counting (Property 5)
    - **Property 5: Data source type counting**
    - Generate random entities across all five entity types with random `dataSourceType_slug` using Rantly; verify sum across entity types for each data source type
    - **Validates: Requirements 6.2, 6.3**

  - [x] 2.7 Write property test: Data license type counting (Property 6)
    - **Property 6: Data license type counting**
    - Generate random entities across all five entity types with random `dataLicenseType_slug` using Rantly; verify sum across entity types for each data license type
    - **Validates: Requirements 7.2, 7.3**

  - [x] 2.8 Write property test: Type name localisation (Property 7)
    - **Property 7: Type name localisation**
    - Generate random type definitions with `name_de`/`name_en` using Rantly; verify correct name is selected for each locale
    - **Validates: Requirements 5.4, 6.4, 7.4, 9.3**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend dashboard-data.js and update the HTML template
  - [x] 4.1 Add `parseJsonObjectBlock` to `assets/js/dashboard-data.js` and expose `statisticsMetrics`
    - Add a `parseJsonObjectBlock(id)` function that returns `{}` on failure (instead of `[]` for arrays)
    - Parse `#statistics-data` JSON block and expose as `PaddelbuchDashboardData.statisticsMetrics`
    - _Requirements: 8.9, 8.10_

  - [x] 4.2 Update `offene-daten/datenqualitaet.html` front matter and template
    - Add `statistics-dashboard.js` to the `scripts` array after `dashboard-data.js` and before `freshness-dashboard.js`
    - Add `<script type="application/json" id="statistics-data">` block with `{{ site.data.dashboard_statistics_metrics | jsonify }}`
    - Add `<script type="application/json" id="statistics-i18n">` block with localised strings using `{% t %}` tags for all `dashboards.statistics.*` keys
    - _Requirements: 8.9, 9.1, 9.2, 11.1, 11.2_

- [ ] 5. Implement the statistics-dashboard.js module
  - [~] 5.1 Create `assets/js/statistics-dashboard.js`
    - Implement as IIFE following the exact pattern of `freshness-dashboard.js` and `coverage-dashboard.js`
    - Set `id: 'statistics'`, `usesMap: false`
    - Implement `getStrings()` reading from `#statistics-i18n` JSON block with German fallback defaults
    - Implement `getName()` returning localised dashboard name
    - Implement `activate(context)`: read `PaddelbuchDashboardData.statisticsMetrics` and i18n strings, render summary figures and stacked bar charts into `context.contentEl`, set `#dashboard-title` and `#dashboard-description`
    - Render spots section: summary figure with total count + stacked bar chart by spot type (5 types + no-entry) + colour-coded legend
    - Render obstacles section: summary figure with total count + stacked bar chart (with/without portage route) + colour-coded legend
    - Render protected areas section: summary figure with total count + stacked bar chart by protected area type (9 types) + colour-coded legend
    - Render paddle craft types section: one summary figure per craft type with localised label
    - Render data source types section: one summary figure per data source type with localised label
    - Render data license types section: one summary figure per data license type with localised label
    - Read colours from `PaddelbuchColors` global (populated by `color_generator.rb` pipeline)
    - Use `escapeHtml()` for all user-facing text
    - Implement `deactivate()`: clear `#dashboard-content`, `#dashboard-title`, `#dashboard-description`, `#dashboard-legend`
    - Register on `PaddelbuchDashboardRegistry` and expose as `global.PaddelbuchStatisticsDashboard`
    - Ensure responsive layout using CSS classes (no inline styles for layout)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.6, 2.7, 3.1, 3.2, 3.5, 3.6, 4.1, 4.2, 4.4, 4.5, 5.1, 5.4, 6.1, 6.4, 7.1, 7.4, 8.10, 9.1, 9.4, 10.1, 10.4, 10.5, 11.3_

  - [~] 5.2 Write property test: Deactivation cleanup (Property 8)
    - **Property 8: Deactivation cleanup**
    - Generate random valid metrics; call activate then deactivate; verify `#dashboard-content`, `#dashboard-title`, `#dashboard-description`, and `#dashboard-legend` containers are empty
    - This test can be a simple RSpec example test (or JS-based if a JS test runner is available) verifying the cleanup contract
    - **Validates: Requirements 1.5**

- [~] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Wire everything together and verify script load order
  - [~] 7.1 Verify script load order and default dashboard registration
    - Confirm `datenqualitaet.html` front matter `scripts` array lists `statistics-dashboard.js` after `dashboard-data.js` and before `freshness-dashboard.js` and `coverage-dashboard.js`
    - Confirm `statistics-dashboard.js` registers on `PaddelbuchDashboardRegistry` before freshness and coverage modules
    - Confirm the dashboard-switcher activates the statistics dashboard by default (first entry in registry)
    - _Requirements: 1.1, 1.2, 11.1, 11.2, 11.3_

  - [~] 7.2 Write unit tests for script load order and integration
    - Verify the front matter `scripts` array ordering in `datenqualitaet.html`
    - Verify the statistics dashboard module interface contract (id, getName, usesMap, activate, deactivate)
    - _Requirements: 11.1, 11.2, 11.3_

- [~] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use Rantly with RSpec (project already has both dependencies)
- Ruby commands must use: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec`
- The `color_generator.rb` plugin requires no changes — it automatically picks up new SCSS colour variables
- The `dashboard-switcher.js` requires no changes — it already handles `usesMap: false` dashboards by toggling container visibility
