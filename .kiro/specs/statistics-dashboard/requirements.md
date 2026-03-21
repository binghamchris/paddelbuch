# Requirements Document

## Introduction

The Statistics Dashboard is a new non-map dashboard added to the existing Data Quality page at `/offene-daten/datenqualitaet/`. It provides an at-a-glance overview of the Paddelbuch database contents through summary figures and horizontal bar charts. The dashboard displays total counts for spots (broken down by spot type including "no entry" spots), obstacles (broken down by portage route availability), and protected areas (broken down by protected area type). It also shows per-paddle-craft-type spot counts, per-data-source-type entry counts, and per-data-license-type entry counts. The Statistics Dashboard becomes the first (default) dashboard shown when users visit the Data Quality page, pushing the existing Freshness and Coverage dashboards to second and third position.

## Glossary

- **Statistics_Dashboard**: A non-map Dashboard module (id: `statistics`, `usesMap: false`) that renders summary figures and horizontal bar charts into the `#dashboard-content` container
- **Dashboard_Page**: The existing Data Quality page at `/offene-daten/datenqualitaet/` that hosts all data quality dashboards
- **Dashboard_Switcher**: The existing UI control that allows users to switch between available dashboards on the Dashboard_Page
- **Statistics_Metrics_Generator**: A Jekyll Generator plugin that computes all statistics counts at build time and exposes them as `site.data['dashboard_statistics_metrics']`
- **Summary_Figure**: A prominent numeric display showing a total count (e.g. total number of spots)
- **Stacked_Bar_Chart**: A single horizontal bar divided into coloured segments, each segment representing a category's count proportionally
- **Spot**: A paddle sports access point with fields including `slug`, `locale`, `spotType_slug`, `paddleCraftTypes`, `dataSourceType_slug`, `dataLicenseType_slug`, and `rejected`
- **No_Entry_Spot**: A Spot where the `rejected` field is `true`, displayed as a distinct category alongside spot types in the spots bar chart
- **Obstacle**: A waterway obstacle with fields including `slug`, `locale`, and `portageRoute`
- **Protected_Area**: A protected area with fields including `slug`, `locale`, and `protectedAreaType_slug`
- **Paddle_Craft_Type**: A type of paddle craft (e.g. Stand Up Paddle Board, Kanadier, Seekajak) referenced by spots via the `paddleCraftTypes` array
- **Waterway**: A body of water (river, lake, canal) with fields including `slug`, `locale`, `dataSourceType_slug`, and `dataLicenseType_slug`
- **Notice**: A waterway event notice (e.g. construction, hazard) with fields including `slug`, `locale`, `dataSourceType_slug`, and `dataLicenseType_slug`
- **Data_Source_Type**: A data source classification (e.g. Swiss Canoe, OpenStreetMap) referenced by spots, obstacles, protected areas, waterways, and notices via `dataSourceType_slug`
- **Data_License_Type**: A data license classification (e.g. CC-BY-SA-4, ODbL) referenced by spots, obstacles, protected areas, waterways, and notices via `dataLicenseType_slug`
- **Colour_File**: The central SCSS colour definitions file (`_sass/settings/_paddelbuch_colours.scss`) and its JS-accessible counterpart via `site.data['paddelbuch_colors']`

## Requirements

### Requirement 1: Dashboard Registration and Default Position

**User Story:** As a Paddelbuch user, I want the Statistics dashboard to be the first dashboard shown when I visit the Data Quality page, so that I immediately see an overview of the database contents.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL register itself on the `PaddelbuchDashboardRegistry` array before the existing Freshness and Coverage dashboards
2. WHEN the Dashboard_Page loads, THE Dashboard_Switcher SHALL activate the Statistics_Dashboard by default (as the first registered dashboard)
3. THE Statistics_Dashboard SHALL set `usesMap` to `false` so that the `#dashboard-map` container is hidden and the `#dashboard-content` container is shown when the Statistics_Dashboard is active
4. WHEN the Statistics_Dashboard is activated, THE Statistics_Dashboard SHALL render its content into the `#dashboard-content` container
5. WHEN the Statistics_Dashboard is deactivated, THE Statistics_Dashboard SHALL remove all of its rendered content from the `#dashboard-content` container

### Requirement 2: Spots Summary and Bar Chart

**User Story:** As a Paddelbuch user, I want to see the total number of spots and their breakdown by type, so that I understand the composition of spot data in the database.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display a Summary_Figure showing the total number of unique spots (deduplicated by slug across locales)
2. THE Statistics_Dashboard SHALL display a Stacked_Bar_Chart to the right of the spots Summary_Figure, with the bar divided into segments by spot type
3. THE Stacked_Bar_Chart for spots SHALL include one segment for each spot type (nur-ausstieg, einstieg-ausstieg, rasthalte, notauswasserungsstelle, nur-einstieg) and one additional segment for No_Entry_Spots
4. WHEN a spot has `rejected: true`, THE Statistics_Metrics_Generator SHALL count that spot in the No_Entry_Spot segment regardless of its `spotType_slug` value
5. WHEN a spot does not have `rejected: true`, THE Statistics_Metrics_Generator SHALL count that spot in the segment corresponding to its `spotType_slug` value
6. THE Statistics_Dashboard SHALL display a colour-coded legend below or beside the Stacked_Bar_Chart identifying each spot type segment and the No_Entry_Spot segment
7. THE Statistics_Dashboard SHALL use distinct colours from the Colour_File for each spot type segment, adding new colour variables to the Colour_File where existing colours are insufficient

### Requirement 3: Obstacles Summary and Bar Chart

**User Story:** As a Paddelbuch user, I want to see the total number of obstacles and whether they have portage routes, so that I understand the obstacle data coverage.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display a Summary_Figure showing the total number of unique obstacles (deduplicated by slug across locales)
2. THE Statistics_Dashboard SHALL display a Stacked_Bar_Chart to the right of the obstacles Summary_Figure, with the bar divided into two segments: obstacles with a portage route and obstacles without a portage route
3. WHEN an obstacle has a non-null `portageRoute` field, THE Statistics_Metrics_Generator SHALL count that obstacle in the "with portage route" segment
4. WHEN an obstacle has a null `portageRoute` field, THE Statistics_Metrics_Generator SHALL count that obstacle in the "without portage route" segment
5. THE Statistics_Dashboard SHALL display a colour-coded legend identifying the "with portage route" and "without portage route" segments
6. THE Statistics_Dashboard SHALL use distinct colours from the Colour_File for the two obstacle segments

### Requirement 4: Protected Areas Summary and Bar Chart

**User Story:** As a Paddelbuch user, I want to see the total number of protected areas and their breakdown by type, so that I understand the protected area data in the database.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display a Summary_Figure showing the total number of unique protected areas (deduplicated by slug across locales)
2. THE Statistics_Dashboard SHALL display a Stacked_Bar_Chart to the right of the protected areas Summary_Figure, with the bar divided into segments by protected area type
3. THE Stacked_Bar_Chart for protected areas SHALL include one segment for each protected area type (wasserskizone, privatbesitz, schiesszone, teleskizone, schilfgebiet, schwimmbereich, industriegebiet, fahrverbotzone, naturschutzgebiet)
4. THE Statistics_Dashboard SHALL display a colour-coded legend identifying each protected area type segment
5. THE Statistics_Dashboard SHALL use distinct colours from the Colour_File for each protected area type segment, adding new colour variables to the Colour_File where existing colours are insufficient

### Requirement 5: Paddle Craft Type Figures

**User Story:** As a Paddelbuch user, I want to see how many spots are potentially usable by each paddle craft type, so that I understand the data coverage for different craft types.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display one Summary_Figure for each Paddle_Craft_Type (stand-up-paddle-board, kanadier, seekajak)
2. EACH Summary_Figure SHALL show the total number of unique spots (deduplicated by slug) whose `paddleCraftTypes` array contains the corresponding Paddle_Craft_Type slug
3. THE Statistics_Metrics_Generator SHALL count a spot toward a Paddle_Craft_Type when the spot's `paddleCraftTypes` array includes that type's slug (a single spot may be counted toward multiple Paddle_Craft_Types)
4. EACH Summary_Figure SHALL display the localised name of the Paddle_Craft_Type as its label

### Requirement 6: Data Source Type Figures

**User Story:** As a Paddelbuch user, I want to see how many entries are associated with each data source, so that I understand where the data comes from.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display one Summary_Figure for each Data_Source_Type (swiss-canoe, openstreetmap, swiss-canoe-fako-member, individual-contributor, swiss-canoe-meldestelle-fur-absehbare-gewasserereignisse)
2. EACH Summary_Figure SHALL show the total number of unique entries (spots, obstacles, protected areas, waterways, and notices, each deduplicated by slug) whose `dataSourceType_slug` matches the corresponding Data_Source_Type slug
3. THE Statistics_Metrics_Generator SHALL count spots, obstacles, protected areas, waterways, and notices for data source figures, summing the deduplicated counts across all five entity types for each Data_Source_Type
4. EACH Summary_Figure SHALL display the localised name of the Data_Source_Type as its label

### Requirement 7: Data License Type Figures

**User Story:** As a Paddelbuch user, I want to see how many entries are associated with each data license, so that I understand the licensing distribution of the data.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL display one Summary_Figure for each Data_License_Type (cc-by-sa-4, lizenz-odbl)
2. EACH Summary_Figure SHALL show the total number of unique entries (spots, obstacles, protected areas, waterways, and notices, each deduplicated by slug) whose `dataLicenseType_slug` matches the corresponding Data_License_Type slug
3. THE Statistics_Metrics_Generator SHALL count spots, obstacles, protected areas, waterways, and notices for data license figures, summing the deduplicated counts across all five entity types for each Data_License_Type
4. EACH Summary_Figure SHALL display the localised name of the Data_License_Type as its label

### Requirement 8: Build-Time Metric Computation

**User Story:** As a developer, I want the statistics to be computed at Jekyll build time, so that the browser receives pre-computed data and performs no calculations at runtime.

#### Acceptance Criteria

1. THE Statistics_Metrics_Generator SHALL be a Jekyll Generator plugin that computes all statistics counts at build time
2. THE Statistics_Metrics_Generator SHALL follow the compute-once-cache-across-locales pattern used by the existing `DashboardMetricsGenerator`, computing counts once on the first locale pass and caching them for subsequent locale passes
3. THE Statistics_Metrics_Generator SHALL deduplicate spots by slug across locales before counting
4. THE Statistics_Metrics_Generator SHALL deduplicate obstacles by slug across locales before counting
5. THE Statistics_Metrics_Generator SHALL deduplicate protected areas by slug across locales before counting
6. THE Statistics_Metrics_Generator SHALL deduplicate waterways by slug across locales before counting
7. THE Statistics_Metrics_Generator SHALL deduplicate notices by slug across locales before counting
8. THE Statistics_Metrics_Generator SHALL expose its output as `site.data['dashboard_statistics_metrics']`
9. THE Dashboard_Page SHALL embed the statistics metrics as a `<script type="application/json">` block with id `statistics-data`
10. THE Statistics_Dashboard JavaScript module SHALL read the pre-computed metrics from the `#statistics-data` JSON block and render them without performing any counting or computation

### Requirement 9: Localisation

**User Story:** As a Paddelbuch user, I want the Statistics dashboard to be fully localised in German and English, so that the dashboard is usable in both languages.

#### Acceptance Criteria

1. ALL user-facing text on the Statistics_Dashboard — including the dashboard name, section headings, figure labels, legend labels, and bar chart segment labels — SHALL be localised using the existing `{% t %}` translation tag and `_i18n/` translation files
2. THE Statistics_Dashboard SHALL use a `<script type="application/json">` block with id `statistics-i18n` to pass localised strings to the JavaScript module
3. THE Statistics_Metrics_Generator SHALL include localised type names (using the locale-appropriate `name_de` or `name_en` field) in the metrics output for spot types, protected area types, paddle craft types, data source types, and data license types
4. WHEN the Dashboard_Switcher displays the Statistics_Dashboard tab, THE tab label SHALL show the localised dashboard name

### Requirement 10: Visual Design and Colour Palette

**User Story:** As a Paddelbuch user, I want the Statistics dashboard to be visually consistent with the rest of the site and use clear, distinguishable colours, so that the data is easy to read.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL use colours exclusively from the Colour_File for all UI elements
2. THE Colour_File SHALL be extended with new colour variables sufficient to provide a distinct colour for each segment in the spots bar chart (5 spot types + 1 no-entry category), the obstacles bar chart (2 segments), and the protected areas bar chart (9 protected area types)
3. ALL new colour variables added to the Colour_File SHALL be visually consistent with the existing colour palette
4. THE Statistics_Dashboard SHALL use the same font families and text styles as the rest of the Paddelbuch site
5. THE Statistics_Dashboard layout SHALL be responsive and display correctly on both desktop and mobile viewports
6. THE `color_generator.rb` plugin SHALL automatically expose the new colour variables to JavaScript via `site.data['paddelbuch_colors']`, requiring no changes to the plugin itself

### Requirement 11: Script Loading Order

**User Story:** As a developer, I want the Statistics dashboard script to load before the existing dashboard scripts, so that it registers first in the registry and becomes the default dashboard.

#### Acceptance Criteria

1. THE Dashboard_Page front matter `scripts` array SHALL list the Statistics_Dashboard JavaScript file before `freshness-dashboard.js` and `coverage-dashboard.js`
2. THE Statistics_Dashboard JavaScript file SHALL be listed after `dashboard-data.js` so that the pre-computed data is available when the Statistics_Dashboard module initialises
3. WHEN the Dashboard_Switcher reads the `PaddelbuchDashboardRegistry`, THE Statistics_Dashboard SHALL be the first entry in the array

### Requirement 12: Data Deduplication Correctness

**User Story:** As a developer, I want the statistics counts to be accurate by deduplicating entries that appear once per locale, so that the dashboard does not double-count.

#### Acceptance Criteria

1. THE Statistics_Metrics_Generator SHALL count each unique spot (by slug) exactly once, regardless of how many locale entries exist for that spot
2. THE Statistics_Metrics_Generator SHALL count each unique obstacle (by slug) exactly once, regardless of how many locale entries exist for that obstacle
3. THE Statistics_Metrics_Generator SHALL count each unique protected area (by slug) exactly once, regardless of how many locale entries exist for that protected area
4. THE Statistics_Metrics_Generator SHALL count each unique waterway (by slug) exactly once, regardless of how many locale entries exist for that waterway
5. THE Statistics_Metrics_Generator SHALL count each unique notice (by slug) exactly once, regardless of how many locale entries exist for that notice
6. FOR ALL entity types (spots, obstacles, protected areas, waterways, notices), the total count displayed in the Summary_Figure SHALL equal the number of unique slugs in the corresponding data file
