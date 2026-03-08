# Last Update API Fix — Bugfix Design

## Overview

The Jekyll site's API JSON output diverges from the original Gatsby site across 46 defects spanning file naming, fact table structure, dimension table structure, timestamp formatting, JSON formatting, and the last update index. The root cause is that the `ApiGenerator` directly serializes the flattened YAML data (designed for Jekyll templates) instead of re-mapping it into the Gatsby-compatible Contentful query structure. The fix introduces an API-specific transformation layer in `api_generator.rb` that converts the flattened YAML data back into the nested Gatsby output format, without changing the YAML data files or HTML template rendering.

## Glossary

- **Bug_Condition (C)**: Any API JSON output that structurally differs from the Gatsby reference — wrong file names, wrong field names, wrong nesting, wrong timestamps, wrong formatting, or wrong last update index entries
- **Property (P)**: All API JSON files match the Gatsby output structure exactly — correct file names, field names, nesting, timestamp format (millisecond precision with Z suffix), compact JSON, and 12-entry camelCase last update index
- **Preservation**: The YAML data files, HTML template rendering, tile generation, and `site.data['last_updates']` Liquid exposure must remain unchanged
- **`api_generator.rb`**: The Jekyll plugin in `_plugins/api_generator.rb` that generates all API JSON files from `site.data`
- **`contentful_mappers.rb`**: The mapper module in `_plugins/contentful_mappers.rb` that transforms Contentful entries into flattened per-locale hashes stored as YAML
- **Fact tables**: API JSON files for spots, obstacles, waterway events, protected areas, waterways
- **Dimension tables**: API JSON files for spottypes, obstacletypes, paddlecrafttypes, paddlingenvironmenttypes, protectedareatypes, datasourcetypes, datalicensetypes
- **Last update index**: `lastUpdateIndex.json` — a consolidated index of the most recent `updatedAt` timestamp per content type

## Bug Details

### Bug Condition

The bug manifests when the `ApiGenerator` serializes any API JSON file. The generator reads the flattened YAML data (which uses `locale`, `_slug` suffixed references, HTML descriptions, flattened geometry strings, and second-precision timestamps) and writes it directly to JSON. The Gatsby site instead outputs nested Contentful query structures with `node_locale`, `{"slug": "..."}` references, `{"raw": "..."}` rich text, `{"internal": {"content": "..."}}` geometry, and millisecond-precision timestamps.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ApiJsonOutput (any generated API JSON file)
  OUTPUT: boolean

  RETURN fileNameMismatch(input)
         OR fieldStructureMismatch(input)
         OR timestampFormatMismatch(input)
         OR jsonFormattingMismatch(input)
         OR lastUpdateIndexMismatch(input)
END FUNCTION

FUNCTION fileNameMismatch(input)
  RETURN input.fileName IN ['notices-{locale}.json', 'protected-areas-{locale}.json']
END FUNCTION

FUNCTION fieldStructureMismatch(input)
  RETURN input.usesLocaleInsteadOfNodeLocale
         OR input.hasSlugFieldNotFirst
         OR input.hasHtmlDescriptionInsteadOfRaw
         OR input.hasFlattenedGeometryInsteadOfNested
         OR input.hasFlatSlugRefsInsteadOfNestedObjects
         OR input.hasMissingOrExtraFields
END FUNCTION

FUNCTION timestampFormatMismatch(input)
  RETURN input.timestamps DO NOT match /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
END FUNCTION

FUNCTION jsonFormattingMismatch(input)
  RETURN input.isPrettyPrinted == true
END FUNCTION

FUNCTION lastUpdateIndexMismatch(input)
  RETURN input.entryCount != 12
         OR input.tableNames ARE NOT camelCase WITH 's' suffix
         OR input.hasPerLocaleEntries == true
END FUNCTION
```

### Examples

- **File naming**: `notices-de.json` is generated instead of `waterwayevents-de.json`; `protected-areas-de.json` instead of `protectedareas-de.json`
- **Spots field structure**: `{"locale": "de", "waterway_slug": "aare", "description": "<p>text</p>"}` instead of `{"slug": "...", "node_locale": "de", "waterway": {"slug": "aare"}, "description": {"raw": "{...}"}}`
- **Timestamp format**: `"2023-11-23T09:28:19+00:00"` instead of `"2023-11-23T09:28:19.345Z"`
- **JSON formatting**: Pretty-printed with newlines/indentation instead of compact single-line
- **Last update index**: 24 entries like `{"table": "spots-de", "lastUpdatedAt": "..."}` instead of 12 entries like `{"table": "spots", "lastUpdatedAt": "..."}`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The YAML data files under `_data/` (spots.yml, obstacles.yml, notices.yml, waterways.yml, protected_areas.yml, types/*.yml) must remain in their current flattened format with `locale`, `_slug` references, HTML descriptions, and flattened geometry strings
- HTML page rendering using Liquid templates must continue to work identically — templates consume the YAML data, not the API JSON
- Tile generation (`tile_generator.rb`) must continue to work identically — it reads from `site.data` independently
- `site.data['last_updates']` must continue to be exposed for Liquid templates (the `api.html` page uses it)
- The `contentful_mappers.rb` module must not be modified — it serves the Jekyll template pipeline correctly

**Scope:**
All inputs that do NOT involve API JSON file generation should be completely unaffected by this fix. This includes:
- Contentful data fetching and YAML serialization (`contentful_fetcher.rb`)
- Contentful entry mapping (`contentful_mappers.rb`)
- HTML page generation from Liquid templates
- Tile generation for spatial queries
- Jekyll collection generation (`collection_generator.rb`)
- Locale filtering (`locale_filter.rb`)

## Hypothesized Root Cause

Based on the bug analysis, the root cause is a single architectural decision in the migration:

1. **Direct YAML-to-JSON serialization**: The `ApiGenerator` reads the flattened YAML data from `site.data` and writes it directly to JSON via `JSON.pretty_generate(data)`. The YAML data was intentionally flattened by `contentful_mappers.rb` for Jekyll template consumption (HTML descriptions, `_slug` string references, flattened geometry). The Gatsby site, by contrast, queried Contentful's GraphQL API directly and received nested structures (`{"raw": "..."}`, `{"slug": "..."}`, `{"internal": {"content": "..."}}`). The API generator has no transformation layer to convert the flattened format back to the Gatsby-compatible nested format.

2. **File naming mismatch**: The `FACT_TABLES` config uses `'notices'` and `'protected-areas'` as keys, which become file names. Gatsby used `'waterwayevents'` and `'protectedareas'`.

3. **Timestamp precision loss**: The `contentful_mappers.rb` `flatten_entry` method formats timestamps with `strftime('%Y-%m-%dT%H:%M:%SZ')`, which drops milliseconds. The `normalize_timestamp` method in `api_generator.rb` also strips milliseconds. Contentful stores timestamps with millisecond precision (e.g., `2023-11-23T09:28:19.345Z`), and Gatsby preserved this.

4. **Pretty-printed JSON**: The generator uses `JSON.pretty_generate(data)` instead of `JSON.generate(data)`, producing indented multi-line output instead of compact single-line.

5. **Per-locale last update index**: The generator creates one entry per table-locale combination (24 entries) instead of one entry per content type across all locales (12 entries), and uses lowercase-hyphenated names instead of camelCase Contentful content type IDs with `s` suffix.

6. **Missing fields in mappers**: Several fields present in the Gatsby queries are not extracted by the current mappers — `description` for protected areas, `waterway` for protected areas, `spot` for waterway events, `dataSourceType`/`dataLicenseType` for waterway events and protected areas, `description` for paddleCraftType and dataSourceType dimension tables, `summaryUrl`/`fullTextUrl` for dataLicenseType.

## Correctness Properties

Property 1: Bug Condition — API JSON Structure Matches Gatsby Output

_For any_ API JSON file generated by the Jekyll site where the bug condition holds (file naming, field structure, timestamp format, JSON formatting, or last update index differs from Gatsby), the fixed `ApiGenerator` SHALL produce output that exactly matches the Gatsby reference structure: correct file names, `node_locale` instead of `locale`, `slug` as first field, nested `{"raw": "..."}` for rich text, nested `{"internal": {"content": "..."}}` for geometry, nested `{"slug": "..."}` for references, millisecond-precision timestamps with Z suffix, compact single-line JSON, and a 12-entry camelCase last update index.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 2.21, 2.22, 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.30, 2.31, 2.32, 2.33, 2.34, 2.35, 2.36, 2.37**

Property 2: Preservation — YAML Data and HTML Rendering Unchanged

_For any_ input that does NOT involve API JSON generation (YAML data files, HTML template rendering, tile generation, Liquid template data exposure), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for non-API outputs.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

The fix is confined to two files. The YAML data pipeline (`contentful_fetcher.rb`, `contentful_mappers.rb`) remains untouched. The mappers need additional fields extracted for API use, and the API generator needs a complete transformation layer.

**File**: `_plugins/contentful_mappers.rb`

**Changes**: Add new API-oriented mapper methods (or extend existing mappers with raw-preserving variants) that the API generator can call. These preserve the original Contentful structure instead of flattening it.

**Specific Changes**:

1. **Preserve raw timestamps**: Add a method or option to `flatten_entry` that stores the original Contentful `sys[:created_at]` and `sys[:updated_at]` as ISO 8601 strings with millisecond precision (`%Y-%m-%dT%H:%M:%S.%3NZ`), or store the raw timestamp strings alongside the current ones so the API generator can use them.

2. **Add API-specific data extraction**: Since the mappers currently flatten data for Jekyll templates, the API generator needs its own transformation functions. These can live in `api_generator.rb` as private methods that re-map the YAML data into Gatsby-compatible structures.

---

**File**: `_plugins/api_generator.rb`

**Function**: `ApiGenerator#generate` and all private helper methods

**Specific Changes**:

1. **Fix file naming**: Rename fact table keys:
   - `'notices'` → `'waterwayevents'` (output files `waterwayevents-de.json`, `waterwayevents-en.json`)
   - `'protected-areas'` → `'protectedareas'` (output files `protectedareas-de.json`, `protectedareas-en.json`)
   - Update `data_key` mappings accordingly (`notices` data key stays the same since that's the YAML file name)

2. **Add fact table transformers**: For each fact table type, add a transformer method that converts the flattened YAML hash into the Gatsby-compatible nested structure:
   - `transform_spot(item)` — renames `locale` → `node_locale`, reorders fields (slug first), wraps `description` in `{"raw": "..."}`, wraps `approximateAddress` in `{"approximateAddress": "..."}`, preserves `null` for `rejected`, converts `_slug` references to `{"slug": "..."}` objects, renames `paddleCraftTypes` → `paddleCraftType` with array of objects, renames `eventNotices` → `waterway_event_notice` (null when empty), renames `obstacles` → `obstacle` (null when empty)
   - `transform_obstacle(item)` — similar field renaming, wraps `geometry`/`portageRoute` in `{"internal": {"content": "..."}}`, wraps `description`/`portageDescription` in `{"raw": "..."}`, removes `spots` field, adds `dataSourceType`/`dataLicenseType` references
   - `transform_waterway_event(item)` — renames `waterways` → `waterway` as array of objects, adds `spot` field (null or array of objects), wraps `description` in `{"raw": "..."}`, wraps `affectedArea` in `{"internal": {"content": "..."}}`, truncates `startDate`/`endDate` to date-only, removes `location` field, adds `dataSourceType`/`dataLicenseType`
   - `transform_waterway(item)` — wraps `geometry` in `{"internal": {"content": "..."}}`, converts `_slug` refs to objects, removes `showInMenu`
   - `transform_protected_area(item)` — wraps `geometry` in `{"internal": {"content": "..."}}`, adds `description` field, converts `protectedAreaType_slug` to object, adds `waterway`, `dataSourceType`, `dataLicenseType` fields

3. **Add dimension table transformers**: For each dimension table type, add a transformer that:
   - Adds `node_locale` field
   - Reorders fields: `slug`, `node_locale`, `createdAt`, `updatedAt`, `name`, then additional fields
   - For `paddlecrafttypes`: adds `description` field as `{"raw": "..."}`
   - For `datasourcetypes`: adds `description` field as `{"raw": "..."}`
   - For `datalicensetypes`: adds `summaryUrl` and `fullTextUrl` fields

4. **Fix timestamp format**: Replace `normalize_timestamp` to preserve millisecond precision. Since the YAML data has already lost milliseconds (formatted as `%Y-%m-%dT%H:%M:%SZ` by `flatten_entry`), the fix must either:
   - Store raw Contentful timestamps with milliseconds in the YAML data (add a `_raw_createdAt`/`_raw_updatedAt` field in `flatten_entry`), OR
   - Accept that milliseconds are `.000` when the original precision is lost, and format as `"2023-11-23T09:28:19.000Z"` — this matches the Gatsby format structurally even if the fractional seconds are zeroed

5. **Fix JSON formatting**: Replace `JSON.pretty_generate(data)` with `JSON.generate(data)` for compact single-line output

6. **Fix last update index**: Restructure `generate_last_update_index` to:
   - Produce exactly 12 entries (one per content type, not per locale)
   - Use camelCase Contentful content type IDs with `s` suffix as table names: `spots`, `obstacles`, `waterwayEventNotices`, `protectedAreas`, `waterways`, `dataLicenseTypes`, `dataSourceTypes`, `obstacleTypes`, `paddleCraftTypes`, `protectedAreaTypes`, `spotTypes`, `paddlingEnvironmentTypes`
   - For each content type, take the maximum `updatedAt` across all locales
   - Continue exposing `site.data['last_updates']` for Liquid templates

7. **Preserve raw rich text for API**: The mappers currently render rich text to HTML via `extract_rich_text_html`. For the API, we need the raw JSON string. Two approaches:
   - Store both HTML and raw in the YAML data (add `_raw_description` fields), OR
   - In the API transformer, detect that the description is HTML and wrap it as `{"raw": "..."}` — but this loses the original Contentful JSON structure
   - The cleanest approach: modify `contentful_mappers.rb` to store the raw rich text JSON alongside the HTML version in a `_raw` suffixed field, so the API generator can use it

8. **Preserve raw geometry for API**: The mappers currently call `.to_json` on geometry fields, producing a flat JSON string. For the API, we need `{"internal": {"content": "..."}}`. The API transformer can wrap the existing flat JSON string: `{"internal": {"content": item['geometry']}}`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. Given the 46 defects span structural categories (naming, fields, timestamps, formatting, index), tests are organized by category.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write RSpec tests that instantiate the `ApiGenerator` with mock `site.data`, generate the API JSON pages, and assert against the Gatsby-expected structure. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **File Naming Test**: Generate API and check that output includes `waterwayevents-de.json` and `protectedareas-de.json` (will fail on unfixed code — produces `notices-de.json` and `protected-areas-de.json`)
2. **Spots Structure Test**: Generate spots API and check that output uses `node_locale`, has `slug` first, has `{"raw": "..."}` description, has `{"slug": "..."}` references (will fail on unfixed code)
3. **Obstacles Structure Test**: Generate obstacles API and check for `{"internal": {"content": "..."}}` geometry, no `spots` field, `{"raw": "..."}` description (will fail on unfixed code)
4. **Waterway Events Structure Test**: Generate waterway events API and check for date-only `startDate`/`endDate`, `waterway` as array of objects, `spot` field present, no `location` field (will fail on unfixed code)
5. **Waterways Structure Test**: Generate waterways API and check for nested geometry, no `showInMenu` field (will fail on unfixed code)
6. **Protected Areas Structure Test**: Generate protected areas API and check for `description`, `waterway`, `dataSourceType`, `dataLicenseType` fields (will fail on unfixed code)
7. **Dimension Table Structure Test**: Generate dimension tables and check for `node_locale` field, correct field order, additional fields for paddlecrafttypes/datasourcetypes/datalicensetypes (will fail on unfixed code)
8. **Timestamp Format Test**: Check that `createdAt`/`updatedAt` match `/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/` (will fail on unfixed code)
9. **JSON Formatting Test**: Check that output is compact single-line JSON (will fail on unfixed code — currently pretty-printed)
10. **Last Update Index Test**: Check that `lastUpdateIndex.json` has 12 entries with camelCase names (will fail on unfixed code — has 24 entries with hyphenated names)

**Expected Counterexamples**:
- File names `notices-de.json` and `protected-areas-de.json` instead of `waterwayevents-de.json` and `protectedareas-de.json`
- Field `locale` instead of `node_locale` in all fact tables
- HTML strings instead of `{"raw": "..."}` objects for descriptions
- Flat JSON strings instead of `{"internal": {"content": "..."}}` for geometry
- `_slug` string fields instead of `{"slug": "..."}` nested objects
- Timestamps without milliseconds
- Pretty-printed JSON with newlines
- 24 last update index entries instead of 12

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL apiFile WHERE isBugCondition(apiFile) DO
  result := ApiGenerator_fixed.generate(site_with_test_data)
  ASSERT result.fileName matches Gatsby naming convention
  ASSERT result.fieldStructure matches Gatsby query structure
  ASSERT result.timestamps match /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
  ASSERT result.json is compact single-line
  ASSERT result.lastUpdateIndex has 12 camelCase entries
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT site.data YAML files are identical before and after fix
  ASSERT HTML page output is identical before and after fix
  ASSERT tile generation output is identical before and after fix
  ASSERT site.data['last_updates'] is still exposed for Liquid templates
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-API outputs

**Test Plan**: Observe behavior on UNFIXED code first for YAML data structure and HTML rendering, then write property-based tests capturing that behavior.

**Test Cases**:
1. **YAML Data Preservation**: Verify that `contentful_mappers.rb` `flatten_entry` output is identical before and after the fix for all content types — the mappers should not change
2. **Liquid Template Data Preservation**: Verify that `site.data['last_updates']` continues to be populated and accessible to Liquid templates after the fix
3. **Tile Generation Preservation**: Verify that tile generation reads from `site.data` and produces identical output before and after the fix
4. **HTML Page Preservation**: Verify that HTML pages rendered from YAML data are unaffected by API generator changes

### Unit Tests

- Test each fact table transformer method (`transform_spot`, `transform_obstacle`, `transform_waterway_event`, `transform_waterway`, `transform_protected_area`) with representative input data and assert exact Gatsby-compatible output structure
- Test each dimension table transformer with representative input and assert correct field order, `node_locale` presence, and additional fields
- Test `normalize_timestamp` produces millisecond-precision ISO 8601 with Z suffix
- Test file naming for all fact tables and dimension tables
- Test last update index produces exactly 12 entries with correct camelCase names
- Test edge cases: null descriptions, empty arrays for references, null geometry, missing optional fields

### Property-Based Tests

- Generate random spot/obstacle/waterway/event/protected-area hashes with varying field combinations and verify the transformer always produces valid Gatsby-compatible structure (correct field names, correct nesting, no extra fields, no missing required fields)
- Generate random timestamps and verify `normalize_timestamp` always produces the `YYYY-MM-DDTHH:MM:SS.mmmZ` format
- Generate random dimension table entries and verify output always has `node_locale` and correct field order
- Generate random combinations of fact table data across locales and verify last update index always has exactly 12 entries with the maximum timestamp per content type

### Integration Tests

- Build the full Jekyll site with test Contentful data and verify all API JSON files match expected Gatsby structure
- Verify that HTML pages still render correctly after the API generator changes
- Verify that `lastUpdateIndex.json` is consistent with the individual fact/dimension table timestamps
- Verify that the `api.html` page still renders last update timestamps correctly from `site.data['last_updates']`
