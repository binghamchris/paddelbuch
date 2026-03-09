# Bugfix Requirements Document

## Introduction

Static pages served from Contentful (e.g. `/offene-daten/datenlizenzen/`, `/ueber/projekt/`) render blank — all expected content is missing. The `_data/static_pages.yml` file shows every entry with an empty `content` field, meaning the Contentful rich text is lost during the fetch-and-map pipeline. Additionally, the `CollectionGenerator` overwrites the correct `title` with the slug because it looks for a `name` field that static pages don't have.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a staticPage entry is fetched from Contentful and mapped via `map_static_page` THEN the system produces a nil/empty `content` value in `_data/static_pages.yml`, discarding all rich text content from Contentful

1.2 WHEN the `CollectionGenerator` creates a virtual document for a static page THEN the system overwrites `doc.data['title']` with the slug value because `entry['name']` is nil (static pages use a `title` field, not `name`)

1.3 WHEN a user visits a static page URL (e.g. `/offene-daten/datenlizenzen/`) THEN the system renders a blank page with no Contentful content visible

### Expected Behavior (Correct)

2.1 WHEN a staticPage entry is fetched from Contentful and mapped via `map_static_page` THEN the system SHALL convert the rich text `content` field into HTML and store it as a non-empty string in `_data/static_pages.yml`

2.2 WHEN the `CollectionGenerator` creates a virtual document for a static page THEN the system SHALL preserve the `title` field from the mapped data instead of overwriting it with `entry['name'] || slug`

2.3 WHEN a user visits a static page URL (e.g. `/offene-daten/datenlizenzen/`) THEN the system SHALL render the page with the full Contentful rich text content and the correct title

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a spot, obstacle, or event notice entry is fetched from Contentful THEN the system SHALL CONTINUE TO correctly convert rich text `description` fields into HTML

3.2 WHEN the `CollectionGenerator` creates virtual documents for spots, waterways, obstacles, or notices THEN the system SHALL CONTINUE TO set the title from the `name` field as before

3.3 WHEN a static page has a `menu` and `menu_slug` THEN the system SHALL CONTINUE TO generate the correct permalink in the format `/{menu_slug}/{slug}/`

3.4 WHEN a static page has no `menu` value THEN the system SHALL CONTINUE TO default the `menu_slug` to `seiten`
