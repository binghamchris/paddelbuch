# Implementation Plan

- [x] 1. Extend the Filter_Engine for computed dimensions
  - [x] 1.1 Add `setDimensionSelection(key, slugs)` accepting an Array, a Set, or null
  - [x] 1.2 Create the state entry when the dimension was never initialised
  - [x] 1.3 Export it from the module's public API

- [x] 2. Carry the spot slug in marker metadata
  - [x] 2.1 Add `slug` to the metadata object in `addSpotMarker` so `evaluateMarker` can match on it

- [x] 3. Implement the Search_Module (`assets/js/semantic-search.js`)
  - [x] 3.1 ES5 IIFE registering `window.PaddelbuchSemanticSearch`, with a Dual_Export tail
  - [x] 3.2 Read and coerce configuration from `#semantic-search-config`; treat missing, malformed, or endpoint-less config as "not configured"
  - [x] 3.3 Merge localised strings over built-in defaults, ignoring blanks
  - [x] 3.4 Build the request URL with `q`, `locale`, `limit`, and `minScore`
  - [x] 3.5 Render the Search_Box: search input, clear button, and live status region, with no inline styles
  - [x] 3.6 Debounce input; skip requests below the minimum query length
  - [x] 3.7 Abort in-flight requests via AbortController and ignore AbortError
  - [x] 3.8 Parse the bare-array response into slugs and coordinates, skipping entries with no slug
  - [x] 3.9 Apply the slug set to the Search_Dimension and call `applyFilters()`
  - [x] 3.10 Fit the map to result coordinates, honouring a maximum zoom
  - [x] 3.11 Deactivate the dimension and show a localised error on failure
  - [x] 3.12 Clear on Escape and on the clear button

- [x] 4. Host the Search_Box in the Filter_Panel
  - [x] 4.1 Create a `div.filter-panel-search` slot at the top of the panel content
  - [x] 4.2 Invoke an optional `panelOptions.onSearchHostReady(host)` callback, wrapped in try/catch
  - [x] 4.3 Name the parameter `panelOptions` to avoid `var` hoisting collision with the inner `options`

- [x] 5. Wire the dimension in `map-data-init.js`
  - [x] 5.1 Append the search dimension to the Filter_Engine's dimension list only
  - [x] 5.2 Pass the search host callback to the Filter_Panel
  - [x] 5.3 Gate both on `isConfigured()`

- [x] 6. Localisation
  - [x] 6.1 Add a `search:` section to `_i18n/de.yml`
  - [x] 6.2 Add the matching section to `_i18n/en.yml`, preserving key parity
  - [x] 6.3 Use `{count}` rather than `%{count}` so substitution happens in JS

- [x] 7. Configuration plumbing
  - [x] 7.1 Add `SEARCH_API_ENDPOINT` and `SEARCH_API_KEY` to `KNOWN_KEYS` in `_plugins/env_loader.rb`
  - [x] 7.2 Map them to `site.search_api_endpoint` / `site.search_api_key`, treating blanks as unset
  - [x] 7.3 Render the JSON config block and script tag in `_includes/map-init.html`, only when the endpoint is set

- [x] 8. Styling
  - [x] 8.1 Add `_sass/components/_search-box.scss`, strict ASCII, no inline styles
  - [x] 8.2 Forward it from the components barrel
  - [x] 8.3 Regenerate `_tests/fixtures/application.baseline.css` (11 rules added, 0 removed)

- [x] 9. Deployment configuration
  - [x] 9.1 Add `EnvVarSearchApiEndpoint`, `EnvVarSearchApiKey`, `SearchApiCspHost` parameters, all defaulting to empty
  - [x] 9.2 Pass the two env vars to the Amplify app
  - [x] 9.3 Convert `CustomHeaders` to `!Sub` and add `${SearchApiCspHost}` to `connect-src`

- [x] 10. Tests
  - [x] 10.1 Property tests for search AND checkbox combination, against an independent oracle
  - [x] 10.2 Property tests for clear-restores-previous-view and empty-equals-null
  - [x] 10.3 Property tests for `setDimensionSelection` totality and replacement semantics
  - [x] 10.4 Unit tests for the pure helpers and the rendered DOM
  - [x] 10.5 Assert the rendered markup carries no `style=` attribute
  - [x] 10.6 Extend the CSP test for the new connect-src entry and pin the `!Sub` placeholder set

- [x] 11. Verification
  - [x] 11.1 Full Jest suite green (116 suites, 1141 tests; baseline was 1092)
  - [x] 11.2 RSpec i18n key parity and env_loader specs pass
  - [x] 11.3 Jekyll builds for both locales render correct localised config
  - [x] 11.4 Unconfigured and empty-endpoint builds omit search entirely, leaving the filter panel unchanged
  - [x] 11.5 Confirm the change introduces zero inline scripts

- [ ] 12. Deployment (requires operator action — not performed by this change)
  - [ ] 12.1 Set `EnvVarSearchApiEndpoint`, `EnvVarSearchApiKey`, and `SearchApiCspHost` on the Amplify stack
  - [ ] 12.2 Redeploy the backend so the `limit` and `minScore` parameters reach the live Lambda
  - [ ] 12.3 Correct the backend's `allowed-origins` SSM value, which currently holds one dev Amplify URL with a trailing slash and omits the production origins
  - [ ] 12.4 Tune `limit` and `minScore` against real queries once the endpoint is reachable from the site

## Known issue found during this work, not fixed here

`coverage/` is gitignored but is not in Jekyll's `exclude:` list, so a developer who has run `jest --coverage` gets the whole Jest HTML coverage report copied into the built site. Those files contain inline `<script>` blocks, which is why `tests/test_csp_inline_scripts.py` fails locally on a working tree that has a `coverage/` directory. The site's own output contains no inline scripts. Adding `coverage/` to `exclude:` would fix both the leak and the false-positive test failure.
