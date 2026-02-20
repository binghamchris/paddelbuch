# Missing Map Layers - Tasks

## Task 1: Add missing script includes to map-init.html
- [x] 1.1 Add `<script>` tags for `marker-styles.js` and `layer-styles.js` after the `{% include layer-control.html %}` line in `_includes/map-init.html`
- [x] 1.2 Add `<script>` tags for `spatial-utils.js`, `data-loader.js`, and `zoom-layer-manager.js` after the style scripts (in dependency order)

## Task 2: Create map data initialization code
- [x] 2.1 Add initialization script block in `_includes/map-init.html` after the module script tags that waits for `window.paddelbuchMap` and `window.paddelbuchLayerGroups` to be available
- [x] 2.2 Implement initial data load: convert map bounds using `PaddelbuchSpatialUtils.leafletBoundsToObject()`, call `PaddelbuchDataLoader.loadDataForBounds()` with bounds, zoom, and locale, then iterate results calling `paddelbuchAddSpotMarker`, `paddelbuchAddEventNoticeMarker`, `paddelbuchAddObstacleLayer`, `paddelbuchAddProtectedAreaLayer`
- [x] 2.3 Add slug-based deduplication tracking to prevent duplicate markers/layers when tiles overlap
- [x] 2.4 Bind `moveend` event on the map to trigger debounced data loading via `PaddelbuchDataLoader.loadDataForBoundsDebounced()` for new viewport data, with the same population and deduplication logic
- [x] 2.5 Initialize `PaddelbuchZoomLayerManager.initZoomLayerManager()` with the map, layer groups, and locale option

## Task 3: Write exploratory fault condition test (PBT)
- [~] 3.1 Create `_tests/property/map-layers-script-inclusion.property.test.js` that reads the raw `_includes/map-init.html` source and verifies the required script tags and initialization code are present — this test should FAIL on unfixed code to confirm the bug condition `Property 1`

## Task 4: Write fix verification test (PBT)
- [~] 4.1 Create `_tests/property/map-layers-data-init.property.test.js` that tests the initialization logic: for random viewport bounds within Switzerland, verify `PaddelbuchDataLoader.loadDataForBounds` returns data and the population functions are callable with that data `Property 1`

## Task 5: Write preservation test (PBT)
- [~] 5.1 Create `_tests/property/map-layers-preservation.property.test.js` that verifies: map-init.html still contains map initialization with Switzerland center/bounds/zoom, layer-control.html still creates all 9 layer groups, and noEntry layer is not added to map by default `Property 2`

## Task 6: Verify fix end-to-end
- [~] 6.1 Build the Jekyll site and verify the rendered `_site/index.html` contains all five script tags in correct dependency order
- [~] 6.2 Verify the rendered HTML contains initialization code that references `PaddelbuchDataLoader` and `PaddelbuchZoomLayerManager`
- [~] 6.3 Run the full test suite to confirm all existing tests still pass
