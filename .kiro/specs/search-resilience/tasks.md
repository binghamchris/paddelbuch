# Implementation Plan

Ordered so that the ability to withdraw the feature lands first, containment
second, and recovery last. An incomplete implementation should fail safe rather
than fail cleverly.

The feature flag is task 1 deliberately. It is the only item here that gives a way
out of a bad outcome without reverting code, so building it first means every task
after it ships with a switch already in place. Tasks 2–4 then remove the ways a
search fault can damage something else, and only after that do tasks 5–10 improve
how a fault behaves.

- [ ] 1. Build-time feature flag (Requirement 11)
  - [ ] 1.1 Add `SEARCH_DISABLED` to `KNOWN_KEYS` in `_plugins/env_loader.rb`
  - [ ] 1.2 Parse it: trimmed, case-insensitive; `true`/`1`/`yes` disable;
        absent/`""`/`false`/`0`/`no` do not; anything else disables AND warns,
        naming the value
  - [ ] 1.3 Derive the single positive boolean `site.config['search_enabled']` =
        endpoint present AND not disabled; leave the endpoint value in config for
        the config block to render
  - [ ] 1.4 Change `_includes/map-init.html` to gate on `site.search_enabled`
        instead of `site.search_api_endpoint`, covering both the config block and
        the `semantic-search.js` script tag
  - [ ] 1.5 Add the `SearchDisabled` parameter to `deploy/frontend-deploy.yaml`
        (`AllowedValues: [true, false]`, default `false`) and wire it to the
        `SEARCH_DISABLED` environment variable
  - [ ] 1.6 Add the CloudFormation condition that empties the CSP `connect-src`
        search host when the flag is set, so a disabled build cannot reach the
        endpoint even via injected script
  - [ ] 1.7 Extend `spec/env_loader_spec.rb` with the full parsing matrix and the
        derived boolean for every flag/endpoint combination. Note it currently
        asserts nothing about the search keys at all, so cover
        `SEARCH_API_ENDPOINT` and `SEARCH_API_KEY` here too
  - [ ] 1.8 Assert a disabled build emits neither the config block nor the script
        tag. Prefer rendering the include per `spec/notice_page_fixes_spec.rb`,
        which needs the `{% t %}` tag and `relative_url` filter stubbed — check
        that before assuming the pattern drops in; fall back to
        `spec/integration_spec.rb` against built output. Do not substitute a
        regex over the source
  - [ ] 1.9 Confirm the default build (flag absent) is byte-identical in rendered
        output to today's

- [ ] 2. Isolate map initialisation from search faults (Requirement 2)
  - [ ] 2.1 Wrap the `getDimensionConfig()` registration in `map-data-init.js` in
        a try/catch that logs, sets `searchEnabled = false`, and continues
  - [ ] 2.2 Wrap the `createControl(map)` call the same way
  - [ ] 2.3 Build `_tests/unit/map-data-init-isolation.test.js`, the first test
        that EXECUTES `map-data-init.js` rather than reading its source. Needs
        mocks for `PaddelbuchMap`, `PaddelbuchFilterEngine`,
        `PaddelbuchFilterPanel`, `PaddelbuchMarkerRegistry`,
        `PaddelbuchSpatialUtils`, `PaddelbuchDataLoader`,
        `PaddelbuchZoomLayerManager`, and Leaflet. Do not substitute a regex over
        the source: it would pass while the behaviour was broken
  - [ ] 2.4 Assert with that harness that the initial data load still runs, and
        the Filter_Engine is still initialised, when either search call throws
  - [ ] 2.5 Assert that a dimension registered without a Search_Box remains an
        Inactive_Dimension and hides no marker

- [ ] 3. Stop a malformed response masquerading as an empty result (Requirement 3)
  - [ ] 3.1 Reject a non-array `2xx` body with `Array.isArray`, throwing into the
        failure path instead of returning zero slugs
  - [ ] 3.2 Keep per-entry tolerance: skip entries with no `slug`, and skip
        `location` values that are not a pair of finite numbers
  - [ ] 3.3 Keep an empty array as a valid successful "nothing matched"
  - [ ] 3.4 Add the property test asserting no `2xx` payload shape hides markers
        except a genuine zero-length array

- [ ] 4. Make every export unconfigured-safe (Requirement 9)
  - [ ] 4.1 Guard `applySelection` on the presence of config, matching the
        pattern already used by `getDimensionConfig`
  - [ ] 4.2 Add a test that walks every exported function in the unconfigured
        state and asserts none throws

- [ ] 5. Replace the loose abort state with a per-operation request record
        (Requirements 1, 6)
  - [ ] 5.1 Introduce the record: controller, timer, `timedOut`, `superseded`,
        query, attempt number
  - [ ] 5.2 Capture the record in the promise closure so a late-settling request
        reads its own state, not the current one
  - [ ] 5.3 Make `abortInFlight()` set `superseded`, clear the timer, then abort
  - [ ] 5.4 Clear the timer on every exit path — success, failure, supersede

- [ ] 6. Add the per-Attempt timeout (Requirement 1)
  - [ ] 6.1 Read `timeoutMs` from config through a positive-finite coercion,
        defaulting to 6000 -- measured: cold-start ceiling is ~5.0s (init max
        1130ms + cold invocation max 3905ms), and the Lambda's own timeout is
        10000ms, so a 10s client budget would never fire before the server's own
        failure
  - [ ] 6.1a Do NOT ship a budget below ~5000ms until task 8 (retry) is in
        place: below the cold ceiling the timeout aborts legitimate cold starts,
        and only the retry recovers them
  - [ ] 6.2 Arm a timer per Attempt that sets `timedOut` and aborts
  - [ ] 6.3 Report a Timeout_Abort with the timeout message; keep a
        Supersede_Abort silent
  - [ ] 6.4 Assert the status region is never left reading "searching" for any
        outcome
  - [ ] 6.5 Add the timeout and supersede tests, including that a supersede does
        **not** retry

- [ ] 7. Classify failures in one place (Requirements 5, 6)
  - [ ] 7.1 Add the classifier returning retryability, message key, and dimension
        action for each outcome in the design's table
  - [ ] 7.2 Handle `429` distinctly: its own message, never retried
  - [ ] 7.3 Parse `Retry-After` when finite, non-negative, and plausible; fall
        back to the generic wait message otherwise
  - [ ] 7.4 Route every failure through `applySelection(null)` so the dimension
        is left Inactive
  - [ ] 7.5 Add tests for `429` with a usable header, `429` without, other `4xx`,
        `5xx`, and a network error

- [ ] 8. Add the single retry (Requirement 6)
  - [ ] 8.1 Allow at most two Attempts per Search_Operation
  - [ ] 8.2 Retry only a Transient_Failure, never a `4xx`, never a supersede
  - [ ] 8.3 Delay the retry by ~1000 ms, each Attempt carrying its own timeout
  - [ ] 8.4 Keep the status reading searching across the retry, with no failure
        flash
  - [ ] 8.5 Add tests pinning the Attempt counts: two on transient, one on `4xx`

- [ ] 9. Add the Result_Cache (Requirement 7)
  - [ ] 9.1 Key entries by the full request URL from `buildUrl(query)`
  - [ ] 9.2 Serve a hit without any Attempt, still applying selection and fit
  - [ ] 9.3 Cache successes only, including empty results; never cache a failure
  - [ ] 9.4 Bound by total cached results, not entries: 60000 results (~4.5MB at
        the measured 70-80 bytes per result) AND 500 entries, evicting until both
        hold. Entry count alone is the wrong metric -- 50 entries measured
        anywhere from 0.13MB to 1.9MB depending on query breadth
  - [ ] 9.4a Evict least-recently-USED, not oldest-first: a JS Map preserves
        insertion order, so LRU is a delete-then-set on each hit
  - [ ] 9.5 Add tests for the hit path making zero Attempts, for eviction under
        each bound independently, and for LRU ordering (a re-hit entry survives
        eviction that would have removed it under FIFO)
  - [ ] 9.6 Add the property test that cache keys differ whenever any request
        parameter differs

- [ ] 10. Persist the cache across navigation (Requirement 12)
  - [ ] 10.1 Render `contentVersion` into the search config block from
        `site.data.last_updates['spots']`, the signal `api_generator.rb` already
        produces and `offene-daten/api.html` already consumes
  - [ ] 10.2 Use `localStorage`, not `sessionStorage` -- a 7-day TTL is
        meaningless within one tab session
  - [ ] 10.3 One key per query: `pbsearch:<schema>:<contentVersion>:<requestUrl>`,
        so a lookup is a single getItem with no index and no enumeration
  - [ ] 10.4 Store each entry SELF-CONTAINED, with its own slugs and locations. Do
        not implement the shared-table-plus-indices layout: it is 15.8x smaller but
        two tabs appending concurrently diverge, after which one tab's positional
        indices resolve to the other's spots
  - [ ] 10.5 Read nothing during page or map initialisation -- reads happen only
        when a query is issued
  - [ ] 10.6 Stamp each entry with its write time; treat entries older than 7 days
        as a miss and delete them
  - [ ] 10.7 Purge superseded content/schema versions lazily via
        `requestIdleCallback`, falling back to a zero-delay timeout. Never during
        init -- enumeration is the one operation that touches every key
  - [ ] 10.8 On `QuotaExceededError`, evict least-recently-used and retry once; on
        a second failure or any other storage error, disable persistence for the
        page and continue with the in-memory tier
  - [ ] 10.9 Budget 4 MB, not the 9.88 MB measured in Chromium, because mobile
        Safari provides less
  - [ ] 10.10 Read order: in-memory, then persisted, then network
  - [ ] 10.11 Tests: a persisted hit makes zero Attempts; a hit survives a
        simulated navigation (fresh module against the same storage); an expired
        entry is a miss and is deleted; a changed `contentVersion` orphans every
        entry; a throwing `setItem` degrades silently with search still working;
        Safari-private-style storage that throws on any write is handled; nothing
        is read at init

- [ ] 11. Make the notice action state-dependent (Requirement 4)
  - [ ] 11.1 Extend `showNotice` to take an action: label, analytics event,
        handler
  - [ ] 11.2 Keep one permanently attached listener that dispatches to the
        current action
  - [ ] 11.3 Offer clear-search on no-results, retry on failure
  - [ ] 11.4 Make retry a no-op that hides the notice when the input is empty
  - [ ] 11.5 Add tests for both actions, and for the empty-input retry

- [ ] 12. Configuration and localisation
  - [ ] 12.1 Add `timeoutMs` and `contentVersion` to the
        `#semantic-search-config` block in `_includes/map-init.html`
  - [ ] 12.2 Add `timeout`, `timeout_hint`, `rate_limited`, `rate_limited_hint`,
        `rate_limited_hint_generic`, and `retry_label` to `_i18n/de.yml` and
        `_i18n/en.yml`
  - [ ] 12.3 Pass the new strings through the config block's `i18n` object
  - [ ] 12.4 Confirm `spec/i18n_key_parity_spec.rb` still passes

- [ ] 13. Verification
  - [ ] 13.1 Full Jest suite green, with the compiled-CSS baseline unchanged —
        this feature adds no CSS
  - [ ] 13.2 Full RSpec suite green, including the new env_loader coverage.
        Remember Ruby tests are not part of the Amplify build, so run them
        locally before pushing
  - [ ] 13.3 Confirm no request is issued to the Search_API before user input,
        and no availability probe exists
  - [ ] 13.4 Exercise the real failure modes against the deployed branch: a
        blocked endpoint, a slow response, and a `429`
  - [ ] 13.5 Deploy once with `SEARCH_DISABLED=true` and confirm the built page
        has no search markup, no `semantic-search.js` request, and no search host
        in the CSP header — and that the map, markers, filter panel, and layer
        toggles are unaffected
  - [ ] 13.6 Confirm the map behaves identically with search enabled, disabled by
        flag, disabled by absent endpoint, and enabled but broken
  - [ ] 13.6a On a real mobile device, confirm a persisted hit after navigation is
        instant, and that first render is unaffected -- the desktop measurement was
        0.033 ms for the largest entry, so this is a confirmation, not a discovery
  - [ ] 13.7 Update `docs/frontend.md` with the degradation behaviour, the new
        config key, and the flag
