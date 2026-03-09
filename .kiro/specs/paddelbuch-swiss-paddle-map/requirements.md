# Requirements Document

## Introduction

Paddel Buch (PaddelBuch.ch) is a web application that provides an interactive map-based interface for Swiss paddle sports enthusiasts. The system displays paddle sports information including entry/exit spots, waterways (lakes and rivers), obstacles, protected areas, and event notices on an interactive map. The application supports bilingual content (German and English) and provides open data access through a JSON API.

## Glossary

- **Spot**: A location on a waterway where paddlers can enter, exit, rest, or access in emergencies
- **Waterway**: A body of water suitable for paddle sports, either a lake (See) or river (Fluss)
- **Obstacle**: A hazard or barrier on a waterway that may require portage (carrying the craft around)
- **Protected Area**: A designated zone with restrictions or special considerations for paddlers
- **Waterway Event Notice**: A temporary notice about conditions or events affecting a waterway
- **Portage**: The act of carrying a paddle craft around an obstacle
- **Paddle Craft Type**: Categories of paddle sports equipment (kayak, canoe, SUP, etc.)
- **Spot Type**: Classification of spots (Entry & Exit, Entry Only, Exit Only, Rest, Emergency Exit, No Entry)
- **GeoJSON**: A format for encoding geographic data structures
- **Leaflet**: An open-source JavaScript library for interactive maps
- **Contentful**: A headless CMS used as the data source
- **Map_System**: The interactive map component responsible for rendering the Leaflet map, displaying markers, GeoJSON layers, popups, and layer controls
- **Navigation_System**: The component responsible for site navigation, menu rendering, and routing between pages
- **Detail_System**: The component responsible for rendering detail pages for spots, waterways, obstacles, and event notices
- **List_System**: The component responsible for rendering list pages (lakes list, rivers list)
- **I18n_System**: The internationalization system responsible for language switching, content filtering by locale, and date formatting
- **API_System**: The system responsible for generating and serving JSON data files for the open data API
- **Layout_System**: The component responsible for responsive page layout, header rendering, and container structure
- **Content_System**: The system responsible for rendering static content pages from Contentful CMS
- **URL_System**: The system responsible for generating human-readable, persistent URLs for detail pages using slug-based routing
- **Data_Loader**: The client-side module responsible for dynamically loading map data based on viewport bounds and zoom level
- **Spatial_Tile**: A pre-generated JSON file containing map data for a specific geographic region, used for efficient viewport-based data loading
- **Deployment_System**: The AWS Amplify-based CI/CD system responsible for building and deploying the site to the eu-central-1 region

## Requirements

### Requirement 1: Interactive Map Display

**User Story:** As a paddler, I want to view an interactive map of Switzerland showing paddle sports locations, so that I can explore and plan my paddling activities.

#### Acceptance Criteria

1. WHEN a user loads the home page THEN the Map_System SHALL display an interactive map centered on Switzerland with bounds covering the Swiss territory
2. WHEN the map loads THEN the Map_System SHALL display a tile layer from Mapbox with proper attribution
3. WHEN the map is displayed THEN the Map_System SHALL provide zoom controls positioned at the bottom-right of the map
4. WHEN a user interacts with the map THEN the Map_System SHALL allow panning and zooming within the Swiss territory bounds
5. WHEN the map is displayed THEN the Map_System SHALL provide a locate control that allows users to find their current position

### Requirement 2: Spot Visualization and Filtering

**User Story:** As a paddler, I want to see different types of spots on the map with distinct markers, so that I can quickly identify entry points, exit points, and rest areas.

#### Acceptance Criteria

1. WHEN spots are loaded THEN the Map_System SHALL display Entry & Exit spots with a distinct entry-exit marker icon
2. WHEN spots are loaded THEN the Map_System SHALL display Entry Only spots with a distinct entry marker icon
3. WHEN spots are loaded THEN the Map_System SHALL display Exit Only spots with a distinct exit marker icon
4. WHEN spots are loaded THEN the Map_System SHALL display Rest spots with a distinct rest marker icon
5. WHEN spots are loaded THEN the Map_System SHALL display Emergency Exit spots with a distinct emergency marker icon
6. WHEN spots are loaded THEN the Map_System SHALL display No Entry (rejected) spots with a distinct no-entry marker icon
7. WHEN the map is displayed THEN the Map_System SHALL provide layer controls allowing users to toggle visibility of each spot type
8. WHEN a spot type layer is toggled off THEN the Map_System SHALL hide all markers of that spot type from the map

### Requirement 3: Spot Information Display

**User Story:** As a paddler, I want to view detailed information about a spot, so that I can determine if it meets my needs for my paddling trip.

#### Acceptance Criteria

1. WHEN a user clicks on a spot marker THEN the Map_System SHALL display a popup containing the spot name, description excerpt, GPS coordinates, approximate address, and paddle craft types
2. WHEN a popup is displayed THEN the Map_System SHALL provide a copy button for GPS coordinates that copies the coordinates to the clipboard
3. WHEN a popup is displayed THEN the Map_System SHALL provide a copy button for the approximate address that copies the address to the clipboard
4. WHEN a popup is displayed THEN the Map_System SHALL provide a navigation button that opens external navigation to the spot location
5. WHEN a user clicks "More details" in a popup THEN the Navigation_System SHALL navigate to the spot detail page
6. WHEN a user views a spot detail page THEN the Detail_System SHALL display the full description, GPS coordinates, approximate address, waterway link, paddle craft types, and last updated timestamp
7. WHEN a spot is marked as rejected THEN the Detail_System SHALL display the rejection reason instead of standard spot information

### Requirement 4: Waterway Display and Navigation

**User Story:** As a paddler, I want to browse waterways by type (lakes or rivers), so that I can find suitable paddling locations.

#### Acceptance Criteria

1. WHEN a user accesses the Lakes menu THEN the Navigation_System SHALL display a dropdown with the 10 largest lakes by area and a link to view all lakes
2. WHEN a user accesses the Rivers menu THEN the Navigation_System SHALL display a dropdown with the 10 longest rivers by length and a link to view all rivers
3. WHEN a user views the lakes list page THEN the List_System SHALL display all lakes sorted alphabetically by name
4. WHEN a user views the rivers list page THEN the List_System SHALL display all rivers sorted alphabetically by name
5. WHEN a user clicks on a waterway THEN the Navigation_System SHALL navigate to the waterway detail page
6. WHEN a user views a waterway detail page THEN the Detail_System SHALL display a map bounded to the waterway geometry and a list of active event notices for that waterway

### Requirement 5: Obstacle Visualization

**User Story:** As a paddler, I want to see obstacles on the map, so that I can plan safe routes and know where portage may be required.

#### Acceptance Criteria

1. WHEN obstacles are loaded THEN the Map_System SHALL display obstacle geometries as red-colored GeoJSON polygons on the map
2. WHEN an obstacle has a portage route THEN the Map_System SHALL display the portage route as a purple dashed line
3. WHEN a user clicks on an obstacle THEN the Map_System SHALL display a popup with the obstacle name and portage possibility status
4. WHEN a user views an obstacle detail page THEN the Detail_System SHALL display the obstacle type, GPS coordinates, waterway link, description, and last updated timestamp
5. WHEN an obstacle has portage information THEN the Detail_System SHALL display the portage distance, description, exit spot link, and re-entry spot link

### Requirement 6: Protected Area Visualization

**User Story:** As a paddler, I want to see protected areas on the map, so that I can be aware of zones with special restrictions or considerations.

#### Acceptance Criteria

1. WHEN protected areas are loaded THEN the Map_System SHALL display protected area geometries as yellow-colored semi-transparent GeoJSON polygons with dashed borders
2. WHEN a user clicks on a protected area THEN the Map_System SHALL display a popup with the protected area name and type

### Requirement 7: Waterway Event Notice Display

**User Story:** As a paddler, I want to see current event notices on the map, so that I can be aware of temporary conditions affecting waterways.

#### Acceptance Criteria

1. WHEN waterway event notices are loaded THEN the Map_System SHALL display only notices where the end date is in the future
2. WHEN an active event notice is displayed THEN the Map_System SHALL show both a marker at the notice location and a yellow semi-transparent polygon for the affected area
3. WHEN a user clicks on an event notice marker or area THEN the Map_System SHALL display a popup with the notice name, description excerpt, start date, and end date
4. WHEN a user views an event notice detail page THEN the Detail_System SHALL display the full description, start date, end date, and last updated timestamp
5. WHEN a waterway detail page is displayed THEN the Detail_System SHALL list all active event notices affecting that waterway

### Requirement 8: Internationalization Support

**User Story:** As a paddler, I want to use the application in my preferred language (German or English), so that I can understand all content.

#### Acceptance Criteria

1. WHEN a user loads the application THEN the I18n_System SHALL default to German language
2. WHEN a user selects a language from the language dropdown THEN the I18n_System SHALL switch all UI text and content to the selected language
3. WHEN content is displayed THEN the I18n_System SHALL filter data to show only content matching the current language locale
4. WHEN a user navigates to a page THEN the I18n_System SHALL maintain the selected language across page navigation
5. WHEN dates are displayed THEN the I18n_System SHALL format dates according to the selected language locale (en-GB for English, de-CH for German)

### Requirement 9: Open Data API

**User Story:** As a data consumer, I want to access Paddel Buch data through a JSON API, so that I can integrate the data into my own applications.

#### Acceptance Criteria

1. WHEN the API page is accessed THEN the API_System SHALL display download links for all fact tables (Spots, Waterway Events, Obstacles, Protected Areas, Waterways) as complete dataset files
2. WHEN the API page is accessed THEN the API_System SHALL display download links for all dimension tables (Data License Types, Data Source Types, Obstacle Types, Paddle Craft Types, Paddling Environment Types, Protected Area Types, Spot Types)
3. WHEN the API page is accessed THEN the API_System SHALL display the last updated timestamp for each table
4. WHEN a full dataset JSON file is requested THEN the API_System SHALL return all data for that entity type sorted by slug in ascending order
5. WHEN the last update index is requested THEN the API_System SHALL return a JSON file listing all tables with their last update timestamps
6. WHEN the site is built THEN the API_System SHALL generate both full dataset files (for data consumers) and spatial tile files (for the map interface)

### Requirement 10: Responsive Layout

**User Story:** As a paddler, I want to use the application on different devices, so that I can access information on my phone, tablet, or computer.

#### Acceptance Criteria

1. WHEN the application is viewed on a large screen THEN the Layout_System SHALL display the map and detail panels side by side
2. WHEN the application is viewed on a small screen THEN the Layout_System SHALL stack the map and detail panels vertically
3. WHEN the navigation menu is viewed on a small screen THEN the Layout_System SHALL collapse the menu into a hamburger toggle
4. WHEN a user expands the collapsed menu THEN the Layout_System SHALL display all navigation options

### Requirement 11: Navigation Assistance

**User Story:** As a paddler, I want to easily navigate to a spot location, so that I can find my way to paddle sports locations.

#### Acceptance Criteria

1. WHEN a navigate button is clicked THEN the Navigation_System SHALL open an external mapping application with directions to the specified coordinates
2. WHEN GPS coordinates are displayed THEN the Navigation_System SHALL provide a copy-to-clipboard function for easy sharing

### Requirement 12: Static Content Pages

**User Story:** As a user, I want to access informational pages about the project and data licensing, so that I can understand how to use the data and learn about the project.

#### Acceptance Criteria

1. WHEN a user accesses the Open Data menu THEN the Navigation_System SHALL display links to data-related static pages and the API page
2. WHEN a user accesses the About menu THEN the Navigation_System SHALL display links to about-related static pages
3. WHEN a user views a static page THEN the Content_System SHALL render the page content from Contentful CMS

### Requirement 13: Human-Readable URLs

**User Story:** As a paddler, I want detail pages to have human-readable static URLs, so that I can easily reference and share specific pages with others.

#### Acceptance Criteria

1. WHEN a spot detail page is generated THEN the URL_System SHALL create a URL using the pattern /einstiegsorte/{slug} where slug is a human-readable identifier
2. WHEN a waterway detail page is generated THEN the URL_System SHALL create a URL using the pattern /gewaesser/{slug} where slug is a human-readable identifier
3. WHEN an obstacle detail page is generated THEN the URL_System SHALL create a URL using the pattern /hindernisse/{slug} where slug is a human-readable identifier
4. WHEN an event notice detail page is generated THEN the URL_System SHALL create a URL using the pattern /gewaesserereignisse/{slug} where slug is a human-readable identifier
5. WHEN a static content page is generated THEN the URL_System SHALL create a URL using the pattern /{menu}/{slug} where menu and slug are human-readable identifiers
6. WHEN a URL is shared THEN the URL_System SHALL ensure the URL remains persistent and accessible as long as the content exists

### Requirement 14: Dynamic Map Data Loading

**User Story:** As a paddler, I want the map to load data efficiently, so that I can quickly view relevant information without waiting for all data to load.

#### Acceptance Criteria

1. WHEN a page with a map loads THEN the Data_Loader SHALL load only spots and event notices visible within the initial map viewport
2. WHEN a user pans the map to a new area THEN the Data_Loader SHALL load spots and event notices for the newly visible viewport area
3. WHEN a user zooms in to zoom level 12 or higher THEN the Data_Loader SHALL load obstacles and protected areas for the visible viewport
4. WHEN a user zooms out below zoom level 12 THEN the Map_System SHALL hide obstacles and protected areas from the map display
5. WHEN data has been loaded for a viewport area THEN the Data_Loader SHALL cache the data to prevent redundant network requests when returning to that area
6. WHEN the user rapidly pans or zooms THEN the Data_Loader SHALL debounce data requests to prevent excessive network traffic

### Requirement 15: Spatial Data Organization

**User Story:** As a system administrator, I want map data organized into spatial tiles, so that the application can efficiently load only the data needed for the current viewport.

#### Acceptance Criteria

1. WHEN the site is built THEN the API_System SHALL generate spatial tile files organizing data by geographic region
2. WHEN spatial tiles are generated THEN the API_System SHALL ensure each data entity appears in exactly one tile based on its location
3. WHEN spatial tiles are generated THEN the API_System SHALL create a tile index file listing all available tiles with their geographic bounds
4. WHEN spatial tiles are generated THEN the API_System SHALL create separate tile sets for each supported language (German and English)
5. WHEN spatial tiles are generated THEN the API_System SHALL create separate tile sets for each data layer (spots, notices, obstacles, protected areas)


### Requirement 16: Build and Deployment

**User Story:** As a site administrator, I want the site to be automatically built and deployed when content changes, so that updates are published without manual intervention.

#### Acceptance Criteria

1. WHEN code is pushed to the main branch THEN the Deployment_System SHALL automatically trigger a build and deployment
2. WHEN content is published in Contentful THEN the Deployment_System SHALL automatically trigger a rebuild via webhook
3. WHEN a build is triggered THEN the Deployment_System SHALL execute the Jekyll build process in AWS Amplify in the eu-central-1 region
4. WHEN a build completes successfully THEN the Deployment_System SHALL deploy the generated static files to the CDN
5. WHEN static assets are deployed THEN the Deployment_System SHALL configure appropriate cache headers for optimal performance
