# CSP Inline Script Extraction Bugfix Design

## Overview

Five shared Jekyll includes (`color-vars.html`, `map-init.html`, `layer-control.html`, `filter-panel.html`, `detail-map-layers.html`) contain inline `<script>` blocks that are blocked by the deployed Content-Security-Policy header (`script-src 'self'`). This breaks the home page map entirely, disables all data layers and filter UI on every page, and leaves `window.PaddelbuchColors` undefined. The fix extracts each inline script into an external `.js` file, passing Jekyll-generated data via CSP-safe `<script type="application/json">` elements — the same pattern already used successfully for the four detail page layouts.

## Glossary

- **Bug_Condition (C)**: Any page load where the browser evaluates a `<script>` block whose source is inline (not from an external file), causing the CSP `script-src 'self'` directive to block execution
- **Property (P)**: All JavaScript that was previously inline executes successfully from external files, producing identical runtime behavior
- **Preservation**: The four detail page layouts (`spot.html`, `waterway.html`, `obstacle.html`, `notice.html`) already use external scripts and `#map-config` JSON — their behavior must remain unchanged. Mouse clicks, popups, locale switching, filter interactions, and the color pipeline (SCSS → Ruby plugin → `site.data` → JSON → `window.PaddelbuchColors` → `layer-styles.js`) must all continue to work.
- **`color-vars.html`**: Include in `_layouts/default.html` `<head>` that sets `window.PaddelbuchColors` from `site.data.paddelbuch_colors`
- **`map-init.html`**: Include on the home page (`index.html`) containing two inline scripts — map initialization and data loading bootstrap
- **`layer-control.html`**: Include used by both `map-init.html` and `detail-map-layers.html` that creates layer groups, marker/layer creation functions, and a protected-area-type lookup map
- **`filter-panel.html`**: Include that defines the `PaddelbuchFilterPanel` Leaflet control — pure JavaScript, no Jekyll variables
- **`detail-map-layers.html`**: Include used by all four detail layouts that bootstraps the data loading pipeline with locale-dependent dimension configs

## Bug Details

### Bug Condition

The bug manifests when any page is loaded in a browser that enforces the CSP `script-src 'self'` directive. The browser blocks all inline `<script>` blocks, preventing map initialization, layer control setup, filter panel rendering, data pipeline bootstrapping, and color variable assignment.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageLoad
  OUTPUT: boolean

  RETURN pageContainsInlineScript(input.renderedHTML)
         AND cspHeader(input.response).scriptSrc == "'self'"
         AND NOT scriptHasSrcAttribute(inlineScript)
         AND NOT scriptTypeIsNonExecutable(inlineScript)
END FUNCTION
```

### Examples

- Home page load → `map-init.html` first inline script blocked → map container is empty, no Leaflet map rendered
- Home page load → `map-init.html` second inline script blocked → no data tiles loaded, no spots/obstacles/notices/protected areas displayed
- Any page load → `color-vars.html` inline script blocked → `window.PaddelbuchColors` is `undefined` → `layer-styles.js` reads `{}` → all layer colors are `undefined`
- Detail page load → `layer-control.html` inline script blocked → `window.paddelbuchAddSpotMarker` is `undefined` → data pipeline cannot populate layers
- Any map page load → `filter-panel.html` inline script blocked → `PaddelbuchFilterPanel` is `undefined` → filter panel UI not rendered
- Detail page load → `detail-map-layers.html` inline script blocked → `PaddelbuchFilterEngine.init()` never called → no dimension filtering, no data loading

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Detail page map initialization via existing `paddelbuch-map.js` + per-layout scripts (`spot-map.js`, `waterway-map.js`, `obstacle-map.js`, `notice-map.js`) reading from `#map-config` JSON
- Mouse clicks on map markers and layers continue to open popups with correct content
- Filter panel checkbox interactions continue to toggle spot visibility and layer group visibility
- Locale-dependent labels, dimension options, popup text, and layer toggle names display correctly in both `de` and `en`
- The color pipeline (SCSS → `color_generator.rb` → `site.data['paddelbuch_colors']` → JSON → `window.PaddelbuchColors` → `layer-styles.js`) continues to produce correct color values
- Tile-based data loading with viewport-based fetching, caching, and debouncing continues to work
- Zoom-based layer visibility (obstacles/protected areas at zoom ≥ 12) continues to work
- The CSP header continues to enforce `script-src 'self'` without requiring `'unsafe-inline'`

**Scope:**
All inputs that do NOT involve inline script execution should be completely unaffected by this fix. This includes:
- All CSS styling and layout
- All HTML structure and content
- All existing external JavaScript files
- All Jekyll build-time data generation (Ruby plugins, Liquid templates)
- All API tile JSON files

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Inline `<script>` blocks in includes**: Five include files contain JavaScript directly in `<script>` tags without a `src` attribute. The CSP `script-src 'self'` directive blocks these because inline scripts are not from `'self'`.

2. **Jekyll variable interpolation**: Three of the five includes (`color-vars.html`, `layer-control.html`, `map-init.html` / `detail-map-layers.html`) use Liquid template variables (`{{ }}` and `{% %}`) inside the inline scripts to inject build-time data (locale, mapbox URL, map center, protected area types, dimension labels, paddle craft types). This was the original reason they were left as inline scripts — the data needed to be injected at build time.

3. **Previous spec scope limitation**: The `codebase-quality-improvements` spec extracted inline scripts from the four detail layouts but explicitly left the shared includes untouched, creating a partial fix.

4. **Solution pattern already proven**: The detail layouts demonstrate the working pattern — `<script type="application/json" id="...">` elements pass Jekyll data, and external JS files read and parse the JSON at runtime.

## Correctness Properties

Property 1: Bug Condition - Inline Scripts Eliminated

_For any_ page load where the CSP header enforces `script-src 'self'`, the fixed includes SHALL contain zero inline `<script>` blocks (only `<script type="application/json">` data elements and `<script src="...">` external file references), resulting in zero CSP violations in the browser console.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Existing Behavior Unchanged

_For any_ page load after the fix is applied, the runtime JavaScript behavior SHALL be identical to the pre-fix behavior when CSP is not enforced — the same global variables are set (`window.PaddelbuchColors`, `window.paddelbuchMap`, `window.paddelbuchLayerGroups`, `window.paddelbuchAddSpotMarker`, etc.), the same Leaflet map is created with the same options, the same layer groups are populated, and the same filter UI is rendered, preserving all existing functionality for detail pages, home page, popups, filters, and locale switching.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_includes/color-vars.html`

**Change**: Replace the inline script with a JSON data element and an external script reference.

**Specific Changes**:
1. **Replace inline script**: Change `<script>window.PaddelbuchColors = {{ site.data.paddelbuch_colors | jsonify }};</script>` to a `<script type="application/json" id="paddelbuch-colors">` element containing the jsonified color data, followed by `<script src="assets/js/color-vars.js">`.

**File**: `assets/js/color-vars.js` (new)

**Specific Changes**:
1. **Read JSON**: Parse `#paddelbuch-colors` element's `textContent`
2. **Set global**: Assign parsed object to `window.PaddelbuchColors`
3. **Execute immediately**: No DOMContentLoaded wait needed since this runs in `<head>` after the JSON element — but the script tag is after the JSON element so `document.getElementById` will find it. Use an IIFE.

**File**: `_includes/map-init.html`

**Change**: Replace both inline scripts with JSON data elements and external script references.

**Specific Changes**:
1. **First inline script (map init)**: Replace with `<script type="application/json" id="map-config">` containing center, zoom, maxZoom, maxBoundsViscosity, minZoom, mapboxUrl, locale, and a `homePageOptions` object with `maxBounds`, `zoomControl: false`, `minZoom: 7`. Then load `paddelbuch-map.js` followed by a new `home-map.js`.
2. **Second inline script (data bootstrap)**: Replace with `<script type="application/json" id="map-data-config">` containing locale-dependent dimension labels/options and layer toggle labels (all the Jekyll `{% if %}` / `{% for %}` data). Then load `map-data-init.js`.
3. **Remove nested includes**: The `{% include layer-control.html %}` and `{% include filter-panel.html %}` calls remain but their content changes (see below). The script loading order in `map-init.html` must ensure dependencies load before `map-data-init.js`.

**File**: `assets/js/paddelbuch-map.js` (modify)

**Specific Changes**:
1. **Support additional config options**: Read optional `maxBounds`, `maxBoundsViscosity`, `minZoom`, `zoomControl` from the `#map-config` JSON. When present, pass them to `L.map()`. When `zoomControl` is `false`, manually add `L.control.zoom({ position: 'bottomright' })` instead of using the default.
2. **Store switzerlandBounds**: When `maxBounds` is provided, store `window.switzerlandBounds` for other scripts that reference it.
3. **Backward compatible**: When these optional fields are absent (detail pages), behavior is identical to current implementation.

**File**: `assets/js/home-map.js` (new)

**Specific Changes**:
1. **Initialize home page map**: Call `PaddelbuchMap.init('map')` and store result as `window.paddelbuchMap`.
2. **Minimal script**: The home page map has no geometry to render or bounds to fit — it just needs the map instance stored globally.

**File**: `_includes/layer-control.html`

**Change**: Replace the inline script with a JSON data element and an external script reference.

**Specific Changes**:
1. **JSON data element**: Create `<script type="application/json" id="layer-control-config">` containing `currentLocale`, `localePrefix`, and `protectedAreaTypeNames` (the `{% for %}` loop output as a JSON object).
2. **Keep external script tags**: The `<script src="...">` tags for `locale-filter.js`, `clipboard.js`, `html-utils.js`, `date-utils.js`, `spot-popup.js`, `obstacle-popup.js`, `event-notice-popup.js` remain unchanged.
3. **Add external script**: Add `<script src="assets/js/layer-control.js">`.

**File**: `assets/js/layer-control.js` (new)

**Specific Changes**:
1. **Read config**: Parse `#layer-control-config` JSON for `currentLocale`, `localePrefix`, `protectedAreaTypeNames`
2. **Move all logic**: The entire IIFE from the inline script moves here, replacing the Liquid variable references with values from the parsed config
3. **Same global exports**: Set `window.paddelbuchLayerGroups`, `window.paddelbuchFilterByLocale`, `window.paddelbuchAddSpotMarker`, `window.paddelbuchAddEventNoticeMarker`, `window.paddelbuchAddObstacleLayer`, `window.paddelbuchAddProtectedAreaLayer`, `window.paddelbuchCurrentLocale`

**File**: `_includes/filter-panel.html`

**Change**: Replace the inline script with an external script reference.

**Specific Changes**:
1. **Direct extraction**: Since this file contains no Jekyll variables, simply replace the `<script>...</script>` with `<script src="assets/js/filter-panel.js">`.

**File**: `assets/js/filter-panel.js` (new)

**Specific Changes**:
1. **Move IIFE verbatim**: The entire `PaddelbuchFilterPanel` IIFE moves to this file with no changes needed (no Jekyll variables to replace).

**File**: `_includes/detail-map-layers.html`

**Change**: Replace the inline bootstrap script with a JSON data element and an external script reference.

**Specific Changes**:
1. **JSON data element**: Create `<script type="application/json" id="map-data-config">` containing the locale-dependent `dimensionConfigs` (spot type labels, paddle craft type labels from `{% for %}` loop) and `layerLabels`. The `matchFn` functions cannot be serialized to JSON — they will be defined in the external JS file.
2. **Add external script**: Add `<script src="assets/js/map-data-init.js">`.
3. **Remove inline script**: Delete the entire inline `<script>` block.

**File**: `assets/js/map-data-init.js` (new)

**Specific Changes**:
1. **Read config**: Parse `#map-data-config` JSON for dimension labels/options and layer labels
2. **Attach matchFn**: Add the `matchFn` functions programmatically after reading the config (these are always the same logic — match `spotType_slug` against selected set, and match `paddleCraftTypes` array against selected set)
3. **Consolidate**: This single file serves both the home page (`map-init.html`) and detail pages (`detail-map-layers.html`) since the bootstrap logic is nearly identical — both create `populateLayers`, init filter engine/panel, load initial data, bind `moveend`, and init zoom layer manager
4. **Same runtime behavior**: Identical to the current inline scripts

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Open the deployed site (or a local build served with CSP headers) in a browser and check the console for CSP violation errors. Verify that the map does not render on the home page and that data layers are missing on detail pages.

**Test Cases**:
1. **Home Page Map Test**: Load home page → verify map container is empty and console shows CSP violation for `map-init.html` inline script (will fail on unfixed code)
2. **Color Variables Test**: Load any page → verify `window.PaddelbuchColors` is `undefined` in console and layer styles have `undefined` color values (will fail on unfixed code)
3. **Layer Control Test**: Load any map page → verify `window.paddelbuchAddSpotMarker` is `undefined` (will fail on unfixed code)
4. **Filter Panel Test**: Load any map page → verify `PaddelbuchFilterPanel` is `undefined` (will fail on unfixed code)
5. **Data Pipeline Test**: Load detail page → verify no tile data is fetched and no markers appear (will fail on unfixed code)

**Expected Counterexamples**:
- Browser console shows `Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'"`
- Possible causes: inline `<script>` blocks without `src` attribute in five include files

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL page WHERE containsFormerInlineScript(page) DO
  response := loadPage(page)
  ASSERT cspViolationCount(response) == 0
  ASSERT allGlobalVariablesSet(response)
  ASSERT mapRendered(response) OR pageHasNoMap(page)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL page WHERE NOT containsFormerInlineScript(page) DO
  ASSERT renderResult_original(page) == renderResult_fixed(page)
END FOR

FOR ALL detailPage IN [spot, waterway, obstacle, notice] DO
  ASSERT mapInitBehavior_fixed(detailPage) == mapInitBehavior_original(detailPage)
  ASSERT dataLayerBehavior_fixed(detailPage) == dataLayerBehavior_original(detailPage)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first (with CSP disabled) for map initialization, layer population, filter interactions, and color variable usage, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Detail Page Map Preservation**: Verify that `paddelbuch-map.js` with new optional config fields still produces identical maps for detail pages (no `maxBounds`, no `minZoom` override)
2. **Color Pipeline Preservation**: Verify that `color-vars.js` reading from JSON produces the same `window.PaddelbuchColors` object as the original inline assignment
3. **Layer Control Preservation**: Verify that `layer-control.js` reading from JSON config produces the same global functions and layer groups as the original inline script
4. **Filter Panel Preservation**: Verify that `filter-panel.js` produces the same `PaddelbuchFilterPanel` control as the original inline script
5. **Data Pipeline Preservation**: Verify that `map-data-init.js` reading from JSON config produces the same dimension configs, filter engine initialization, and data loading behavior

### Unit Tests

- Test `paddelbuch-map.js` with and without optional home page config fields (`maxBounds`, `minZoom`, `zoomControl`)
- Test `color-vars.js` reads and parses `#paddelbuch-colors` JSON correctly
- Test `layer-control.js` reads `#layer-control-config` and creates correct layer groups and global functions
- Test `map-data-init.js` reads `#map-data-config` and initializes filter engine with correct dimension configs
- Test `filter-panel.js` creates the Leaflet control with correct DOM structure

### Property-Based Tests

- Generate random color objects and verify `color-vars.js` faithfully transfers them from JSON to `window.PaddelbuchColors`
- Generate random locale/protected-area-type configurations and verify `layer-control.js` produces correct `protectedAreaTypeNames` lookup
- Generate random dimension config options and verify `map-data-init.js` passes them correctly to `PaddelbuchFilterEngine.init()`

### Integration Tests

- Build the Jekyll site and verify zero inline `<script>` blocks remain in the five modified includes
- Serve the built site with CSP headers and verify zero console violations
- Verify home page map renders with correct bounds, zoom, and controls
- Verify detail page maps continue to render with correct geometry and markers
- Verify filter panel appears and checkbox interactions toggle marker/layer visibility
- Verify locale switching produces correct labels in both `de` and `en`
