# Implementation Plan: Liquid Template Pre-computation

## Overview

Move repeated Liquid computations into Ruby generator plugins to reduce the ~690 second rendering phase. The implementation modifies `CollectionGenerator`, creates a new `PrecomputeGenerator`, and simplifies all affected Liquid templates. HTML output must remain byte-identical.

## Tasks

- [x] 1. Extend CollectionGenerator with type name pre-computation
  - [x] 1.1 Add lookup hash builders to `_plugins/collection_generator.rb`
    - Add `build_type_lookup(data, locale)` — builds `{ type_category => { slug => translated_name } }` hash for spot_types, obstacle_types
    - Add `build_craft_type_lookup(data, locale)` — builds `{ slug => translated_name }` hash for paddle_craft_types
    - Add `build_waterway_lookup(waterways, locale)` — builds `{ slug => waterway_hash }` hash
    - Add `SPOT_ICON_MAP` constant with icon name and alt text mappings for all spot types
    - Add `resolve_spot_icon(type_slug, is_rejected, locale)` helper
    - Add `get_translation(locale, key)` helper that loads from `_i18n/<locale>.yml`
    - Call all builders at the start of `generate` before the collection iteration loop
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 6.1, 6.2_

  - [x] 1.2 Add per-document pre-computation calls in `create_document`
    - For spots: set `spot_type_name`, `paddle_craft_type_names`, `spot_icon_name`, `spot_icon_alt`, `waterway_name`
    - For obstacles: set `obstacle_type_name`, `waterway_name`
    - For waterways: set `active_notices` (filtered from notices data)
    - For notices: set `notice_waterways` (resolved waterway objects)
    - Handle rejected spots: set `spot_type_name` from translation file
    - Handle missing type data: fall back to raw slug string
    - Handle missing waterway data: leave `waterway_name` unset
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 6.1, 6.2, 7.1_

  - [x] 1.3 Write property tests for CollectionGenerator pre-computation
    - Create `spec/plugins/collection_precompute_spec.rb`
    - **Property 1:** Spot type name resolution equivalence (100 iterations)
    - **Property 2:** Paddle craft type names resolution equivalence (100 iterations)
    - **Property 3:** Obstacle type name resolution equivalence (100 iterations)
    - **Property 4:** Spot icon resolution equivalence (exhaustive + random)
    - **Property 9:** Waterway event notice filtering equivalence (100 iterations)
    - **Property 10:** Waterway name resolution equivalence (100 iterations)
    - **Property 11:** Notice waterway resolution equivalence (100 iterations)
    - _Validates: Requirements 1.1-1.7, 5.1, 5.2, 6.1-6.3, 7.1, 7.2_

- [x] 2. Checkpoint
  - Ensure all tests from task 1 pass, ask the user if questions arise.

- [x] 3. Create PrecomputeGenerator plugin
  - [x] 3.1 Create `_plugins/precompute_generator.rb` with priority `:normal`
    - Compute `site.config['locale_prefix']` from `site.config['lang']` and `site.config['default_lang']`
    - Compute `site.data['nav_top_lakes']` — top 10 lakes by area, sorted alphabetically
    - Compute `site.data['nav_top_rivers']` — top 10 rivers by length, sorted alphabetically
    - Compute `site.data['nav_open_data_pages']` — filtered and sorted static pages for open data menu
    - Compute `site.data['nav_about_pages']` — filtered and sorted static pages for about menu
    - Compute `site.data['map_data_config_json']` — complete JSON string for map data config
    - Compute `site.data['layer_control_config_json']` — complete JSON string for layer control config
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 9.1, 9.2, 9.3_

  - [x] 3.2 Write property tests for PrecomputeGenerator
    - Create `spec/plugins/precompute_generator_spec.rb`
    - **Property 5:** Locale prefix equivalence (100 iterations)
    - **Property 6:** Header navigation data equivalence (100 iterations)
    - **Property 7:** Map config JSON equivalence (100 iterations)
    - **Property 8:** Layer control config JSON equivalence (100 iterations)
    - _Validates: Requirements 2.1-2.3, 3.1-3.5, 4.1-4.5_

- [x] 4. Checkpoint
  - Ensure all tests from tasks 1 and 3 pass, ask the user if questions arise.

- [x] 5. Update Liquid templates for spot pages
  - [x] 5.1 Update `_layouts/spot.html`
    - Remove the spot type `| where` lookup block (lines assigning `spot_type` and `spot_type_name`)
    - Use `page.spot_type_name` directly
    - Remove the rejected spot type name override block (already handled in generator)
    - Remove the waterway `| where` lookup block
    - Pass `page.waterway_name` and `page.waterway_slug` to includes
    - Pass `page.spot_icon_name` and `page.spot_icon_alt` to `spot-icon.html`
    - Replace `locale_prefix` computation with `{% assign locale_prefix = site.locale_prefix %}`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.2, 6.3_

  - [x] 5.2 Update `_includes/spot-detail-content.html`
    - Remove `locale_prefix` computation block, use `site.locale_prefix`
    - Replace paddle craft type `| where` loop with iteration over `include.spot.paddle_craft_type_names`
    - Use `include.spot.waterway_name` and `include.spot.waterway_slug` instead of `include.waterway` object
    - _Requirements: 1.2, 1.6, 2.2, 6.3_

  - [x] 5.3 Update `_includes/spot-icon.html`
    - Replace the 6-way if/elsif chain with direct use of `include.icon_name` and `include.icon_alt`
    - Keep the `include.variant`, `include.size`, and `include.class` parameters unchanged
    - The include becomes: build icon path from `include.icon_name` + `include.variant`, output `<img>` tag
    - _Requirements: 1.5, 1.6_

  - [x] 5.4 Update `_includes/rejected-spot-content.html`
    - Remove `locale_prefix` computation, use `site.locale_prefix`
    - _Requirements: 2.2_

- [x] 6. Update Liquid templates for obstacle pages
  - [x] 6.1 Update `_layouts/obstacle.html`
    - Remove the obstacle type `| where` lookup block
    - Use `page.obstacle_type_name` directly
    - Remove the waterway `| where` lookup block
    - Use `page.waterway_name` and `page.waterway_slug` directly
    - Replace `locale_prefix` computation with `site.locale_prefix`
    - _Requirements: 1.3, 1.7, 2.2, 6.3_

  - [x] 6.2 Update `_includes/obstacle-detail-content.html`
    - Remove `locale_prefix` computation, use `site.locale_prefix`
    - Use pre-computed waterway name passed from layout
    - _Requirements: 2.2, 6.3_

- [x] 7. Update Liquid templates for waterway and notice pages
  - [x] 7.1 Update `_includes/event-list.html`
    - Remove the entire notice filtering loop (all_notices, date comparison, waterway slug matching)
    - Replace with iteration over `page.active_notices` (pre-computed array)
    - Remove `locale_prefix` computation, use `site.locale_prefix`
    - _Requirements: 2.2, 5.1, 5.2_

  - [x] 7.2 Update `_layouts/notice.html`
    - Remove the waterway lookup loop that builds `notice_waterways`
    - Use `page.notice_waterways` directly (pre-computed array)
    - Replace `locale_prefix` computation with `site.locale_prefix`
    - _Requirements: 2.2, 7.1, 7.2_

  - [x] 7.3 Update `_includes/notice-detail-content.html`
    - Remove `locale_prefix` computation, use `site.locale_prefix`
    - _Requirements: 2.2_

- [x] 8. Update shared includes (header, map config, layer control)
  - [x] 8.1 Update `_includes/header.html`
    - Remove `locale_prefix` computation, use `site.locale_prefix`
    - Replace `site.data.waterways | top_lakes_by_area` with `site.data.nav_top_lakes`
    - Replace `site.data.waterways | top_rivers_by_length` with `site.data.nav_top_rivers`
    - Replace `site.data.static_pages | where | sort` for open data with `site.data.nav_open_data_pages`
    - Replace `site.data.static_pages | where | sort` for about with `site.data.nav_about_pages`
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 8.2 Update `_includes/detail-map-layers.html`
    - Replace the entire `<script type="application/json" id="map-data-config">` Liquid block with `{{ site.data.map_data_config_json }}`
    - _Requirements: 4.1, 4.3_

  - [x] 8.3 Update `_includes/layer-control.html`
    - Replace the `<script type="application/json" id="layer-control-config">` Liquid block with `{{ site.data.layer_control_config_json }}`
    - _Requirements: 4.2, 4.4_

  - [x] 8.4 Update `_includes/map-init.html`
    - Replace the `<script type="application/json" id="map-data-config">` Liquid block with `{{ site.data.map_data_config_json }}`
    - _Requirements: 4.1, 4.5_

  - [x] 8.5 Update remaining includes that compute `locale_prefix`
    - Update `_includes/navigate-btn.html` — use `site.locale_prefix` if applicable
    - Update `_includes/spot-popup.html` — use `site.locale_prefix`
    - Update `_includes/obstacle-popup.html` — use `site.locale_prefix`
    - Update `_includes/event-popup.html` — use `site.locale_prefix`
    - _Requirements: 2.2_

- [x] 9. Checkpoint
  - Run full local build with `--verbose` and compare HTML output of sample pages against pre-optimization output
  - Verify byte-identical HTML for at least 5 spots, 5 waterways, 5 obstacles, 5 notices
  - Ensure all existing RSpec tests pass
  - Ensure all existing Jest tests pass
  - Ask the user if questions arise
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Remove `parallel_localization` config
  - [x] 10.1 Remove `parallel_localization: true` from `_config.yml`
    - This setting has no effect (the plugin does not implement it)
    - Removing it eliminates confusion about expected parallel behavior
    - _No requirement — cleanup only_

- [x] 11. Final checkpoint
  - Run full local build and record build timing from `[build-timer]` output
  - Compare render phase times against the baseline (de: 308.93s, en: 380.92s, total: 716.92s)
  - Ensure all RSpec and Jest tests pass
  - Ask the user if questions arise

## Notes

- The implementation must NOT change any build output — `_site/` must be byte-identical before and after (Requirement 8)
- CollectionGenerator pre-computation uses O(1) hash lookups instead of O(n) Liquid `| where` filter scans
- PrecomputeGenerator runs once per language pass (called by the multi-language plugin for each language)
- The `get_translation` helper loads YAML directly because CollectionGenerator runs before the multi-language plugin's `:pre_render` hook populates `site.parsed_translations`
- Run RSpec tests with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec`
- Run Jest tests with: `npm test`
