# Bugfix Requirements Document

## Introduction

The homepage of the Paddel Buch site is missing after the migration from Gatsby to Jekyll. When a user navigates to the root URL (`/`), no page is served because there is no `index.html` (or `index.md`) file in the project root. The design document and existing SCSS styles (`_sass/pages/_home.scss`) reference a homepage with `pageName: home` that displays a full-screen interactive map centered on Switzerland, but the actual page file was never created during the migration. The header's brand logo links to `/`, the 404 page links back to `/`, yet the destination does not exist.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user navigates to the root URL (`/`) THEN the system does not serve a homepage because no `index.html` file exists in the project root, resulting in either a 404 error or a directory listing

1.2 WHEN Jekyll builds the site THEN the system does not generate an `index.html` in the `_site/` output directory because there is no source `index.html` or `index.md` file to process

1.3 WHEN a user clicks the "Paddel Buch" brand logo in the header THEN the system navigates to `/` which has no content, leaving the user on a broken page

1.4 WHEN a user clicks "Back to Home" on the 404 error page THEN the system navigates to `/` which itself has no content

### Expected Behavior (Correct)

2.1 WHEN a user navigates to the root URL (`/`) THEN the system SHALL serve a homepage that displays a full-screen interactive map centered on Switzerland (lat: 46.801111, lon: 8.226667) using the `default` layout with `pageName: home`

2.2 WHEN Jekyll builds the site THEN the system SHALL generate an `index.html` in the `_site/` output directory and an `en/index.html` for the English locale

2.3 WHEN a user clicks the "Paddel Buch" brand logo in the header THEN the system SHALL navigate to the homepage displaying the interactive map

2.4 WHEN a user clicks "Back to Home" on the 404 error page THEN the system SHALL navigate to the homepage displaying the interactive map

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user navigates to `/gewaesser/seen/` THEN the system SHALL CONTINUE TO display the lakes list page with all lakes sorted alphabetically

3.2 WHEN a user navigates to `/gewaesser/fluesse/` THEN the system SHALL CONTINUE TO display the rivers list page with all rivers sorted alphabetically

3.3 WHEN a user navigates to `/offene-daten/api/` THEN the system SHALL CONTINUE TO display the API documentation page

3.4 WHEN a user navigates to a waterway, spot, obstacle, or notice detail page THEN the system SHALL CONTINUE TO display the correct detail page with its respective layout

3.5 WHEN Jekyll builds the site THEN the system SHALL CONTINUE TO generate all existing pages (404.html, lakes, rivers, API, detail pages) without modification

3.6 WHEN the site is viewed in English (`/en/`) THEN the system SHALL CONTINUE TO serve all existing localized pages correctly
