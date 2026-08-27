# Design Document

## Overview

Eleven requirements. The runtime work touches three files —
`assets/js/semantic-search.js` (most of it), `assets/js/map-data-init.js` (a
try/catch), and the config plus i18n that feed them. The build-time feature flag
(Requirement 11) adds two more: `_plugins/env_loader.rb` and
`deploy/frontend-deploy.yaml`. No new CSS, no change to the filter panel, and no
backend change — the Search_API already returns `503` rather than hanging when
Bedrock or DynamoDB is unavailable, and `429` with `Retry-After` when
rate-limited.

The work divides into three unrelated kinds. Requirements 2, 3, 9, and 10 are
**containment**: making sure a search fault cannot reach anything else, and cannot
disguise itself as a legitimate empty result. Requirements 1, 4, 5, 6, and 7 are
**recovery**: giving a fault a bounded lifetime and a way out. Requirement 11 is
**withdrawal**: removing the feature deliberately rather than reacting to it
failing. Containment is the part that matters; recovery is the part users notice;
withdrawal is the part that makes shipping the other two safe.

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

## The build-time feature flag

### Why the flag is negative, and why that is not a style slip

`SEARCH_DISABLED=true` turns the feature off. A positive `SEARCH_ENABLED` was
considered and rejected, for one decisive reason and one supporting one.

The decisive reason is **what the variable's absence must mean.** Absence has to
mean "behave exactly as today", which is search on wherever an endpoint is
configured. Only a negative flag gives that: adding it to the codebase changes no
existing build. A positive `SEARCH_ENABLED` would make absence mean off, so the
next deploy of every existing environment would silently ship a site with no
search until somebody remembered to set it — a breaking change disguised as a
feature addition, and one that fails quietly.

The supporting reason is that **the endpoint already is the opt-in.** Search
cannot appear unless `SEARCH_API_ENDPOINT` is deliberately configured, so a
positive flag would duplicate an opt-in that already exists and turn switching
search on into a two-key AND — with a silent no-search whenever one of the two is
forgotten. There is no accidental-enablement risk for the positive flag to guard
against: nobody configures a live API endpoint by accident. The distinct job left
for a flag is the override — "configured, but off" — and that job is inherently
negative.

The one real cost of a negative flag is the double negative at the point of use.
The design removes it: the flag is parsed once and collapsed into a single
**positive** derived boolean, so `unless disabled` appears exactly once in the
codebase and every consumer reads `if search_enabled`.

Named `SEARCH_DISABLED` rather than `DISABLE_SEARCH` so it groups with the
existing `SEARCH_API_ENDPOINT` and `SEARCH_API_KEY` in the `KNOWN_KEYS`
allowlist and in the Amplify console's variable list.

### Value parsing, and which way an unrecognised value fails

Trimmed and compared case-insensitively. `true`, `1`, `yes` disable; absent, `""`,
`false`, `0`, `no` do not.

Anything else — `ture`, `on`, `disabled` — **disables, with a build warning naming
the value.** This asymmetry is deliberate and is the one judgement call in the
requirement worth defending. An operator who types a value into a kill switch
intended to use it; resolving their typo to "feature stays on" would defeat the
switch silently, at exactly the moment they were trying to intervene. Resolving it
to "off" is visible, non-destructive, reversible, and accompanied by a warning in
the build log that says why. Fail-to-off is right for a switch whose purpose is
to stop something.

The opposite policy — treating any non-empty value as disabling — was rejected
because it would make `SEARCH_DISABLED=false` disable search, which is worse than
either alternative.

### One derived boolean

`_plugins/env_loader.rb` computes:

```ruby
site.config['search_enabled'] = endpoint_present && !disabled
```

Templates consume only `site.search_enabled`. The endpoint value itself remains in
config for the config block to render, but no template makes a decision from it.

This matters for testability as much as for clarity. Liquid truthiness is awkward
and Liquid is not unit-testable in this repo, whereas `spec/env_loader_spec.rb`
already drives the plugin's `after_init` hook against a mocked site and asserts
`site.config` mappings. Putting the logic in Ruby means the whole decision matrix
is covered by fast unit tests, and the Liquid layer reduces to a single
`{% if site.search_enabled %}` with nothing to get wrong.

Note that `spec/env_loader_spec.rb` currently asserts nothing about the search
keys at all — the existing mapping is untested. Task 1 covers the new flag and the
two existing search keys together, since they are one decision now.

### The CSP follows the flag

Requirement 11.9 asks that a disabled build not merely hide search but be unable
to reach it. `deploy/frontend-deploy.yaml` gains a `SearchDisabled` parameter
(`AllowedValues: [true, false]`, default `false`) and a matching CloudFormation
condition, so the CSP host interpolation becomes conditional:

```yaml
connect-src 'self' tiles.openfreemap.org https://tinylytics.app
  !If [IsSearchDisabled, "", !Ref SearchApiCspHost]
```

With the flag on, the browser refuses a connection to the search host even if
script were injected into the page. That turns the flag from a UI toggle into
defence in depth, and it costs one condition.

Restricting the parameter to `true`/`false` also means the ambiguous-value path
above is unreachable from a CloudFormation deploy; it exists for local builds and
for anyone setting the variable by another route.

### Testing the disabled build

The assertion that matters is Requirement 11.7: a disabled build emits neither the
config block nor the script tag. Two vehicles exist, in preference order.

**Preferred — render the Liquid directly.** `spec/notice_page_fixes_spec.rb` and
`spec/notice_preservation_spec.rb` already do this with
`Liquid::Template.parse(...).render(context)`. Rendering `_includes/map-init.html`
this way needs the `{% t %}` i18n tag and the `relative_url` filter registered or
stubbed, since neither exists in a bare Liquid context. Measured on the current
file that is 10 `{% t %}` tags and 11 `relative_url` uses — enough that the
stubbing is the actual work in this task, and the reason to check it before
assuming the pattern drops in.

**Fallback — assert against built output** in `spec/integration_spec.rb`, which
already builds the site into a temporary `_site`. Slower, but no stubbing, and it
tests the real pipeline rather than a reconstruction of it. If the stub burden
above turns out to be brittle, prefer this: the assertion is about what the build
emits, and this vehicle answers exactly that question.

Either way the coverage is local-only. `amplify.yml` runs `npm test` but no
RSpec, so a Ruby-side regression in the flag would not be caught by a deploy —
which is why task 12.2 calls for running RSpec before pushing, and task 12.5 for
one real deploy with the flag on.

**Explicitly rejected — a regex over `map-init.html`'s source** asserting the tags
sit inside a conditional. It would pass while the behaviour was broken and break
while the behaviour was fine, for the same reason it was rejected for
Requirement 2.

### What the flag does not remove

The compiled stylesheet keeps the `.search-box*` and `.map-search-notice*` rules,
roughly 1 KB, because `_sass` is not conditional. Making it conditional would
require Liquid in `assets/css/application.scss` and would make the byte-exact
baseline fixture in `_tests/fixtures/application.baseline.css` conditional too —
the test would have to know which build it was checking. That is a poor trade for
1 KB of dead CSS, so the flag's guarantee is scoped to "not shown and not
reachable", not "not present in any asset". The i18n keys likewise remain.

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
- **Excluding the search CSS and i18n keys from a disabled build.** Reasoned
  above: ~1 KB of dead CSS against a conditional byte-exact baseline fixture.
- **Backend changes.** The Search_API already returns `503` and `429`
  appropriately.
- **Persisting the cache** across page loads.
- **A runtime kill switch.** Requirement 11 is build-time. Turning search off
  without a rebuild would need the flag served as data the page fetches, which
  reintroduces the load-time request this design rejects.
