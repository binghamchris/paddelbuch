# Requirements Document

## Introduction

This feature addresses the remaining best-practices findings from a code-quality review of the Paddel Buch Jekyll project that are **not** already covered by previously completed specs (`best-practices-cleanup`, `codebase-quality-improvements`, `build-hardening`, `test-suite-stabilization`, `local-asset-bundling`, `csp-inline-script-extraction`).

The scope is: introducing automated linting/formatting across all four languages, modernising the SCSS module system, eliminating cross-language and intra-file duplication of constants and logic, consolidating internationalisation strings into fewer sources, strengthening test rigour, and correcting documentation/comment drift. No new user-facing functionality is introduced — the goal is a more maintainable, self-consistent, and tool-enforced codebase.

The following review findings are **explicitly out of scope** (per project-owner decision) and MUST NOT be changed by this feature:

- The site-wide `DD MMM YYYY` (`%d %b %Y`) date format is intentional. This feature SHALL NOT alter date *formatting behaviour*; it only corrects stale documentation/comments that still describe the old `DD.MM.YYYY` / `DD/MM/YYYY` behaviour.
- The colour single-source-of-truth "leaks" (hardcoded link colour, `_colors.scss` palette, semantic aliases re-declaring hex) are accepted as-is and SHALL NOT be changed.
- The dashboard metric class-variable caching is correct for the deployed (parallel-process) build and SHALL NOT be changed.

## Glossary

- **Build_System**: The Jekyll build pipeline (`bundle exec jekyll build` and the parallel `rake build:site` flow) plus the Node test/asset scripts.
- **Linter_Config**: A static-analysis configuration file for a specific language — `.rubocop.yml` (Ruby), `eslint.config.js` (JavaScript), `.stylelintrc.json` (SCSS).
- **Ruby_Source**: Any `.rb` file under `_plugins/`, `scripts/`, `spec/`, or the project root (`Rakefile`).
- **JS_Source**: Any first-party browser JavaScript module under `assets/js/` (excluding `assets/js/vendor/`) and the Node scripts under `scripts/`.
- **SCSS_Source**: Any `.scss` file under `_sass/` or `assets/css/`.
- **SCSS_Module_System**: Dart Sass's modern `@use` / `@forward` mechanism that replaces the deprecated `@import` rule.
- **Geo_Constants**: The Switzerland bounding box and tile-size values (`north`, `south`, `east`, `west`, `lat` step, `lon` step) used for spatial tiling.
- **Tile_Generator**: The `Jekyll::TileGenerator` plugin in `_plugins/tile_generator.rb`.
- **Spatial_Utils_Module**: The browser module `assets/js/spatial-utils.js`.
- **Layer_Control_Module**: The browser module `assets/js/layer-control.js` that creates Leaflet markers/layers and binds popups.
- **Popup_Module**: One of the dedicated popup builders — `assets/js/spot-popup.js`, `assets/js/obstacle-popup.js`, `assets/js/event-notice-popup.js`.
- **Translation_File**: One of the i18n YAML files — `_i18n/de.yml`, `_i18n/en.yml`.
- **Mirror_Test**: A test that re-declares (copies) the implementation under test inline instead of importing the real module — e.g. `_tests/unit/spatial-utils.test.js`, `_tests/property/spot-popup.property.test.js`.
- **Dual_Export**: The pattern `if (typeof module !== 'undefined' && module.exports) { module.exports = …; }` appended to an IIFE module so Node/Jest can `require()` the real implementation while the browser continues to use the global.
- **CSP_Steering_Doc**: The steering file describing the Content Security Policy (`.kiro/steering/csp.md`).
- **CDN_Free_Test**: The property test `_tests/property/layout-cdn-free.property.test.js`.

## Requirements

### Requirement 0: Zero Functional and Visual Regression (Hard Requirement)

**User Story:** As a site owner, I want the built site to remain functionally and visually identical after all hardening work, so that no user-facing behaviour, design, or content is altered.

#### Acceptance Criteria

1. THE Build_System SHALL produce a built `_site/` whose rendered HTML, compiled CSS, and JavaScript behaviour are equivalent to the pre-change baseline in all user-facing respects.
2. NO task in this feature SHALL alter the visual design, layout, typography, colours, spacing, or interactive behaviour of any page.
3. NO task in this feature SHALL alter, remove, or reorder any user-facing content (text, images, links, map data, or map interactions).
4. WHEN a SCSS module-system migration is performed, THE Build_System SHALL produce compiled CSS rules that are equivalent to the pre-migration output.
5. WHEN any other requirement (1–8) conflicts with this requirement, THIS requirement SHALL take precedence.

### Requirement 1: Introduce Automated Linting and Formatting

**User Story:** As a developer, I want automated linters for Ruby, JavaScript, and SCSS, so that style and correctness issues are caught mechanically rather than by manual review.

#### Acceptance Criteria

1. THE project SHALL include a RuboCop Linter_Config (`.rubocop.yml`) and `rubocop` SHALL be declared in the `:development` group of the `Gemfile`.
2. THE project SHALL include an ESLint Linter_Config and `eslint` SHALL be declared in `devDependencies` of `package.json`.
3. THE project SHALL include a Stylelint Linter_Config and `stylelint` (with a SCSS-aware config such as `stylelint-config-standard-scss`) SHALL be declared in `devDependencies` of `package.json`.
4. THE ESLint Linter_Config SHALL encode the project's existing JavaScript conventions (browser environment, ES5-compatible syntax, the IIFE-to-global module pattern, permitted `var` usage) and SHALL NOT flag those established patterns as errors.
5. THE Stylelint Linter_Config SHALL accept the project's existing SCSS conventions (BEM class naming, SCSS syntax) and SHALL be configured to flag empty rulesets (`block-no-empty`) and other selected maintainability rules.
6. THE RuboCop Linter_Config SHALL be aligned with the project's existing Ruby style (e.g. `frozen_string_literal` already present) so that adoption does not require behavioural code changes.
7. THE `package.json` SHALL define a `lint` script that runs the JavaScript and SCSS linters, and the `Rakefile` SHALL define a `lint` task that runs the Ruby linter.
8. WHEN a linter is run after configuration, THE linter SHALL complete without configuration errors, AND any pre-existing rule violations that are not auto-fixed SHALL be recorded (via a tracked baseline/inline-disable or fixed) so that the linter exits successfully on a clean tree.
9. WHERE a linter supports auto-fix, fixing pre-existing violations SHALL NOT change runtime behaviour or compiled output (subject to Requirement 0).

### Requirement 2: Modernise the SCSS Module System

**User Story:** As a developer, I want SCSS to use the modern `@use` / `@forward` module system instead of the deprecated `@import` rule, so that builds do not emit deprecation warnings and remain compatible with future Dart Sass releases.

#### Acceptance Criteria

1. THE SCSS_Source files SHALL use the SCSS_Module_System (`@use` / `@forward`) for first-party partials instead of `@import`.
2. WHEN the Build_System compiles SCSS, THE compilation SHALL NOT emit Dart Sass `@import` deprecation warnings originating from first-party SCSS_Source.
3. WHEN first-party partials reference shared variables (colours, fonts, dimensions), THE referencing files SHALL bring those members into scope via `@use` (with an explicit or namespaced reference) rather than relying on global `@import` scope.
4. THE Bootstrap stylesheet SHALL be brought in such that only the required Bootstrap layers/components are compiled, rather than importing the entire framework, PROVIDED the resulting compiled CSS for components actually used remains equivalent (Requirement 0).
5. WHEN the SCSS_Module_System migration is complete, THE compiled `application.css` SHALL be equivalent in its effective rules to the pre-migration output.

### Requirement 3: Centralise Shared Geographic and Tile Constants

**User Story:** As a developer, I want the Switzerland bounds and tile-size constants defined once and consumed everywhere, so that the Ruby tile generator and the browser spatial utilities cannot drift out of sync.

#### Acceptance Criteria

1. THE Geo_Constants SHALL have a single authoritative definition consumed by both the Ruby Build_System and the browser runtime.
2. THE Tile_Generator SHALL derive its Switzerland bounds and tile-size values from the authoritative definition rather than from independent inline literals.
3. THE Spatial_Utils_Module SHALL obtain its Switzerland bounds and tile-size values from the authoritative definition (e.g. injected at build time) rather than from independent inline literals.
4. FOR ALL tile coordinate calculations, THE values used by the Tile_Generator and the Spatial_Utils_Module SHALL be identical.
5. WHEN the authoritative Geo_Constants are changed, THE change SHALL propagate to both the generated tiles and the browser tile math without requiring edits in more than one source location.
6. WHEN the centralisation is complete, THE generated tile files and client tile-loading behaviour SHALL be equivalent to the pre-change baseline (Requirement 0).

### Requirement 4: Remove Duplicated Popup Construction from layer-control.js

**User Story:** As a developer, I want the Layer_Control_Module to rely solely on the dedicated Popup_Modules for popup HTML, so that there is no duplicated, drift-prone popup-construction logic.

#### Acceptance Criteria

1. THE Layer_Control_Module SHALL NOT contain inline reimplementations of spot, obstacle, or event-notice popup HTML that duplicate the corresponding Popup_Module logic.
2. WHEN the Layer_Control_Module needs popup content, THE Layer_Control_Module SHALL obtain it from the corresponding Popup_Module.
3. WHEN a required Popup_Module is unavailable at runtime, THE Layer_Control_Module SHALL degrade gracefully (e.g. bind no popup or a minimal escaped title) WITHOUT reintroducing a full duplicate popup implementation.
4. WHEN the duplication is removed, THE popup content rendered for spots, obstacles, and event notices under normal operation (all modules loaded) SHALL be identical to the pre-change baseline (Requirement 0).
5. THE Layer_Control_Module SHALL NOT interpolate unescaped notice date strings into popup HTML.

### Requirement 5: Consolidate Internationalisation Strings and Enforce Key Parity

**User Story:** As a developer, I want user-facing strings sourced from as few places as practical and an automated check that both locales stay in sync, so that translations cannot silently drift.

#### Acceptance Criteria

1. THE project SHALL provide an automated test that fails when the key structures of the two Translation_Files (`_i18n/de.yml` and `_i18n/en.yml`) do not match.
2. WHEN a key exists in one Translation_File but not the other, THE key-parity test SHALL fail and identify the missing key path.
3. WHERE user-facing strings are currently hardcoded as parallel `de`/`en` literals in JS_Source (Popup_Modules) or in Ruby (`precompute_generator.rb`), THE feature SHALL document each such location and, WHERE practical without violating CSP or Requirement 0, reduce duplication by sourcing them from a single build-time origin.
4. WHEN string consolidation is applied to a given location, THE rendered user-facing text in both locales SHALL be identical to the pre-change baseline (Requirement 0).
5. IF a hardcoded-string location cannot be consolidated without regression or excessive complexity, THEN the feature SHALL record the rationale rather than forcing a change.

### Requirement 6: Strengthen Test Rigour

**User Story:** As a developer, I want tests to exercise the real shipping modules and a coverage floor to be enforced, so that the suite provides genuine regression protection.

#### Acceptance Criteria

1. WHERE a JS_Source module is exercised by a Mirror_Test, THE module SHALL be given a Dual_Export and the test SHALL be updated to `require()` and assert against the real module rather than an inline copy.
2. THE Dual_Export SHALL NOT change browser behaviour — the module SHALL continue to attach its public API to the global object when loaded via a `<script>` tag.
3. THE Jest configuration SHALL define a `coverageThreshold` that establishes a minimum coverage floor based on the current measured coverage.
4. WHEN coverage falls below the configured threshold, THE `npm test -- --coverage` run SHALL exit with a non-zero status.
5. THE empty `_tests/integration/` directory SHALL either contain at least one real integration test OR be removed, so that the test structure does not advertise an unimplemented suite.
6. WHEN the Mirror_Tests are converted, THE converted tests SHALL pass against the real modules with assertions equivalent to (or stronger than) the previous inline-copy assertions.

### Requirement 7: Correct Documentation and Comment Drift

**User Story:** As a developer, I want documentation, steering files, configuration, and code comments to accurately describe the current implementation, so that future contributors are not misled.

#### Acceptance Criteria

1. THE CSP_Steering_Doc SHALL accurately describe the deployed Content Security Policy, including that `script-src` and `connect-src` permit `https://tinylytics.app`, and SHALL NOT claim `script-src` is `'self'`-only or that there are no runtime external script hosts.
2. THE `_config.yml` `exclude` list SHALL NOT contain the non-existent `_scripts/` entry (the real directory is `scripts/`, which SHALL remain excluded).
3. THE comments in `_plugins/locale_filter.rb` and `assets/js/date-utils.js` SHALL accurately describe the intentional site-wide `DD MMM YYYY` date format and SHALL NOT describe the superseded `DD.MM.YYYY` / `DD/MM/YYYY` behaviour as the current behaviour.
4. WHERE `assets/js/date-utils.js` exposes a `numeric` date format that no user-facing display path uses, THE feature SHALL either document it as a non-display utility or align it with the site-wide standard, WITHOUT changing any rendered date on the site (Requirement 0).
5. THE i18n steering documentation SHALL describe the intentional site-wide `DD MMM YYYY` date format rather than locale-specific numeric formats.
6. THE CDN_Free_Test SHALL detect any first-party `<script src>`/`<link href>` pointing at an arbitrary external host (not just a fixed banned-domain list), so that an unintended external reference would fail the test; the existing, intentional `https://tinylytics.app` analytics reference SHALL be handled via an explicit allowlist within the test rather than by oversight.
7. WHEN a path or behaviour referenced by a code comment is corrected elsewhere in this feature, THE corresponding comment SHALL be updated in the same change.

### Requirement 8: Miscellaneous Code-Quality Polish

**User Story:** As a developer, I want a set of small, low-risk quality issues resolved, so that the codebase is consistent and free of avoidable noise.

#### Acceptance Criteria

1. THE `package.json` SHALL NOT contain the stale `_id` field, SHALL declare a supported Node version via an `engines` field, and SHALL use a consistent dependency-version pinning strategy.
2. THE first-party JS_Source SHALL NOT emit diagnostic `console.log` statements in the production runtime path; genuine warnings/errors MAY remain via `console.warn` / `console.error`.
3. THE `assets/js/color-vars.js` module SHALL follow the documented module pattern (`'use strict'` and the standard IIFE wrapper) and SHALL guard its `JSON.parse` against malformed input.
4. WHERE map code rejects coordinates using falsy checks (`!lat || !lon`), THE checks SHALL be corrected so that a legitimate `0` coordinate is not treated as missing.
5. THE utility scripts under `scripts/` SHALL use a `CONTENTFUL_ENVIRONMENT` default consistent with the rest of the project (`master`).
6. THE `_plugins/sitemap_generator.rb` output MAY include `<lastmod>` and bilingual `hreflang` alternate links to improve SEO; IF added, THE generated sitemap SHALL remain valid per the sitemaps.org schema.
7. WHEN polish changes are applied, THE user-facing behaviour SHALL remain unchanged (Requirement 0).
