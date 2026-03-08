# Requirements Document

## Introduction

The Paddelbuch Jekyll site renders 2,820 pages (1,545 DE + 1,273 EN) with a total build time of ~648 seconds. Per-page render time averages ~220ms, dominated by Liquid template processing. The primary bottleneck is inline `<script>` blocks in layout and include files that contain Liquid interpolation tags (e.g., `{{ current_locale }}`, `{{ site.mapbox_url }}`, `{{ site.map.center.lat }}`). Liquid must parse hundreds of lines of JavaScript on every single page render, even though only a handful of values are actually dynamic.

This feature externalizes inline JavaScript from Liquid templates into static external `.js` files. Dynamic values currently injected via Liquid tags are instead passed through HTML `data-` attributes or the existing `window.paddelbuchMapConfig` object. The goal is to dramatically reduce Liquid processing time per page without changing any user-facing behavior.

## Glossary

- **Build_System**: The Jekyll static site generator that processes Liquid templates and produces the final HTML/JS output
- **Liquid_Engine**: The Liquid template processing engine within Jekyll that parses and evaluates Liquid tags (`{{ }}`, `{% %}`) in template files
- **Layout_File**: A Jekyll layout HTML file in `_layouts/` (e.g., `spot.html`, `obstacle.html`, `waterway.html`, `notice.html`) that contains inline `<script>` blocks with Liquid interpolation
- **Include_File**: A Jekyll include HTML file in `_includes/` (e.g., `layer-control.html`, `detail-map-layers.html`, `filter-panel.html`) that contains inline `<script>` blocks with Liquid interpolation
- **External_JS_File**: A static JavaScript file in `assets/js/` that contains no Liquid tags and is loaded via a `<script src="...">` tag
- **Data_Attribute**: An HTML `data-*` attribute on a DOM element used to pass dynamic values from Liquid templates to external JavaScript
- **Map_Config**: The `window.paddelbuchMapConfig` object generated at build time by the `MapConfigGenerator` plugin, containing locale-specific configuration shared across all pages
- **Inline_Script_Block**: A `<script>` tag in a layout or include file whose JavaScript content is processed by the Liquid_Engine on every page render
- **Liquid_Interpolation**: A Liquid output tag (`{{ ... }}`) or logic tag (`{% ... %}`) embedded within an Inline_Script_Block that injects dynamic values into JavaScript

## Requirements

### Requirement 1: Extract Layer Control JavaScript

**User Story:** As a site maintainer, I want the layer control JavaScript extracted from `_includes/layer-control.html` into an External_JS_File, so that the Liquid_Engine does not parse ~435 lines of JavaScript on every page that includes the layer control.

#### Acceptance Criteria

1. THE Build_System SHALL produce an External_JS_File at `assets/js/layer-control.js` containing the layer control initialization logic currently inline in `_includes/layer-control.html`
2. WHEN a page includes the layer control, THE Layout_File SHALL load `layer-control.js` via a `<script src="...">` tag instead of embedding the JavaScript inline
3. THE Include_File for layer control SHALL pass the current locale value to the External_JS_File via a Data_Attribute on the script tag or a container element
4. THE Include_File for layer control SHALL pass the map variable reference to the External_JS_File via a Data_Attribute or the existing global `window.paddelbuchMap` convention
5. THE External_JS_File for layer control SHALL read dynamic values (locale, locale prefix) from Data_Attributes or Map_Config instead of relying on Liquid_Interpolation
6. AFTER extraction, THE Include_File for layer control SHALL contain zero Inline_Script_Blocks with Liquid_Interpolation

### Requirement 2: Extract Detail Map Layers JavaScript

**User Story:** As a site maintainer, I want the detail map layers bootstrap JavaScript extracted from `_includes/detail-map-layers.html` into an External_JS_File, so that the Liquid_Engine does not parse ~184 lines of JavaScript on every detail page.

#### Acceptance Criteria

1. THE Build_System SHALL produce an External_JS_File at `assets/js/detail-map-layers.js` containing the data loading bootstrap logic currently inline in `_includes/detail-map-layers.html`
2. WHEN a detail page includes the detail map layers, THE Include_File SHALL load `detail-map-layers.js` via a `<script src="...">` tag instead of embedding the JavaScript inline
3. THE Include_File for detail map layers SHALL pass the current locale value to the External_JS_File via a Data_Attribute
4. THE External_JS_File for detail map layers SHALL read the locale from Data_Attributes or Map_Config instead of relying on Liquid_Interpolation
5. AFTER extraction, THE Include_File for detail map layers SHALL contain zero Inline_Script_Blocks with Liquid_Interpolation

### Requirement 3: Extract Filter Panel JavaScript

**User Story:** As a site maintainer, I want the filter panel JavaScript extracted from `_includes/filter-panel.html` into an External_JS_File, so that the Liquid_Engine does not parse ~161 lines of JavaScript on every page that includes the filter panel.

#### Acceptance Criteria

1. THE Build_System SHALL produce an External_JS_File at `assets/js/filter-panel.js` containing the filter panel control logic currently inline in `_includes/filter-panel.html`
2. WHEN a page includes the filter panel, THE Include_File SHALL load `filter-panel.js` via a `<script src="...">` tag instead of embedding the JavaScript inline
3. AFTER extraction, THE Include_File for filter panel SHALL contain zero Inline_Script_Blocks with Liquid_Interpolation

### Requirement 4: Extract Unified Detail Map Initialization JavaScript

**User Story:** As a site maintainer, I want the map initialization JavaScript from all four detail layouts (`spot.html`, `obstacle.html`, `waterway.html`, `notice.html`) consolidated into a single External_JS_File, so that the Liquid_Engine does not parse near-identical map boilerplate on every detail page and the shared map setup code (tile layer, attribution, zoom control, locate control) exists in one place.

#### Acceptance Criteria

1. THE Build_System SHALL produce a single External_JS_File at `assets/js/detail-map.js` containing the map initialization logic for all detail page types (spot, obstacle, waterway, notice)
2. WHEN any detail page is rendered, THE Layout_File SHALL load `detail-map.js` via a `<script src="...">` tag instead of embedding the JavaScript inline
3. THE Layout_File SHALL set a `data-page-type` attribute on the map container element with a value of `spot`, `obstacle`, `waterway`, or `notice` to indicate the page type
4. THE External_JS_File SHALL read the `data-page-type` attribute from the map container element and execute the corresponding type-specific initialization logic
5. THE External_JS_File SHALL contain a single shared code path for common map setup (tile layer creation, attribution, zoom control position, locate control configuration) used by all page types
6. THE Layout_File for spot details SHALL pass page-specific dynamic values (spot latitude, spot longitude, spot type slug, spot name, spot slug, rejected status, spot data for popup) via Data_Attributes on the map container element
7. THE Layout_File for obstacle details SHALL pass page-specific dynamic values (geometry JSON, portage route JSON) via Data_Attributes on the map container element
8. THE Layout_File for waterway details SHALL pass page-specific dynamic values (geometry JSON) via Data_Attributes on the map container element
9. THE Layout_File for notice details SHALL pass page-specific dynamic values (affected area JSON, location coordinates) via Data_Attributes on the map container element
10. THE External_JS_File SHALL read all dynamic values from Data_Attributes and Map_Config instead of relying on Liquid_Interpolation
11. WHEN the page type is `spot`, THE External_JS_File SHALL center the map on the spot coordinates at zoom level 15 and add a spot marker with popup
12. WHEN the page type is `obstacle`, THE External_JS_File SHALL fit the map bounds to the obstacle geometry polygon, render the polygon with obstacle styling, and optionally render the portage route
13. WHEN the page type is `waterway`, THE External_JS_File SHALL fit the map bounds to the waterway geometry without rendering the polygon
14. WHEN the page type is `notice`, THE External_JS_File SHALL fit the map bounds to the affected area geometry polygon and render the polygon with event notice styling, falling back to location coordinates or the default map center when no geometry is available
15. AFTER extraction, THE Layout_Files for spot, obstacle, waterway, and notice details SHALL each contain zero Inline_Script_Blocks with Liquid_Interpolation

### Requirement 5: Extend Map Config with Shared Site Settings

**User Story:** As a site maintainer, I want shared site-level settings (Mapbox tile URL, map center coordinates, default zoom, max zoom) included in the Map_Config object, so that External_JS_Files can read these values without Liquid_Interpolation.

#### Acceptance Criteria

1. THE MapConfigGenerator plugin SHALL include the Mapbox tile URL (`site.mapbox_url`) in the generated Map_Config object
2. THE MapConfigGenerator plugin SHALL include the map center coordinates (`site.map.center.lat`, `site.map.center.lon`) in the generated Map_Config object
3. THE MapConfigGenerator plugin SHALL include the default zoom level (`site.map.default_zoom`) in the generated Map_Config object
4. THE MapConfigGenerator plugin SHALL include the maximum zoom level (`site.map.max_zoom`) in the generated Map_Config object
5. THE MapConfigGenerator plugin SHALL include the Mapbox attribution HTML string in the generated Map_Config object
6. WHEN the Map_Config is loaded by an External_JS_File, THE External_JS_File SHALL read tile URL, center, zoom, and attribution from `window.paddelbuchMapConfig` instead of relying on Liquid_Interpolation

### Requirement 6: Behavioral Equivalence

**User Story:** As a site user, I want the site to behave identically after the JavaScript extraction, so that no map functionality, popup content, layer controls, or filter behavior changes.

#### Acceptance Criteria

1. AFTER extraction, THE Build_System SHALL produce HTML pages where every map initializes at the same center coordinates and zoom level as before extraction
2. AFTER extraction, THE Build_System SHALL produce HTML pages where every spot marker displays the same popup content as before extraction
3. AFTER extraction, THE Build_System SHALL produce HTML pages where the layer control, filter panel, and data loading pipeline function identically to before extraction
4. AFTER extraction, THE Build_System SHALL produce HTML pages where the locate control displays the correct locale-specific tooltip text (German or English)
5. AFTER extraction, THE Build_System SHALL produce HTML pages where obstacle geometry, portage routes, protected areas, and event notice affected areas render with the same styles as before extraction
6. FOR ALL pages in both DE and EN locales, THE Build_System SHALL produce functionally equivalent output after extraction compared to before extraction

### Requirement 7: Build Performance Improvement

**User Story:** As a site maintainer, I want the Jekyll build time to decrease measurably after externalizing inline JavaScript, so that the development feedback loop is faster.

#### Acceptance Criteria

1. AFTER extraction, THE Liquid_Engine SHALL process fewer characters of template content per page render for each modified Layout_File and Include_File
2. AFTER extraction, THE Build_System SHALL complete a full site build in less time than the pre-extraction baseline of ~648 seconds
3. THE Build_System SHALL log per-page render times that can be compared against the pre-extraction baseline to verify improvement
