# Implementation Plan: Contentful Delta Sync

## Overview

Implement delta merge for the Contentful sync pipeline. Instead of re-fetching all 13 content types when changes are detected, the system will extract individual changed/deleted entries from the sync delta, re-fetch each changed entry individually with resolved links, and upsert/remove rows directly in the cached YAML data files. Three existing modules are modified (`CacheMetadata`, `SyncChecker`, `ContentfulFetcher`); no new source files are introduced. New test files are created in `spec/`.

## Tasks

- [x] 1. Extend CacheMetadata with Entry ID Index support
  - [x] 1.1 Add `entry_id_index` field and accessor to `CacheMetadata`
    - Add `attr_accessor :entry_id_index` to the class
    - Initialize `@entry_id_index` to `{}` in the constructor
    - _Requirements: 7.1, 7.5_

  - [x] 1.2 Implement `add_to_entry_id_index`, `remove_from_entry_id_index`, and `lookup_entry_id` methods
    - `add_to_entry_id_index(entry_id, slug, content_type)` adds/updates an entry
    - `remove_from_entry_id_index(entry_id)` removes an entry
    - `lookup_entry_id(entry_id)` returns `{ 'slug' => ..., 'content_type' => ... }` or `nil`
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 1.3 Update `save` and `load` to persist and restore `entry_id_index`
    - Serialize `entry_id_index` as a top-level key in the cache YAML file
    - On load, restore `entry_id_index` from the YAML data (default to `{}` if missing for backward compatibility)
    - _Requirements: 7.1, 7.5_

  - [x] 1.4 Write unit tests for CacheMetadata Entry ID Index
    - Test file: `spec/cache_metadata_spec.rb` (extend existing file)
    - Test save/load round-trip with `entry_id_index` populated
    - Test `add_to_entry_id_index`, `remove_from_entry_id_index`, `lookup_entry_id`
    - Test backward compatibility: loading a cache file without `entry_id_index` defaults to `{}`
    - _Requirements: 7.1, 7.5_

  - [x] 1.5 Write property test for Entry ID Index round-trip (Property 4)
    - **Property 4: Entry ID Index round-trip through cache persistence**
    - **Validates: Requirements 7.1, 7.5**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random Entry ID Index hashes mapping random entry IDs to `{ slug, content_type }` pairs
    - Save via `CacheMetadata#save`, load via `CacheMetadata#load`, assert identical index
    - Minimum 100 iterations

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Extend SyncChecker to extract and classify delta items
  - [x] 3.1 Extend `SyncResult` struct with new fields
    - Add `changed_entries`, `deleted_entries`, `unknown_content_types` fields to the Struct
    - `changed_entries`: Hash `{ content_type_id => [entry, ...] }`
    - `deleted_entries`: Hash `{ content_type_id => [entry, ...] }`
    - `unknown_content_types`: Array of unknown content type ID strings
    - Ensure existing fields (`success`, `has_changes`, `new_token`, `items_count`, `error`) remain unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Update `check_for_changes` to accept `known_content_types` and classify delta items
    - New signature: `check_for_changes(client, sync_token, known_content_types = nil)`
    - When `known_content_types` is provided, iterate sync items and classify by `sys.type`:
      - `'Entry'` → changed entry (extract `content_type_id` from `sys.contentType.sys.id`)
      - `'DeletedEntry'` → deleted entry (extract `content_type_id` from `sys.contentType.sys.id`)
      - `'Asset'`, `'DeletedAsset'` → ignored
    - Filter out entries whose `content_type_id` is not in `known_content_types`
    - Collect unknown content type IDs for logging
    - Group results by `content_type_id`
    - When `known_content_types` is nil, maintain backward-compatible behavior (existing callers unaffected)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2_

  - [x] 3.3 Write unit tests for SyncChecker delta extraction
    - Test file: `spec/sync_checker_spec.rb` (extend existing file)
    - Test empty delta returns empty `changed_entries` and `deleted_entries`
    - Test mixed item types (`Entry`, `DeletedEntry`, `Asset`, `DeletedAsset`) are classified correctly
    - Test unknown content types are excluded and collected in `unknown_content_types`
    - Test multi-page sync collects and classifies items from all pages
    - Test backward compatibility: calling without `known_content_types` still works
    - Test `SyncResult` new fields are present and default correctly
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Write property test for delta item classification (Property 1)
    - **Property 1: Delta item classification and grouping**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random collections of sync items with mixed `sys.type` values and random content type IDs (both known and unknown)
    - Assert: all `Entry` items with known types land in `changed_entries`, all `DeletedEntry` items with known types land in `deleted_entries`, unknown types excluded, `items_count` equals total items, `has_changes` is true iff delta is non-empty
    - Minimum 100 iterations

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement ContentfulFetcher delta merge path
  - [x] 5.1 Implement `upsert_rows` and `remove_rows` helper methods
    - `upsert_rows(yaml_data, filename, new_rows)`: for each new row, find existing row matching `slug` + `locale` in `yaml_data[filename]`; replace if found, append if not
    - `remove_rows(yaml_data, filename, slug)`: remove all rows from `yaml_data[filename]` where `row['slug'] == slug`
    - _Requirements: 3.3, 3.4, 3.6, 3.7_

  - [x] 5.2 Implement `load_all_yaml_files` and `load_all_yaml_into_site_data` methods
    - `load_all_yaml_files`: read all 13 YAML data files into `{ filename => [rows] }` hash
    - `load_all_yaml_into_site_data`: read all YAML files from disk and populate `site.data` using the same key structure as `write_yaml`
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Implement `build_entry_id_index` method
    - During full fetch, iterate all fetched entries and build the index mapping `sys.id → { slug, content_type }`
    - Use `ContentfulMappers.extract_slug` to get the slug
    - _Requirements: 7.2_

  - [x] 5.4 Implement `perform_delta_merge` method
    - Orchestrate the delta merge: log summary, re-fetch changed entries via `client.entry(id, locale: '*', include: 2)`, map with `ContentfulMappers.flatten_entry`, upsert rows, look up deleted entries in index, remove rows, write modified YAML files, load into `site.data`, compute hash and set change flag
    - Pass `content_type_id` as extra arg when mapper is `:map_type`
    - Update Entry ID Index for upserted and deleted entries
    - Wrap in `rescue StandardError` to fall back to full fetch on any failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Implement logging helpers for delta merge
    - `log_delta_summary(result)`: log total changed and deleted entry counts
    - `log_upsert(slug, content_type, is_update)`: log slug, content type, and insert vs update
    - `log_deletion(slug, content_type)`: log slug and content type
    - `log_unknown_content_types(unknown_types)`: log warning for each unknown content type ID
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 5.6 Update `generate` method to use delta merge path
    - Pass `CONTENT_TYPES.keys` to `check_for_changes` as `known_content_types`
    - When `result.has_changes` is true and `changed_entries` or `deleted_entries` are present, call `perform_delta_merge`
    - When sync reports changes but no classifiable entries, fall back to full fetch
    - _Requirements: 3.1, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.7 Update `perform_full_sync_and_cache` to build and persist Entry ID Index
    - After `fetch_and_write_content`, call `build_entry_id_index` with all fetched entries
    - Store the index in `cache.entry_id_index` before saving
    - _Requirements: 7.2_

  - [x] 5.8 Write unit tests for ContentfulFetcher delta merge
    - Test file: `spec/contentful_fetcher_spec.rb` (extend existing file)
    - Test `upsert_rows`: upsert existing entry (replace), insert new entry (append)
    - Test `remove_rows`: remove all locale rows for a slug, leave other slugs unchanged
    - Test `perform_delta_merge`: mock client.entry, verify upsert and delete operations, verify YAML files written, verify site.data updated
    - Test fallback: re-fetch failure triggers full fetch, missing index entry triggers full fetch
    - Test `client.entry` called with correct params (`locale: '*'`, `include: 2`)
    - Test `map_type` mapper receives content_type_id as extra argument
    - Test logging: delta summary logged, upsert/delete logged, unknown types warned, fallback reason logged
    - Test `build_entry_id_index`: verify index built correctly from entries
    - _Requirements: 3.1, 3.3, 3.4, 3.6, 3.7, 3.9, 4.5, 4.6, 7.2, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 5.9 Write property test for upsert correctness (Property 2)
    - **Property 2: Upsert preserves data and updates correctly**
    - **Validates: Requirements 3.3, 3.4, 7.3**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random YAML data arrays of locale rows and random new rows to upsert
    - Assert: every new row's slug+locale is present in result, upserted values match new rows exactly, non-matching rows unchanged, total count equals original + genuinely new pairs
    - Minimum 100 iterations

  - [x] 5.10 Write property test for deletion correctness (Property 3)
    - **Property 3: Deletion removes exactly the target slug rows**
    - **Validates: Requirements 3.6, 3.7, 7.4**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random YAML data arrays and a random slug present in the array
    - Assert: no rows with deleted slug remain, all other rows unchanged and in same order, row count decreases by exactly the number of matching rows
    - Minimum 100 iterations

  - [~] 5.11 Write property test for Entry ID Index construction (Property 5)
    - **Property 5: Entry ID Index construction covers all entries**
    - **Validates: Requirements 7.2**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random sets of entries with random sys.id, slugs, and content type IDs
    - Assert: every entry's sys.id maps to correct slug and content type, index size equals number of unique entry IDs
    - Minimum 100 iterations

  - [~] 5.12 Write property test for content hash equivalence (Property 6)
    - **Property 6: Content hash is identical regardless of sync path**
    - **Validates: Requirements 5.1**
    - Test file: `spec/delta_sync_properties_spec.rb`
    - Generate random file contents, write to tmpdir, compute hash; write same contents via a different code path, compute hash again
    - Assert: both hashes are identical for byte-identical file contents
    - Minimum 100 iterations

- [~] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update documentation
  - [~] 7.1 Update `docs/plugins.md` with delta sync documentation
    - Update the `ContentfulFetcher` section: add delta merge step to the sync strategy list (between "If changes" and "re-fetches all content")
    - Document the new delta merge flow: re-fetch individual entries, upsert/remove in YAML, fallback to full fetch on failure
    - Update the `SyncChecker` section: document extended `SyncResult` struct with `changed_entries`, `deleted_entries`, `unknown_content_types` fields
    - Update the `CacheMetadata` section: document new `entry_id_index` field and `add_to_entry_id_index`, `remove_from_entry_id_index`, `lookup_entry_id` methods
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [~] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All tests use RSpec + Rantly, run via `bundle exec rspec`
- No new source files are introduced; only `_plugins/cache_metadata.rb`, `_plugins/sync_checker.rb`, and `_plugins/contentful_fetcher.rb` are modified
- New test files: `spec/delta_sync_properties_spec.rb` (property tests); existing `spec/cache_metadata_spec.rb`, `spec/sync_checker_spec.rb`, `spec/contentful_fetcher_spec.rb` are extended with new test cases
