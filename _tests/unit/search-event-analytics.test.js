/**
 * @jest-environment jsdom
 */

/**
 * Search analytics: one Tinylytics event per settled search, carrying query and count.
 *
 * These drive the REAL module against a mocked fetch and a stubbed beacon, asserting the
 * dispatches it makes. A predicate-only suite is not sufficient and this repository has
 * proven it: 29 predicate tests once passed with the behaviour deleted from the input
 * handler.
 *
 * Two facts from reading the deployed Tinylytics script shape what is asserted here:
 *   - it debounces on `target.id || target.className || target.tagName`, and the beacon
 *     sets className 'tinylytics-beacon' with no id -- so EVERY beacon dispatch shares one
 *     key and any two within 500 ms are dropped. Hence the settle window, and hence the
 *     test that only one event fires per settled search.
 *   - it applies no truncation and encodeURIComponent()s the value -- so `|` is a safe
 *     delimiter, and the count going last is the thing a server-side cap would eat.
 */

'use strict';

const search = require('../../assets/js/semantic-search.js');

describe('formatSearchEventValue', () => {
  const fmt = search._formatSearchEventValue;

  test('carries the query and the count, delimited', () => {
    expect(fmt('parkplatz', 429)).toBe('parkplatz|429');
  });

  test('case-folds, to match the backend and avoid splitting one intent in two', () => {
    // The backend folds before embedding precisely so capitalisation cannot change
    // results. Logging both forms would make the top-queries list wrong.
    expect(fmt('Parkplatz', 429)).toBe(fmt('parkplatz', 429));
    expect(fmt('PARKPLATZ', 1)).toBe('parkplatz|1');
  });

  test('a zero-result search is recorded, not dropped', () => {
    // The highest-value case: a content gap rather than a fault.
    expect(fmt('kein see hier', 0)).toBe('kein see hier|0');
  });

  test('strips the delimiter so a query cannot fake a count', () => {
    expect(fmt('a|b', 7)).toBe('a b|7');
    expect(fmt('a|999', 7)).toBe('a 999|7');
    expect(fmt('a|b|c', 3).split('|')).toHaveLength(2);
  });

  test('strips control characters and collapses whitespace', () => {
    expect(fmt('  ruhiger\tSee  ', 5)).toBe('ruhiger see|5');
    expect(fmt('a\u0000b', 1)).toBe('a b|1');
    expect(fmt('a\nb', 1)).toBe('a b|1');
  });

  test('the count survives truncation of a long query', () => {
    // The client performs no truncation, but server-side handling is unverified. The count
    // is appended AFTER the cap so a server that truncates eats query text first.
    const value = fmt('p'.repeat(500), 42);
    expect(value.endsWith('|42')).toBe(true);
    expect(value.length).toBeLessThan(120);
  });

  test('degrades rather than throwing on unusable input', () => {
    // This runs on the success path of a search; it must never be the thing that breaks.
    expect(() => fmt(undefined, undefined)).not.toThrow();
    expect(fmt(undefined, undefined)).toBe('|0');
    expect(fmt('x', -5)).toBe('x|0');
    expect(fmt('x', NaN)).toBe('x|0');
    expect(fmt('x', 3.7)).toBe('x|3');
  });
});

describe('search analytics dispatch', () => {
  const MODULE_PATH = '../../assets/js/semantic-search.js';
  const CONFIG = {
    endpoint: 'https://search.example/search',
    apiKey: 'k',
    locale: 'de',
    debounceMs: 350,
    timeoutMs: 5000,
    minChars: 2,
    limit: 500
  };

  let mod;
  let mapStub;
  let dispatched;

  // Matches the repo's existing pattern: setImmediate is unavailable under jsdom with fake
  // timers, so drain the microtask queue instead.
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  };

  const respondWith = (slugs) => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve(
        slugs.map((sl) => ({ slug: sl, name: sl, location: { lat: 1, lon: 2 }, score: 0.5 })))
    }));
  };

  const type = async (text) => {
    const input = document.querySelector('.search-box-input');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(CONFIG.debounceMs + 10);
    await flush();
    await flush();
  };

  const settle = () => jest.advanceTimersByTime(search._ANALYTICS_SETTLE_MS + 50);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.clear();
    document.body.innerHTML = '<div id="map"></div><div id="host"></div>';

    dispatched = [];
    window.PaddelbuchTinylyticsBeacon = {
      dispatch: (name, value) => dispatched.push([name, value])
    };
    global.PaddelbuchTinylyticsBeacon = window.PaddelbuchTinylyticsBeacon;

    window.PaddelbuchFilterEngine = {
      setDimensionSelection: jest.fn(),
      applyFilters: jest.fn()
    };
    mapStub = {
      getContainer: () => document.getElementById('map'),
      on: jest.fn(),
      fitBounds: jest.fn()
    };
    global.L = { latLngBounds: () => ({ isValid: () => true }) };
    window.L = global.L;
    respondWith([]);

    jest.isolateModules(() => { mod = require(MODULE_PATH); });
    mod = mod || window.PaddelbuchSemanticSearch;
    mod._resetCachesForTest();
    mod._setConfigForTest(Object.assign({}, CONFIG));
    mod._setStringsForTest(mod.I18N_DEFAULTS);
    mod.init(mapStub, document.getElementById('host'));
  });

  afterEach(() => {
    jest.useRealTimers();
    console.warn.mockRestore();
    delete window.PaddelbuchFilterEngine;
    delete window.PaddelbuchTinylyticsBeacon;
    delete global.PaddelbuchTinylyticsBeacon;
    delete global.fetch;
  });

  test('one settled search dispatches exactly one event with query and count', async () => {
    respondWith(['a', 'b', 'c']);
    await type('parkplatz');
    expect(dispatched).toHaveLength(0);   // not yet -- it must settle first
    settle();
    expect(dispatched).toEqual([['search.query', 'parkplatz|3']]);
  });

  test('typing further within the window yields ONE event, with the final query', async () => {
    // The search debounce is 350 ms, so "park" then "parkplatz" runs two searches. Logging
    // each would record a prefix nobody meant to search.
    respondWith(['a']);
    await type('park');
    await type('parkplatz');
    settle();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0][1]).toBe('parkplatz|1');
  });

  test('a zero-result search is reported with a count of 0', async () => {
    respondWith([]);
    await type('kein see hier');
    settle();
    expect(dispatched).toEqual([['search.query', 'kein see hier|0']]);
  });

  test('a failed search reports nothing', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 429,
      headers: { get: () => null },
      text: () => Promise.resolve('{"error":"rate_limited","scope":"ip"}')
    }));
    await type('parkplatz');
    jest.advanceTimersByTime(10000);
    await flush();
    expect(dispatched).toHaveLength(0);
  });

  test('clearing before the window expires reports nothing', async () => {
    respondWith(['a']);
    await type('parkplatz');
    mod.clearSearch();
    settle();
    expect(dispatched).toHaveLength(0);
  });

  test('a repeat query served from cache is still reported', async () => {
    // The visitor searched either way. Omitting the cache path would bias the data against
    // the most popular queries -- exactly the ones most likely to be cached.
    respondWith(['a', 'b']);
    await type('parkplatz');
    settle();
    expect(dispatched).toHaveLength(1);

    dispatched.length = 0;
    global.fetch.mockClear();
    await type('x');            // move away
    settle();
    dispatched.length = 0;
    await type('parkplatz');    // back to the cached query
    settle();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0][1]).toBe('parkplatz|2');
  });

  test('a beacon whose dispatch throws does not break the search', async () => {
    window.PaddelbuchTinylyticsBeacon = {
      dispatch: () => { throw new Error('ad blocker'); }
    };
    global.PaddelbuchTinylyticsBeacon = window.PaddelbuchTinylyticsBeacon;
    respondWith(['a', 'b']);
    await type('parkplatz');
    expect(() => settle()).not.toThrow();
    // The results were applied regardless.
    expect(window.PaddelbuchFilterEngine.setDimensionSelection).toHaveBeenCalled();
  });

  test('an absent beacon does not break the search', async () => {
    delete window.PaddelbuchTinylyticsBeacon;
    delete global.PaddelbuchTinylyticsBeacon;
    respondWith(['a']);
    await type('parkplatz');
    expect(() => settle()).not.toThrow();
    expect(window.PaddelbuchFilterEngine.setDimensionSelection).toHaveBeenCalled();
  });

  test('the settle window clears the 500 ms Tinylytics event debounce', () => {
    // Every beacon dispatch shares the debounce key 'tinylytics-beacon', so two inside
    // 500 ms are silently dropped. This margin makes that structurally impossible.
    expect(search._ANALYTICS_SETTLE_MS).toBeGreaterThan(500);
  });
});

describe('the focus event no longer claims to be a query event', () => {
  test('search.query is not set on any element by the module source', () => {
    // Tinylytics fires on click, so an attribute on a text input measures FOCUS. The old
    // name asserted otherwise, and historical search.query data is a focus count.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../assets/js/semantic-search.js'), 'utf8');

    expect(src).toContain("'search.focus'");
    // The only occurrence of the string search.query may be inside dispatch() and comments,
    // never in a setAttribute call.
    expect(src).not.toMatch(/setAttribute\(\s*'data-tinylytics-event',\s*'search\.query'\s*\)/);
  });

  test('the real query event is dispatched under the name search.query', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../assets/js/semantic-search.js'), 'utf8');
    expect(src).toMatch(/dispatch\(\s*'search\.query'/);
  });

  test('the three correct pre-existing search events are untouched', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../assets/js/semantic-search.js'), 'utf8');
    for (const name of ['search.clear', 'search.clear-from-notice', 'search.retry-from-notice']) {
      expect(src).toContain(name);
    }
  });
});
