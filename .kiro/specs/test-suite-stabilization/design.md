# Design Document

## Overview

This design addresses two categories of work:

1. Updating 5 failing RSpec tests whose expectations are outdated (the implementation is correct)
2. Adding test coverage for 5 untested modules

No production code changes are required. All changes are test-only.

---

## Part A: Fix Failing RSpec Date/DateTime Tests

### A.1 Root Cause

The `locale_filter.rb` implementation was updated to use a uniform `%d %b %Y` (DD MMM YYYY) format for all non-ISO date types. Five tests still assert the old format strings (`DD.MM.YYYY`, `DD/MM/YYYY`, `DD. Month YYYY`, `d. MMMM YYYY um HH:MM`).

### A.2 Changes to `spec/notice_preservation_spec.rb`

Four test cases need updated expectations. The test structure, property-based approach, and Rantly generators remain unchanged — only the `expected` format strings and assertion messages change.

**Test 1 — `localized_date default format preservation`**

Current expectation:
- DE: `parsed.strftime('%d.%m.%Y')` → e.g. `07.03.2008`
- EN: `parsed.strftime('%d/%m/%Y')` → e.g. `07/03/2008`

New expectation:
- DE: `parsed.strftime('%d %b %Y')` with German month abbreviation localization → e.g. `07 Mär 2008`
- EN: `parsed.strftime('%d %b %Y')` (English month abbreviations are already correct) → e.g. `07 Mar 2008`

Implementation approach: After `strftime('%d %b %Y')`, apply the same `GERMAN_MONTHS_ABBR` mapping used in `locale_filter.rb` to the expected string for the DE locale. The test already has a `german_months` hash for full names; add a `german_months_abbr` hash for abbreviated names.

**Test 2 — `localized_date 'long' format preservation`**

Current expectation:
- DE: `parsed.strftime('%d. %B %Y')` with full German month names → e.g. `07. März 2008`

New expectation:
- DE: `parsed.strftime('%d %b %Y')` with abbreviated German month names → e.g. `07 Mär 2008`

The `'long'` format now produces the same output as default (`%d %b %Y`). Update the strftime format and switch from `GERMAN_MONTHS` (full) to `GERMAN_MONTHS_ABBR` (abbreviated) localization.

**Test 3 — `localized_datetime default format preservation`**

Current expectation:
- DE: `parsed.strftime('%d.%m.%Y %H:%M')` → e.g. `07.03.2008 14:30`

New expectation:
- DE: `parsed.strftime('%d %b %Y %H:%M')` with abbreviated German month names → e.g. `07 Mär 2008 14:30`

**Test 4 — `localized_datetime 'long' format preservation`**

Current expectation:
- DE: `parsed.strftime('%-d. %B %Y um %H:%M')` with full German month names → e.g. `7. März 2008 um 14:30`

New expectation:
- DE: `parsed.strftime('%d %b %Y um %H:%M')` with abbreviated German month names → e.g. `07 Mär 2008 um 14:30`

Note the change from `%-d` (no leading zero) to `%d` (leading zero) and from `%B` (full month) to `%b` (abbreviated month).

### A.3 Changes to `spec/notice_page_fixes_spec.rb`

**Test 4 — `updatedAt` format**

Current regex expectation:
```ruby
/^\d{1,2}\. [[:alpha:]]+ \d{4} um \d{2}:\d{2}$/
```
This expects `d. MMMM YYYY um HH:MM` (e.g. `10. Mai 2025 um 14:30`).

New regex expectation:
```ruby
/^\d{2} [[:alpha:]]{3} \d{4} um \d{2}:\d{2}$/
```
This expects `DD MMM YYYY um HH:MM` (e.g. `10 Mai 2025 um 14:30`).

Key differences: `\d{2}` (always 2-digit day), no period after day, `[[:alpha:]]{3}` (3-letter abbreviated month), no period before `um`.

Also update the failure message from `'10. Mai 2025 um 14:30'` to `'10 Mai 2025 um 14:30'`.

### A.4 Shared Helper: German Month Abbreviation Map

Both `notice_preservation_spec.rb` tests 1, 3, and 4 need a German abbreviated month map. Define it once as a constant or helper within the spec file:

```ruby
GERMAN_MONTHS_ABBR = {
  'Jan' => 'Jan', 'Feb' => 'Feb', 'Mar' => 'Mär',
  'Apr' => 'Apr', 'May' => 'Mai', 'Jun' => 'Jun',
  'Jul' => 'Jul', 'Aug' => 'Aug', 'Sep' => 'Sep',
  'Oct' => 'Okt', 'Nov' => 'Nov', 'Dec' => 'Dez'
}.freeze
```

This mirrors `GERMAN_MONTHS_ABBR` in `locale_filter.rb`.

---

## Part B: New Test Coverage

### B.1 `spec/plugins/waterway_filters_spec.rb` — WaterwayFilters

**File:** `spec/plugins/waterway_filters_spec.rb`
**Approach:** Property-based tests using Rantly, consistent with existing spec patterns.

The module is a set of pure Liquid filters that operate on arrays of hashes. No Jekyll site mock is needed — just include the module in a test helper class and call the methods directly.

**Test helper setup:**
```ruby
class WaterwayFilterHelper
  include Jekyll::WaterwayFilters
end
```

**Tests:**

1. `top_lakes_by_area(waterways, locale, limit)`
   - Given N waterways with mixed types/locales/showInMenu values, returns only lakes (`paddlingEnvironmentType_slug == 'see'`) matching the locale with `showInMenu == true`, limited to `limit` count, sorted alphabetically by name
   - Property: result size ≤ limit; all items have correct locale, type, and showInMenu; result is alphabetically sorted
   - Edge cases: nil input → `[]`, empty array → `[]`, no matching items → `[]`

2. `top_rivers_by_length(waterways, locale, limit)`
   - Same structure as lakes but filters for `paddlingEnvironmentType_slug == 'fluss'` and sorts by `length` descending before limiting
   - Property: result size ≤ limit; all items have correct locale, type, and showInMenu; result is alphabetically sorted

3. `sort_waterways_alphabetically(waterways)`
   - Given any array of waterway hashes, returns them sorted case-insensitively by `name`
   - Property: output is sorted; output length equals input length
   - Edge cases: nil → `[]`, empty → `[]`

4. `lakes_alphabetically(waterways, locale)`
   - Filters for locale + `'see'` type, sorts alphabetically
   - Property: all items match locale and type; result is sorted

5. `rivers_alphabetically(waterways, locale)`
   - Filters for locale + `'fluss'` type, sorts alphabetically
   - Property: all items match locale and type; result is sorted

### B.2 `spec/plugins/favicon_generator_spec.rb` — FaviconGenerator

**File:** `spec/plugins/favicon_generator_spec.rb`
**Approach:** Unit tests with a mocked Jekyll site and temporary directory for source files.

**Test setup:**
- Create a tmpdir as `site.source`
- Mock `site.static_files` as an array
- Create/omit the SVG and PNG source files as needed per test

**Tests:**

1. When SVG source exists → adds an `AliasedStaticFile` to `site.static_files` with destination `favicon.ico`
2. When SVG source does not exist → does not add a favicon.ico static file
3. When PNG source exists → adds an `AliasedStaticFile` to `site.static_files` with destination `apple-touch-icon.png`
4. When PNG source does not exist → does not add an apple-touch-icon.png static file; logs a warning
5. `AliasedStaticFile#path` returns the original source file path
6. `AliasedStaticFile#destination(dest)` returns `File.join(dest, dest_name)`

### B.3 `spec/plugins/i18n_patch_spec.rb` — I18nPatch

**File:** `spec/plugins/i18n_patch_spec.rb`
**Approach:** Unit tests verifying the monkey-patch behavior.

**Challenge:** The patch hooks into `Jekyll::Hooks.register :site, :after_init` and modifies `TranslatedString` if defined. The `jekyll-multiple-languages-plugin` gem may or may not be loaded in the test environment.

**Test strategy:**
- Define a minimal `TranslatedString` class (inheriting from `String`) in the test if it's not already defined
- Trigger the `:site, :after_init` hook
- Verify that `TranslatedString.new(nil, 'some.key')` does not raise (Ruby 3.4 would raise `TypeError: no implicit conversion of nil into String` without the patch)
- Verify `I18nPatch.patched?` returns `true` after the hook fires
- Verify idempotency: calling the hook again doesn't re-patch

**Tests:**

1. `TranslatedString.new(nil, 'key')` does not raise after patch is applied
2. `TranslatedString.new('value', 'key')` still works normally
3. `I18nPatch.patched?` returns `true` after hook execution
4. Hook is idempotent — second execution is a no-op

### B.4 `spec/plugins/tile_generator_spatial_spec.rb` — TileGenerator Spatial Logic

**File:** `spec/plugins/tile_generator_spatial_spec.rb`
**Approach:** Mix of property-based (Rantly) and unit tests. Tests exercise the private spatial methods via `send`.

**Constants from TileGenerator:**
```ruby
SWITZERLAND_BOUNDS = { north: 47.8, south: 45.8, east: 10.5, west: 5.9 }
TILE_SIZE = { lat: 0.25, lon: 0.46 }
```

**Tests:**

1. `get_tile_bounds(x, y)` — Property-based
   - For any valid x (0..grid_cols-1) and y (0..grid_rows-1):
     - `north = 47.8 - (y * 0.25)`
     - `south = 47.8 - ((y+1) * 0.25)`
     - `east = 5.9 + ((x+1) * 0.46)`
     - `west = 5.9 + (x * 0.46)`
   - Property: north > south, east > west

2. `get_tile_for_point(item)` — Property-based
   - For any point within Switzerland bounds, returns `[x, y]` where x and y are within grid dimensions
   - For any point outside Switzerland bounds, returns `nil`
   - Property: returned tile's bounds contain the original point

3. `point_in_bounds?(lat, lon)` — Unit tests
   - Points inside → true
   - Points outside → false
   - Boundary points (exactly on edges) → true

4. `calculate_centroid(geojson)` — Unit tests for each GeoJSON type
   - Point: centroid equals the point itself
   - LineString: centroid is average of all coordinates
   - Polygon: centroid is average of all ring coordinates
   - MultiPolygon: centroid is average of all coordinates across all polygons
   - GeometryCollection: centroid is average across all sub-geometries
   - Empty/nil geometry → nil

5. `extract_coordinates(geojson)` — Unit tests
   - Verify correct coordinate extraction for Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection, Feature, FeatureCollection

6. `get_data_for_locale(data_key, locale)` — Unit tests
   - Array data: filters by `locale` or `node_locale` field
   - Hash data: returns `data[locale]` sub-key
   - Caches results (second call returns same object)

### B.5 `_tests/unit/spot-popup-utils.test.js` — Spot Popup Utility Functions

**File:** `_tests/unit/spot-popup-utils.test.js`
**Approach:** Unit tests using Jest with jsdom environment. Import `PaddelbuchSpotPopup` from `assets/js/spot-popup.js`.

**Setup:**
```javascript
require('../../assets/js/spot-popup.js');
const { escapeHtml, stripHtml, truncate, getIconPath, getLabels } = window.PaddelbuchSpotPopup;
```

**Tests:**

1. `escapeHtml`
   - Escapes `<`, `>`, `&`, `"`, `'` characters
   - Returns `''` for null, undefined, empty string
   - Preserves normal text unchanged

2. `stripHtml`
   - Removes HTML tags: `'<p>hello</p>'` → `'hello'`
   - Handles nested tags: `'<div><p>text</p></div>'` → `'text'`
   - Returns `''` for null, undefined, empty string
   - Preserves text without tags

3. `truncate`
   - Truncates text longer than maxLength and appends `'...'`
   - Returns original text if shorter than or equal to maxLength
   - Returns `''` for null, undefined, empty string

4. `getIconPath`
   - Returns correct path for each known spot type slug (e.g. `'einstieg-ausstieg'` → `'/assets/images/icons/entryexit-light.svg'`)
   - Returns `noentry` icon path when `isRejected` is true (regardless of slug)
   - Returns default `entryexit` icon for unknown/null slug
   - Respects `variant` parameter (`'light'` vs `'dark'`)
   - Defaults to `'light'` variant when not specified

5. `getLabels`
   - Returns German labels object when locale is `'de'`
   - Returns English labels object when locale is `'en'`
   - Defaults to German for any other locale value
   - All expected keys are present: `gps`, `approxAddress`, `type`, `potentiallyUsableBy`, `copy`, `copyGps`, `copyAddress`, `navigate`, `moreDetails`

---

## File Change Summary

| File | Action | Requirement |
|------|--------|-------------|
| `spec/notice_preservation_spec.rb` | Modify — update 4 test expectations | 2.1, 2.2, 2.3 |
| `spec/notice_page_fixes_spec.rb` | Modify — update 1 test expectation | 2.4 |
| `spec/plugins/waterway_filters_spec.rb` | Create — new test file | 2.8 |
| `spec/plugins/favicon_generator_spec.rb` | Create — new test file | 2.9 |
| `spec/plugins/i18n_patch_spec.rb` | Create — new test file | 2.10 |
| `spec/plugins/tile_generator_spatial_spec.rb` | Create — new test file | 2.11 |
| `_tests/unit/spot-popup-utils.test.js` | Create — new test file | 2.12 |

No production code files are modified.

---

## Testing Strategy

All tests should be runnable with the existing test infrastructure:

- RSpec tests: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
- Jest tests: `npx jest`

Property-based tests use Rantly (RSpec) and fast-check (Jest) as already established in the project.

After implementation, the full test suite should produce 0 failures.
