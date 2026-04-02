# Contentful Content Model

This document describes the Contentful content model used by Paddel Buch, how entries are mapped to Jekyll data, and how to add new content types.

## Overview

Content is managed in Contentful and fetched during the Jekyll build by the `ContentfulFetcher` plugin. Each content type has a corresponding mapper in `ContentfulMappers` that transforms Contentful entries into flat YAML hashes. Entries are fetched with `locale: '*'` and flattened into per-locale rows (one row per locale per entry).

## Fact Content Types

These are the primary data types that contain the site's core content.

### spot

Paddle entry/exit points with GPS coordinates.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier (unique) |
| `name` | Short text | Localised display name |
| `description` | Rich text | Localised description (rendered to HTML) |
| `location` | Location | GPS coordinates (lat/lon) |
| `approximate_address` | Short text | Human-readable address |
| `country` | Short text | Country code |
| `confirmed` | Boolean | Whether the spot has been verified |
| `rejected` | Boolean | Whether the spot is inaccessible to paddlers |
| `waterway` | Reference → waterway | The waterway this spot is on |
| `spot_type` | Reference → spotType | Entry/exit, entry-only, etc. |
| `paddling_environment_type` | Reference → paddlingEnvironmentType | Lake or river |
| `paddle_craft_type` | References → paddleCraftType[] | Suitable craft types |
| `event_notices` | References → waterwayEventNotice[] | Active event notices |
| `obstacles` | References → obstacle[] | Nearby obstacles |
| `data_source_type` | Reference → dataSourceType | Data provenance |
| `data_license_type` | Reference → dataLicenseType | Licensing terms |

**Relationships:** A spot belongs to one waterway, has one spot type, and can reference multiple craft types, event notices, and obstacles.

### waterway

Lakes and rivers with GeoJSON geometry.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier |
| `name` | Short text | Localised display name |
| `length` | Number | River length in km (rivers only) |
| `area` | Number | Lake area in km² (lakes only) |
| `geometry` | JSON | GeoJSON geometry (LineString for rivers, Polygon for lakes) |
| `show_in_menu` | Boolean | Whether to show in the navigation menu |
| `paddling_environment_type` | Reference → paddlingEnvironmentType | `see` (lake), `fluss` (river), or `wildwasser` (whitewater). Whitewater waterways and their linked obstacles are excluded site-wide (no detail pages, map tiles, dashboards, or statistics) |
| `navigable_by_paddlers` | Boolean (tri-state) | Whether the waterway is navigable by paddlers (`true`, `false`, or `null` = unknown). Non-navigable waterways and their linked obstacles are excluded site-wide (no detail pages, map tiles, dashboards, or statistics) |
| `data_source_type` | Reference → dataSourceType | Data provenance |
| `data_license_type` | Reference → dataLicenseType | Licensing terms |

### obstacle

Obstacles on waterways with optional portage information.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier |
| `name` | Short text | Localised display name |
| `description` | Rich text | Localised description |
| `geometry` | JSON | GeoJSON geometry (point or line of the obstacle) |
| `portage_route` | JSON | GeoJSON geometry of the portage route (if applicable) |
| `portage_distance` | Short text | Portage distance |
| `portage_description` | Rich text | Portage instructions |
| `is_portage_necessary` | Boolean | Whether portage is required |
| `is_portage_possible` | Boolean | Whether portage is possible |
| `obstacle_type` | Reference → obstacleType | Obstacle classification |
| `waterway` | Reference → waterway | The waterway this obstacle is on |
| `spots` | References → spot[] | Related exit/re-entry spots |
| `data_source_type` | Reference → dataSourceType | Data provenance |
| `data_license_type` | Reference → dataLicenseType | Licensing terms |

**Relationships:** An obstacle belongs to one waterway and can reference exit/re-entry spots for portage.

### protectedArea

Protected nature areas displayed as overlays on the map. No detail pages are generated.

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier |
| `name` | Short text | Localised display name |
| `description` | Rich text | Localised description (optional) |
| `geometry` | JSON | GeoJSON geometry (polygon) |
| `is_area_marked` | Boolean | Whether the area is physically marked |
| `protected_area_type` | Reference → protectedAreaType | Area classification |
| `waterway` | References → waterway[] | Associated waterways |
| `data_source_type` | Reference → dataSourceType | Data provenance |
| `data_license_type` | Reference → dataLicenseType | Licensing terms |

### waterwayEventNotice

Temporary event notices with date ranges (e.g. construction, races, closures).

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier |
| `name` | Short text | Localised display name |
| `description` | Rich text | Localised description |
| `location` | Location | GPS coordinates (optional) |
| `affected_area` | JSON | GeoJSON geometry of the affected area |
| `start_date` | Date | Approximate start date |
| `end_date` | Date | Approximate end date |
| `waterway` | References → waterway[] | Affected waterways |
| `spot` | References → spot[] | Affected spots |
| `data_source_type` | Reference → dataSourceType | Data provenance |
| `data_license_type` | Reference → dataLicenseType | Licensing terms |

**Note:** Event notices are filtered by `endDate` — only notices where `endDate >= today` are shown as active.

### staticPage

CMS-driven static pages (About, Open Data sub-pages).

| Field | Type | Description |
|-------|------|-------------|
| `slug` | Short text | URL-safe identifier |
| `title` | Short text | Localised page title |
| `menu` | Short text | Menu section name (e.g. "Über", "Offene Daten") |
| `page_contents` | Rich text | Localised page body |
| `menu_order` | Integer | Sort order within the menu section |

**URL generation:** The permalink is built from `menu_slug` + `slug`, e.g. `/ueber/about-paddelbuch/` or `/offene-daten/datenlizenzen/`.

## Dimension Content Types

These are lookup/reference tables used by the fact types above.

### spotType

| Slug | German | English |
|------|--------|---------|
| `einstieg-ausstieg` | Ein-/Ausstiegsorte | Entry & Exit Spots |
| `nur-einstieg` | Einstiegsorte | Entry Only Spots |
| `nur-ausstieg` | Ausstiegsorte | Exit Only Spots |
| `rasthalte` | Rasthalte | Rest Spots |
| `notauswasserungsstelle` | Notauswasserungsstelle | Emergency Exit Spots |

### paddleCraftType

Kayak, canoe, SUP — each with a localised name and description.

### paddlingEnvironmentType

- `see` — Lake
- `fluss` — River

### obstacleType, protectedAreaType, dataSourceType, dataLicenseType

Simple name + slug dimension tables. `dataLicenseType` additionally has `summaryUrl` and `fullTextUrl` fields.

## Rich Text Handling

Contentful rich text fields are processed in two ways by `ContentfulMappers`:

1. **HTML rendering** (`extract_rich_text_html`): Converts the rich text document to HTML for display in Jekyll templates. Supports paragraphs, headings (h1–h3), ordered/unordered lists, tables (with header cells), hyperlinks (with URI scheme validation), and text marks (bold, italic, underline, code).

2. **Raw serialisation** (`serialize_raw_rich_text`): Preserves the original rich text JSON string for the public API output. This allows API consumers to render the content in their own format.

Both representations are stored in the YAML data: `description` (HTML) and `_raw_description` (JSON string).

## Locale Handling

All entries are fetched with `locale: '*'`, which returns all locale variants in a single response. The `flatten_entry` method in `ContentfulMappers` produces one hash per locale (`de` and `en`), each with a `locale` field. Field resolution follows a fallback chain: requested locale → `en` (Contentful's default locale).

Dimension types (spotType, obstacleType, etc.) store both locale names in a single row: `name_de` and `name_en`.

## Adding a New Content Type

To add a new content type end-to-end:

### 1. Define in Contentful

Create the content type in the Contentful web UI with appropriate fields and validations.

### 2. Add a mapper

In `_plugins/contentful_mappers.rb`, add a new `map_*` method:

```ruby
def map_new_type(entry, fields, locale, *_extra)
  {
    'slug' => extract_slug(fields, entry),
    'name' => resolve_field(fields, :name, locale),
    # ... additional fields
  }
end
```

### 3. Register in ContentfulFetcher

In `_plugins/contentful_fetcher.rb`, add to `CONTENT_TYPES`:

```ruby
'newType' => { filename: 'new_types', mapper: :map_new_type },
```

### 4. Add Jekyll collection (if detail pages needed)

In `_config.yml`:

```yaml
collections:
  new_types:
    output: true
    permalink: /new-types/:slug/
```

And add default front matter:

```yaml
defaults:
  - scope:
      path: ""
      type: "new_types"
    values:
      layout: "new_type"
```

### 5. Add to CollectionGenerator

In `_plugins/collection_generator.rb`, add to `COLLECTIONS`:

```ruby
'new_types' => { data_key: 'new_types', page_name: 'new-type-details' },
```

### 6. Create a layout

Create `_layouts/new_type.html` with the detail page template.

### 7. Add to ApiGenerator (optional)

If the type should appear in the public API, add it to `FACT_TABLES` or `DIMENSION_TABLES` in `_plugins/api_generator.rb` and create a transformer method.

### 8. Add to TileGenerator (optional)

If the type has spatial data, add it to `LAYERS` in `_plugins/tile_generator.rb`.

### 9. Add translations

Add all user-facing strings to both `_i18n/de.yml` and `_i18n/en.yml`.
