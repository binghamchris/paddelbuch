# Implementation Plan: Paddlecraft Types Change

## Overview

This plan implements the replacement of the three legacy paddle craft types (`seekajak`,
`kanadier`, `stand-up-paddle-board`) with two new types (`klappbar-und-aufblasbar`, `hardshell`)
across the Paddelbuch frontend, updates the statistics dashboard's craft-type icon map, and
performs a one-time additive Contentful migration.

The two new SVG icon assets (`assets/images/icons/foldables-dark.svg` and
`assets/images/icons/hardshell-dark.svg`) already exist in the repository — they were committed
on the Feature_Branch `feat/paddlecraft-types-change` — so no icon creation is required; the
plan only verifies their continued presence as a regression guard.

Work proceeds bottom-up: first the build-time generator (which every other surface depends on),
then the icon include, the new display partial and its wiring, styling, the statistics dashboard
icon map, and finally the standalone migration script. Property, structural, and integration/mock
tests are placed close to the code they validate so regressions surface early. Several existing
property tests are updated where the new presentation/migration behaviour changes their ground
truth. Each new-type slug and icon path is used consistently as defined in the design's data
models.

The Statistics_Dashboard work is independent of the filter/spot-detail frontend work and can
proceed in parallel with it.

All changes are made on the Feature_Branch `feat/paddlecraft-types-change` (Requirement 7.1).

## Tasks

- [x] 1. Update the Dimension_Config_Generator (`_plugins/precompute_generator.rb`)
  - [x] 1.1 Add module-level constants and ordered allow-list craft options
    - Add `NEW_CRAFT_TYPE_SLUGS = %w[klappbar-und-aufblasbar hardshell].freeze`
    - Add `NEW_CRAFT_TYPE_META` mapping each slug to its `{ icon:, iconOnly: true }` (foldables-dark.svg / hardshell-dark.svg)
    - In `precompute_map_config_json`, replace the current data-driven all-types `craft_options` construction: build `craft_by_slug` lookup, then map `NEW_CRAFT_TYPE_SLUGS` in order to `{ slug, label, icon, iconOnly }`, guaranteeing exactly two ordered options and exclusion of legacy slugs
    - _Requirements: 1.1, 1.2, 1.5, 1.6_

  - [x] 1.2 Add localised label selection with slug fallback
    - Use the existing `name_key` (`"name_#{locale}"`) to select the English/German label per build locale
    - When the resolved label is `nil`, absent, or whitespace-only, fall back to the option's slug
    - _Requirements: 1.3, 1.4, 1.7_

  - [x] 1.3 Add the precomputed `craft_type_display_for_locale` list
    - In `precompute_map_config_json`, set `site.data['craft_type_display_for_locale']` to the ordered `[{ 'slug', 'name', 'icon' }]` pair for the two new types (mirroring the existing `spot_tip_types_for_locale` pattern)
    - Apply the same localised-name selection with slug fallback as the filter labels
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x]* 1.4 Write property test for filter option generation
    - **Property 1: Filter dimension lists exactly the two new craft options, ordered, with correct icons**
    - Create `_tests/property/craft-filter-options.property.test.js`; model the ordered allow-list logic and generate random craft datasets (any order, with/without legacy rows, with/without new rows); assert exactly two options, correct order, no legacy slug, correct icon paths; `{ numRuns: 100 }`
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [x]* 1.5 Write property test for label localisation and fallback
    - **Property 2: Filter option labels are localised with slug fallback**
    - Create `_tests/property/craft-filter-labels.property.test.js`; generators include empty/whitespace/missing names across locales `{de, en}`; assert label equals locale name, else slug
    - **Validates: Requirements 1.3, 1.4, 1.7**

- [x] 2. Update the Craft_Icon_Include
  - [x] 2.1 Add slug→icon cases in `_includes/craft-icon.html`
    - Add `when 'klappbar-und-aufblasbar'` → `craft_icon = 'foldables'` and `when 'hardshell'` → `craft_icon = 'hardshell'` cases to the existing `case include.slug`
    - Remove the now-unreachable legacy `kayak`/`canoe`/`sup` `when` branches for clarity (the `else` sets `craft_icon = nil` and the trailing `{% if craft_icon %}` guard renders no element for unknown slugs)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x]* 2.2 Write property test for icon mapping totality
    - **Property 7: Craft icon mapping is total and correct**
    - Create `_tests/property/craft-icon-mapping.property.test.js`; model the `case` logic; generate random known + unknown slugs; assert correct `<img>` src for the two known slugs and no icon element otherwise; `{ numRuns: 100 }`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 2.3 Write icon-asset existence (regression guard) test
    - Assert the already-committed icons `assets/images/icons/foldables-dark.svg` and `assets/images/icons/hardshell-dark.svg` are present on disk (guards against accidental removal; the icons already exist on branch `feat/paddlecraft-types-change` and are not created by this plan)
    - _Requirements: 1.5, 3.1, 3.2_

- [x] 3. Create the Craft_Type_Display partial
  - [x] 3.1 Implement `_includes/craft-type-display.html`
    - Create the new partial reading `include.spot` and `site.data.craft_type_display_for_locale`
    - Render exactly two vertical entries side by side, ordered `klappbar-und-aufblasbar` then `hardshell`
    - Per entry, arrange children vertically: localised name (top) → craft icon via `craft-icon.html` (middle) → tick/cross indicator (bottom)
    - Determine linked state independently per entry via `linked_slugs contains ct.slug` against `spot.paddle_craft_type_slugs`; apply `is-linked`/`is-unlinked` class; use `&#10003;` (linked) and `&#10007;` (unlinked) indicators with visually-hidden `labels.yes` / `labels.no` text
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x]* 3.2 Write property test for display linked-state
    - **Property 8: Craft_Type_Display reflects independent linked state for both new types**
    - Create `_tests/property/craft-type-display.property.test.js`; model the display include; generate spot slug sets `{none, klappbar, hardshell, both}`; assert two ordered entries, correct name/slug fallback, and independent non-greyed/green-tick vs greyed/red-cross states; `{ numRuns: 100 }`
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 4. Wire the display into Spot_Detail_Content
  - [x] 4.1 Update `_includes/spot-detail-content.html`
    - Remove the entire first `<tr>` block containing `craft-type-title` / `craft-type-list` from the `spot-details-table`
    - Insert `{% include craft-type-display.html spot=spot %}` directly above the `<table class="spot-details-table">` element (after the spot description / tip banners)
    - _Requirements: 4.1, 4.6_

  - [x]* 4.2 Write structural/example-based tests for placement and removal
    - Render a representative non-rejected spot page; assert `.craft-type-display` appears before `.spot-details-table` in document order (4.1)
    - Assert the rendered `.spot-details-table` contains no `.craft-type-list` or `.craft-type-title` elements (4.6)
    - Assert each `.craft-type-entry` renders children in order name → icon → indicator (5.6)
    - _Requirements: 4.1, 4.6, 5.6_

  - [x] 4.3 Update `_tests/property/spot-detail.property.test.js` for the new display behaviour
    - Remove or replace the two now-invalid craft-type assertions — "detail page includes paddle craft types when spot has them" and "empty paddle craft types array results in no craft types section" — because the new `Craft_Type_Display` always renders exactly the two new types (each linked or unlinked) regardless of the spot's references, so the old conditional-presence/length model no longer holds
    - Keep all other (non-craft) assertions in the test intact; the new craft display behaviour is covered by Property 8 (`craft-type-display.property.test.js`) and is not re-added here
    - _Requirements: 4.2, 4.6, 5.1, 5.3_

  - [x] 4.4 Verify the Craft_Type_Display is confined to the non-rejected partial
    - Confirm the `{% include craft-type-display.html %}` is added ONLY to `_includes/spot-detail-content.html` and is NOT present in `_includes/rejected-spot-content.html`, so rejected spots continue to hide craft types
    - Run `_tests/property/rejected-spot.property.test.js` and confirm it still passes (guards the rejected-spot boundary)
    - _Requirements: 4.1, 4.6_

- [x] 5. Update spot detail styles (`_sass/pages/_spot-details.scss`)
  - Add `.craft-type-display` (flex row, centered, gapped) and `.craft-type-entry` (column: name → icon → indicator) rules
  - Add `.craft-type-entry.is-unlinked .craft-icon` greyed-out treatment (grayscale + reduced opacity)
  - Add `.craft-type-indicator--linked { color: $green-1; }` and `.craft-type-indicator--unlinked { color: $danger-red; }` using the Colour_File variables
  - Remove the now-unused `.craft-type-list` / `.craft-type-title` rules
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 6. Update the Statistics_Dashboard craft-type icon map (`assets/js/statistics-dashboard.js`)
  - [x] 6.1 Add the two new slug→icon mappings to `PADDLE_CRAFT_ICONS`
    - Add `'klappbar-und-aufblasbar' => '/assets/images/icons/foldables-dark.svg'` and `'hardshell' => '/assets/images/icons/hardshell-dark.svg'` to the `PADDLE_CRAFT_ICONS` map
    - Retain the legacy mappings (`seekajak`/`kanadier`/`stand-up-paddle-board`): the migration is additive and the legacy Contentful entries are not deleted, so the dashboard metrics may still contain legacy figures and the dashboard may show both legacy and new craft-type figures
    - Rely on the existing `renderFigure` truthy-icon guard: an unmapped slug yields `undefined`, so no `<img>` is appended and the count value and label still render without error
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x]* 6.2 Write property test for dashboard icon resolution and fallback
    - **Property 12: Statistics dashboard resolves craft-type icons with graceful fallback**
    - Create `_tests/property/statistics-dashboard-craft-icons.property.test.js`; model the `PADDLE_CRAFT_ICONS` lookup + `renderFigure` truthy-icon guard; generate mapped and unmapped slugs; assert the foldables icon for `klappbar-und-aufblasbar`, the hardshell icon for `hardshell`, and no icon element (rendered without error) for unmapped slugs; `{ numRuns: 100 }`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 7. Checkpoint - frontend surfaces
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create the one-time Contentful migration script (`scripts/add_paddle_craft_type_references.rb`)
  - [x] 8.1 Implement the pure additive migration rule
    - Add `LEGACY_TO_NEW` mapping (`kanadier`/`seekajak` → `hardshell`, `stand-up-paddle-board` → `klappbar-und-aufblasbar`)
    - Implement `additions_for(existing_slugs)` returning the set of new slugs to add: trigger only on legacy match, skip when the target new slug is already present, and dedupe within a single run
    - Ensure the applied result is always a superset of the existing references (additive)
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 8.2 Implement the CLI phases modelled on `scripts/truncate_spot_location_precision.rb`
    - Support `--dry-run` and `--slug` flags; read credentials from `.env.development`
    - Phase 1: scan `_data/spots.yml` for spots referencing any legacy slug (dedupe by slug); abort early with a clear message if `_data/spots.yml` or `.contentful_sync_cache.yml` is missing
    - Phase 2: resolve entry IDs from `.contentful_sync_cache.yml` (spot slug → entry_id; the two new craft-type slugs → entry_id via `content_type == 'paddleCraftType'`); build the `entry_id → slug` / `slug → entry_id` maps; abort before any writes if the new-type entry IDs cannot be resolved
    - Phase 3: batch-fetch candidate spot entries via `GET /entries?sys.id[in]=...` (100 per call)
    - Phase 4: per locale key on the CMA `paddleCraftType` field, resolve current linked slugs, compute `additions_for`, and append `{ sys: { type: 'Link', linkType: 'Entry', id: <new_type_id> } }` Links; in live mode `PUT /entries/{id}` with `X-Contentful-Version`, in dry-run only report intended changes; `sleep 0.15` between writes
    - Phase 5: bulk publish updated entries via `POST /bulk_actions/publish` with individual `PUT /entries/{id}/published` fallback
    - Implement per-entry error isolation (log non-2xx, increment error counter, continue; surface 409 conflicts in summary)
    - _Requirements: 6.1, 6.4, 6.8, 6.9_

  - [x]* 8.3 Write property test for migration rule and additivity
    - **Property 9: Migration is rule-correct and additive**
    - Create `_tests/property/paddle-craft-migration-rules.property.test.js`; model `additions_for`/`apply` in JS mirroring the Ruby logic; assert result contains `hardshell` iff existing has `kanadier`/`seekajak`, contains `klappbar-und-aufblasbar` when existing has `stand-up-paddle-board`, and is a superset of the existing set; `{ numRuns: 100 }`
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x]* 8.4 Write property test for no-op and no-duplicate behaviour
    - **Property 10: Migration is a no-op without legacy matches and never duplicates**
    - In the same migration test file; boundary generators (no legacy slug present; target new type already present); assert result equals existing set when no legacy match, and no duplicate reference is ever added
    - **Validates: Requirements 6.5, 6.6**

  - [x]* 8.5 Write property test for idempotency
    - **Property 11: Migration is idempotent**
    - In the same migration test file; assert `apply(apply(x)) == apply(x)` over random existing slug sets; `{ numRuns: 100 }`
    - **Validates: Requirements 6.7**

  - [x]* 8.6 Write integration/mock-based tests for migration side effects
    - With a mocked CMA client and a fixture spot requiring an addition, assert a publish request is issued for the updated entry (6.8)
    - With the same fixture in `--dry-run`, assert zero `PUT`/publish requests are issued and the intended change is reported to stdout (6.9)
    - _Requirements: 6.8, 6.9_

- [x] 9. Verify filter engine/panel behaviour is preserved (no client code changes)
  - [x]* 9.1 Confirm/extend the craft default-selected property test
    - **Property 4: Craft filter options default to selected**
    - Create `_tests/property/craft-filter-default-selected.property.test.js`; assert the engine's selected set equals all option slugs after `init`; `{ numRuns: 100 }`
    - **Validates: Requirements 2.1**

  - [x]* 9.2 Extend the craft set-intersection property test for the two-option set
    - **Property 5: Craft dimension applies set-intersection with empty-selection meaning no restriction**
    - Extend `_tests/property/filter-engine-craft-type-match.property.test.js` to cover the two-option craft dimension; assert satisfied iff selected set contains all options (or is empty) → no restriction, else non-empty intersection
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [x]* 9.3 Confirm panel-per-option and AND-across-dimensions property coverage
    - **Property 3: Filter panel renders one control per option, in order** — reuse the `filter-panel-rendering.property.test.js` pattern (jsdom + Leaflet mocks); assert one checkbox-labelled control per option, in order, each with its icon and localised label
    - **Property 6: Spot visibility is the AND across all active dimensions** — reuse `filter-engine-and-logic.property.test.js`; assert spot shown iff every active dimension's match function returns true
    - **Validates: Requirements 1.6, 2.6**

- [x] 10. Refresh legacy craft-type slug fixtures in existing property tests
  - [x] 10.1 Update legacy-slug fixtures to the two new slugs (representativeness only)
    - In each test below, replace the hardcoded legacy slug set (`seekajak`/`kanadier`/`stand-up-paddle-board`) used purely as fixture data with the two new slugs (`klappbar-und-aufblasbar`, `hardshell`) or a mix that includes them; do NOT change any behavioural assertions
    - `_tests/property/filter-engine-non-spot-isolation.property.test.js`
    - `_tests/property/marker-registry-round-trip.property.test.js`
    - `_tests/property/marker-registry-deduplication.property.test.js`
    - `_tests/property/filter-rejected-spots-exclusion.property.test.js`
    - _Requirements: 1.1, 1.2_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP.
- Each task references specific requirements (granular sub-clauses) for traceability.
- The two new SVG icons already exist in the repository (committed on branch
  `feat/paddlecraft-types-change`); Task 2.3 only verifies their presence as a regression guard.
- Property test sub-tasks each reference a single correctness property from the design document
  and its validated requirements clauses; each is implemented as one fast-check property with
  `{ numRuns: 100 }`, tagged `// Feature: paddlecraft-types-change, Property {n}: ...`.
- The Statistics_Dashboard change (Task 6) is independent of the filter/spot-detail frontend work
  and can proceed in parallel. It only extends the `PADDLE_CRAFT_ICONS` map and relies on the
  existing `renderFigure` truthy-icon guard for graceful fallback (Requirements 8.3, 8.4); the
  legacy mappings are retained because the additive migration leaves legacy figures in the metrics.
- Existing-test updates (Tasks 4.3, 4.4, 10.1) are coding tasks (not optional): Task 4.3 removes
  the now-invalid conditional-presence/length craft-type assertions from
  `spot-detail.property.test.js` (the new behaviour is covered by Property 8); Task 4.4 verifies the
  `Craft_Type_Display` is confined to the non-rejected partial so `rejected-spot.property.test.js`
  keeps passing; Task 10.1 refreshes legacy-slug fixtures with no behavioural assertion changes.
- The pure migration rule (`additions_for`/`apply`) is modelled identically in the Ruby script
  and the JS property tests so the same algorithm is exercised on both sides.
- Client-side `filter-panel.js`, `filter-engine.js`, and `map-data-init.js` require no code
  changes; their behaviour is preserved and verified by existing/extended property tests
  (Properties 3–6).
- All changes remain on the Feature_Branch `feat/paddlecraft-types-change` (Requirement 7.1).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.1", "8.1", "10.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "6.2", "8.2"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.3", "3.1", "8.3", "8.6"] },
    { "id": 3, "tasks": ["1.4", "1.5", "3.2", "4.1", "8.4", "9.1", "9.2", "9.3"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "5", "8.5"] }
  ]
}
```
