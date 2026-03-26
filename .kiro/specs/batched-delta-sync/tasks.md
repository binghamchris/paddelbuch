# Tasks: Batched Delta Sync

## Task 1: Create BatchFetcher module
- [x] 1.1 Create `_plugins/batch_fetcher.rb` with module skeleton, `ID_BATCH_SIZE = 300` constant, and `include` in `ContentfulFetcher`
- [x] 1.2 Implement `fetch_changed_entries_batched(client, changed_entries)` — extract entry IDs from sync items, group by content type, delegate to `fetch_content_type_batch`, track total API call count, and log summary after all groups are fetched
- [x] 1.3 Implement `fetch_content_type_batch(client, content_type_id, entry_ids)` — log group size and sub-batch count before fetching, split IDs into sub-batches of `ID_BATCH_SIZE`, call `fetch_sub_batch` for each, concatenate results, log total fetched count
- [x] 1.4 Implement `fetch_sub_batch(client, content_type_id, id_batch)` — call `client.entries(content_type:, 'sys.id[in]':, locale: '*', include: 2, limit: 1000)` with pagination via `skip`, logging each additional page offset
- [x] 1.5 Implement `fetch_entries_individually(client, entry_ids)` — fallback that calls `client.entry(id, locale: '*', include: 2)` per ID, logging a warning with entry count on fallback entry and logging each individual failure

## Task 2: Integrate BatchFetcher into perform_delta_merge
- [x] 2.1 Add `require_relative 'batch_fetcher'` and `include BatchFetcher` to `ContentfulFetcher`
- [x] 2.2 Replace Phase 2 loop in `perform_delta_merge` — call `fetch_changed_entries_batched`, then iterate results with existing upsert logic
- [x] 2.3 Add error handling: wrap batch fetch in begin/rescue, fall back to individual fetches per content type group on failure

## Task 3: Update existing tests in contentful_fetcher_spec.rb
- [x] 3.1 Update `spec/contentful_fetcher_spec.rb` `perform_delta_merge` tests — change mocks from `client.entry` (singular) to `client.entries` (batched) for: upsert tests, insert tests, mixed upsert/delete tests, YAML write tests, site.data update tests, Entry ID Index update tests, and `map_type` extra argument tests. Keep the same assertions on YAML output, site.data, and index state.
- [x] 3.2 Update `spec/contentful_fetcher_spec.rb` `perform_delta_merge` parameter tests — replace "calls client.entry with locale: '*' and include: 2" and "calls client.entry once per changed entry" with tests that verify `client.entries` is called with `sys.id[in]`, `locale: '*'`, `include: 2`, and `content_type:` parameters.
- [x] 3.3 Update `spec/contentful_fetcher_spec.rb` `perform_delta_merge` fallback tests — update "falls back to full fetch when client.entry raises" to test the new two-level fallback: batch `client.entries` fails → individual `client.entry` fallback → full sync fallback. Update "falls back to full fetch when ContentfulMappers.flatten_entry raises" to work with batched results.
- [x] 3.4 Update `spec/contentful_fetcher_spec.rb` `perform_delta_merge` logging tests — add tests for the new batch-level log messages (group size, sub-batch count, fetch summary) alongside the existing upsert/delete/unknown type log assertions.

## Task 4: Write BatchFetcher unit tests
- [x] 4.1 Create `spec/batch_fetcher_spec.rb` with unit tests: single entry, boundary at 300, sub-batching at 301, multiple content types, empty input, pagination, fallback scenarios, and observability log messages

## Task 5: Write property-based tests
- [x] 5.1 Create `spec/batch_fetcher_properties_spec.rb` with Property 1: grouping preserves all entry IDs by content type
- [x] 5.2 Property 2: batch call count matches ceil(group_size / ID_BATCH_SIZE) formula
- [x] 5.3 Property 3: pagination collects all entries across pages
- [x] 5.4 Property 4: every batched request includes locale: '*' and include: 2
- [x] 5.5 Property 5: batch failure triggers individual fallback for all IDs in the failed group

## Task 6: Update project documentation
- [x] 6.1 Update `docs/plugins.md` — Add `BatchFetcher` to the Support Modules section (purpose, public method signature, constants). Update the `ContentfulFetcher` section: change sync strategy step 7 to describe batched fetching instead of individual per-entry fetches, and add `BatchFetcher` to its Dependencies list.
- [x] 6.2 Update `README.md` — Add `batch_fetcher.rb` to the `_plugins/` listing in the Project Structure section. Update the Contentful Integration section to mention batched delta fetching.
