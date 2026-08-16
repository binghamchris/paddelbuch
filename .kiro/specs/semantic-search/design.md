# Design Document

## Overview

Search is implemented as a **filter dimension**, not as a parallel rendering path. The Search_Module turns a query into a set of spot slugs and hands that set to the existing Filter_Engine; the engine's existing AND evaluation does the rest. No marker creation, popup, or map-layer code is duplicated.

## Why a filter dimension rather than rendering search results directly

The obvious alternative is to render markers straight from the Search_API response, which carries enough data to draw a marker (`name`, `location`, `spotType_slug`, `paddleCraftTypes`). It was rejected for a concrete reason: **the backend does not know about `spotTipType_slugs`.**

`spotTipType` is one of the three live filter dimensions, and its slugs are mapped by the frontend's Ruby Contentful mapper but not by the backend's Python port. Markers drawn from API data would therefore carry an empty tip list and would be silently misclassified as "no tips" by the tip filter, breaking AND-combination for that dimension.

Filtering the existing tile-loaded markers avoids the problem entirely: each marker already carries the full, correct metadata from the tile payload, and search only ever contributes a slug set. As a bonus, the backend and frontend field names match one-for-one (the Python mapper is a deliberate port of the Ruby one), and `slug` is locale-invariant in both systems, so it is a sound join key with no translation layer.

## Component Design

### `assets/js/semantic-search.js`

ES5 IIFE exposing `window.PaddelbuchSemanticSearch`, with a Dual_Export tail.

Public surface:

| Function | Role |
|---|---|
| `isConfigured()` | Whether a usable endpoint exists; gates all wiring |
| `getDimensionConfig()` | The dimension object handed to the Filter_Engine |
| `matchFn(meta, selected)` | `selected.has(meta.slug)` |
| `init(map, host)` | Renders the Search_Box into `host` |
| `clearSearch()` | Deactivates the dimension and restores every marker |

Configuration is read once from `#semantic-search-config`. A missing element, malformed JSON, or a blank `endpoint` all yield "not configured", and the module then renders nothing. That makes a local build with no environment variables a supported state rather than a broken one.

### `assets/js/filter-engine.js` — `setDimensionSelection(key, slugs)`

The engine could only mutate a dimension one option at a time via `setOption`, which suits checkboxes but not a computed set. `setDimensionSelection` replaces the whole set, accepts an Array or a Set, and creates the state entry if the dimension was never initialised.

The important detail is what an empty set means. `evaluateMarker` already skips a dimension whose selection is empty, treating it as *inactive* rather than *matches nothing*. Search inherits that: clearing the query, a sub-threshold query, a zero-result query, and a failed query all converge on "empty selection", and all correctly restore the checkbox-only view. Had empty meant "match nothing", every one of those cases would have blanked the map.

### `assets/js/layer-control.js` — `slug` in marker metadata

`evaluateMarker` receives only the metadata object, not the registry key, so the slug had to be added to the metadata for the search dimension to match on it. The registry already keys on the same value, so this duplicates a value rather than introducing a new source of truth.

### Search placement — a standalone Leaflet control

The search box is its **own** `L.Control` at `topleft`, added after the filter panel. `filter-panel.js` is untouched by this feature and is byte-identical to its pre-feature state.

Placement took three attempts, and both failures are worth recording because each was invisible to the tests at the time:

1. **Inside `.filter-panel-content`.** Fully wired and present in the DOM, but that region is `display: none` until the funnel toggle adds `.expanded`, so no search UI appeared on page load. On the deployed site the feature looked entirely absent.
2. **As a direct child of `.filter-panel`.** Visible, but it widened the panel and changed the filter button's appearance — the panel is sized by its content.
3. **Its own control (current).** Visible without interaction, and structurally incapable of affecting the panel's size or styling.

Leaflet stacks controls within a corner vertically (`.leaflet-control { float: left; clear: both; }`). To place search to the *right* of the filter button, the module adds a `has-search-control` class to its own corner element at runtime, and CSS lays out only that corner as a flex row. The scoping matters: no other corner and no other page can be affected, and the class only ever exists when search is configured. This is safe on the home map because the filter panel is the corner's only other occupant — zoom and locate are both `bottomright`.

The control container gets Leaflet's `disableClickPropagation` and `disableScrollPropagation`, so typing and text selection never pan or zoom the map.

One shared behaviour worth knowing: `filter-panel.js` sets the corner element's `z-index` to 0 on `popupopen` and restores it on `popupclose`. Because both controls share that corner, the search box is also lowered while a popup is open. That is consistent with how the filter panel already behaves and keeps popups above both controls.

The layout uses `flex-wrap: wrap` and a `max-width` on the control so a narrow viewport wraps the search box below the filter button rather than overflowing the map.

### `assets/js/map-data-init.js` — wiring

The search dimension is appended to the array given to `PaddelbuchFilterEngine.init`, but **not** to the array given to `PaddelbuchFilterPanel.init`. That single asymmetry is what makes search participate in AND evaluation without rendering an empty fieldset for a dimension that has no options.

## Map Bounds and Tile Loading

This is the part that is easy to get wrong. The home map holds markers only for spots whose viewport tiles have been fetched, so filtering alone cannot reveal a match in another region: there is no marker to reveal.

The sequence is therefore:

1. Search returns slugs plus coordinates.
2. The dimension selection is set and `applyFilters()` runs over the currently loaded markers.
3. The map is fitted to the result coordinates.
4. The fit triggers `moveend`, the existing debounced tile loader fetches the new viewport, and `addSpotMarker` evaluates each new marker against the live filter state as it is created.

Step 4 relies on behaviour that already exists in `map-data-init.js` and `layer-control.js`; no new loading path was added.

Two existing behaviours interact with the fit and were checked: `home-map.js` resets the view 150 ms after `popupclose`, and marker clicks recentre. Neither is triggered by a search, because no popup opens.

## Rejected and No-Entry Spots

Spots with `rejected === true` bypass the Marker_Registry entirely and live in the `noEntry` layer group, so no filter dimension applies to them today. Search behaves the same way, which is consistent with the existing checkbox dimensions rather than a new inconsistency. It does mean that with the "no entry" layer enabled, rejected markers stay visible during a search; changing that would require registering them, which is a change to existing filter semantics and out of scope here.

## Result Set Sizing

The Search_API originally returned the entire locale corpus per query, roughly 850 KB, which is unusable for search-as-you-type. The companion backend change adds `limit` and `minScore`, and this module sends both.

The defaults are `limit=40` and `minScore=0.25`. The threshold is not a guess: the backend's own e2e query set treats `t=0.2` as the relevance floor and `t_top=0.3` as the expected top-match score, so 0.25 sits between "plausibly relevant" and "confidently the best match". Both are configurable precisely because the right value is empirical.

There is a real tension worth recording: a tight `limit` interacts badly with restrictive checkbox filters, because the AND can empty out when a qualifying spot ranked just outside the limit. Raising the limit widens the pool at the cost of payload. Server-side filtering would solve it properly but cannot reproduce the frontend's tip-type dimension, which the backend does not model.

## Accessibility

The Search_Box is a plain `input[type=search]` with a `role="status"`, `aria-live="polite"` region linked by `aria-describedby`, not a combobox. Results appear as markers on the map rather than in a listbox, so the combobox pattern and its arrow-key navigation would describe an interaction that does not exist. Escape clears the query. This keeps the component to the one keyboard behaviour it actually needs, in a codebase that currently has no keyboard handling at all.

All ARIA strings are localised through the configuration block rather than hardcoded in English, which is the pattern the existing `filter-panel.js` toggle gets wrong.

## Configuration Chain

```
Amplify parameter -> Amplify env var -> _plugins/env_loader.rb KNOWN_KEYS
  -> site.search_api_endpoint / site.search_api_key
  -> JSON block in _includes/map-init.html
  -> JSON.parse in semantic-search.js
```

`env_loader.rb` treats an empty or whitespace-only value as unset. Without that, CloudFormation's empty-string default for an omitted parameter would render a config block with a blank endpoint, since `""` is truthy in both Ruby and Liquid.

The CSP `connect-src` gains `${SearchApiCspHost}`, which required converting the `CustomHeaders` block to `!Sub`. That block contained no other `${...}` sequences, and a test now pins the placeholder set so a future stray `${` cannot silently break every header on the site.

## Testing Strategy

`_tests/property/semantic-search-and-logic.property.test.js` is the load-bearing suite. It builds an engine with the real checkbox dimensions plus the real search dimension and checks marker visibility against an independent oracle, over generated spots and generated filter selections. The properties are: visible iff search AND checkboxes; search never widens the checkbox result set; an excluded spot stays hidden however permissive the checkboxes; clearing restores the checkbox-only set exactly; and empty-array and null selections are indistinguishable.

The oracle has to model the inactive-dimension rule, or it disagrees with the engine whenever the generated match set happens to be empty. That disagreement is what the first run surfaced, and it is a property of the design rather than a quirk of the test.

`_tests/unit/semantic-search.test.js` covers the pure helpers and the rendered DOM, including an assertion that the markup contains no `style=` attribute, since the CSP would drop it.

## Out of Scope

- A result dropdown or list view. Results are expressed as map markers.
- Searching obstacles and event notices. The backend indexes spots only.
- Navigability filtering. `navigableByPaddlers` is a waterway attribute and the backend does not index waterways; it would need a client-side join against `_data/waterways.yml`, whose value is `null` for 228 of 498 rows.
- Difficulty filtering. No difficulty field exists in either system; it would be a Contentful content-model change first.
