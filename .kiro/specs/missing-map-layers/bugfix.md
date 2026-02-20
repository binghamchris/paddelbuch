# Bugfix Requirements Document

## Introduction

All map layers (spots, obstacles, protected areas, event notices) are missing from the map on every page of the Paddelbuch Swiss Paddle Map website. The map initializes correctly (tile layer, zoom controls, locate control all work), and the layer control panel appears with the correct layer names, but every layer group is empty — no markers or GeoJSON features are rendered.

The root cause is that the data loading pipeline is disconnected from the map pages. The tile data is generated correctly at build time by `tile_generator.rb` (JSON files exist under `/api/tiles/`), and `layer-control.html` creates empty Leaflet layer groups with functions to populate them (`addSpotMarker`, `addObstacleLayer`, `addProtectedAreaLayer`, `addEventNoticeMarker`). However, the JavaScript modules responsible for fetching tile data and feeding it to these functions are never included or invoked:

- `assets/js/spatial-utils.js` — not included as a `<script>` tag on any page
- `assets/js/data-loader.js` — not included as a `<script>` tag on any page
- `assets/js/zoom-layer-manager.js` — not included as a `<script>` tag on any page
- `assets/js/marker-styles.js` — not included on the main map page (only on spot detail pages)
- `assets/js/layer-styles.js` — not included on the main map page (only on detail pages)

No initialization code exists that: (a) fetches tile data from the `/api/tiles/` endpoints on page load, (b) calls the `paddelbuchAddSpotMarker` / `paddelbuchAddObstacleLayer` / `paddelbuchAddProtectedAreaLayer` / `paddelbuchAddEventNoticeMarker` functions with the fetched data, or (c) initializes the `ZoomLayerManager` to handle zoom-based loading of obstacles and protected areas.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the main map page (index.html) loads THEN the system displays an empty map with no spot markers, obstacle layers, protected area layers, or event notice markers despite the layer control panel being visible with all layer names

1.2 WHEN any page with a map (including waterway detail pages) loads THEN the system does not include the `spatial-utils.js`, `data-loader.js`, or `zoom-layer-manager.js` scripts as `<script>` tags, so no tile data fetching occurs

1.3 WHEN the main map page loads THEN the system does not include `marker-styles.js` or `layer-styles.js`, so even if data were loaded, markers would use default Leaflet icons instead of custom styled icons

1.4 WHEN the map is panned or zoomed THEN the system does not fetch tile data for the new viewport because no initialization code binds the data loader to map move/zoom events

1.5 WHEN the user zooms to level 12 or above THEN the system does not load obstacles or protected areas because the `ZoomLayerManager` is never initialized to listen for zoom events

### Expected Behavior (Correct)

2.1 WHEN the main map page loads THEN the system SHALL include all required JavaScript modules (`spatial-utils.js`, `data-loader.js`, `zoom-layer-manager.js`, `marker-styles.js`, `layer-styles.js`) as `<script>` tags before the initialization code runs

2.2 WHEN the map is initialized and layer controls are ready THEN the system SHALL fetch tile data for the initial viewport from `/api/tiles/` endpoints and populate the layer groups by calling `paddelbuchAddSpotMarker` for each spot and `paddelbuchAddEventNoticeMarker` for each notice

2.3 WHEN the map is panned or zoomed THEN the system SHALL fetch tile data for the new viewport bounds (debounced) and add any new data items to the appropriate layer groups

2.4 WHEN the user zooms to level 12 or above THEN the system SHALL load and display obstacles and protected areas for the current viewport by initializing the `ZoomLayerManager` with the map and layer groups

2.5 WHEN spot markers are rendered on the main map THEN the system SHALL use the custom marker icons from `marker-styles.js` (styled by spot type) rather than default Leaflet icons

2.6 WHEN obstacle and protected area layers are rendered THEN the system SHALL use the custom GeoJSON styles from `layer-styles.js` (red for obstacles, yellow/dashed for protected areas)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the map page loads THEN the system SHALL CONTINUE TO initialize the Leaflet map with the correct Switzerland center coordinates, bounds, and zoom level

3.2 WHEN the map page loads THEN the system SHALL CONTINUE TO display the layer control panel with all layer names (spots by type, event notices, obstacles, protected areas)

3.3 WHEN the user toggles a layer in the layer control panel THEN the system SHALL CONTINUE TO show/hide that layer group on the map

3.4 WHEN a spot detail page loads THEN the system SHALL CONTINUE TO display the individual spot marker on its detail map using the existing inline script approach

3.5 WHEN a waterway detail page loads THEN the system SHALL CONTINUE TO display the waterway GeoJSON geometry on its detail map using the existing inline script approach

3.6 WHEN the noEntry (rejected spots) layer is present THEN the system SHALL CONTINUE TO keep it unchecked/hidden by default in the layer control

3.7 WHEN the tile generator plugin runs during Jekyll build THEN the system SHALL CONTINUE TO generate tile JSON files under `/api/tiles/` with the same structure and content
