/**
 * @jest-environment jsdom
 *
 * security-hardening-v12 Task 11b — the frontend half.
 *
 * Two small items, each with a reason that is not obvious from the diff.
 *
 * 1. The query length is bounded in TWO places. `maxLength` on the input constrains only
 *    typing; it does nothing to a value set programmatically, pasted past the limit by an
 *    older browser, or restored from the persisted cache. The backend answers 400 beyond
 *    500 characters, so an unbounded value spends a request against the shared daily quota
 *    for a response that cannot succeed.
 *
 * 2. `layer-control.js` dispatched `protectedArea.slug || protectedArea.name || ''`, and
 *    the `.name` fallback was free CMS text reaching the analytics dashboard — unbounded
 *    and unsanitised, including the `|` this project uses as an event-value delimiter. It
 *    could not be injected (setAttribute never parses markup), so this is consistency
 *    rather than a vulnerability. The GUARD matters as much as the removal: dispatch
 *    validates only its event NAME, so a bare `slug` would send the literal string
 *    "undefined" and `slug || ''` an empty-value event.
 */

const fs = require('fs');
const path = require('path');

const SEARCH_SRC = path.join(__dirname, '..', '..', 'assets', 'js', 'semantic-search.js');
const LAYER_SRC = path.join(__dirname, '..', '..', 'assets', 'js', 'layer-control.js');

describe('query length is bounded', () => {
  test('the module declares a bound matching the backend contract', () => {
    const src = fs.readFileSync(SEARCH_SRC, 'utf8');
    expect(src).toMatch(/var MAX_QUERY_LENGTH = 500;/);
  });

  test('the input element carries maxlength', () => {
    const src = fs.readFileSync(SEARCH_SRC, 'utf8');
    expect(src).toMatch(/setAttribute\('maxlength', String\(MAX_QUERY_LENGTH\)\)/);
  });

  test('buildUrl bounds the query too, not just the element', () => {
    // The whole point: maxLength does not constrain a programmatic value, so relying on
    // the element alone leaves every other route to a request unbounded.
    const src = fs.readFileSync(SEARCH_SRC, 'utf8');
    expect(src).toMatch(/\.slice\(0, MAX_QUERY_LENGTH\)/);
  });

  test('no 413 or 414 handling was added, since it would be unreachable', () => {
    // Matches CODE, not prose. The first version of this test used /\b413\b/ and failed
    // against the comment that explains the omission — the classic case of an assertion
    // catching its own documentation.
    const src = fs.readFileSync(SEARCH_SRC, 'utf8');
    const code = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(code).not.toMatch(/(===|==|!==)\s*41[34]\b/);
    expect(code).not.toMatch(/\b41[34]\s*(===|==)/);
  });
});

describe('the protected-area dispatch no longer falls back to CMS free text', () => {
  const src = () => fs.readFileSync(LAYER_SRC, 'utf8');

  test('the name fallback is gone', () => {
    expect(src()).not.toMatch(/protectedArea\.slug \|\| protectedArea\.name/);
  });

  test('the dispatch is guarded on the slug rather than defaulted', () => {
    // Guarded, NOT `slug || ''`: dispatch validates only its event name, so an empty
    // value still creates an event — a meaningless bucket in the dashboard.
    expect(src()).toMatch(/protectedArea\.slug\)\s*\{/);
    expect(src()).not.toMatch(/dispatch\('marker\.click', protectedArea\.slug \|\| ''\)/);
  });

  test('it does not dispatch a bare slug that could be undefined', () => {
    // `dispatch('marker.click', protectedArea.slug)` outside a guard would set the
    // attribute to the literal string "undefined" on an absent slug — worse than the
    // fallback it replaced.
    const body = src();
    const match = body.match(
      /if \([^)]*protectedArea\.slug\)\s*\{\s*PaddelbuchTinylyticsBeacon\.dispatch\('marker\.click', protectedArea\.slug\);/
    );
    expect(match).not.toBeNull();
  });
});
