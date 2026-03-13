# Requirements Document

## Introduction

This feature addresses technical debt and best-practices violations identified during a code quality review of the Paddel Buch Jekyll project. The cleanup covers Ruby plugin consistency, dead code removal, JavaScript DRY violations, SCSS bloat and deprecations, and missing HTML SEO meta tags. No new user-facing functionality is introduced — the goal is a cleaner, more maintainable codebase.

## Glossary

- **Plugin_File**: A Ruby source file located in the `_plugins/` directory that extends Jekyll build behavior.
- **Frozen_String_Literal_Comment**: The magic comment `# frozen_string_literal: true` placed as the first line of a Ruby file, instructing the interpreter to freeze all string literals for improved performance and safety.
- **Popup_Module**: A JavaScript IIFE module in `assets/js/` that generates HTML popup content for map features (spots, obstacles, or event notices).
- **Date_Utils_Module**: The shared JavaScript module `assets/js/date-utils.js` providing locale-aware date formatting and date comparison utilities.
- **Color_Palette_File**: The SCSS partial `_sass/settings/_colors.scss` that imports Material UI color variables.
- **Paddelbuch_Colours_File**: The SCSS partial `_sass/settings/_paddelbuch_colours.scss` defining the project's custom color palette.
- **Layer_Styles_Module**: The JavaScript module `assets/js/layer-styles.js` that defines GeoJSON styling colors for map layers.
- **Helpers_Partial**: The SCSS partial `_sass/util/_helpers.scss` containing utility classes such as `.visually-hidden`.
- **Default_Layout**: The HTML layout file `_layouts/default.html` used as the base template for all pages.
- **Canonical_URL**: A `<link rel="canonical">` tag in the HTML `<head>` that specifies the preferred URL for a page.
- **Open_Graph_Tags**: A set of `<meta property="og:*">` tags that control how a page appears when shared on social media platforms.
- **Twitter_Card_Tags**: A set of `<meta name="twitter:*">` tags that control how a page appears when shared on Twitter/X.

## Requirements

### Requirement 0: Zero Visual and Content Regression (Hard Requirement)

**User Story:** As a site owner, I want the built site to remain visually and functionally identical after all cleanup work, so that no user-facing design, experience, or content is altered.

#### Acceptance Criteria

1. THE Build_System SHALL produce a built site whose rendered HTML, CSS, and JavaScript behavior is identical to the pre-cleanup baseline in all user-facing respects.
2. NO cleanup task SHALL alter the visual design, layout, typography, colors, or spacing of any page.
3. NO cleanup task SHALL alter, remove, or reorder any user-facing content (text, images, links, map data, or interactive behavior).
4. NO cleanup task SHALL introduce new user-visible UI elements, change navigation, or modify the site's user experience in any way.
5. WHEN any individual requirement (1–8) conflicts with this requirement, THIS requirement SHALL take precedence.

### Requirement 1: Add frozen_string_literal Comment to All Plugin Files

**User Story:** As a developer, I want all Ruby plugin files to include the `frozen_string_literal: true` magic comment, so that string handling is consistent and performance is improved across the codebase.

#### Acceptance Criteria

1. THE Build_System SHALL include the comment `# frozen_string_literal: true` as the first line of every Plugin_File in the `_plugins/` directory.
2. WHEN a Plugin_File already contains the Frozen_String_Literal_Comment, THE Build_System SHALL preserve the existing comment without duplication.
3. WHEN the Frozen_String_Literal_Comment is added to a Plugin_File, THE Plugin_File SHALL continue to function without runtime errors during a Jekyll build.

### Requirement 2: Remove Dead Code from api_generator.rb

**User Story:** As a developer, I want unused methods removed from `api_generator.rb`, so that the codebase contains no dead code that could confuse future maintainers.

#### Acceptance Criteria

1. THE ApiGenerator Plugin_File SHALL not define the `normalize_timestamp` method (approximately line 258 of `api_generator.rb`).
2. WHEN the `normalize_timestamp` method is removed, THE ApiGenerator Plugin_File SHALL continue to use the `normalize_to_contentful_timestamp` method for all timestamp normalization.
3. WHEN the `normalize_timestamp` method is removed, THE Build_System SHALL produce identical JSON API output as before the removal.

### Requirement 3: Extract Shared JavaScript Utility Functions

**User Story:** As a developer, I want duplicated utility functions consolidated into shared modules, so that bug fixes and changes only need to happen in one place.

#### Acceptance Criteria

1. THE `escapeHtml` function SHALL be defined in exactly one shared JavaScript module and imported by spot-popup.js, obstacle-popup.js, and event-notice-popup.js.
2. THE `stripHtml` function SHALL be defined in exactly one shared JavaScript module and imported by spot-popup.js and event-notice-popup.js.
3. THE `truncate` function SHALL be defined in exactly one shared JavaScript module and imported by spot-popup.js and event-notice-popup.js.
4. THE `isDateInFuture` function SHALL be defined in exactly one module (Date_Utils_Module) and imported by event-notice-popup.js.
5. THE `formatDate` function SHALL be defined in exactly one module (Date_Utils_Module) and imported by event-notice-popup.js.
6. WHEN a Popup_Module calls a shared utility function, THE Popup_Module SHALL produce identical HTML output as before the refactoring.
7. WHEN the `isDateInFuture` function is consolidated, THE consolidated implementation SHALL compare dates by their date-only component (ignoring time), returning true when the date is today or in the future.
8. WHEN the `formatDate` function is consolidated into Date_Utils_Module, THE consolidated implementation SHALL support both the `DD.MM.YYYY` / `DD/MM/YYYY` format (existing Date_Utils_Module behavior) and the `DD MMM YYYY` abbreviated-month format (existing event-notice-popup.js behavior) via a format parameter.

### Requirement 4: Remove Unused Material UI Color Variables

**User Story:** As a developer, I want the massive unused Material UI color palette trimmed down, so that the SCSS codebase is leaner and compile times are reduced.

#### Acceptance Criteria

1. THE Color_Palette_File SHALL define only the Material UI color variables that are referenced elsewhere in the SCSS codebase.
2. WHEN a Material UI color variable is not referenced by any SCSS file outside of Color_Palette_File, THE Color_Palette_File SHALL not define that variable.
3. WHEN unused color variables are removed, THE Build_System SHALL produce a CSS output file that is byte-for-byte identical in its compiled rules to the output before removal.

### Requirement 5: Establish Paddelbuch_Colours_File as the Single Source of Truth for Colors

**User Story:** As a developer, I want color values defined once in `_paddelbuch_colours.scss` and consumed by both SCSS and JavaScript, so that color changes do not require updates in multiple files.

#### Acceptance Criteria

1. THE Paddelbuch_Colours_File SHALL be the single source of truth for all project color values shared between SCSS and JavaScript.
2. THE Layer_Styles_Module SHALL not hardcode hex color values that duplicate values already defined in Paddelbuch_Colours_File.
3. WHEN a color value is needed in both SCSS and JavaScript, THE Build_System SHALL provide a mechanism to derive the JavaScript color values from Paddelbuch_Colours_File.
4. WHEN a color value is changed in Paddelbuch_Colours_File, THE change SHALL be reflected in both the compiled CSS and the JavaScript runtime without requiring a manual update in a second file.

### Requirement 6: Replace Deprecated clip Property with clip-path

**User Story:** As a developer, I want the deprecated `clip` CSS property replaced with the modern `clip-path` equivalent, so that the codebase follows current CSS standards and avoids future browser compatibility issues.

#### Acceptance Criteria

1. THE `.visually-hidden` class in Helpers_Partial SHALL use `clip-path: inset(50%)` instead of `clip: rect(0 0 0 0)`.
2. WHEN the `.visually-hidden` class is updated, THE class SHALL continue to visually hide elements while keeping them accessible to screen readers.

### Requirement 7: Audit and Reduce !important Declarations

**User Story:** As a developer, I want unnecessary `!important` declarations removed or replaced with proper specificity, so that the CSS is easier to maintain and override.

#### Acceptance Criteria

1. WHEN an `!important` declaration in `_map.scss` or `_header.scss` is required to override a third-party library style (Leaflet or Bootstrap), THE declaration SHALL include a comment explaining the override reason.
2. WHEN an `!important` declaration in `_map.scss` or `_header.scss` is not required to override a third-party library style, THE declaration SHALL be removed and replaced with a selector of sufficient specificity.
3. WHEN an `!important` declaration is removed, THE Build_System SHALL produce visually identical rendering of the affected component.

### Requirement 8: Add SEO Meta Tags to Default Layout

**User Story:** As a developer, I want the default HTML layout to include canonical URL, Open Graph, and Twitter Card meta tags, so that search engines and social media platforms can properly index and display page previews.

#### Acceptance Criteria

1. THE Default_Layout SHALL include a `<link rel="canonical">` tag in the `<head>` element, with the `href` attribute set to the full canonical URL of the current page.
2. THE Default_Layout SHALL include Open_Graph_Tags for at minimum: `og:title`, `og:description`, `og:url`, `og:type`, and `og:locale`.
3. THE Default_Layout SHALL include Twitter_Card_Tags for at minimum: `twitter:card`, `twitter:title`, and `twitter:description`.
4. WHEN a page defines a custom `title` in its front matter, THE Open_Graph_Tags and Twitter_Card_Tags SHALL use that page-specific title.
5. WHEN a page defines a custom `description` in its front matter, THE Open_Graph_Tags and Twitter_Card_Tags SHALL use that page-specific description.
6. WHEN a page does not define a custom `description`, THE Open_Graph_Tags and Twitter_Card_Tags SHALL fall back to `site.description`.
7. THE `og:locale` tag SHALL reflect the current language of the page (e.g., `de_CH` for German, `en_GB` for English).
