# Requirements Document

## Introduction

This spec addresses a comprehensive quality review of the Paddel Buch Jekyll project. It covers security hardening (CSP headers), code duplication reduction across Leaflet map layouts and Ruby plugins, build configuration gaps, i18n corrections, code quality improvements, accessibility enhancements, and repository housekeeping. The goal is to improve maintainability, security posture, and correctness without changing user-facing functionality.

## Glossary

- **CSP_Header**: The Content-Security-Policy HTTP response header defined in `deploy/frontend-deploy.yaml`, controlling which resources the browser is permitted to load.
- **Detail_Layout**: One of the four Jekyll layout files (`spot.html`, `waterway.html`, `obstacle.html`, `notice.html`) that render map-based detail pages.
- **Locate_Control**: The Leaflet locate control (`L.control.locate`) configuration block added to maps on detail pages for user geolocation.
- **Map_Init_Block**: The inline `<script>` section in a Detail_Layout that creates the Leaflet map instance, adds the tile layer, and positions the zoom control.
- **Generator_Plugin**: A Ruby class extending `Jekyll::Generator` in the `_plugins/` directory (e.g. `tile_generator.rb`, `api_generator.rb`).
- **Contentful_Fetcher**: The `Jekyll::ContentfulFetcher` generator plugin in `_plugins/contentful_fetcher.rb` responsible for fetching and caching CMS data.
- **Jekyll_Config**: The `_config.yml` file controlling Jekyll build settings including the `exclude` list.
- **Amplify_Build**: The `amplify.yml` build specification used by AWS Amplify for CI/CD.
- **Language_Switcher**: The navigation dropdown in `_includes/header.html` that allows users to switch between German and English locales.
- **Locale_Filter**: The `Jekyll::LocaleFilter` Liquid filter module in `_plugins/locale_filter.rb`.

## Requirements

### Requirement 1: Harden CSP by Eliminating Inline Scripts

**User Story:** As a site operator, I want inline map initialization scripts moved to external JavaScript files, so that the CSP_Header can drop `'unsafe-inline'` for `script-src` and `style-src` directives.

#### Acceptance Criteria

1. WHEN a Detail_Layout is rendered, THE Detail_Layout SHALL load map initialization logic from an external JavaScript file rather than an inline `<script>` block.
2. THE CSP_Header SHALL specify `script-src 'self'` without `'unsafe-inline'`.
3. THE CSP_Header SHALL specify `style-src 'self'` without `'unsafe-inline'`.
4. WHEN a detail page is loaded in a browser, THE map SHALL initialize and display correctly using the external script.

### Requirement 2: Deduplicate Map Initialization in notice.html

**User Story:** As a developer, I want the repeated map initialization code in `notice.html` consolidated into a single init block, so that the layout is easier to maintain and less error-prone.

#### Acceptance Criteria

1. THE notice Detail_Layout SHALL contain exactly one Map_Init_Block that creates the Leaflet map instance, adds the tile layer, and positions the zoom control.
2. WHEN an event notice has an affected area geometry, THE notice Detail_Layout SHALL fit the map bounds to the affected area.
3. WHEN an event notice has no affected area but has a location, THE notice Detail_Layout SHALL center the map on the notice location.
4. WHEN an event notice has neither affected area nor location, THE notice Detail_Layout SHALL display the map at the default Switzerland center and zoom level.

### Requirement 3: Extract Shared Leaflet Locate Control Configuration

**User Story:** As a developer, I want the identical Leaflet Locate_Control configuration shared across all four Detail_Layouts extracted into a single reusable include or JavaScript module, so that changes only need to be made in one place.

#### Acceptance Criteria

1. THE Locate_Control configuration SHALL be defined in exactly one shared file (either a Jekyll include or a JavaScript module).
2. WHEN any Detail_Layout renders a map, THE Detail_Layout SHALL use the shared Locate_Control configuration.
3. THE Locate_Control SHALL display a localized title string based on the current site locale (`de` or `en`).
4. THE Locate_Control SHALL be positioned at `bottomright` on the map.

### Requirement 4: Extract Shared get_data_for_locale Method

**User Story:** As a developer, I want the duplicated `get_data_for_locale` method in `tile_generator.rb` and `api_generator.rb` extracted into a shared module, so that locale-based data filtering logic is maintained in one place.

#### Acceptance Criteria

1. THE shared `get_data_for_locale` method SHALL be defined in exactly one module (e.g. `GeneratorCache` or a new mixin).
2. WHEN `tile_generator.rb` filters data by locale, THE Generator_Plugin SHALL use the shared method.
3. WHEN `api_generator.rb` filters data by locale, THE Generator_Plugin SHALL use the shared method.
4. FOR ALL locales and data keys, THE shared method SHALL return the same results as the original per-generator implementations.

### Requirement 5: Deduplicate Contentful Fetch-Cache Sequence

**User Story:** As a developer, I want the repeated `perform_full_fetch → compute_hash → save_cache → set_change_flag` sequence in `contentful_fetcher.rb` extracted into a single helper method, so that the sync logic is easier to read and maintain.

#### Acceptance Criteria

1. THE Contentful_Fetcher SHALL define a single helper method that encapsulates the full-fetch, hash-computation, cache-save, and change-flag-set sequence.
2. WHEN a full sync is triggered (force sync, invalid cache, environment mismatch, or sync API error), THE Contentful_Fetcher SHALL call the helper method instead of repeating the sequence inline.
3. WHEN the helper method completes, THE Contentful_Fetcher SHALL set `site.config['contentful_data_changed']` to `true`.
4. THE Contentful_Fetcher SHALL produce identical data output and cache state as the original implementation for all sync trigger paths.

### Requirement 6: Expand Jekyll Exclude List

**User Story:** As a developer, I want the `_config.yml` exclude list to include all non-content directories and files, so that Jekyll does not unnecessarily process test, script, deployment, and documentation files.

#### Acceptance Criteria

1. THE Jekyll_Config exclude list SHALL include `Rakefile`.
2. THE Jekyll_Config exclude list SHALL include `spec/`.
3. THE Jekyll_Config exclude list SHALL include `_tests/`.
4. THE Jekyll_Config exclude list SHALL include `_scripts/`.
5. THE Jekyll_Config exclude list SHALL include `jest.config.js`.
6. THE Jekyll_Config exclude list SHALL include `deploy/`.
7. THE Jekyll_Config exclude list SHALL include `docs/`.
8. THE Jekyll_Config exclude list SHALL include `scripts/`.

### Requirement 7: Make Amplify Build Tests Fail-Fast

**User Story:** As a developer, I want the Amplify_Build to fail when tests fail, so that broken code is not silently deployed.

#### Acceptance Criteria

1. THE Amplify_Build SHALL run `npm test` without the `|| true` suffix.
2. WHEN `npm test` exits with a non-zero status, THE Amplify_Build SHALL abort the build.

### Requirement 8: Pin Ruby 3.4.1 Locally and in Amplify Build

**User Story:** As a developer, I want Ruby 3.4.1 pinned via a `.ruby-version` file and installed explicitly in the Amplify build, so that the same Ruby version is used locally and in CI/CD without relying on the pre-installed image version.

#### Acceptance Criteria

1. THE project root SHALL contain a `.ruby-version` file.
2. THE `.ruby-version` file SHALL specify `ruby-3.4.1` as the required Ruby version.
3. THE Amplify_Build preBuild phase SHALL install Ruby 3.4.1 using `rvm install 3.4.1` before running `bundle install`.
4. THE Amplify_Build preBuild phase SHALL activate Ruby 3.4.1 using `rvm use 3.4.1` after installation.
5. WHEN the Amplify_Build runs `bundle install`, THE build SHALL use Ruby 3.4.1.

### Requirement 9: Fix i18n Typo in en.yml

**User Story:** As a user browsing the English locale, I want the "Paddling Environment Types" label spelled correctly, so that the UI appears professional.

#### Acceptance Criteria

1. THE English translation file (`_i18n/en.yml`) SHALL contain the key `paddling_environment_types` with the value `"Paddling Environment Types"` (correcting the misspelling `"Paddling Envrionment Types"`).

### Requirement 10: Remove Dead Translation Filter Method

**User Story:** As a developer, I want the unused `t` method in `locale_filter.rb` removed, so that the codebase does not contain dead code that could mislead future contributors.

#### Acceptance Criteria

1. THE Locale_Filter module SHALL NOT define a Liquid filter method named `t` that looks up `site.data['translations']`.
2. WHEN the `t` method is removed, THE existing `{% t %}` tag from `jekyll-multiple-languages-plugin` SHALL continue to function correctly for all translation lookups.

### Requirement 11: Replace Class Variable with Class-Level Instance Variable in api_generator.rb

**User Story:** As a developer, I want `@@cached_last_updates` in `api_generator.rb` replaced with a class-level instance variable, so that the variable is scoped to the class and does not leak across the Ruby class hierarchy.

#### Acceptance Criteria

1. THE `api_generator.rb` Generator_Plugin SHALL use a class-level instance variable (`@cached_last_updates` on `self`) instead of the class variable `@@cached_last_updates`.
2. WHEN the default-language pass caches `last_updates`, THE Generator_Plugin SHALL store the value using the class-level instance variable.
3. WHEN a non-default-language pass reads the cached `last_updates`, THE Generator_Plugin SHALL retrieve the value from the class-level instance variable.

### Requirement 12: Add Accessibility Attributes to Map Elements

**User Story:** As a screen reader user, I want map container `<div>` elements to have appropriate ARIA attributes, so that I receive a meaningful description of the map content.

#### Acceptance Criteria

1. WHEN a Detail_Layout renders a map container `<div>`, THE Detail_Layout SHALL include a `role="img"` attribute on the map `<div>`.
2. WHEN a Detail_Layout renders a map container `<div>`, THE Detail_Layout SHALL include an `aria-label` attribute with a locale-appropriate description of the map content.

### Requirement 13: Add hreflang Attributes to Language Switcher Links

**User Story:** As a user or search engine crawler, I want language switcher links to include `hreflang` attributes, so that the target language of each link is explicitly declared.

#### Acceptance Criteria

1. WHEN the Language_Switcher renders a link for a language, THE Language_Switcher SHALL include an `hreflang` attribute matching the target language code (e.g. `de`, `en`).

### Requirement 14: Remove Tracked .DS_Store Files

**User Story:** As a developer, I want `.DS_Store` files removed from Git tracking, so that macOS metadata files do not pollute the repository history.

#### Acceptance Criteria

1. THE repository SHALL NOT contain any tracked `.DS_Store` files.
2. THE `.gitignore` file SHALL continue to include `.DS_Store` to prevent future tracking.

### Requirement 15: Resolve Empty footer.html Include

**User Story:** As a developer, I want the empty `footer.html` placeholder either populated with content or removed from the include chain, so that the codebase does not contain no-op includes.

#### Acceptance Criteria

1. IF `footer.html` remains empty, THEN THE `default.html` layout SHALL NOT include `footer.html`.
2. IF `footer.html` is given content, THEN THE `default.html` layout SHALL continue to include `footer.html`.
