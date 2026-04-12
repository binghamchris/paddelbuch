# Tasks

## Task 1: Exploratory — Confirm bug condition on unfixed code

- [x] 1.1 Write exploratory test confirming popup generators currently produce `marker.click` wrapper divs
  - Create `_tests/unit/marker-click-event-fix-exploratory.test.js`
  - Test that `generateSpotPopupContent` output contains `data-tinylytics-event="marker.click"` on wrapper div
  - Test that `generateRejectedSpotPopupContent` output contains `data-tinylytics-event="marker.click"` on wrapper div
  - Test that `generateObstaclePopupContent` output contains `data-tinylytics-event="marker.click"` on wrapper div
  - Test that `generateEventNoticePopupContent` output contains `data-tinylytics-event="marker.click"` on wrapper div
  - Test that `PaddelbuchTinylyticsBeacon` is undefined (no beacon module exists yet)
- [x] 1.2 Run exploratory tests on unfixed code and verify they pass (confirming the inert wrapper exists)

## Task 2: Create `tinylytics-beacon.js` module

- [x] 2.1 Create `assets/js/tinylytics-beacon.js` with IIFE-to-global pattern
  - Expose `PaddelbuchTinylyticsBeacon.dispatch(eventName, eventValue)` globally
  - `dispatch()` creates a `<div>` with class `tinylytics-beacon`
  - Sets `data-tinylytics-event` to `eventName` and `data-tinylytics-event-value` to `eventValue`
  - Appends to `document.body`, dispatches `new MouseEvent('click', { bubbles: true })`, then removes element
  - Guard: if `eventName` is falsy, return early without creating an element
  - No inline styles — uses CSS class only (CSP compliance)

## Task 3: Add `.tinylytics-beacon` CSS class

- [x] 3.1 Add `.tinylytics-beacon` rule to `_sass/util/_helpers.scss`
  - Use the same visually-hidden pattern: `position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); padding: 0; border: 0; margin: -1px;`
  - This hides the beacon element without inline styles, complying with `style-src 'self'` CSP

## Task 4: Add script tag for `tinylytics-beacon.js`

- [x] 4.1 Add `<script src="/assets/js/tinylytics-beacon.js" defer></script>` to `_layouts/default.html`
  - Must be loaded BEFORE `layer-control.js` in the script order so `PaddelbuchTinylyticsBeacon` is available when layer-control initialises

## Task 5: Remove `marker.click` wrapper div from popup generators

- [x] 5.1 Update `assets/js/spot-popup.js`
  - In `generateSpotPopupContent`: change outer wrapper from `<div data-tinylytics-event="marker.click" data-tinylytics-event-value="...">` to plain `<div>`
  - In `generateRejectedSpotPopupContent`: same change — remove `marker.click` attributes from outer wrapper div
  - Keep all `popup.navigate` and `popup.details` attributes unchanged
- [x] 5.2 Update `assets/js/obstacle-popup.js`
  - In `generateObstaclePopupContent`: change outer wrapper from `<div data-tinylytics-event="marker.click" data-tinylytics-event-value="...">` to plain `<div>`
  - Keep `popup.details` attributes unchanged
- [x] 5.3 Update `assets/js/event-notice-popup.js`
  - In `generateEventNoticePopupContent`: change outer wrapper from `<div data-tinylytics-event="marker.click" data-tinylytics-event-value="...">` to plain `<div>`
  - Keep `popup.details` attributes unchanged

## Task 6: Modify `layer-control.js` — add beacon dispatch and clean up fallbacks

- [x] 6.1 Add beacon dispatch calls in marker/layer click handlers
  - In `addSpotMarker`: add `PaddelbuchTinylyticsBeacon.dispatch('marker.click', spot.slug || '')` inside the existing `bindMarkerRecenter` click handler or a new click handler on the marker
  - In `addObstacleLayer`: add a click handler on `obstacleLayer` that calls `PaddelbuchTinylyticsBeacon.dispatch('marker.click', obstacle.slug || '')`. Also add to portage route layer if present.
  - In `addProtectedAreaLayer`: add a click handler on `protectedAreaLayer` that calls `PaddelbuchTinylyticsBeacon.dispatch('marker.click', protectedArea.slug || protectedArea.name || '')`
  - In `addEventNoticeMarker`: add `PaddelbuchTinylyticsBeacon.dispatch('marker.click', notice.slug || '')` inside the existing `bindMarkerRecenter` click handler or a new click handler. Also add to `areaLayer` if present.
  - Guard: check `PaddelbuchTinylyticsBeacon` exists before calling dispatch (defensive)
- [-] 6.2 Remove `marker.click` wrapper from fallback popup HTML strings
  - In `addSpotMarker` fallback: change `<div data-tinylytics-event="marker.click" ...>` to plain `<div>`
  - In `addObstacleLayer` fallback: change `<div data-tinylytics-event="marker.click" ...>` to plain `<div>`
  - In `addProtectedAreaLayer`: change `<div class="protected-area-popup" data-tinylytics-event="marker.click" ...>` to `<div class="protected-area-popup">`
  - In `addEventNoticeMarker` fallback: change `<div data-tinylytics-event="marker.click" ...>` to plain `<div>`

## Task 7: Update existing tests that check for `marker.click` on popup HTML

- [~] 7.1 Update `_tests/property/tinylytics-event-tracking.property.test.js`
  - Properties 1–4 currently assert `marker.click` exists on popup wrapper divs
  - Update these properties to assert `marker.click` does NOT exist on popup HTML (Property 3 from bugfix design)
  - Keep assertions for `popup.navigate` and `popup.details` unchanged (Property 4 from bugfix design)
- [~] 7.2 Update `_tests/unit/tinylytics-event-tracking.test.js`
  - Task 10.4 tests currently assert `marker.click` on fallback popup HTML — update to assert it is NOT present
  - Task 10.5 edge case tests currently assert `marker.click` on popup wrapper — update to assert it is NOT present
  - Keep assertions for `popup.navigate` and `popup.details` unchanged

## Task 8: Write fix checking tests (PBT)

- [~] 8.1 Write property-based test for beacon dispatch correctness (Property 1)
  - [PBT: Property 1] Create `_tests/property/tinylytics-beacon.property.test.js` with `@jest-environment jsdom`
  - Use fast-check to generate random event name strings and event value strings
  - Assert: beacon element is created with correct `data-tinylytics-event` and `data-tinylytics-event-value`
  - Assert: a `click` MouseEvent is dispatched on the element (use addEventListener on document to capture)
  - Assert: the click event bubbles (so Tinylytics' document-level delegation captures it)
  - Assert: beacon element is removed from DOM after dispatch
  - Assert: with falsy eventName, no element is created
  - Minimum 100 iterations
- [~] 8.2 Write property-based test for beacon CSS class compliance (Property 2)
  - [PBT: Property 2] In the same test file, verify beacon element has class `tinylytics-beacon` and no `style` attribute
  - Minimum 100 iterations

## Task 9: Write preservation checking tests (PBT)

- [~] 9.1 Write property-based test for popup HTML no longer containing `marker.click` (Property 3)
  - [PBT: Property 3] In `_tests/property/tinylytics-beacon.property.test.js` or a new file
  - Generate random entity objects (spot, rejected spot, obstacle, event notice)
  - Assert: popup HTML from each generator does NOT contain `data-tinylytics-event="marker.click"`
  - Minimum 100 iterations
- [~] 9.2 Write property-based test for `popup.navigate` and `popup.details` preservation (Property 4)
  - [PBT: Property 4] Generate random spot objects with slug and location
  - Assert: popup HTML still contains `data-tinylytics-event="popup.navigate"` with correct slug
  - Assert: popup HTML still contains `data-tinylytics-event="popup.details"` with correct slug
  - For obstacle and event notice: assert `popup.details` still present
  - Minimum 100 iterations
- [~] 9.3 Write property-based test for popup structural content preservation (Property 5)
  - [PBT: Property 5] Generate random entity objects
  - Assert: popup HTML still contains `popup-title` class and `<h1>` title element
  - Assert: popup HTML still contains more-details button structure when slug is present
  - Minimum 100 iterations

## Task 10: Write unit tests for beacon module and layer-control integration

- [~] 10.1 Write unit tests for `PaddelbuchTinylyticsBeacon` module
  - Create `_tests/unit/tinylytics-beacon.test.js` with `@jest-environment jsdom`
  - Test: `dispatch('marker.click', 'test-slug')` creates and removes beacon element
  - Test: beacon element has class `tinylytics-beacon` and no `style` attribute
  - Test: dispatched click event has `bubbles: true`
  - Test: `dispatch(null, 'value')` is a no-op (no element created)
  - Test: `dispatch('', 'value')` is a no-op (no element created)
  - Test: `dispatch('marker.click', '')` creates element with empty value attribute
  - Test: `dispatch('marker.click', null)` creates element with appropriate value handling
- [~] 10.2 Write integration tests for layer-control.js beacon dispatch calls
  - In `_tests/unit/tinylytics-beacon.test.js` or a separate file
  - Mock `PaddelbuchTinylyticsBeacon.dispatch` and verify it is called with correct arguments when marker click handlers fire
  - Test spot marker click → `dispatch('marker.click', spotSlug)` called
  - Test obstacle layer click → `dispatch('marker.click', obstacleSlug)` called
  - Test protected area layer click → `dispatch('marker.click', protectedAreaSlugOrName)` called
  - Test event notice marker click → `dispatch('marker.click', noticeSlug)` called

## Task 11: Run full test suite

- [~] 11.1 Run `npm test` (JS unit tests) and verify all tests pass
- [~] 11.2 Run `npm run test:property` (JS property tests) and verify all tests pass
- [~] 11.3 Fix any test failures introduced by the changes
