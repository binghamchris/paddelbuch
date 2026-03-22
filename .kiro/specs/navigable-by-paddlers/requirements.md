# Requirements Document

## Introduction

This feature integrates the new Contentful `navigableByPaddlers` boolean field into the Paddelbuch build pipeline. The field has three possible states: `true`, `false`, or empty (no value set). Waterways marked as not navigable (`false`) are excluded from dashboards, listing pages, and detail page generation, while the field value is always included in the API JSON output regardless of its state.

## Glossary

- **WaterwayMapper**: The Ruby module method (`ContentfulMappers.map_waterway`) that transforms a Contentful waterway entry into a flat hash for use by downstream generators.
- **ApiGenerator**: The Jekyll generator plugin (`Jekyll::ApiGenerator`) that produces per-locale JSON API files from site data, including `waterways-de.json` and `waterways-en.json`.
- **CollectionGenerator**: The Jekyll generator plugin (`Jekyll::CollectionGenerator`) that creates virtual Jekyll documents from YAML data, producing detail pages for waterways and other content types.
- **DashboardMetricsGenerator**: The Jekyll generator plugin (`Jekyll::DashboardMetricsGenerator`) that computes freshness and coverage metrics for waterways.
- **WaterwayFilters**: The Liquid filter module (`Jekyll::WaterwayFilters`) that provides `rivers_alphabetically` and `lakes_alphabetically` filters used by listing pages.
- **Waterway_Detail_Page**: A generated HTML page for a single waterway, produced by the CollectionGenerator using the `waterway` layout.
- **Rivers_Listing_Page**: The HTML page at `/gewaesser/fluesse/` that lists all rivers alphabetically.
- **Lakes_Listing_Page**: The HTML page at `/gewaesser/seen/` that lists all lakes alphabetically.
- **Freshness_Dashboard**: The data quality dashboard that displays median spot age per waterway using a traffic-light colour scheme.
- **Coverage_Dashboard**: The data quality dashboard that displays spot coverage segments per waterway.
- **navigableByPaddlers**: A boolean field on the Contentful waterway content type. Valid states are `true`, `false`, or `nil` (empty/unset).

## Requirements

### Requirement 1: Map navigableByPaddlers from Contentful

**User Story:** As a developer, I want the `navigableByPaddlers` field to be extracted from Contentful waterway entries during data mapping, so that downstream generators can use the field value.

#### Acceptance Criteria

1. WHEN a waterway entry is mapped from Contentful, THE WaterwayMapper SHALL include a `navigableByPaddlers` key in the resulting hash.
2. WHEN the Contentful `navigableByPaddlers` field has the value `true`, THE WaterwayMapper SHALL set the `navigableByPaddlers` key to `true`.
3. WHEN the Contentful `navigableByPaddlers` field has the value `false`, THE WaterwayMapper SHALL set the `navigableByPaddlers` key to `false`.
4. WHEN the Contentful `navigableByPaddlers` field has no value set, THE WaterwayMapper SHALL set the `navigableByPaddlers` key to `nil`.

### Requirement 2: Include navigableByPaddlers in API JSON output

**User Story:** As an API consumer, I want the `navigableByPaddlers` field to appear in the waterways API JSON files, so that client applications can use the field for filtering.

#### Acceptance Criteria

1. THE ApiGenerator SHALL include a `navigableByPaddlers` key in each waterway object within the `waterways-de.json` and `waterways-en.json` API files.
2. WHEN a waterway has `navigableByPaddlers` set to `true`, THE ApiGenerator SHALL output the value `true` for the `navigableByPaddlers` key.
3. WHEN a waterway has `navigableByPaddlers` set to `false`, THE ApiGenerator SHALL output the value `false` for the `navigableByPaddlers` key.
4. WHEN a waterway has `navigableByPaddlers` set to `nil`, THE ApiGenerator SHALL output the value `null` for the `navigableByPaddlers` key.

### Requirement 3: Exclude non-navigable waterways from Freshness Dashboard

**User Story:** As a data quality reviewer, I want the Freshness Dashboard to exclude waterways where `navigableByPaddlers` is `false`, so that the dashboard only reflects waterways relevant to paddlers.

#### Acceptance Criteria

1. WHEN computing freshness metrics, THE DashboardMetricsGenerator SHALL exclude all waterways where `navigableByPaddlers` equals `false`.
2. WHEN a waterway has `navigableByPaddlers` set to `true`, THE DashboardMetricsGenerator SHALL include the waterway in freshness metric computation.
3. WHEN a waterway has `navigableByPaddlers` set to `nil`, THE DashboardMetricsGenerator SHALL include the waterway in freshness metric computation.

### Requirement 4: Exclude non-navigable waterways from Coverage Dashboard

**User Story:** As a data quality reviewer, I want the Coverage Dashboard to exclude waterways where `navigableByPaddlers` is `false`, so that the dashboard only reflects waterways relevant to paddlers.

#### Acceptance Criteria

1. WHEN computing coverage metrics, THE DashboardMetricsGenerator SHALL exclude all waterways where `navigableByPaddlers` equals `false`.
2. WHEN a waterway has `navigableByPaddlers` set to `true`, THE DashboardMetricsGenerator SHALL include the waterway in coverage metric computation.
3. WHEN a waterway has `navigableByPaddlers` set to `nil`, THE DashboardMetricsGenerator SHALL include the waterway in coverage metric computation.

### Requirement 5: Exclude non-navigable waterways from listing pages

**User Story:** As a paddler, I want the rivers and lakes listing pages to exclude waterways where `navigableByPaddlers` is `false`, so that I only see waterways that are relevant to paddle sports.

#### Acceptance Criteria

1. THE WaterwayFilters `rivers_alphabetically` filter SHALL exclude all waterways where `navigableByPaddlers` equals `false`.
2. THE WaterwayFilters `lakes_alphabetically` filter SHALL exclude all waterways where `navigableByPaddlers` equals `false`.
3. WHEN a waterway has `navigableByPaddlers` set to `true`, THE WaterwayFilters SHALL include the waterway in listing page results.
4. WHEN a waterway has `navigableByPaddlers` set to `nil`, THE WaterwayFilters SHALL include the waterway in listing page results.
5. THE WaterwayFilters `top_lakes_by_area` filter SHALL exclude all waterways where `navigableByPaddlers` equals `false`.
6. THE WaterwayFilters `top_rivers_by_length` filter SHALL exclude all waterways where `navigableByPaddlers` equals `false`.

### Requirement 6: Suppress detail page generation for non-navigable waterways

**User Story:** As a paddler, I want non-navigable waterways to have no detail pages, so that I am not presented with pages for waterways that are irrelevant to paddle sports.

#### Acceptance Criteria

1. WHEN generating waterway collection documents, THE CollectionGenerator SHALL skip all waterway entries where `navigableByPaddlers` equals `false`.
2. WHEN a waterway has `navigableByPaddlers` set to `true`, THE CollectionGenerator SHALL generate a Waterway_Detail_Page for the waterway.
3. WHEN a waterway has `navigableByPaddlers` set to `nil`, THE CollectionGenerator SHALL generate a Waterway_Detail_Page for the waterway.
