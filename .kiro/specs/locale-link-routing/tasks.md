# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Internal Links Missing Locale Prefix on English Site
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate English locale links lack the `/en/` prefix
  - **Scoped PBT Approach**: Build the English site (`site.lang = "en"`, `site.default_lang = "de"`) and check all internal links in the affected includes
  - **Bug Condition**: `isBugCondition(input)` where `input.currentLocale != input.defaultLocale AND input.linkHref does NOT start with "/" + input.currentLocale + "/" AND input.linkHref is an internal link`
  - Write a property-based test (shell script or Ruby script) that:
    1. Builds the Jekyll site for the English locale: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec jekyll build`
    2. Parses the generated HTML in `_site/en/` for all internal `href` attributes in the affected pages
    3. For each internal link, asserts that the `href` starts with `/en/` (the expected behavior from design)
  - Test across all affected includes: spot-popup, obstacle-popup, event-popup, header nav links, spot-detail-content waterway links, obstacle-detail-content waterway/exit/re-entry links, notice-detail-content waterway links, event-list event notice links
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: links like `/einstiegsorte/{slug}/`, `/gewaesser/{slug}/`, `/hindernisse/{slug}/`, `/gewaesserereignisse/{slug}/` are missing the `/en/` prefix)
  - Document counterexamples found (e.g., `href="/einstiegsorte/zurich-lake-north/"` instead of `href="/en/einstiegsorte/zurich-lake-north/"`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - German Locale Links Have No Locale Prefix
  - **IMPORTANT**: Follow observation-first methodology
  - **GOAL**: Capture baseline behavior of German (default locale) links on UNFIXED code, then assert it is preserved
  - Observe: Build the site for the German locale (`site.lang = "de"`, `site.default_lang = "de"`) on UNFIXED code
  - Observe: All internal links in spot-popup, obstacle-popup, event-popup, header, detail pages, and event-list have no locale prefix (e.g., `/einstiegsorte/{slug}/`, `/gewaesser/{slug}/`)
  - Write a property-based test (shell script or Ruby script) that:
    1. Builds the Jekyll site for the German locale: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec jekyll build`
    2. Parses the generated HTML in `_site/` for all internal `href` attributes in the affected pages
    3. For each internal link, asserts that the `href` does NOT start with `/de/` (no locale prefix for default locale)
    4. Asserts that links match the expected German path patterns (`/einstiegsorte/`, `/gewaesser/`, `/hindernisse/`, `/gewaesserereignisse/`, etc.)
  - Additionally verify: language switcher links are present and correctly formed, navbar brand link works
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline German locale behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.8, 3.1, 3.2, 3.5, 3.6_

- [ ] 3. Fix locale link routing across all affected includes

  - [x] 3.1 Add locale prefix logic and update links in `_includes/spot-popup.html`
    - Add locale prefix computation at the top of the file:
      ```liquid
      {% if site.lang != site.default_lang %}
        {% assign locale_prefix = '/' | append: site.lang %}
      {% else %}
        {% assign locale_prefix = '' %}
      {% endif %}
      ```
    - Prepend `locale_prefix` to the "More details" link (`/einstiegsorte/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/einstiegsorte/" for non-default locale_
    - _Preservation: German locale links remain unchanged (locale_prefix is empty)_
    - _Requirements: 1.1, 2.1, 2.8, 3.1_

  - [x] 3.2 Add locale prefix logic and update links in `_includes/obstacle-popup.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to the "More details" link (`/hindernisse/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/hindernisse/" for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.3, 2.3, 2.8, 3.1_

  - [x] 3.3 Add locale prefix logic and update links in `_includes/event-popup.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to the "More details" link (`/gewaesserereignisse/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/gewaesserereignisse/" for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.4, 2.4, 2.8, 3.1_

  - [~] 3.4 Add locale prefix logic and update links in `_includes/header.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to ALL dropdown links:
      - Lake links (`/gewaesser/{slug}/`)
      - "More lakes" link (`/gewaesser/seen`)
      - River links (`/gewaesser/{slug}/`)
      - "More rivers" link (`/gewaesser/fluesse`)
      - Open Data static page links (`/{menu_slug}/{slug}/`)
      - Open Data API link (`/offene-daten/api`)
      - About static page links (`/{menu_slug}/{slug}/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: all header dropdown hrefs start with locale_prefix for non-default locale_
    - _Preservation: German locale header links remain unchanged_
    - _Requirements: 1.5, 1.7, 2.5, 2.7, 2.8, 3.1_

  - [~] 3.5 Add locale prefix logic and update links in `_includes/spot-detail-content.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to the waterway link (`/gewaesser/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/gewaesser/" for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.2, 2.2, 2.8, 3.1_

  - [~] 3.6 Add locale prefix logic and update links in `_includes/obstacle-detail-content.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to:
      - Waterway link (`/gewaesser/`)
      - Exit spot link (`/einstiegsorte/`)
      - Re-entry spot link (`/einstiegsorte/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: all hrefs start with locale_prefix + correct path segment for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.2, 1.6, 2.2, 2.6, 2.8, 3.1_

  - [~] 3.7 Add locale prefix logic and update links in `_includes/notice-detail-content.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to waterway links (`/gewaesser/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/gewaesser/" for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.2, 2.2, 2.8, 3.1_

  - [~] 3.8 Add locale prefix logic and update links in `_includes/event-list.html`
    - Add locale prefix computation at the top of the file
    - Prepend `locale_prefix` to event notice links (`/gewaesserereignisse/`)
    - _Bug_Condition: isBugCondition(input) where input.currentLocale != input.defaultLocale AND linkHref does not start with "/en/"_
    - _Expected_Behavior: href starts with locale_prefix + "/gewaesserereignisse/" for non-default locale_
    - _Preservation: German locale links remain unchanged_
    - _Requirements: 1.4, 2.4, 2.8, 3.1_

  - [~] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Internal Links Include Locale Prefix for Non-Default Locale
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: all English locale internal links must start with `/en/`
    - When this test passes, it confirms the expected behavior is satisfied across all affected includes
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [~] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - German Locale Links Have No Locale Prefix
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions on German locale)
    - Confirm all German locale links remain unchanged after fix
    - _Requirements: 2.8, 3.1, 3.2, 3.5, 3.6_

- [~] 4. Checkpoint - Ensure all tests pass
  - Run full Jekyll build for both locales: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec jekyll build`
  - Run exploration test (Property 1) — must PASS
  - Run preservation test (Property 2) — must PASS
  - Verify English site links all include `/en/` prefix
  - Verify German site links have no locale prefix
  - Ensure all tests pass, ask the user if questions arise
