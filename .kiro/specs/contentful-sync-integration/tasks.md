# Implementation Plan: Contentful Sync Integration

## Overview

Replace the `jekyll-contentful-data-import` gem with a custom Jekyll Generator plugin that fetches Contentful content at build time using the Sync API for incremental updates. Implementation proceeds bottom-up: dependencies first, then core modules (CacheMetadata, SyncChecker, Mappers), then the main ContentfulFetcher generator, and finally wiring and integration.

## Tasks

- [x] 1. Update Gemfile and add SSL patch
  - [x] 1.1 Update Gemfile with new dependencies
    - Remove `jekyll-contentful-data-import` gem from `:jekyll_plugins` group
    - Add `contentful` gem (~> 2.17) to main dependencies
    - Add `dotenv` gem (~> 3.1) to main dependencies
    - Add `rspec` gem (~> 3.12) and `rantly` gem (~> 2.0) to a `:test` group
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 1.2 Create the SSL patch module
    - Create `_plugins/ssl_patch.rb`
    - Conditionally monkey-patch `HTTP::Connection#start_tls` for Ruby 3.4+ / OpenSSL 3.x
    - Maintain `VERIFY_PEER` mode while disabling CRL checking
    - _Requirements: 8.1, 8.2_

  - [x] 1.3 Set up RSpec test infrastructure
    - Create `spec/spec_helper.rb` with RSpec and Rantly configuration
    - Create `.rspec` config file
    - Ensure test suite runs with `bundle exec rspec`
    - _Requirements: 10.4, 10.5_

- [x] 2. Implement CacheMetadata class
  - [x] 2.1 Create CacheMetadata class
    - Create `_plugins/cache_metadata.rb`
    - Implement `initialize(data_dir)`, `load`, `save`, `valid?`, and `matches_config?` methods
    - Store sync_token, last_sync_at, space_id, environment as YAML in `_data/.contentful_sync_cache.yml`
    - Handle missing file, corrupted YAML, and missing fields gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Write property test: Cache metadata YAML round-trip
    - **Property 5: Cache metadata YAML round-trip**
    - **Validates: Requirements 4.5, 4.6**

  - [x] 2.3 Write property test: Cache validation rejects incomplete metadata
    - **Property 10: Cache validation rejects incomplete metadata**
    - **Validates: Requirements 4.6**

  - [x] 2.4 Write unit tests for CacheMetadata
    - Test load/save cycle, valid?, matches_config?
    - Test missing file handling, corrupted YAML, missing fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 3. Checkpoint - Ensure CacheMetadata tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement SyncChecker module
  - [x] 4.1 Create SyncChecker module
    - Create `_plugins/sync_checker.rb`
    - Implement `SyncResult` struct with `success`, `has_changes`, `new_token`, `items_count`, `error` fields
    - Implement `check_for_changes(client, sync_token)` using `client.sync(sync_token: token)`
    - Implement `initial_sync(client)` using `client.sync(initial: true)`
    - Implement `collect_all_pages(sync)` to iterate through all sync pages via `first_page`, `next_page?`, `next_page`
    - Implement `extract_sync_token(page)` to parse token from `next_sync_url`
    - Rescue `StandardError` and return `SyncResult.new(success: false, error: e)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 4.2 Write property test: Sync result determines fetch behavior
    - **Property 3: Sync result determines fetch behavior**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.3 Write property test: Sync error triggers full fetch fallback
    - **Property 4: Sync error triggers full fetch fallback**
    - **Validates: Requirements 3.4**

  - [x] 4.4 Write property test: Sync page iteration completeness
    - **Property 12: Sync page iteration completeness**
    - **Validates: Requirements 3.7, 3.8**

  - [x] 4.5 Write unit tests for SyncChecker
    - Test initial_sync, check_for_changes with mocked Contentful client
    - Test multi-page iteration, token extraction, error handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [~] 5. Checkpoint - Ensure SyncChecker tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Refactor ContentfulMappers module
  - [~] 6.1 Refactor contentful_mappers.rb to standalone module
    - Rewrite `_plugins/contentful_mappers.rb` as a standalone `ContentfulMappers` module (no `Base` class inheritance)
    - Convert each mapper class to a module method: `map_spot`, `map_waterway`, `map_obstacle`, `map_protected_area`, `map_event_notice`, `map_type`, `map_static_page`
    - Implement `safe_field(entry, field_name)` helper that rescues Contentful errors and returns nil
    - Implement `extract_slug`, `extract_location`, `extract_reference_slug`, `extract_reference_slugs`, `extract_rich_text_html`, `base_fields` helpers
    - Each mapper returns a hash with all required fields plus locale, createdAt (ISO 8601), updatedAt (ISO 8601)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 6.2 Write property test: Mapper field completeness
    - **Property 1: Mapper field completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

  - [~] 6.3 Write property test: Mapper resilience to missing fields
    - **Property 2: Mapper resilience to missing fields**
    - **Validates: Requirements 2.10**

  - [~] 6.4 Write property test: Data file YAML round-trip
    - **Property 6: Data file YAML round-trip**
    - **Validates: Requirements 9.8**

  - [~] 6.5 Write unit tests for ContentfulMappers
    - Test each mapper method with sample Contentful entry doubles
    - Test missing fields, nil references, rich text conversion
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

- [~] 7. Checkpoint - Ensure Mapper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement ContentfulFetcher generator
  - [~] 8.1 Create ContentfulFetcher generator
    - Create `_plugins/contentful_fetcher.rb`
    - Register as `Jekyll::Generator` with `priority :highest`
    - Include `SyncChecker` module
    - Define `CONTENT_TYPES` hash mapping all 13 content types to filenames and mapper methods
    - Implement `generate(site)` orchestration: credential check → load cache → determine sync strategy → fetch/skip → save cache
    - Implement `contentful_configured?` checking `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN`
    - Implement `force_sync?` checking `ENV['CONTENTFUL_FORCE_SYNC']` and `site.config['force_contentful_sync']`
    - Implement `client` as memoized `Contentful::Client` instance
    - Implement `fetch_and_write_content` iterating CONTENT_TYPES, fetching entries with `locale: '*'`, transforming via mappers, writing YAML
    - Implement `fetch_entries(content_type)` using `client.entries(content_type: ct, locale: '*', include: 2, limit: 1000)`
    - Implement `write_yaml(filename, data)` writing to `_data/{filename}.yml` and updating `site.data`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [~] 8.2 Implement build logging
    - Log cached content usage with last sync timestamp
    - Log number of changed entries detected by Sync API
    - Log sync errors and fallback actions
    - Log full sync reasons (missing cache, invalid cache, environment mismatch, force sync)
    - Log content type name and entry count during fetch
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 8.3 Write property test: Force sync overrides cache state
    - **Property 7: Force sync overrides cache state**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [~] 8.4 Write property test: Configuration mismatch triggers full sync
    - **Property 8: Configuration mismatch triggers full sync**
    - **Validates: Requirements 6.1, 6.2**

  - [~] 8.5 Write property test: Post-sync cache persistence
    - **Property 9: Post-sync cache persistence**
    - **Validates: Requirements 4.1, 4.2, 5.2**

  - [~] 8.6 Write property test: Content type to file path mapping
    - **Property 11: Content type to file path mapping**
    - **Validates: Requirements 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

  - [~] 8.7 Write property test: Missing credentials graceful skip
    - **Property 13: Missing credentials graceful skip**
    - **Validates: Requirements 1.3**

  - [~] 8.8 Write unit tests for ContentfulFetcher
    - Test credential checking, force sync detection, fetch flow with mocked client
    - Test site.data update after YAML write
    - Test environment mismatch detection and logging
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [~] 9. Checkpoint - Ensure all ContentfulFetcher tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration wiring and data file output verification
  - [~] 10.1 Verify data file output compatibility with downstream generators
    - Ensure `_data/spots.yml` structure is compatible with `ApiGenerator` and `TileGenerator`
    - Ensure all 13 content types write to correct file paths per the CONTENT_TYPES mapping
    - Ensure `_data/types/` subdirectory is created for type data files
    - Verify `site.data` is updated so downstream generators access fresh data without re-reading files
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [~] 10.2 Write integration tests for full fetch flow
    - Test full generate flow with mocked Contentful client: fetch → transform → write YAML → update site.data
    - Verify downstream generators can read the written data
    - _Requirements: 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [~] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (13 properties total)
- Unit tests validate specific examples and edge cases
- All Contentful API interactions should be mocked in tests using RSpec doubles
- Run tests with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
