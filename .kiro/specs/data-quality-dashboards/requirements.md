# Requirements Document

## Introduction

Data Quality Dashboards is a new feature for the Paddelbuch site that provides users with visibility into the quality of spot data across Swiss waterways. The feature introduces two map-based dashboards — Data Freshness and Waterway Coverage — accessible from a single page under the existing "Open Data" navigation menu. Each dashboard renders waterway geometries on an OpenStreetMap Positron base map, coloured according to data quality metrics derived from existing spot and waterway data. The architecture is designed to be extensible for additional dashboards in the future.

## Glossary

- **Dashboard_Page**: The single page that hosts all data quality dashboards and provides a mechanism for switching between them
- **Dashboard**: A self-contained visualisation module that presents a specific data quality metric. A Dashboard may render as a map, table, graph, or any other visual format
- **Data_Freshness_Dashboard**: A Dashboard that visualises the median age of spots per waterway using a traffic light colour gradient on waterway geometries
- **Waterway_Coverage_Dashboard**: A Dashboard that visualises how much of each waterway's shoreline has spots associated with it
- **Freshness_Calculator**: The JavaScript module that computes the median age of spots for a given waterway based on spot `updatedAt` timestamps
- **Coverage_Calculator**: The JavaScript module that computes coverage areas around spots and determines which portions of a waterway geometry are covered
- **Dashboard_Map**: A Leaflet.js map instance using the OpenStreetMap Positron tile style, distinct from the main site map
- **Median_Age**: The median of the ages (in days) of all spots associated with a waterway, where age is calculated as the difference between the current date and the spot's `updatedAt` timestamp
- **Coverage_Radius**: A 2 km radius circle around each spot's location, used to determine which portions of a waterway geometry are considered "covered"
- **Positron_Tiles**: The OpenStreetMap Positron map style (https://github.com/openmaptiles/positron-gl-style), a light-themed base map
- **Waterway_Geometry**: The GeoJSON geometry of a waterway — LineString for rivers, Polygon for lakes
- **Spot**: A paddle sports access point with location coordinates, an `updatedAt` timestamp, and a `waterway_slug` linking it to a waterway
- **Waterway**: A body of water (river or lake) with a name, slug, and GeoJSON geometry
- **Dashboard_Switcher**: The UI control that allows users to switch between available dashboards on the Dashboard_Page
- **Colour_File**: The central SCSS colour definitions file (`_sass/settings/_paddelbuch_colours.scss`) and its JS-accessible counterpart via the `color-vars.html` include

## Requirements

### Requirement 1: Dashboard Page and Navigation

**User Story:** As a Paddelbuch user, I want to access data quality dashboards from the site navigation, so that I can explore data quality metrics for Swiss waterways.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL be accessible via a URL path under the "offene-daten" section of the site
2. WHEN a user opens the "Open Data" navigation menu, THE Dashboard_Page SHALL appear as a menu item in the dropdown
3. THE Dashboard_Page SHALL support both German and English locales using the existing `jekyll-multiple-languages-plugin` translation system
4. THE Dashboard_Page SHALL be reachable via the existing language switcher in the navbar, consistent with how other pages on the site handle locale switching
5. ALL user-facing text on the Dashboard_Page — including the Dashboard_Switcher labels, legend labels, tooltip content, and any date or number formatting — SHALL be localised using the existing `{% t %}` translation tag and `_i18n/` translation files
6. THE Dashboard_Page SHALL use the site's default layout to maintain visual consistency with the rest of the Paddelbuch site
5. THE Dashboard_Page SHALL include a Dashboard_Switcher that allows the user to select which Dashboard to view
6. WHEN the Dashboard_Page loads, THE Dashboard_Page SHALL display the Data_Freshness_Dashboard by default
7. WHEN the user selects a different Dashboard via the Dashboard_Switcher, THE Dashboard_Page SHALL display the selected Dashboard and hide the previously active Dashboard

### Requirement 2: Dashboard Map Base Layer

**User Story:** As a Paddelbuch user, I want the data quality dashboards to use a clean, light-themed base map, so that the coloured waterway overlays are clearly visible.

#### Acceptance Criteria

1. THE Dashboard_Map SHALL use Positron_Tiles as the base tile layer, distinct from the Mapbox tiles used on other site pages
2. THE Dashboard_Map SHALL be centred on Switzerland with the same default centre coordinates and zoom level as the main site map (lat: 46.801111, lon: 8.226667, zoom: 8)
3. THE Dashboard_Map SHALL restrict panning to the same bounds as the main site map (north: 47.8, south: 45.8, east: 10.5, west: 5.9)
4. THE Dashboard_Map SHALL include zoom controls positioned in the bottom-right corner, consistent with the main site map
5. THE Dashboard_Map SHALL include appropriate OpenStreetMap attribution for the Positron tile layer

### Requirement 3: Data Freshness Dashboard

**User Story:** As a Paddelbuch user, I want to see how fresh the spot data is for each waterway, so that I can understand which waterways have recently updated information.

#### Acceptance Criteria

1. THE Data_Freshness_Dashboard SHALL render each Waterway_Geometry as a coloured line or polygon outline on the Dashboard_Map
2. THE Freshness_Calculator SHALL compute the Median_Age for each waterway by calculating the median of the ages of all Spots associated with that waterway via `waterway_slug`
3. THE Freshness_Calculator SHALL calculate each spot's age as the number of days between the current date and the spot's `updatedAt` timestamp
4. THE Data_Freshness_Dashboard SHALL colour each Waterway_Geometry using a continuous gradient interpolated between three anchor colours from the Colour_File: `$green-1` at 0 days, `$warning-yellow` at 1095 days (3 years), and `$danger-red` at 1826 days (5 years) or above
5. WHEN the Median_Age is between 0 and 1095 days, THE Data_Freshness_Dashboard SHALL interpolate the colour linearly between `$green-1` and `$warning-yellow`
6. WHEN the Median_Age is between 1095 and 1826 days, THE Data_Freshness_Dashboard SHALL interpolate the colour linearly between `$warning-yellow` and `$danger-red`
7. WHEN the Median_Age is 1826 days or above, THE Data_Freshness_Dashboard SHALL use `$danger-red`
8. IF a waterway has zero associated spots, THEN THE Data_Freshness_Dashboard SHALL render the Waterway_Geometry using the `$purple-1` colour from the Colour_File to indicate no data is available
9. THE Data_Freshness_Dashboard SHALL include a legend explaining the traffic light colour scheme and the corresponding Median_Age thresholds
10. WHEN a user clicks or hovers over a Waterway_Geometry, THE Data_Freshness_Dashboard SHALL display a tooltip or popup showing the waterway name, the number of associated spots, and the computed Median_Age in a human-readable format

### Requirement 4: Waterway Coverage Dashboard

**User Story:** As a Paddelbuch user, I want to see how much of each waterway's shoreline has spots nearby, so that I can identify waterways that need more data collection.

#### Acceptance Criteria

1. THE Waterway_Coverage_Dashboard SHALL render each Waterway_Geometry on the Dashboard_Map
2. THE Coverage_Calculator SHALL determine coverage by computing a 2 km Coverage_Radius circle around each Spot's location
3. WHEN a portion of a Waterway_Geometry falls within the Coverage_Radius of at least one associated Spot, THE Waterway_Coverage_Dashboard SHALL colour that portion green using the `$green-1` colour from the Colour_File
4. WHEN a portion of a Waterway_Geometry falls outside the Coverage_Radius of all associated Spots, THE Waterway_Coverage_Dashboard SHALL colour that portion red using the `$danger-red` colour from the Colour_File
5. IF a waterway has zero associated spots, THEN THE Waterway_Coverage_Dashboard SHALL render the entire Waterway_Geometry in red using the `$danger-red` colour from the Colour_File
6. THE Waterway_Coverage_Dashboard SHALL include a legend explaining the green (covered) and red (not covered) colour scheme
7. WHEN a user clicks or hovers over a Waterway_Geometry, THE Waterway_Coverage_Dashboard SHALL display a tooltip or popup showing the waterway name and the number of associated spots

### Requirement 5: Data Source Compatibility

**User Story:** As a developer, I want the dashboards to use existing data files without additional API calls, so that the feature integrates seamlessly with the current build pipeline.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL source all spot data from the existing `_data/spots.yml` file (exposed via the site's data pipeline)
2. THE Dashboard_Page SHALL source all waterway data from the existing `_data/waterways.yml` file (exposed via the site's data pipeline)
3. THE Dashboard_Page SHALL NOT make any additional Contentful API calls at build time or runtime
4. THE Dashboard_Page SHALL consume spot and waterway data using the existing data structures produced by the ContentfulFetcher plugin and ContentfulMappers

### Requirement 6: Visual Design Consistency

**User Story:** As a Paddelbuch user, I want the dashboards to look consistent with the rest of the site, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL use colours exclusively from the Colour_File for all UI elements, including the Dashboard_Switcher, legends, and tooltips
2. THE Dashboard_Page SHALL use the same font families and text styles as the rest of the Paddelbuch site
3. THE Dashboard_Switcher SHALL be styled consistently with existing Bootstrap-based UI components on the site
4. THE Dashboard_Map container SHALL be responsive and fill the available page width, consistent with map containers on other Paddelbuch pages
5. ALL map popups on the Dashboard_Page SHALL use the same styling (layout, colours, typography, and Leaflet popup CSS classes) as map popups used elsewhere on the Paddelbuch site

### Requirement 7: Extensibility

**User Story:** As a developer, I want the dashboard architecture to support adding new dashboards in the future — including non-map visualisations such as tables or graphs — so that the feature can grow without major refactoring.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL use a modular architecture where each Dashboard is a self-contained module with a consistent interface that supports activation, deactivation, and rendering into a container element
2. WHEN a new Dashboard module is added, THE Dashboard_Switcher SHALL automatically include the new Dashboard as a selectable option without requiring changes to the switcher logic
3. THE Dashboard module interface SHALL NOT assume a specific visualisation type — a Dashboard MAY render as a map layer, a table, a chart, or any other visual format
4. WHEN a map-based Dashboard is activated, THE Dashboard_Page SHALL display the shared Dashboard_Map instance and the Dashboard SHALL add its layers to it
5. WHEN a non-map Dashboard is activated, THE Dashboard_Page SHALL hide the Dashboard_Map and display the Dashboard's own content container instead
6. WHEN a Dashboard is deactivated, THE Dashboard SHALL clean up its rendered content (map layers, DOM elements, or event listeners) so that switching between dashboards does not leak state

### Requirement 8: Deployment Compatibility

**User Story:** As a developer, I want the dashboards to deploy on the existing AWS Amplify infrastructure without breaking the build, so that no infrastructure changes are required.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL be compatible with the existing Jekyll 4.3 static site build process
2. THE Dashboard_Page SHALL be compatible with the existing AWS Amplify deployment pipeline defined in `deploy/frontend-deploy.yaml`
3. IF the Positron_Tiles require additional JavaScript dependencies (such as MapLibre GL JS or vector tile libraries), THEN THE Dashboard_Page SHALL include those dependencies as vendored assets in the `assets/js/vendor/` directory, consistent with the existing approach for Leaflet.js and Bootstrap
4. THE Dashboard_Page SHALL comply with the existing Content-Security-Policy headers defined in the Amplify CloudFormation template

### Requirement 9: Freshness Calculation Correctness

**User Story:** As a developer, I want the freshness calculation to be correct and testable, so that the dashboard displays accurate data.

#### Acceptance Criteria

1. THE Freshness_Calculator SHALL accept an array of spot `updatedAt` timestamps and return the median age in days
2. WHEN the number of timestamps is odd, THE Freshness_Calculator SHALL return the middle value after sorting
3. WHEN the number of timestamps is even, THE Freshness_Calculator SHALL return the average of the two middle values after sorting
4. WHEN the array of timestamps is empty, THE Freshness_Calculator SHALL return null to indicate no data
5. FOR ALL non-empty arrays of valid timestamps, computing the median age and then verifying it lies between the minimum and maximum ages in the array SHALL hold true (invariant property)

### Requirement 10: Coverage Calculation Correctness

**User Story:** As a developer, I want the coverage calculation to be correct and testable, so that the dashboard displays accurate coverage information.

#### Acceptance Criteria

1. THE Coverage_Calculator SHALL accept a Waterway_Geometry and an array of Spot locations, and return segments of the geometry classified as covered or uncovered
2. THE Coverage_Calculator SHALL classify a point on the Waterway_Geometry as covered when the point is within 2 km of at least one Spot location
3. THE Coverage_Calculator SHALL use the Haversine formula or equivalent geodesic distance calculation for determining distances between coordinates
4. WHEN the array of Spot locations is empty, THE Coverage_Calculator SHALL classify the entire Waterway_Geometry as uncovered
5. FOR ALL single-spot inputs, the covered portion of a Waterway_Geometry SHALL be a contiguous segment centred on the point of the geometry nearest to the Spot (metamorphic property)
