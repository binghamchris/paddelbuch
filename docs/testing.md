# Testing Guide

Paddel Buch uses a multi-layered testing strategy with property-based testing as a core practice alongside traditional unit tests.

## Test Suites

| Suite | Framework | Location | Language | Command |
|-------|-----------|----------|----------|---------|
| Ruby plugin tests | RSpec + Rantly | `spec/` | Ruby | `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec` |
| JS unit tests | Jest | `_tests/unit/` | JavaScript | `npm test` |
| JS property tests | Jest + fast-check | `_tests/property/` | JavaScript | `npm run test:property` |
| Python tests | pytest | `tests/` | Python | `python3 -m pytest tests/` |

## Running Tests

```bash
# All JavaScript tests (unit + property)
npm test

# Property-based tests only
npm run test:property

# All Ruby tests
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec

# A specific Ruby spec file
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec spec/contentful_mappers_spec.rb

# Python tests
python3 -m pytest tests/
```

Tests run automatically during the Amplify build (`npm test` in the build phase). Ruby tests and Python tests are run locally or in CI as needed.

## Property-Based Testing

The project uses property-based testing extensively to verify invariants that must hold across all possible inputs, rather than testing specific examples.

### Why Property-Based Tests?

The site processes ~2,000 Contentful entries across 13 content types, renders them in 2 locales, generates spatial tiles, and produces a JSON API. Traditional example-based tests can't cover the combinatorial space. Property-based tests generate random inputs and verify that invariants hold, catching edge cases that hand-written tests miss.

### Ruby: Rantly

Rantly generates random test data for RSpec tests. Example pattern:

```ruby
it "produces valid YAML for any spot data" do
  property_of {
    { 'slug' => string(:alpha, 10), 'name' => string(:alpha, 20), 'locale' => choose('de', 'en') }
  }.check(100) { |spot|
    # Assert invariant holds for all generated spots
    expect(spot['slug']).not_to be_empty
  }
end
```

### JavaScript: fast-check

fast-check generates random test data for Jest tests. Example pattern:

```javascript
const fc = require('fast-check');

test('filter engine never loses markers', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ slug: fc.string(), spotType: fc.string() })),
      (markers) => {
        // Assert invariant: filtering and then clearing filters returns all markers
        const filtered = applyFilters(markers, someFilter);
        const restored = clearFilters(markers);
        expect(restored.length).toBe(markers.length);
      }
    )
  );
});
```

## Ruby Test Structure (spec/)

```
spec/
├── spec_helper.rb                          ← Test configuration and shared helpers
├── cache_metadata_spec.rb                  ← CacheMetadata class tests
├── collection_generator_spec.rb            ← CollectionGenerator tests
├── contentful_fetcher_spec.rb              ← ContentfulFetcher tests
├── contentful_mappers_spec.rb              ← ContentfulMappers tests
├── contentful_sync_properties_spec.rb      ← Sync API property tests
├── delta_sync_properties_spec.rb           ← Delta sync merge property tests
├── data_compatibility_spec.rb              ← Data format compatibility tests
├── env_loader_spec.rb                      ← EnvLoader tests
├── integration_spec.rb                     ← Cross-plugin integration tests
├── notice_page_fixes_spec.rb               ← Notice page regression tests
├── notice_preservation_spec.rb             ← Notice rendering preservation tests
├── sitemap_generator_spec.rb               ← SitemapGenerator tests
├── sync_checker_spec.rb                    ← SyncChecker tests
├── layouts/
│   └── default_layout_spec.rb              ← Default layout tests
└── plugins/
    ├── api_generator_spec.rb               ← ApiGenerator core tests
    ├── api_generator_api_structure_spec.rb  ← API output structure tests
    ├── api_generator_cache_spec.rb          ← API caching tests
    ├── api_generator_preservation_spec.rb   ← API backward compatibility tests
    ├── build_output_invariance_spec.rb      ← Build determinism tests
    ├── cache_metadata_hash_spec.rb          ← Content hash tests
    ├── collection_generator_cache_spec.rb   ← Collection caching tests
    ├── collection_precompute_spec.rb        ← Pre-computation tests
    ├── color_generator_spec.rb             ← ColorGenerator tests
    ├── contentful_fetcher_cache_spec.rb     ← Fetcher caching tests
    ├── favicon_generator_spec.rb            ← FaviconGenerator tests
    ├── frozen_string_literal_spec.rb        ← Ensures all plugins use frozen strings
    ├── generator_cache_spec.rb              ← GeneratorCache mixin tests
    ├── i18n_patch_spec.rb                   ← I18nPatch tests
    ├── locale_filter_spec.rb                ← LocaleFilter tests
    ├── parallel_build_spec.rb               ← Parallel build pipeline tests
    ├── pipeline_version_consistency_spec.rb  ← Version consistency tests
    ├── precompute_generator_spec.rb         ← PrecomputeGenerator tests
    ├── dashboard_metrics_generator_spec.rb  ← DashboardMetricsGenerator tests
    ├── dashboard_metrics_generator_property_spec.rb ← Dashboard metrics property tests
    ├── statistics_metrics_generator_spec.rb ← StatisticsMetricsGenerator tests
    ├── tile_generator_cache_spec.rb         ← Tile caching tests
    ├── tile_generator_spatial_spec.rb       ← Spatial tiling correctness tests
    └── waterway_filters_spec.rb             ← WaterwayFilters tests
```

## JavaScript Test Structure (_tests/)

```
_tests/
├── globalSetup.js                          ← Runs before all tests: ensures vendor assets exist
├── date-utils.test.js                      ← Date utility tests (root level, legacy)
├── html-utils.test.js                      ← HTML utility tests (root level, legacy)
├── unit/
│   ├── ascii-compliance.test.js            ← ASCII-only character compliance tests
│   ├── copy-vendor-assets.test.js          ← Vendor asset copy script tests
│   ├── custom-build-image-*.test.js        ← Custom build image consistency tests (6 files)
│   ├── dashboard-coverage.test.js          ← Coverage dashboard unit tests
│   ├── dashboard-csp.test.js               ← CSP configuration unit tests
│   ├── dashboard-data.test.js              ← Dashboard data parsing unit tests
│   ├── dashboard-freshness.test.js         ← Freshness dashboard unit tests
│   ├── dashboard-map.test.js               ← Dashboard map unit tests
│   ├── dashboard-switcher.test.js          ← Dashboard switcher unit tests
│   ├── date-utils.test.js                  ← Date formatting unit tests
│   ├── download-google-fonts.test.js       ← Font download script tests
│   ├── filter-panel-toggles.test.js        ← Filter panel UI tests
│   ├── filter-system.test.js               ← Filter engine unit tests
│   ├── geojson-utils.test.js               ← GeoJSON utility tests
│   ├── spatial-utils.test.js               ← Spatial utility tests
│   ├── spot-popup-utils.test.js            ← Spot popup rendering tests
│   ├── statistics-chartjs-no-inline-source.test.js ← No inline styles in JS source
│   ├── statistics-chartjs-scss.test.js     ← SCSS component structure tests
│   └── statistics-chartjs-vendor.test.js   ← Vendor dependency and load order tests
├── property/
│   ├── amplify-no-version-managers.property.test.js  ← Verifies no rvm/nvm in amplify.yml
│   ├── api-data-sorting.property.test.js             ← API output sorting invariants
│   ├── dashboard-i18n.property.test.js               ← Dashboard translation key completeness
│   ├── dashboard-switcher-*.property.test.js         ← Dashboard switcher invariants (3 files)
│   ├── data-loading-idempotence.property.test.js     ← Data loading is idempotent
│   ├── date-locale-formatting.property.test.js       ← Date format matches locale
│   ├── event-notice-*.property.test.js               ← Event notice rendering (4 files)
│   ├── filter-engine-*.property.test.js              ← Filter logic invariants (4 files)
│   ├── filter-panel-rendering.property.test.js       ← Filter panel rendering
│   ├── filter-rejected-spots-exclusion.property.test.js ← Rejected spots excluded
│   ├── layer-*.property.test.js                      ← Layer control and styles (3 files)
│   ├── layout-cdn-free.property.test.js              ← No CDN URLs in layouts
│   ├── locale-filtering.property.test.js             ← Locale filter correctness
│   ├── map-layers-*.property.test.js                 ← Map layer invariants (3 files)
│   ├── marker-registry-*.property.test.js            ← Marker deduplication (2 files)
│   ├── obstacle-*.property.test.js                   ← Obstacle rendering (4 files)
│   ├── protected-area-popup.property.test.js         ← Protected area popups
│   ├── rejected-spot.property.test.js                ← Rejected spot handling
│   ├── spot-freshness-*.property.test.js             ← Spot freshness dashboard invariants (8 files)
│   ├── spot-*.property.test.js                       ← Spot rendering (4 files)
│   ├── statistics-chartjs-*.property.test.js         ← Statistics Chart.js invariants (8 files)
│   ├── tile-coverage.property.test.js                ← Tile grid covers Switzerland
│   ├── url-pattern-generation.property.test.js       ← URL pattern correctness
│   ├── vendor-css-paths.property.test.js             ← Vendor CSS path correctness
│   ├── viewport-data-loading.property.test.js        ← Viewport-based loading
│   ├── waterway-*.property.test.js                   ← Waterway rendering (3 files)
│   └── zoom-layer-visibility.property.test.js        ← Zoom-based layer visibility
└── integration/
    └── .gitkeep
```

## Python Tests (tests/)

| File | Purpose |
|------|---------|
| `test_csp_inline_scripts.py` | Verifies no inline scripts exist in HTML output (Content Security Policy compliance) |
| `test_preservation.py` | Verifies that build output preserves expected structure and content |

These tests run against the built `_site/` directory and verify properties of the final HTML output.

## Global Setup

The `_tests/globalSetup.js` file runs before any Jest test. It ensures vendor assets (Bootstrap, Leaflet) and Google Fonts are available by running the copy and download scripts if the files don't exist. This means tests can run without a prior `npm run copy-assets` / `npm run download-fonts`.

## Writing New Tests

### For a new Jekyll plugin

1. Create `spec/plugins/your_plugin_spec.rb`
2. Use the existing spec files as templates for mocking `site` and `site.data`
3. Include property-based tests with Rantly for any logic that processes variable data
4. Run with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec spec/plugins/your_plugin_spec.rb`

### For a new JavaScript module

1. Create `_tests/unit/your-module.test.js` for unit tests
2. Create `_tests/property/your-module.property.test.js` for property-based tests
3. Use `jest-environment-jsdom` if the module interacts with the DOM (set `@jest-environment jsdom` at the top of the file)
4. Run with: `npm test -- --testPathPattern=your-module`

### Test naming conventions

- Ruby: `*_spec.rb`
- JS unit: `*.test.js`
- JS property: `*.property.test.js`
- JS exploration/preservation: `*.exploration.test.js`, `*.preservation.test.js`

## CI Integration

Tests run during the Amplify build in the build phase (`npm test` in `amplify.yml`). Ruby tests are not currently part of the Amplify build pipeline but should be run locally before pushing changes to plugin code.
