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

- [ ] 2. Restore at map creation and save on the home page
  - [ ] 2.1 In `assets/js/paddelbuch-map.js`, change `init(elementId)` to
    `init(elementId, options)`. When `options.initialView` is present, use its `center` and
    `zoom` in `mapOptions`. Change nothing else.
  - [ ] 2.2 In `_includes/map-init.html`, add
    `<script src="{{ '/assets/js/home-view-memory.js' | relative_url }}"></script>`
    immediately before the `home-map.js` script tag.
  - [ ] 2.3 In `assets/js/home-map.js`, implement steps 1–5 of the design's "Home page"
    section, including the fallback when `PaddelbuchHomeViewMemory` is undefined.
  - [ ] 2.4 Create `_tests/unit/paddelbuch-map-initial-view.test.js` and
    `_tests/unit/home-map-restore.test.js` covering item 5 of the testing strategy.
  - Verify: `npx jest _tests/unit/paddelbuch-map-initial-view.test.js _tests/unit/home-map-restore.test.js _tests/unit/home-view-memory.test.js`
    then `npm test`.
  - Pass condition: new tests green; `npm test` passes with the baseline count plus the new
    tests and no previously passing test failing.
  - _Requirements: 2.1, 2.3, 2.4, 3.3, 3.4, 3.5, 3.8, 3.9, 6.3_

- [ ] 3. Close_Button on the four details layouts
  - [ ] 3.1 Add `back_to_map` under `actions:` in `_i18n/de.yml` ("Zurück zur Karte") and
    `_i18n/en.yml` ("Back to map").
  - [ ] 3.2 Create `_includes/detail-close-btn.html` exactly as in the design, including
    the Page_Type allow-list.
  - [ ] 3.3 Create `_sass/components/_detail-close-btn.scss` as in the design, and add
    `@forward "detail-close-btn";` to `_sass/components/_components.scss` in alphabetical
    position.
  - [ ] 3.4 Add the include as the first child of the Details_Pane in `_layouts/spot.html`,
    `waterway.html`, `obstacle.html` and `notice.html`, with the `page_type` from the
    design's wiring table. In `waterway.html` and `notice.html`, add
    `{% include locale-prefix.html %}` after the `current_locale` assignment.
  - [ ] 3.5 Create `spec/detail_close_btn_spec.rb` (testing strategy item 6) and
    `spec/detail_close_btn_wiring_spec.rb` (item 7).
  - Verify: `bundle exec rspec spec/detail_close_btn_spec.rb spec/detail_close_btn_wiring_spec.rb spec/i18n_key_parity_spec.rb`,
    then `bundle exec rspec`, then `bundle exec rake build:site`. In `_site/`, confirm one
    page of each type carries exactly one `detail-close-btn` with the right `href` (`/` in
    German, `/en/` in English) and the right event value.
  - Pass condition: specs green; full `rspec` at the baseline plus the new specs; the build
    succeeds; the four sampled pages in each locale are correct.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 3.1, 4.1, 4.2, 4.3, 4.6, 7.1, 7.2_

- [ ] 4. End-to-end privacy property test
  - [ ] 4.1 Create `_tests/property/home-view-privacy.property.test.js` covering item 3 of
    the testing strategy, every assertion listed there included.
  - Verify: `npx jest _tests/property/home-view-privacy.property.test.js` then `npm test`.
  - Pass condition: green across at least 100 fast-check runs; full suite green.
  - _Requirements: 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 8.1_

- [ ] 5. Mutation proofs
  - [ ] 5.1 Confirm the tree holds no uncommitted changes to the files under mutation.
  - [ ] 5.2 For each mutation M1–M9 in the design: apply it, run the named test(s), confirm
    they turn red, then revert with `git checkout -- <file>`. Record a row in "Mutation
    results" below: id, file, failing test names, and whether the revert left the tree
    clean.
  - [ ] 5.3 After the last revert, re-run `npm test` and `bundle exec rspec`.
  - Pass condition: all nine mutations turn their named tests red; both suites green after
    the reverts; the only file committed is this `tasks.md`.
  - If a mutation stays green, the test it names does not test what it claims. Fix that
    test, commit the fix, and repeat the mutation before going on.
  - _Requirements: 8.2_

- [ ] 6. Documentation
  - [ ] 6.1 Update `docs/frontend.md` as listed in the design's "Documentation" section.
  - Verify: re-read the changed sections. Every file path, key name and event name in them
    must match the code.
  - Pass condition: docs match the implementation; no other file changed.
  - _Requirements: 4.1, 4.2, 5.2_

- [ ] 7. Full verification on a local build
  - [ ] 7.1 Run `npm test`, `bundle exec rspec` and `bundle exec rake build:site`, each
    gated on its own exit status.
  - [ ] 7.2 Serve `_site/` on `127.0.0.1` only. Check in a browser, in both locales:
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
  - [ ] 7.3 In the browser's network panel, filter requests to `tinylytics.app` during the
    first check above. Confirm the `detail.close` request's `event_value` is the Page_Type
    and that no request URL or body contains the stored latitude or longitude. Test with
    the owner's own hits **not** ignored, or no event fires.
  - [ ] 7.4 Re-read the deployed Tinylytics client (fetch it with a browser `User-Agent`
    and a site `Referer`, or it returns an empty body). Confirm it still does not access
    `sessionStorage`, and record the result below.
  - [ ] 7.5 Compare a spot, a waterway, an obstacle and a notice page against production at
    desktop width. Below the new row, nothing differs except the vertical offset.
  - Pass condition: every check passes, and the results are recorded in "Outcomes".
  - _Requirements: 1.8, 2.1, 3.1, 3.2, 3.4, 3.7, 3.8, 4.5, 5.3, 6.4_

---

## Mutation results

| id | file | failing tests | tree clean after revert |
|---|---|---|---|

## Outcomes

- Baseline (Task 1.1): Jest 1337 tests / 126 suites passed; RSpec 953 examples, 0 failures.
- Tinylytics client re-check (Task 7.4):
- Manual verification (Task 7.2–7.5):
