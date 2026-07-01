# Requirements Document

## Introduction

Spot Tips is a new feature for the Paddelbuch site that associates advisory tips with paddle spots. Each spot can have zero or more spot tips, where each tip is an instance of a Spot Tip Type defined in Contentful. The feature integrates into four areas of the site: the filter UI (allowing users to filter spots by tip presence), the spot detail page (showing tip banners below the description), the map markers (adding modifier icons to indicate tip types visually), and the API.

## Glossary

- **Spot**: A paddle sport location entry in Contentful, displayed as a map marker and detail page on the site.
- **Spot_Tip**: A reference from a Spot entry to a Spot_Tip_Type entry via the `spotTips` field. A Spot may have zero or more Spot_Tips.
- **Spot_Tip_Type**: A Contentful content type (`spotTipType`) defining a category of tip. Contains a localised `name` (required), a rich text `description` (optional), and a `slug` (required, unique identifier).
- **Filter_Panel**: The Leaflet-based filter control (`PaddelbuchFilterPanel`) that provides multi-dimension spot filtering on the main map.
- **Filter_Engine**: The filtering logic module (`PaddelbuchFilterEngine`) that evaluates spot visibility using AND-logic across filter dimensions.
- **Spot_Detail_Page**: The detail page rendered by the `spot.html` layout, showing full spot information including description, details table, and map.
- **Map_Marker**: A Leaflet marker on the map representing a Spot, styled with an SVG icon based on spot type.
- **Modifier_Icon**: A small SVG icon overlaid on or adjacent to a Map_Marker to indicate the presence of a specific Spot_Tip_Type.
- **Tip_Banner**: An alert-style banner displayed on the Spot_Detail_Page for each Spot_Tip associated with the spot.
- **Data_Pipeline**: The system of Contentful mappers, YAML data files, and Jekyll plugins that transforms Contentful data into site content.
- **Dimension_Config**: A filter dimension configuration object used by the Filter_Engine, containing a key, label, options array, and match function.
- **Api_Generator**: The Jekyll plugin (`ApiGenerator`) that generates JSON API endpoint files at build time, including fact tables (e.g., spots, obstacles) and dimension tables (e.g., spot types, obstacle types), each produced per locale.

## Requirements

### Requirement 1: Contentful Data Integration

**User Story:** As a site maintainer, I want spot tip type data from Contentful to be fetched and stored as site data, so that spot tips can be rendered throughout the site.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL fetch `spotTipType` entries from Contentful and store them as a YAML data file at `_data/types/spot_tip_types.yml`.
2. WHEN a `spotTipType` entry is fetched, THE Data_Pipeline SHALL store the `name` field in both `name_de` and `name_en` properties, the `slug` field, and the `description` field (as rendered HTML in `description_de` and `description_en` properties).
3. THE Data_Pipeline SHALL include the `spotTips` reference field when fetching Spot entries, storing an array of Spot_Tip_Type slugs in a `spotTipType_slugs` property on each Spot data record.
4. WHEN a Spot entry has zero Spot_Tips, THE Data_Pipeline SHALL store an empty array for the `spotTipType_slugs` property.

### Requirement 2: Filter Panel — Spot Tips Dimension

**User Story:** As a map user, I want to filter spots by their tip types in the filter panel, so that I can find spots with specific advisory information.

#### Acceptance Criteria

1. THE Filter_Panel SHALL include a new fieldset section for Spot_Tip_Type filtering, rendered as a separate dimension below the existing filter dimensions.
2. THE Filter_Panel SHALL display one checkbox option per Spot_Tip_Type, using the localised `name` as the label.
3. THE Filter_Panel SHALL include an additional checkbox option labelled "Spots without tips" (localised: "Einstiegsorte ohne Tipps" in German, "Spots without tips" in English) within the Spot_Tip_Type fieldset.
4. WHEN the Filter_Panel is initialised, THE "Spots without tips" checkbox SHALL be checked by default.
5. WHEN the Filter_Panel is initialised, THE checkbox for each Spot_Tip_Type SHALL be checked by default.
6. WHEN a user unchecks the "Spots without tips" checkbox, THE Filter_Engine SHALL hide all Spots that have zero Spot_Tips.
7. WHEN a user unchecks a Spot_Tip_Type checkbox, THE Filter_Engine SHALL hide all Spots whose only matching tip types are the unchecked types.
8. THE Filter_Engine SHALL use AND-logic to combine the Spot_Tip_Type dimension with all other existing filter dimensions.

### Requirement 3: Spot Detail Page — Tip Banners

**User Story:** As a site visitor, I want to see advisory tip banners on the spot detail page, so that I am informed about relevant tips for the spot I am viewing.

#### Acceptance Criteria

1. WHEN a Spot has one or more Spot_Tips, THE Spot_Detail_Page SHALL display one Tip_Banner for each Spot_Tip directly below the description section and above the details table.
2. WHEN a Spot has zero Spot_Tips, THE Spot_Detail_Page SHALL display no Tip_Banners.
3. THE Tip_Banner SHALL display the localised `name` of the Spot_Tip_Type.
4. WHEN a Spot_Tip_Type has a non-empty `description`, THE Tip_Banner SHALL display the rendered rich text description.
5. WHEN a Spot_Tip_Type has an empty `description`, THE Tip_Banner SHALL display only the localised `name` without a description section.
6. THE Tip_Banner SHALL use a Bootstrap alert component structure similar to the existing rejection alert in the `rejected-spot-content.html` include.
7. THE Tip_Banner SHALL apply a CSS class derived from the Spot_Tip_Type slug (e.g., `alert-spot-tip-{slug}`), enabling each Spot_Tip_Type to be styled independently of all other banner types.
8. THE Tip_Banner SHALL include a custom SVG icon unique to each Spot_Tip_Type, positioned to the left of the text content, consistent with the existing rejection alert layout. Each icon SHALL be stored in the `assets/images/tips/` directory following the naming convention `tip-banner-{slug}.svg`.

### Requirement 4: Map Marker Modifier Icons

**User Story:** As a map user, I want to see small modifier icons on map markers for spots that have tips, so that I can visually identify which spots have advisory tips without opening the detail page.

#### Acceptance Criteria

1. WHEN a Spot has one or more Spot_Tips, THE Map_Marker SHALL display one Modifier_Icon for each associated Spot_Tip_Type.
2. WHEN a Spot has zero Spot_Tips, THE Map_Marker SHALL display the standard marker icon without any Modifier_Icons.
3. THE Modifier_Icon for each Spot_Tip_Type SHALL be a unique SVG image stored in the `assets/images/markers/` directory, following the naming convention `tip-modifier-{slug}.svg`.
4. THE Modifier_Icon for each Spot_Tip_Type SHALL have a unique position offset relative to the standard marker icon anchor point, ensuring all applicable Modifier_Icons are visible for Spots with multiple Spot_Tip_Types.
5. THE Map_Marker SHALL render Modifier_Icons using a Leaflet `DivIcon` or equivalent approach that composites the standard marker SVG with the Modifier_Icon SVGs.
6. IF a Spot_Tip_Type slug does not have a corresponding Modifier_Icon SVG file, THEN THE Map_Marker SHALL render the standard marker icon without a Modifier_Icon for that Spot_Tip_Type.
7. THE Modifier_Icon position offsets SHALL be defined in a single authoritative configuration source, and all components that render Modifier_Icons SHALL consume positioning data from that single source to avoid repetition and ensure consistency of presentation.

### Requirement 5: Spot Tip Type Data Availability

**User Story:** As a developer, I want spot tip type data to be available in the Jekyll data layer and in client-side JavaScript, so that all site components can access tip information.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL make Spot_Tip_Type data available via `site.data.types.spot_tip_types` in Jekyll templates.
2. THE Data_Pipeline SHALL include Spot_Tip_Type data in the `map-data-config` JSON element, providing a `spotTipType` Dimension_Config with localised labels and slug-based options.
3. THE Dimension_Config for `spotTipType` SHALL include a match function that evaluates a Spot's `spotTipType_slugs` array against the selected filter options, including the "no tips" option.

### Requirement 6: API — Spot Tip Type Dimension and Spot Field

**User Story:** As an API consumer, I want the spot tips dimension table and the spot tip type references on spots to be available through the JSON API, so that downstream clients can access spot tip data programmatically.

#### Acceptance Criteria

1. THE Api_Generator SHALL include a `spottiptypes` dimension table in the DIMENSION_TABLES configuration, referencing the `types/spot_tip_types` data key and the `spotTipType` content type.
2. WHEN the Api_Generator generates dimension tables, THE Api_Generator SHALL produce `spottiptypes-de.json` and `spottiptypes-en.json` endpoint files containing all Spot_Tip_Type entries with `slug`, `node_locale`, `createdAt`, `updatedAt`, and localised `name` fields.
3. THE Api_Generator SHALL include a `spotTipTypes` entry in the CONTENT_TYPE_NAMES mapping, so that the `lastUpdateIndex.json` file tracks the last update timestamp for the Spot_Tip_Type dimension table.
4. WHEN the Api_Generator transforms a Spot record for the spots fact table, THE Api_Generator SHALL include a `spotTipType` field containing an array of `{"slug": "..."}` objects derived from the Spot's `spotTipType_slugs` property.
5. WHEN a Spot has zero Spot_Tips, THE Api_Generator SHALL output an empty array for the `spotTipType` field on the transformed Spot record.
6. WHEN a Spot_Tip_Type has a non-empty `description`, THE Api_Generator SHALL include the `description` field as a wrapped raw rich text object in the dimension table output.
7. WHEN the spot tips feature is implemented, THE "Data Download / API" page SHALL be updated to list the new `spottiptypes` dimension table alongside the existing dimension tables.

### Requirement 7: Project Documentation Updates

**User Story:** As a developer or contributor, I want the project documentation to reflect the spot tips feature, so that I can understand the full data model, build pipeline, frontend modules, and API surface without discovering undocumented behaviour.

#### Acceptance Criteria

1. WHEN the spot tips feature is implemented, THE README.md SHALL list `_data/types/spot_tip_types.yml` in the Project Structure section under `_data/types/`.
2. WHEN the spot tips feature is implemented, THE README.md SHALL list the `/api/spottiptypes-{locale}.json` endpoint in the API Available Endpoints section under Dimension Tables.
3. WHEN the spot tips feature is implemented, THE README.md SHALL include `spotTipType` in the Contentful Integration content types summary.
4. WHEN the spot tips feature is implemented, THE Content_Model document (`docs/content-model.md`) SHALL include a `spotTipType` section under Dimension Content Types, documenting the `slug`, `name`, and `description` fields.
5. WHEN the spot tips feature is implemented, THE Content_Model document (`docs/content-model.md`) SHALL add a `spotTips` reference field (`References → spotTipType[]`) to the `spot` Fact Content Type table.
6. WHEN the spot tips feature is implemented, THE Architecture document (`docs/architecture.md`) SHALL list `spotTipType` with its data file path (`types/spot_tip_types.yml`) in the Dimension Types table.
7. WHEN the spot tips feature is implemented, THE Plugins document (`docs/plugins.md`) SHALL include `spot_tip_types.yml` in the ContentfulFetcher Outputs list under `_data/types/*.yml`.
8. WHEN the spot tips feature is implemented, THE Frontend document (`docs/frontend.md`) SHALL document any new JavaScript modules or modifications to existing modules (e.g., `filter-engine.js`, `filter-panel.js`, `marker-styles.js`) introduced by the spot tips feature.
9. WHEN the spot tips feature is implemented, THE Frontend document (`docs/frontend.md`) SHALL document any new SCSS files or modifications to existing SCSS files introduced for Tip_Banner styling or Modifier_Icon styling.
10. WHEN the spot tips feature is implemented, THE Testing document (`docs/testing.md`) SHALL list any new test files added for spot tips functionality in the Ruby Test Structure and JavaScript Test Structure sections.

### Requirement 8: Build Precomputation Integration

**User Story:** As a site maintainer, I want the spot tips feature to integrate with the existing Liquid precomputation system, so that build times are not regressed by new repeated Liquid computations.

#### Acceptance Criteria

1. WHEN the spot tips feature introduces new Liquid computations that would be repeated across multiple pages (e.g., spot tip type lookups, filter dimension configuration, banner content assembly), THOSE computations SHALL be integrated into the existing precomputation system.
2. THE precomputation integration SHALL follow the patterns established in the `liquid-precomputation` spec for precomputing data and making it available to templates without repeated Liquid evaluation.
3. THE spot tips feature SHALL NOT introduce Liquid loops or lookups against `site.data.types.spot_tip_types` that execute per-page when the result is identical across pages; such computations SHALL be precomputed once and reused.
