# Implementation Plan: Conditional Build Regeneration

## Overview

Add content-hash-based change detection to the Jekyll build pipeline so that `ApiGenerator` and `TileGenerator` skip expensive regeneration when Contentful data hasn't changed. The implementation modifies four existing plugins and adds one new shared module, with cached output stored in dot-prefixed subdirectories under `_data/`. The `CollectionGenerator` remains untouched.

## Tasks

- [x] 1. Create shared GeneratorCache module
  - [x] 1.1 Create `_plugins/generator_cache.rb` with the `GeneratorCache` mixin module
    - Implement `cache_available?(cache_dir)` — checks directory exists and contains `.json` files
    - Implement `write_cache_file(cache_dir, relative_path, content)` — writes a single file with `mkdir_p`
    - Implement `read_cache_files(cache_dir)` — returns array of `{ relative_path:, content: }` hashes
    - Implement `clear_cache(cache_dir)` — removes and recreates the cache directory
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [x] 1.2 Write unit tests for GeneratorCache module
    - Create `spec/plugins/generator_cache_spec.rb`
    - Test `cache_available?` returns false for missing/empty dirs, true for dirs with JSON files
    - Test `write_cache_file` creates nested directories and writes content
    - Test `read_cache_files` returns correct relative paths and content
    - Test `clear_cache` removes existing files and recreates directory
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. Extend CacheMetadata with content hash computation
  - [x] 2.1 Add `content_hash` field and `compute_content_hash` method to `_plugins/cache_metadata.rb`
    - Add `content_hash` to `attr_accessor`
    - Implement `compute_content_hash(yaml_files)` — SHA-256 over sorted file paths, reading each file's contents
    - Extend `load` to read `content_hash` from YAML
    - Extend `save` to write `content_hash` to YAML
    - _Requirements: 1.1_

  - [x] 2.2 Write property test for content hash determinism (Property 1)
    - **Property 1: Content hash determinism**
    - Create `spec/plugins/cache_metadata_hash_spec.rb`
    - Generate random file contents and paths with rantly, compute hash with different orderings, assert equality
    - Minimum 100 iterations
    - **Validates: Requirements 1.1**

  - [x] 2.3 Write unit tests for CacheMetadata content_hash
    - Add tests to `spec/plugins/cache_metadata_spec.rb` (or create new file)
    - Test `compute_content_hash` with known file contents produces expected SHA-256 digest
    - Test `load`/`save` round-trip preserves `content_hash`
    - Test `compute_content_hash` with missing files only hashes existing ones
    - _Requirements: 1.1_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add change flag logic to ContentfulFetcher
  - [x] 4.1 Modify `_plugins/contentful_fetcher.rb` to compute content hash and set change flag
    - After YAML files are written, collect file paths from `CONTENT_TYPES`
    - Call `cache.compute_content_hash(yaml_files)` to get the new hash
    - Compare with `cache.content_hash` (previously stored hash)
    - Set `site.config['contentful_data_changed']` based on comparison result
    - When sync API reports no changes: set flag to `false` without recomputing hash
    - When no previous hash exists: set flag to `true`
    - When force sync is active: set flag to `true` regardless of hash comparison
    - Update `save_cache` to persist the new content hash
    - Add info-level log messages for each code path (hash match, hash mismatch, no previous hash, force sync, sync API no changes)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 6.1, 6.2, 7.5_

  - [x] 4.2 Write property test for change flag correctness (Property 2)
    - **Property 2: Change flag reflects hash comparison**
    - Create or extend `spec/plugins/contentful_fetcher_cache_spec.rb`
    - Generate random hash pairs (equal and unequal), run flag logic, assert flag matches expectation
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3, 2.1**

  - [x] 4.3 Write property test for force sync override (Property 3)
    - **Property 3: Force sync overrides hash comparison**
    - Generate random hash states, enable force sync, assert flag is always `true`
    - Minimum 100 iterations
    - **Validates: Requirements 6.1, 6.2**

  - [x] 4.4 Write property test for change flag logging (Property 8)
    - **Property 8: Change flag logging**
    - Run ContentfulFetcher with random hash states, capture log output, assert message present with correct reason
    - Minimum 100 iterations
    - **Validates: Requirements 7.5**

  - [x] 4.5 Write unit tests for ContentfulFetcher change flag
    - Test first build with no cache metadata → flag is `true`
    - Test missing credentials → flag is not set (nil)
    - Test sync API reports no changes → hash is not recomputed, flag is `false`
    - Test force sync via env var → flag is `true`
    - Test force sync via config → flag is `true`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 6.1, 6.2_

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add conditional regeneration to ApiGenerator
  - [x] 6.1 Modify `_plugins/api_generator.rb` to include GeneratorCache and add cache-or-generate logic
    - `include GeneratorCache` in the class
    - At the start of `generate`, read `site.config.fetch('contentful_data_changed', true)`
    - Set `cache_dir` to `File.join(site.source, '_data', '.api_cache')`
    - If flag is `false` and `cache_available?(cache_dir)`: call `load_from_cache(cache_dir)` — read each cached JSON file, create `PageWithoutAFile` with cached content, reconstruct `site.data['last_updates']` from cached `lastUpdateIndex.json`, set `@@cached_last_updates`
    - If flag is `true` or cache unavailable: run existing generation logic, then write each generated JSON string to cache via `write_cache_file`
    - If flag is `false` but cache is empty/missing: log cache miss, fall back to full generation, populate cache
    - Add info-level log messages for cache hit (with file count), cache miss, and fresh generation
    - Handle corrupted cache files: log warning, fall back to full generation, clear and repopulate cache
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 5.1, 5.3, 7.1, 7.2, 8.1, 8.2, 8.3, 8.4_

  - [x] 6.2 Write property test for API generator cache round-trip (Property 4)
    - **Property 4: API generator cache round-trip**
    - Create `spec/plugins/api_generator_cache_spec.rb`
    - Generate random site data, run fresh generation, write cache, load cache, compare page contents byte-for-byte
    - Minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 6.3 Write property test for API generator cache-hit logging (Property 9 — API part)
    - **Property 9: Generator cache-hit logging (API)**
    - Run ApiGenerator with/without cache, capture log output, assert correct messages with file count
    - Minimum 100 iterations
    - **Validates: Requirements 7.1, 7.2**

  - [x] 6.4 Write unit tests for ApiGenerator caching
    - Test cache directory is `_data/.api_cache/` (Requirement 5.1)
    - Test `lastUpdateIndex.json` is correctly reconstructed from cache for `site.data['last_updates']`
    - Test cache miss (empty directory) falls back to full generation
    - Test corrupted cache file (invalid JSON) falls back to full generation
    - Test `@@cached_last_updates` is set correctly from cache
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1_

- [x] 7. Add conditional regeneration to TileGenerator
  - [x] 7.1 Modify `_plugins/tile_generator.rb` to include GeneratorCache and add cache-or-generate logic
    - `include GeneratorCache` in the class
    - At the start of `generate`, read `site.config.fetch('contentful_data_changed', true)`
    - Set `cache_dir` to `File.join(site.source, '_data', '.tile_cache')`
    - If flag is `false` and `cache_available?(cache_dir)`: call `load_from_cache(cache_dir)` — read each cached JSON file, reconstruct `dir` and `filename` from relative path, create `PageWithoutAFile` with cached content
    - If flag is `true` or cache unavailable: run existing generation logic, then write each generated JSON string (pretty-printed) to cache via `write_cache_file` preserving directory structure
    - If flag is `false` but cache is empty/missing: log cache miss, fall back to full generation, populate cache
    - Add info-level log messages for cache hit (with file count), cache miss, and fresh generation
    - Handle corrupted cache files: log warning, fall back to full generation, clear and repopulate cache
    - _Requirements: 2.2, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4_

  - [x] 7.2 Write property test for Tile generator cache round-trip (Property 5)
    - **Property 5: Tile generator cache round-trip**
    - Create `spec/plugins/tile_generator_cache_spec.rb`
    - Generate random geolocated data within Switzerland bounds, run fresh generation, write cache, load cache, compare page contents byte-for-byte and directory/filename paths
    - Minimum 100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [x] 7.3 Write property test for Tile generator cache-hit logging (Property 9 — Tile part)
    - **Property 9: Generator cache-hit logging (Tile)**
    - Run TileGenerator with/without cache, capture log output, assert correct messages with file count
    - Minimum 100 iterations
    - **Validates: Requirements 7.3, 7.4**

  - [x] 7.4 Write unit tests for TileGenerator caching
    - Test cache directory is `_data/.tile_cache/` (Requirement 5.2)
    - Test cache preserves directory structure (`api/tiles/spots/de/index.json`, etc.)
    - Test cache miss (empty directory) falls back to full generation
    - Test corrupted cache file falls back to full generation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2_

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Verify CollectionGenerator independence and build output invariance
  - [x] 9.1 Verify `_plugins/collection_generator.rb` does NOT reference the change flag or any cache directory
    - Confirm CollectionGenerator has no dependency on `site.config['contentful_data_changed']`
    - Confirm CollectionGenerator does not read from or write to `.api_cache/` or `.tile_cache/`
    - If any references exist, remove them
    - _Requirements: 9.1, 9.2_

  - [x] 9.2 Write property test for CollectionGenerator independence (Property 7)
    - **Property 7: CollectionGenerator independence**
    - Create `spec/plugins/collection_generator_cache_spec.rb`
    - Set flag to random values (`true`, `false`, `nil`), run CollectionGenerator, assert documents created identically
    - Minimum 100 iterations
    - **Validates: Requirements 9.1**

  - [-] 9.3 Write property test for build output invariance (Property 6)
    - **Property 6: Build output invariance**
    - Create `spec/plugins/build_output_invariance_spec.rb`
    - Generate random data, run full pipeline fresh, then run with cache, compare all page objects (content, filename, directory) for byte-identical output
    - Minimum 100 iterations
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [~] 9.4 Write unit tests for build output invariance edge cases
    - Test that no extra files are added to `site.pages` when using cache
    - Test that no files are missing from `site.pages` when using cache
    - Test that `page.data['layout']` is `nil` for all cached pages (same as fresh)
    - _Requirements: 8.1, 8.2, 8.4_

- [~] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use the `rantly` gem with RSpec (`rspec-rantly`)
- The implementation must NOT change any build output — `_site/` must be byte-identical whether generators run fresh or serve from cache (Requirement 8)
- Cache directories use dot-prefixed names (`_data/.api_cache/`, `_data/.tile_cache/`) so Jekyll ignores them and Amplify's existing `_data/**/*` cache path preserves them
- Run tests with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
