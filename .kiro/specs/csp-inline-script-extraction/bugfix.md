# Bugfix Requirements Document

## Introduction

The site is deployed to AWS Amplify with a Content-Security-Policy header set to `script-src 'self'` (no `'unsafe-inline'`). A previous spec (`codebase-quality-improvements`) extracted inline scripts from the 4 detail page layouts into external JS files but left 5 other inline `<script>` blocks untouched across shared includes. These remaining inline scripts are blocked by the CSP, causing the home page map to not display at all, all data layers and filter UI to be missing on every page, and `window.PaddelbuchColors` to be undefined globally.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the home page is loaded THEN the system does not display the map because the inline map initialization script in `_includes/map-init.html` (first `<script>` block) is blocked by the CSP `script-src 'self'` directive

1.2 WHEN any page is loaded THEN the system fails to set `window.PaddelbuchColors` because the inline script in `_includes/color-vars.html` is blocked by the CSP `script-src 'self'` directive

1.3 WHEN the home page is loaded THEN the system does not display data layers (spots, obstacles, protected areas, event notices) because the inline layer-control script in `_includes/layer-control.html` is blocked by the CSP

1.4 WHEN a detail page (spot, waterway, obstacle, notice) is loaded THEN the system does not display data layers or the filter UI because the inline layer-control script in `_includes/layer-control.html` is blocked by the CSP

1.5 WHEN any page with a map is loaded THEN the system does not render the filter panel UI because the inline `PaddelbuchFilterPanel` script in `_includes/filter-panel.html` is blocked by the CSP

1.6 WHEN the home page is loaded THEN the system does not initialize the data loading pipeline (dimension configs, filter engine, tile loading, moveend handler) because the inline data initialization script in `_includes/map-init.html` (second `<script>` block) is blocked by the CSP

1.7 WHEN a detail page is loaded THEN the system does not initialize the data loading pipeline because the inline data initialization script in `_includes/detail-map-layers.html` is blocked by the CSP

### Expected Behavior (Correct)

2.1 WHEN the home page is loaded THEN the system SHALL display the Leaflet map by loading map initialization logic from an external JavaScript file (`assets/js/paddelbuch-map.js`) that reads configuration from a CSP-safe `<script type="application/json" id="map-config">` element

2.2 WHEN any page is loaded THEN the system SHALL set `window.PaddelbuchColors` by loading color configuration from an external JavaScript file (`assets/js/color-vars.js`) that reads from a CSP-safe `<script type="application/json" id="paddelbuch-colors">` element

2.3 WHEN the home page or a detail page is loaded THEN the system SHALL create layer groups and marker/layer creation functions by loading layer-control logic from an external JavaScript file (`assets/js/layer-control.js`) that reads locale and protected-area-type data from a CSP-safe `<script type="application/json" id="layer-control-config">` element

2.4 WHEN any page with a map is loaded THEN the system SHALL render the filter panel UI by loading the `PaddelbuchFilterPanel` control from an external JavaScript file (`assets/js/filter-panel.js`)

2.5 WHEN the home page is loaded THEN the system SHALL initialize the data loading pipeline (dimension configs, filter engine/panel, tile loading, moveend handler) by loading data initialization logic from an external JavaScript file (`assets/js/map-data-init.js`) that reads locale-dependent labels and options from a CSP-safe `<script type="application/json" id="map-data-config">` element

2.6 WHEN a detail page is loaded THEN the system SHALL initialize the data loading pipeline by loading data initialization logic from the same external JavaScript file (`assets/js/map-data-init.js`) that reads from a CSP-safe `<script type="application/json" id="map-data-config">` element

2.7 WHEN any extracted external JavaScript file is loaded THEN the system SHALL produce no CSP violations in the browser console

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a detail page (spot, waterway, obstacle, notice) is loaded THEN the system SHALL CONTINUE TO initialize the detail-specific map via the existing external scripts (`paddelbuch-map.js`, `spot-map.js`, `waterway-map.js`, `obstacle-map.js`, `notice-map.js`) reading from `<script type="application/json" id="map-config">`

3.2 WHEN the home page map is panned or zoomed THEN the system SHALL CONTINUE TO load tile data for the new viewport and populate layer groups with spots, obstacles, protected areas, and event notices

3.3 WHEN a user interacts with the filter panel THEN the system SHALL CONTINUE TO filter spot markers by spot type and paddle craft type dimensions, and toggle non-spot layer groups on/off

3.4 WHEN a spot, obstacle, protected area, or event notice marker/layer is clicked THEN the system SHALL CONTINUE TO display the correct popup content with locale-appropriate text

3.5 WHEN the site is loaded in a non-default locale (English) THEN the system SHALL CONTINUE TO display all labels, dimension options, and layer toggle names in the correct locale

3.6 WHEN the CSP header is evaluated by the browser THEN the system SHALL CONTINUE TO enforce `script-src 'self'` without requiring `'unsafe-inline'`

3.7 WHEN any page is loaded THEN the system SHALL CONTINUE TO apply `PaddelbuchColors` for color-dependent UI elements (marker styles, layer styles)
