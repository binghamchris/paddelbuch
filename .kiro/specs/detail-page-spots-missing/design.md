# Detail Page Spots Missing — Bugfix Design

## Overview

Spot detail pages (`_layouts/spot.html`) fail to display a map marker because the JavaScript references a non-existent global `PaddelbuchMarkers.getMarkerIcon()`. The actual module exported by `assets/js/marker-styles.js` is `PaddelbuchMarkerStyles` with method `getSpotIcon()`. The fix is a single-line change: replace the incorrect call with the correct one. No other files are affected.

## Glossary

- **Bug_Condition (C)**: The page is a spot detail page (`layout: spot`) — the only context where `PaddelbuchMarkers.getMarkerIcon` is called
- **Property (P)**: A Leaflet marker with the correct icon appears on the map at the spot's GPS coordinates
- **Preservation**: All non-spot-detail pages, mouse interactions, and the main map's use of `PaddelbuchMarkerStyles` remain unchanged
- **PaddelbuchMarkerStyles**: The global module exported by `assets/js/marker-styles.js` containing `getSpotIcon(spotTypeSlug, isRejected)` and `getEventNoticeIcon()`
- **getSpotIcon()**: Method that maps a spot type slug (e.g., `'einstieg-ausstieg'`) and rejected flag to the correct `L.Icon` instance
- **layer-control.html**: The include that correctly uses `window.PaddelbuchMarkerStyles.getSpotIcon()` on the main map page

## Bug Details

### Fault Condition

The bug manifests when a user visits any spot detail page. The inline `<script>` in `_layouts/spot.html` calls `PaddelbuchMarkers.getMarkerIcon(spotType, isRejected)`, but no global named `PaddelbuchMarkers` exists. This throws a `ReferenceError`, which is uncaught, so no marker is added to the map.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PageRequest
  OUTPUT: boolean

  RETURN input.layout = "spot"
         AND input.spot.location.lat IS DEFINED
         AND input.spot.location.lon IS DEFINED
END FUNCTION
```

### Examples

- **Entry/Exit spot page**: User visits `/einstiegsorte/some-spot/`. Expected: marker with `startingspots-entryexit.svg` icon at spot coordinates. Actual: empty map, `ReferenceError: PaddelbuchMarkers is not defined` in console.
- **Rest spot page**: User visits a Rasthalte spot page. Expected: marker with `otherspots-rest.svg`. Actual: no marker, silent JS error.
- **Rejected spot page**: User visits a rejected spot page. Expected: marker with `otherspots-noentry.svg`. Actual: no marker, silent JS error.
- **Spot with only lat/lon**: Any spot with valid coordinates triggers the bug because the faulty line executes inside the `{% if lat and lon %}` block.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The main map page (`_includes/layer-control.html`) already uses `window.PaddelbuchMarkerStyles.getSpotIcon()` correctly — this must remain unchanged
- Waterway, obstacle, and notice detail pages (`_layouts/waterway.html`, `_layouts/obstacle.html`, `_layouts/notice.html`) do not reference `PaddelbuchMarkers` and must remain unchanged
- Mouse clicks, popups, zoom controls, and tile layers on the spot detail map must continue to work
- The `marker-styles.js` module itself is not modified

**Scope:**
All inputs that do NOT involve the spot detail page layout are completely unaffected by this fix. The change is confined to a single line in `_layouts/spot.html`.

## Hypothesized Root Cause

Based on the bug description, the root cause is clear:

1. **Wrong module name**: The code references `PaddelbuchMarkers` but the module is exported as `PaddelbuchMarkerStyles` in `assets/js/marker-styles.js` (line 119: `global.PaddelbuchMarkerStyles = { ... }`)

2. **Wrong method name**: The code calls `getMarkerIcon()` but the actual method is `getSpotIcon()` (line 122: `getSpotIcon: getSpotIcon`)

3. **Likely copy/paste or refactoring artifact**: The `layer-control.html` include uses the correct names, suggesting `spot.html` was written before the module was renamed or was copied from an outdated reference

4. **No defensive check**: Unlike `layer-control.html` which checks `window.PaddelbuchMarkerStyles` before calling, `spot.html` calls directly without a guard, causing an uncaught ReferenceError

## Correctness Properties

Property 1: Fault Condition - Spot Detail Marker Display

_For any_ spot detail page where the spot has valid GPS coordinates, the fixed `spot.html` layout SHALL call `PaddelbuchMarkerStyles.getSpotIcon(spotType, isRejected)` and display a Leaflet marker at the spot's coordinates with the returned icon, with no JavaScript errors.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-Spot-Detail Pages Unchanged

_For any_ page that is NOT a spot detail page (waterway, obstacle, notice detail pages, and the main map page), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing map rendering and marker functionality.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_layouts/spot.html`

**Line**: `var markerIcon = PaddelbuchMarkers.getMarkerIcon(spotType, isRejected);`

**Specific Changes**:
1. **Replace module name**: Change `PaddelbuchMarkers` → `PaddelbuchMarkerStyles`
2. **Replace method name**: Change `getMarkerIcon` → `getSpotIcon`

**Resulting line**:
```javascript
var markerIcon = PaddelbuchMarkerStyles.getSpotIcon(spotType, isRejected);
```

No other files require changes. The `marker-styles.js` module already exports the correct API. The `layer-control.html` include already uses the correct names.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause is the wrong module/method name.

**Test Plan**: Open spot detail pages in a browser and check the JavaScript console for errors. Verify that no marker appears on the map.

**Test Cases**:
1. **Entry/Exit Spot Page**: Visit a spot detail page with type `einstieg-ausstieg` — expect `ReferenceError` in console, no marker (will fail on unfixed code)
2. **Rejected Spot Page**: Visit a rejected spot detail page — expect same `ReferenceError`, no marker (will fail on unfixed code)
3. **Rest Spot Page**: Visit a Rasthalte spot page — expect same error (will fail on unfixed code)

**Expected Counterexamples**:
- Console shows `ReferenceError: PaddelbuchMarkers is not defined`
- Map renders but contains no marker layer

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderSpotDetailPage_fixed(input)
  ASSERT result.map.markers.length = 1
  ASSERT result.map.markers[0].position = (input.spot.lat, input.spot.lon)
  ASSERT result.map.markers[0].icon = PaddelbuchMarkerStyles.getSpotIcon(input.spotType, input.isRejected)
  ASSERT no_javascript_error(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderPage_original(input) = renderPage_fixed(input)
END FOR
```

**Testing Approach**: Since the fix is confined to a single line in `_layouts/spot.html`, preservation checking focuses on verifying that no other layout files were modified and that the main map page continues to work.

**Test Plan**: Verify other detail pages and the main map page render identically before and after the fix.

**Test Cases**:
1. **Main Map Preservation**: Verify `layer-control.html` still renders spot markers correctly on the main map using `PaddelbuchMarkerStyles.getSpotIcon()`
2. **Waterway Detail Preservation**: Verify waterway detail pages render their GeoJSON layers unchanged
3. **Obstacle/Notice Detail Preservation**: Verify obstacle and notice detail pages render unchanged

### Unit Tests

- Verify `PaddelbuchMarkerStyles.getSpotIcon()` returns correct icons for each spot type slug
- Verify `PaddelbuchMarkerStyles.getSpotIcon()` returns rejected icon when `isRejected` is true
- Verify `PaddelbuchMarkerStyles.getSpotIcon()` returns default icon for unknown slug

### Property-Based Tests

- Generate random spot type slugs and verify `getSpotIcon` returns a valid `L.Icon` instance
- Generate random combinations of `(spotTypeSlug, isRejected)` and verify the icon mapping is deterministic

### Integration Tests

- Build the Jekyll site and verify spot detail pages contain the corrected JavaScript call
- Visit spot detail pages in a browser and confirm markers appear at correct coordinates
- Verify the main map page still displays all spot markers correctly
