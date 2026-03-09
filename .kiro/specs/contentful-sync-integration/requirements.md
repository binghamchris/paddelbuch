# Requirements Document

## Introduction

This feature replaces the current `jekyll-contentful-data-import` gem-based integration with a custom Contentful Sync API plugin for the Paddelbuch (Swiss Paddle Map) Jekyll site. The current setup fails to fetch Contentful data during local builds, leaving maps empty and content missing. The new integration follows the proven pattern from the Cloudy Pandas reference project: a custom Jekyll Generator plugin that fetches content from Contentful at build time, transforms it into YAML data files, and uses the Sync API for incremental updates to minimize API calls.

## Glossary

- **Contentful_Fetcher**: The custom Jekyll Generator plugin responsible for fetching content from Contentful CMS and writing YAML data files to `_data/`
- **Sync_Token**: A Contentful API token that tracks the state of content at a point in time, enabling incremental synchronization
- **Cache_Metadata**: A local YAML file in `_data/` storing sync tokens, timestamps, and environment info to track the last successful synchronization state
- **Content_Type**: A Contentful schema definition (e.g., spot, waterway, obstacle) that defines the structure of entries
- **Entry**: A single piece of content in Contentful conforming to a Content_Type
- **Data_File**: A YAML file in the `_data/` directory containing fetched Contentful content used by Jekyll templates and other generators
- **Mapper**: A transformation function that converts a raw Contentful Entry into a Jekyll-friendly hash structure for YAML serialization
- **Sync_Checker**: A module encapsulating Contentful Sync API interactions for detecting content changes

## Requirements

### Requirement 1: Fetch Contentful Data at Build Time

**User Story:** As a site maintainer, I want Contentful data to be fetched automatically during Jekyll builds, so that maps display correctly and all content is available locally.

#### Acceptance Criteria

1. WHEN a Jekyll build starts, THE Contentful_Fetcher SHALL run as a Jekyll Generator with highest priority before other generators
2. WHEN Contentful credentials are configured, THE Contentful_Fetcher SHALL connect to the Contentful Content Delivery API using the `contentful` Ruby gem
3. WHEN Contentful credentials are missing, THE Contentful_Fetcher SHALL log a warning and skip content fetching without failing the build
4. THE Contentful_Fetcher SHALL fetch all entries for each configured Content_Type from Contentful
5. THE Contentful_Fetcher SHALL support the following Content_Types: spot, waterway, obstacle, protectedArea, waterwayEventNotice, spotType, obstacleType, paddleCraftType, paddlingEnvironmentType, protectedAreaType, dataSourceType, dataLicenseType, staticPage
6. THE Contentful_Fetcher SHALL fetch entries with locale set to `*` to retrieve all locale variants
7. WHEN entries are fetched, THE Contentful_Fetcher SHALL write each Content_Type to a separate YAML Data_File in the `_data/` directory
8. WHEN Data_Files are written, THE Contentful_Fetcher SHALL update `site.data` so that subsequent generators can access the fresh data without re-reading files from disk

### Requirement 2: Transform Contentful Entries Using Mappers

**User Story:** As a site maintainer, I want Contentful entries transformed into the same data structure the existing templates and generators expect, so that the site renders correctly without template changes.

#### Acceptance Criteria

1. THE Contentful_Fetcher SHALL transform each Entry using a Mapper specific to the Content_Type
2. WHEN transforming a spot Entry, THE Mapper SHALL extract: slug, name, description (as rich text HTML), location (lat/lon), approximateAddress, country, confirmed, rejected, and reference slugs for waterway, spotType, paddlingEnvironmentType, paddleCraftTypes, eventNotices, obstacles, dataSourceType, and dataLicenseType
3. WHEN transforming a waterway Entry, THE Mapper SHALL extract: slug, name, length, area, geometry (as JSON string), showInMenu, and reference slugs for paddlingEnvironmentType, dataSourceType, and dataLicenseType
4. WHEN transforming an obstacle Entry, THE Mapper SHALL extract: slug, name, description (as rich text HTML), geometry (as JSON string), portageRoute (as JSON string), portageDistance, portageDescription (as rich text HTML), isPortageNecessary, isPortagePossible, and reference slugs for obstacleType, waterway, and spots
5. WHEN transforming a protectedArea Entry, THE Mapper SHALL extract: slug, name, geometry (as JSON string), isAreaMarked, and reference slug for protectedAreaType
6. WHEN transforming a waterwayEventNotice Entry, THE Mapper SHALL extract: slug, name, description (as rich text HTML), location (lat/lon), affectedArea (as JSON string), startDate, endDate, and reference slugs for waterways
7. WHEN transforming a type Entry (spotType, obstacleType, paddleCraftType, paddlingEnvironmentType, protectedAreaType, dataSourceType, dataLicenseType), THE Mapper SHALL extract: slug, name_de, and name_en
8. WHEN transforming a staticPage Entry, THE Mapper SHALL extract: slug, title, menu, menu_slug, content (as rich text HTML), and menuOrder
9. THE Mapper SHALL include locale, createdAt (ISO 8601), and updatedAt (ISO 8601) fields for every transformed Entry
10. WHEN a field is missing or raises a Contentful error, THE Mapper SHALL return nil for that field instead of failing

### Requirement 3: Incremental Sync Using the Contentful Sync API

**User Story:** As a site maintainer, I want the build process to check if Contentful content has changed before fetching all data, so that I can reduce unnecessary API calls.

#### Acceptance Criteria

1. WHEN the Contentful_Fetcher starts and valid Cache_Metadata exists, THE Sync_Checker SHALL query the Contentful Sync API using the stored Sync_Token to determine if any content has changed
2. WHEN no content changes are detected, THE Contentful_Fetcher SHALL skip fetching content and use existing Data_Files
3. WHEN content changes are detected, THE Contentful_Fetcher SHALL proceed with fetching all updated content
4. WHEN the Sync API check fails due to a network or API error, THE Contentful_Fetcher SHALL fall back to a full content fetch and log a warning
5. THE Sync_Checker SHALL use `client.sync(initial: true)` for initial syncs and `client.sync(sync_token: token)` for incremental syncs
6. THE Sync_Checker SHALL call `sync.first_page` to obtain a SyncPage before accessing items, as the `items` method exists on SyncPage not on Sync
7. THE Sync_Checker SHALL iterate through all sync pages using `page.next_page?` and `page.next_page` to collect all changed items
8. THE Sync_Checker SHALL extract the new Sync_Token from the final page's `next_sync_url`

### Requirement 4: Persist Synchronization State Between Builds

**User Story:** As a site maintainer, I want the system to persist synchronization state between builds, so that incremental syncing works across multiple build sessions.

#### Acceptance Criteria

1. WHEN a successful sync completes, THE Contentful_Fetcher SHALL store the new Sync_Token in Cache_Metadata
2. WHEN a successful sync completes, THE Contentful_Fetcher SHALL store the sync timestamp in Cache_Metadata
3. WHEN the Contentful_Fetcher starts, THE Contentful_Fetcher SHALL read the previous Sync_Token from Cache_Metadata
4. WHEN Cache_Metadata does not exist, THE Contentful_Fetcher SHALL perform a full initial sync
5. WHEN serializing Cache_Metadata to disk, THE Contentful_Fetcher SHALL write the data as YAML format to `_data/.contentful_sync_cache.yml`
6. WHEN reading Cache_Metadata from disk, THE Contentful_Fetcher SHALL parse the YAML format and validate that required fields (sync_token, last_sync_at, space_id, environment) are present

### Requirement 5: Force Full Sync Override

**User Story:** As a site maintainer, I want the option to force a full refresh of content, so that I can recover from potential sync issues or cache corruption.

#### Acceptance Criteria

1. WHEN the environment variable `CONTENTFUL_FORCE_SYNC` is set to `true`, THE Contentful_Fetcher SHALL perform a full content fetch regardless of Cache_Metadata state
2. WHEN a forced sync completes, THE Contentful_Fetcher SHALL update Cache_Metadata with the new Sync_Token
3. WHEN the Jekyll config option `force_contentful_sync` is set to `true`, THE Contentful_Fetcher SHALL perform a full content fetch

### Requirement 6: Environment Change Detection

**User Story:** As a site maintainer, I want the sync token to be invalidated when the Contentful environment or space changes, so that content is correctly refreshed when switching between environments.

#### Acceptance Criteria

1. WHEN the Contentful space ID in Cache_Metadata differs from the current `CONTENTFUL_SPACE_ID`, THE Contentful_Fetcher SHALL perform a full sync
2. WHEN the Contentful environment in Cache_Metadata differs from the current `CONTENTFUL_ENVIRONMENT`, THE Contentful_Fetcher SHALL perform a full sync
3. WHEN a full sync is triggered due to environment or space mismatch, THE Contentful_Fetcher SHALL log the specific reason for the full sync

### Requirement 7: Build Logging for Sync Operations

**User Story:** As a site maintainer, I want clear logging about the sync status, so that I can understand what the build process is doing and troubleshoot issues.

#### Acceptance Criteria

1. WHEN using cached content, THE Contentful_Fetcher SHALL log a message indicating cached content is being used and the timestamp of the last sync
2. WHEN fetching new content, THE Contentful_Fetcher SHALL log the number of changed entries detected by the Sync API
3. WHEN a sync error occurs, THE Contentful_Fetcher SHALL log the error details and the fallback action taken
4. WHEN Cache_Metadata is missing or invalid, THE Contentful_Fetcher SHALL log that a full sync is being performed and the reason
5. WHEN fetching entries for a Content_Type, THE Contentful_Fetcher SHALL log the Content_Type name and the number of entries fetched

### Requirement 8: SSL Compatibility for Ruby 3.4+

**User Story:** As a developer using Ruby 3.4+, I want the Contentful API client to handle SSL connections without CRL verification errors, so that builds succeed on modern Ruby versions.

#### Acceptance Criteria

1. WHEN running on Ruby 3.4 or later with OpenSSL 3.x, THE Contentful_Fetcher SHALL apply an SSL configuration that disables CRL checking to prevent "certificate verify failed (unable to get certificate CRL)" errors
2. THE Contentful_Fetcher SHALL maintain standard SSL peer verification while disabling CRL checking

### Requirement 9: Data File Output Compatibility

**User Story:** As a site maintainer, I want the generated data files to be compatible with the existing API generator, tile generator, and template plugins, so that the site continues to work without changes to downstream code.

#### Acceptance Criteria

1. THE Contentful_Fetcher SHALL write spot data to `_data/spots.yml` in the same structure expected by the ApiGenerator and TileGenerator plugins
2. THE Contentful_Fetcher SHALL write waterway data to `_data/waterways.yml`
3. THE Contentful_Fetcher SHALL write obstacle data to `_data/obstacles.yml`
4. THE Contentful_Fetcher SHALL write protected area data to `_data/protected_areas.yml`
5. THE Contentful_Fetcher SHALL write notice data to `_data/notices.yml`
6. THE Contentful_Fetcher SHALL write type data to `_data/types/spot_types.yml`, `_data/types/obstacle_types.yml`, `_data/types/paddle_craft_types.yml`, `_data/types/paddling_environment_types.yml`, `_data/types/protected_area_types.yml`, `_data/types/data_source_types.yml`, and `_data/types/data_license_types.yml`
7. THE Contentful_Fetcher SHALL write static page data to `_data/static_pages.yml`
8. FOR ALL valid Data_Files, writing to YAML and then reading back SHALL produce an equivalent data structure (round-trip property)

### Requirement 10: Gem Dependencies

**User Story:** As a developer, I want the required gems added to the Gemfile, so that the Contentful integration can be installed and used.

#### Acceptance Criteria

1. THE Gemfile SHALL include the `contentful` gem (~> 2.17) for Contentful API access
2. THE Gemfile SHALL include the `dotenv` gem (~> 3.1) for environment variable loading
3. THE Gemfile SHALL remove the `jekyll-contentful-data-import` gem since the custom plugin replaces it
4. THE Gemfile SHALL include the `rspec` gem (~> 3.12) in the test group for unit and property testing
5. THE Gemfile SHALL include the `rantly` gem (~> 2.0) in the test group for property-based testing
