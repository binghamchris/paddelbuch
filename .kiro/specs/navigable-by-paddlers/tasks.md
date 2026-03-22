# Implementation Plan: navigable-by-paddlers

## Overview

Integrate the Contentful `navigableByPaddlers` boolean field into the Paddelbuch Jekyll build pipeline. Five existing Ruby components in `_plugins/` are modified to extract, pass through, or filter on the new field. Each component change is small and follows existing patterns. Property-based tests use Rantly; unit tests use RSpec.

## Tasks

- [x] 1. Add `navigableByPaddlers` to ContentfulMappers and API pass-through
  - [x] 1.1 Add `navigableByPaddlers` extraction to `ContentfulMappers.map_waterway`
    - Add `'navigableByPaddlers' => resolve_field(fields, :navigable_by_paddlers, locale)` to the returned hash
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for mapper tri-state preservation
    - **Property 1: Mapper tri-state preservation**
    - Generate random waterway entries with `navigable_by_paddlers` set to `true`, `false`, or `nil`
    - Assert the mapped hash `navigableByPaddlers` key equals the input value
    - Add to `spec/contentful_mappers_spec.rb`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.3 Add `navigableByPaddlers` pass-through to `ApiGenerator#transform_waterway`
    - Add `result['navigableByPaddlers'] = item['navigableByPaddlers']` to the `transform_waterway` method
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.4 Write property test for API transformer tri-state pass-through
    - **Property 2: API transformer tri-state pass-through**
    - Generate random waterway hashes with `navigableByPaddlers` set to `true`, `false`, or `nil`
    - Assert the transformed hash preserves the value exactly
    - Add to `spec/plugins/api_generator_spec.rb`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. Checkpoint - Verify mapper and API changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Filter non-navigable waterways from DashboardMetricsGenerator
  - [x] 3.1 Add reject clause for non-navigable waterways in `DashboardMetricsGenerator#generate`
    - Add `unique_waterways = unique_waterways.reject { |w| w['navigableByPaddlers'] == false }` after the existing wildwasser filter
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

  - [x] 3.2 Write property test for dashboard metrics non-navigable exclusion
    - **Property 3: Dashboard metrics non-navigable exclusion**
    - Generate random waterway sets with mixed `navigableByPaddlers` values
    - Assert metrics contain no waterway with `navigableByPaddlers == false`
    - Assert metrics contain all non-wildwasser waterways with `navigableByPaddlers` `true` or `nil` (with valid geometry)
    - Add to `spec/plugins/dashboard_metrics_generator_property_spec.rb`
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3**

- [x] 4. Filter non-navigable waterways from WaterwayFilters
  - [x] 4.1 Add `navigableByPaddlers != false` condition to all four WaterwayFilters methods
    - Update `rivers_alphabetically`, `lakes_alphabetically`, `top_lakes_by_area`, `top_rivers_by_length`
    - Add `w['navigableByPaddlers'] != false` to each method's `.select` chain
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.2 Write property test for WaterwayFilters non-navigable exclusion
    - **Property 4: WaterwayFilters non-navigable exclusion**
    - Generate random waterway arrays with mixed `navigableByPaddlers` values
    - Assert all four filter methods return no waterway where `navigableByPaddlers == false`
    - Assert all four filter methods include every matching waterway where `navigableByPaddlers` is `true` or `nil`
    - Add to `spec/plugins/waterway_filters_spec.rb`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 5. Suppress detail page generation for non-navigable waterways
  - [x] 5.1 Add skip condition in `CollectionGenerator#generate` for non-navigable waterways
    - Add `next if collection_name == 'waterways' && entry['navigableByPaddlers'] == false` in the `locale_entries.each` block
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Write property test for CollectionGenerator non-navigable exclusion
    - **Property 5: CollectionGenerator non-navigable exclusion**
    - Generate random waterway data entries with mixed `navigableByPaddlers` values
    - Assert no document is produced for waterways where `navigableByPaddlers == false`
    - Assert a document is produced for every waterway where `navigableByPaddlers` is `true` or `nil`
    - Add to `spec/collection_generator_spec.rb`
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use Rantly (already in Gemfile) with minimum 100 iterations
- Run tests with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec`
