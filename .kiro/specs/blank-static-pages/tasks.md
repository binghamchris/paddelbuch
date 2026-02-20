# Blank Static Pages Bugfix Tasks

## Task 1: Exploratory Testing — Confirm Root Causes on Unfixed Code

- [x] 1.1 Write an exploratory test in `spec/contentful_mappers_spec.rb` that calls `map_static_page` with a rich text content field (both Hash-style and object-style) and asserts `result['content']` is non-empty HTML. Run on unfixed code to confirm the content mapping failure.
  - File: `spec/contentful_mappers_spec.rb`
  - Acceptance: Test demonstrates that `map_static_page` returns nil content for rich text input formats that `resolve_field` rejects
- [x] 1.2 Write an exploratory test in `spec/collection_generator_spec.rb` that creates a static page entry with `title` but no `name` field, passes it through `create_document`, and asserts `doc.data['title']` equals the entry's title. Run on unfixed code to confirm the title overwrite.
  - File: `spec/collection_generator_spec.rb`
  - Acceptance: Test demonstrates that `create_document` overwrites title with slug when `entry['name']` is nil

## Task 2: Fix Content Mapping in `map_static_page`

- [x] 2.1 Fix `resolve_field` or `map_static_page` in `_plugins/contentful_mappers.rb` to handle rich text fields that are not wrapped in a plain `{ locale_sym: value }` Hash. Ensure `resolve_field` returns the rich text object/value instead of nil when `fields[field_name]` is not a Hash (e.g., pass it through directly, or handle the case where the value is a rich text document object).
  - File: `_plugins/contentful_mappers.rb`
  - Acceptance: `map_static_page` returns non-empty HTML in `content` for entries with rich text content fields
- [x] 2.2 Verify that existing mappers (`map_spot`, `map_obstacle`, `map_event_notice`) still produce correct rich text HTML for their `description` fields after the change.
  - Run: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/contentful_mappers_spec.rb`
  - Acceptance: All existing mapper tests pass

## Task 3: Fix Title Assignment in `CollectionGenerator#create_document`

- [x] 3.1 Change the title assignment in `_plugins/collection_generator.rb` `create_document` method from `doc.data['title'] = entry['name'] || slug` to `doc.data['title'] = entry['name'] || entry['title'] || slug` so that static pages (which use `title` instead of `name`) retain their correct title.
  - File: `_plugins/collection_generator.rb`
  - Acceptance: Static page documents have `data['title']` equal to the entry's `title` value, not the slug
- [x] 3.2 Verify that collections using `name` (spots, waterways, obstacles, notices) still get their title set from `entry['name']` as before.
  - Acceptance: `create_document` for a spot entry with `name: "Test Spot"` sets `doc.data['title']` to `"Test Spot"`

## Task 4: Unit Tests for the Fix

- [x] 4.1 Add unit tests in `spec/contentful_mappers_spec.rb` for `map_static_page` covering: (a) rich text content as Hash with `'content'` key, (b) rich text content as object with `.content` method, (c) nil content field, (d) both `de` and `en` locales.
  - File: `spec/contentful_mappers_spec.rb`
  - Acceptance: All new tests pass with the fixed code
- [x] 4.2 Add unit tests in `spec/collection_generator_spec.rb` for `create_document` covering: (a) static page entry with `title` but no `name`, (b) spot entry with `name`, (c) entry with neither `name` nor `title` falls back to slug, (d) permalink generation for static pages.
  - File: `spec/collection_generator_spec.rb`
  - Acceptance: All new tests pass with the fixed code

## Task 5: Property-Based Tests

- [x] 5.1 [PBT-exploration] Add a property-based test in `spec/contentful_sync_properties_spec.rb` that generates random static page entries with rich text content and verifies `map_static_page` always produces a non-nil, non-empty `content` string. Run on UNFIXED code first to surface counterexamples.
  - File: `spec/contentful_sync_properties_spec.rb`
  - Property: Property 1 — For any staticPage entry with non-empty rich text content, `map_static_page` SHALL produce non-empty HTML content
- [x] 5.2 [PBT-preservation] Add a property-based test in `spec/contentful_sync_properties_spec.rb` that generates random non-static-page entries and verifies all existing mappers produce identical output before and after the fix.
  - File: `spec/contentful_sync_properties_spec.rb`
  - Property: Property 3 — For any non-staticPage content type, the fixed code SHALL produce the same mapping output as the original code
- [~] 5.3 [PBT-preservation] Add a property-based test that generates random entry hashes with various combinations of `name`/`title`/neither and verifies `create_document` title logic is correct for both static_pages and other collection types.
  - File: `spec/collection_generator_spec.rb`
  - Property: Property 2 — For any static page entry with a `title` field, `create_document` SHALL set `data['title']` to the entry's title, not the slug

## Task 6: Run Full Test Suite and Verify

- [~] 6.1 Run the full RSpec test suite to verify all existing and new tests pass.
  - Run: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
  - Acceptance: All tests pass, zero failures
