# Implementation Plan: Multi-Dimension Spot Filter

## Overview

Replace the existing Leaflet `L.control.layers` with a custom Filter_Panel that supports multi-dimensional AND-based spot filtering. Implementation proceeds bottom-up: Marker_Registry first, then Filter_Engine, then Filter_Panel UI, then integration into the existing data pipeline. Non-spot layers (rejected spots, event notices, obstacles, protected areas) remain as independent LayerGroup toggles.

## Tasks

- [x] 1. Implement Marker Registry module
  - [x] 1.1 Create `assets/js/marker-registry.js` with `register`, `has`, `forEach`, and `size` methods
    - Expose as `window.PaddelbuchMarkerRegistry`
    - Use an internal object keyed by slug for O(1) lookup
    - `register(slug, marker, metadata)` stores marker + metadata; no-op if slug already exists
    - `has(slug)` returns boolean
    - `forEach(callback)` iterates all entries calling `callback(slug, marker, metadata)`
    - `size()` returns count of registered entries
    - Store `spotType_slug`, `paddleCraftTypes`, and `paddlingEnvironmentType_slug` in metadata
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.2 Write property test for Marker Registry round-trip
    - **Property 4: Marker registry round-trip**
    - Generate random slug, mock marker, and metadata; register then forEach and verify entry exists with correct values
    - Create `_tests/property/marker-registry-round-trip.property.test.js`
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [x] 1.3 Write property test for Marker Registry deduplication
    - **Property 5: Marker registry deduplication**
    - Generate sequences of register calls with intentional slug duplicates; assert `size()` equals unique slug count and `forEach` visits each unique slug exactly once
    - Create `_tests/property/marker-registry-deduplication.property.test.js`
    - **Validates: Requirements 4.3, 9.3**

- [ ] 2. Implement Filter Engine module
  - [x] 2.1 Create `assets/js/filter-engine.js` with `init`, `getFilterState`, `setOption`, `applyFilters`, and `evaluateMarker` methods
    - Expose as `window.PaddelbuchFilterEngine`
    - `init(dimensionConfigs, map)` stores config and map reference, initializes filter state with all options selected per dimension
    - `getFilterState()` returns object of `{ dimensionKey: Set of selected slugs }`
    - `setOption(dimensionKey, optionSlug, selected)` adds/removes slug from dimension's selected set
    - `evaluateMarker(metadata)` applies AND-logic: returns true if marker passes every active dimension (dimensions with empty selected set are inactive/skipped)
    - `applyFilters()` iterates all markers in `PaddelbuchMarkerRegistry`, calls `evaluateMarker` per entry, calls `marker.addTo(map)` or `marker.remove()` accordingly
    - Wrap each dimension's `matchFn` call in try/catch; on error treat dimension as not matched and log warning
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 2.5, 3.4, 3.5, 8.1, 8.2_

  - [x] 2.2 Write property test for AND-logic evaluation
    - **Property 1: AND-logic evaluation across active dimensions**
    - Generate random metadata and random filter states with 1–5 dimensions; assert `evaluateMarker` result matches manual AND-logic check
    - Create `_tests/property/filter-engine-and-logic.property.test.js`
    - **Validates: Requirements 1.2, 1.5**

  - [x] 2.3 Write property test for spot type match function
    - **Property 2: Spot type match function**
    - Generate random `spotType_slug` and random set of selected slugs; assert match function returns `selectedSet.has(slug)`
    - Create `_tests/property/filter-engine-spot-type-match.property.test.js`
    - **Validates: Requirements 2.5**

  - [x] 2.4 Write property test for paddle craft type match function
    - **Property 3: Paddle craft type match function — set intersection**
    - Generate random `paddleCraftTypes` array and random selected set; assert match returns true iff intersection is non-empty
    - Create `_tests/property/filter-engine-craft-type-match.property.test.js`
    - **Validates: Requirements 3.5**

  - [x] 2.5 Write property test for non-spot layer isolation
    - **Property 7: Filter engine does not alter non-spot layers**
    - Set up mock map with non-spot LayerGroups, call `applyFilters()` with various filter states, assert non-spot LayerGroup add/remove was never called
    - Create `_tests/property/filter-engine-non-spot-isolation.property.test.js`
    - **Validates: Requirements 7.4**

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Filter Panel UI
  - [~] 4.1 Create `_includes/filter-panel.html` as a Leaflet custom control (`L.Control.extend`) positioned at `topleft`
    - Expose init as `window.PaddelbuchFilterPanel.init(map, dimensionConfigs, layerToggles)`
    - Render a collapsible container with a toggle button
    - Spot filter section: dynamically render one `<fieldset>` per dimension from `dimensionConfigs`, each with a `<legend>` and checkboxes generated from the dimension's options array
    - Layer toggle section: render independent checkboxes for each entry in `layerToggles` array (rejected spots, event notices, obstacles, protected areas)
    - Use semantic HTML: `<fieldset>`, `<legend>`, `<label>`, `<input type="checkbox">`
    - All spot filter checkboxes checked by default; layer toggles use `defaultChecked` from config
    - On spot filter checkbox change: call `PaddelbuchFilterEngine.setOption()` then `PaddelbuchFilterEngine.applyFilters()`
    - On layer toggle checkbox change: add/remove the corresponding `LayerGroup` to/from the map
    - Collapse panel on `popupopen` map event; restore on `popupclose`
    - Ensure keyboard navigability (native checkbox behavior)
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5, 8.3_

  - [~] 4.2 Write property test for Filter Panel rendering from configuration
    - **Property 8: Filter panel renders checkbox groups from configuration**
    - Generate random dimension config arrays with 1–5 dimensions, each with 1–8 options; init Filter_Panel with a mock map DOM, count rendered fieldsets and checkboxes
    - Create `_tests/property/filter-panel-rendering.property.test.js`
    - **Validates: Requirements 8.3**

- [ ] 5. Integrate with existing data pipeline
  - [~] 5.1 Modify `_includes/layer-control.html` to remove spot-type LayerGroups and Leaflet `L.control.layers`, keep non-spot LayerGroups and marker/layer creation functions
    - Remove `spotTypeToLayerGroup` mapping and spot LayerGroups (`entryExit`, `entryOnly`, `exitOnly`, `rest`, `emergency`)
    - Remove `L.control.layers` creation and the `overlayLayers` object
    - Keep `layerGroups.noEntry`, `layerGroups.eventNotices`, `layerGroups.obstacles`, `layerGroups.protectedAreas` as LayerGroups
    - Keep `addSpotMarker` but modify it to: create marker, register in `PaddelbuchMarkerRegistry` with metadata (`spotType_slug`, `paddleCraftTypes`, `paddlingEnvironmentType_slug`), and call `PaddelbuchFilterEngine.evaluateMarker()` to decide initial visibility (add to map or not) instead of adding to a LayerGroup
    - Skip rejected spots from registry registration; continue adding them to `layerGroups.noEntry` as before
    - Keep `addObstacleLayer`, `addProtectedAreaLayer`, `addEventNoticeMarker` unchanged
    - Keep all global function exports (`window.paddelbuchAddSpotMarker`, etc.)
    - _Requirements: 4.1, 6.1, 9.1, 9.2, 9.3_

  - [~] 5.2 Write property test for rejected spots exclusion
    - **Property 6: Rejected spots excluded from filter evaluation**
    - Generate spots with `rejected: true`; verify they are not registered in Marker_Registry after processing
    - Create `_tests/property/filter-rejected-spots-exclusion.property.test.js`
    - **Validates: Requirements 6.1**

  - [~] 5.3 Modify `_includes/map-init.html` to include new module scripts and initialize the filter system
    - Add `<script>` tags for `marker-registry.js` and `filter-engine.js` before `layer-control.html` include
    - Replace `{% include layer-control.html %}` with `{% include filter-panel.html %}`
    - In the `initMapData` function, after `layerGroups` is available: build dimension config array from Jekyll data (spot types with localized labels, paddle craft types with localized labels from `paddle_craft_types.yml`), build layer toggles config for non-spot layers, call `PaddelbuchFilterEngine.init(dimensionConfigs, map)`, call `PaddelbuchFilterPanel.init(map, dimensionConfigs, layerToggles)`
    - Preserve existing `PaddelbuchZoomLayerManager` initialization
    - _Requirements: 5.1, 5.2, 7.1, 7.2, 7.5, 8.1, 8.2, 9.1_

- [ ] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Unit tests for integration and edge cases
  - [~] 7.1 Write unit tests for filter system integration
    - Test default filter state: all spot types and craft types selected on load
    - Test toggling a single spot type hides only spots of that type
    - Test toggling a single craft type hides spots that don't support it
    - Test AND-logic: unchecking craft type AND spot type correctly combines filters
    - Test empty dimension: unchecking all options in one dimension makes it inactive
    - Test new spots from tile loading are immediately filtered against current state
    - Test deduplication: registering same slug twice doesn't create duplicate
    - Create `_tests/unit/filter-system.test.js`
    - _Requirements: 1.1, 1.2, 1.5, 2.4, 3.4, 4.3, 9.2_

  - [~] 7.2 Write unit tests for non-spot layer toggles and rejected spots
    - Test rejected spot toggle adds/removes noEntry LayerGroup independently
    - Test non-spot layer toggles each add/remove their LayerGroup
    - Test popup open collapses the filter panel
    - Create `_tests/unit/filter-panel-toggles.test.js`
    - _Requirements: 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 5.8_

- [ ] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check and follow the existing `_tests/property/*.property.test.js` naming convention
- Unit tests follow the existing `_tests/unit/*.test.js` naming convention
- The implementation preserves the existing zoom-layer-manager behavior for obstacles and protected areas
