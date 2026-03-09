# Blank Static Pages Bugfix Design

## Overview

Static pages fetched from Contentful render blank because of two independent bugs in the content pipeline:

1. The `map_static_page` mapper in `_plugins/contentful_mappers.rb` calls `resolve_field(fields, :content, locale)` which returns `nil` for rich text fields. The `resolve_field` method guards with `field_hash.is_a?(Hash)` but the Contentful Ruby SDK may return rich text locale data in a form that fails this check (e.g., the field value is a RichText document object rather than a `{ locale: value }` hash). When `resolve_field` returns `nil`, `extract_rich_text_html` short-circuits and returns `nil`, producing empty `content` values in `_data/static_pages.yml`.

2. The `CollectionGenerator#create_document` in `_plugins/collection_generator.rb` unconditionally sets `doc.data['title'] = entry['name'] || slug`. Static pages use a `title` field (not `name`), so `entry['name']` is always `nil` and the title is overwritten with the slug string, even though the correct title was already copied in the `entry.each` loop above.

The fix is minimal and targeted: make `resolve_field` (or `map_static_page`) robust to rich text field formats, and make `create_document` preserve the existing `title` for collections that don't use `name`.

## Glossary

- **Bug_Condition (C)**: The conjunction of conditions that trigger blank static pages — rich text content resolving to nil AND title being overwritten with slug
- **Property (P)**: Static pages render with their full Contentful rich text content and correct title
- **Preservation**: All existing behavior for spots, waterways, obstacles, notices, and type mappings must remain unchanged
- **`resolve_field`**: Method in `ContentfulMappers` (`_plugins/contentful_mappers.rb`) that extracts a locale-specific value from `fields_with_locales`
- **`extract_rich_text_html`**: Method in `ContentfulMappers` that converts Contentful rich text (object or Hash) into HTML
- **`map_static_page`**: Mapper method in `ContentfulMappers` that transforms a Contentful `staticPage` entry into a Jekyll-friendly hash
- **`create_document`**: Private method in `CollectionGenerator` (`_plugins/collection_generator.rb`) that creates a virtual `Jekyll::Document` from YAML data
- **`fields_with_locales`**: Contentful Ruby SDK method returning `{ field_name_sym: { locale_sym: value } }` for entries fetched with `locale: '*'`

## Bug Details

### Fault Condition

The bug manifests when a `staticPage` entry is fetched from Contentful and processed through the mapping and collection generation pipeline. Two independent faults combine to produce blank pages:

**Fault 1 — Content Lost in Mapping**: `resolve_field(fields, :content, locale)` returns `nil` because the rich text field from `fields_with_locales` does not pass the `field_hash.is_a?(Hash)` guard. This causes `extract_rich_text_html(nil)` to return `nil`.

**Fault 2 — Title Overwritten in Collection Generation**: `create_document` sets `doc.data['title'] = entry['name'] || slug` after already copying all entry fields (including the correct `title`) via the `entry.each` loop. Since static pages have no `name` field, this evaluates to `slug`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { entry: ContentfulEntry, contentType: String }
  OUTPUT: boolean

  RETURN input.contentType == 'staticPage'
         AND (
           resolveField(entry.fields_with_locales, :content, locale) returns nil
           OR createDocument overwrites title with slug because entry['name'] is nil
         )
END FUNCTION
```

### Examples

- **Example 1**: Static page "Datenlizenzen" with rich text content in Contentful → `_data/static_pages.yml` shows `content:` (nil) and after CollectionGenerator, `title` becomes `"datenlizenzen"` instead of `"Datenlizenzen"` → page renders blank with slug as title
- **Example 2**: Static page "Das Projekt" with paragraphs and links in Contentful → `content:` is nil in YAML, `title` becomes `"projekt"` → page renders blank
- **Example 3**: Static page "Datenschutzrichtlinie" → same pattern, content nil, title becomes slug
- **Edge case**: A spot entry with a `description` rich text field → works correctly because `map_spot` calls `extract_rich_text_html(resolve_field(fields, :description, locale))` and the description field resolves properly (different field, same mechanism — suggests the issue may be specific to how the `:content` field name interacts with the SDK)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `map_spot` must continue to correctly convert rich text `description` fields into HTML
- `map_obstacle` must continue to correctly convert rich text `description` and `portage_description` fields into HTML
- `map_event_notice` must continue to correctly convert rich text `description` fields into HTML
- `CollectionGenerator` must continue to set title from `entry['name']` for spots, waterways, obstacles, and notices
- Static page permalink generation (`/{menu_slug}/{slug}/`) must remain unchanged
- `menu_to_slug` mapping logic must remain unchanged
- Mouse/keyboard navigation and all non-static-page content types must be unaffected

**Scope:**
All inputs that do NOT involve `staticPage` content type processing should be completely unaffected by this fix. This includes:
- All other content type mappers (spot, waterway, obstacle, protectedArea, waterwayEventNotice, types)
- Collection document creation for non-static-page collections
- The Contentful fetch pipeline (`ContentfulFetcher`)
- Template rendering logic in `_layouts/page.html`

## Hypothesized Root Cause

Based on the bug analysis and code investigation, the most likely issues are:

1. **Rich Text Field Resolution Failure**: The `resolve_field` method assumes `fields[field_name]` returns a plain Ruby Hash (`{ locale_sym: value }`). For rich text fields, the Contentful Ruby SDK may return the locale wrapper in a different form — possibly as a Contentful-specific object, or the rich text document object itself without locale wrapping. The `return nil unless field_hash.is_a?(Hash)` guard then rejects it. This is the primary hypothesis because ALL static pages have nil content (not just some), and other simple text fields (title, menu) resolve correctly.

2. **Field Name Mismatch**: Less likely, but the Contentful content model field ID for the rich text body might differ from `:content`. If the SDK maps it to a different symbol (e.g., `:body`, `:pageContent`), `fields[:content]` would be nil. This can be confirmed by inspecting the actual `fields_with_locales` output.

3. **Title Overwrite in CollectionGenerator**: The `create_document` method first copies all entry fields via `entry.each { |k,v| doc.data[k] = v }`, which correctly sets `doc.data['title']` from the mapped data. Then it unconditionally overwrites with `doc.data['title'] = entry['name'] || slug`. For static pages, `entry['name']` is nil (they use `title`), so the title becomes the slug. This is a confirmed root cause — the code is clearly visible.

4. **Silent Nil Propagation**: `extract_rich_text_html` returns `nil` when passed `nil` (line: `return nil unless field`). YAML serialization then writes `content:` with no value. The template `{{ static_page.content }}` renders nothing. There's no error logging, making this failure silent.

## Correctness Properties

Property 1: Fault Condition - Static Page Content Mapping

_For any_ staticPage entry fetched from Contentful where the entry has a non-empty rich text `content` field, the fixed `map_static_page` function SHALL produce a non-empty HTML string in the `content` key of the returned hash.

**Validates: Requirements 2.1, 2.3**

Property 2: Fault Condition - Static Page Title Preservation in CollectionGenerator

_For any_ static page entry processed by `CollectionGenerator#create_document` where the entry has a `title` field, the resulting document's `data['title']` SHALL equal the entry's `title` value, not the slug.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - Non-Static-Page Content Type Mapping

_For any_ content type that is NOT `staticPage` (spots, waterways, obstacles, notices, types), the fixed code SHALL produce exactly the same mapping output as the original code, preserving all existing field conversions including rich text `description` fields.

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation - Static Page Permalink and Menu Generation

_For any_ static page entry with `menu` and `menu_slug` fields, the fixed code SHALL continue to generate the correct permalink in the format `/{menu_slug}/{slug}/` and default `menu_slug` to `seiten` when menu is nil.

**Validates: Requirements 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `_plugins/contentful_mappers.rb`

**Function**: `map_static_page` / `resolve_field` / `extract_rich_text_html`

**Specific Changes**:
1. **Make `resolve_field` robust to rich text fields**: Add handling for the case where `fields[field_name]` is not a plain Hash but is a rich text object or other non-Hash type. If the field value responds to locale-based access or is a direct value, return it appropriately. Alternatively, add a fallback in `map_static_page` that bypasses `resolve_field` for the content field and accesses the rich text directly from the entry's fields.

2. **Alternative: Direct rich text extraction in `map_static_page`**: If `resolve_field` cannot be generalized safely, modify `map_static_page` to extract the content field directly from `fields[:content]` with explicit handling for both Hash-wrapped (locale) and direct (object) forms, then pass the result to `extract_rich_text_html`.

3. **Add nil-safety logging**: Add a `Jekyll.logger.warn` when `extract_rich_text_html` receives nil for a field that should have content, to prevent silent failures in the future.

---

**File**: `_plugins/collection_generator.rb`

**Function**: `create_document`

**Specific Changes**:
4. **Conditional title assignment**: Change `doc.data['title'] = entry['name'] || slug` to only set the title from `entry['name']` when `entry['name']` is present, and fall back to the already-copied `entry['title']` before falling back to slug. For example: `doc.data['title'] = entry['name'] || entry['title'] || slug`. This preserves the existing behavior for collections that use `name` (spots, waterways, obstacles, notices) while correctly using `title` for static pages.

5. **Preserve existing entry.each copy**: Ensure the `entry.each` loop continues to run first, so all mapped fields are available in `doc.data` before the title override logic.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `map_static_page` with rich text content fields in various formats (Hash-wrapped, object-style, direct) and assert that the returned `content` value is non-empty HTML. Write tests for `create_document` that pass static page entries (with `title` but no `name`) and assert the document title matches the entry title. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Content Mapping Test**: Call `map_static_page` with a rich text content field and assert `result['content']` is non-empty HTML (will fail on unfixed code if resolve_field returns nil)
2. **Title Overwrite Test**: Call `create_document` with a static page entry that has `title` but no `name`, assert `doc.data['title']` equals the entry title (will fail on unfixed code — gets slug instead)
3. **Multiple Locales Test**: Call `map_static_page` for both `de` and `en` locales with rich text content, assert both produce non-empty HTML (will fail on unfixed code)
4. **Nil Content Edge Case**: Call `map_static_page` with no content field at all, assert graceful nil handling (may pass on unfixed code — already returns nil)

**Expected Counterexamples**:
- `map_static_page` returns `{ 'content' => nil }` when given a valid rich text content field
- `create_document` returns a document where `data['title']` equals the slug instead of the entry's title
- Possible causes: `resolve_field` rejecting rich text locale hash, `entry['name']` being nil for static pages

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := map_static_page_fixed(input.entry, input.fields, input.locale)
  ASSERT result['content'] IS NOT nil AND result['content'] IS NOT empty

  doc := create_document_fixed(site, collection, entry_hash, slug)
  ASSERT doc.data['title'] == entry_hash['title']
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT map_spot_original(input) == map_spot_fixed(input)
  ASSERT map_obstacle_original(input) == map_obstacle_fixed(input)
  ASSERT map_event_notice_original(input) == map_event_notice_fixed(input)
  ASSERT create_document_original(input) == create_document_fixed(input)  // for non-static-page collections
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain for all non-static-page content types
- It catches edge cases in rich text handling that manual unit tests might miss
- It provides strong guarantees that the fix doesn't regress existing mapper behavior

**Test Plan**: Observe behavior on UNFIXED code first for all non-static-page mappers and collection generation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Spot Mapper Preservation**: Verify `map_spot` produces identical output before and after fix, especially for rich text `description` fields
2. **Obstacle Mapper Preservation**: Verify `map_obstacle` produces identical output for `description` and `portage_description` rich text fields
3. **Event Notice Mapper Preservation**: Verify `map_event_notice` produces identical output for `description` rich text field
4. **Collection Title Preservation**: Verify `create_document` still sets title from `entry['name']` for spots, waterways, obstacles, and notices

### Unit Tests

- Test `map_static_page` with various rich text content formats (Hash, object, nil)
- Test `create_document` with static page entries (title field, no name field)
- Test `create_document` with spot/obstacle entries (name field present) to verify preservation
- Test `resolve_field` with rich text field values that are not plain Hashes
- Test edge cases: empty content, missing content field, nil locale values

### Property-Based Tests

- Generate random static page entries with rich text content and verify `map_static_page` always produces non-empty `content` HTML
- Generate random non-static-page entries and verify all mappers produce identical output before and after fix
- Generate random entry hashes with various combinations of `name`/`title`/neither and verify `create_document` title logic is correct across collection types

### Integration Tests

- Test full pipeline: Contentful fetch → mapper → YAML write → CollectionGenerator → template render for static pages
- Test that static page URLs (`/{menu_slug}/{slug}/`) render with content and correct title after fix
- Test that spot/waterway/obstacle pages continue to render correctly after fix
