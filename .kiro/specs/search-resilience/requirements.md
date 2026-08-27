# Requirements Document

## Introduction

Semantic Search depends on a backend service that can be slow, rate-limited, or
unavailable. This feature makes the frontend degrade gracefully when that
happens: everything that does not depend on the Search_API must keep working
normally, and everything that does must fail visibly, recoverably, and without
misleading the user.

The governing principle: **a search backend problem may cost the user search, and
nothing else.** It may never cost them the map, the markers, the filter panel, or
the layer toggles.

### What already degrades correctly

This spec deliberately does not restate behaviour that is already in place and
verified. Recorded here so the requirements below are read as additions rather
than replacements:

- **No request is made to the Search_API at page load.** The first call happens
  on user input, from the debounce in `onInput`. A backend that is down when the
  site loads therefore has no effect on loading the site.
- An unset or empty-string `SEARCH_API_ENDPOINT` makes `readConfig()` return
  `null`, so no Search_Box renders and the Search_Dimension is never registered.
  `_plugins/env_loader.rb` treats empty strings as unset.
- A missing or 404-ing `assets/js/semantic-search.js` leaves
  `window.PaddelbuchSemanticSearch` undefined, so `searchEnabled` is false and
  the map, filters, and markers are untouched.
- A failed request calls `applySelection(null)`, so a failure degrades to "no
  search" rather than a stale or an empty view.
- An empty `SearchApiCspHost` renders `connect-src 'self' ... ;`, which is
  harmless whitespace, so an unconfigured deploy cannot break the map's own
  data fetches.

## Glossary

- **Search_Module**: `assets/js/semantic-search.js`, registered as
  `window.PaddelbuchSemanticSearch`.
- **Search_API**: The `GET /search` endpoint in the `paddelbuch-searchengine`
  service.
- **Search_Box**: The search input, its clear button, and its status region.
- **Search_Notice**: The centred overlay in the map container that reports a
  no-results or a failure state, with a single action button.
- **Search_Dimension**: The filter dimension whose selection set is the slugs
  returned by the latest search, registered under the key `search`.
- **Filter_Engine**: `window.PaddelbuchFilterEngine`.
- **Inactive_Dimension**: A dimension whose selection set is empty, which the
  Filter_Engine skips rather than treating as "match nothing".
- **No_Match_Sentinel**: The impossible slug that keeps the Search_Dimension
  active while matching no marker, used to express "this search found nothing".
- **Attempt**: One HTTP request to the Search_API.
- **Search_Operation**: All Attempts made to satisfy one user query, up to the
  retry budget.
- **Transient_Failure**: A network error, a Timeout_Abort, or a `5xx` response.
- **Timeout_Abort**: An abort caused by a Search_Operation exceeding its time
  budget.
- **Supersede_Abort**: An abort caused by a newer query replacing an in-flight
  one. Not a failure.
- **Result_Cache**: An in-memory, per-page-load map of request URL to parsed
  results.
- **Search_Disabled_Flag**: The build-time environment variable
  `SEARCH_DISABLED`. When set to a recognised true value, the search feature is
  built out of the site entirely.
- **Search_Enabled**: The single derived boolean, computed in
  `_plugins/env_loader.rb`, that the site's templates consume. True only when an
  endpoint is configured AND the Search_Disabled_Flag is not set.

## Requirements

### Requirement 1: Request Timeout

**User Story:** As a paddler on a slow or broken connection, I want a search that
cannot answer to tell me so, rather than leaving me watching a spinner.

#### Acceptance Criteria

1. THE Search_Module SHALL abort any Attempt that has not settled within a
   configurable time budget, defaulting to 10000 ms.
2. THE Search_Module SHALL read the budget from the `timeoutMs` key of the
   search config block, falling back to the default when the value is absent or
   not a finite positive number.
3. WHEN a Search_Operation ends in a Timeout_Abort, THE Search_Module SHALL show
   the Search_Notice with a timeout-specific message and SHALL leave the
   Search_Dimension as an Inactive_Dimension.
4. THE Search_Module SHALL distinguish a Timeout_Abort from a Supersede_Abort.
   A Supersede_Abort SHALL remain silent; a Timeout_Abort SHALL be reported.
5. THE Search_Module SHALL clear a pending timeout timer whenever its Attempt
   settles or is superseded, so no timer outlives its request.
6. THE Search_Module SHALL NOT leave the status region reading "searching" after
   any Search_Operation has ended, for any outcome.

### Requirement 2: Initialisation Isolation

**User Story:** As a paddler, I want the map to load its markers even if the
search feature fails to start, so that a search fault never costs me the map.

#### Acceptance Criteria

1. THE map initialisation in `assets/js/map-data-init.js` SHALL treat every
   Search_Module call as failable: a thrown error SHALL be caught, logged, and
   SHALL NOT propagate.
2. WHEN any Search_Module call throws during initialisation, THE map
   initialisation SHALL continue with search disabled and SHALL still perform
   the initial data load for the current viewport.
3. THE initial data load SHALL NOT be sequenced behind any Search_Module call in
   a way that a search fault can prevent it.
4. WHEN the Search_Dimension has been registered with the Filter_Engine but the
   Search_Box could not be created, THE Search_Dimension SHALL remain an
   Inactive_Dimension so that it cannot hide markers.
5. THE Filter_Engine, Filter_Panel, and layer toggles SHALL behave identically
   whether search is enabled, disabled, or broken.

### Requirement 3: Response Shape Validation

**User Story:** As a paddler, I want a malfunctioning backend to be reported as a
fault, not disguised as "no spots match", so that I am not shown an empty map
and told it is my query's fault.

#### Acceptance Criteria

1. THE Search_Module SHALL treat a `2xx` response whose parsed body is not an
   array as a failure of the Search_Operation.
2. WHEN a response body is not an array, THE Search_Module SHALL NOT apply the
   No_Match_Sentinel and SHALL NOT hide any marker.
3. THE Search_Module SHALL continue to accept an empty array as a valid,
   successful result meaning "nothing matched", distinct from a shape failure.
4. THE Search_Module SHALL continue to skip individual result entries that carry
   no `slug`, without failing the Search_Operation.
5. THE Search_Module SHALL continue to skip individual `location` values that
   are not a pair of finite numbers, without failing the Search_Operation.

### Requirement 4: Recovery Action On Failure

**User Story:** As a paddler whose search just failed, I want a button that
retries it, because clearing the search is not what I wanted to do.

#### Acceptance Criteria

1. THE Search_Notice SHALL present exactly one action button, whose label and
   behaviour depend on the state being reported.
2. WHEN the Search_Notice reports a no-results state, THE action SHALL clear the
   search and restore every marker.
3. WHEN the Search_Notice reports a failure state, THE action SHALL re-run the
   most recent query as a new Search_Operation.
4. THE Search_Notice SHALL carry an analytics event name that identifies which
   action was offered.
5. WHEN the search input is empty at the moment a retry action is invoked, THE
   Search_Module SHALL hide the Search_Notice and perform no request.
6. THE Search_Notice SHALL remain a single ARIA live region announcing one
   message per state change, as it does today.

### Requirement 5: Rate Limiting Reported Distinctly

**User Story:** As a paddler who typed quickly, I want to be told to wait a
moment rather than told the search is broken.

#### Acceptance Criteria

1. WHEN the Search_API responds `429`, THE Search_Module SHALL report a
   rate-limit-specific message, distinct from the general failure message.
2. WHEN a `429` response carries a `Retry-After` header holding a finite,
   non-negative number of seconds, THE Search_Module SHALL include that wait
   time in the message.
3. WHEN `Retry-After` is absent, unparseable, or implausibly large, THE
   Search_Module SHALL report the rate limit without a specific wait time.
4. THE Search_Module SHALL NOT automatically retry a `429`.
5. A `429` SHALL leave the Search_Dimension as an Inactive_Dimension.

### Requirement 6: Single Retry On Transient Failure

**User Story:** As a paddler, I want a cold backend's first slow request to
recover by itself, so that I do not have to know to press retry.

#### Acceptance Criteria

1. THE Search_Module SHALL make at most two Attempts per Search_Operation.
2. THE Search_Module SHALL retry only a Transient_Failure.
3. THE Search_Module SHALL NOT retry any `4xx` response, including `429` and
   `403`.
4. THE Search_Module SHALL NOT retry after a Supersede_Abort; the superseding
   query owns the outcome.
5. THE Search_Module SHALL delay a retry by approximately 1000 ms.
6. Each Attempt SHALL carry its own independent time budget per Requirement 1.
7. WHILE a Search_Operation is retrying, THE status region SHALL continue to
   report searching and SHALL NOT flash a failure state.
8. WHEN a retry succeeds, THE Search_Module SHALL apply its results normally and
   report no failure.

### Requirement 7: In-Session Result Cache

**User Story:** As a paddler refining a query, I want a repeated search to answer
instantly and without another backend call, so the site stays responsive and
cheap to run.

#### Acceptance Criteria

1. THE Search_Module SHALL cache the parsed results of a successful
   Search_Operation in the Result_Cache, keyed by the exact request URL.
2. THE Search_Module SHALL serve a cache hit without making any Attempt.
3. THE Result_Cache SHALL cache a successful empty result, since it is a valid
   answer.
4. THE Result_Cache SHALL NOT cache any failure.
5. THE Result_Cache SHALL be bounded to at most 50 entries, evicting the oldest
   first.
6. THE Result_Cache SHALL live only for the page load and SHALL NOT be persisted.
7. WHEN serving a cache hit, THE Search_Module SHALL apply the selection and fit
   the map exactly as it does for a fresh result.

### Requirement 8: Failure-Path Test Coverage

**User Story:** As a maintainer, I want the degradation behaviour pinned by
tests, because it is the behaviour nobody exercises by hand.

#### Acceptance Criteria

1. THE test suite SHALL cover a timeout, a network error, a `5xx`, a `429`, a
   non-array `2xx` body, and a Supersede_Abort.
2. THE test suite SHALL assert that a non-array body hides no marker.
3. THE test suite SHALL assert that a Search_Module throw during map
   initialisation does not prevent the initial data load.
4. THE test suite SHALL assert the retry budget: exactly two Attempts on a
   Transient_Failure, exactly one on a `4xx`.
5. THE test suite SHALL assert that a cache hit makes no Attempt.
6. THE test suite SHALL assert that every exported Search_Module function is
   safe to call when search is unconfigured.
7. THE test suite SHALL include property-based coverage asserting that no
   arbitrary `2xx` payload shape can cause markers to be hidden except a genuine
   array of zero results.
8. THE test suite SHALL cover the Search_Disabled_Flag: the full value-parsing
   matrix including an unrecognised value, the derived `site.search_enabled` for
   every combination of flag and endpoint, and that a disabled build renders
   neither the config block nor the script tag.

### Requirement 9: Unconfigured-Safe Public API

**User Story:** As a maintainer, I want every exported function to be safe to
call when search is switched off, so that an unconfigured build cannot be broken
by a caller.

#### Acceptance Criteria

1. Every function exported by the Search_Module SHALL return without throwing
   when the module is unconfigured.
2. `applySelection` SHALL guard on the presence of config before dereferencing
   it, as `getDimensionConfig` already does.
3. `clearSearch` SHALL be safe to call when unconfigured.

### Requirement 10: Preserved Invariants

**User Story:** As a maintainer, I want the properties that already hold to be
pinned, so that this work cannot regress them.

#### Acceptance Criteria

1. THE Search_Module SHALL NOT issue any request to the Search_API before the
   user has entered a query.
2. THE Search_Module SHALL NOT probe the Search_API for availability on page
   load.
3. No failure of any kind SHALL leave the Search_Dimension in a state that hides
   markers.
4. A genuine empty result SHALL continue to apply the No_Match_Sentinel and show
   the no-results Search_Notice.
5. `assets/js/filter-panel.js` and `_sass/components/_filter-panel.scss` SHALL
   NOT be modified by this feature.
6. THE compiled stylesheet SHALL be unchanged by this feature, which requires no
   new CSS.

### Requirement 11: Build-Time Feature Flag

**User Story:** As an operator, I want to switch the search feature off in a
build without discarding its configuration, so that I can remove it from the site
deliberately and reverse that decision without having to recover the endpoint URL.

#### Acceptance Criteria

1. THE build SHALL accept an environment variable `SEARCH_DISABLED` which, when
   set to a recognised true value, disables the search feature entirely.
2. THE build SHALL treat `true`, `1`, and `yes` as true values, compared
   case-insensitively after trimming surrounding whitespace.
3. THE build SHALL treat an absent value, an empty value, `false`, `0`, and `no`
   as not-disabled, compared the same way.
4. WHEN `SEARCH_DISABLED` holds any other value, THE build SHALL treat the
   feature as disabled AND SHALL emit a warning naming the unrecognised value.
5. THE build SHALL expose exactly one derived boolean, `site.search_enabled`,
   true only when an endpoint is configured AND the Search_Disabled_Flag is not
   set. Templates SHALL consume only this boolean.
6. THE Search_Disabled_Flag SHALL take precedence over a configured endpoint.
7. WHEN search is disabled, THE built HTML SHALL contain neither the
   `#semantic-search-config` block nor any `script` tag referencing
   `semantic-search.js`.
8. WHEN search is disabled, THE Search_Dimension SHALL NOT be registered with the
   Filter_Engine and no Search_Box or Search_Notice SHALL be created.
9. WHEN search is disabled, THE `Content-Security-Policy` `connect-src` directive
   SHALL NOT include the search API host, so that the endpoint is unreachable
   from the page even if script were injected.
10. THE deployment template SHALL expose the flag as a parameter restricted to
    `true` and `false`, defaulting to `false`.
11. THE default build — with the flag absent — SHALL behave exactly as it does
    today, so that existing deploys are unaffected.
12. WHEN search is disabled, THE map, markers, Filter_Panel, layer toggles, and
    every other site feature SHALL behave identically to a build with search
    enabled but unused.
13. THE disabled build SHALL be indistinguishable, in rendered output and
    behaviour, from a build with no endpoint configured.
