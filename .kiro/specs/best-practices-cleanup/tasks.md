# Implementation Plan: Best Practices Cleanup

## Overview

Incremental cleanup of the Paddel Buch Jekyll project across Ruby plugins, JavaScript modules, SCSS partials, and the default HTML layout. All changes are internal — zero visual or content regression (Requirement 0). Tasks are ordered so shared modules and dependencies are created before consumers are updated.

## Tasks

- [x] 1. Add frozen_string_literal comment to all plugin files
  - [x] 1.1 Add `# frozen_string_literal: true` to the 11 plugin files that lack it
    - Files: `api_generator.rb`, `build_timer.rb`, `collection_generator.rb`, `contentful_mappers.rb`, `env_loader.rb`, `i18n_patch.rb`, `locale_filter.rb`, `sitemap_generator.rb`, `ssl_patch.rb`, `tile_generator.rb`, `waterway_filters.rb`
    - Prepend the comment as the first line followed by a blank line
    - Do not modify files that already have the comment
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Write property test for frozen string literal presence (Property 1)
    - **Property 1: Frozen string literal presence and uniqueness**
    - RSpec test in `spec/plugins/frozen_string_literal_spec.rb`
    - For every `.rb` file in `_plugins/`, assert first non-empty line is exactly `# frozen_string_literal: true` and it appears exactly once
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Remove dead code from api_generator.rb
  - [x] 2.1 Delete the `normalize_timestamp` method from `_plugins/api_generator.rb`
    - Remove the method definition (~7 lines around line 258)
    - Verify `normalize_to_contentful_timestamp` remains intact
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Write property test for timestamp normalization round trip (Property 2)
    - **Property 2: Timestamp normalization round trip**
    - RSpec test in `spec/plugins/api_generator_spec.rb`
    - For any valid ISO 8601 timestamp, `normalize_to_contentful_timestamp` returns `YYYY-MM-DDTHH:MM:SSZ` and is idempotent
    - **Validates: Requirements 2.2**

- [x] 3. Checkpoint — Verify Ruby plugin changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create shared html-utils.js module
  - [x] 4.1 Create `assets/js/html-utils.js` with `escapeHtml`, `stripHtml`, and `truncate`
    - IIFE pattern exporting `PaddelbuchHtmlUtils` on `window`
    - Single canonical implementation of each function
    - Handle `null`/`undefined` input by returning empty string
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 4.2 Write property test for escapeHtml (Property 3)
    - **Property 3: HTML escaping correctness**
    - fast-check + Jest test in `_tests/html-utils.test.js`
    - For any string with HTML special characters, result contains no unescaped `<` or `>`
    - **Validates: Requirements 3.1**

  - [x] 4.3 Write property test for stripHtml (Property 4)
    - **Property 4: HTML stripping completeness**
    - fast-check + Jest test in `_tests/html-utils.test.js`
    - For any string with HTML tags, result contains no substrings matching `<[^>]*>`
    - **Validates: Requirements 3.2**

  - [x] 4.4 Write property test for truncate (Property 5)
    - **Property 5: Truncation length invariant**
    - fast-check + Jest test in `_tests/html-utils.test.js`
    - Output length ≤ `maxLength + 3`; if input ≤ maxLength, output equals input
    - **Validates: Requirements 3.3**

- [x] 5. Consolidate date functions into date-utils.js
  - [x] 5.1 Update `assets/js/date-utils.js` to add `'short'` format support to `formatDate`
    - Add `format` parameter (`'numeric'` default, `'short'` for abbreviated month)
    - Move `monthsAbbr` arrays into `date-utils.js`
    - Ensure `isDateInFuture` uses date-only comparison (today or future → true)
    - _Requirements: 3.4, 3.5, 3.7, 3.8_

  - [x] 5.2 Write property test for isDateInFuture (Property 6)
    - **Property 6: Date-in-future uses date-only comparison**
    - fast-check + Jest test in `_tests/date-utils.test.js`
    - Same-day dates return true regardless of time; strictly past dates return false
    - **Validates: Requirements 3.7**

  - [x] 5.3 Write property test for formatDate dual format (Property 7)
    - **Property 7: Format date dual format support**
    - fast-check + Jest test in `_tests/date-utils.test.js`
    - `'numeric'` → `DD.MM.YYYY` (de) / `DD/MM/YYYY` (en); `'short'` → `DD MMM YYYY`
    - **Validates: Requirements 3.8**

- [x] 6. Refactor popup modules to use shared utilities
  - [x] 6.1 Update `spot-popup.js` to use `PaddelbuchHtmlUtils`
    - Remove local `escapeHtml`, `stripHtml`, `truncate` definitions
    - Replace calls with `PaddelbuchHtmlUtils.*`
    - Remove these from the module's own exports
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

  - [x] 6.2 Update `obstacle-popup.js` to use `PaddelbuchHtmlUtils`
    - Remove local `escapeHtml` definition
    - Replace calls with `PaddelbuchHtmlUtils.escapeHtml`
    - _Requirements: 3.1, 3.6_

  - [x] 6.3 Update `event-notice-popup.js` to use shared utilities
    - Remove local `escapeHtml`, `stripHtml`, `truncate`, `isDateInFuture`, `formatDate`, `monthsAbbr`
    - Replace with `PaddelbuchHtmlUtils.*` and `PaddelbuchDateUtils.*`
    - Pass `'short'` format parameter to `formatDate` calls
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 6.4 Update script loading order in `_includes/map-init.html`
    - Add `html-utils.js` script tag before popup module script tags
    - Ensure `date-utils.js` loads before `event-notice-popup.js`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Checkpoint — Verify JavaScript refactoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create color generator plugin and wire to layer-styles.js
  - [x] 8.1 Create `_plugins/color_generator.rb`
    - Parse `_sass/settings/_paddelbuch_colours.scss` via regex for `$variable: #hex` pairs
    - Convert variable names to camelCase
    - Write result to `site.data['paddelbuch_colors']`
    - Include `# frozen_string_literal: true` as first line
    - Log warning via `Jekyll.logger.warn` if file unreadable or no colors found
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 8.2 Write property test for SCSS color parsing (Property 8)
    - **Property 8: SCSS color parsing to JSON**
    - RSpec test in `spec/plugins/color_generator_spec.rb`
    - For any SCSS with `$variable: #hex;` lines, output JSON has correct camelCase keys and hex values
    - **Validates: Requirements 5.3**

  - [x] 8.3 Create `_includes/color-vars.html` inline script include
    - Output `<script>window.PaddelbuchColors = {{ site.data.paddelbuch_colors | jsonify }};</script>`
    - _Requirements: 5.3_

  - [x] 8.4 Add color-vars include to `_layouts/default.html`
    - Place `{% include color-vars.html %}` in `<head>` before JS script tags
    - _Requirements: 5.3, 5.4_

  - [x] 8.5 Update `assets/js/layer-styles.js` to use `window.PaddelbuchColors`
    - Replace hardcoded `colors` object with `var colors = window.PaddelbuchColors || {};`
    - _Requirements: 5.2, 5.4_

- [x] 9. Trim unused Material UI color variables
  - [x] 9.1 Reduce `_sass/settings/_colors.scss` to only referenced variables
    - Keep: `$blue-grey-50`, `$blue-grey-200`, `$blue-grey-500`, `$white`, `$black`
    - Remove all other Material UI color families
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 10. Fix deprecated clip property
  - [x] 10.1 Replace `clip: rect(0 0 0 0)` with `clip-path: inset(50%)` in `_sass/util/_helpers.scss`
    - Update the `.visually-hidden` class
    - _Requirements: 6.1, 6.2_

- [x] 11. Audit and reduce !important declarations
  - [x] 11.1 Remove unjustified `!important` from `_sass/components/_header.scss`
    - Remove `!important` from `.paddelbuch-logo` `margin-right`; use `header .paddelbuch-logo` for specificity
    - Add explanatory comments to the 4 justified `!important` declarations (Bootstrap overrides)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.2 Remove unjustified `!important` from `_sass/components/_map.scss`
    - Remove `!important` from `.popup-icon img` `width` (use `.popup-icon > img` specificity)
    - Remove `!important` from `.popup-btn-right` `text-decoration` (use `a.popup-btn-right` specificity)
    - Add explanatory comments to all justified `!important` declarations (Leaflet/Bootstrap overrides)
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 12. Checkpoint — Verify SCSS and plugin changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add SEO meta tags to default layout
  - [x] 13.1 Add canonical URL, Open Graph, and Twitter Card meta tags to `_layouts/default.html`
    - Add `<link rel="canonical">` with `site.url` + page URL (strip trailing `index.html`)
    - Add `og:title`, `og:description`, `og:url`, `og:type`, `og:locale` meta tags
    - Add `twitter:card`, `twitter:title`, `twitter:description` meta tags
    - Use page front matter `title`/`description` with fallback to `site.title`/`site.description`
    - Map `og:locale`: `de` → `de_CH`, `en` → `en_GB`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 13.2 Write property test for canonical URL correctness (Property 9)
    - **Property 9: Canonical URL correctness**
    - RSpec test in `spec/layouts/default_layout_spec.rb`
    - Canonical href = `site.url` + page URL with `index.html` stripped
    - **Validates: Requirements 8.1**

  - [x] 13.3 Write property test for Open Graph tags presence (Property 10)
    - **Property 10: Open Graph tags presence**
    - RSpec test in `spec/layouts/default_layout_spec.rb`
    - Head contains `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`
    - **Validates: Requirements 8.2**

  - [x] 13.4 Write property test for Twitter Card tags presence (Property 11)
    - **Property 11: Twitter Card tags presence**
    - RSpec test in `spec/layouts/default_layout_spec.rb`
    - Head contains `twitter:card`, `twitter:title`, `twitter:description`
    - **Validates: Requirements 8.3**

  - [x] 13.5 Write property test for SEO tags using page-specific front matter (Property 12)
    - **Property 12: SEO tags use page-specific front matter**
    - RSpec test in `spec/layouts/default_layout_spec.rb`
    - When page defines `title`/`description`, meta tags use page values not site defaults
    - **Validates: Requirements 8.4, 8.5**

  - [x] 13.6 Write property test for Open Graph locale (Property 13)
    - **Property 13: Open Graph locale reflects current language**
    - RSpec test in `spec/layouts/default_layout_spec.rb`
    - `de` → `de_CH`, `en` → `en_GB`
    - **Validates: Requirements 8.7**

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Dependency order: html-utils.js (task 4) before popup refactoring (task 6); color_generator.rb (task 8.1) before layer-styles.js update (task 8.5)
