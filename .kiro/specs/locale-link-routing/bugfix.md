# Bugfix Requirements Document

## Introduction

When viewing the English version of the Paddel Buch site (under the `/en/` URL prefix), all internal navigation links incorrectly route users to the German (default locale) version of pages. This happens because internal links in templates and includes are hardcoded with German URL paths (e.g., `/einstiegsorte/`, `/gewaesser/`) without prepending the current locale prefix. The `jekyll-multiple-languages-plugin` generates English pages under `/en/...` but the link construction logic does not account for the active locale. Users must stay on their selected language version until they explicitly switch via the language selector in the navbar.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user is browsing the English site (URL prefix `/en/`) and clicks a "More details" link in a spot popup THEN the system navigates to `/einstiegsorte/{slug}/` (the German version) instead of `/en/einstiegsorte/{slug}/`

1.2 WHEN a user is browsing the English site and clicks a waterway link (from a spot detail page, obstacle detail page, or event notice detail page) THEN the system navigates to `/gewaesser/{slug}/` (the German version) instead of `/en/gewaesser/{slug}/`

1.3 WHEN a user is browsing the English site and clicks a "More details" link in an obstacle popup THEN the system navigates to `/hindernisse/{slug}/` (the German version) instead of `/en/hindernisse/{slug}/`

1.4 WHEN a user is browsing the English site and clicks an event notice link (from a popup or waterway detail page) THEN the system navigates to `/gewaesserereignisse/{slug}/` (the German version) instead of `/en/gewaesserereignisse/{slug}/`

1.5 WHEN a user is browsing the English site and clicks a navigation link in the header (lakes dropdown, rivers dropdown, open data dropdown, about dropdown) THEN the system navigates to the German version of the target page instead of the English version

1.6 WHEN a user is browsing the English site and clicks a portage exit spot or re-entry spot link on an obstacle detail page THEN the system navigates to `/einstiegsorte/{slug}/` (the German version) instead of `/en/einstiegsorte/{slug}/`

1.7 WHEN a user is browsing the English site and clicks a static page link (open data or about section) THEN the system navigates to `/{menu_slug}/{slug}/` (the German version) instead of `/en/{menu_slug}/{slug}/`

### Expected Behavior (Correct)

2.1 WHEN a user is browsing the English site and clicks a "More details" link in a spot popup THEN the system SHALL navigate to `/en/einstiegsorte/{slug}/`, preserving the English locale

2.2 WHEN a user is browsing the English site and clicks a waterway link THEN the system SHALL navigate to `/en/gewaesser/{slug}/`, preserving the English locale

2.3 WHEN a user is browsing the English site and clicks a "More details" link in an obstacle popup THEN the system SHALL navigate to `/en/hindernisse/{slug}/`, preserving the English locale

2.4 WHEN a user is browsing the English site and clicks an event notice link THEN the system SHALL navigate to `/en/gewaesserereignisse/{slug}/`, preserving the English locale

2.5 WHEN a user is browsing the English site and clicks a navigation link in the header THEN the system SHALL navigate to the English version of the target page, preserving the English locale

2.6 WHEN a user is browsing the English site and clicks a portage exit spot or re-entry spot link on an obstacle detail page THEN the system SHALL navigate to `/en/einstiegsorte/{slug}/`, preserving the English locale

2.7 WHEN a user is browsing the English site and clicks a static page link THEN the system SHALL navigate to `/en/{menu_slug}/{slug}/`, preserving the English locale

2.8 WHEN a user is browsing the German site (default locale, no URL prefix) and clicks any internal link THEN the system SHALL navigate to the German version of the target page (no `/de/` prefix), preserving the German locale

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user is browsing the German site (default locale) and clicks any internal link THEN the system SHALL CONTINUE TO navigate to the correct German page without any locale prefix in the URL

3.2 WHEN a user clicks the language switcher in the navbar THEN the system SHALL CONTINUE TO switch between German and English versions correctly

3.3 WHEN a user is browsing the German site and views translated content (labels, navigation text, dates) THEN the system SHALL CONTINUE TO display German translations

3.4 WHEN a user is browsing the English site and views translated content (labels, navigation text, dates) THEN the system SHALL CONTINUE TO display English translations

3.5 WHEN the site is built with Jekyll THEN the system SHALL CONTINUE TO generate both German (root) and English (`/en/`) versions of all pages

3.6 WHEN a user accesses the homepage via the navbar brand link THEN the system SHALL CONTINUE TO navigate to the correct locale-appropriate homepage
