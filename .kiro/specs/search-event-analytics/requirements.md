# Requirements Document

## Introduction

Log each search a visitor performs to Tinylytics: the query they entered, and how many
results came back. Nothing else — not the result content, not the spots they went on to
open, which `marker.click` already covers.

The legal position is settled by the site owner: Tinylytics is GDPR-compliant, queries
carry no link to a person, and the privacy policy will be updated to describe search
logging before production deployment. This document therefore treats query text as
loggable and does not re-argue it. §Accepted risks records what that decision covers so a
future reader can see it was a decision rather than an oversight.

Established by reading the code before writing this:

| fact | value | consequence |
|---|---|---|
| Tinylytics dispatch | attribute-based, fires on **click** only | a search is not a click, so events must go through the beacon module |
| beacon module | `PaddelbuchTinylyticsBeacon.dispatch(name, value)` | already exists, 43 lines, used in 6 places by `layer-control.js` |
| script flags | `min.js?events&beacon` | events are already enabled; no loader change needed |
| event shape | one **name** + one **value** | two facts per search do not fit natively — see the decision below |
| naming convention | `category.action` | from the tinylytics-event-tracking spec |
| CSP | `tinylytics.app` already in `script-src` and `connect-src` | no CSP change; adding one would be a mistake |
| existing search events | `search.query`, `search.clear`, `search.clear-from-notice`, `search.retry-from-notice` | three are correct; one is not — see Requirement 1 |
| result count shown to the user | `parsed.slugs.length` via `formatCount` | the count to log is the one the UI already displays |
| frontend request limit | `limit: 500` | a count of 500 may be a cap rather than a total |

And from Tinylytics' own event-tracking documentation, which changes the design rather than
merely confirming it:

| fact | consequence |
|---|---|
| **the script debounces events at 500 ms** — "if a user clicks the same element multiple times rapidly, only one event will be recorded every 500 milliseconds" | the search debounce is **350 ms**, which is SHORTER. Consecutive searches can fall inside Tinylytics' window and be silently dropped. Whether it keys on element identity or event name is undocumented, and the Beacon_Module creates a fresh element per dispatch, so it may not apply — but designing as though it does not would be betting on an unstated implementation detail |
| event names **must** be `category.action` | a three-segment name such as `search.query.none` is outside the documented format |
| no value length or character limit is documented | the docs are silent, so a bound must still be measured rather than assumed absent |
| **events do not fire when hit tracking is disabled**, including via `?ignore` or site settings | the site owner who has ignored their own hits will see NOTHING while testing, and will reasonably read that as a broken implementation |
| beacon mode uses `navigator.sendBeacon` and "may be blocked by some privacy-focused browsers (like Brave) or ad-blocking extensions" | counts are a floor, not a total. This is already true of the existing events |
| the feature is **BETA** and "may be subject to changes" | the value format is a contract with something that may move |

### The defect this feature must resolve first

`semantic-search.js` sets `data-tinylytics-event="search.query"` on the **input element**,
with no value attribute. Tinylytics fires on click, so that event records *a visitor
clicking into the search box* — not a query, and not which query.

The name asserts something the metric does not measure. Any historical `search.query`
data is a focus count. Adding a real query event beside it without resolving this would
leave two same-named-in-spirit metrics measuring different things, which is worse than
either alone.

### The decision this feature turns on

A Tinylytics event carries **one** value, and the feature needs two facts per search.
Three shapes were considered:

| option | consequence |
|---|---|
| two events per search — `search.query` + `search.results` | **rejected**: Tinylytics exposes no session or request identifier, so the two cannot be reliably joined. "Which queries return nothing" — the most valuable question here — becomes unanswerable |
| encode the count band in the event **name** (`search.query.zero`) | **rejected**: loses the exact count, and multiplies event names against a dashboard that plots a Top-N of names |
| one event, **composite value** carrying both | **chosen**, subject to verification |

**Chosen: one event whose value carries the query and the count together.** It keeps the
pair atomic, so no correlation is required.

That choice depends on a constraint nobody has verified: **what Tinylytics accepts as an
event value.** No public documentation for its event value limits could be found. If
values are length-capped, a composite could silently lose the count — the failure mode
being plausible-looking data that is wrong. Task 0 therefore measures the constraint
before any of this is built, and Requirement 3 names the fallback if the measurement
rules the composite out.

---

## Glossary

- **Beacon_Module** — `assets/js/tinylytics-beacon.js`, exposing `dispatch(name, value)`
- **Search_Event** — the Tinylytics event recording one completed search
- **Settled_Query** — a query the visitor has stopped editing, as opposed to an
  intermediate state produced by the debounce
- **Result_Count** — the number of results the UI reported for that query
- **Composite_Value** — a single Tinylytics event value carrying query and count together

---

## Requirement 1: the misleading focus event must be resolved

**User story.** As the site owner reading analytics, I want an event named for what it
measures, so `search.query` means a search happened.

### Acceptance criteria

1.1 The `data-tinylytics-event` on the search **input element** SHALL be renamed to
`search.focus`.

1.2 The reason SHALL be recorded in the code: Tinylytics fires on click, so an event on a
text input measures focus, and the previous name asserted otherwise.

1.3 `search.focus` SHALL be retained rather than deleted. A visitor who opens the search
box and never searches is a real funnel signal, and it is the only place that is
observable.

1.4 The name `search.query` SHALL be reused for the real Search_Event, and the design
SHALL note that historical `search.query` data means focus and is not comparable.

---

## Requirement 2: every completed search must be logged once

**User story.** As the site owner, I want one event per search a visitor actually made —
not per keystroke, and not per intermediate query the debounce happened to run.

### Acceptance criteria

2.1 A Search_Event SHALL be emitted when a search completes and its results are applied.

2.2 It SHALL be emitted for a **cache-served** search as well as a network one. The
visitor performed a search either way; hooking only the network path would undercount and
would bias the data against popular queries, which are the ones most likely to be cached.

2.3 It SHALL NOT be emitted for a **superseded** request. The existing code already
identifies these; a superseded request's query was never the visitor's final intent.

2.4 It SHALL NOT be emitted per keystroke, for two independent reasons.

**Data quality.** With a 350 ms debounce, typing `parkplatz` with one pause produces two
searches — `park` and `parkplatz` — so naive per-search logging records prefixes and
inflates volume.

**Silent loss.** Tinylytics debounces events at **500 ms**, longer than the search
debounce, so two searches in quick succession can fall inside its window. Events dropped
there are dropped without any signal. Emitting at Settled_Query rather than per search
keeps dispatches comfortably outside that window as a consequence rather than by luck.

The design SHALL define how a Settled_Query is identified, and SHALL state the minimum
interval this guarantees between dispatches.

2.5 A zero-result search SHALL be logged like any other. It is the highest-value case in
this feature — a content gap rather than a fault — and needs no separate event because the
count already distinguishes it.

2.6 A search that **fails** (a limit rejection, a network error) SHALL NOT be logged by
this feature. No results were returned, so there is no count, and a failure is not a
search outcome. Logging refusal codes is a worthwhile but separate feature, recorded in
§Deferred.

---

## Requirement 3: the event must carry the query and the result count

**User story.** As the site owner, I want to know which query produced how many results,
in one place, without having to join anything.

### Acceptance criteria

3.1 The Search_Event SHALL carry the query text as the visitor entered it, subject to
3.5.

3.2 It SHALL carry the Result_Count as an integer.

3.3 Both SHALL travel in a single event as a Composite_Value, using a delimiter that
cannot occur in a query.

3.4 The Result_Count SHALL be the count the UI reported to the visitor, so the analytics
and the interface can never disagree.

3.5 The query SHALL be bounded in length and stripped of the delimiter and of control
characters, so a long or adversarial query cannot corrupt the value or push the count out
of a truncated field. The bound SHALL come from Task 0's measurement, not from a guess.

3.6 IF Task 0 shows a Composite_Value cannot survive Tinylytics' value handling, THEN the
feature SHALL fall back to a **band in the event name** — but as `search.none`,
`search.few`, `search.many`, NOT `search.query.none`. Tinylytics documents names as
`category.action`, and a third segment is outside that format; a fallback that violates the
documented contract is not a fallback. The design SHALL record that this trades exact
counts for atomicity, and that it multiplies event names against a dashboard that plots a
Top-N of names.

3.7 The chosen value format SHALL be documented in both the code and the frontend docs, so
whoever reads the Tinylytics dashboard can parse it.

---

## Requirement 4: analytics must never affect search

**User story.** As a visitor, I want search to work whether or not analytics loaded.

### Acceptance criteria

4.1 Every dispatch SHALL be guarded so that an absent Beacon_Module cannot throw, matching
the `typeof PaddelbuchTinylyticsBeacon !== 'undefined'` pattern `layer-control.js` uses.

4.2 A throw inside the dispatch path SHALL NOT prevent results being applied. Analytics
runs after the visitor's outcome, never before it.

4.3 A test SHALL prove search still works with the Beacon_Module absent, and with a
Beacon_Module whose `dispatch` throws.

4.4 No CSP change SHALL be made. `tinylytics.app` is already permitted in both
`script-src` and `connect-src`; a new directive would signal a requirement that does not
exist.

4.5 The dispatch SHALL add no network request of its own. It goes through the existing
beacon, whose cost is one synthetic DOM click.

---

## Requirement 5: it must be verifiable without a dashboard

**User story.** As a maintainer, I want the tests to prove the behaviour, not to
approximate it.

### Acceptance criteria

5.1 Tests SHALL drive the real search module against a mocked fetch and assert on the
dispatches it makes — name and value — rather than testing a helper in isolation. A
predicate-only suite is insufficient and this repository has proven it: 29 predicate tests
once passed with the behaviour deleted from the input handler.

5.2 Tests SHALL cover: one event per settled search, no event per keystroke, no event for a
superseded request, a cache-served search, a zero-result search, and a failed search
emitting nothing.

5.3 Each test SHALL be checked to **fail** when the behaviour it describes is removed.

5.4 The value format SHALL be asserted exactly, including the delimiter and the bound from
3.5, so a change to either is a visible test change.

---

## Requirement 6: the live check must not be misread as a failure

**User story.** As the site owner confirming this works, I want to know why the dashboard
might show nothing even when the code is correct.

### Acceptance criteria

6.1 The documentation SHALL state that **events do not fire when hit tracking is disabled**
— including via the site's own settings or the `?ignore` script parameter. Tinylytics
documents this explicitly, and it means the owner who has ignored their own hits will see no
events while testing correct code.

6.2 The documentation SHALL state that beacon delivery uses `navigator.sendBeacon` and can
be blocked by privacy browsers and ad blockers, so event counts are a **floor** rather than
a total. This is already true of the site's existing events; search will inherit it.

6.3 The verification procedure SHALL describe how to confirm dispatch **without** the
dashboard — by observing the synthetic click and the outbound request in the browser — so a
dashboard showing nothing can be distinguished from code doing nothing.

6.4 The documentation SHALL record that event tracking is a **beta** Tinylytics feature
that may change, so a future failure is investigated against the provider rather than
assumed to be a regression here.

---

## Accepted risks

Recorded because the decision was deliberate, not because it needs revisiting.

**Query text may contain personal data the visitor typed.** Free-text search is an inlet:
people type their own names, addresses and phone numbers into search boxes. Tinylytics
being GDPR-compliant and unlinked to a person addresses the *service* side; it does not
change what the visitor put in the box. The site owner has accepted this and will describe
search logging in the privacy policy before production.

The mitigation, if this is ever revisited: log the query only when its terms are recognised
by the backend's existing bilingual concept map and corpus vocabulary, and fall back to a
shape (term count, length bucket, locale) otherwise. That preserves the useful signal —
which searchable concepts visitors want — while structurally excluding anything
unanticipated. It is not implemented here.

**Distinct-value cardinality is unbounded.** Every novel query is a new value. The
Tinylytics events view plots a Top-N of event *names*, so this affects the values list
rather than the plot, but the list will grow without limit.

---

## Deferred

- **Refusal codes.** `search.limit` carrying `quota_exceeded`, `rate_limited`, `throttled`
  or `unavailable` would show how often visitors actually hit a limit, which is currently
  guesswork. Out of scope here, and cheap to add later on the same seam.
- **PII filtering** per §Accepted risks.
- **Result-click attribution.** `marker.click` already fires; a parallel search-specific
  event would double-count.
- **Locale.** Not requested. The two locales are separate Tinylytics paths already.
