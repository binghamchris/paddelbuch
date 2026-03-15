# Requirements Document

## Introduction

The paddelbuch Jekyll site renders ~2815 pages across two languages (de, en). The Liquid rendering phase accounts for ~690 seconds of the ~717 second total build time. Profiling reveals that a significant portion of this time is spent on repeated Liquid operations that produce identical results across pages: type name lookups via `| where` filters, locale prefix computation, icon name resolution, header navigation data assembly, and map configuration JSON generation. These operations are performed in Liquid templates during every page render, but their results depend only on site-level data and the current locale — not on per-page content.

This feature moves these repeated computations from Liquid template rendering into Ruby generator plugins, where they execute once per locale (or once per document) during the generate phase. The Liquid templates are then simplified to output pre-computed values. The HTML output of the site must remain byte-identical.

## Glossary

- **CollectionGenerator**: Existing Jekyll Generator plugin (priority :high) that creates virtual Jekyll::Document objects from Contentful YAML data for page rendering.
- **PrecomputeGenerator**: New Jekyll Generator plugin (priority :normal) that computes site-level data used identically across all pages within a locale (header navigation, map config JSON, locale prefix).
- **Liquid_Rendering_Phase**: The Jekyll build phase where Liquid templates are parsed and evaluated to produce HTML output. This is the primary bottleneck (~690s of ~717s total build time).
- **Type_Lookup**: A Liquid `| where: "slug", value | first` filter operation that scans an array to find a matching entry. Currently performed per-page in templates.
- **Locale_Prefix**: The URL path prefix for non-default languages (empty string for `de`, `/en` for `en`). Currently computed via Liquid conditionals in ~10 includes per page.
- **Header_Navigation_Data**: The pre-computed navigation menu data (top lakes, top rivers, open data pages, about pages) that is identical for all pages within a locale.
- **Map_Config_JSON**: The JSON configuration block for map data layers (dimension configs, layer labels, protected area type names) that is identical for all detail pages within a locale.

## Requirements

### Requirement 1: Pre-compute Type Names in CollectionGenerator

**User Story:** As a site maintainer, I want type name lookups to be resolved during document generation rather than during Liquid rendering, so that the `| where` filter scans are eliminated from ~2815 page renders.

#### Acceptance Criteria

1. FOR each spot document, THE CollectionGenerator SHALL resolve the spot type name from `site.data['types']['spot_types']` using the document's `spotType_slug` and the current locale, and store the result as `doc.data['spot_type_name']`.
2. FOR each spot document, THE CollectionGenerator SHALL resolve the translated names of all paddle craft types from `site.data['types']['paddle_craft_types']` using the document's `paddleCraftTypes` array and the current locale, and store the result as `doc.data['paddle_craft_type_names']` (an array of translated name strings).
3. FOR each obstacle document, THE CollectionGenerator SHALL resolve the obstacle type name from `site.data['types']['obstacle_types']` using the document's `obstacleType_slug` and the current locale, and store the result as `doc.data['obstacle_type_name']`.
4. FOR each spot document where `rejected` is true, THE CollectionGenerator SHALL set `doc.data['spot_type_name']` to the translated "No Entry" label for the current locale (from the `de.yml`/`en.yml` translation files under the key `spot_types.no_entry`).
5. FOR each spot document, THE CollectionGenerator SHALL resolve the spot icon filename and alt text based on the spot type slug and rejected status, and store the results as `doc.data['spot_icon_name']` and `doc.data['spot_icon_alt']`.
6. THE Liquid templates (`spot.html` layout, `spot-detail-content.html`, `spot-icon.html`) SHALL be updated to use the pre-computed `spot_type_name`, `paddle_craft_type_names`, `spot_icon_name`, and `spot_icon_alt` values instead of performing `| where` lookups and if/elsif branching.
7. THE Liquid template (`obstacle.html` layout) SHALL be updated to use the pre-computed `obstacle_type_name` value instead of performing `| where` lookups.

### Requirement 2: Pre-compute Locale Prefix as Site Configuration

**User Story:** As a site maintainer, I want the locale prefix to be computed once per language pass rather than ~10 times per page render, so that redundant Liquid conditionals are eliminated.

#### Acceptance Criteria

1. THE PrecomputeGenerator SHALL compute the locale prefix string based on `site.config['lang']` and `site.config['default_lang']`, and store it in `site.config['locale_prefix']`.
2. ALL Liquid templates and includes that currently compute `locale_prefix` via `{% if site.lang != site.default_lang %}` conditionals SHALL be updated to use `site.locale_prefix` directly.
3. THE locale prefix value SHALL be an empty string when the current language equals the default language, and `/<lang>` (e.g., `/en`) otherwise.

### Requirement 3: Pre-compute Header Navigation Data

**User Story:** As a site maintainer, I want the header navigation menu data (top lakes, top rivers, static page menus) to be computed once per locale rather than on every page render, so that the expensive filter and sort operations in `header.html` are eliminated from ~2815 renders.

#### Acceptance Criteria

1. THE PrecomputeGenerator SHALL compute the top 10 lakes by area (sorted alphabetically) for the current locale and store the result in `site.data['nav_top_lakes']`.
2. THE PrecomputeGenerator SHALL compute the top 10 rivers by length (sorted alphabetically) for the current locale and store the result in `site.data['nav_top_rivers']`.
3. THE PrecomputeGenerator SHALL compute the "open data" static pages (filtered by locale and `menu_slug == "offene-daten"`, sorted by `menuOrder`) and store the result in `site.data['nav_open_data_pages']`.
4. THE PrecomputeGenerator SHALL compute the "about" static pages (filtered by locale and `menu_slug == "ueber"`, sorted by `menuOrder`) and store the result in `site.data['nav_about_pages']`.
5. THE `header.html` include SHALL be updated to use the pre-computed `site.data['nav_top_lakes']`, `site.data['nav_top_rivers']`, `site.data['nav_open_data_pages']`, and `site.data['nav_about_pages']` arrays instead of calling `top_lakes_by_area`, `top_rivers_by_length`, and `| where | sort` filters.

### Requirement 4: Pre-compute Map Configuration JSON

**User Story:** As a site maintainer, I want the map data configuration JSON block (dimension configs, layer labels, protected area type names) to be computed once per locale rather than on every detail page render, so that the identical JSON generation is eliminated from ~1800 detail page renders per locale.

#### Acceptance Criteria

1. THE PrecomputeGenerator SHALL generate the complete `map-data-config` JSON string for the current locale (containing dimension configs with spot type options, paddle craft type options, and layer labels) and store it in `site.data['map_data_config_json']`.
2. THE PrecomputeGenerator SHALL generate the complete `layer-control-config` JSON string for the current locale (containing locale, locale prefix, and protected area type name mappings) and store it in `site.data['layer_control_config_json']`.
3. THE `detail-map-layers.html` include SHALL be updated to output `site.data['map_data_config_json']` directly instead of constructing the JSON via Liquid conditionals and loops.
4. THE `layer-control.html` include SHALL be updated to output `site.data['layer_control_config_json']` directly instead of constructing the JSON via Liquid loops.
5. THE `map-init.html` include SHALL be updated to output `site.data['map_data_config_json']` directly instead of duplicating the JSON construction from `detail-map-layers.html`.

### Requirement 5: Pre-compute Waterway Event Notice Lists

**User Story:** As a site maintainer, I want the active event notices for each waterway to be pre-filtered during document generation rather than during Liquid rendering, so that the O(notices × waterways) filtering loop in `event-list.html` is eliminated from ~250 waterway page renders per locale.

#### Acceptance Criteria

1. FOR each waterway document, THE CollectionGenerator SHALL filter `site.data['notices']` to find notices that affect the waterway (by matching waterway slug in the notice's `waterways` array) AND have an `endDate` in the future, and store the result as `doc.data['active_notices']` (an array of notice objects with `name`, `slug`, and `endDate` fields).
2. THE `event-list.html` include SHALL be updated to iterate over `page.active_notices` instead of performing the filtering loop over all notices.

### Requirement 6: Pre-compute Waterway Data on Spot and Obstacle Documents

**User Story:** As a site maintainer, I want waterway name and slug to be directly available on spot and obstacle documents, so that the `| where` lookup in Liquid templates is eliminated.

#### Acceptance Criteria

1. FOR each spot document with a `waterway_slug`, THE CollectionGenerator SHALL resolve the waterway name from `site.data['waterways']` for the current locale and store it as `doc.data['waterway_name']`.
2. FOR each obstacle document with a `waterway_slug`, THE CollectionGenerator SHALL resolve the waterway name from `site.data['waterways']` for the current locale and store it as `doc.data['waterway_name']`.
3. THE Liquid templates (`spot-detail-content.html`, `obstacle-detail-content.html`, `spot.html` layout, `obstacle.html` layout) SHALL be updated to use `page.waterway_name` and `page.waterway_slug` directly instead of performing `| where` lookups on `site.data.waterways`.

### Requirement 7: Pre-compute Notice Waterway Data

**User Story:** As a site maintainer, I want waterway objects to be pre-resolved on notice documents, so that the Liquid loop in `notice.html` that looks up waterways by slug is eliminated.

#### Acceptance Criteria

1. FOR each notice document, THE CollectionGenerator SHALL resolve the waterway objects from `site.data['waterways']` for each slug in the notice's `waterways` array and the current locale, and store the result as `doc.data['notice_waterways']` (an array of objects with `name` and `slug` fields).
2. THE `notice.html` layout SHALL be updated to use `page.notice_waterways` directly instead of performing the Liquid loop that looks up waterways by slug.

### Requirement 8: Build Output Invariance

**User Story:** As a site maintainer, I want the pre-computation optimizations to produce byte-identical HTML output compared to the current Liquid-based implementation, so that I can adopt the changes with confidence that no content is altered.

#### Acceptance Criteria

1. FOR every HTML file written to `_site/`, THE build output SHALL be byte-identical whether values were computed in Liquid templates or pre-computed in Ruby generators.
2. THE set of files written to `_site/` SHALL be identical before and after the optimization — no files shall be added, removed, or renamed.
3. THE pre-computation feature SHALL NOT alter the content, structure, or encoding of any HTML page, JSON API file, spatial tile file, sitemap, or any other build artifact.

### Requirement 9: PrecomputeGenerator Execution Order

**User Story:** As a plugin developer, I want the PrecomputeGenerator to run after CollectionGenerator but before Liquid rendering, so that all pre-computed site-level data is available when templates are evaluated.

#### Acceptance Criteria

1. THE PrecomputeGenerator SHALL have priority `:normal` (which executes after `:high` CollectionGenerator and before the Liquid rendering phase).
2. THE PrecomputeGenerator SHALL execute once per language pass (it will be called by Jekyll for each language configured in the multi-language plugin).
3. THE PrecomputeGenerator SHALL be idempotent — running it multiple times with the same site state SHALL produce the same results.
