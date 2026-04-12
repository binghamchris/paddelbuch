# Implementation Plan: Tinylytics Event Tracking

## Overview

Add declarative event tracking to the Paddel Buch site by annotating interactive HTML elements with `data-tinylytics-event` and `data-tinylytics-event-value` attributes. The Tinylytics script auto-captures clicks on annotated elements. No new modules, dependencies, or CSP changes are needed. Changes span Jekyll Liquid templates, JS popup generators, and JS control modules.

## Tasks

- [x] 1. Enable event collection on the Tinylytics script
  - In `_layouts/default.html`, append `?events&beacon` to the Tinylytics `<script>` `src` URL
  - Preserve the existing `defer` attribute
  - The updated URL should be: `https://tinylytics.app/embed/DWSnjEu6fgk9s2Yu2H4a/min.js?events&beacon`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Annotate Jekyll popup includes with event tracking attributes
  - [x] 2.1 Annotate `_includes/spot-popup.html`
    - Add `data-tinylytics-event="popup.navigate"` and `data-tinylytics-event-value="{{ spot.slug }}"` to the navigate `<button>` element
    - Add `data-tinylytics-event="popup.details"` and `data-tinylytics-event-value="{{ spot.slug }}"` to the more-details `<button>` element
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 2.2 Annotate `_includes/rejected-popup.html`
    - Add `data-tinylytics-event="popup.details"` and `data-tinylytics-event-value="{{ spot.slug }}"` to the more-details `<button>` element
    - _Requirements: 2.2, 4.2_

  - [x] 2.3 Annotate `_includes/obstacle-popup.html`
    - Add `data-tinylytics-event="popup.details"` and `data-tinylytics-event-value="{{ obstacle.slug }}"` to the more-details `<button>` element
    - _Requirements: 2.3, 4.3_

  - [x] 2.4 Annotate `_includes/event-popup.html`
    - Add `data-tinylytics-event="popup.details"` and `data-tinylytics-event-value="{{ notice.slug }}"` to the more-details `<button>` element
    - _Requirements: 2.4, 4.4_

- [x] 3. Annotate Jekyll detail-page and navigation includes
  - [x] 3.1 Annotate `_includes/navigate-btn.html`
    - Add `data-tinylytics-event="navigate.click"` and `data-tinylytics-event-value="{{ include.spot_slug }}"` to the `<a>` element
    - The spot slug must be passed as an include parameter; check existing callers and add the parameter where needed
    - _Requirements: 10.1_

  - [x] 3.2 Annotate `_includes/spot-detail-content.html`
    - Add `data-tinylytics-event="clipboard.copy-gps"` and `data-tinylytics-event-value="{{ spot.slug }}"` to the GPS copy `<button>`
    - Add `data-tinylytics-event="clipboard.copy-address"` and `data-tinylytics-event-value="{{ spot.slug }}"` to the address copy `<button>`
    - _Requirements: 9.1, 9.2_

  - [x] 3.3 Annotate `_includes/header.html`
    - Add `data-tinylytics-event="language.switch"` and `data-tinylytics-event-value="{{ lang }}"` to each non-active language switcher `<a>` link
    - Do NOT add event attributes to the active (current locale) link
    - _Requirements: 11.1_

- [x] 4. Checkpoint — Verify Jekyll template changes
  - Ensure all modified Jekyll includes have correct attribute placement and Liquid variable references
  - Confirm no inline scripts or inline style attributes were introduced
  - Ask the user if questions arise

- [x] 5. Annotate JS popup generator modules with event tracking attributes
  - [x] 5.1 Annotate `assets/js/spot-popup.js`
    - In `generateSpotPopupContent`: wrap all output in an outer `<div>` with `data-tinylytics-event="marker.click"` and `data-tinylytics-event-value` set to the spot slug
    - Add `data-tinylytics-event="popup.navigate"` and value to the navigate `<button>` HTML string
    - Add `data-tinylytics-event="popup.details"` and value to the more-details `<button>` HTML string
    - In `generateRejectedSpotPopupContent`: wrap output in an outer `<div>` with `data-tinylytics-event="marker.click"` and value set to the spot slug
    - Add `data-tinylytics-event="popup.details"` and value to the rejected spot more-details `<button>` HTML string
    - Use `PaddelbuchHtmlUtils.escapeHtml` on slug values inserted into attributes
    - _Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 12.3_

  - [x] 5.2 Annotate `assets/js/obstacle-popup.js`
    - In `generateObstaclePopupContent`: wrap output in an outer `<div>` with `data-tinylytics-event="marker.click"` and value set to the obstacle slug
    - Add `data-tinylytics-event="popup.details"` and value to the more-details `<button>` HTML string
    - _Requirements: 2.3, 4.3, 12.3_

  - [x] 5.3 Annotate `assets/js/event-notice-popup.js`
    - In `generateEventNoticePopupContent`: wrap output in an outer `<div>` with `data-tinylytics-event="marker.click"` and value set to the notice slug
    - Add `data-tinylytics-event="popup.details"` and value to the more-details `<button>` HTML string
    - _Requirements: 2.4, 4.4, 12.3_

- [x] 6. Annotate JS fallback popups in `assets/js/layer-control.js`
  - In `addSpotMarker` fallback HTML: wrap in a `<div>` with `data-tinylytics-event="marker.click"` and value, add `popup.navigate` to the navigate link, add `popup.details` to the more-details link
  - In `addObstacleLayer` fallback HTML: wrap in a `<div>` with `data-tinylytics-event="marker.click"` and value, add `popup.details` to the more-details button
  - In `addEventNoticeMarker` fallback HTML: wrap in a `<div>` with `data-tinylytics-event="marker.click"` and value, add `popup.details` to the more-details button
  - In `addProtectedAreaLayer` popup HTML: add `data-tinylytics-event="marker.click"` and value (slug or name) to the outer `<div class="protected-area-popup">`
  - _Requirements: 2.5, 2.6, 3.2, 4.5_

- [x] 7. Annotate JS control modules with event tracking attributes
  - [x] 7.1 Annotate `assets/js/filter-panel.js`
    - Add `setAttribute('data-tinylytics-event', 'filter.toggle')` to the toggle button after creation
    - Add `setAttribute('data-tinylytics-event', 'filter.change')` and `setAttribute('data-tinylytics-event-value', dim.key + ':' + opt.slug)` to each spot-type/craft-type checkbox after creation
    - Add `setAttribute('data-tinylytics-event', 'layer.toggle')` and `setAttribute('data-tinylytics-event-value', toggle.key)` to each layer toggle checkbox after creation
    - _Requirements: 5.1, 6.1, 7.1_

  - [x] 7.2 Annotate `assets/js/dashboard-switcher.js`
    - In `buildTabs`: add `setAttribute('data-tinylytics-event', 'dashboard.switch')` and `setAttribute('data-tinylytics-event-value', dashboard.id)` to each tab button after creation
    - _Requirements: 8.1_

- [x] 8. Checkpoint — Verify all JS module changes
  - Ensure all JS changes use `setAttribute` or string concatenation (no inline scripts)
  - Confirm no CSP violations: no `eval()`, no inline `<script>`, no `style=""` attributes
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Write property-based tests for event tracking correctness
  - [x] 9.1 Write property test for spot popup event tracking completeness
    - **Property 1: Spot popup event tracking completeness**
    - Use fast-check to generate random spot objects with slug, location, and name
    - Verify `generateSpotPopupContent` output contains `marker.click`, `popup.navigate`, and `popup.details` with correct values
    - Provide a mock `PaddelbuchHtmlUtils` global
    - **Validates: Requirements 2.1, 3.1, 4.1**

  - [x] 9.2 Write property test for rejected spot popup event tracking completeness
    - **Property 2: Rejected spot popup event tracking completeness**
    - Use fast-check to generate random rejected spot objects with slug and name
    - Verify `generateRejectedSpotPopupContent` output contains `marker.click` and `popup.details` with correct values
    - **Validates: Requirements 2.2, 4.2**

  - [x] 9.3 Write property test for obstacle popup event tracking completeness
    - **Property 3: Obstacle popup event tracking completeness**
    - Use fast-check to generate random obstacle objects with slug and name
    - Verify `generateObstaclePopupContent` output contains `marker.click` and `popup.details` with correct values
    - **Validates: Requirements 2.3, 4.3**

  - [x] 9.4 Write property test for event notice popup event tracking completeness
    - **Property 4: Event notice popup event tracking completeness**
    - Use fast-check to generate random event notice objects with slug and name
    - Verify `generateEventNoticePopupContent` output contains `marker.click` and `popup.details` with correct values
    - **Validates: Requirements 2.4, 4.4**

  - [x] 9.5 Write property test for filter panel checkbox event tracking
    - **Property 5: Filter panel checkbox event tracking**
    - Use fast-check to generate random dimension configs and layer toggles
    - Provide jsdom environment and Leaflet stubs
    - Verify every created checkbox has correct `data-tinylytics-event` and `data-tinylytics-event-value` attributes
    - **Validates: Requirements 6.1, 7.1**

  - [x] 9.6 Write property test for dashboard switcher button event tracking
    - **Property 6: Dashboard switcher button event tracking**
    - Use fast-check to generate random dashboard registrations
    - Provide jsdom environment
    - Verify every tab button has `data-tinylytics-event="dashboard.switch"` and correct value
    - **Validates: Requirements 8.1**

- [x] 10. Write unit and smoke tests
  - [x] 10.1 Write smoke test for Tinylytics script URL
    - Read `_layouts/default.html` and verify the script `src` contains `?events&beacon` and `defer`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 10.2 Write smoke test for CSP unchanged
    - Verify `deploy/frontend-deploy.yaml` has not been modified (compare hash or content)
    - _Requirements: 12.4_

  - [x] 10.3 Write unit tests for filter panel toggle button
    - Verify the toggle button has `data-tinylytics-event="filter.toggle"`
    - _Requirements: 5.1_

  - [x] 10.4 Write unit tests for fallback popup HTML in layer-control.js
    - Verify each fallback popup HTML string contains the correct event attributes
    - _Requirements: 2.6, 3.2, 4.5_

  - [x] 10.5 Write unit tests for edge cases
    - Spot with no slug (no more-details button, no value attribute)
    - Spot with no location (no navigate button)
    - Empty slug string
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The implementation language is vanilla JavaScript (IIFE-to-global pattern, no build toolchain) matching the existing codebase
- All changes must comply with the strict CSP: no inline scripts, no inline styles
