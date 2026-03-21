# Requirements Document

## Introduction

The Spot Freshness Dashboard is a new dashboard on the data quality page (`datenqualitaet.html`) that visualises the freshness of individual spots. It combines a horizontal stacked bar chart (moved from the existing Statistics dashboard) with a Leaflet map showing all spots as shaped markers coloured by freshness category. A single shared legend serves both the chart and the map. The dashboard integrates into the existing dashboard registry and switcher system.

## Glossary

- **Dashboard_Switcher**: The tab-based UI component (`dashboard-switcher.js`) that manages activation and deactivation of dashboard modules on the data quality page.
- **Dashboard_Registry**: The global array (`PaddelbuchDashboardRegistry`) where dashboard modules register themselves for discovery by the Dashboard_Switcher.
- **Spot_Freshness_Dashboard**: The new dashboard module that displays spot freshness as both a chart and a map with shaped markers.
- **Spot**: A paddling entry/exit point with fields including `slug`, `updatedAt`, `rejected`, `location` (`lat`, `lon`), `waterway_slug`, and `spotType_slug`.
- **Freshness_Category**: One of three classifications based on a spot's age since `updatedAt`: Fresh (≤ 2 years / 730.5 days), Aging (2–5 years / 730.5–1826.25 days), Stale (> 5 years / 1826.25 days).
- **Freshness_Colour**: The colour assigned to each Freshness_Category, resolved at runtime from `PaddelbuchColors` (sourced from `_sass/settings/_paddelbuch_colours.scss`): `green1` for Fresh, `warningYellow` for Aging, `dangerRed` for Stale. No hex values SHALL be hardcoded in application code.
- **Marker_Shape**: The geometric shape used for spot markers on the map to ensure visual accessibility: circle for Fresh, triangle for Aging, square for Stale.
- **Spot_Freshness_Chart**: The horizontal stacked bar chart rendered with Chart.js that shows the count of spots per Freshness_Category.
- **Shared_Legend**: A single legend element that describes the Freshness_Categories using both Freshness_Colours and Marker_Shapes, serving both the chart and the map.
- **Dashboard_Map**: The shared Leaflet map instance (`PaddelbuchDashboardMap`) centred on Switzerland, used by map-based dashboards.
- **Statistics_Dashboard**: The existing dashboard module (`statistics-dashboard.js`) that currently contains the Spot_Freshness_Chart.
- **Waterway_Freshness_Dashboard**: The existing dashboard module (`freshness-dashboard.js`) that colours waterway geometries by freshness, including a "no spots" (No Data) category.
- **Spot_Freshness_Metrics**: The pre-computed freshness counts (`fresh`, `aging`, `stale`) generated at build time by `statistics_metrics_generator.rb`.

## Requirements

### Requirement 1: Dashboard Registration

**User Story:** As a user of the data quality page, I want the Spot Freshness Dashboard to appear as a selectable tab, so that I can navigate to it via the Dashboard_Switcher.

#### Acceptance Criteria

1. THE Spot_Freshness_Dashboard SHALL register itself on the Dashboard_Registry with the id `spot-freshness`.
2. THE Spot_Freshness_Dashboard SHALL expose a `getName()` method that returns a localised dashboard name read from an i18n JSON block on the page.
3. THE Spot_Freshness_Dashboard SHALL implement `activate(context)` and `deactivate()` methods conforming to the dashboard module interface.
4. WHEN the data quality page loads, THE Dashboard_Switcher SHALL display a tab for the Spot_Freshness_Dashboard alongside the existing dashboard tabs.

### Requirement 2: Dual-Container Layout (Map and Content)

**User Story:** As a user, I want the Spot Freshness Dashboard to show both a chart and a map simultaneously, so that I can see the freshness breakdown and the geographic distribution of spots at the same time.

#### Acceptance Criteria

1. WHEN the Spot_Freshness_Dashboard is activated, THE Dashboard_Switcher SHALL display both the `#dashboard-map` container and the `#dashboard-content` container.
2. WHEN a dashboard that uses only the map or only the content area is activated after the Spot_Freshness_Dashboard, THE Dashboard_Switcher SHALL revert to the standard single-container visibility logic.
3. THE Spot_Freshness_Dashboard SHALL declare a `usesMap` value or equivalent mechanism that signals the Dashboard_Switcher to show both containers.

### Requirement 3: Spot Freshness Chart Migration

**User Story:** As a user, I want the Spot Freshness Chart to appear on the Spot Freshness Dashboard instead of the Statistics Dashboard, so that freshness information is consolidated in one place.

#### Acceptance Criteria

1. WHEN the Spot_Freshness_Dashboard is activated, THE Spot_Freshness_Dashboard SHALL render the Spot_Freshness_Chart as a horizontal stacked bar chart inside the `#dashboard-content` container using Chart.js.
2. THE Spot_Freshness_Chart SHALL display segments for each Freshness_Category using the corresponding Freshness_Colour from `PaddelbuchColors`.
3. THE Spot_Freshness_Chart SHALL use the pre-computed Spot_Freshness_Metrics from `PaddelbuchDashboardData.statisticsMetrics.spots.freshness`.
4. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL destroy all Chart.js instances it created.
5. THE Statistics_Dashboard SHALL no longer render the Spot_Freshness_Chart or its associated sub-section.

### Requirement 4: Spot Freshness Map

**User Story:** As a user, I want to see all spots plotted on the map with markers that indicate their freshness, so that I can identify geographic clusters of stale data.

#### Acceptance Criteria

1. WHEN the Spot_Freshness_Dashboard is activated, THE Spot_Freshness_Dashboard SHALL add one marker to the Dashboard_Map for each non-rejected Spot that has a valid `location` and a valid `updatedAt` date.
2. THE Spot_Freshness_Dashboard SHALL colour each marker using the Freshness_Colour corresponding to the Spot's calculated Freshness_Category.
3. THE Spot_Freshness_Dashboard SHALL shape each marker using the Marker_Shape corresponding to the Spot's calculated Freshness_Category: circle for Fresh, triangle for Aging, square for Stale.
4. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL remove all markers it added to the Dashboard_Map.
5. IF a Spot has a `null` or missing `updatedAt` value, THEN THE Spot_Freshness_Dashboard SHALL exclude that Spot from the map.
6. IF a Spot has a `null` or missing `location` value, THEN THE Spot_Freshness_Dashboard SHALL exclude that Spot from the map.

### Requirement 5: Shared Legend

**User Story:** As a user, I want a single legend that explains both the chart colours and the map marker shapes, so that I can interpret both visualisations without confusion.

#### Acceptance Criteria

1. WHEN the Spot_Freshness_Dashboard is activated, THE Spot_Freshness_Dashboard SHALL render a Shared_Legend in the `#dashboard-legend` container.
2. THE Shared_Legend SHALL display exactly three entries: Fresh, Aging, and Stale (the "No Data" / "no spots" category from the Waterway_Freshness_Dashboard SHALL be excluded).
3. Each Shared_Legend entry SHALL display the Marker_Shape for that Freshness_Category (circle for Fresh, triangle for Aging, square for Stale) filled with the corresponding Freshness_Colour as the legend indicator, alongside the category label. Plain colour swatches SHALL NOT be used.
4. THE Shared_Legend SHALL use the same Freshness_Colours as the Waterway_Freshness_Dashboard, resolved from `PaddelbuchColors` using the keys `green1` (Fresh), `warningYellow` (Aging), and `dangerRed` (Stale). No hex colour values SHALL be hardcoded; all colours MUST originate from the single source of truth in `_sass/settings/_paddelbuch_colours.scss`.
5. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL clear the `#dashboard-legend` container.

### Requirement 6: Spot Freshness Data Pipeline

**User Story:** As a developer, I want spot-level freshness data (including coordinates) available to the Spot Freshness Dashboard at runtime, so that the map can render markers without client-side recomputation of freshness categories.

#### Acceptance Criteria

1. THE `statistics_metrics_generator.rb` plugin (or a new dedicated generator) SHALL produce a data structure containing each non-rejected Spot's `slug`, `location` (`lat`, `lon`), and computed Freshness_Category.
2. THE data quality page SHALL embed the spot freshness map data as a JSON block accessible to the Spot_Freshness_Dashboard module.
3. THE `dashboard-data.js` module SHALL parse the spot freshness map data JSON block and expose it via `PaddelbuchDashboardData`.

### Requirement 7: Internationalisation

**User Story:** As a user viewing the page in a different locale, I want the Spot Freshness Dashboard labels to appear in the correct language, so that the dashboard is usable in all supported locales.

#### Acceptance Criteria

1. THE data quality page SHALL include a `<script type="application/json" id="spot-freshness-i18n">` block containing localised strings for the Spot_Freshness_Dashboard using `{% t %}` tags.
2. THE Spot_Freshness_Dashboard SHALL read localised strings from the `#spot-freshness-i18n` JSON block, falling back to German defaults when the block is absent or a key is missing.

### Requirement 8: Cleanup on Deactivation

**User Story:** As a user switching between dashboards, I want the Spot Freshness Dashboard to clean up all its rendered elements when I navigate away, so that no stale UI elements remain.

#### Acceptance Criteria

1. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL remove all map markers from the Dashboard_Map.
2. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL destroy all Chart.js instances.
3. WHEN the Spot_Freshness_Dashboard is deactivated, THE Spot_Freshness_Dashboard SHALL clear the `#dashboard-legend`, `#dashboard-content`, `#dashboard-title`, and `#dashboard-description` elements.

### Requirement 9: Content Security Policy Compliance

**User Story:** As a developer, I want the Spot Freshness Dashboard to work within the existing Content Security Policy, so that no CSP violations occur in production.

#### Acceptance Criteria

1. THE Spot_Freshness_Dashboard SHALL NOT introduce any inline `<script>` elements or inline event handlers. All JavaScript MUST be loaded from external files consistent with `script-src 'self'`.
2. THE Spot_Freshness_Dashboard SHALL NOT introduce any inline `style` attributes in HTML markup. All visual styling MUST be applied via CSS classes defined in external stylesheets consistent with `style-src 'self'`.
3. THE Spot_Freshness_Dashboard SHALL NOT require any changes to the Content-Security-Policy header defined in `deploy/frontend-deploy.yaml`.
4. THE Marker_Shape rendering approach SHALL use CSS classes or Leaflet APIs that apply styles programmatically (via `element.style` property assignment), which are not restricted by CSP `style-src`, rather than HTML `style` attributes.
