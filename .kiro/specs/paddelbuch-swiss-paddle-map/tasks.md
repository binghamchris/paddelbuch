# Implementation Plan: Jekyll Migration

This plan covers the complete rebuild of Paddel Buch from Gatsby to Jekyll, implementing all requirements from the design document.

## Phase 1: Project Setup and Core Infrastructure

- [x] 1. Initialize Jekyll project structure
  - [x] 1.1 Create Jekyll project with Gemfile, _config.yml, and directory structure
    - Initialize Gemfile with jekyll, jekyll-contentful-data-import, jekyll-multiple-languages-plugin
    - Create _config.yml with site metadata, collections configuration, and plugin settings
    - Create directory structure: _layouts/, _includes/, _data/, _spots/, _waterways/, _obstacles/, _notices/, assets/
    - Create .ruby-version file specifying ruby-3.3.0
    - _Requirements: 16.1, 16.3_

  - [x] 1.2 Configure Contentful data plugin
    - Set up jekyll-contentful-data-import plugin configuration
    - Create content type mappings for Spot, Waterway, Obstacle, ProtectedArea, WaterwayEventNotice
    - Configure environment variables for CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN, CONTENTFUL_ENVIRONMENT
    - _Requirements: 1.1, 2.1-2.6_

  - [x] 1.3 Configure internationalization (i18n)
    - Set up jekyll-multiple-languages-plugin with 'de' as default and 'en' as secondary
    - Create _i18n/de.yml and _i18n/en.yml locale files with UI translations
    - Configure language switching URL structure
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.4 Write property test for locale content filtering
    - **Property 18: Locale Content Filtering**
    - **Validates: Requirements 8.3**

- [x] 2. Create base layout and styling infrastructure
  - [x] 2.1 Create default layout template
    - Create _layouts/default.html with HTML structure, meta tags, Bootstrap grid
    - Include header, content area, and footer sections
    - Add Leaflet.js and Bootstrap CSS/JS dependencies
    - Set HTML lang attribute based on current language
    - _Requirements: 10.1, 10.2_

  - [x] 2.2 Create header include with navigation
    - Create _includes/header.html with responsive navbar
    - Implement Lakes dropdown (10 largest by area + "More lakes" link)
    - Implement Rivers dropdown (10 longest by length + "More rivers" link)
    - Implement Open Data and About dropdowns from static pages
    - Add language switcher dropdown
    - Implement Bootstrap collapse for mobile
    - _Requirements: 4.1, 4.2, 10.3, 10.4, 12.1, 12.2_

  - [x] 2.3 Write property test for waterway menu sorting
    - **Property 5: Waterway Menu Sorting and Limiting**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 2.4 Migrate SCSS stylesheets
    - Copy and adapt existing SCSS from src/assets/stylesheets/
    - Configure Jekyll SASS compilation
    - Ensure responsive breakpoints work correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

## Phase 2: Map Infrastructure

- [x] 3. Implement core map functionality
  - [x] 3.1 Create map initialization include
    - Create _includes/map-init.html with Leaflet map setup
    - Configure Mapbox tile layer with attribution
    - Set Switzerland center (46.801111, 8.226667) and bounds
    - Add zoom controls at bottom-right position
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement locate control
    - Add Leaflet.locatecontrol plugin integration
    - Configure locate button for user position finding
    - _Requirements: 1.5_

  - [x] 3.3 Create marker styles JavaScript module
    - Create assets/js/marker-styles.js with Leaflet icon configurations
    - Define icons for: Entry/Exit, Entry Only, Exit Only, Rest, Emergency, No Entry, Event Notice
    - Migrate existing marker SVGs to Jekyll assets
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.4 Write property test for spot marker icon assignment
    - **Property 1: Spot Marker Icon Assignment**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

  - [x] 3.5 Create layer styles JavaScript module
    - Create assets/js/layer-styles.js with GeoJSON styling
    - Define styles for: Lake, Protected Area (yellow/dashed), Obstacle (red), Portage Route (purple/dashed), Event Notice Area (yellow/semi-transparent)
    - _Requirements: 5.1, 5.2, 6.1, 7.2_

- [x] 4. Implement layer controls and filtering
  - [x] 4.1 Create layer control include
    - Implement Leaflet LayersControl for toggling spot types
    - Create layer groups for each spot type
    - Add event notice layer toggle
    - Add rejected spots (No Entry) layer toggle (unchecked by default)
    - _Requirements: 2.7, 2.8_

  - [x] 4.2 Implement locale-based data filtering
    - Filter all map data by current language locale
    - Ensure markers and layers only show content matching locale
    - _Requirements: 8.3_

- [x] 5. Checkpoint - Verify map infrastructure
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Spot Functionality

- [x] 6. Implement spot markers and popups
  - [x] 6.1 Create spot popup include
    - Create _includes/spot-popup.html with spot information display
    - Show: spot icon, name, description excerpt (first paragraph), GPS coordinates, approximate address, paddle craft types
    - Add copy buttons for GPS and address
    - Add navigation button and "More details" link
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 Write property test for spot popup content
    - **Property 2: Spot Popup Contains Required Information**
    - **Validates: Requirements 3.1**

  - [x] 6.3 Create spot icon include
    - Create _includes/spot-icon.html with SVG rendering based on spot type
    - Support light (popup) and dark (detail pane) variants
    - _Requirements: 2.1-2.6_

  - [x] 6.4 Create navigate button include
    - Create _includes/navigate-btn.html for external navigation
    - Open external mapping application with coordinates
    - _Requirements: 11.1_

  - [x] 6.5 Create clipboard JavaScript module
    - Create assets/js/clipboard.js for copy-to-clipboard functionality
    - Handle GPS coordinates and address copying
    - _Requirements: 3.2, 3.3, 11.2_

- [x] 7. Implement spot detail pages
  - [x] 7.1 Create spot detail layout
    - Create _layouts/spot.html with map (8 cols) + details panel (4 cols)
    - Display: full description, GPS, approximate address, waterway link, paddle craft types, last updated timestamp
    - Configure collection permalink: /einstiegsorte/:slug/
    - _Requirements: 3.6, 13.1_

  - [x] 7.2 Write property test for spot detail page content
    - **Property 3: Spot Detail Page Contains Required Information**
    - **Validates: Requirements 3.6**

  - [x] 7.3 Implement rejected spot handling
    - Create conditional rendering for rejected spots
    - Display rejection reason instead of standard spot information
    - Use rejection icon and appropriate styling
    - _Requirements: 3.7_

  - [x] 7.4 Write property test for rejected spot display
    - **Property 4: Rejected Spot Shows Rejection Reason**
    - **Validates: Requirements 3.7**

  - [x] 7.5 Create rejected spot popup include
    - Create _includes/rejected-popup.html for no-entry spots
    - Show name and rejection reason
    - _Requirements: 3.7_

- [x] 8. Checkpoint - Verify spot functionality
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Waterway Functionality

- [x] 9. Implement waterway list pages
  - [x] 9.1 Create lakes list page
    - Create pages for /gewaesser/seen path
    - Query all waterways with paddlingEnvironmentType 'see'
    - Sort alphabetically by name
    - Display as linked table
    - _Requirements: 4.3_

  - [x] 9.2 Create rivers list page
    - Create pages for /gewaesser/fluesse path
    - Query all waterways with paddlingEnvironmentType 'fluss'
    - Sort alphabetically by name
    - Display as linked table
    - _Requirements: 4.4_

  - [x] 9.3 Write property test for waterway list sorting
    - **Property 6: Waterway List Alphabetical Sorting**
    - **Validates: Requirements 4.3, 4.4**

- [x] 10. Implement waterway detail pages
  - [x] 10.1 Create waterway detail layout
    - Create _layouts/waterway.html with bounded map + details panel
    - Calculate map bounds from waterway GeoJSON geometry
    - Display waterway name and event notices list
    - Configure collection permalink: /gewaesser/:slug/
    - _Requirements: 4.5, 4.6, 13.2_

  - [x] 10.2 Write property test for waterway map bounds
    - **Property 7: Waterway Detail Map Bounds**
    - **Validates: Requirements 4.6**

  - [x] 10.3 Create event notice list include
    - Create _includes/event-list.html for waterway event notices
    - Filter to show only notices affecting the waterway with future end dates
    - Display notice name (linked) and approximate end date
    - Format dates according to locale
    - _Requirements: 7.5_

  - [x] 10.4 Write property test for waterway event notice filtering
    - **Property 17: Waterway Event Notice List Filtering**
    - **Validates: Requirements 7.5**

## Phase 5: Obstacle Functionality

- [x] 11. Implement obstacle visualization
  - [x] 11.1 Render obstacle GeoJSON layers
    - Display obstacle geometries as red polygons on map
    - Apply obstacle styling from layer-styles.js
    - _Requirements: 5.1_

  - [x] 11.2 Render portage routes conditionally
    - Display portage route as purple dashed line when defined
    - Only render if obstacle has portageRoute data
    - _Requirements: 5.2_

  - [x] 11.3 Write property test for portage route rendering
    - **Property 8: Obstacle Portage Route Conditional Rendering**
    - **Validates: Requirements 5.2**

  - [x] 11.4 Create obstacle popup include
    - Create _includes/obstacle-popup.html
    - Display obstacle name and portage possibility status
    - Link to obstacle detail page
    - _Requirements: 5.3_

  - [x] 11.5 Write property test for obstacle popup content
    - **Property 9: Obstacle Popup Contains Required Information**
    - **Validates: Requirements 5.3**

- [x] 12. Implement obstacle detail pages
  - [x] 12.1 Create obstacle detail layout
    - Create _layouts/obstacle.html with bounded map + details panel
    - Display: obstacle type, GPS (center of geometry), waterway link, description, last updated
    - Configure collection permalink: /hindernisse/:slug/
    - _Requirements: 5.4, 13.3_

  - [x] 12.2 Write property test for obstacle detail page content
    - **Property 10: Obstacle Detail Page Contains Required Information**
    - **Validates: Requirements 5.4**

  - [x] 12.3 Implement portage information section
    - Display portage distance, description, exit spot link, re-entry spot link
    - Only show when portage information exists
    - _Requirements: 5.5_

  - [x] 12.4 Write property test for portage information display
    - **Property 11: Obstacle Portage Information Display**
    - **Validates: Requirements 5.5**

- [x] 13. Checkpoint - Verify obstacle functionality
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Protected Areas and Event Notices

- [x] 14. Implement protected area visualization
  - [x] 14.1 Render protected area GeoJSON layers
    - Display protected areas as yellow semi-transparent polygons with dashed borders
    - Apply protected area styling from layer-styles.js
    - _Requirements: 6.1_

  - [x] 14.2 Create protected area popup
    - Display protected area name and type in popup
    - _Requirements: 6.2_

  - [x] 14.3 Write property test for protected area popup content
    - **Property 12: Protected Area Popup Contains Required Information**
    - **Validates: Requirements 6.2**

- [x] 15. Implement waterway event notice functionality
  - [x] 15.1 Filter event notices by end date
    - Only display notices where endDate is in the future
    - Implement date comparison logic
    - _Requirements: 7.1_

  - [x] 15.2 Write property test for event notice date filtering
    - **Property 13: Event Notice Date Filtering**
    - **Validates: Requirements 7.1**

  - [x] 15.3 Render event notice markers and areas
    - Display marker at notice location
    - Display affected area as yellow semi-transparent polygon
    - Both marker and area should show popup on click
    - _Requirements: 7.2_

  - [x] 15.4 Write property test for event notice dual rendering
    - **Property 14: Event Notice Dual Rendering**
    - **Validates: Requirements 7.2**

  - [x] 15.5 Create event notice popup include
    - Create _includes/event-popup.html
    - Display: name, description excerpt, start date, end date
    - Link to event notice detail page
    - _Requirements: 7.3_

  - [x] 15.6 Write property test for event notice popup content
    - **Property 15: Event Notice Popup Contains Required Information**
    - **Validates: Requirements 7.3**

- [x] 16. Implement event notice detail pages
  - [x] 16.1 Create event notice detail layout
    - Create _layouts/notice.html with bounded map + details panel
    - Display: full description, start date, end date, last updated timestamp
    - Configure collection permalink: /gewaesserereignisse/:slug/
    - _Requirements: 7.4, 13.4_

  - [x] 16.2 Write property test for event notice detail page content
    - **Property 16: Event Notice Detail Page Contains Required Information**
    - **Validates: Requirements 7.4**

- [x] 17. Checkpoint - Verify protected areas and event notices
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Date Formatting and Internationalization

- [x] 18. Implement locale-aware date formatting
  - [x] 18.1 Create date formatting utility
    - Create assets/js/date-utils.js or Liquid filter for date formatting
    - Format dates as 'en-GB' for English locale
    - Format dates as 'de-CH' for German locale
    - _Requirements: 8.5_

  - [x] 18.2 Write property test for date locale formatting
    - **Property 19: Date Locale Formatting**
    - **Validates: Requirements 8.5**

## Phase 8: Static Content and API

- [x] 19. Implement static content pages
  - [x] 19.1 Create static page layout
    - Create _layouts/page.html for CMS-driven static pages
    - Render content from Contentful
    - Configure collection permalink: /:menu/:slug/
    - _Requirements: 12.3, 13.5_

- [x] 20. Implement JSON API generation
  - [x] 20.1 Create API data generation plugin/script
    - Generate JSON files at build time for all entity types
    - Create files: spots-{locale}.json, obstacles-{locale}.json, notices-{locale}.json, protected-areas-{locale}.json, waterways-{locale}.json
    - Sort all data by slug in ascending order
    - _Requirements: 9.1, 9.4_

  - [x] 20.2 Write property test for API data sorting
    - **Property 20: API Data Sorting**
    - **Validates: Requirements 9.4**

  - [x] 20.3 Generate dimension table JSON files
    - Create files for: Data License Types, Data Source Types, Obstacle Types, Paddle Craft Types, Paddling Environment Types, Protected Area Types, Spot Types
    - Generate for both locales
    - _Requirements: 9.2_

  - [x] 20.4 Generate last update index
    - Create lastUpdateIndex.json with table names and ISO timestamps
    - _Requirements: 9.3, 9.5_

  - [x] 20.5 Create API documentation page
    - Create /offene-daten/api page with download links
    - Display last updated timestamps for each table
    - Organize into Fact Tables and Dimension Tables sections
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 21. Checkpoint - Verify static content and API
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: URL Generation and Routing

- [x] 22. Configure collection permalinks
  - [x] 22.1 Verify all URL patterns
    - Spots: /einstiegsorte/{slug}
    - Waterways: /gewaesser/{slug}
    - Obstacles: /hindernisse/{slug}
    - Event notices: /gewaesserereignisse/{slug}
    - Static pages: /{menu}/{slug}
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 22.2 Write property test for URL pattern generation
    - **Property 21: URL Pattern Generation**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**

  - [x] 22.3 Create 404 error page
    - Create 404.html with appropriate messaging
    - Style consistently with site design
    - _Requirements: 13.6_

## Phase 10: Dynamic Data Loading (Performance Optimization)

- [x] 23. Implement spatial tile generation
  - [x] 23.1 Create tile generation build script
    - Divide Switzerland into grid tiles (approximately 10km x 10km)
    - Generate tile files at /api/tiles/{layer}/{locale}/{x}_{y}.json
    - Create tile index with bounds information
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 23.2 Write property test for tile coverage completeness
    - **Property 24: Tile Coverage Completeness**
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [x] 24. Implement data loader module
  - [x] 24.1 Create data loader JavaScript module
    - Create assets/js/data-loader.js for viewport-based loading
    - Implement loadDataForBounds(bounds, zoom, locale) function
    - Implement getTilesForBounds(bounds) function
    - Implement tile fetching and caching
    - _Requirements: 14.1, 14.2, 14.5_

  - [x] 24.2 Write property test for viewport data loading
    - **Property 22: Viewport Data Loading Completeness**
    - **Validates: Requirements 14.1, 14.2**

  - [x] 24.3 Create spatial utilities module
    - Create assets/js/spatial-utils.js
    - Implement bounds-to-tile coordinate conversion
    - Implement point-in-bounds checking
    - _Requirements: 14.1, 14.2_

  - [x] 24.4 Implement zoom-based layer visibility
    - Load obstacles and protected areas only at zoom >= 12
    - Hide these layers when zoom < 12
    - _Requirements: 14.3, 14.4_

  - [x] 24.5 Write property test for zoom-based visibility
    - **Property 23: Zoom-Based Layer Visibility**
    - **Validates: Requirements 14.3, 14.4**

  - [x] 24.6 Implement request debouncing
    - Debounce viewport change events (300ms)
    - Prevent excessive API calls during rapid pan/zoom
    - _Requirements: 14.6_

  - [x] 24.7 Write property test for data loading idempotence
    - **Property 25: Data Loading Idempotence**
    - **Validates: Requirements 14.1, 14.2**

- [x] 25. Checkpoint - Verify dynamic data loading
  - Ensure all tests pass, ask the user if questions arise.

## Phase 11: Build and Deployment

- [x] 26. Configure AWS Amplify deployment
  - [x] 26.1 Update amplify.yml for Jekyll
    - Configure Ruby installation and version (ruby-3.3.0)
    - Add bundle install command
    - Configure Jekyll build command
    - Set artifacts baseDirectory to _site
    - _Requirements: 16.1, 16.3, 16.4_

  - [x] 26.2 Configure environment variables
    - Document required Amplify environment variables
    - CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN, CONTENTFUL_ENVIRONMENT
    - MAPBOX_URL, SITE_URL
    - _Requirements: 16.3_

  - [x] 26.3 Configure Contentful webhook
    - Document webhook setup for automatic rebuilds on content publish
    - _Requirements: 16.2_

  - [x] 26.4 Configure cache headers
    - Set appropriate cache headers for static assets
    - Configure short TTL for HTML pages
    - Configure long TTL for spatial tile files
    - _Requirements: 16.5_

## Phase 12: Testing Infrastructure

- [x] 27. Set up testing framework
  - [x] 27.1 Configure Jest for JavaScript testing
    - Add Jest to package.json devDependencies
    - Create jest.config.js
    - Set up test directory structure: _tests/unit/, _tests/property/, _tests/integration/
    - _Requirements: Testing Strategy_

  - [x] 27.2 Configure fast-check for property-based testing
    - Add fast-check to package.json devDependencies
    - Configure minimum 100 iterations per property test
    - _Requirements: Testing Strategy_

  - [x] 27.3 Write unit tests for utility functions
    - Test date formatting functions
    - Test coordinate validation
    - Test GeoJSON parsing
    - _Requirements: Testing Strategy_

- [ ] 28. Final Checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Phase 13: Migration Cleanup

- [ ] 29. Remove Gatsby-specific files
  - [ ] 29.1 Archive or remove Gatsby configuration
    - Remove gatsby-config.js (after Jekyll is verified working)
    - Remove Gatsby-specific package.json dependencies
    - Remove src/pages/ Gatsby page components
    - Remove src/components/ React components
    - Archive src/api/ Gatsby JSON page generators
    - _Requirements: N/A - Migration cleanup_

  - [ ] 29.2 Update documentation
    - Update README.md with Jekyll build instructions
    - Document new project structure
    - Update any deployment documentation
    - _Requirements: N/A - Migration cleanup_
