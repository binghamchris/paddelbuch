# Design Document

## Overview

Ten requirements, but only three files carry real change:
`assets/js/semantic-search.js` (most of it), `assets/js/map-data-init.js` (a
try/catch), and the config plus i18n that feed them. No new CSS, no change to the
filter panel, no backend change — the Search_API already returns `503` rather than
hanging when Bedrock or DynamoDB is unavailable, and `429` with `Retry-After` when
rate-limited.

The work divides into two unrelated kinds. Requirements 2, 3, 9, and 10 are
**containment**: making sure a search fault cannot reach anything else, and cannot
disguise itself as a legitimate empty result. Requirements 1, 4, 5, 6, and 7 are
**recovery**: giving a fault a bounded lifetime and a way out. Containment is the
part that matters; recovery is the part users notice.

## The abort ambiguity, which drives the whole timeout design

The existing catch treats every `AbortError` as a non-event:

```js
if (err && err.name === 'AbortError') {
  return;   // the user typed again; the newer request owns the outcome
}
```

That is correct today, because the only thing that aborts a request is a newer
query superseding it. A timeout introduces a **second** cause with the opposite
meaning: a Supersede_Abort must stay silent, a Timeout_Abort must be reported.
Arming the existing `AbortController` with a `setTimeout` and nothing else would
make every timeout silent — leaving the UI reading "Suche läuft…" forever, which
is the exact failure the timeout was added to prevent. It would also pass its own
tests if those tests only asserted that abort is silent.

So the abort reason has to be carried explicitly. The design replaces the two
loose module variables (`activeController`, and the implicit "is this the newest
request" assumption) with one **request record** per Search_Operation:

```js
// Shape, not final code.
{
  controller: AbortController | null,
  timer: number | null,
  timedOut: false,      // set by the timeout before it calls abort()
  superseded: false,    // set by abortInFlight() before it calls abort()
  query: string,
  attempt: 1 | 2
}
```

The record is captured in the promise closure, so a settling request always reads
*its own* state rather than whatever is current by then — which matters because a
slow first request can settle after a second has started. The catch then reads:

- `record.superseded` → return silently, and do not retry (Requirement 6.4).
- `record.timedOut` → a Transient_Failure: retry if budget remains, else report
  the timeout message.
- neither → a real network or HTTP error: classify and handle.

`abortInFlight()` sets `superseded = true`, clears `timer`, then aborts. The
timeout handler sets `timedOut = true`, then aborts. Every exit path clears the
timer, which is what Requirement 1.5 is really asking for.

This is also why Requirement 8.1 lists a Supersede_Abort as a test case
alongside the failures: the two abort causes sharing one mechanism is the single
most likely place for this work to regress.

## Failure classification

One function turns an outcome into a decision, so the policy lives in one place
rather than being spread across the promise chain:

| Outcome | Retryable | Message | Dimension |
|---|---|---|---|
| Supersede_Abort | no | none | untouched (newer request owns it) |
| Timeout_Abort | yes | timeout | Inactive |
| Network error (`fetch` rejects) | yes | general failure | Inactive |
| `5xx` | yes | general failure | Inactive |
| `429` | **no** | rate limit, with wait if known | Inactive |
| Other `4xx` | no | general failure | Inactive |
| `2xx`, body not an array | no | general failure | Inactive |
| `2xx`, array, length 0 | n/a | no-results | **Active** via No_Match_Sentinel |
| `2xx`, array, length > 0 | n/a | result count | Active with slugs |

Two rows carry the load. `429` is not retried because retrying a rate limit is
what caused it (Requirement 6.3); the user is told to wait instead. And a `2xx`
with a non-array body is a **failure**, not an empty result — the row above it in
the table. Today both produce zero slugs and the caller cannot tell them apart:

```js
if (!payload || typeof payload.length !== 'number') {
  return { slugs: [], locations: [] };   // indistinguishable from []
}
```

Zero slugs then applies the No_Match_Sentinel, so a backend returning `{}` with a
`200` would hide **every marker** and blame the user's query. Low probability — a
4xx/5xx or a non-JSON body already routes to the error path — but the appearance
is a broken site, so `Array.isArray` decides it and a non-array throws into the
failure path.

`parseResults` keeps tolerating bad *entries* (Requirements 3.4, 3.5). Only the
top-level shape becomes strict: one malformed spot should not lose the other 400.

## Retry policy

Two Attempts maximum, ~1000 ms apart, only for a Transient_Failure. The value of
this is narrow and specific: the most likely real-world "unavailable" is a cold
Lambda plus a Bedrock embedding call on the first search of a session. A single
retry converts most of those into a successful search with no user action.

Each Attempt gets its own independent timeout (Requirement 6.6) rather than
sharing one budget across the operation, because a shared budget would give the
retry whatever the first attempt left over — often nothing, making the retry
pointless.

The status region keeps reading "searching" across the retry (Requirement 6.7).
Flashing a failure and then a result would be worse than either outcome alone.

**On cost:** retry adds at most one request per failure, which is negligible. But
it is worth recording plainly that neither the timeout nor the abort saves any
backend cost — aborting client-side does not stop the Lambda, which runs to
completion and bills regardless. Only the Result_Cache reduces cost.

## Result_Cache

Keyed by the **full request URL** from `buildUrl(query)`. That is not a shortcut:
the URL already encodes every input that changes the answer — `q`, `locale`,
`limit`, `fields`, and `minScore` — so it cannot collide across locales or
projections, and it cannot go stale against a config change without also changing
the key.

Bounded at 50 entries, oldest evicted first, to keep a long session with many
distinct queries from growing without limit. Successes only, including empty
results (Requirement 7.3): "nothing matches" is a real answer and re-asking the
backend for it is the same waste as re-asking for a hit.

Known and accepted staleness: if the index gains a spot mid-session, a query
already run in that session keeps its cached answer until reload. Contentful syncs
are infrequent, the cache dies with the page, and the alternative — a TTL or
revalidation — costs the request the cache exists to avoid.

## Search_Notice action

The notice already has exactly one button, created once at build time with the
clear-search label. Requirement 4 makes the label and behaviour depend on the
state, so `showNotice` gains an action argument:

```js
showNotice(title, hint, { label, event, onClick })
```

The button keeps **one permanently attached** listener that dispatches to the
current action, rather than add/removeEventListener per state change. Swapping
listeners is how duplicate-handler bugs happen, and a single dispatch point also
keeps the button a single stable focus target across state changes
(Requirement 4.6).

The retry action re-runs the last query through the normal path, including a fresh
retry budget. If the input has been emptied in the meantime the notice just hides
(Requirement 4.5) — re-running a query the user has abandoned would be worse than
doing nothing.

## Initialisation isolation

The current wiring in `map-data-init.js` runs the two search calls inline, with
the initial data load *after* them and nothing in between:

```js
if (searchEnabled) {
  engineDimensions.push(window.PaddelbuchSemanticSearch.getDimensionConfig());
}
PaddelbuchFilterEngine.init(engineDimensions, map);
PaddelbuchFilterPanel.init(map, dimensionConfigs, layerToggles);
if (searchEnabled) {
  window.PaddelbuchSemanticSearch.createControl(map);
}
// ... initial data load happens here
```

Nothing throws today. That is not the point: if either call ever did, the data
load below it would never run and the map would have **no markers at all** — the
whole map lost to a search fault. Both call sites get a try/catch that logs, sets
`searchEnabled = false`, and continues.

The half-initialised case is worth being explicit about, because it is the one
that could still hide markers: if `getDimensionConfig()` succeeded and was
registered but `createControl` then threw, the Search_Dimension stays registered
with an empty selection. An empty selection is an Inactive_Dimension, which the
engine skips — so it hides nothing (Requirement 2.4). That is the existing
engine semantics doing the right thing by default, and Requirement 8.3 pins it
rather than trusting it.

## Unconfigured-safe exports

`applySelection` dereferences `config.dimensionKey` with no guard, so calling the
exported `clearSearch()` on an unconfigured build throws. `getDimensionConfig`
already shows the intended pattern (`(config && config.dimensionKey)`). The fix is
a guard in `applySelection`, and a test that walks every exported function in the
unconfigured state (Requirement 8.6) so a future export cannot reintroduce it.

## Configuration and strings

New config key in `#semantic-search-config`:

| Key | Default | Purpose |
|---|---|---|
| `timeoutMs` | `10000` | Per-Attempt time budget |

Coerced through a positive-finite variant of the existing `numberOr`, so a
nonsense value falls back rather than disabling the timeout. Retry count, retry
delay, and cache size stay as module constants: they encode a policy rather than
a deployment choice, and exposing them would invite tuning without measurement.

New i18n keys, both locales, per the i18n steering:

| Key | Purpose |
|---|---|
| `search.timeout` | Timeout title |
| `search.timeout_hint` | Timeout next step |
| `search.rate_limited` | Rate-limit title |
| `search.rate_limited_hint` | Rate-limit next step, with `{seconds}` |
| `search.rate_limited_hint_generic` | Same, when `Retry-After` is unknown |
| `search.retry_label` | The retry action button |

`{seconds}` interpolates like the existing `{count}` in `results_many`. Key parity
across locales is already enforced by `spec/i18n_key_parity_spec.rb`.

## Testing Strategy

Unit tests in `_tests/unit/search-resilience.test.js`, jsdom, with `global.fetch`
mocked and Jest fake timers for the timeout and retry delay:

- Timeout fires → failure reported, dimension Inactive, status not left searching.
- Supersede_Abort → silent, no status clobber, **no retry**.
- Non-array `2xx` → failure path, and **no marker hidden**.
- Empty array → no-results notice and No_Match_Sentinel, still.
- `429` → rate-limit message, exactly one Attempt.
- `429` with and without a usable `Retry-After`.
- `5xx` and network error → exactly two Attempts, then failure.
- Retry succeeds → results applied, no failure shown, no failure flash.
- Cache hit → zero Attempts, selection and fit still applied.
- Cache bound → 51st distinct query evicts the first.
- Every export callable when unconfigured.

Property tests in `_tests/property/search-payload-robustness.property.test.js`
with fast-check, per the testing steering's requirement that new JS logic carries
property coverage:

- For arbitrary JSON values, a `2xx` body hides markers **only** when it is a
  genuine array of length zero. This is the generalisation of the `Array.isArray`
  fix, and the one assertion that would catch a future "helpful" coercion.
- Cache keys differ whenever any of `q`, `locale`, `limit`, `fields`, or
  `minScore` differ.

Map wiring needs a new file, `_tests/unit/map-data-init-isolation.test.js`, and
this is the one task in the plan with a cost that is not obvious from the
requirement. `assets/js/map-data-init.js` is currently covered only by property
tests that **read its source text** — `map-layers-data-init.property.test.js` and
`map-layers-preservation.property.test.js` assert on the source, they never
execute it. Nothing in the suite runs the module.

Asserting Requirement 2 properly means executing it, which means standing up
mocks for everything it touches on the way to the data load:
`PaddelbuchMap`, `PaddelbuchFilterEngine`, `PaddelbuchFilterPanel`,
`PaddelbuchMarkerRegistry`, `PaddelbuchSpatialUtils`, `PaddelbuchDataLoader`,
`PaddelbuchZoomLayerManager`, and a Leaflet stand-in. That harness is a one-off
cost worth paying, because Requirement 2 is the highest-severity requirement here
and the alternative is a regex over the source asserting the calls sit inside a
try/catch — which would pass while the behaviour was broken and break while the
behaviour was fine. A source-shape assertion is not evidence that the data load
survives.

Existing suites must stay green unchanged — 118 suites, 1190 tests — with the
compiled-CSS baseline untouched, since this feature adds no CSS.

## Out of Scope

- **A load-time health probe.** Rejected on both cost and correctness: it adds a
  request to every page view against a small operational budget, and it can be
  wrong in both directions — a transient failure would hide a working search box,
  and a passing probe does not make the next call succeed. Lazy failure with a
  clear message and a working retry is cheaper and more accurate.
- **Offline detection** via `navigator.onLine`, and a persistent degraded state
  that disables the input after repeated failures. Both are reasonable and both
  are additions to the reviewed set rather than part of it.
- **Backend changes.** The Search_API already returns `503` and `429`
  appropriately.
- **Persisting the cache** across page loads.
