# Marker Click Event Fix — Bugfix Design

## Overview

The `marker.click` Tinylytics events are not being recorded because the current implementation places `data-tinylytics-event="marker.click"` on the outermost wrapper `<div>` of popup content HTML. When a user clicks a Leaflet marker or GeoJSON layer, the click lands on Leaflet's internal DOM elements (marker icon `<img>`, canvas/SVG path), not on the popup HTML. Leaflet intercepts the click, opens the popup, and injects the popup HTML into the DOM — but the original click event never reaches the popup content wrapper div.

The fix introduces a hidden beacon element approach: a new `PaddelbuchTinylyticsBeacon` module creates a hidden `<div>` with `data-tinylytics-event` and `data-tinylytics-event-value` attributes, dispatches a synthetic DOM `click` event on it (which Tinylytics' document-level event delegation captures), then removes the element. This beacon dispatch is called from Leaflet's own `click` event handlers on each marker and GeoJSON layer in `layer-control.js`. The now-inert `marker.click` wrapper div is removed from all popup generators.

## Glossary

- **Bug_Condition (C)**: A user click on a Leaflet map marker or GeoJSON layer — these clicks land on Leaflet's internal DOM elements, never reaching the popup content wrapper div that carries `data-tinylytics-event`
- **Property (P)**: When a marker or layer is clicked, a `marker.click` Tinylytics event SHALL be recorded with the entity slug as the event value
- **Preservation**: All non-marker-click Tinylytics events (`popup.navigate`, `popup.details`, `filter.change`, `layer.toggle`, `dashboard.switch`) must continue to work unchanged; popup HTML structure must remain visually and functionally identical
- **Beacon Element**: A hidden DOM `<div>` created transiently by `PaddelbuchTinylyticsBeacon.dispatch()`, carrying `data-tinylytics-event` and `data-tinylytics-event-value` attributes, which receives a synthetic `click` event and is then removed
- **`PaddelbuchTinylyticsBeacon`**: New vanilla JS IIFE module in `assets/js/tinylytics-beacon.js` that exposes a `dispatch(eventName, eventValue)` function
- **`bindMarkerRecenter`**: Existing function in `layer-control.js` that binds a Leaflet `click` handler to recenter/zoom the map — the beacon dispatch call will be added alongside this existing handler

## Bug Details

### Bug Condition

The bug manifests when a user clicks any Leaflet map marker (spot, event notice) or GeoJSON layer (obstacle polygon, protected area polygon, event notice affected area). The `data-tinylytics-event="marker.click"` attribute on the popup content wrapper `<div>` is never reached by the click event because Leaflet intercepts the click on its own internal DOM elements, opens the popup, and injects the popup HTML into the DOM after the click has already been consumed.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserClickEvent
  OUTPUT: boolean

  RETURN input.target IS LeafletMarkerIcon
         OR input.target IS LeafletGeoJSONPath
         // These clicks are intercepted by Leaflet and never propagate
         // to the popup content wrapper div that carries data-tinylytics-event
         AND popupContentHasMarkerClickAttribute(input.associatedEntity)
         AND NOT tinylyticsEventFired('marker.click', input.associatedEntity.slug)
END FUNCTION
```

### Examples

- **Spot marker click**: User clicks a spot marker icon → Leaflet opens the spot popup → `marker.click` event is NOT recorded because the click landed on the `<img>` marker icon, not the popup wrapper div. Expected: `marker.click` event with spot slug recorded.
- **Obstacle polygon click**: User clicks an obstacle polygon → Leaflet opens the obstacle popup → `marker.click` event is NOT recorded because the click landed on the SVG/canvas path. Expected: `marker.click` event with obstacle slug recorded.
- **Event notice marker click**: User clicks an event notice marker → Leaflet opens the notice popup → `marker.click` event is NOT recorded. Expected: `marker.click` event with notice slug recorded.
- **Protected area polygon click**: User clicks a protected area polygon → Leaflet opens the protected area popup → `marker.click` event is NOT recorded. Expected: `marker.click` event with protected area slug/name recorded.
- **Edge case — click inside open popup**: User clicks on non-interactive text inside an already-open popup that has the `marker.click` wrapper div → Tinylytics DOES capture this click, but this is an accidental side-effect, not the intended tracking path. After the fix, this accidental capture is removed (wrapper div removed), and the intentional beacon dispatch handles all marker.click tracking.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `popup.navigate` buttons inside spot popups must continue to carry `data-tinylytics-event="popup.navigate"` and fire correctly on user click
- `popup.details` buttons inside all popups must continue to carry `data-tinylytics-event="popup.details"` and fire correctly on user click
- `filter.change` checkboxes in the filter panel must continue to work (filter-panel.js is not modified)
- `layer.toggle` checkboxes in the filter panel must continue to work (filter-panel.js is not modified)
- `dashboard.switch` tab buttons must continue to work (dashboard-switcher.js is not modified)
- Popup HTML structure (title, details table, buttons, links) must remain visually and functionally identical — only the outer `marker.click` wrapper div is removed
- The Tinylytics script URL (`?events&beacon`) must remain unchanged
- CSP compliance must be maintained: no inline scripts, no inline style attributes, no `eval()`

**Scope:**
All inputs that do NOT involve clicking a Leaflet marker or GeoJSON layer should be completely unaffected by this fix. This includes:
- Clicks on popup buttons (navigate, details) — these use their own `data-tinylytics-event` attributes and are unaffected
- Filter panel interactions
- Dashboard switcher interactions
- Language switcher clicks
- Clipboard copy button clicks
- All other page interactions

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is confirmed (not hypothesized):

1. **Architectural Mismatch**: Tinylytics is purely attribute-based — it listens for DOM `click` events on elements carrying `data-tinylytics-event`. The current implementation places `marker.click` attributes on the popup content wrapper `<div>`. But when a user clicks a Leaflet marker, the click lands on Leaflet's internal `<img>` element (for markers) or SVG/canvas path (for GeoJSON layers), not on the popup HTML.

2. **Leaflet Click Interception**: Leaflet intercepts the click on its internal elements, opens the popup, and injects the popup HTML into the DOM. The original click event has already been consumed by Leaflet's event system and never propagates to the newly-injected popup content.

3. **No Tinylytics JS API**: Tinylytics has no client-side JavaScript API for programmatic event sending. Events can only be triggered via DOM click events on annotated elements. This means we cannot simply call a function — we must dispatch a synthetic DOM click on an annotated element.

4. **Solution**: Create a hidden beacon element with the correct `data-tinylytics-event` attributes, dispatch a synthetic `click` event on it from Leaflet's own click handlers, and remove the now-inert wrapper div from popup HTML.

## Correctness Properties

Property 1: Bug Condition — Beacon dispatch creates correct DOM element and fires click

_For any_ event name string and event value string passed to `PaddelbuchTinylyticsBeacon.dispatch()`, the function SHALL create a DOM element with `data-tinylytics-event` set to the event name and `data-tinylytics-event-value` set to the event value, append it to `document.body`, dispatch a synthetic `MouseEvent('click')` on it that bubbles (so Tinylytics' document-level delegation captures it), and then remove the element from the DOM.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Beacon element uses CSS class, not inline styles

_For any_ call to `PaddelbuchTinylyticsBeacon.dispatch()`, the created beacon element SHALL have the CSS class `tinylytics-beacon` applied and SHALL NOT have any `style` attribute, preserving CSP compliance with `style-src 'self'`.

**Validates: Requirements 2.6, 3.7**

Property 3: Popup HTML no longer contains marker.click wrapper div

_For any_ valid entity (spot, rejected spot, obstacle, event notice) with a slug and name, the popup HTML generated by the corresponding popup module (`generateSpotPopupContent`, `generateRejectedSpotPopupContent`, `generateObstaclePopupContent`, `generateEventNoticePopupContent`) SHALL NOT contain `data-tinylytics-event="marker.click"` on any element.

**Validates: Requirements 2.7, 1.5**

Property 4: Preservation — popup.navigate and popup.details attributes unchanged

_For any_ valid spot with a slug, location, and name, the popup HTML generated by `generateSpotPopupContent` SHALL still contain `data-tinylytics-event="popup.navigate"` on the navigate button and `data-tinylytics-event="popup.details"` on the more-details button with the correct slug values. For obstacle and event notice popups, `popup.details` SHALL still be present.

**Validates: Requirements 3.1, 3.2, 3.6**

Property 5: Preservation — popup structural content unchanged

_For any_ valid entity, the popup HTML generated by the corresponding popup module SHALL still contain the popup title (`popup-title`), and the more-details button structure, preserving the visual and functional popup layout after the `marker.click` wrapper div is removed.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

**File**: `assets/js/tinylytics-beacon.js` (NEW)

**Module**: `PaddelbuchTinylyticsBeacon`

**Purpose**: Provide a `dispatch(eventName, eventValue)` function that creates a hidden beacon element, dispatches a synthetic click, and removes it.

**Specific Implementation**:
1. **IIFE-to-global pattern**: Follow the project's vanilla JS module convention
2. **`dispatch(eventName, eventValue)` function**:
   - Create a `<div>` element
   - Add CSS class `tinylytics-beacon` (hidden via the stylesheet, not inline styles)
   - Set `data-tinylytics-event` to `eventName`
   - Set `data-tinylytics-event-value` to `eventValue`
   - Append to `document.body`
   - Dispatch `new MouseEvent('click', { bubbles: true })` — bubbling is required so Tinylytics' document-level click listener captures it
   - Remove the element from `document.body`
3. **Guard**: If `eventName` is falsy, return early without creating an element

---

**File**: `_sass/util/_helpers.scss`

**Change**: Add `.tinylytics-beacon` CSS class

**Specific Implementation**:
- Add a `.tinylytics-beacon` rule using the same visually-hidden pattern (position absolute, 1×1px, clip-path inset) to hide the beacon element without using inline styles

---

**File**: `assets/js/layer-control.js`

**Function**: `addSpotMarker`, `addObstacleLayer`, `addProtectedAreaLayer`, `addEventNoticeMarker`

**Specific Changes**:
1. **`addSpotMarker`**: In the existing `bindMarkerRecenter` click handler (or a new click handler), call `PaddelbuchTinylyticsBeacon.dispatch('marker.click', spot.slug)` when the marker is clicked
2. **`addObstacleLayer`**: Add a click handler on the `obstacleLayer` GeoJSON layer that calls `PaddelbuchTinylyticsBeacon.dispatch('marker.click', obstacle.slug)`; also on the portage route layer if present
3. **`addProtectedAreaLayer`**: Add a click handler on the `protectedAreaLayer` that calls `PaddelbuchTinylyticsBeacon.dispatch('marker.click', protectedArea.slug || protectedArea.name)`
4. **`addEventNoticeMarker`**: In the existing `bindMarkerRecenter` click handler, call `PaddelbuchTinylyticsBeacon.dispatch('marker.click', notice.slug)`; also on the `areaLayer` if present
5. **Remove `marker.click` wrapper div** from all fallback popup HTML strings — replace the outer `<div data-tinylytics-event="marker.click" ...>` with a plain `<div>`

---

**File**: `assets/js/spot-popup.js`

**Functions**: `generateSpotPopupContent`, `generateRejectedSpotPopupContent`

**Specific Changes**:
1. Remove `data-tinylytics-event="marker.click"` and `data-tinylytics-event-value` from the outer wrapper `<div>` — change to a plain `<div>`
2. Keep all `popup.navigate` and `popup.details` attributes unchanged

---

**File**: `assets/js/obstacle-popup.js`

**Function**: `generateObstaclePopupContent`

**Specific Changes**:
1. Remove `data-tinylytics-event="marker.click"` and `data-tinylytics-event-value` from the outer wrapper `<div>` — change to a plain `<div>`
2. Keep `popup.details` attributes unchanged

---

**File**: `assets/js/event-notice-popup.js`

**Function**: `generateEventNoticePopupContent`

**Specific Changes**:
1. Remove `data-tinylytics-event="marker.click"` and `data-tinylytics-event-value` from the outer wrapper `<div>` — change to a plain `<div>`
2. Keep `popup.details` attributes unchanged

---

**File**: `_layouts/default.html`

**Change**: Add `<script>` tag for `tinylytics-beacon.js` before `layer-control.js` in the script loading order

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (exploratory), then verify the fix works correctly (fix checking) and preserves existing behavior (preservation checking).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Write tests that verify the current popup HTML generators produce `marker.click` wrapper divs, and that clicking a mock Leaflet marker does NOT result in a Tinylytics event being captured (because the click never reaches the popup HTML). Run these tests on the UNFIXED code.

**Test Cases**:
1. **Spot popup wrapper test**: Verify `generateSpotPopupContent` currently wraps content in a `<div data-tinylytics-event="marker.click">` (will confirm the inert wrapper exists on unfixed code)
2. **Obstacle popup wrapper test**: Verify `generateObstaclePopupContent` currently wraps content in a `<div data-tinylytics-event="marker.click">` (will confirm the inert wrapper exists on unfixed code)
3. **Event notice popup wrapper test**: Verify `generateEventNoticePopupContent` currently wraps content in a `<div data-tinylytics-event="marker.click">` (will confirm the inert wrapper exists on unfixed code)
4. **No beacon module exists**: Verify `PaddelbuchTinylyticsBeacon` is undefined on unfixed code (will confirm no beacon dispatch mechanism exists)

**Expected Counterexamples**:
- All popup generators produce HTML with `marker.click` wrapper divs that are never reached by user clicks on markers
- No beacon dispatch mechanism exists to bridge the gap between Leaflet clicks and Tinylytics event capture

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := PaddelbuchTinylyticsBeacon.dispatch('marker.click', input.slug)
  ASSERT beaconElementCreatedWithCorrectAttributes(result)
  ASSERT syntheticClickDispatched(result)
  ASSERT beaconElementRemovedAfterDispatch(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT popupHtml_fixed(input) preserves popup.navigate attributes
  ASSERT popupHtml_fixed(input) preserves popup.details attributes
  ASSERT popupHtml_fixed(input) preserves popup structural content
END FOR
```

**Testing Approach**: Property-based testing is recommended for both fix checking and preservation checking because:
- It generates many random slugs, entity names, and configurations automatically
- It catches edge cases (empty slugs, special characters, missing fields) that manual tests might miss
- It provides strong guarantees across the input domain

**Test Plan**: Write property-based tests for the beacon dispatch function (fix checking) and for the modified popup generators (preservation checking).

**Test Cases**:
1. **Beacon dispatch correctness**: For any event name and value, verify the beacon element is created with correct attributes, a click is dispatched, and the element is removed
2. **Popup navigate preservation**: For any spot with location, verify popup HTML still contains `popup.navigate` with correct slug
3. **Popup details preservation**: For any entity with slug, verify popup HTML still contains `popup.details` with correct slug
4. **Popup structure preservation**: For any entity, verify popup HTML still contains title and button structure

### Unit Tests

- Test `PaddelbuchTinylyticsBeacon.dispatch()` creates element with correct attributes
- Test beacon element has `tinylytics-beacon` CSS class and no `style` attribute
- Test beacon element is removed from DOM after dispatch
- Test `dispatch()` with empty/null event name is a no-op
- Test `dispatch()` with empty event value still creates element with empty value attribute
- Test that modified popup generators no longer contain `marker.click` attributes
- Test that fallback popup HTML in `layer-control.js` no longer contains `marker.click` wrapper

### Property-Based Tests

- Generate random event names and values to verify beacon dispatch correctness (Property 1)
- Generate random entity objects to verify popup HTML no longer contains `marker.click` (Property 3)
- Generate random spot/obstacle/notice objects to verify `popup.navigate` and `popup.details` preservation (Property 4)
- Generate random entities to verify popup structural content preservation (Property 5)

### Integration Tests

- Test that `addSpotMarker` in `layer-control.js` calls beacon dispatch when marker click handler fires
- Test that `addObstacleLayer` calls beacon dispatch when GeoJSON layer click handler fires
- Test that `addProtectedAreaLayer` calls beacon dispatch when GeoJSON layer click handler fires
- Test that `addEventNoticeMarker` calls beacon dispatch when marker click handler fires
- Test full flow: marker click → beacon dispatch → Tinylytics captures event (with mock Tinylytics listener)
