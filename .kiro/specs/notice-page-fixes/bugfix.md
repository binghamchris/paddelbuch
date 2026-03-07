# Bugfix Requirements Document

## Introduction

The migration from Gatsby to Jekyll introduced a collection of structural and visual inconsistencies across notice pages (`/gewaesserereignisse/:slug/`). These issues affect usability through redundant headings, unintended navigation spacing, and date formatting discrepancies. This document captures the defective behaviors, the expected corrections, and the behaviors that must remain unchanged.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a notice page is rendered THEN the notice layout includes redundant `h3` and `p` elements associated with 'Kurzfassung' (summary), duplicating the introductory content and disrupting the content flow

1.2 WHEN a notice page is rendered THEN extraneous breadcrumb or navigation links (specifically a 'Gewässerereignisse' link) appear on the page, creating unintended spacing and visual clutter

1.3 WHEN a notice page displays dates (start date, updated timestamp) THEN the date formatting does not follow the established design system conventions (`YYYY-MM-DD` for start dates and `dd. MMMM YYYY um HH:MM` for updated timestamps)

### Expected Behavior (Correct)

2.1 WHEN a notice page is rendered THEN the system SHALL display only a single primary content flow without redundant `h3` or `p` elements for 'Kurzfassung', ensuring clean content structure

2.2 WHEN a notice page is rendered THEN the system SHALL NOT display extraneous breadcrumb or navigation links (such as 'Gewässerereignisse') that are not part of the intended notice detail layout

2.3 WHEN a notice page displays dates THEN the system SHALL format start dates as `YYYY-MM-DD` and updated timestamps as `dd. MMMM YYYY um HH:MM` to match the established design system conventions

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a notice page is rendered THEN the system SHALL CONTINUE TO use the current `<title>` tag format `[Page Title] | Paddel Buch`

3.2 WHEN a notice page is viewed on a mobile device THEN the system SHALL CONTINUE TO display the functional hamburger menu button that correctly toggles the navigation collapse container, as this has already been fixed

3.3 WHEN a notice page is rendered THEN the system SHALL CONTINUE TO apply the correct header background color (`#1a1a1a`), as this has already been fixed

3.4 WHEN a non-notice page (spot, waterway, obstacle, static page) is rendered THEN the system SHALL CONTINUE TO use the existing `<title>` tag format `[Page Title] | Paddel Buch`

3.5 WHEN a non-notice page is rendered THEN the system SHALL CONTINUE TO display its content structure unchanged, including any summary sections appropriate to that page type

3.6 WHEN any page is viewed on a mobile device THEN the system SHALL CONTINUE TO provide functional mobile navigation via the existing hamburger menu and `#main-navbar` collapse target

3.7 WHEN a non-notice page is rendered THEN the system SHALL CONTINUE TO display its navigation links and breadcrumbs as currently configured

3.8 WHEN a non-notice page is rendered THEN the system SHALL CONTINUE TO display the header with the existing `$swisscanoe-blue` (`#1b1e43`) background color

3.9 WHEN dates are displayed on non-notice pages THEN the system SHALL CONTINUE TO use the existing `localized_date` filter formatting

3.10 WHEN a notice page map is rendered THEN the system SHALL CONTINUE TO display the Leaflet map with affected area geometry, zoom controls, and all data layers as currently implemented

3.11 WHEN a notice page details panel is rendered THEN the system SHALL CONTINUE TO display the notice type badge, title, waterway links, and description content as currently structured
