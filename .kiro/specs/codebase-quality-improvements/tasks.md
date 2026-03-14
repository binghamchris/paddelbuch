# Tasks

## Task 1: Configuration, Build & Repository Housekeeping

**Requirements:** R6, R7, R8, R9, R14, R15

**Description:** Apply all standalone configuration, build, and housekeeping changes that have no dependencies on other tasks.

### Subtasks

- [x] 1.1 Expand the `exclude` list in `_config.yml` to add: `Rakefile`, `spec/`, `_tests/`, `_scripts/`, `jest.config.js`, `deploy/`, `docs/`, `scripts/`
- [x] 1.2 In `amplify.yml`, remove `|| true` from the `npm test` command so test failures abort the build
- [x] 1.3 In `amplify.yml`, add `rvm install 3.4.1` and `rvm use 3.4.1` to the preBuild phase before `bundle install`
- [x] 1.4 Create `.ruby-version` in the project root containing `ruby-3.4.1`
- [x] 1.5 Fix the typo in `_i18n/en.yml`: change `"Paddling Envrionment Types"` to `"Paddling Environment Types"` at the `paddling_environment_types` key
- [x] 1.6 Remove tracked `.DS_Store` files from Git using `git rm --cached`
- [x] 1.7 Remove `{% include footer.html %}` from `_layouts/default.html`
- [x] 1.8 Verify the Jekyll site builds successfully after all changes: `bundle exec jekyll build`

## Task 2: Ruby Plugin Cleanup

**Requirements:** R4, R5, R10, R11

**Description:** Deduplicate shared Ruby methods, extract the contentful fetch-cache helper, remove dead code, and fix the class variable scope issue.

### Subtasks

- [x] 2.1 Add a shared `get_data_for_locale(site_data, data_key, locale, cache)` method to `_plugins/generator_cache.rb` that filters site data arrays by locale with caching support
- [x] 2.2 Update `_plugins/tile_generator.rb` to remove its local `get_data_for_locale` method and call the shared version from `GeneratorCache`, passing `@site.data`, the data key, locale, and `@locale_cache`
- [x] 2.3 Update `_plugins/api_generator.rb` to remove its local `get_data_for_locale` method and call the shared version from `GeneratorCache`, passing `@site.data`, the data key, locale, and `@locale_cache`. Keep `resolve_data_key` in `api_generator.rb` since it handles nested data paths
- [x] 2.4 In `_plugins/contentful_fetcher.rb`, extract a private `perform_full_sync_and_cache(cache, space_id, environment)` method that encapsulates: `perform_full_fetch`, `compute_content_hash`, `save_cache`, and setting `site.config['contentful_data_changed'] = true`. Replace the four inline occurrences with calls to this helper
- [x] 2.5 Remove the dead `t` method (translation lookup via `site.data['translations']`) from `_plugins/locale_filter.rb`
- [x] 2.6 In `_plugins/api_generator.rb`, replace `@@cached_last_updates` with a class-level instance variable using `class << self; attr_accessor :cached_last_updates; end` and update all read/write sites to use `self.class.cached_last_updates`
- [x] 2.7 Run `bundle exec rspec` to verify all existing Ruby tests pass

## Task 3: Consolidate notice.html Map Initialization

**Requirements:** R2

**Description:** Refactor `notice.html` to use a single map initialization block instead of three separate blocks for the affected area, location fallback, and default view paths.

### Subtasks

- [x] 3.1 Rewrite the inline `<script>` in `_layouts/notice.html` to create the Leaflet map exactly once with the default Switzerland center/zoom, then conditionally: (a) fit bounds to affected area geometry if present, (b) set view to notice location if no affected area but location exists, (c) keep default view otherwise
- [x] 3.2 Ensure the locate control is added once after the single map creation
- [x] 3.3 Verify notice detail pages render correctly for all three scenarios (affected area, location only, neither) by building the site and checking sample pages

## Task 4: Extract Map Logic to External JavaScript & Harden CSP

**Requirements:** R1, R3

**Description:** Move all inline map initialization scripts from the four detail layouts into external JavaScript files and update the CSP header to remove `'unsafe-inline'` from `script-src`.

### Subtasks

- [x] 4.1 Create `assets/js/paddelbuch-map.js` with a `PaddelbuchMap.init(elementId)` function that: reads map configuration from a `<script type="application/json" id="map-config">` element, creates the Leaflet map with the specified center/zoom, adds the tile layer, positions the zoom control at bottomright, and adds the locate control with locale-aware strings
- [x] 4.2 Create `assets/js/spot-map.js` that calls `PaddelbuchMap.init('spot-map')`, then adds the spot marker and loads data layers
- [x] 4.3 Create `assets/js/waterway-map.js` that calls `PaddelbuchMap.init('waterway-map')`, then parses waterway geometry and fits map bounds
- [x] 4.4 Create `assets/js/obstacle-map.js` that calls `PaddelbuchMap.init('obstacle-map')`, then renders obstacle geometry and fits map bounds
- [x] 4.5 Create `assets/js/notice-map.js` that calls `PaddelbuchMap.init('notice-map')`, then handles the three-path notice logic (affected area / location / default) consolidated in Task 3
- [x] 4.6 Update `_layouts/spot.html` to: remove the inline `<script>` block, add a `<script type="application/json" id="map-config">` element with layout-specific data (coordinates, geometry, locale, mapbox URL, map defaults), and load `paddelbuch-map.js` + `spot-map.js` via `<script src>` tags
- [x] 4.7 Update `_layouts/waterway.html` similarly: remove inline script, add JSON config element, load external JS files
- [x] 4.8 Update `_layouts/obstacle.html` similarly: remove inline script, add JSON config element, load external JS files
- [x] 4.9 Update `_layouts/notice.html` similarly: remove inline script, add JSON config element, load external JS files
- [x] 4.10 Update the `Content-Security-Policy` header in `deploy/frontend-deploy.yaml` to change `script-src 'self' 'unsafe-inline'` to `script-src 'self'`. Keep `style-src 'self' 'unsafe-inline'` unchanged (required by Leaflet)
- [x] 4.11 Build the site and verify all four detail page types render maps correctly with no CSP violations for scripts in the browser console

## Task 5: Accessibility & SEO Improvements

**Requirements:** R12, R13

**Description:** Add ARIA attributes to map container elements and hreflang attributes to language switcher links.

### Subtasks

- [x] 5.1 Add new translation keys to `_i18n/de.yml` and `_i18n/en.yml` under a `map` section: `spot_map_label`, `waterway_map_label`, `obstacle_map_label`, `notice_map_label` with locale-appropriate descriptions
- [x] 5.2 In each of the four detail layouts, add `role="img"` and `aria-label="{% t map.<type>_map_label %}"` to the map container `<div>` element
- [x] 5.3 In `_includes/header.html`, add `hreflang="{{ lang }}"` to each `<a>` element in the language switcher `{% for lang in site.languages %}` loop (both the active and inactive link variants)
- [x] 5.4 Build the site and verify the ARIA attributes and hreflang attributes appear correctly in the rendered HTML
