# Implementation Plan

Ordered so that containment lands before recovery: an incomplete implementation
should fail safe rather than fail cleverly. Tasks 1–3 remove the ways a search
fault can damage something else; only then do tasks 4–8 improve how a fault
behaves. Task 2 is deliberately first among the module changes because it is the
one whose absence currently hides markers.

- [ ] 1. Isolate map initialisation from search faults (Requirement 2)
  - [ ] 1.1 Wrap the `getDimensionConfig()` registration in `map-data-init.js` in
        a try/catch that logs, sets `searchEnabled = false`, and continues
  - [ ] 1.2 Wrap the `createControl(map)` call the same way
  - [ ] 1.3 Build `_tests/unit/map-data-init-isolation.test.js`, the first test
        that EXECUTES `map-data-init.js` rather than reading its source. Needs
        mocks for `PaddelbuchMap`, `PaddelbuchFilterEngine`,
        `PaddelbuchFilterPanel`, `PaddelbuchMarkerRegistry`,
        `PaddelbuchSpatialUtils`, `PaddelbuchDataLoader`,
        `PaddelbuchZoomLayerManager`, and Leaflet. Do not substitute a regex over
        the source: it would pass while the behaviour was broken
  - [ ] 1.4 Assert with that harness that the initial data load still runs, and
        the Filter_Engine is still initialised, when either search call throws
  - [ ] 1.5 Assert that a dimension registered without a Search_Box remains an
        Inactive_Dimension and hides no marker

- [ ] 2. Stop a malformed response masquerading as an empty result (Requirement 3)
  - [ ] 2.1 Reject a non-array `2xx` body with `Array.isArray`, throwing into the
        failure path instead of returning zero slugs
  - [ ] 2.2 Keep per-entry tolerance: skip entries with no `slug`, and skip
        `location` values that are not a pair of finite numbers
  - [ ] 2.3 Keep an empty array as a valid successful "nothing matched"
  - [ ] 2.4 Add the property test asserting no `2xx` payload shape hides markers
        except a genuine zero-length array

- [ ] 3. Make every export unconfigured-safe (Requirement 9)
  - [ ] 3.1 Guard `applySelection` on the presence of config, matching the
        pattern already used by `getDimensionConfig`
  - [ ] 3.2 Add a test that walks every exported function in the unconfigured
        state and asserts none throws

- [ ] 4. Replace the loose abort state with a per-operation request record
        (Requirements 1, 6)
  - [ ] 4.1 Introduce the record: controller, timer, `timedOut`, `superseded`,
        query, attempt number
  - [ ] 4.2 Capture the record in the promise closure so a late-settling request
        reads its own state, not the current one
  - [ ] 4.3 Make `abortInFlight()` set `superseded`, clear the timer, then abort
  - [ ] 4.4 Clear the timer on every exit path — success, failure, supersede

- [ ] 5. Add the per-Attempt timeout (Requirement 1)
  - [ ] 5.1 Read `timeoutMs` from config through a positive-finite coercion,
        defaulting to 10000
  - [ ] 5.2 Arm a timer per Attempt that sets `timedOut` and aborts
  - [ ] 5.3 Report a Timeout_Abort with the timeout message; keep a
        Supersede_Abort silent
  - [ ] 5.4 Assert the status region is never left reading "searching" for any
        outcome
  - [ ] 5.5 Add the timeout and supersede tests, including that a supersede does
        **not** retry

- [ ] 6. Classify failures in one place (Requirements 5, 6)
  - [ ] 6.1 Add the classifier returning retryability, message key, and dimension
        action for each outcome in the design's table
  - [ ] 6.2 Handle `429` distinctly: its own message, never retried
  - [ ] 6.3 Parse `Retry-After` when finite, non-negative, and plausible; fall
        back to the generic wait message otherwise
  - [ ] 6.4 Route every failure through `applySelection(null)` so the dimension
        is left Inactive
  - [ ] 6.5 Add tests for `429` with a usable header, `429` without, other `4xx`,
        `5xx`, and a network error

- [ ] 7. Add the single retry (Requirement 6)
  - [ ] 7.1 Allow at most two Attempts per Search_Operation
  - [ ] 7.2 Retry only a Transient_Failure, never a `4xx`, never a supersede
  - [ ] 7.3 Delay the retry by ~1000 ms, each Attempt carrying its own timeout
  - [ ] 7.4 Keep the status reading searching across the retry, with no failure
        flash
  - [ ] 7.5 Add tests pinning the Attempt counts: two on transient, one on `4xx`

- [ ] 8. Add the Result_Cache (Requirement 7)
  - [ ] 8.1 Key entries by the full request URL from `buildUrl(query)`
  - [ ] 8.2 Serve a hit without any Attempt, still applying selection and fit
  - [ ] 8.3 Cache successes only, including empty results; never cache a failure
  - [ ] 8.4 Bound to 50 entries with oldest-first eviction
  - [ ] 8.5 Add tests for the hit path making zero Attempts, and for eviction
  - [ ] 8.6 Add the property test that cache keys differ whenever any request
        parameter differs

- [ ] 9. Make the notice action state-dependent (Requirement 4)
  - [ ] 9.1 Extend `showNotice` to take an action: label, analytics event,
        handler
  - [ ] 9.2 Keep one permanently attached listener that dispatches to the current
        action
  - [ ] 9.3 Offer clear-search on no-results, retry on failure
  - [ ] 9.4 Make retry a no-op that hides the notice when the input is empty
  - [ ] 9.5 Add tests for both actions, and for the empty-input retry

- [ ] 10. Configuration and localisation
  - [ ] 10.1 Add `timeoutMs` to the `#semantic-search-config` block in
        `_includes/map-init.html`
  - [ ] 10.2 Add `timeout`, `timeout_hint`, `rate_limited`, `rate_limited_hint`,
        `rate_limited_hint_generic`, and `retry_label` to `_i18n/de.yml` and
        `_i18n/en.yml`
  - [ ] 10.3 Pass the new strings through the config block's `i18n` object
  - [ ] 10.4 Confirm `spec/i18n_key_parity_spec.rb` still passes

- [ ] 11. Verification
  - [ ] 11.1 Full Jest suite green, with the compiled-CSS baseline unchanged —
        this feature adds no CSS
  - [ ] 11.2 Confirm no request is issued to the Search_API before user input,
        and no availability probe exists
  - [ ] 11.3 Exercise the real failure modes against the deployed branch: a
        blocked endpoint, a slow response, and a `429`
  - [ ] 11.4 Confirm the map, markers, filter panel, and layer toggles behave
        identically with search enabled, disabled, and broken
  - [ ] 11.5 Update `docs/frontend.md` with the degradation behaviour and the new
        config key
