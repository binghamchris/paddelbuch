# Requirements Document

## Introduction

The Contentful sync pipeline currently re-fetches all entries for all 13 content types whenever the Sync API reports any changes. This is wasteful because the Sync API delta already contains the actual changed and deleted entries. This feature introduces direct delta merge: the `SyncChecker` module will extract individual changed and deleted entries from the sync delta, and `ContentfulFetcher` will merge those entries directly into the cached YAML data files — upserting changed entries and removing deleted entries — without re-fetching any content type in its entirety. Unchanged content types remain untouched. Individual changed entries are re-fetched via `client.entry` with `include: 2` to ensure linked references are fully resolved for the mappers. This approach minimizes Contentful API calls to at most one per changed entry, rather than one per affected content type (which can contain hundreds of entries).

## Glossary

- **SyncChecker**: The Ruby module (`_plugins/sync_checker.rb`) that communicates with the Contentful Sync API to detect changes since the last sync token.
- **ContentfulFetcher**: The Jekyll Generator plugin (`_plugins/contentful_fetcher.rb`, priority `:highest`) that orchestrates content fetching, mapping, and YAML file writing.
- **CacheMetadata**: The Ruby class (`_plugins/cache_metadata.rb`) that persists sync tokens, content hashes, environment metadata, and the Entry_ID_Index in `.contentful_sync_cache.yml`.
- **SyncResult**: The Struct returned by `SyncChecker#check_for_changes` containing sync outcome data including delta items.
- **Content_Type_ID**: The Contentful content type identifier string (e.g., `'spot'`, `'waterway'`, `'obstacle'`) used to distinguish entry types.
- **Sync_Delta**: The set of changed, deleted, or published entries returned by the Contentful Sync API for a given sync token.
- **YAML_Data_File**: A YAML file in `_data/` that stores mapped Contentful entries for a specific content type (e.g., `_data/spots.yml`).
- **CONTENT_TYPES**: The constant hash in ContentfulFetcher that maps each Content_Type_ID to its filename and mapper method.
- **Delta_Entry**: A single changed or new Contentful entry present in the Sync_Delta, containing `sys` metadata and `fields`.
- **Deleted_Entry**: A single deleted Contentful entry present in the Sync_Delta, containing only `sys` metadata (no `fields`).
- **Entry_ID_Index**: A persistent mapping from Contentful entry `sys.id` to `{ content_type, slug }` stored in the cache metadata, used to locate entries in YAML data for deletion.
- **Delta_Merge**: The process of upserting changed entries and removing deleted entries directly in cached YAML_Data_Files, without re-fetching entire content types.
- **Locale_Row**: A single hash within a YAML_Data_File array, uniquely identified by the combination of `slug` and `locale` fields. Each Contentful entry produces two Locale_Rows (one for `de`, one for `en`).

## Requirements

### Requirement 1: Extract Delta Items from Sync Response

**User Story:** As a site builder, I want the sync checker to extract individual changed and deleted entries from the sync delta, so that the fetcher can merge them directly into cached data.

#### Acceptance Criteria

1. WHEN the Contentful Sync API returns a Sync_Delta, THE SyncChecker SHALL separate the delta items into a list of Delta_Entries (changed/new entries) and a list of Deleted_Entries.
2. WHEN a Delta_Entry has a `sys.contentType.sys.id` that is not present in the CONTENT_TYPES constant, THE SyncChecker SHALL exclude that Delta_Entry from the results.
3. WHEN a Deleted_Entry has a `sys.contentType.sys.id` that is not present in the CONTENT_TYPES constant, THE SyncChecker SHALL exclude that Deleted_Entry from the results.
4. THE SyncChecker SHALL extract the Content_Type_ID from each Delta_Entry via `sys.contentType.sys.id`.
5. THE SyncChecker SHALL extract the Content_Type_ID from each Deleted_Entry via `sys.contentType.sys.id`.
6. WHEN the Sync_Delta is empty, THE SyncChecker SHALL return empty lists for both Delta_Entries and Deleted_Entries.

### Requirement 2: Extend SyncResult to Carry Delta Items

**User Story:** As a developer, I want the SyncResult struct to include the lists of changed and deleted entries, so that ContentfulFetcher can perform a delta merge.

#### Acceptance Criteria

1. THE SyncResult SHALL include a `changed_entries` field containing the list of Delta_Entries grouped by Content_Type_ID.
2. THE SyncResult SHALL include a `deleted_entries` field containing the list of Deleted_Entries grouped by Content_Type_ID.
3. WHEN no changes are detected, THE SyncResult SHALL set both `changed_entries` and `deleted_entries` to empty collections.
4. THE SyncResult SHALL continue to include the existing `success`, `has_changes`, `new_token`, `items_count`, and `error` fields without modification.

### Requirement 3: Delta Merge into Cached YAML Data

**User Story:** As a site builder, I want changed entries to be upserted and deleted entries to be removed directly in the cached YAML files, so that Contentful API calls are minimized to one per changed entry instead of one per affected content type.

#### Acceptance Criteria

1. WHEN the SyncResult contains Delta_Entries for a Content_Type_ID, THE ContentfulFetcher SHALL re-fetch each changed entry individually via `client.entry(entry_id, locale: '*', include: 2)` to obtain fully resolved linked references.
2. WHEN a changed entry is re-fetched, THE ContentfulFetcher SHALL map the entry using `ContentfulMappers.flatten_entry` with the mapper method from CONTENT_TYPES, producing two Locale_Rows (one per locale).
3. WHEN the mapped Locale_Rows have a `slug` and `locale` combination that matches existing rows in the YAML_Data_File, THE ContentfulFetcher SHALL replace those existing rows with the new Locale_Rows (upsert).
4. WHEN the mapped Locale_Rows have a `slug` and `locale` combination that does not match any existing row in the YAML_Data_File, THE ContentfulFetcher SHALL append the new Locale_Rows to the YAML_Data_File array (insert).
5. WHEN the SyncResult contains Deleted_Entries, THE ContentfulFetcher SHALL look up each Deleted_Entry's `sys.id` in the Entry_ID_Index to determine the slug and Content_Type_ID.
6. WHEN a deleted entry's slug is resolved, THE ContentfulFetcher SHALL remove all Locale_Rows matching that slug from the corresponding YAML_Data_File (both `de` and `en` rows).
7. WHEN a Content_Type_ID has no Delta_Entries and no Deleted_Entries, THE ContentfulFetcher SHALL leave the corresponding YAML_Data_File unchanged (zero API calls for that content type).
8. AFTER all upserts and deletions are applied, THE ContentfulFetcher SHALL write the modified YAML_Data_Files to disk and update `site.data` accordingly.
9. IF re-fetching an individual changed entry via `client.entry` fails, THEN THE ContentfulFetcher SHALL log the error and fall back to a full fetch of all content types.

### Requirement 4: Full Fetch Fallback

**User Story:** As a site builder, I want the system to fall back to a full fetch of all content types when delta merge cannot be performed safely, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN the SyncResult indicates a sync failure (`success?` returns false), THE ContentfulFetcher SHALL fetch all 13 content types via the existing full fetch path.
2. WHEN a force sync is requested via `CONTENTFUL_FORCE_SYNC` or `force_contentful_sync`, THE ContentfulFetcher SHALL fetch all 13 content types regardless of delta contents.
3. WHEN no valid cache metadata exists, THE ContentfulFetcher SHALL fetch all 13 content types via the existing full fetch path.
4. WHEN the environment configuration has changed since the last sync, THE ContentfulFetcher SHALL fetch all 13 content types via the existing full fetch path.
5. WHEN a delta merge operation fails for any entry (e.g., individual entry re-fetch error, mapping error, or YAML write error), THE ContentfulFetcher SHALL fall back to a full fetch of all 13 content types.
6. WHEN the Entry_ID_Index cannot resolve a Deleted_Entry's `sys.id` to a slug, THE ContentfulFetcher SHALL fall back to a full fetch of all 13 content types.

### Requirement 5: Content Hash Computation Consistency

**User Story:** As a developer, I want the content hash to remain consistent regardless of whether content was merged via delta or fetched fully, so that the change detection flag is accurate.

#### Acceptance Criteria

1. AFTER a delta merge completes, THE CacheMetadata SHALL compute the content hash over all YAML_Data_Files (both modified and unmodified).
2. THE ContentfulFetcher SHALL set `site.config['contentful_data_changed']` to true when the computed content hash differs from the previously cached content hash.
3. THE ContentfulFetcher SHALL set `site.config['contentful_data_changed']` to false when the computed content hash matches the previously cached content hash.

### Requirement 6: YAML Data Loading After Delta Merge

**User Story:** As a developer, I want all content types to be loaded into `site.data` after a delta merge, so that downstream generators and templates have access to complete data.

#### Acceptance Criteria

1. AFTER a delta merge completes, THE ContentfulFetcher SHALL load all YAML_Data_Files into `site.data`, including both modified and unmodified files.
2. THE ContentfulFetcher SHALL populate `site.data` entries using the same key structure as freshly fetched content types (supporting both flat and nested paths like `types/spot_types`).
3. WHEN a YAML_Data_File does not exist on disk for a content type after delta merge, THE ContentfulFetcher SHALL fall back to fetching that content type from Contentful.

### Requirement 7: Entry ID to Slug Index

**User Story:** As a developer, I want a persistent mapping from Contentful entry IDs to slugs, so that deleted entries (which lack fields) can be located in the YAML data for removal.

#### Acceptance Criteria

1. THE CacheMetadata SHALL store an Entry_ID_Index that maps each Contentful entry `sys.id` to its slug and Content_Type_ID.
2. WHEN a full fetch is performed, THE ContentfulFetcher SHALL build the Entry_ID_Index from all fetched entries and persist the index via CacheMetadata.
3. WHEN a delta merge upserts a new entry, THE ContentfulFetcher SHALL add the entry's `sys.id`, slug, and Content_Type_ID to the Entry_ID_Index.
4. WHEN a delta merge removes a deleted entry, THE ContentfulFetcher SHALL remove the entry's `sys.id` from the Entry_ID_Index.
5. THE Entry_ID_Index SHALL be persisted in the cache metadata file so that the index survives across builds.

### Requirement 8: Individual Entry Re-Fetching with Link Resolution

**User Story:** As a developer, I want individual changed entries to be re-fetched with resolved linked references, so that the mappers can extract reference slugs correctly.

#### Acceptance Criteria

1. WHEN a Delta_Entry is identified for upsert, THE ContentfulFetcher SHALL fetch the entry via `client.entry(entry_id, locale: '*', include: 2)` to resolve linked entries up to 2 levels deep.
2. THE ContentfulFetcher SHALL pass the re-fetched entry (with resolved links) to `ContentfulMappers.flatten_entry`, not the raw Sync_Delta entry.
3. WHEN the `map_type` mapper is used, THE ContentfulFetcher SHALL pass the Content_Type_ID as the extra argument so that type-specific fields are included.
4. IF the `client.entry` call fails for a specific entry, THEN THE ContentfulFetcher SHALL log the entry `sys.id` and Content_Type_ID in the error message.

### Requirement 9: Logging and Observability

**User Story:** As a developer, I want clear log output during delta merge, so that I can verify which entries were upserted, deleted, and which content types were left unchanged.

#### Acceptance Criteria

1. WHEN a delta merge is performed, THE ContentfulFetcher SHALL log the total number of changed entries and deleted entries from the Sync_Delta.
2. WHEN an entry is upserted into a YAML_Data_File, THE ContentfulFetcher SHALL log the entry slug, Content_Type_ID, and whether the operation was an insert or an update.
3. WHEN an entry is removed from a YAML_Data_File, THE ContentfulFetcher SHALL log the entry slug and Content_Type_ID.
4. WHEN a content type has no delta changes, THE ContentfulFetcher SHALL log that the content type was left unchanged.
5. WHEN a fallback to full fetch is triggered during delta merge, THE ContentfulFetcher SHALL log the reason for the fallback.
6. WHEN the Sync_Delta contains entries with a Content_Type_ID not present in the CONTENT_TYPES constant, THE ContentfulFetcher SHALL log a warning message including the unknown Content_Type_ID, so that developers are aware a new content type may need a mapper added.
