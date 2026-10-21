# Requirements Document

## Introduction

Add an "X" (close) button to the top left of the details pane on every details page. When a
visitor clicks it, they return to the home page with the map centred and zoomed as they had
it when they left the home page for a details page. The button is instrumented with a
Tinylytics event so the site owner can see whether the feature is used.

The constraint that shapes everything below is the published privacy policy (last updated
19 Sep 2026, read in both locales before writing this). It says Paddel Buch avoids collecting
data about the visitor wherever technically possible, uses no cookies for any purpose, and
processes location data entirely on the visitor's device without sending it to Paddel Buch.
The home map view can *be* the visitor's location, because the locate control centres the
map on their GPS position. The view must therefore never leave the browser.

The approach was chosen by the site owner from three policy-compliant options: the view is
kept in the tab's `sessionStorage` (option C). The `history.back()` fast path (option A) and
the history-entry state approach (option B) were considered and not chosen.

Established by reading the code and the deployed Tinylytics client before writing this:

| fact | value | consequence |
|---|---|---|
| Tinylytics payload | sends `window.location.href` (query string and `#` part included) and the referrer with every page view and event | any URL that carries the view leaks it to Tinylytics; the view must never be put in a URL |
| Amplify access logs | record the request URL beside the client IP for two weeks | a query-string view would also be logged server-side |
| Tinylytics client storage | reads `localStorage`, not `sessionStorage` | `sessionStorage` is not read by the current client; it is still readable by any same-origin script |
| Tinylytics event dispatch | attribute-based, fires on a real **click** of an element carrying `data-tinylytics-event` | a plain annotated link needs no beacon dispatch |
| Tinylytics delivery | `navigator.sendBeacon`, `fetch` fallback (`min.js?events&beacon`) | the event survives the navigation the click triggers |
| Tinylytics click handling | capture-phase document listener; finds the annotated element with `event.target.closest('[data-tinylytics-event]')`; 500 ms debounce keyed on that element's `id \|\| className \|\| tagName` (re-read 2026-10-21) | a click on the X's icon still records the event; the X's own class is its debounce key |
| Tinylytics hit filtering | events do not fire when the owner's own hits are ignored (`?ignore` or site setting) | the owner may see nothing while testing; verification must account for it |
| event naming | `category.action` (e.g. `popup.details`, `navigate.click`) | new event is `detail.close` |
| details layouts | `_layouts/spot.html`, `waterway.html`, `obstacle.html`, `notice.html` | four layouts get the button; rejected spots use `spot.html` |
| details panes | `.spot-description`, `.waterway-details`, `.obstacle-description`, `.notice-description` | the button is the first child of each |
| top of the panes | spot pages: `.navigate-btn` floats right (`float: right; margin-top: .8em`), type label at left; other pages: the `<h1>` title at left | the free top-left corner is about 16 px tall and 24 px wide |
| home map config | `_includes/map-init.html`: `maxBounds [[45.0, 4.5], [49.4, 11.8]]`, `minZoom 7`, `maxZoom` from `site.map.max_zoom` (20) | the restored view is validated against the home map's own limits |
| home map creation | `PaddelbuchMap.init('map')` in `assets/js/home-map.js` reads centre and zoom from `#map-config` | the restored view must be applied at creation |
| first data load | `map-data-init.js` loads data for `map.getBounds()` once, then on every `moveend` | creating the map at the restored view makes the first load target it |
| marker click on home | `layer-control.js` recentres (and may zoom) on the clicked marker before the popup opens | the saved view is the view at the moment the details link is clicked, recentring included |
| links to details pages | popup "More details" links (spot, rejected spot, obstacle, notice) and the header's waterway dropdowns | all are `<a>` elements whose path starts with a collection prefix |
| collection paths | `/einstiegsorte/`, `/gewaesser/`, `/hindernisse/`, `/gewaesserereignisse/`; English adds `/en` | one path pattern identifies a details link |
| home link | `{{ locale_prefix \| append: '/' }}` (`_includes/header.html`) | the X uses the same href |
| web-storage key style | `pbsearch:v1:…` (`semantic-search.js`) | new keys follow `pbhomeview:v1:…` |

---

## Glossary

- **Details_Page** — a page rendered by `spot.html`, `waterway.html`, `obstacle.html` or
  `notice.html`.
- **Details_Pane** — the right-hand (desktop) or lower (mobile) column of a Details_Page
  holding its text content.
- **Close_Button** — the X link added by this feature to the top left of the Details_Pane.
- **Home_Map** — the Leaflet map on the home page (`/` and `/en/`).
- **Home_View** — the Home_Map's centre latitude, centre longitude and zoom.
- **Details_Link** — an `<a>` element on the home page whose same-origin path matches
  `^(/en)?/(einstiegsorte|gewaesser|hindernisse|gewaesserereignisse)/[^/]+/?$`.
- **View_Record** — the stored Home_View, under key `pbhomeview:v1:view`.
- **Restore_Marker** — a one-time flag under key `pbhomeview:v1:restore` set by the
  Close_Button.
- **Page_Type** — one of `spot`, `waterway`, `obstacle`, `notice`.
- **Close_Event** — the Tinylytics event `detail.close`.
- **View_Store** — the new module `assets/js/home-view-memory.js`.

---

## Requirement 1: Close button on every details page

**User story.** As a visitor reading a details page, I want an obvious close button, so that I
can get back to the map without hunting for the logo or the browser's back button.

**Acceptance criteria.**

1. THE SYSTEM SHALL render exactly one Close_Button on every Details_Page, including
   rejected-spot pages.
2. THE Close_Button SHALL be the first element of the Details_Pane, in its own row, aligned to
   the left edge of the pane's content.
3. THE Close_Button SHALL be an `<a>` element whose `href` is the home page of the current
   locale (`/` for German, `/en/` for English), with no query string and no fragment, so that
   it works when JavaScript is unavailable.
4. THE Close_Button SHALL carry an accessible name from the i18n files: German
   "Zurück zur Karte", English "Back to map", used as both `aria-label` and `title`.
5. THE Close_Button SHALL present an X icon as inline SVG with `aria-hidden="true"` and
   `focusable="false"`, and the SVG SHALL not be a click target (`pointer-events: none`).
6. THE Close_Button SHALL have a hit area of at least 40 × 40 CSS px and a visible focus
   indicator under `:focus-visible`.
7. THE Close_Button's colours SHALL come from `_sass/settings/_paddelbuch_colours.scss`; no new
   colour SHALL be defined outside that file.
8. WHEN the Close_Button row is added THE SYSTEM SHALL NOT change the markup, styles, size or
   horizontal position of any existing Details_Pane element; existing content moves down by the
   height of the new row and nothing else changes.
9. THE Close_Button SHALL comply with the deployed CSP: no inline script, no inline `style`
   attribute, no external asset.

---

## Requirement 2: Save the home view when a details page is opened

**User story.** As a visitor who set up the map around an area, I want that view remembered
when I open a details page, so that closing the page puts me back where I was.

**Acceptance criteria.**

1. WHEN a visitor activates a Details_Link on the home page with a click or an auxiliary
   (middle) click THE SYSTEM SHALL write the current Home_View to `sessionStorage` as the
   View_Record, replacing any earlier View_Record.
2. THE View_Record SHALL be a JSON object with exactly the keys `lat`, `lng` and `zoom`;
   `lat` and `lng` SHALL be rounded to 5 decimal places.
3. THE SYSTEM SHALL NOT write a View_Record on any other interaction: map moves, zooms,
   locate-control activation, search, filter changes, or links that are not Details_Links.
4. THE SYSTEM SHALL NOT save the view of any Details_Page map.
5. IF `sessionStorage` is unavailable or a write throws THEN THE SYSTEM SHALL save nothing and
   SHALL NOT interfere with the navigation.
6. THE saving listener SHALL NOT call `preventDefault()` or `stopPropagation()` on the event.

---

## Requirement 3: Restore the home view via the close button

**User story.** As a visitor closing a details page, I want the map exactly where I left it,
so that I can carry on exploring the same area.

**Acceptance criteria.**

1. WHEN a visitor activates the Close_Button with an unmodified primary click (button 0, no
   Ctrl, Meta, Shift or Alt) THE SYSTEM SHALL set the Restore_Marker and SHALL let the browser
   follow the link normally.
2. WHEN the Close_Button is activated with a modified or auxiliary click THE SYSTEM SHALL NOT
   set the Restore_Marker.
3. WHEN the home page loads THE SYSTEM SHALL remove the Restore_Marker, whether or not it was
   set and whether or not a restore follows.
4. WHEN the home page loads with the Restore_Marker set and a valid View_Record THE SYSTEM
   SHALL create the Home_Map at the View_Record's centre and zoom, rather than creating it at
   the default view and moving it afterwards.
5. WHEN the home page loads without the Restore_Marker THE SYSTEM SHALL create the Home_Map at
   the default view, even if a View_Record exists.
6. IF the View_Record is missing or invalid (Requirement 6) THEN THE SYSTEM SHALL create the
   Home_Map at the default view.
7. THE SYSTEM SHALL keep the View_Record after a restore, so that a visitor who goes back to a
   Details_Page and closes it again returns to the same view.
8. THE SYSTEM SHALL NOT change the behaviour of the header logo link, the browser back and
   forward buttons, or any other route to the home page.
9. THE SYSTEM SHALL NOT change any Details_Page map's initial view.

---

## Requirement 4: Usage analytics without location or map data

**User story.** As the site owner, I want to know whether visitors use the close button, so
that I can judge whether the feature earns its place, without collecting anything about where
they were looking.

**Acceptance criteria.**

1. WHEN a visitor clicks the Close_Button THE SYSTEM SHALL record a Close_Event through the
   Tinylytics attribute mechanism: `data-tinylytics-event="detail.close"` on the
   Close_Button itself.
2. THE Close_Event value SHALL be the Page_Type of the Details_Page, written into
   `data-tinylytics-event-value` by Liquid at build time.
3. THE Close_Button include SHALL accept only the four Page_Type values; IF it is given any
   other value THEN it SHALL render nothing.
4. THE View_Store and every other script SHALL NOT read, write or remove any
   `data-tinylytics-*` attribute, and SHALL NOT call `PaddelbuchTinylyticsBeacon`, as part of
   this feature.
5. THE Close_Event SHALL carry no coordinate, zoom level, bounds, tile identifier or any value
   derived from the Home_View or the View_Record, including whether a View_Record exists.
6. THE Close_Event SHALL be recorded whether or not a View_Record exists.

---

## Requirement 5: The view never leaves the browser

**User story.** As a visitor, I want the site to keep its privacy promise, so that the place I
was looking at, which may be where I am, is never sent anywhere.

**Acceptance criteria.**

1. THE SYSTEM SHALL NOT place the Home_View or any value derived from it in a URL: not in a
   path, query string or fragment, and not via `history.pushState` or `history.replaceState`.
2. THE SYSTEM SHALL NOT store the Home_View in history state, a cookie, `localStorage`,
   IndexedDB or any storage other than `sessionStorage`.
3. THE SYSTEM SHALL NOT send the Home_View in any network request, beacon or analytics event.
4. THE SYSTEM SHALL NOT write the Home_View to the console or into any error message.
5. THE View_Store SHALL write no `sessionStorage` keys other than the View_Record and the
   Restore_Marker.
6. THE Restore_Marker's stored value SHALL be the constant `"1"`.

---

## Requirement 6: Resilience

**User story.** As a visitor with unusual browser settings, I want the close button to work
regardless, so that a privacy setting or a stale value never breaks the page.

**Acceptance criteria.**

1. IF accessing `window.sessionStorage` throws, or any `getItem`, `setItem` or `removeItem`
   call throws THEN THE SYSTEM SHALL continue without saving or restoring, and SHALL NOT
   throw to the page.
2. THE SYSTEM SHALL treat a View_Record as invalid unless all of these hold:
   - it parses as a JSON object (not an array or `null`);
   - its key set is exactly `lat`, `lng`, `zoom`;
   - all three values are finite numbers;
   - `lat` and `lng` lie within the Home_Map's `maxBounds`;
   - `zoom` lies within the Home_Map's `minZoom` and `maxZoom`, inclusive.
3. THE validation limits SHALL be read from the home page's `#map-config`, not duplicated
   in the View_Store.
4. WHEN the Close_Button is activated and storage is unusable THE SYSTEM SHALL still navigate
   to the home page and still record the Close_Event.

---

## Requirement 7: Translations

**User story.** As a German- or English-speaking visitor, I want the button labelled in my
language.

**Acceptance criteria.**

1. THE SYSTEM SHALL add the key `actions.back_to_map` to both `_i18n/de.yml` and
   `_i18n/en.yml`, so `spec/i18n_key_parity_spec.rb` keeps passing.
2. German text SHALL use Swiss orthography (`ss`, never `ß`).

---

## Requirement 8: Tests that can fail

**User story.** As the site owner, I want the privacy guarantees enforced by tests that are
proven to fail when broken, so that a later change cannot quietly break them.

**Acceptance criteria.**

1. Each guarantee in Requirements 4 and 5 SHALL be covered by an automated test.
2. Each such test SHALL be shown to turn red under a deliberate mutation that breaks the
   guarantee it covers, and the mutation and its result SHALL be recorded in `tasks.md`.
3. Validation (Requirement 6.2) SHALL be covered by a fast-check property test over arbitrary
   stored values.
4. The Close_Button include SHALL be tested by rendering it through Liquid, not by matching
   its source text.

---

## Out of scope

- Restoring filters, search text or results, open popups, layer toggles, or the locate
  control's tracking state. Only centre and zoom are restored, as requested.
- The `history.back()` fast path and the history-entry state approach.
- Restoring the view from the header logo link or the back button.
- Any change to the privacy policy text. Whether to mention `sessionStorage` beside the
  existing device-side geolocation cache paragraph is the site owner's decision.
- Splitting the Close_Event by "view restored" vs "default view". That value would be
  derived from stored map state (Requirement 4.5).

## Accepted risks

- **Same-origin scripts can read `sessionStorage`.** That includes the Tinylytics client,
  which is loaded from tinylytics.app at runtime and can change without a deploy. The current
  client does not read `sessionStorage`. The exposure is no greater than today's on the home
  page, where the live map is reachable by any page script through the global
  `window.paddelbuchMap`.
- **New tabs are best-effort.** Browsers differ on whether a tab opened from a link inherits
  `sessionStorage`. Without it, the Close_Button in the new tab opens the default view.
- **Tinylytics counts are a floor.** Privacy-focused browsers and extensions block the beacon,
  and the owner's own ignored hits record no events.
