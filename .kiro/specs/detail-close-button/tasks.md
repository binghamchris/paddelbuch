# Implementation Plan

Every task names its files, its verification command and a pass condition. All design
decisions are settled in `design.md`, so no task requires a judgement call. If a pass
condition is not met after one fix attempt, stop and report rather than retrying.

## Constants

| | |
|---|---|
| repo | `/Users/chrisbingham/Documents/GitHub/paddelbuch` |
| branch | `feat/detail-close-button`, created from `origin/dev` with `--no-track` |
| Ruby prefix | `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 &&` |
| JS tests | `npx jest <path>`; full suite `npm test` |
| Ruby tests | `bundle exec rspec <path>`; full suite `bundle exec rspec` |
| build | `bundle exec rake build:site` (both locales into `_site/`) |
| new module | `assets/js/home-view-memory.js` |
| new include | `_includes/detail-close-btn.html` |
| new styles | `_sass/components/_detail-close-btn.scss` |
| storage keys | `pbhomeview:v1:view`, `pbhomeview:v1:restore` |
| event | `detail.close`, value `spot` / `waterway` / `obstacle` / `notice` |

## Hard rules for this run

1. **Never put the view in a URL or history state.** There must be no `pushState`,
   `replaceState`, query string or fragment anywhere in this feature.
2. **Do not modify `assets/js/tinylytics-beacon.js`** and do not call it. The Close_Event
   uses the attribute mechanism only.
3. **Do not change the CSP** in `deploy/frontend-deploy.yaml`. Nothing here needs it.
4. **Do not change any existing Details_Pane element.** The only layout edits are the new
   include line and, in `waterway.html` and `notice.html`, the `locale-prefix.html` include.
5. **Colours come from `_sass/settings/_paddelbuch_colours.scss`.** Only existing variables
   are used, and no colour is defined anywhere else.
6. **Commit discipline**, after each task:
   - before staging, confirm `git rev-parse --abbrev-ref HEAD` is `feat/detail-close-button`
     and `git rev-parse --abbrev-ref @{upstream}` reports no upstream;
   - gate the commit on the verification command's **own** exit status: run it to a log,
     capture `rc=$?`, and commit only when `rc` is 0;
   - stage specific paths only, never `.kiro/settings/cli.json` or other unrelated changes;
   - never push.
7. **Mutations happen only on committed files**, so `git checkout -- <file>` cannot destroy
   uncommitted work. After reverting, `git status --short` must show only the pre-existing
   unrelated changes.

---

- [x] 1. View_Store module
  - [x] 1.1 Record the baseline: run `npm test` and `bundle exec rspec` and write the pass
    counts into the "Outcomes" section at the end of this file.
  - [x] 1.2 Create `assets/js/home-view-memory.js` with the constants and every function in
    the design's View_Store table, the dual export (`window.PaddelbuchHomeViewMemory` plus
    `module.exports`), and the self-wiring of `wireDetailsPage`.
    - Every public function catches its own exceptions.
    - No listener calls `preventDefault()` or `stopPropagation()`.
    - Nothing writes to the console.
  - [x] 1.3 Create `_tests/unit/home-view-memory.test.js` (jsdom) covering item 1 of the
    design's testing strategy.
  - [x] 1.4 Create `_tests/property/home-view-memory.property.test.js` covering item 2.
  - [x] 1.5 Create `_tests/unit/home-view-memory-source-guard.test.js` covering item 4.
  - Verify: `npx jest _tests/unit/home-view-memory.test.js _tests/property/home-view-memory.property.test.js _tests/unit/home-view-memory-source-guard.test.js`
  - Pass condition: all three files green; the module is not yet loaded by any page.
  - _Requirements: 2.2, 2.5, 2.6, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 5.2, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3_

- [x] 2. Restore at map creation and save on the home page
  - [x] 2.1 In `assets/js/paddelbuch-map.js`, change `init(elementId)` to
    `init(elementId, options)`. When `options.initialView` is present, use its `center` and
    `zoom` in `mapOptions`. Change nothing else.
  - [x] 2.2 In `_includes/map-init.html`, add
    `<script src="{{ '/assets/js/home-view-memory.js' | relative_url }}"></script>`
    immediately before the `home-map.js` script tag.
  - [x] 2.3 In `assets/js/home-map.js`, implement steps 1–5 of the design's "Home page"
    section, including the fallback when `PaddelbuchHomeViewMemory` is undefined.
  - [x] 2.4 Create `_tests/unit/paddelbuch-map-initial-view.test.js` and
    `_tests/unit/home-map-restore.test.js` covering item 5 of the testing strategy.
  - Verify: `npx jest _tests/unit/paddelbuch-map-initial-view.test.js _tests/unit/home-map-restore.test.js _tests/unit/home-view-memory.test.js`
    then `npm test`.
  - Pass condition: new tests green; `npm test` passes with the baseline count plus the new
    tests and no previously passing test failing.
  - _Requirements: 2.1, 2.3, 2.4, 3.3, 3.4, 3.5, 3.8, 3.9, 6.3_

- [x] 3. Close_Button on the four details layouts
  - [x] 3.1 Add `back_to_map` under `actions:` in `_i18n/de.yml` ("Zurück zur Karte") and
    `_i18n/en.yml` ("Back to map").
  - [x] 3.2 Create `_includes/detail-close-btn.html` exactly as in the design, including
    the Page_Type allow-list.
  - [x] 3.3 Create `_sass/components/_detail-close-btn.scss` as in the design, and add
    `@forward "detail-close-btn";` to `_sass/components/_components.scss` in alphabetical
    position.
  - [x] 3.4 Add the include as the first child of the Details_Pane in `_layouts/spot.html`,
    `waterway.html`, `obstacle.html` and `notice.html`, with the `page_type` from the
    design's wiring table. In `waterway.html` and `notice.html`, add
    `{% include locale-prefix.html %}` after the `current_locale` assignment.
  - [x] 3.5 Create `spec/detail_close_btn_spec.rb` (testing strategy item 6) and
    `spec/detail_close_btn_wiring_spec.rb` (item 7).
  - Verify: `bundle exec rspec spec/detail_close_btn_spec.rb spec/detail_close_btn_wiring_spec.rb spec/i18n_key_parity_spec.rb`,
    then `bundle exec rspec`, then `bundle exec rake build:site`. In `_site/`, confirm one
    page of each type carries exactly one `detail-close-btn` with the right `href` (`/` in
    German, `/en/` in English) and the right event value.
  - Pass condition: specs green; full `rspec` at the baseline plus the new specs; the build
    succeeds; the four sampled pages in each locale are correct.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 3.1, 4.1, 4.2, 4.3, 4.6, 7.1, 7.2_

- [x] 4. End-to-end privacy property test
  - [x] 4.1 Create `_tests/property/home-view-privacy.property.test.js` covering item 3 of
    the testing strategy, every assertion listed there included.
  - Verify: `npx jest _tests/property/home-view-privacy.property.test.js` then `npm test`.
  - Pass condition: green across at least 100 fast-check runs; full suite green.
  - _Requirements: 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 8.1_

- [x] 5. Mutation proofs
  - [x] 5.1 Confirm the tree holds no uncommitted changes to the files under mutation.
  - [x] 5.2 For each mutation M1–M9 in the design: apply it, run the named test(s), confirm
    they turn red, then revert with `git checkout -- <file>`. Record a row in "Mutation
    results" below: id, file, failing test names, and whether the revert left the tree
    clean.
  - [x] 5.3 After the last revert, re-run `npm test` and `bundle exec rspec`.
  - Pass condition: all nine mutations turn their named tests red; both suites green after
    the reverts; the only file committed is this `tasks.md`.
  - If a mutation stays green, the test it names does not test what it claims. Fix that
    test, commit the fix, and repeat the mutation before going on.
  - _Requirements: 8.2_

- [x] 6. Documentation
  - [x] 6.1 Update `docs/frontend.md` as listed in the design's "Documentation" section.
  - Verify: re-read the changed sections. Every file path, key name and event name in them
    must match the code.
  - Pass condition: docs match the implementation; no other file changed.
  - _Requirements: 4.1, 4.2, 5.2_

- [x] 7. Full verification on a local build
  - [x] 7.1 Run `npm test`, `bundle exec rspec` and `bundle exec rake build:site`, each
    gated on its own exit status.
  - [x] 7.2 Serve `_site/` on `127.0.0.1` only. Check in a browser, in both locales:
    - open a spot via its popup, close it: same centre and zoom;
    - spot, then another spot from the details map, then close: the original home view;
    - open via the header waterway dropdown, then close: the view restored;
    - load a details URL directly, then close: the default view;
    - after a restore, click the logo: the default view;
    - after a restore, use the back button to the details page and close again: the same
      view;
    - Ctrl/Cmd-click the X: a new tab opens and the current tab's next home visit opens the
      default view;
    - mobile width (≤ 991 px): the X sits at the top left of the pane below the map;
    - keyboard: Tab reaches the X, the focus ring is visible, Enter closes and restores;
    - with site data blocked in browser settings: the X still navigates; the default view.
  - [x] 7.3 In the browser's network panel, filter requests to `tinylytics.app` during the
    first check above. Confirm the `detail.close` request's `event_value` is the Page_Type
    and that no request URL or body contains the stored latitude or longitude. Test with
    the owner's own hits **not** ignored, or no event fires.
  - [x] 7.4 Re-read the deployed Tinylytics client (fetch it with a browser `User-Agent`
    and a site `Referer`, or it returns an empty body). Confirm it still does not access
    `sessionStorage`, and record the result below.
  - [x] 7.5 Compare a spot, a waterway, an obstacle and a notice page against production at
    desktop width. Below the new row, nothing differs except the vertical offset.
  - Pass condition: every check passes, and the results are recorded in "Outcomes".
  - _Requirements: 1.8, 2.1, 3.1, 3.2, 3.4, 3.7, 3.8, 4.5, 5.3, 6.4_

---

- [x] 8. Header layout revision (requested by the site owner after Task 7)
  - [x] 8.1 Spot pages: move the X into the spot type row, at its right, via a new
    `inline=true` include parameter; move the Navigate button into the title row, at its
    right. Title wraps beside the button and never overlaps it.
  - [x] 8.2 Waterway, obstacle and notice pages: right-align the X's own row so the X sits
    top right on every page type.
  - [x] 8.3 Update `detail_close_btn_spec.rb` (inline variant) and
    `detail_close_btn_wiring_spec.rb` (new spot structure); regenerate the SCSS fixture.
  - [x] 8.4 Verify in a real browser at 1440 and 390 px: real, longest-real and stress titles,
    a rejected spot, a long type label, and the other three page types against production.
    Re-run the behaviour harness.
  - [x] 8.5 Update `requirements.md` (1.2, 1.8, new 1.10, 1.11), `design.md` and
    `docs/frontend.md`.
  - _Requirements: 1.2, 1.8, 1.10, 1.11_

- [x] 9. Title-row placement on waterway, obstacle and notice pages (requested by the site
  owner after Task 8; supersedes 8.2)
  - [x] 9.1 Replace the include's `inline=true` with `variant`: `"inline"` (bare link, spot
    type row) and `"title"` (link in a `.detail-close-slot` with Bootstrap's `.h1` class).
    The row variant and `.detail-close-row` are retired.
  - [x] 9.2 Put the X in the title container before the h1: a new `.detail-title-row`
    wrapper around `h1.waterway-title`, and the existing `.obstacle-title` and
    `.notice-title`. The container drops its right padding; the h1 reserves 3.5rem.
  - [x] 9.3 Update both Ruby specs and the two JS fixtures that mirror the markup;
    regenerate the SCSS fixture.
  - [x] 9.4 Verify in a real browser at 1440 and 390 px, with real and stress titles, and
    against production; re-run the behaviour harness.
  - _Requirements: 1.2, 1.8_

- [x] 10. Navigate button colours on spot pages (requested by the site owner)
  - [x] 10.1 Give `.spot-title .navigate-btn` the Copy buttons' rule in
    `_sass/pages/_spot-details.scss` (one shared selector list for base, hover and active).
  - [x] 10.2 Add `_tests/unit/spot-navigate-button-colours.test.js`: compiles the real
    stylesheet and requires the Navigate selector in the same rule as the Copy selector for
    base, hover and active.
  - [x] 10.3 Regenerate the SCSS fixture; verify the states in a real browser.
  - Outcome: the fault predates this feature: production shows it too. Before the fix, on
    hover and keyboard focus, the Navigate button went from `rgb(96,101,137)` with white text
    to transparent with `rgb(33,37,41)` text: `.navigate-btn` alone loses to Bootstrap's
    `.btn:hover` / `.btn:focus-visible`. After: normal, hover, focus-visible and
    focus+hover all match the Copy button exactly (background, text colour, outline, focus
    ring); size unchanged at 125 × 36. Mutation proof: splitting the shared rule again
    turned all 4 tests red; reverted from a backup.
  - _Requirements: 1.12_

- [x] 11. Centre the Navigate button on the title (requested by the site owner)
  - [x] 11.1 Wrap the Navigate include in `<span class="h1 spot-title-action">` in
    `_layouts/spot.html`; switch `.spot-title` from `align-items: baseline` to `flex-start`
    with the slot one title line tall.
  - [x] 11.2 Pin the slot in `detail_close_btn_wiring_spec.rb`; tighten the browser check to
    "centred on the first line within 1 px"; regenerate the SCSS fixture.
  - Outcome, measured at 1920, 1440 and 390 px on a one-line title (Weggis) and a two-line
    title (Bönigen - Bootsrampe): before, the button's centre was 4.7 px below the first
    line's centre (4.1 px below the centre of the capital letters). After: 0.0 px from the
    line centre and 0.6 px above the cap centre, at every width. Layout checks 131/131,
    button colours still identical to Copy in all four states, size 125 × 36 unchanged,
    behaviour harness 27/27.
  - _Requirements: 1.10_

---

## Mutation results

Run 2026-10-21 on commit `e12c0ef8`. Every mutation was reverted with `git checkout -- <file>`,
and `git status --short` afterwards showed only the pre-existing unrelated changes. Full
suites after the last revert: Jest 1453 passed, RSpec 1022 examples, 0 failures.

| id | file | failing tests | tree clean after revert |
|---|---|---|---|
| M1 | `assets/js/home-view-memory.js` | privacy round trip (`event-value=spot` became `=45`); privacy blocked-storage; source guard `tinylytics`, `setAttribute` | yes |
| M2 | `assets/js/home-view-memory.js` | privacy round trip (`replaceState` called); source guard `replaceState` | yes |
| M3 | `assets/js/home-view-memory.js` | privacy round trip (`localStorage.length` not 0); privacy blocked-storage; source guard `localStorage` | yes |
| M4 | `assets/js/home-view-memory.js` | unit: saves the view on a details link click, even when propagation is stopped below the document | yes |
| M5 | `assets/js/home-view-memory.js` | unit: removes a marker whose value is not "1"; property: an arbitrary restore marker value other than "1" never restores and is always removed | yes |
| M6 | `assets/js/home-view-memory.js` | unit: rejects latitude north of / longitude west of the bounds; property: a field outside the bounds or zoom range | yes |
| M7 | `assets/js/home-view-memory.js` | unit: Ctrl-, Meta-, Shift- and Alt-click do not set the marker (4 tests) | yes |
| M8 | `_includes/detail-close-btn.html` | `detail_close_btn_spec.rb`: renders nothing for all 9 unknown page types | yes |
| M9 | `assets/js/home-map.js` | unit: without a marker, the map starts at the default view even with a record | yes |

## Outcomes

- Baseline (Task 1.1): Jest 1337 tests / 126 suites passed; RSpec 953 examples, 0 failures.
- Tinylytics client re-check (Task 7.4): fetched 2026-10-21 (3931 bytes, sha256 prefix
  `79ed97cbbcfc77a3`). No `sessionStorage` or `document.cookie` access. `localStorage` is
  used only for the `tinylytics_ignore` flag. It reads `location.href` (sent as `url`) and
  `location.search` (for the ignore parameters). Clicks are handled by a capture-phase
  document listener that finds the annotated element with
  `event.target.closest('[data-tinylytics-event]')` and keys its 500 ms debounce on that
  element. That corrects an earlier assumption in this spec: an SVG click inside the X
  records correctly without `pointer-events: none`. The requirements fact table, the design
  decision row and the SCSS comment were corrected accordingly.
- Network check (Task 7.3): done in a real browser (headless Chromium via `playwright-cli`,
  whose sandbox has to be disabled on this workstation). The real client above was served
  locally with its collector pointed at the local server, and every other tinylytics.app
  request was aborted, so no hit was sent. The browser profile was fresh, so own hits were
  not ignored. Over the whole browser run (4766 requests): 8 `detail.close` events, values
  only `spot` and `waterway`; no request URL or body contained any saved latitude or
  longitude; no request reached tinylytics.app. Earlier jsdom run on one page of every type
  in both locales: exactly one `detail.close=<page type>` per page, same result.
- Browser checks (Task 7.2), local build on `127.0.0.1:4517`, 28/28 passed:
  - spot popup, then "Weitere Details": the saved record equals the rounded view; no query
    or fragment;
  - details to details (spot, then a header waterway), then X: the original home view;
    marker removed; home URL clean;
  - back button to the details page, then X again: the same view; logo after a restore: the
    default view;
  - header waterway dropdown from home, then X: restored;
  - keyboard: Tab reaches the X with a solid `:focus-visible` ring; Enter restores;
  - Ctrl/Cmd-click: no marker in this tab; the new tab opens the default view; this tab's
    next home visit is the default view;
  - direct details URL, then X: the default view;
  - English: the X links to `/en/` and restores on `/en/`;
  - mobile 390 px: the X sits at the top left of the pane below the map;
  - blocked site data (simulated: `sessionStorage` access throws `SecurityError`, which is
    what browsers do): the X still goes home at the default view, with no page errors.
  - The default view was measured rather than assumed: Leaflet clamps the configured centre
    to `maxBounds` for the viewport (lng 8.1498 at 1440 × 900, not 8.226667).
- Production comparison (Task 7.5): one spot, waterway, obstacle and notice page measured
  against www.paddelbuch.ch at 1440 × 900. On every page the pane keeps x 960 and width
  480, and each existing element measured (spot: Navigate button, type label, title;
  waterway: title, notices section; obstacle and notice: title, details table) keeps its x,
  width and height exactly. Only y moves, by exactly the new row's 52 px. Screenshots at
  desktop and mobile width were inspected: the X stands alone in its row, nothing below it
  changed.
- Pre-existing, outside this spec: the spot `auswasseringsstelle-kandar-delta-weekendweg`
  links to `/gewaesser/kander/`, which is a 404 both locally and on production.
- Header layout revision (Task 8), real browser, 62/62 layout checks at 1440 and 390 px:
  - spot type row: the X sits right of the label, centred on the icon, right edge on the pane
    content edge, above the row's line; the icon and label keep their exact production
    positions (label 33 px right, −4.4 px from the row top) and the row its 40 px height;
  - title row: the Navigate button sits right of the title beside its first line, never
    overlapping it, its right edge level with the X's. This holds for Bönigen, the longest
    real title (69 characters) and a stress title with a 51-character unbreakable word. The
    title never overflows its box;
  - rejected spot: no Navigate button, the title uses the full row;
  - a long type label never reaches the X;
  - waterway, obstacle, notice: the X is right-aligned to the pane edge in its own row;
    content below keeps x, width and height, shifted only by the 52 px row.
  - Rejected alternative, measured: flexbox in the type row moved the label 5 px left and
    6.6 px down against production, so the X is absolutely positioned instead.
  - Behaviour harness re-run on the new layout: 27/27 (the spot production comparison, I1,
    was retired because that layout changed on purpose; layout is covered above).
- Title-row placement (Task 9), real browser, 131/131 layout checks at 1440 and 390 px
  (spot checks from Task 8 re-run unchanged, plus):
  - waterway, obstacle, notice: the X's right edge is on the pane content edge and its
    centre within 0.01 px of the title's first-line centre. No line of the title text
    reaches the X, for the real titles and for a stress title with a 52-character word.
    The title never overflows its box, and its underline still spans the full pane width;
  - against production at 1440 px: each title block keeps its position and width; content
    below keeps x, width and height and moves only by the title's own height change. The
    waterway and obstacle titles are unchanged; the long notice title takes one more line
    (176 → 210 px), because it now wraps before the X.
