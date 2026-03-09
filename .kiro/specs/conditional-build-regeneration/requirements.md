# Requirements Document

## Introduction

The paddelbuch Jekyll site fetches content from Contentful CMS and runs several expensive generator plugins (API JSON generation, spatial tile generation) on every build — even when the underlying Contentful data has not changed. This feature introduces conditional build regeneration: a content-hash-based change detection mechanism that allows `ApiGenerator` and `TileGenerator` to skip expensive transform/sort/serialize work and instead serve cached output when the data is unchanged. The `CollectionGenerator` always runs because Jekyll page rendering depends on it, but it is already fast. Cached generator output is persisted in subdirectories under `_data/` so that Amplify's existing `_data/**/*` cache directive preserves them between builds.

## Glossary

- **ContentfulFetcher**: Jekyll Generator plugin (priority :highest) that fetches content from the Contentful CMS, writes YAML files to `_data/`, and performs sync-based change detection via `SyncChecker` and `CacheMetadata`.
- **CacheMetadata**: Helper class that persists sync metadata (sync token, timestamps, space ID, environment) to `_data/.contentful_sync_cache.yml`.
- **ApiGenerator**: Jekyll Generator plugin (priority :low) that produces JSON API files (fact tables, dimension tables, lastUpdateIndex) for all locales.
- **TileGenerator**: Jekyll Generator plugin (priority :low) that produces spatial tile JSON files for map viewport loading.
- **CollectionGenerator**: Jekyll Generator plugin (priority :high) that creates Jekyll Document objects from YAML data for page rendering.
- **Content_Hash**: A SHA-256 digest computed over the YAML data files written by ContentfulFetcher, used to detect whether content has changed between builds.
- **Api_Cache**: A persistent cache directory (`_data/.api_cache/`) that stores the most recent ApiGenerator JSON output keyed by filename.
- **Tile_Cache**: A persistent cache directory (`_data/.tile_cache/`) that stores the most recent TileGenerator JSON output keyed by directory and filename.
- **Change_Flag**: A boolean value stored in `site.config['contentful_data_changed']` that signals to downstream generators whether Contentful data has changed since the last build.
- **Amplify_Build_Pipeline**: The AWS Amplify CI/CD pipeline that builds the Jekyll site and caches `_data/**/*` between builds.

## Requirements

### Requirement 1: Content Hash Computation

**User Story:** As a site maintainer, I want the build system to compute a hash of the fetched Contentful data, so that downstream generators can determine whether the data has actually changed.

#### Acceptance Criteria

1. WHEN ContentfulFetcher completes a full or incremental fetch that writes new YAML files, THE CacheMetadata SHALL compute a SHA-256 hash over the sorted, concatenated contents of all YAML data files written by ContentfulFetcher and store the hash as `content_hash` in the cache metadata file.
2. WHEN ContentfulFetcher completes a fetch and the computed Content_Hash matches the previously stored Content_Hash, THE ContentfulFetcher SHALL set the Change_Flag to `false`.
3. WHEN ContentfulFetcher completes a fetch and the computed Content_Hash differs from the previously stored Content_Hash, THE ContentfulFetcher SHALL set the Change_Flag to `true`.
4. WHEN ContentfulFetcher skips fetching because the Contentful Sync API reports no changes, THE ContentfulFetcher SHALL set the Change_Flag to `false` without recomputing the Content_Hash.
5. WHEN no previously stored Content_Hash exists in the cache metadata, THE ContentfulFetcher SHALL treat the data as changed and set the Change_Flag to `true`.

### Requirement 2: Change Flag Propagation

**User Story:** As a plugin developer, I want a single, well-defined flag that indicates whether Contentful data changed, so that each generator can independently decide whether to regenerate or use cached output.

#### Acceptance Criteria

1. THE ContentfulFetcher SHALL store the Change_Flag in `site.config['contentful_data_changed']` before any lower-priority generators execute.
2. WHEN the Change_Flag is not set (e.g., ContentfulFetcher did not run due to missing credentials), THE ApiGenerator and TileGenerator SHALL treat the data as changed and perform a full generation.

### Requirement 3: ApiGenerator Conditional Regeneration

**User Story:** As a site maintainer, I want the API JSON generation step to be skipped when Contentful data has not changed, so that build times are reduced.

#### Acceptance Criteria

1. WHEN the Change_Flag is `true`, THE ApiGenerator SHALL generate all JSON API files (fact tables, dimension tables, lastUpdateIndex) and write a copy of each generated JSON file to the Api_Cache directory using the same relative filename.
2. WHEN the Change_Flag is `false` and the Api_Cache directory contains cached files, THE ApiGenerator SHALL load each cached JSON file from the Api_Cache directory and inject the content as Jekyll page objects — skipping all transform, sort, and serialize work.
3. WHEN the Change_Flag is `false` and the Api_Cache directory is empty or missing, THE ApiGenerator SHALL fall back to full generation and populate the Api_Cache directory.
4. THE ApiGenerator SHALL produce identical JSON output regardless of whether the output was generated fresh or loaded from the Api_Cache.

### Requirement 4: TileGenerator Conditional Regeneration

**User Story:** As a site maintainer, I want the spatial tile generation step to be skipped when Contentful data has not changed, so that build times are reduced.

#### Acceptance Criteria

1. WHEN the Change_Flag is `true`, THE TileGenerator SHALL generate all spatial tile JSON files and write a copy of each generated JSON file to the Tile_Cache directory preserving the relative directory structure.
2. WHEN the Change_Flag is `false` and the Tile_Cache directory contains cached files, THE TileGenerator SHALL load each cached JSON file from the Tile_Cache directory and inject the content as Jekyll page objects — skipping all spatial computation, sorting, and serialization work.
3. WHEN the Change_Flag is `false` and the Tile_Cache directory is empty or missing, THE TileGenerator SHALL fall back to full generation and populate the Tile_Cache directory.
4. THE TileGenerator SHALL produce identical JSON output regardless of whether the output was generated fresh or loaded from the Tile_Cache.

### Requirement 5: Cache Persistence Compatibility

**User Story:** As a DevOps engineer, I want the generator caches to be stored under `_data/` so that the existing Amplify build cache configuration preserves them between builds without any changes to `amplify.yml`.

#### Acceptance Criteria

1. THE Api_Cache directory SHALL be located at `_data/.api_cache/`.
2. THE Tile_Cache directory SHALL be located at `_data/.tile_cache/`.
3. THE Api_Cache and Tile_Cache directories SHALL use dot-prefixed names so that Jekyll does not attempt to load the JSON files as site data.
4. THE Amplify_Build_Pipeline SHALL cache the Api_Cache and Tile_Cache directories between builds via the existing `_data/**/*` cache path — no changes to `amplify.yml` are required.

### Requirement 6: Force Regeneration Override

**User Story:** As a site maintainer, I want to be able to force a full regeneration of all generators regardless of the Change_Flag, so that I can recover from corrupted caches or verify output correctness.

#### Acceptance Criteria

1. WHEN the `CONTENTFUL_FORCE_SYNC` environment variable is set to `true`, THE ContentfulFetcher SHALL set the Change_Flag to `true` regardless of the Content_Hash comparison result.
2. WHEN the `force_contentful_sync` config option is set to `true`, THE ContentfulFetcher SHALL set the Change_Flag to `true` regardless of the Content_Hash comparison result.

### Requirement 7: Build Logging for Cache Behavior

**User Story:** As a site maintainer, I want clear log messages that indicate whether each generator used cached output or performed a full generation, so that I can diagnose build behavior.

#### Acceptance Criteria

1. WHEN the ApiGenerator uses cached output, THE ApiGenerator SHALL log an info-level message stating that cached API files are being used and the number of files loaded.
2. WHEN the ApiGenerator performs a full generation, THE ApiGenerator SHALL log an info-level message stating that API files are being generated.
3. WHEN the TileGenerator uses cached output, THE TileGenerator SHALL log an info-level message stating that cached tile files are being used and the number of files loaded.
4. WHEN the TileGenerator performs a full generation, THE TileGenerator SHALL log an info-level message stating that tile files are being generated.
5. WHEN ContentfulFetcher sets the Change_Flag, THE ContentfulFetcher SHALL log an info-level message stating the flag value and the reason (hash match, hash mismatch, no previous hash, force sync, or sync API reported no changes).

### Requirement 8: Build Output Invariance

**User Story:** As a site maintainer, I want the conditional regeneration feature to produce byte-identical build output compared to a build without the feature, so that I can adopt it with confidence that no content, API responses, or tile data are altered.

#### Acceptance Criteria

1. FOR every file written to `_site/`, THE build output SHALL be byte-identical whether the file was generated fresh or served from a generator cache.
2. THE set of files written to `_site/` SHALL be identical regardless of whether generators used cached output or performed full generation — no files shall be added, removed, or renamed.
3. THE conditional regeneration feature SHALL NOT alter the content, structure, or encoding of any HTML page, JSON API file, spatial tile file, sitemap, or any other build artifact.
4. THE conditional regeneration feature SHALL NOT modify the behavior of any existing plugin beyond adding the cache-check-and-skip logic described in this specification.

### Requirement 9: CollectionGenerator Independence

**User Story:** As a plugin developer, I want the CollectionGenerator to remain unaffected by the conditional regeneration mechanism, so that Jekyll page rendering continues to work correctly.

#### Acceptance Criteria

1. THE CollectionGenerator SHALL execute on every build regardless of the Change_Flag value.
2. THE CollectionGenerator SHALL not read from or write to any generator cache directory.
