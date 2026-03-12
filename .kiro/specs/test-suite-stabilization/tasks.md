# Tasks

## Task 1: Fix date/datetime test expectations in notice_preservation_spec.rb

Update the 4 failing property-based tests in `spec/notice_preservation_spec.rb` to expect the current `DD MMM YYYY` format instead of the old `DD.MM.YYYY` / `DD/MM/YYYY` / `DD. Month YYYY` formats.

Requirements addressed: 2.1, 2.2, 2.3

Changes:
- Add a `GERMAN_MONTHS_ABBR` constant at the top of the describe block (mirrors `locale_filter.rb`)
- Test 1 (`localized_date default`): Change DE expected from `strftime('%d.%m.%Y')` to `strftime('%d %b %Y')` + abbr localization. Change EN expected from `strftime('%d/%m/%Y')` to `strftime('%d %b %Y')`
- Test 2 (`localized_date 'long'`): Change expected from `strftime('%d. %B %Y')` + full month localization to `strftime('%d %b %Y')` + abbr localization
- Test 3 (`localized_datetime default`): Change expected from `strftime('%d.%m.%Y %H:%M')` to `strftime('%d %b %Y %H:%M')` + abbr localization
- Test 4 (`localized_datetime 'long'`): Change expected from `strftime('%-d. %B %Y um %H:%M')` + full month localization to `strftime('%d %b %Y um %H:%M')` + abbr localization

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/notice_preservation_spec.rb`

- [x] Done

## Task 2: Fix updatedAt test expectation in notice_page_fixes_spec.rb

Update the failing `updatedAt` format test in `spec/notice_page_fixes_spec.rb` to expect `DD MMM YYYY um HH:MM` instead of `d. MMMM YYYY um HH:MM`.

Requirements addressed: 2.4

Changes:
- Change regex from `/^\d{1,2}\. [[:alpha:]]+ \d{4} um \d{2}:\d{2}$/` to `/^\d{2} [[:alpha:]]{3} \d{4} um \d{2}:\d{2}$/`
- Update failure message example from `'10. Mai 2025 um 14:30'` to `'10 Mai 2025 um 14:30'`

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/notice_page_fixes_spec.rb`

- [ ] Done

## Task 3: Create waterway_filters_spec.rb

Create `spec/plugins/waterway_filters_spec.rb` with property-based tests covering all 5 public filter methods: `top_lakes_by_area`, `top_rivers_by_length`, `sort_waterways_alphabetically`, `lakes_alphabetically`, `rivers_alphabetically`.

Requirements addressed: 2.8

Test approach:
- Include `Jekyll::WaterwayFilters` in a helper class
- Use Rantly to generate random waterway arrays with mixed types, locales, showInMenu values
- Assert filtering correctness, sort order, limit enforcement, and edge cases (nil/empty input)

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/plugins/waterway_filters_spec.rb`

- [ ] Done

## Task 4: Create favicon_generator_spec.rb

Create `spec/plugins/favicon_generator_spec.rb` with unit tests covering SVG favicon and PNG Apple Touch Icon copying behavior.

Requirements addressed: 2.9

Test approach:
- Use tmpdir as site.source, mock site.static_files as an array
- Test: SVG exists → favicon.ico added; SVG missing → not added
- Test: PNG exists → apple-touch-icon.png added; PNG missing → warning logged, not added
- Test: AliasedStaticFile#path and #destination return correct values

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/plugins/favicon_generator_spec.rb`

- [ ] Done

## Task 5: Create i18n_patch_spec.rb

Create `spec/plugins/i18n_patch_spec.rb` with unit tests verifying the Ruby 3.4 nil-safety monkey-patch for TranslatedString.

Requirements addressed: 2.10

Test approach:
- Define a minimal TranslatedString class if not already defined
- Trigger the `:site, :after_init` hook
- Verify `TranslatedString.new(nil, 'key')` does not raise
- Verify `TranslatedString.new('value', 'key')` still works
- Verify `I18nPatch.patched?` returns true
- Verify idempotency

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/plugins/i18n_patch_spec.rb`

- [ ] Done

## Task 6: Create tile_generator_spatial_spec.rb

Create `spec/plugins/tile_generator_spatial_spec.rb` with property-based and unit tests for the spatial logic methods: `get_tile_bounds`, `get_tile_for_point`, `point_in_bounds?`, `calculate_centroid`, `extract_coordinates`, `get_data_for_locale`.

Requirements addressed: 2.11

Test approach:
- Use `send` to access private methods on a TileGenerator instance
- Property-based tests (Rantly) for bounds calculation and point-to-tile assignment
- Unit tests for centroid calculation across all GeoJSON types
- Unit tests for coordinate extraction and locale data filtering

Verify: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/plugins/tile_generator_spatial_spec.rb`

- [ ] Done

## Task 7: Create spot-popup-utils.test.js

Create `_tests/unit/spot-popup-utils.test.js` with Jest unit tests for the 5 utility functions exported by `spot-popup.js`: `escapeHtml`, `stripHtml`, `truncate`, `getIconPath`, `getLabels`.

Requirements addressed: 2.12

Test approach:
- Load `spot-popup.js` via require, access functions from `window.PaddelbuchSpotPopup`
- Test escapeHtml: XSS characters, null/undefined, normal text
- Test stripHtml: tag removal, nested tags, null/undefined
- Test truncate: over-limit, under-limit, null/undefined
- Test getIconPath: each spot type, rejected, unknown slug, variant parameter
- Test getLabels: de/en locales, default behavior, all keys present

Verify: `npx jest _tests/unit/spot-popup-utils.test.js`

- [ ] Done

## Task 8: Run full test suite and verify zero failures

Run both the complete RSpec and Jest test suites to confirm all tests pass with zero failures.

Verify:
- `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
- `npx jest`

- [ ] Done
