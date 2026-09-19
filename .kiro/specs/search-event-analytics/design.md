# Design Document

## Measured

Task 0's questions were answered by reading the deployed client script rather than by
probing the dashboard — a stronger answer, because it shows the mechanism instead of its
symptoms. Fetched from the live embed URL (it returns an empty body without a browser
`User-Agent` and a site `Referer`, which is worth knowing before anyone concludes the script
is missing).

**No truncation anywhere in the client.** No `substring`, `substr`, `slice`, `maxLength` or
length comparison appears in the script. The value is sent whole:

```js
let eventHitUrl = `${collect_url}?url=${current_url}&path=${path}&referrer=${referrer}
  &event=${encodeURIComponent(eventName)}&event_value=${encodeURIComponent(eventValue)}`;
```

**The value is `encodeURIComponent`-encoded**, which settles the delimiter question: `|`
becomes `%7C` and survives, as do spaces and umlauts. A query like `ruhiger See zum Paddeln`
transports intact. Had it been unencoded, spaces alone would have broken the request.

**Delivery is `navigator.sendBeacon` with a `fetch` POST fallback**, both against a URL, so
only server-side URL limits apply — orders of magnitude above anything this feature sends.

Server-side value handling remains unverified: nothing here proves Tinylytics does not cap
the column on ingest. The query is therefore bounded at **100 characters** — comfortably
above any real query, and the count is appended *after* the truncation so a server-side cap
would eat query text before it reached the count. The tests assert the count's position.

### The debounce keys on className, and every beacon dispatch collides

The single most consequential finding, and it is not in the documentation:

```js
let key = target.id || target.className || target.tagName;
let lastSent = debounceMap.get(key);
if (lastSent && (Date.now() - lastSent) < 500) return;
```

`tinylytics-beacon.js` sets `beacon.className = 'tinylytics-beacon'` and no `id`. So **every
dispatch through the beacon shares the debounce key `'tinylytics-beacon'`**, and any two
within 500 ms are dropped — *irrespective of event name*.

This converts the 1500 ms settle window from prudence into a requirement, and it is now
known rather than assumed.

It also has two consequences beyond this feature, recorded because they are pre-existing and
outside this spec's scope:

- Two `marker.click` events within 500 ms lose one. A visitor clicking two markers quickly
  is already undercounted.
- A `search.query` and a `marker.click` within 500 ms collide with each other, because they
  share the className rather than differing by name.

The fix would be to give the beacon element a unique `id` per dispatch, making the key
unique and disabling a debounce that exists to absorb human double-clicks — which a
programmatic caller does not produce. That changes shared behaviour for six existing call
sites, so it is raised as a separate decision rather than made here.

## Overview

One Tinylytics event per completed search, carrying the query and the result count in a
single value. Three things make this less trivial than it sounds, and each is settled below
rather than left to implementation:

1. Tinylytics events carry **one** value, and this feature has two facts to record.
2. Tinylytics **debounces events at 500 ms**, and the search debounce is **350 ms** — so the
   naive "log every search" design can lose events silently.
3. The existing `search.query` event does not measure queries. It measures focus.

## What already exists, and what that buys

`assets/js/tinylytics-beacon.js` is the whole transport: 43 lines that create a hidden
`div` carrying `data-tinylytics-event` and `data-tinylytics-event-value`, fire a synthetic
click on it, and remove it. It exists because Tinylytics listens only for clicks, and a
Leaflet marker click never reaches popup content. A search is not a click either, so this
feature reuses it unchanged — no new module, no new transport, no CSP change.

`layer-control.js` calls it six times, always guarded:

```js
if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
  PaddelbuchTinylyticsBeacon.dispatch('marker.click', spot.slug || '');
}
```

This feature follows that pattern exactly. Consistency here is worth more than elegance:
the guard is what keeps search working when an ad blocker removes the analytics script.

## Decision 1: one event, composite value

Rejected alternatives and why:

**Two events per search.** Tinylytics exposes no session, request or visitor identifier in
the event payload, so `search.query` and `search.results` arriving from the same visitor
cannot be joined. The single most valuable question — *which queries return nothing* —
becomes unanswerable. This is not a limitation of the dashboard but of the data.

**Band encoded in the event name.** `search.query.none` has three segments, and Tinylytics
documents names as `category.action`. It also multiplies event names on a dashboard whose
Custom Events view plots a Top-N of *names*, so a handful of bands crowds out every other
event on the site.

**Chosen: `search.query` with a composite value.**

```
search.query  →  "parkplatz|429"
                  ^query     ^count
```

The pair stays atomic, so nothing needs correlating. Format:

| element | rule | why |
|---|---|---|
| delimiter | `|` | cannot occur in a query after sanitisation, and is readable in the dashboard's value list |
| query | trimmed, case-folded, control characters and `|` removed, truncated to a bound | see below |
| count | integer, as displayed to the visitor | so analytics and UI can never disagree |

**Case-folding matches the backend.** The backend case-folds before embedding, precisely so
capitalisation cannot change results — `parkplatz` and `Parkplatz` return the same set.
Logging them as distinct values would split one intent across two rows and make the top-queries
list wrong. Folding here keeps the analytics aligned with what the backend actually treats as
one query.

**The truncation bound is measured, not assumed.** Tinylytics' documentation is silent on
value length. Silence is not permission: if values are capped server-side, a composite could
arrive with the count sheared off, and `"a very long query that got cut"` looks like data
rather than corruption. Task 0 measures the real bound; the design fixes the *shape*, and the
number comes from measurement. Putting the count **last** is deliberate — it is the field a
truncation would destroy, so the tests assert it survives.

## Decision 2: emit on a settled query, not on every search

The search input debounces at 350 ms. Typing `parkplatz` with one natural pause runs two
searches, `park` and `parkplatz`. Logging each would record a prefix nobody meant to search
and inflate volume against a denominator that does not exist.

Tinylytics adds a second, independent reason. It debounces events at **500 ms** — longer
than the search debounce. Two searches in quick succession can therefore fall inside its
window, and an event dropped there is dropped with no signal at all: no error, no console
warning, simply a gap. Whether it keys on element identity or on event name is undocumented,
and the beacon creates a fresh element per dispatch, so it may well not apply. Designing as
if it does not would be betting on an unstated implementation detail of a beta feature.

**Settled_Query definition.** A search is settled when its results have been applied *and*
no newer input has arrived for `ANALYTICS_SETTLE_MS` (1500 ms). One timer, reset by each
new search; the dispatch happens when it expires, using the query and count of the search
that was last applied.

Consequences, stated so they are choices rather than surprises:

- **Minimum 1500 ms between dispatches**, comfortably outside Tinylytics' 500 ms window. The
  500 ms problem is solved as a by-product rather than by a second mechanism.
- **A visitor who types and immediately navigates away is not counted.** Accepted: the
  alternative is counting prefixes, and a search abandoned inside 1.5 s is weak evidence of
  intent anyway.
- **Intermediate queries are never logged**, which is the point.
- 1500 ms is a judgement, not a measurement. It is a named constant so it can move.

## Decision 3: rename the event that lies

`semantic-search.js` sets `data-tinylytics-event="search.query"` on the search **input**,
with no value. Tinylytics fires on click, so it records a visitor clicking into the box.

It becomes `search.focus`, and is **kept**: a visitor who opens the search box and never
searches is a real funnel signal, and this is the only place it is observable. Comparing
`search.focus` against the new `search.query` gives an engagement rate that neither provides
alone.

**Historical `search.query` data means focus, not queries, and the two are not comparable.**
That fact belongs in the frontend docs, because the dashboard will show one continuous series
across the rename.

## Where the hooks go

The module already has the seams; no restructuring is needed.

```
runSearch → fetch → applyParsedResult(parsed)     ← success, incl. zero results
                  ↘ handleFailure(...)             ← failures: NOT logged
         → cache hit → applyParsedResult(parsed)   ← same seam, so cache is covered free
```

`applyParsedResult` is the single point where a result set becomes the visitor's reality,
for both the network and cache paths. Hooking it satisfies Requirement 2.2 without a second
call site — and hooking the fetch path instead would have undercounted exactly the popular
queries most likely to be cached.

Superseded requests never reach it: the promise chain returns early on `record.superseded`.
So Requirement 2.3 needs no new logic, only a test proving it stays true.

Failures are deliberately not logged. No results were returned, so there is no count; a
refusal is not a search outcome. Logging refusal codes is worthwhile and is deferred with
its rationale in the requirements.

## Failure containment

Analytics runs **after** the visitor's outcome is applied, and inside a guard:

```js
applySelection(parsed.slugs);      // the visitor's result, first
setStatus(formatCount(...));
fitToResults();
scheduleAnalytics(query, count);   // then, and it cannot throw outward
```

`scheduleAnalytics` checks for the module and wraps the dispatch, so an absent, broken or
ad-blocker-mangled `PaddelbuchTinylyticsBeacon` cannot prevent results from rendering. The
tests cover both the absent case and a `dispatch` that throws, because a guard that only
handles absence is the more common half of this bug.

## What this design does not change

- No new network request. The beacon's cost is one synthetic DOM click.
- No CSP change. `tinylytics.app` is already in `script-src` and `connect-src`; adding a
  directive would imply a requirement that does not exist.
- No change to the search request, the backend, or ranking. This is observation only.
- No new i18n strings. Nothing here is user-visible.
- The three correct existing events — `search.clear`, `search.clear-from-notice`,
  `search.retry-from-notice` — are untouched.

## Why the dashboard may show nothing when the code is right

Recorded here because it will otherwise be diagnosed as a bug.

**Events do not fire when hit tracking is disabled**, including via the site's settings or
`?ignore`. Tinylytics states this explicitly. The owner who has ignored their own hits will
see no events while testing perfectly good code — which is the single most likely way this
feature gets wrongly declared broken.

**Beacon delivery can be blocked.** `navigator.sendBeacon` is blocked by some privacy
browsers and ad blockers, so counts are a floor, not a total. The site's existing events
already have this property; search inherits it.

**The feature is beta** and documented as subject to change, so the value format is a
contract with something that may move.

## Risks

| risk | mitigation |
|---|---|
| Tinylytics caps value length and shears off the count | Task 0 measures it before anything is built; count goes last so truncation is what the tests target |
| the 500 ms event debounce drops events anyway | the 1500 ms settle window keeps dispatches outside it by construction, not by luck |
| query cardinality grows without bound | accepted and recorded in the requirements; case-folding removes the largest avoidable source of duplication |
| a count of 500 is a cap, not a total | the frontend requests `limit: 500`; the design logs what the UI showed, and the docs record that 500 means "at least" |
| the rename breaks a saved dashboard view | unavoidable and worth it; documented so the discontinuity is explicable |
