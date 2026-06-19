# Implementation Plan: Quality and Tooling Hardening

## Overview

Incremental hardening of the Paddel Buch Jekyll project: linting/formatting, SCSS modernisation, constant/logic de-duplication, i18n consolidation, test rigour, and documentation accuracy. All changes are internal — zero functional or visual regression (Requirement 0). Tasks are ordered from lowest to highest risk; a baseline of `_site/` and `application.css` should be captured before starting so each step can be diffed.

Tasks marked `*` are optional / best-effort and may be deferred without blocking the rest.

## Tasks

- [ ] 0. Capture regression baseline
  - Build the site (`JEKYLL_ENV=production bundle exec rake build:site`) and archive `application.css` plus a sample of rendered pages (home, one spot, one waterway, one obstacle, one notice, the statistics + API pages) for later diffing.
  - Record current Jest coverage numbers (`npx jest --coverage`) to inform the threshold in Task 8.
  - _Requirements: 0.1, 0.2, 0.3_

- [ ] 1. Documentation and comment accuracy (lowest risk)
  - [ ] 1.1 Update `.kiro/steering/csp.md` to match the deployed CSP
    - State that `script-src` and `connect-src` permit `https://tinylytics.app`; remove "self only / no runtime external script" wording; keep the rest accurate to `deploy/frontend-deploy.yaml`.
    - _Requirements: 7.1_
  - [ ] 1.2 Remove the stale `_scripts/` entry from the `_config.yml` `exclude` list (keep `scripts/`)
    - _Requirements: 7.2_
  - [ ] 1.3 Correct date-format comments to describe the intentional `DD MMM YYYY` standard
    - Update header/inline comments in `_plugins/locale_filter.rb` and `assets/js/date-utils.js`; stop describing `DD.MM.YYYY` / `DD/MM/YYYY` as current behaviour. Do NOT change formatting logic.
    - _Requirements: 7.3, 7.4_
  - [ ] 1.4 Update the i18n steering doc's "Date Formatting" section to the `DD MMM YYYY` standard
    - _Requirements: 7.5_
  - [ ] 1.5 Audit `assets/js/date-utils.js` `numeric` format usage
    - Grep all call sites; confirm no user-facing display path uses `numeric`. Annotate it as a non-display utility. Leave behaviour (and the existing `best-practices-cleanup` Property 7 test) intact.
    - _Requirements: 7.4_

- [ ] 2. Miscellaneous low-risk polish
  - [ ] 2.1 Clean up `package.json`
    - Remove the stale `_id` field; add `"engines"` (supported Node line); normalise dependency pinning to one consistent strategy; add `"private": true` if not published.
    - _Requirements: 8.1_
  - [ ] 2.2 Remove diagnostic `console.log` from first-party JS
    - Remove or downgrade to `console.warn`/`console.error` where they signal real problems (e.g. `layer-control.js` "Layer controls initialized").
    - _Requirements: 8.2_
  - [ ] 2.3 Standardise `assets/js/color-vars.js`
    - Wrap in `(function(global){ 'use strict'; … })(window)`; guard `JSON.parse` with `try/catch` that warns and leaves `window.PaddelbuchColors` unset on failure.
    - _Requirements: 8.3_
  - [ ] 2.4 Fix falsy coordinate checks
    - Replace `if (!lat || !lon)` style checks in `layer-control.js` (and any other first-party module) with explicit `null`/`undefined`/`NaN` checks so `0` is valid.
    - _Requirements: 8.4_
  - [ ] 2.5 Write property test for coordinate-zero validity (Property 9)
    - **Property 9: Coordinate zero validity**
    - fast-check + Jest in `_tests/property/coordinate-validity.property.test.js`; a `0` lat or lon (other valid) is treated as present.
    - **Validates: Requirements 8.4**
  - [ ] 2.6 Align `CONTENTFUL_ENVIRONMENT` default to `master` in `scripts/*.rb`
    - _Requirements: 8.5_
  - [ ] 2.7* Add `<lastmod>` and `hreflang` alternates to `sitemap_generator.rb`
    - Optional SEO enhancement; keep output valid per sitemaps.org schema.
    - _Requirements: 8.6_

- [ ] 3. Checkpoint — verify docs/polish
  - Run `bundle exec rspec` and `npm test`; diff `_site/` against the baseline (expect no user-facing differences). Resolve any drift before continuing.
  - _Requirements: 0.1, 0.5_

- [ ] 4. Translation key-parity enforcement
  - [ ] 4.1 Add `spec/i18n_key_parity_spec.rb`
    - Flatten `_i18n/de.yml` and `_i18n/en.yml` to dotted key paths; assert the two key sets are equal; report missing keys on failure.
    - _Requirements: 5.1, 5.2_
  - [ ] 4.2 Property test for key parity (Property 5)
    - **Property 5: Translation key parity**
    - RSpec in `spec/i18n_key_parity_spec.rb`; for the two files, the key-path sets are equal.
    - **Validates: Requirements 5.1, 5.2**
  - [ ] 4.3 Fix any key mismatches surfaced by the new test
    - Add missing keys to whichever Translation_File lacks them, preserving existing translations.
    - _Requirements: 5.1, 5.2_
  - [ ] 4.4* Audit and document hardcoded `de`/`en` strings
    - Catalogue parallel literals in the Popup_Modules and `precompute_generator.rb`; where a single build-time origin is feasible without CSP/Requirement-0 risk, route through i18n; otherwise record the rationale.
    - _Requirements: 5.3, 5.4, 5.5_

- [ ] 5. Remove duplicated popup construction from layer-control.js
  - [ ] 5.1 Replace the inline fallback popup builders with minimal guards
    - In `addSpotMarker`, `addObstacleLayer`, `addEventNoticeMarker`: delegate to the Popup_Module; on module-missing, bind an escaped-title-only popup (or none). Remove the duplicated full implementations and the unescaped date interpolation.
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  - [ ] 5.2 Property test for popup parity (Property 4)
    - **Property 4: Popup output unchanged after de-duplication**
    - fast-check + Jest in `_tests/property/layer-control-popup-parity.property.test.js`; with all modules loaded, popup HTML equals the pre-change output for spots/obstacles/notices.
    - **Validates: Requirements 4.2, 4.4**

- [ ] 6. Centralise geographic and tile constants
  - [ ] 6.1 Establish the single authoritative source in `_config.yml`
    - Add tile-size step values alongside the existing `map.bounds` (or a dedicated block) as the authoritative Geo_Constants.
    - _Requirements: 3.1_
  - [ ] 6.2 Update `tile_generator.rb` to read bounds + tile size from `site.config`
    - Keep current literals only as a defensive fallback.
    - _Requirements: 3.2, 3.5_
  - [ ] 6.3 Expose Geo_Constants to the browser and consume in `spatial-utils.js`
    - Mirror the `color-vars.html` pattern: emit a CSP-safe `<script type="application/json">` with the constants; `spatial-utils.js` reads them (literals retained as fallback).
    - _Requirements: 3.3, 3.5_
  - [ ] 6.4 Property test for cross-language agreement (Property 3)
    - **Property 3: Geo constants agree across Ruby and JS**
    - fast-check (`_tests/property/geo-constants-parity.property.test.js`) + Rantly (`spec/plugins/tile_generator_geo_spec.rb`); for any in-bounds point, Ruby and JS compute the same tile `(x, y)`.
    - **Validates: Requirements 3.1, 3.4**

- [ ] 7. Checkpoint — verify i18n, popup, and geo changes
  - Run both suites; rebuild and diff generated tiles + sample pages against baseline.
  - _Requirements: 0.1, 0.5, 3.6, 4.4_

- [ ] 8. Strengthen test rigour
  - [ ] 8.1 Add Dual_Export to mirrored modules
    - Append `if (typeof module !== 'undefined' && module.exports) { module.exports = global.Paddelbuch…; }` to `spatial-utils.js` (and others as their Mirror_Tests are converted). Verify the browser global still works.
    - _Requirements: 6.1, 6.2_
  - [ ] 8.2 Convert Mirror_Tests to import the real modules
    - Rewrite `_tests/unit/spatial-utils.test.js` and `_tests/property/spot-popup.property.test.js` to `require()` the real module and assert against it (mirror the existing `spot-popup-utils.test.js` approach). Remove the inline copies.
    - _Requirements: 6.1, 6.6_
  - [ ] 8.3 Property test for dual-export round-trip (Property 6)
    - **Property 6: Dual export round-trip**
    - Jest in `_tests/unit/dual-export.test.js`; the `require()`d API equals the browser global API.
    - **Validates: Requirements 6.1, 6.2**
  - [ ] 8.4 Add a Jest `coverageThreshold` floor
    - Set `coverageThreshold.global` in `jest.config.js` just below the measured baseline (Task 0). Verify `npm test -- --coverage` passes at the floor and fails below it.
    - _Requirements: 6.3, 6.4_
  - [ ] 8.5 Property/unit test for coverage gate (Property 7)
    - **Property 7: Coverage threshold enforcement**
    - Jest in `_tests/unit/jest-config.test.js`; assert a `coverageThreshold` is configured.
    - **Validates: Requirements 6.3, 6.4**
  - [ ] 8.6 Resolve the empty integration directory
    - Add one real integration test under `_tests/integration/` (e.g. spatial-utils + data-loader + filter-engine interaction) OR remove the directory and its `.gitkeep`.
    - _Requirements: 6.5_

- [ ] 9. Extend the CDN-free test with a host allowlist
  - [ ] 9.1 Broaden `layout-cdn-free.property.test.js`
    - Detect any `http(s)://` or `//` host in first-party `href`/`src` (including `.js?query` URLs); pass only local paths or hosts in an explicit allowlist (`tinylytics.app`); any other external host fails.
    - _Requirements: 7.6_
  - [ ] 9.2 Property test for CDN-free detection (Property 8)
    - **Property 8: CDN-free detection with allowlist**
    - fast-check in `_tests/property/layout-cdn-free.property.test.js`; local/allowlisted hosts pass, all other external hosts fail.
    - **Validates: Requirements 7.6**

- [ ] 10. Migrate the SCSS module system (higher risk — do after a green checkpoint)
  - [ ] 10.1 Convert first-party partials to `@use` / `@forward`
    - Make `_settings.scss`, `_components.scss`, `_util.scss`, `_pages.scss` (and `application.scss`) use `@use`/`@forward`; add `@use "..." as *` where consuming files reference shared members.
    - _Requirements: 2.1, 2.3_
  - [ ] 10.2* Scope the Bootstrap import to required components
    - Replace the whole-framework import with functions/variables/mixins + only the used component partials. If any compiled-CSS diff appears for in-use components, revert to the full import (Requirement 0).
    - _Requirements: 2.4_
  - [ ] 10.3 Verify no first-party `@import` deprecation warnings remain
    - _Requirements: 2.2_
  - [ ] 10.4 Unit test for compiled-CSS parity (Property 2)
    - **Property 2: SCSS migration preserves compiled output**
    - Jest in `_tests/unit/scss-compile-parity.test.js`; effective compiled rules equal the baseline; no first-party `@import` deprecation warning.
    - **Validates: Requirements 2.2, 2.5**

- [ ] 11. Introduce linters and formatters (do last so it lints the final tree)
  - [ ] 11.1 Add RuboCop
    - `gem "rubocop"` in `:development`; `.rubocop.yml` aligned to existing style (TargetRubyVersion 3.4; relax Metrics cops); add a `lint` task to `Rakefile`. Auto-fix safe offenses; baseline/annotate the rest so `bundle exec rubocop` exits clean.
    - _Requirements: 1.1, 1.6, 1.7, 1.8, 1.9_
  - [ ] 11.2 Add ESLint
    - `eslint` in `devDependencies`; flat `eslint.config.js` encoding the IIFE/global/ES5/browser conventions; ignore `assets/js/vendor/**`. Resolve or baseline pre-existing findings so it exits clean.
    - _Requirements: 1.2, 1.4, 1.8, 1.9_
  - [ ] 11.3 Add Stylelint
    - `stylelint` + `stylelint-config-standard-scss` in `devDependencies`; `.stylelintrc.json` enabling `block-no-empty` (removes the empty BEM placeholders) and BEM-friendly rules; ignore vendor. Resolve or baseline findings so it exits clean.
    - _Requirements: 1.3, 1.5, 1.8, 1.9_
  - [ ] 11.4 Wire up `lint` scripts
    - `package.json` `lint` runs ESLint + Stylelint; `Rakefile` `lint` runs RuboCop.
    - _Requirements: 1.7_
  - [ ] 11.5 Tests for linter configuration (Property 1)
    - **Property 1: Linters run cleanly on the tree**
    - `_tests/unit/linter-config.test.js` (configs exist; `lint` script present) and `spec/rubocop_config_spec.rb`; running each linter exits successfully.
    - **Validates: Requirements 1.7, 1.8**

- [ ] 12. Final checkpoint — full verification
  - Run `bundle exec rspec`, `npm test` (with coverage), and `npm run lint` + `rake lint`; rebuild and diff `_site/` against the Task 0 baseline. Confirm zero user-facing regressions and all new property tests pass.
  - _Requirements: 0.1, 0.2, 0.3, 0.4, 0.5_

## Notes

- Tasks marked `*` are optional/best-effort (Bootstrap scoping, sitemap SEO, string consolidation beyond the parity test).
- Each task references specific requirements for traceability; each correctness property is validated by exactly one property test.
- Checkpoints (Tasks 3, 7, 12) enforce Requirement 0 by diffing against the baseline and keeping the existing suites green.
- Ordering rationale: documentation/polish first (no behaviour change), then independent test/dedup work, then the higher-risk SCSS migration, then linters last so they evaluate the final, cleaned tree.
- Ruby commands require chruby activation: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && <command>`.
