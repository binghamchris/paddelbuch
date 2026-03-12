# Bugfix Requirements Document

## Introduction

The paddelbuch project has 13 failing tests across two test suites (RSpec and Jest). The current implementation is correct — the tests are outdated and need to be updated to match the current behavior. Additionally, several plugins and JavaScript modules have zero test coverage that should be filled. This bugfix stabilizes the test suite by aligning test expectations with the actual (correct) implementation and closing coverage gaps.

## Bug Analysis

### Current Behavior (Defect)

**RSpec Date/DateTime Formatting Tests (5 failures)**

1.1 WHEN `localized_date` is called with default format THEN the test expects `DD.MM.YYYY` (e.g. `07.03.2008`) but the implementation correctly produces `DD MMM YYYY` (e.g. `07 Mär 2008`), causing the test to fail

1.2 WHEN `localized_date` is called with `'long'` format THEN the test expects `DD. Month YYYY` (e.g. `07. März 2008`) but the implementation correctly produces `DD MMM YYYY` (e.g. `07 Mär 2008`), causing the test to fail

1.3 WHEN `localized_datetime` is called with default format THEN the test expects `DD.MM.YYYY HH:MM` (e.g. `07.03.2008 14:30`) but the implementation correctly produces `DD MMM YYYY HH:MM` (e.g. `07 Mär 2008 14:30`), causing the test to fail

1.4 WHEN `localized_datetime` is called with `'long'` format THEN the test expects `DD. Month YYYY um HH:MM` (e.g. `7. März 2008 um 14:30`) but the implementation correctly produces `DD MMM YYYY um HH:MM` (e.g. `07 Mär 2008 um 14:30`), causing the test to fail

1.5 WHEN `notice_page_fixes_spec.rb` tests the `updatedAt` format THEN the test expects `d. MMMM YYYY um HH:MM` (e.g. `10. Mai 2025 um 14:30`) but the implementation correctly produces `DD MMM YYYY um HH:MM` (e.g. `10 Mai 2025 um 14:30`), causing the test to fail

**Jest Spot Popup Tests (8 failures)**

1.6 WHEN `spot-popup-design-bug.exploration.test.js` checks for `<ul>` craft types list, clipboard copy buttons, and `<th>` elements in the popup details table THEN the tests fail because the current implementation intentionally produces an empty `<tbody>` with no GPS rows, address rows, craft type lists, or clipboard copy buttons inside the popup details table

1.7 WHEN `spot-popup-design-bug.preservation.test.js` checks for `>GPS:<` label, address label, craft types label, `PaddelbuchClipboard.copyGPS()` calls, and `PaddelbuchClipboard.copyAddress()` calls in the popup HTML THEN the tests fail because the current implementation intentionally omits all detail rows and clipboard functionality from the popup table body

**Test Coverage Gaps**

1.8 WHEN `_plugins/waterway_filters.rb` is exercised THEN there are zero tests covering its 5 public Liquid filter methods (`top_lakes_by_area`, `top_rivers_by_length`, `sort_waterways_alphabetically`, `lakes_alphabetically`, `rivers_alphabetically`)

1.9 WHEN `_plugins/favicon_generator.rb` is exercised THEN there are zero tests covering its SVG favicon and PNG Apple Touch Icon copying behavior

1.10 WHEN `_plugins/i18n_patch.rb` is exercised THEN there are zero tests covering its monkey-patch of `TranslatedString` for Ruby 3.4 nil-safety

1.11 WHEN `_plugins/tile_generator.rb` spatial logic is exercised THEN there are no functional tests for bounds calculation, tile coordinate assignment, centroid calculation, or layer filtering (only cache round-trip tests exist)

1.12 WHEN `assets/js/spot-popup.js` utility functions are exercised THEN there are zero unit tests for `escapeHtml`, `stripHtml`, `truncate`, `getIconPath`, and `getLabels`

### Expected Behavior (Correct)

**RSpec Date/DateTime Formatting Tests**

Note: All dates displayed on the site (with the exception of API JSON files and the "Data Download / API" page tables) MUST use the `DD MMM YYYY` format. The `localized_date` and `localized_datetime` filters in `locale_filter.rb` use `%d %b %Y` as the base format for all non-ISO format types (default, short, long). The only distinction is that datetime `'long'` format appends `um`/`at` before the time component. German abbreviated month names are localized (e.g. `Mar` → `Mär`, `Oct` → `Okt`).

2.1 WHEN `localized_date` is called with any non-ISO format type (default, short, or long) THEN the test SHALL expect `DD MMM YYYY` format (e.g. `07 Mär 2008` for German locale, `07 Mar 2008` for English locale), matching the uniform `%d %b %Y` strftime format in `locale_filter.rb`

2.2 WHEN `localized_datetime` is called with default or short format THEN the test SHALL expect `DD MMM YYYY HH:MM` format (e.g. `07 Mär 2008 14:30`), matching the `%d %b %Y %H:%M` strftime format in `locale_filter.rb`

2.3 WHEN `localized_datetime` is called with `'long'` or `'notice_updated'` format THEN the test SHALL expect `DD MMM YYYY um HH:MM` for German locale (e.g. `07 Mär 2008 um 14:30`) and `DD MMM YYYY at HH:MM` for English locale, matching the `%d %b %Y um %H:%M` / `%d %b %Y at %H:%M` strftime formats in `locale_filter.rb`

2.4 WHEN `notice_page_fixes_spec.rb` tests the `updatedAt` format THEN the test SHALL expect `DD MMM YYYY um HH:MM` format (e.g. `10 Mai 2025 um 14:30`), matching the `notice_updated` format `%d %b %Y um %H:%M` in `locale_filter.rb`

**Jest Spot Popup Tests**

2.6 WHEN `spot-popup-design-bug.exploration.test.js` validates the popup structure THEN the tests SHALL assert that the popup details table body is empty (no GPS rows, address rows, craft type lists, or clipboard copy buttons), matching the current `generateSpotPopupContent()` implementation

2.7 WHEN `spot-popup-design-bug.preservation.test.js` validates preserved behavior THEN the tests SHALL remove assertions for `>GPS:<` label, address label, craft types label, `PaddelbuchClipboard.copyGPS()`, and `PaddelbuchClipboard.copyAddress()` from the popup table, and instead assert that the table body is intentionally empty while other preserved behaviors (description, detail links, navigate button, rejected popup layout) remain validated

**Test Coverage Gaps**

2.8 WHEN `_plugins/waterway_filters.rb` is tested THEN there SHALL be property-based tests covering `top_lakes_by_area`, `top_rivers_by_length`, `sort_waterways_alphabetically`, `lakes_alphabetically`, and `rivers_alphabetically` filter methods

2.9 WHEN `_plugins/favicon_generator.rb` is tested THEN there SHALL be tests verifying SVG favicon copying to `/favicon.ico` and PNG Apple Touch Icon copying to `/apple-touch-icon.png`

2.10 WHEN `_plugins/i18n_patch.rb` is tested THEN there SHALL be tests verifying that `TranslatedString.new(nil, key)` does not raise an error under Ruby 3.4

2.11 WHEN `_plugins/tile_generator.rb` spatial logic is tested THEN there SHALL be functional tests for tile bounds calculation, point-to-tile coordinate assignment, centroid calculation for GeoJSON geometries, and layer filtering by locale

2.12 WHEN `assets/js/spot-popup.js` utility functions are tested THEN there SHALL be unit tests for `escapeHtml`, `stripHtml`, `truncate`, `getIconPath`, and `getLabels`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `localized_date` is called with `'iso'` format THEN the system SHALL CONTINUE TO produce `YYYY-MM-DD` format (e.g. `2008-03-07`)

3.2 WHEN `localized_datetime` is called with `'iso'` format THEN the system SHALL CONTINUE TO produce `YYYY-MM-DDTHH:MM:SS` format (e.g. `2008-03-07T14:30:00`)

3.3 WHEN the notice layout is rendered THEN the system SHALL CONTINUE TO include `notice-detail-content.html`, the `#notice-map` div, the notice title `h1`, and `detail-map-layers.html`

3.4 WHEN `generateSpotPopupContent()` is called with a spot that has a description THEN the system SHALL CONTINUE TO render the description as a `<div><p>` block after the title

3.5 WHEN `generateSpotPopupContent()` is called with a spot that has no description THEN the system SHALL CONTINUE TO omit the description block

3.6 WHEN `generateSpotPopupContent()` is called with a spot that has a location THEN the system SHALL CONTINUE TO render a navigate button linking to Google Maps with the correct coordinates

3.7 WHEN `generateSpotPopupContent()` is called with a spot that has no location THEN the system SHALL CONTINUE TO omit the navigate button

3.8 WHEN `generateSpotPopupContent()` is called THEN the system SHALL CONTINUE TO render the detail page link with the correct locale prefix (`/einstiegsorte/{slug}/` for `de`, `/en/einstiegsorte/{slug}/` for `en`)

3.9 WHEN `generateRejectedSpotPopupContent()` is called THEN the system SHALL CONTINUE TO render the `popup-icon-div` with `noentry` icon, `popup-title`, locale-appropriate "No Entry Spot"/"Kein Zutritt Ort" label, and correct detail page link

3.10 WHEN existing passing RSpec tests for notice layout structure are run THEN the system SHALL CONTINUE TO pass without modification

3.11 WHEN existing passing Jest tests for spot popup description, detail links, navigate button, and rejected popup layout are run THEN the system SHALL CONTINUE TO pass without modification
