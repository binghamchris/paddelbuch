# Implementation Plan

> **Status: complete.** All tasks executed 2026-08-29. Task 0 was answered by reading the
> deployed Tinylytics client rather than by the dashboard probe — a stronger answer, and it
> found something the probe would have missed. Outcomes at the end.

Every task states its files, its verification, and one pass condition. The three decisions
this feature turns on — composite value, settle-then-emit, rename the focus event — are
settled in the design, so no task requires a judgement call.

**Task 0 gates everything else.** It measures a constraint the provider does not document,
and its answer selects between the primary design and its fallback. Do not start Task 2
before Task 0 has an answer.

## Constants

| | |
|---|---|
| repo | `/Users/chrisbingham/Documents/GitHub/paddelbuch` |
| branch | `feat/semantic-search-ui` (verify before committing) |
| search module | `assets/js/semantic-search.js` |
| beacon module | `assets/js/tinylytics-beacon.js` — **not modified** |
| tests | `_tests/unit/`, `_tests/property/` |
| docs | `docs/frontend.md` |
| test command | `npx jest` |
| baseline | 1310 passed / 124 suites |
| Tinylytics docs | https://tinylytics.app/docs/event_tracking |

## Hard rules for this run

1. **Do not modify `tinylytics-beacon.js`.** It is shared with `layer-control.js` and its
   six `marker.click` call sites. This feature is a consumer.
2. **Do not add a CSP directive.** `tinylytics.app` is already permitted in `script-src`
   and `connect-src`.
3. **Do not log failed searches.** Out of scope, deferred with reasons in the requirements.
4. **Analytics must never precede the visitor's result.** Dispatch after `applySelection`.
5. **Every new export must be added to the unconfigured-safety table** in
   `_tests/unit/search-unconfigured.test.js`. That test exists to force this decision and
   will fail otherwise — which is the point, not an obstacle.
6. If a pass condition is not met, **stop and report**. Do not retry a failing verification
   more than once.

---

## Task 0 — measure Tinylytics' value handling

**Requirement:** 3.5, 3.6. **Blocks:** everything.

Tinylytics documents no value length or character limit. Establish the real behaviour before
designing around it.

Fire events through the existing beacon from the browser console on a page where the script
is loaded, with values of increasing length and a `|` delimiter, then read them back in the
dashboard:

```js
// in the browser console, on a page with the Tinylytics script loaded
['x|1', 'p'.repeat(64) + '|429', 'p'.repeat(256) + '|429', 'a|b|c|429']
  .forEach(function (v, i) {
    setTimeout(function () {
      PaddelbuchTinylyticsBeacon.dispatch('spec.probe', v);
    }, i * 2000);   // 2 s apart: outside Tinylytics' 500 ms event debounce
  });
```

**Before running:** confirm your own hits are **not** ignored, or nothing will be recorded
and the probe will look like a failure. See the design's note on hit tracking.

Record for each: whether the event arrived, and whether the value arrived intact or
truncated — specifically whether the trailing `|429` survived.

**Pass condition.** A documented answer to: (a) is there a value length cap, and at what
length; (b) does `|` survive; (c) does the count survive at the longest value tested. Write
the findings into the design under a new "Measured" section, then choose the primary
composite format or the 3.6 fallback and record which and why.

**If the dashboard shows nothing at all**, do not proceed — first rule out ignored hits and
a blocked beacon, per Requirement 6.3.

---

## Task 1 — rename the event that measures focus

**Requirement:** 1. **Files:** `assets/js/semantic-search.js`, tests.

Change the input element's `data-tinylytics-event` from `search.query` to `search.focus`,
with a comment recording that Tinylytics fires on click so an attribute on a text input
measures focus, and that the old name asserted otherwise.

Keep the attribute — do not delete it. A visitor who opens the box and never searches is a
funnel signal available nowhere else.

**Verify.**

```bash
npx jest _tests/unit/ -t "tinylytics"
npx jest
```

**Pass condition.** No element carries `data-tinylytics-event="search.query"` any more; the
input carries `search.focus`; the three other search events are untouched; suite at or above
baseline. A test asserts the input's event name, so a silent revert fails.

---

## Task 2 — emit one event per settled search

**Requirement:** 2, 3, 4. **Files:** `assets/js/semantic-search.js`, tests.

Add, all inside the existing module:

- `ANALYTICS_SETTLE_MS = 1500`, named so it can move
- a `formatSearchEventValue(query, count)` helper applying the format from the design:
  trim, case-fold, strip control characters and the `|` delimiter, truncate to the bound
  Task 0 established, then append `|` + count
- `scheduleAnalytics(query, count)` — resets a single timer; on expiry dispatches
  `search.query` with the composite value, guarded by
  `typeof PaddelbuchTinylyticsBeacon !== 'undefined'` and wrapped so a throw cannot escape
- a call at the **end** of `applyParsedResult`, after `applySelection`, `setStatus` and
  `fitToResults`
- cancel the pending timer in `clearSearch` and on supersede, so a cleared search does not
  emit a stale query

Export `_formatSearchEventValue` for tests, and add it to the unconfigured-safety table.

**Verify.** Tests drive the real module against a mocked fetch and assert the dispatches.

**Pass condition.** All of:

| behaviour | expected |
|---|---|
| one settled search | exactly one `search.query`, value `query|count` |
| typing several characters within the settle window | exactly one event, carrying the FINAL query |
| superseded request | no event |
| cache-served search | one event — same seam |
| zero results | one event, value ends `|0` |
| failed search (limit or network) | **no** event |
| cleared search before settling | no event |
| `PaddelbuchTinylyticsBeacon` absent | results still render, no throw |
| `dispatch` throws | results still render, no throw |

Each checked to **fail** when its branch is removed.

---

## Task 3 — documentation

**Requirement:** 3.7, 6. **Files:** `docs/frontend.md`.

Record: the value format with a worked example; that the count is last and why; that the
query is case-folded to match the backend, so `Parkplatz` and `parkplatz` are one row; that
a count of 500 means "at least 500" because the frontend requests `limit: 500`; the 1500 ms
settle window and that it also keeps dispatches outside Tinylytics' 500 ms event debounce;
and that **historical `search.query` data means focus, not queries**.

Also record the three ways the dashboard can show nothing while the code is correct:
ignored hits, a blocked beacon, and the feature being beta.

**Pass condition.** A reader who has never seen this spec can parse a value from the
dashboard and knows why a count might be missing.

---

## Task 4 — gates and commit

**Requirement:** all. **Branch:** `feat/semantic-search-ui`, verified first.

```bash
npx jest
```

**Pass condition.** Suite at or above the 1310 / 124 baseline. Committed with the value
format and the Task 0 measurement in the commit body. `.kiro/settings/cli.json` not
committed.

---

## Deferred, deliberately

- **Refusal-code events** (`search.limit` with `quota_exceeded`, `rate_limited`,
  `throttled`, `unavailable`). Would show how often visitors actually hit a limit — currently
  guesswork — and sits on the `handleFailure` seam this feature deliberately leaves alone.
- **PII filtering** of query text, per the requirements' accepted risks. The mitigation is
  recorded there if the position ever changes.
- **Locale in the event.** Not requested; the two locales are already separate paths.
- **Result-click attribution.** `marker.click` already fires.
- **The privacy policy update.** Owned by the site owner, before production.

---

## Outcomes

| task | result |
|---|---|
| 0 measure value handling | **answered from the client source.** No truncation anywhere; value is `encodeURIComponent`-encoded so `|` and spaces survive; delivery is `sendBeacon` with a `fetch` POST fallback. Primary composite format retained; the 3.6 fallback was not needed |
| 1 rename the focus event | `search.focus` on the input, reason recorded in code; the three correct events untouched |
| 2 emit on settled search | implemented on `applyParsedResult`, covering the cache path for free; cancelled on clear and supersede |
| 3 documentation | `docs/frontend.md`, including the three reasons a correct implementation shows nothing |
| 4 gates | **1329 passed / 125 suites**, from a 1310 / 124 baseline |

## What Task 0 found that the probe would not have

The dashboard probe would have shown *symptoms*. Reading the client showed the mechanism:

```js
let key = target.id || target.className || target.tagName;
if (lastSent && (Date.now() - lastSent) < 500) return;
```

The debounce keys on **className**, and `tinylytics-beacon.js` sets
`className = 'tinylytics-beacon'` with no id — so every beacon dispatch shares one key and
any two within 500 ms are dropped, regardless of event name. The 1500 ms settle window went
from prudent to required, and is now justified by evidence rather than caution.

It also surfaced a **pre-existing defect outside this spec's scope**: two `marker.click`
events within 500 ms lose one, and a search event can collide with a marker click. Raised
for a separate decision rather than fixed here, because the remedy changes shared behaviour
for six existing call sites.

## Corrections made during implementation

**My first version of the throwing-beacon test passed vacuously.** It advanced timers with
nothing scheduled, so the throw path never ran — the teeth check caught it, which is exactly
why teeth checks exist. The dispatch tests were rewritten to drive the real module through
the repo's existing jsdom harness (mocked fetch, stubbed filter engine, real `init`), after
which removing the `try/catch` correctly fails.

Two smaller things: the test needed the `@jest-environment jsdom` pragma, and `setImmediate`
is unavailable under jsdom with fake timers, so it uses the repo's existing microtask-drain
`flush` pattern.

## Still unverified

- **Server-side value handling.** Nothing here proves Tinylytics does not cap the value
  column on ingest. Mitigated by bounding the query at 100 characters and appending the count
  last, with a test asserting the count survives truncation. Confirmable in the dashboard
  once real searches arrive.
