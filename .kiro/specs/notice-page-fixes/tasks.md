# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Notice Page Content Structure Defects
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three bugs exist
  - **Scoped PBT Approach**: Use Rantly to generate notice data with varying dates and descriptions, scoped to the bug condition (notices collection, notice layout)
  - Create `spec/notice_page_fixes_spec.rb` with an RSpec context for bug condition exploration
  - **Test 1 — Redundant Kurzfassung**: Build a mock Jekyll site context, render `notice-detail-content.html` with a notice that has a description, then simulate the `{{ content }}` rendering from `default.html`. Assert the combined output contains at most one Kurzfassung/summary heading. On unfixed code, `{{ content }}` in `default.html` may render duplicate description content alongside the include's `h2` heading.
  - **Test 2 — Extraneous Gewässerereignisse**: Render the notice-icon-div from `_layouts/notice.html` and assert it does NOT contain a standalone "Gewässerereignisse" text label. On unfixed code, `{% t event_notices.title %}` renders this label.
  - **Test 3 — Start Date Format**: Use Rantly to generate random ISO date strings (`YYYY-MM-DD`). Render `notice-detail-content.html` with `startDate` set to the generated date. Assert the rendered start date cell matches `/^\d{4}-\d{2}-\d{2}$/`. On unfixed code, `localized_date` produces `DD.MM.YYYY`.
  - **Test 4 — Updated Timestamp Format**: Use Rantly to generate random ISO datetime strings. Render `notice-detail-content.html` with `updatedAt` set to the generated datetime. Assert the rendered updated cell matches `/^\d{2}\. \w+ \d{4} um \d{2}:\d{2}$/`. On unfixed code, `localized_date` produces `DD.MM.YYYY` without time.
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found (e.g., duplicate Kurzfassung headings, "Gewässerereignisse" label present, date `01.03.2025` instead of `2025-03-01`, timestamp `10.05.2025` instead of `10. Mai 2025 um 14:30`)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Notice Page and Filter Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code first**, then write property-based tests capturing observed behavior
  - **Test 1 — localized_date filter preservation**: Use Rantly to generate random date strings. Observe that `localized_date` (no format arg) produces `DD.MM.YYYY` for `de` locale and `DD/MM/YYYY` for `en` locale. Write property: for all dates and both locales, `localized_date` without format arg produces the same output before and after fix.
  - **Test 2 — localized_date 'long' format preservation**: Use Rantly to generate random dates. Observe that `localized_date: 'long'` produces `DD. Month YYYY` for `de`. Write property: for all dates, `localized_date: 'long'` output is unchanged.
  - **Test 3 — localized_datetime default format preservation**: Use Rantly to generate random datetimes. Observe that `localized_datetime` (no format arg) produces `DD.MM.YYYY HH:MM` for `de`. Write property: for all datetimes, `localized_datetime` default output is unchanged.
  - **Test 4 — localized_datetime 'long' format preservation**: Observe that `localized_datetime: 'long'` produces `DD. Month YYYY, HH:MM Uhr` for `de`. Write property: for all datetimes, existing `'long'` format output is unchanged.
  - **Test 5 — Notice map and details panel preservation**: Verify that the notice layout still includes `notice-detail-content.html`, the `#notice-map` div, the notice title `h1`, the notice type badge div, waterway links, and the `detail-map-layers.html` include.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.4, 3.5, 3.7, 3.9, 3.10, 3.11_

- [ ] 3. Fix notice page content structure, navigation label, and date formatting

  - [x] 3.1 Add `notice_updated` datetime format to `_plugins/locale_filter.rb`
    - Add a `'notice_updated'` key to the `get_datetime_format` method's format hash
    - German (`de`): `'%d. %B %Y um %H:%M'` → produces `10. Mai 2025 um 14:30`
    - English (`en`): `'%d %B %Y at %H:%M'` → produces `10 May 2025 at 14:30`
    - Do NOT modify any existing format entries — only add the new key
    - _Bug_Condition: isBugCondition(input) where input.page.collection == 'notices' AND hasIncorrectDateFormat(html, page)_
    - _Expected_Behavior: updatedAt formatted as `dd. MMMM YYYY um HH:MM` (de) or `dd MMMM YYYY at HH:MM` (en)_
    - _Preservation: All existing format types (nil, 'short', 'long', 'iso') must remain unchanged_
    - _Requirements: 2.3, 3.9_

  - [x] 3.2 Fix date formatting in `_includes/notice-detail-content.html`
    - Change `{{ notice.startDate | localized_date }}` to `{{ notice.startDate | localized_date: 'iso' }}` to produce `YYYY-MM-DD`
    - Change `{{ notice.updatedAt | localized_date }}` to `{{ notice.updatedAt | localized_datetime: 'notice_updated' }}` to produce `dd. MMMM YYYY um HH:MM`
    - Do NOT change `{{ notice.endDate | localized_date }}` — end date format is not specified in the bug report
    - _Bug_Condition: isBugCondition(input) where hasIncorrectDateFormat(html, page)_
    - _Expected_Behavior: startDate matches /^\d{4}-\d{2}-\d{2}$/, updatedAt matches /^\d{2}\. \w+ \d{4} um \d{2}:\d{2}$/_
    - _Preservation: endDate formatting unchanged, waterway links unchanged, description section unchanged_
    - _Requirements: 2.3_

  - [x] 3.3 Remove extraneous Gewässerereignisse label from `_layouts/notice.html`
    - Remove or replace the `<span>{% t event_notices.title %}</span>` inside the `notice-icon-div`
    - The notice-icon-div should remain as a container but without the collection-level title text acting as a breadcrumb
    - _Bug_Condition: isBugCondition(input) where hasExtraneousGewaesserereignisseLink(html)_
    - _Expected_Behavior: notice-icon-div does NOT contain standalone "Gewässerereignisse" text_
    - _Preservation: Notice type badge div structure preserved, notice title h1 preserved_
    - _Requirements: 2.2_

  - [x] 3.4 Suppress redundant content rendering for notice pages
    - In `_layouts/notice.html`, ensure `{{ content }}` from `default.html` does not produce duplicate Kurzfassung/description elements
    - Option A: Override the content block so the notice layout wraps its own content and `{{ content }}` in `default.html` renders the notice template (this is the current mechanism — the layout content IS `{{ content }}`)
    - Option B: Ensure the collection generator sets empty body content for notice documents so `{{ content }}` renders nothing extra
    - Verify that after the fix, only the single `h2` Kurzfassung heading from `notice-detail-content.html` appears
    - _Bug_Condition: isBugCondition(input) where hasRedundantKurzfassungElements(html)_
    - _Expected_Behavior: At most one summary/Kurzfassung heading in rendered HTML_
    - _Preservation: Non-notice pages continue to render {{ content }} normally_
    - _Requirements: 2.1_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Notice Page Content Structure
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for all three bugs
    - When this test passes, it confirms: no redundant Kurzfassung, no extraneous Gewässerereignisse, correct date formats
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all three bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Notice Page and Filter Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing date filter formats unchanged, notice map/details panel intact, non-notice pages unaffected

- [~] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
  - Ensure all tests pass, including the new bug condition and preservation tests
  - Optionally build the site and manually verify a notice page renders correctly: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec jekyll build`
  - Ask the user if questions arise
