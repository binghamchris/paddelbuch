# Design Document

## Overview

This design addresses 15 quality improvement requirements for the Paddel Buch Jekyll project. Changes span six areas: CSP hardening via external JavaScript extraction, Ruby plugin deduplication, build/config hygiene, i18n corrections, accessibility attributes, and repository housekeeping. All changes preserve existing user-facing behaviour.

## Architecture & Design Decisions

### D1: External JavaScript Architecture for Map Initialization (R1, R2, R3)

The four detail layouts (`spot.html`, `waterway.html`, `obstacle.html`, `notice.html`) currently embed map initialization logic in inline `<script>` blocks. This forces the CSP to allow `'unsafe-inline'` for `script-src`.

**Decision:** Extract map logic into external JavaScript files using a two-tier architecture:

1. **Shared module** `assets/js/paddelbuch-map.js` — provides `PaddelbuchMap.init(elementId)` which reads configuration from `data-*` attributes on the map container `<div>`, creates the Leaflet map, adds the tile layer, positions the zoom control, and adds the locate control. This satisfies R3 (shared locate control) by centralizing the `L.control.locate` configuration in one file.

2. **Per-layout scripts** — four files (`assets/js/spot-map.js`, `assets/js/waterway-map.js`, `assets/js/obstacle-map.js`, `assets/js/notice-map.js`) that call `PaddelbuchMap.init()` and then apply layout-specific logic (marker placement, geometry rendering, bounds fitting).

**Data passing strategy:** Each layout injects a `<script type="application/json" id="map-config">` element containing a JSON object with layout-specific data (coordinates, geometry, locale, mapbox URL, map defaults). This tag type does not execute, so it is CSP-safe. The external JS reads and parses this JSON at DOMContentLoaded.

**CSP update:** The `Content-Security-Policy` header in `deploy/frontend-deploy.yaml` will be updated to remove `'unsafe-inline'` from `script-src`. The `style-src 'unsafe-inline'` directive must remain because Leaflet programmatically applies inline styles to map tiles and controls — this is a known Leaflet limitation and cannot be avoided without a nonce-based CSP strategy, which is out of scope.

**Notice.html consolidation (R2):** The current `notice.html` contains three separate map initialization blocks (affected area path, location fallback path, default path). The new `notice-map.js` will create the map once and then conditionally: (a) fit bounds to affected area geometry if present, (b) center on notice location if no affected area, or (c) use the default Switzerland center/zoom.

### D2: Shared `get_data_for_locale` Method (R4)

Both `tile_generator.rb` and `api_generator.rb` contain identical `get_data_for_locale` implementations that filter `site.data` arrays by locale.

**Decision:** Move the method into the existing `GeneratorCache` module in `_plugins/generator_cache.rb`. Both generators already `include GeneratorCache`. The method will accept `site_data`, `data_key`, `locale`, and a `cache` hash, keeping it stateless relative to the module. Each generator passes its own `@locale_cache` instance variable as the cache argument.

The `resolve_data_key` helper used by `api_generator.rb` will remain in `api_generator.rb` since it handles nested data paths (`types/spot_types`) that `tile_generator.rb` does not need — `tile_generator.rb` accesses top-level keys only via `@site.data[data_key]`.

### D3: Contentful Fetch-Cache Helper (R5)

The `contentful_fetcher.rb` repeats a four-step sequence (perform_full_fetch → compute_hash → save_cache → set_change_flag) in four places: force sync, invalid cache, environment mismatch, and sync API error.

**Decision:** Extract a private method `perform_full_sync_and_cache(cache, space_id, environment)` that encapsulates:
1. `perform_full_fetch(cache, space_id, environment)`
2. `new_hash = cache.compute_content_hash(yaml_file_paths)`
3. `save_cache(cache, cache.sync_token, space_id, environment, new_hash)`
4. `site.config['contentful_data_changed'] = true`

Each call site will be replaced with a single call to this helper, preceded only by the log message explaining the trigger reason.

### D4: Class-Level Instance Variable (R11)

`api_generator.rb` uses `@@cached_last_updates` to share data between the default-language and non-default-language generator passes. Class variables in Ruby leak across the inheritance hierarchy.

**Decision:** Replace with a class-level instance variable using `class << self; attr_accessor :cached_last_updates; end`. Access via `self.class.cached_last_updates` in instance methods.

### D5: Dead Code Removal — `t` Filter (R10)

The `t` method in `locale_filter.rb` (lines 33–50) implements a custom translation lookup against `site.data['translations']`. This data key is never populated — translations are handled by the `jekyll-multiple-languages-plugin` gem's `{% t %}` Liquid tag, which reads from `_i18n/*.yml` files directly.

**Decision:** Remove the `t` method entirely. The `{% t %}` tag is unaffected because it is provided by the gem, not by this filter module.

### D6: Build & Config Changes (R6, R7, R8)

**Jekyll exclude list (R6):** Append the following entries to the `exclude` array in `_config.yml`: `Rakefile`, `spec/`, `_tests/`, `_scripts/`, `jest.config.js`, `deploy/`, `docs/`, `scripts/`.

**Amplify fail-fast (R7):** Change `npm test || true` to `npm test` in `amplify.yml`.

**Ruby version pinning (R8):**
- Create `.ruby-version` containing `ruby-3.4.1`.
- Add `rvm install 3.4.1` and `rvm use 3.4.1` to the `amplify.yml` preBuild phase before `bundle install`.

### D7: i18n Typo Fix (R9)

Change `"Paddling Envrionment Types"` to `"Paddling Environment Types"` in `_i18n/en.yml` at the `paddling_environment_types` key.

### D8: Accessibility — Map ARIA Attributes (R12)

Add `role="img"` and a locale-appropriate `aria-label` to each map container `<div>` in the four detail layouts. The `aria-label` will use the `{% t %}` tag to pull from new translation keys:
- `map.spot_map_label`: "Map showing the location of this spot" / "Karte mit dem Standort dieses Einstiegsorts"
- `map.waterway_map_label`: "Map showing this waterway" / "Karte mit diesem Gewässer"
- `map.obstacle_map_label`: "Map showing this obstacle" / "Karte mit diesem Hindernis"
- `map.notice_map_label`: "Map showing this event notice" / "Karte mit diesem Gewässerereignis"

### D9: hreflang Attributes (R13)

Add `hreflang="{{ lang }}"` to each `<a>` element in the language switcher loop in `_includes/header.html`.

### D10: Repository Housekeeping (R14, R15)

**.DS_Store (R14):** Run `git rm --cached .DS_Store` (and any nested `.DS_Store` files) to untrack them. The existing `.gitignore` entry already prevents re-tracking.

**Empty footer (R15):** Remove `{% include footer.html %}` from `_layouts/default.html` since `_includes/footer.html` contains only a comment placeholder. The file itself can remain for future use but will not be included in the render chain.

## File Changes

| File | Action | Requirements |
|------|--------|-------------|
| `assets/js/paddelbuch-map.js` | Create | R1, R3 |
| `assets/js/spot-map.js` | Create | R1 |
| `assets/js/waterway-map.js` | Create | R1 |
| `assets/js/obstacle-map.js` | Create | R1 |
| `assets/js/notice-map.js` | Create | R1, R2 |
| `_layouts/spot.html` | Modify — replace inline script with external JS + data attributes + ARIA | R1, R12 |
| `_layouts/waterway.html` | Modify — replace inline script with external JS + data attributes + ARIA | R1, R12 |
| `_layouts/obstacle.html` | Modify — replace inline script with external JS + data attributes + ARIA | R1, R12 |
| `_layouts/notice.html` | Modify — replace inline script with external JS + data attributes + ARIA | R1, R2, R12 |
| `deploy/frontend-deploy.yaml` | Modify — update CSP `script-src` to remove `'unsafe-inline'` | R1 |
| `_plugins/generator_cache.rb` | Modify — add shared `get_data_for_locale` | R4 |
| `_plugins/tile_generator.rb` | Modify — remove local `get_data_for_locale`, use shared version | R4 |
| `_plugins/api_generator.rb` | Modify — remove local `get_data_for_locale`, use shared version; replace `@@cached_last_updates` | R4, R11 |
| `_plugins/contentful_fetcher.rb` | Modify — extract `perform_full_sync_and_cache` helper | R5 |
| `_plugins/locale_filter.rb` | Modify — remove dead `t` method | R10 |
| `_config.yml` | Modify — expand exclude list | R6 |
| `amplify.yml` | Modify — remove `\|\| true`, add rvm install/use | R7, R8 |
| `.ruby-version` | Create | R8 |
| `_i18n/en.yml` | Modify — fix typo | R9 |
| `_i18n/de.yml` | Modify — add map ARIA label translations | R12 |
| `_includes/header.html` | Modify — add hreflang attributes | R13 |
| `.DS_Store` | Remove from tracking | R14 |
| `_layouts/default.html` | Modify — remove footer include | R15 |

## Testing Strategy

- **RSpec tests:** Run existing `bundle exec rspec` suite to verify Ruby plugin changes (R4, R5, R10, R11) do not break generator behaviour.
- **npm tests:** Run `npm test` to verify JavaScript tests pass (R1, R2, R3).
- **Jekyll build:** Run `bundle exec jekyll build` to verify the site builds without errors after all changes.
- **Manual browser check:** Verify maps render correctly on all four detail page types, locate control works, and language switcher links include hreflang.
- **CSP verification:** Check browser console for CSP violations after deploying with the updated header.
