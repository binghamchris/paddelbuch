# Missing Map Layers Bugfix Design

## Overview

All map layers (spots, obstacles, protected areas, event notices) are empty on every page of the Paddelbuch Swiss Paddle Map. The Leaflet map initializes correctly and the layer control panel shows the correct layer names, but no data is ever loaded or rendered. The root cause is a disconnected data loading pipeline: the JavaScript modules (`spatial-utils.js`, `data-loader.js`, `zoom-layer-manager.js`, `marker-styles.js`, `layer-styles.js`) are never included as `<script>` tags on map pages, and no initialization code exists to fetch tile data from `/api/tiles/` and feed it to the layer group population functions exposed by `layer-control.html`.

The fix involves adding the missing script includes and writing initialization code that wires the data loader to the map's viewport events.

## Glossary

- **Bug_Condition (C)**: A map page loads and the required JS modules (`spatial-utils.js`, `data-loader.js`, `zoom-layer-manager.js`, `marker-styles.js`, `layer-styles.js`) are not included as script tags, and no initialization code invokes the data loading pipeline — resulting in empty layer groups.
- **Property (P)**: When a map page loads, all required JS modules are included, tile data is fetched for the initial viewport, and layer groups are populated with markers/GeoJSON features using the `paddelbuchAdd*` functions.
- **Preservation**: Existing behaviors that must remain unchanged: map initialization (center, bounds, zoom), layer control panel display, layer toggle functionality, spot/waterway detail page maps, tile generation at build time, noEntry layer default-hidden state.
- **`layer-control.html`**: The include in `_includes/` that creates empty Leaflet layer groups and exposes `paddelbuchAddSpotMarker`, `paddelbuchAddObstacleLayer`, `paddelbuchAddProtectedAreaLayer`, `paddelbuchAddEventNoticeMarker` as global functions.
- **`data-loader.js`**: Module in `assets/js/` that fetches tile JSON from `/api/tiles/` endpoints with caching and debouncing. Depends on `spatial-utils.js`.
- **`zoom-layer-manager.js`**: Module in `assets/js/` that manages obstacle/protected area layer visibility based on zoom level (threshold: 12).
- **`map-init.html`**: The include in `_includes/` that initializes the Leaflet map and stores it as `window.paddelbuchMap`.

## Bug Details

### Fault Condition

The bug manifests when any page containing a map (primarily `index.html` via `map-init.html`) loads. The `layer-control.html` include creates empty layer groups and exposes population functions, but no code ever calls those functions because the data loading modules are not included and no initialization glue code exists.

**Formal Specification:**
```
FUNCTION isBugCondition(page)
  INPUT: page of type HTMLPage
  OUTPUT: boolean

  RETURN page.includesMapInit == true
         AND page.includesLayerControl == true
         AND (
           NOT scriptTagExists(page, 'spatial-utils.js')
           OR NOT scriptTagExists(page, 'data-loader.js')
           OR NOT scriptTagExists(page, 'zoom-layer-manager.js')
           OR NOT scriptTagExists(page, 'marker-styles.js')
           OR NOT scriptTagExists(page, 'layer-styles.js')
           OR NOT initializationCodeExists(page)
         )
END FUNCTION
```

### Examples

- Main map page (`index.html`): Map renders with tile layer and controls, but zero spot markers appear. Expected: ~hundreds of spot markers across Switzerland.
- Main map page at zoom 12+: No obstacles or protected areas appear. Expected: red obstacle polygons and yellow protected area polygons in viewport.
- Main map page with event notices: No event notice markers appear. Expected: event notice markers with warning icons at notice locations.
- Waterway detail pages: Only the waterway GeoJSON renders; no spots/obstacles/notices for that waterway area. Expected: same as before (detail pages use inline scripts, not the tile pipeline).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Map initialization with Switzerland center (46.801111, 8.226667), bounds, zoom level 8, and zoom/locate controls
- Layer control panel appearance with all 9 layer names (5 spot types + noEntry + eventNotices + obstacles + protectedAreas)
- Layer toggle show/hide functionality via the Leaflet layers control
- Spot detail page (`_layouts/spot.html`) map with individual spot marker using inline script
- Waterway detail page (`_layouts/waterway.html`) map with waterway GeoJSON using inline script
- noEntry layer group remaining unchecked/hidden by default
- Tile JSON generation by `tile_generator.rb` during Jekyll build
- All existing popup content generation (spot, obstacle, event notice popups)

**Scope:**
All inputs that do NOT involve the main map page's data loading pipeline should be completely unaffected by this fix. This includes:
- Spot detail page maps (use inline scripts with `marker-styles.js` already included)
- Waterway detail page maps (use inline scripts with `layer-styles.js` already included)
- Jekyll build process and tile generation
- CSS styling and layout
- Header/footer rendering

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear and confirmed:

1. **Missing Script Includes**: The `map-init.html` include and `layer-control.html` include do not add `<script>` tags for `spatial-utils.js`, `data-loader.js`, `zoom-layer-manager.js`, `marker-styles.js`, or `layer-styles.js`. The `layer-control.html` only includes `locale-filter.js`, `clipboard.js`, `spot-popup.js`, `obstacle-popup.js`, and `event-notice-popup.js`.

2. **No Initialization Glue Code**: Even if the modules were included, there is no code that:
   - Waits for both `paddelbuchMap` and `paddelbuchLayerGroups` to be ready
   - Calls `PaddelbuchDataLoader.loadDataForBounds()` with the initial viewport bounds
   - Iterates over the returned data and calls `paddelbuchAddSpotMarker()`, `paddelbuchAddEventNoticeMarker()`, etc.
   - Binds `moveend`/`zoomend` events to trigger subsequent data loads
   - Initializes `PaddelbuchZoomLayerManager` with the map and layer groups

3. **Script Load Order**: The modules have dependencies (`data-loader.js` depends on `spatial-utils.js`; `zoom-layer-manager.js` depends on `data-loader.js`), so they must be included in the correct order.

## Correctness Properties

Property 1: Fault Condition - Map Layers Populated on Page Load

_For any_ map page where `map-init.html` and `layer-control.html` are included, the fixed code SHALL include all required JavaScript modules and execute initialization code that fetches tile data for the initial viewport and populates the layer groups with spot markers, event notice markers, obstacle layers, and protected area layers (at appropriate zoom levels).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Existing Map and Layer Control Behavior

_For any_ page or interaction that does NOT involve the data loading pipeline (map initialization, layer control display, layer toggling, spot/waterway detail pages, tile generation), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_includes/map-init.html`

**Approach**: Add script tags and initialization code after the layer control include.

**Specific Changes**:

1. **Add Missing Script Tags**: After the `{% include layer-control.html %}` line, add `<script>` tags for the five missing modules in dependency order:
   - `marker-styles.js` (no dependencies)
   - `layer-styles.js` (no dependencies)
   - `spatial-utils.js` (no dependencies)
   - `data-loader.js` (depends on `spatial-utils.js`)
   - `zoom-layer-manager.js` (depends on `data-loader.js`)

2. **Add Initialization Glue Code**: Add a new `<script>` block that:
   - Waits for `window.paddelbuchMap` and `window.paddelbuchLayerGroups` to be available
   - Converts the map's current bounds to the bounds object format using `PaddelbuchSpatialUtils.leafletBoundsToObject()`
   - Calls `PaddelbuchDataLoader.loadDataForBounds()` with initial viewport bounds, zoom, and locale
   - Iterates over returned spots and calls `window.paddelbuchAddSpotMarker()` for each
   - Iterates over returned notices and calls `window.paddelbuchAddEventNoticeMarker()` for each
   - Iterates over returned obstacles and calls `window.paddelbuchAddObstacleLayer()` for each
   - Iterates over returned protected areas and calls `window.paddelbuchAddProtectedAreaLayer()` for each

3. **Bind Viewport Events**: The initialization code should:
   - Listen for `moveend` on the map to trigger debounced data loading for new viewport
   - Initialize `PaddelbuchZoomLayerManager.initZoomLayerManager()` with the map and layer groups to handle zoom-based obstacle/protected area loading

4. **Deduplication**: Track loaded item slugs to avoid adding duplicate markers/layers when the user pans and tiles overlap.

5. **Locale Awareness**: Pass `window.paddelbuchCurrentLocale` to the data loader so tile fetches use the correct locale path.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that check whether the required script tags exist in the rendered HTML of map pages, and whether initialization code is present. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Script Inclusion Test**: Check that `index.html` rendered output contains `<script>` tags for all five JS modules (will fail on unfixed code)
2. **Initialization Code Test**: Check that rendered output contains code that calls `PaddelbuchDataLoader.loadDataForBounds` (will fail on unfixed code)
3. **Data Loader Wiring Test**: Verify that `moveend` event handler is bound to trigger data loading (will fail on unfixed code)
4. **ZoomLayerManager Init Test**: Verify that `PaddelbuchZoomLayerManager.initZoomLayerManager` is called (will fail on unfixed code)

**Expected Counterexamples**:
- The rendered HTML of `index.html` does not contain script tags for `data-loader.js`, `spatial-utils.js`, or `zoom-layer-manager.js`
- No initialization code exists that calls the data loading functions

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL page WHERE isBugCondition(page) DO
  result := renderPage_fixed(page)
  ASSERT scriptTagExists(result, 'spatial-utils.js')
  ASSERT scriptTagExists(result, 'data-loader.js')
  ASSERT scriptTagExists(result, 'zoom-layer-manager.js')
  ASSERT scriptTagExists(result, 'marker-styles.js')
  ASSERT scriptTagExists(result, 'layer-styles.js')
  ASSERT initializationCodeExists(result)
  ASSERT dataLoaderCalledOnLoad(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL page WHERE NOT isBugCondition(page) DO
  ASSERT renderPage_original(page) = renderPage_fixed(page)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for spot detail pages, waterway detail pages, and layer control interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Map Init Preservation**: Verify map center, bounds, zoom, and controls are unchanged after fix
2. **Layer Control Preservation**: Verify layer control panel still shows all 9 layers with correct names
3. **Detail Page Preservation**: Verify spot and waterway detail pages render identically after fix
4. **NoEntry Default Hidden**: Verify noEntry layer remains unchecked by default

### Unit Tests

- Test that `map-init.html` rendered output includes all required script tags in correct order
- Test that initialization code waits for map and layer groups before executing
- Test that data loader is called with correct bounds and locale on page load
- Test deduplication logic (same spot slug not added twice)

### Property-Based Tests

- Generate random viewport bounds within Switzerland and verify data loading returns valid tile data
- Generate random zoom levels and verify obstacle/protected area visibility matches threshold rules
- Generate random sequences of pan/zoom events and verify no duplicate markers are created

### Integration Tests

- Test full page load flow: map init → layer control → script includes → data load → markers visible
- Test pan interaction: move map → debounced data load → new markers appear
- Test zoom to level 12: obstacles and protected areas become visible
- Test zoom below level 12: obstacles and protected areas are hidden
