# Implementation Plan: Liquid Rendering Optimization

## Overview

Externalize inline JavaScript from Liquid templates into four static external `.js` files, passing dynamic values via `data-*` attributes and an extended `window.paddelbuchMapConfig` object. Implementation proceeds bottom-up: extend the config plugin first, then create external JS files, then modify templates to use them.

## Tasks

- [x] 1. Extend MapConfigGenerator plugin with site-level settings
  - [x] 1.1 Add site-level keys to `_plugins/map_config_generator.rb`
    - Add `tileUrl`, `center` (with `lat` and `lon`), `defaultZoom`, `maxZoom`, and `attribution` to the generated `window.paddelbuchMapConfig` object
    - Read values from `site.mapbox_url`, `site.map.center.lat`, `site.map.center.lon`, `site.map.default_zoom`, `site.map.max_zoom`
    - Build the attribution HTML string from the Mapbox attribution
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.2 Write property test for MapConfig site-level settings (Property 5)
    - **Property 5: MapConfig contains all required site-level settings**
    - For any valid site config (randomized tile URL, center coordinates, zoom levels), verify the MapConfigGenerator output contains all required keys with correct values
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 1.3 Write RSpec unit tests for MapConfigGenerator changes
    - Verify the generated JS output contains `tileUrl`, `center`, `defaultZoom`, `maxZoom`, `attribution` keys
    - Verify values match the corresponding `_config.yml` settings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Create `assets/js/filter-panel.js` and update `_includes/filter-panel.html`
  - [x] 2.1 Extract filter panel JavaScript into `assets/js/filter-panel.js`
    - Move the IIFE from `_includes/filter-panel.html` into `assets/js/filter-panel.js`
    - Expose `window.PaddelbuchFilterPanel.init(map, dimensionConfigs, layerToggles)`
    - No Liquid interpolation exists in this code, so it's a direct move
    - _Requirements: 3.1_

  - [x] 2.2 Update `_includes/filter-panel.html` to load external JS
    - Replace the inline `<script>` block with a `<script src="...">` tag pointing to `filter-panel.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 3.2, 3.3_

- [x] 3. Checkpoint - Verify filter panel extraction
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create `assets/js/detail-map.js` and update detail layout files
  - [x] 4.1 Create `assets/js/detail-map.js` with unified map initialization
    - Implement shared map setup: tile layer creation from `window.paddelbuchMapConfig.tileUrl`, attribution, zoom control positioning, locate control with locale-specific tooltip
    - Read `data-page-type` from the map container element to determine initialization path
    - Implement spot init: center on `data-lat`/`data-lon` at zoom 15, add marker with popup from `data-spot-json`
    - Implement obstacle init: fit bounds to `data-geometry` polygon, render with obstacle styling, optionally render `data-portage-route`
    - Implement waterway init: fit bounds to `data-geometry` without rendering polygon
    - Implement notice init: fit bounds to `data-geometry` affected area polygon with event notice styling, fallback to `data-location-lat`/`data-location-lon`, then to default center from MapConfig
    - Set `window.paddelbuchMap` global
    - Handle missing/malformed data attributes gracefully (log warnings, use fallbacks)
    - _Requirements: 4.1, 4.4, 4.5, 4.10, 4.11, 4.12, 4.13, 4.14, 6.1, 6.2, 6.4, 6.5_

  - [x] 4.2 Update `_layouts/spot.html` to use external JS
    - Add `data-page-type="spot"`, `data-locale`, `data-lat`, `data-lon`, `data-spot-type`, `data-spot-name`, `data-spot-slug`, `data-rejected`, `data-spot-json` attributes to the map container `<div>`
    - Replace inline `<script>` block with `<script src="...">` tag for `detail-map.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 4.2, 4.3, 4.6, 4.15_

  - [x] 4.3 Update `_layouts/obstacle.html` to use external JS
    - Add `data-page-type="obstacle"`, `data-locale`, `data-geometry`, `data-portage-route` attributes to the map container `<div>`
    - Replace inline `<script>` block with `<script src="...">` tag for `detail-map.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 4.2, 4.3, 4.7, 4.15_

  - [x] 4.4 Update `_layouts/waterway.html` to use external JS
    - Add `data-page-type="waterway"`, `data-locale`, `data-geometry` attributes to the map container `<div>`
    - Replace inline `<script>` block with `<script src="...">` tag for `detail-map.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 4.2, 4.3, 4.8, 4.15_

  - [x] 4.5 Update `_layouts/notice.html` to use external JS
    - Add `data-page-type="notice"`, `data-locale`, `data-geometry`, `data-location-lat`, `data-location-lon` attributes to the map container `<div>`
    - Replace inline `<script>` block with `<script src="...">` tag for `detail-map.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 4.2, 4.3, 4.9, 4.15_

  - [x] 4.6 Write property test for map initialization per page type (Property 4)
    - **Property 4: detail-map.js initializes map correctly per page type**
    - For any randomly generated page type and valid data attributes, verify the map init function produces the correct center, zoom, and layer configuration
    - **Validates: Requirements 4.4, 4.11, 4.12, 4.13, 4.14, 6.4**

  - [~] 4.7 Write property test for map center and zoom equivalence (Property 6)
    - **Property 6: Map center and zoom equivalence**
    - For any randomly generated spot coordinates, obstacle geometry bounds, waterway geometry bounds, or notice geometry/location, verify the external JS produces the same center and zoom as the original inline code
    - **Validates: Requirements 6.1**

  - [~] 4.8 Write property test for spot popup content equivalence (Property 7)
    - **Property 7: Spot popup content equivalence**
    - For any randomly generated spot data object (name, slug, type, rejected status, description, address, paddle craft types, coordinates), verify the popup HTML from the external JS matches the original inline code
    - **Validates: Requirements 6.2**

- [~] 5. Checkpoint - Verify detail map extraction
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Create `assets/js/layer-control.js` and update `_includes/layer-control.html`
  - [~] 6.1 Extract layer control JavaScript into `assets/js/layer-control.js`
    - Move the layer control initialization logic from `_includes/layer-control.html` into `assets/js/layer-control.js`
    - Replace Liquid `{{ current_locale }}` references with reads from `document.currentScript.getAttribute('data-locale')` or `window.paddelbuchMapConfig`
    - Replace Liquid `{{ map_var }}` references with `window.paddelbuchMap`
    - Set globals: `window.paddelbuchLayerGroups`, `window.paddelbuchFilterByLocale`, `window.paddelbuchAddSpotMarker`, `window.paddelbuchAddEventNoticeMarker`, `window.paddelbuchAddObstacleLayer`, `window.paddelbuchAddProtectedAreaLayer`, `window.paddelbuchCurrentLocale`
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [~] 6.2 Update `_includes/layer-control.html` to load external JS
    - Replace the inline `<script>` block with a `<script data-locale="{{ current_locale }}" src="...">` tag for `layer-control.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 1.2, 1.6_

- [ ] 7. Create `assets/js/detail-map-layers.js` and update `_includes/detail-map-layers.html`
  - [~] 7.1 Extract detail map layers JavaScript into `assets/js/detail-map-layers.js`
    - Move the data loading bootstrap logic from `_includes/detail-map-layers.html` into `assets/js/detail-map-layers.js`
    - Replace Liquid `{{ current_locale }}` with reads from `window.paddelbuchCurrentLocale` (set by layer-control.js) or fallback to `document.currentScript.getAttribute('data-locale')`
    - _Requirements: 2.1, 2.4_

  - [~] 7.2 Update `_includes/detail-map-layers.html` to load external JS
    - Replace the inline `<script>` block with a `<script data-locale="{{ current_locale }}" src="...">` tag for `detail-map-layers.js`
    - Ensure zero inline script blocks with Liquid interpolation remain
    - _Requirements: 2.2, 2.3, 2.5_

- [~] 8. Checkpoint - Verify layer control and data layers extraction
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Validate no Liquid tags in external JS and no inline scripts in templates
  - [~] 9.1 Verify external JS files contain no Liquid tags
    - Check all four files (`layer-control.js`, `detail-map-layers.js`, `filter-panel.js`, `detail-map.js`) for absence of `{{`, `}}`, `{%`, `%}` patterns
    - _Requirements: 1.5, 2.4, 4.10, 5.6_

  - [~] 9.2 Verify modified templates contain no inline script blocks with Liquid interpolation
    - Check all seven modified files (`layer-control.html`, `detail-map-layers.html`, `filter-panel.html`, `spot.html`, `obstacle.html`, `waterway.html`, `notice.html`) for absence of `<script>` blocks containing Liquid tags
    - _Requirements: 1.6, 2.5, 3.3, 4.15_

  - [~] 9.3 Write property test for no Liquid tags in external JS (Property 1)
    - **Property 1: External JS files contain no Liquid tags**
    - Verify that none of the four external JS files contain `{{`, `}}`, `{%`, or `%}` patterns
    - **Validates: Requirements 1.5, 2.4, 4.10, 5.6**

  - [~] 9.4 Write property test for no inline scripts with Liquid in templates (Property 2)
    - **Property 2: Modified templates contain zero inline script blocks with Liquid interpolation**
    - Verify that all modified layout and include files have no `<script>` blocks containing Liquid interpolation tags
    - **Validates: Requirements 1.6, 2.5, 3.3, 4.15**

  - [~] 9.5 Write property test for valid data-page-type attributes (Property 3)
    - **Property 3: Map container data-page-type is valid**
    - Verify each detail layout file's map container has a `data-page-type` attribute with the correct value
    - **Validates: Requirements 4.3**

  - [~] 9.6 Write property test for Liquid template content reduction (Property 8)
    - **Property 8: Liquid template content reduction**
    - Verify that the number of characters inside `<script>` blocks requiring Liquid processing is strictly less after extraction than before
    - **Validates: Requirements 7.1**

- [~] 10. Final checkpoint - Ensure all tests pass and build completes
  - Ensure all tests pass, ask the user if questions arise.
  - Run a full Jekyll build and verify it completes successfully
  - Compare build time against the pre-extraction baseline of ~648 seconds
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major extraction
- Property tests use `fast-check` (JavaScript) as specified in the design
- RSpec is used for Ruby plugin unit tests
- Implementation order: plugin first (dependency for all JS files), then filter-panel (simplest, no Liquid), then detail-map (most complex), then layer-control and detail-map-layers (depend on each other)
