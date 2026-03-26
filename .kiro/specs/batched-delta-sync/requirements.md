# Requirements Document

## Introduction

The Contentful delta sync in `ContentfulFetcher#perform_delta_merge` currently re-fetches each changed entry individually via `client.entry(entry_id, locale: '*', include: 2)`. When the Sync API reports N changed entries, this produces N separate HTTP requests to the Contentful Content Delivery API (CDA). This feature replaces those individual calls with batched `client.entries()` calls using the `sys.id[in]` filter, grouped by content type, to reduce the total number of HTTP requests per incremental build.

## Glossary

- **Delta_Sync**: The incremental synchronization path in `ContentfulFetcher` that merges only changed and deleted entries into the cached YAML data, as opposed to a full fetch of all content.
- **CDA**: The Contentful Content Delivery API, used to fetch published entries.
- **Batch_Fetcher**: The new component responsible for grouping entry IDs by content type and fetching them in batched `client.entries()` calls with `sys.id[in]` filtering.
- **Content_Type_Group**: A set of changed entry IDs that share the same Contentful content type, forming a single batch request unit.
- **Page**: A single response from the CDA containing up to 1000 entries. When a batch exceeds this limit, multiple pages are required.
- **ID_Batch_Size**: The maximum number of entry IDs that can be included in a single `sys.id[in]` filter value. Derived from the CDA URI request length limit of 7600 characters; with ~22-character entry IDs plus comma separators and ~150 characters of base URL overhead, this yields a safe maximum of approximately 300 IDs per request.
- **Entry_ID_Index**: The persistent mapping of Contentful entry IDs to slugs and content types, stored in `CacheMetadata` and used for deletion resolution.
- **Delta_Merge**: The process in `perform_delta_merge` that upserts changed entries and removes deleted entries from the cached YAML files.

## Requirements

### Requirement 1: Batch Grouping of Changed Entries

**User Story:** As a site maintainer, I want changed entries from the Sync API to be grouped by content type before fetching, so that each content type requires at most one batched API call instead of one call per entry.

#### Acceptance Criteria

1. WHEN the Delta_Sync receives a set of changed entries from the Sync API, THE Batch_Fetcher SHALL group entry IDs into Content_Type_Groups keyed by their content type ID.
2. THE Batch_Fetcher SHALL issue one `client.entries()` call per Content_Type_Group using the `sys.id[in]` filter containing all entry IDs in that group, provided the group does not exceed the ID_Batch_Size.
3. WHEN a Content_Type_Group contains ID_Batch_Size or fewer entry IDs, THE Batch_Fetcher SHALL fetch all entries in a single API call.
4. THE Batch_Fetcher SHALL pass `locale: '*'` and `include: 2` parameters on every batched request, matching the parameters used by the current individual `client.entry()` calls.

### Requirement 2: Pagination for Large Batches

**User Story:** As a site maintainer, I want batched fetches to handle content types with more than 1000 changed entries, so that no entries are silently dropped.

#### Acceptance Criteria

1. WHEN a batched `client.entries()` response contains 1000 entries (the CDA page size limit), THE Batch_Fetcher SHALL request subsequent pages using the `skip` parameter until all entries for that Content_Type_Group are retrieved.
2. THE Batch_Fetcher SHALL concatenate entries from all pages into a single collection before passing them to the Delta_Merge.
3. WHEN a Content_Type_Group contains more than ID_Batch_Size entry IDs, THE Batch_Fetcher SHALL split the IDs into sub-batches of ID_Batch_Size and issue one paginated request sequence per sub-batch, because the CDA URI request length is limited to 7600 characters.

### Requirement 3: Preserve Delta Merge Behavior

**User Story:** As a site maintainer, I want the batched fetch to produce the same merge results as the current per-entry fetch, so that no data is lost or corrupted during incremental builds.

#### Acceptance Criteria

1. THE Delta_Merge SHALL upsert each fetched entry using `ContentfulMappers.flatten_entry` with the same mapper method and extra arguments as the current implementation.
2. THE Delta_Merge SHALL update the Entry_ID_Index for every upserted entry with the entry's ID, slug, and content type.
3. THE Delta_Merge SHALL log each upsert as either "Updated" or "Inserted" with the entry slug and content type, matching the current logging format.
4. THE Delta_Merge SHALL continue to remove deleted entries, update modified YAML files, reload site data, and compute the content hash change flag identically to the current implementation.
5. WHEN the Batch_Fetcher returns entries, THE Delta_Merge SHALL process all entries for a given content type before proceeding to the next content type.

### Requirement 4: Graceful Fallback on Batch Fetch Failure

**User Story:** As a site maintainer, I want the build to recover automatically if a batched API call fails, so that a transient Contentful error does not break the build.

#### Acceptance Criteria

1. IF a batched `client.entries()` call raises an error, THEN THE Batch_Fetcher SHALL log a warning message containing the content type ID and the error message.
2. IF a batched fetch fails for a Content_Type_Group, THEN THE Delta_Merge SHALL fall back to fetching each entry in that group individually using `client.entry(entry_id, locale: '*', include: 2)`.
3. IF both the batched fetch and all individual fallback fetches fail for an entry, THEN THE Delta_Merge SHALL log a warning and skip that entry without aborting the entire delta merge.
4. IF the entire delta merge fails after fallback attempts, THEN THE ContentfulFetcher SHALL fall back to a full sync, matching the current rescue behavior in `perform_delta_merge`.

### Requirement 5: Batch Fetch Observability Logging

**User Story:** As a site maintainer, I want the build log to show how the batch fetcher grouped and fetched entries, so that I can diagnose sync issues and verify the optimization is working.

#### Acceptance Criteria

1. BEFORE fetching a Content_Type_Group, THE Batch_Fetcher SHALL log an info message stating the content type ID, the number of entry IDs in the group, and the number of sub-batches that will be issued.
2. AFTER successfully fetching a Content_Type_Group, THE Batch_Fetcher SHALL log an info message stating the content type ID and the total number of entries retrieved.
3. WHEN pagination is used for a sub-batch, THE Batch_Fetcher SHALL log an info message for each additional page fetched, stating the content type ID and the page offset.
4. WHEN the Batch_Fetcher falls back to individual fetches for a Content_Type_Group, THE Batch_Fetcher SHALL log a warning message stating the content type ID and the number of entries being fetched individually.
5. AFTER all Content_Type_Groups have been fetched, THE Batch_Fetcher SHALL log a summary info message stating the total number of entries fetched and the total number of API calls made.

### Requirement 6: Reduction in HTTP Request Count

**User Story:** As a site maintainer, I want the number of HTTP requests during delta sync to be proportional to the number of distinct content types changed rather than the number of individual entries changed, so that builds complete faster.

#### Acceptance Criteria

1. WHEN N entries across C distinct content types are changed and each Content_Type_Group contains ID_Batch_Size or fewer entries, THE Batch_Fetcher SHALL issue exactly C batched API calls instead of N individual calls.
2. WHEN a Content_Type_Group contains more than ID_Batch_Size entries, THE Batch_Fetcher SHALL issue ceil(entry_count / ID_Batch_Size) batched API calls for that group.
