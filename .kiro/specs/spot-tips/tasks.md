# Implementation Plan: Spot Tips

## Overview

Implement advisory tip support for paddle spots, following the existing data pipeline pattern: Contentful → YAML → CollectionGenerator pre-computation → PrecomputeGenerator JSON config → Liquid templates + client-side JS. The implementation is split into incremental steps that build on each other, starting with the data layer and ending with wiring everything together.

Languages: Ruby (Jekyll plugins, RSpec + Rantly) and JavaScript (client-side, Jest + fast-check).

## Tasks

- [x] 1. ContentfulFetcher — Add spotTipType content type and spot field
  - [x] 1.1 Add `spotTipType` entry to `CONTENT_TYPES` hash in `_plugins/contentful_fetcher.rb`
    - Add `'spotTipType' => { filename: 'types/spot_tip_types', mapper: :map_type }` to the hash
    - _Requirements: 1.1_
  - [x] 1.2 Extend `map_type` in `_plugins/contentful_mappers.rb` to handle `spotTipType` content type
    - Add a `when 'spotTipType'` case that extracts `description_de`, `description_en` (rendered HTML via `extract_rich_text_html`), and `_raw_description` (serialised JSON via `serialize_raw_rich_text`)
    - _Requirements: 1.2_
  - [x] 1.3 Add `spotTipType_slugs` field to `map_spot` in `_plugins/contentful_mappers.rb`
    - Add `'spotTipType_slugs' => extract_reference_slugs(resolve_field(fields, :spot_tips, locale))` to the spot mapper hash
    - _Requirements: 1.3, 1.4_
  - [x] 1.4 Write property test for spotTipType mapper output structure (Property 1)
    - **Property 1: spotTipType Mapper Output Structure**
    - Generate random slugs, name strings, and optional rich text fields; verify output hash contains `slug`, `name_de`, `name_en`, `description_de`, `description_en`, `_raw_description`
    - Test file: `spec/plugins/spot_tip_type_mapper_spec.rb`
    - **Validates: Requirements 1.1, 1.2**
  - [x] 1.5 Write property test for spot mapper spotTipType_slugs (Property 2)
    - **Property 2: Spot Mapper Includes spotTipType_slugs**
    - Generate random arrays of tip type slugs (including empty); verify `spotTipType_slugs` field is an array of strings matching referenced slugs
    - Test file: `spec/plugins/spot_tip_type_mapper_spec.rb`
    - **Validates: Requirements 1.3, 1.4**

- [x] 2. CollectionGenerator — Pre-compute spot tip type data
  - [x] 2.1 Add `build_spot_tip_type_lookup` method to `_plugins/collection_generator.rb`
    - Build a `{ slug => { slug, name, description } }` hash from `site.data.types.spot_tip_types` filtered by locale
    - Call it in `generate` alongside existing type lookups: `@spot_tip_type_lookup = build_spot_tip_type_lookup(site.data, current_locale)`
    - _Requirements: 1.1, 8.1, 8.2, 8.3_
  - [x] 2.2 Resolve tip types in `precompute_spot_fields`
    - Add `tip_slugs = entry['spotTipType_slugs'] || []` and `doc.data['spot_tip_types'] = tip_slugs.filter_map { |slug| @spot_tip_type_lookup[slug] }` to pre-compute resolved tip type data on each spot document
    - _Requirements: 3.1, 8.1_
  - [x] 2.3 Write property test for CollectionGenerator spot tip type resolution (Property 10)
    - **Property 10: CollectionGenerator Spot Tip Type Resolution**
    - Generate random spot entries and tip type lookup data; verify `spot_tip_types` array contains one hash per resolved slug with correct localised `name` and `description`, excluding unresolved slugs
    - Test file: `spec/plugins/collection_precompute_spec.rb`
    - **Validates: Requirements 1.1, 3.1, 8.1**

- [x] 3. PrecomputeGenerator — spotTipType dimension config
  - [x] 3.1 Add `spotTipType` dimension to `precompute_map_config_json` in `_plugins/precompute_generator.rb`
    - Read tip types from `site.data.dig('types', 'spot_tip_types')`, filter by locale, build options array with slug + localised label
    - Append `__no_tips__` option with localised label ("Einstiegsorte ohne Tipps" / "Spots without tips")
    - Add dimension config `{ key: 'spotTipType', label: ..., options: tip_type_options }` to `dimensionConfigs` array
    - Pre-compute `site.data['spot_tip_types_for_locale']` for template use
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 8.1, 8.2, 8.3_
  - [x] 3.2 Write property test for spotTipType dimension config completeness (Property 3)
    - **Property 3: spotTipType Dimension Config Completeness**
    - Generate random tip type datasets with varying counts; verify `map_data_config_json` contains a `spotTipType` dimension with exactly one entry per tip type plus one `__no_tips__` entry
    - Test file: `spec/plugins/precompute_generator_spec.rb`
    - **Validates: Requirements 2.2, 2.3, 5.2**

- [x] 4. Checkpoint — Verify data pipeline
  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. Filter engine — spotTipType match function
  - [x] 5.1 Add `spotTipType` match function to `assets/js/map-data-init.js`
    - Implement match logic: if spot has no tips, return `true` only if `__no_tips__` is selected; if spot has tips, return `true` if any tip slug is in the selected set
    - _Requirements: 2.6, 2.7, 2.8, 5.3_
  - [x] 5.2 Include `spotTipType_slugs` in marker metadata in `assets/js/layer-control.js`
    - Add `spotTipType_slugs: spot.spotTipType_slugs || []` to the metadata object in `addSpotMarker`
    - _Requirements: 2.6, 2.7_
  - [x] 5.3 Write property test for spotTipType filter match function correctness (Property 4)
    - **Property 4: spotTipType Filter Match Function Correctness**
    - Generate random `spotTipType_slugs` arrays and selected option sets; verify match returns `true` iff (a) spot has a tip slug in selected set, or (b) spot has zero tips and `__no_tips__` is selected
    - Test file: `_tests/property/spot-tip-filter-match.property.test.js`
    - **Validates: Requirements 2.6, 2.7**

- [x] 6. Spot detail page — Tip banners
  - [x] 6.1 Create `_includes/spot-tip-banners.html` include file
    - Render one tip banner per spot tip type with: `div.alert-spot-tip.alert-spot-tip-{slug}`, SVG icon (`tip-banner-{slug}.svg`), localised name, and optional description HTML
    - Use Bootstrap alert structure consistent with `rejected-spot-content.html`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 6.2 Insert tip banners include in `_layouts/spot.html`
    - Add conditional include between the spot title and `spot-detail-content.html` in the non-rejected branch: `{% if page.spot_tip_types and page.spot_tip_types.size > 0 %}{% include spot-tip-banners.html spot_tip_types=page.spot_tip_types %}{% endif %}`
    - _Requirements: 3.1, 3.2_
  - [x] 6.3 Write property test for tip banner rendering completeness (Property 5)
    - **Property 5: Tip Banner Rendering Completeness**
    - Generate random tip type objects with optional descriptions; verify banner HTML contains correct CSS class, SVG src, name text, and conditional description
    - Test file: `_tests/property/spot-tip-banner-rendering.property.test.js`
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5, 3.7, 3.8**

- [x] 7. Tip banner styling
  - [x] 7.1 Add tip banner SCSS styles to `_sass/pages/_spot-details.scss`
    - Add `.alert-spot-tip` base styles (border-radius, margin, icon alignment, description font size)
    - Per-type classes `.alert-spot-tip-{slug}` can override colours/borders as needed
    - _Requirements: 3.6, 3.7_

- [x] 8. Map marker modifier icons
  - [x] 8.1 Define `TIP_MODIFIER_CONFIG` in `assets/js/marker-styles.js`
    - Add centrally-defined configuration object mapping each tip type slug to `{ iconUrl, offset: [dx, dy], size }` with unique offsets per slug
    - Export via `PaddelbuchMarkerStyles.TIP_MODIFIER_CONFIG`
    - _Requirements: 4.3, 4.4, 4.7_
  - [x] 8.2 Implement `createCompositeIcon` function in `assets/js/layer-control.js`
    - Create a `L.divIcon` that composites the base marker SVG with modifier icon SVGs positioned per `TIP_MODIFIER_CONFIG`
    - Skip slugs without config entries (Requirement 4.6)
    - Use `createCompositeIcon` when spot has `spotTipType_slugs.length > 0`; use standard `L.icon` otherwise
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  - [x] 8.3 Write property test for modifier icon unique offsets (Property 6)
    - **Property 6: Modifier Icon Unique Offsets**
    - Enumerate all pairs in `TIP_MODIFIER_CONFIG`; verify each pair has distinct offset arrays
    - Test file: `_tests/property/spot-tip-modifier-offsets.property.test.js`
    - **Validates: Requirements 4.4**
  - [x] 8.4 Write property test for composite marker icon includes modifier images (Property 7)
    - **Property 7: Composite Marker Icon Includes Modifier Images**
    - Generate random tip slug arrays against the config; verify DivIcon HTML contains one `img` per matching slug with correct `src` and offset, and skips missing slugs
    - Test file: `_tests/property/spot-tip-composite-marker.property.test.js`
    - **Validates: Requirements 4.1, 4.6**

- [x] 9. Checkpoint — Verify frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. ApiGenerator — Dimension table and spot field
  - [x] 10.1 Add `spottiptypes` to `DIMENSION_TABLES` and `CONTENT_TYPE_NAMES` in `_plugins/api_generator.rb`
    - Add `'spottiptypes' => { data_key: 'types/spot_tip_types', content_type: 'spotTipType' }` to `DIMENSION_TABLES`
    - Add `'spottiptypes' => 'spotTipTypes'` to `CONTENT_TYPE_NAMES`
    - _Requirements: 6.1, 6.3_
  - [x] 10.2 Add `spottiptypes` case to `transform_dimension_entry` in `_plugins/api_generator.rb`
    - Add `when 'spottiptypes'` case that includes `result['description'] = wrap_raw_description(item['_raw_description'])`
    - _Requirements: 6.2, 6.6_
  - [x] 10.3 Add `spotTipType` field to `transform_spot` in `_plugins/api_generator.rb`
    - Add `result['spotTipType'] = wrap_slug_refs(item['spotTipType_slugs']) || []`
    - _Requirements: 6.4, 6.5_
  - [x] 10.4 Write property test for API dimension table output structure (Property 8)
    - **Property 8: API Dimension Table Output Structure**
    - Generate random tip type records; verify `transform_dimension_entry` for `spottiptypes` produces JSON with `slug`, `node_locale`, `createdAt`, `updatedAt`, `name`, and wrapped `description`
    - Test file: `spec/plugins/api_generator_spec.rb`
    - **Validates: Requirements 6.2, 6.6**
  - [x] 10.5 Write property test for API spot transform includes spotTipType (Property 9)
    - **Property 9: API Spot Transform Includes spotTipType**
    - Generate random spot records with varying tip slug arrays; verify `transform_spot` produces `spotTipType` field as array of `{"slug": "..."}` objects (empty array when no slugs)
    - Test file: `spec/plugins/api_generator_spec.rb`
    - **Validates: Requirements 6.4, 6.5**

- [x] 11. SVG asset placeholder files
  - [x] 11.1 Create placeholder SVG files for tip banners and modifier icons
    - Create `assets/images/tips/` directory with a template `tip-banner-example.svg` placeholder
    - Create `assets/images/markers/` directory with a template `tip-modifier-example.svg` placeholder
    - These are design asset templates; actual per-type SVGs are created alongside Contentful entries
    - _Requirements: 3.8, 4.3_

- [x] 12. Documentation updates
  - [x] 12.1 Update `README.md` with spot tip type references
    - List `_data/types/spot_tip_types.yml` in Project Structure under `_data/types/`
    - List `/api/spottiptypes-{locale}.json` in API Available Endpoints under Dimension Tables
    - Include `spotTipType` in Contentful Integration content types summary
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 12.2 Update `docs/content-model.md` with spotTipType content type
    - Add `spotTipType` section under Dimension Content Types documenting `slug`, `name`, `description` fields
    - Add `spotTips` reference field (`References → spotTipType[]`) to the `spot` Fact Content Type table
    - _Requirements: 7.4, 7.5_
  - [x] 12.3 Update `docs/architecture.md` with spotTipType dimension
    - List `spotTipType` with data file path `types/spot_tip_types.yml` in the Dimension Types table
    - _Requirements: 7.6_
  - [x] 12.4 Update `docs/plugins.md` with spot_tip_types.yml output
    - Include `spot_tip_types.yml` in ContentfulFetcher Outputs list under `_data/types/*.yml`
    - _Requirements: 7.7_
  - [x] 12.5 Update `docs/frontend.md` with spot tips JS and SCSS changes
    - Document modifications to `map-data-init.js`, `layer-control.js`, `marker-styles.js`
    - Document new `_includes/spot-tip-banners.html` include
    - Document SCSS additions in `_sass/pages/_spot-details.scss`
    - _Requirements: 7.8, 7.9_
  - [x] 12.6 Update `docs/testing.md` with new test files
    - List new Ruby spec files (`spec/plugins/spot_tip_type_mapper_spec.rb`, additions to `collection_precompute_spec.rb`, `precompute_generator_spec.rb`, `api_generator_spec.rb`)
    - List new JS test files (`_tests/property/spot-tip-*.property.test.js`)
    - _Requirements: 7.10_

- [x] 13. Update "Data Download / API" page
  - [x] 13.1 Update the static page or template that renders the API documentation page to list the `spottiptypes` dimension table
    - Add `spottiptypes` alongside existing dimension tables in the API page content
    - _Requirements: 6.7_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Ruby tests use RSpec + Rantly; JavaScript tests use Jest + fast-check
- SVG asset files are design assets — placeholders/templates are created; actual per-type files must be created alongside Contentful content type entries
