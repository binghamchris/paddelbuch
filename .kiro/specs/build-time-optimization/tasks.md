# Implementation Plan: Build Time Optimization

## Overview

Extract repeated Liquid-generated map configuration into a shared JS file produced once at build time by a new `MapConfigGenerator` plugin, simplify the `detail-map-layers.html` and `layer-control.html` includes to read from the global config at runtime, and fix the Bundler version mismatch in the Amplify build spec. Implementation uses Ruby (Jekyll plugin, RSpec tests) and JavaScript (runtime includes).

## Tasks

- [x] 1. Create MapConfigGenerator plugin
  - [x] 1.1 Implement `_plugins/map_config_generator.rb`
    - Create a new Jekyll `Generator` plugin with `safe true` and `priority :low`
    - Read `site.data.types.spot_types`, `site.data.types.paddle_craft_types`, and `site.data.types.protected_area_types`
    - Build the config object for both `"de"` and `"en"` locales with `dimensions`, `layerLabels`, and `protectedAreaTypeNames`
    - Write output as `api/map-config.js` using `PageWithoutAFile` with content `window.paddelbuchMapConfig = {...};`
    - Skip non-default language passes (same guard as `ApiGenerator`)
    - Log warnings for missing or malformed type data entries
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write unit tests for MapConfigGenerator
    - Create `spec/plugins/map_config_generator_spec.rb`
    - Test that generator produces valid JS output with `window.paddelbuchMapConfig = {...};` wrapper
    - Test output file is placed at `api/map-config.js`
    - Test generator skips non-default language passes
    - Test empty type data produces valid but empty config
    - Test missing `name_en` falls back to `name_de`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Write property test: Generator output completeness (Property 1)
    - **Property 1: Generator output completeness**
    - **Validates: Requirements 1.1, 1.2**
    - Use Rantly to generate random sets of spot types, paddle craft types, and protected area types
    - Assert output contains both `"de"` and `"en"` locale keys
    - Assert each locale has `dimensions` with `"spotType"` and `"paddleCraftType"` entries (each with non-empty `options`), `layerLabels` with all four keys, and `protectedAreaTypeNames`

  - [x] 1.4 Write property test: Generator data fidelity (Property 2)
    - **Property 2: Generator data fidelity**
    - **Validates: Requirements 1.4, 4.2**
    - Use Rantly to generate random type data entries with `slug`, `name_de`, `name_en`
    - Assert generated option slugs match source data slugs exactly
    - Assert generated labels match the `name_{locale}` field of corresponding source entries


- [x] 2. Checkpoint - Verify MapConfigGenerator
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Simplify detail-map-layers.html to use shared config
  - [x] 3.1 Modify `_includes/detail-map-layers.html` to load shared config
    - Add `<script src="/api/map-config.js"></script>` tag before the bootstrap script
    - Replace Liquid `for` loops over `site.data.types.spot_types` and `site.data.types.paddle_craft_types` with runtime reads from `window.paddelbuchMapConfig[locale].dimensions`
    - Replace Liquid `if/else` locale-switching blocks for labels with runtime locale selection
    - Attach `matchFn` functions to each dimension config at runtime (since functions can't be serialized to JSON)
    - Pass assembled `dimensionConfigs` and `layerToggles` to `PaddelbuchFilterEngine.init()` and `PaddelbuchFilterPanel.init()` with the same data structure as before
    - Add fallback handling: if `window.paddelbuchMapConfig` is undefined, use empty config and log `console.warn`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.2 Write property test: Runtime config structure equivalence (Property 3)
    - **Property 3: Runtime config structure equivalence**
    - **Validates: Requirements 2.2, 2.5**
    - Use Rantly to generate valid map config JSON objects for random locales
    - Assert that reading `window.paddelbuchMapConfig[locale]` and attaching `matchFn` produces the same `dimensionConfigs` and `layerToggles` structure as the current Liquid-generated implementation

- [ ] 4. Simplify layer-control.html to use shared config
  - [x] 4.1 Modify `_includes/layer-control.html` to read from shared config
    - Remove the Liquid `for` loop over `site.data.types.protected_area_types` that builds the `protectedAreaTypeNames` JS object
    - Replace with runtime read from `window.paddelbuchMapConfig[locale].protectedAreaTypeNames`
    - Ensure the same lookup data is available as the current Liquid-generated implementation
    - _Requirements: 3.1, 3.2, 4.6_

  - [~] 4.2 Write property test: Protected area type name round-trip (Property 4)
    - **Property 4: Protected area type name round-trip**
    - **Validates: Requirements 3.2, 4.6**
    - Use Rantly to generate random protected area type entries with `slug` and `name_{locale}`
    - Assert that generating the config and looking up a slug in `protectedAreaTypeNames[locale]` returns the same `name_{locale}` from the source entry

- [~] 5. Checkpoint - Verify template simplifications
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Fix Bundler version mismatch in Amplify build spec
  - [~] 6.1 Update Amplify buildSpec via AWS CLI
    - Run `aws amplify update-app` with `--profile paddelbuch-dev --region eu-central-1` to add `gem install bundler:2.6.2` before `bundle install` in the preBuild phase
    - Preserve all other existing buildSpec commands (nvm use, npm ci, npm run download-fonts, npm run copy-assets, bundle install)
    - _Requirements: 5.1, 5.2, 5.3_

  - [~] 6.2 Write unit test for Bundler version consistency
    - Verify that the Bundler version in the buildSpec matches the version in `Gemfile.lock`
    - _Requirements: 5.1, 5.2_

- [~] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using RSpec + Rantly
- Unit tests validate specific examples and edge cases
- Use `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec` to run Ruby tests
- Use `--profile paddelbuch-dev --region eu-central-1` for all AWS CLI commands
