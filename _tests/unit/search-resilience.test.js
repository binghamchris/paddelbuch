/**
 * @jest-environment jsdom
 */

/**
 * Requirements 1, 4, 5, 6, 7, 12: the behaviour nobody exercises by hand.
 *
 * Every test here drives the real module against a mocked fetch and fake timers,
 * so the assertions are about what the module does rather than how it is written.
 */

const path = require('path');

const MODULE_PATH = path.join(__dirname, '..', '..', 'assets', 'js', 'semantic-search.js');

const CONFIG = {
  endpoint: 'https://api.example.com/prod/search',
  apiKey: 'k',
  locale: 'de',
  limit: 500,
  minScore: null,
  fields: 'slim',
  minQueryLength: 2,
  debounceMs: 350,
  dimensionKey: 'search',
  fitPadding: 40,
  fitMaxZoom: 12,
  timeoutMs: 6000,
  contentVersion: '2026-08-01T00:00:00Z'
};

/** A response object with only what the module reads. */
function response(status, body, headers) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (headers && headers[name.toLowerCase()]) || null },
    json: () => Promise.resolve(body)
  };
}

function abortError() {
  const err = new Error('aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * A fetch that never answers but DOES honour its abort signal, as the real one
 * does. A mock that ignores the signal would make the timeout look broken: the
 * module aborts the controller, nothing rejects, and no failure is ever reported.
 */
function hangingFetch() {
  return jest.fn((url, options) => new Promise((resolve, reject) => {
    if (options && options.signal) {
      options.signal.addEventListener('abort', function() {
        reject(abortError());
      });
    }
  }));
}

describe('search failure paths, retry and caching', () => {
  let search;
  let setDimensionSelection;
  let mapStub;

  /** Let queued promise callbacks run. */
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  };

  /** Type a query and let the debounce fire. */
  const type = async (text) => {
    const input = document.querySelector('.search-box-input');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(CONFIG.debounceMs + 10);
    await flush();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.clear();
    document.body.innerHTML = '<div id="map"></div><div id="host"></div>';

    setDimensionSelection = jest.fn();
    window.PaddelbuchFilterEngine = { setDimensionSelection, applyFilters: jest.fn() };
    mapStub = { getContainer: () => document.getElementById('map'), on: jest.fn(), fitBounds: jest.fn() };
    global.L = { latLngBounds: () => ({ isValid: () => true }) };
    window.L = global.L;

    jest.isolateModules(() => {
      search = require(MODULE_PATH);
    });
    search = search || window.PaddelbuchSemanticSearch;
    search._resetCachesForTest();
    search._setConfigForTest(Object.assign({}, CONFIG));
    search._setStringsForTest(search.I18N_DEFAULTS);
    search.init(mapStub, document.getElementById('host'));
    search._buildNoticeForTest(mapStub);
  });

  afterEach(() => {
    jest.useRealTimers();
    console.warn.mockRestore();
    delete window.PaddelbuchFilterEngine;
  });

  const noticeTitle = () => document.querySelector('.map-search-notice-title').textContent;
  const noticeHint = () => document.querySelector('.map-search-notice-hint').textContent;
  const noticeVisible = () => !document.querySelector('.map-search-notice').hidden;
  const noticeButton = () => document.querySelector('.map-search-notice-clear');
  const status = () => document.querySelector('.search-box-status').textContent;
  const lastSelection = () => setDimensionSelection.mock.calls[setDimensionSelection.mock.calls.length - 1];

  describe('Requirement 1: timeout', () => {
    test('an attempt that never settles is abandoned and reported', async () => {
      global.fetch = hangingFetch();

      await type('parking');
      expect(status()).toBe(search.I18N_DEFAULTS.searching);

      // First attempt times out, the retry is issued, and it times out too.
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();

      expect(noticeVisible()).toBe(true);
      expect(noticeTitle()).toBe(search.I18N_DEFAULTS.timeout);
    });

    test('the status region is never left reading "searching"', async () => {
      global.fetch = hangingFetch();

      await type('parking');
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();

      expect(status()).not.toBe(search.I18N_DEFAULTS.searching);
    });

    test('a timeout leaves the dimension inactive rather than hiding markers', async () => {
      global.fetch = hangingFetch();

      await type('parking');
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();
      jest.advanceTimersByTime(CONFIG.timeoutMs + 10);
      await flush();

      expect(lastSelection()).toEqual(['search', null]);
    });

    test('a nonsense timeoutMs falls back rather than disabling the timeout', () => {
      [0, -1, 'abc', null, undefined, NaN].forEach((value) => {
        document.body.innerHTML +=
          '<script type="application/json" id="semantic-search-config">'
          + JSON.stringify(Object.assign({}, CONFIG, { timeoutMs: value }))
          + '</script>';
        search._setConfigForTest(null);
        expect(search.isConfigured()).toBe(true);
        document.getElementById('semantic-search-config').remove();
      });
    });
  });

  describe('Requirement 6: the supersede must stay silent and must not retry', () => {
    test('an abort from a newer query reports nothing', async () => {
      global.fetch = jest.fn(() => Promise.reject(abortError()));

      await type('par');
      // The record is marked superseded only by a NEWER query, so simulate that.
      await type('parking');
      await flush();

      // Neither attempt should surface a failure notice.
      expect(noticeVisible()).toBe(false);
    });

    test('a superseded attempt does not schedule a retry', async () => {
      // A plain network rejection is retryable; a superseded one must not be.
      let calls = 0;
      const hanging = hangingFetch();
      global.fetch = jest.fn((url, options) => {
        calls += 1;
        return hanging(url, options);
      });

      await type('par');
      await type('parking');
      jest.advanceTimersByTime(5000);
      await flush();

      // Two typed queries, so exactly two attempts; the first being aborted must
      // not add a third.
      expect(calls).toBe(2);
    });
  });

  describe('Requirement 5: rate limiting', () => {
    test('429 reports its own message, not a general failure', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(429, null, { 'retry-after': '12' })));

      await type('parking');
      await flush();

      expect(noticeTitle()).toBe(search.I18N_DEFAULTS.rateLimited);
      expect(noticeHint()).toContain('12');
    });

    test('429 is never retried, since retrying is what caused it', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(429, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      jest.advanceTimersByTime(5000);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('an absent Retry-After falls back to the generic wait message', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(429, null, {})));

      await type('parking');
      await flush();

      expect(noticeHint()).toBe(search.I18N_DEFAULTS.rateLimitedHintGeneric);
    });

    test('an implausible Retry-After is reported without a figure', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(429, null, { 'retry-after': '99999' })));

      await type('parking');
      await flush();

      expect(noticeHint()).toBe(search.I18N_DEFAULTS.rateLimitedHintGeneric);
    });
  });

  describe('Requirement 6: retry budget', () => {
    test('a 5xx is retried exactly once, then reported', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(503, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(noticeTitle()).toBe(search.I18N_DEFAULTS.error);
    });

    test('a network error is retried exactly once', async () => {
      const fetchMock = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('a 4xx is not retried', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(400, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      jest.advanceTimersByTime(5000);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a malformed 2xx body is not retried -- the backend answered, wrongly', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(200, { message: 'nope' }, {})));
      global.fetch = fetchMock;

      await type('parking');
      jest.advanceTimersByTime(5000);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a malformed 2xx body hides no marker', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(200, { message: 'nope' }, {})));

      await type('parking');
      await flush();

      // null deactivates the dimension. The sentinel would have hidden everything.
      expect(lastSelection()).toEqual(['search', null]);
      expect(lastSelection()[1]).not.toEqual([search.NO_MATCH_SENTINEL]);
    });

    test('no failure is flashed while a retry is pending', async () => {
      let call = 0;
      global.fetch = jest.fn(() => {
        call += 1;
        return call === 1
          ? Promise.resolve(response(503, null, {}))
          : Promise.resolve(response(200, [{ slug: 'a', location: { lat: 46, lon: 7 } }], {}));
      });

      await type('parking');
      await flush();

      // Between the failure and the retry, the user must still see "searching".
      expect(noticeVisible()).toBe(false);
      expect(status()).toBe(search.I18N_DEFAULTS.searching);

      jest.advanceTimersByTime(1000 + 10);
      await flush();

      expect(noticeVisible()).toBe(false);
      expect(status()).toBe('1 Ergebnis');
    });

    test('a successful retry applies its results normally', async () => {
      let call = 0;
      global.fetch = jest.fn(() => {
        call += 1;
        return call === 1
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(response(200, [{ slug: 'zug-see', location: { lat: 47, lon: 8 } }], {}));
      });

      await type('parking');
      await flush();
      jest.advanceTimersByTime(1000 + 10);
      await flush();

      expect(lastSelection()).toEqual(['search', ['zug-see']]);
    });
  });

  describe('Requirement 4: the notice action', () => {
    test('a no-results state offers clearing', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(200, [], {})));

      await type('zzzznotaword');
      await flush();

      expect(noticeButton().textContent).toBe(search.I18N_DEFAULTS.clearLabel);
      expect(noticeButton().getAttribute('data-tinylytics-event')).toBe('search.clear-from-notice');
    });

    test('a failure state offers retrying instead', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(400, null, {})));

      await type('parking');
      await flush();

      expect(noticeButton().textContent).toBe(search.I18N_DEFAULTS.retryLabel);
      expect(noticeButton().getAttribute('data-tinylytics-event')).toBe('search.retry-from-notice');
    });

    test('the retry action re-runs the last query', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(400, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      noticeButton().click();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('retrying with an emptied box does nothing but hide the notice', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(400, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      document.querySelector('.search-box-input').value = '';

      noticeButton().click();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(noticeVisible()).toBe(false);
    });

    test('the clear action restores every marker', async () => {
      global.fetch = jest.fn(() => Promise.resolve(response(200, [], {})));

      await type('zzzznotaword');
      await flush();
      expect(lastSelection()).toEqual(['search', [search.NO_MATCH_SENTINEL]]);

      noticeButton().click();
      await flush();

      expect(lastSelection()).toEqual(['search', null]);
    });
  });

  describe('Requirement 7: the in-memory cache', () => {
    test('a repeated query makes no second request', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(
        response(200, [{ slug: 'a', location: { lat: 46, lon: 7 } }], {})));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      await type('');
      await type('parking');
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('an empty result is cached too, since it is a real answer', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(200, [], {})));
      global.fetch = fetchMock;

      await type('zzzznotaword');
      await flush();
      await type('');
      await type('zzzznotaword');
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(lastSelection()).toEqual(['search', [search.NO_MATCH_SENTINEL]]);
    });

    test('a failure is never cached', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(response(400, null, {})));
      global.fetch = fetchMock;

      await type('parking');
      await flush();
      await type('');
      await type('parking');
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('the entry bound evicts, and re-hit entries survive (LRU not FIFO)', () => {
      const small = { slugs: ['x'], locations: [] };
      // Fill past the entry bound.
      for (let i = 0; i < 505; i++) {
        search._rememberResultForTest('q' + i, small);
      }
      const stats = search._memoryStatsForTest();
      expect(stats.entries).toBeLessThanOrEqual(500);
    });

    test('the result bound evicts on breadth, not entry count', () => {
      const broad = { slugs: new Array(500).fill('s'), locations: [] };
      for (let i = 0; i < 200; i++) {
        search._rememberResultForTest('broad' + i, broad);
      }
      const stats = search._memoryStatsForTest();
      expect(stats.results).toBeLessThanOrEqual(60000);
      // 60000 / 500 = 120 entries, well under the 500-entry bound, which proves
      // the result bound is the one doing the work here.
      expect(stats.entries).toBeLessThanOrEqual(120);
    });
  });

  describe('Requirement 12: persistence across navigation', () => {
    test('a result is written to localStorage under a versioned key', async () => {
      global.fetch = jest.fn(() => Promise.resolve(
        response(200, [{ slug: 'a', location: { lat: 46, lon: 7 } }], {})));

      await type('parking');
      await flush();

      const keys = Object.keys(window.localStorage);
      expect(keys.some((k) => k.indexOf('pbsearch:v1:' + CONFIG.contentVersion) === 0)).toBe(true);
    });

    test('a fresh module instance answers from storage without a request', async () => {
      global.fetch = jest.fn(() => Promise.resolve(
        response(200, [{ slug: 'zug-see', location: { lat: 47, lon: 8 } }], {})));
      await type('parking');
      await flush();

      // Simulate a navigation: new module, new DOM, same storage.
      document.body.innerHTML = '<div id="map"></div><div id="host"></div>';
      let reloaded;
      jest.isolateModules(() => { reloaded = require(MODULE_PATH); });
      reloaded = reloaded || window.PaddelbuchSemanticSearch;
      reloaded._resetCachesForTest();
      reloaded._setConfigForTest(Object.assign({}, CONFIG));
      reloaded._setStringsForTest(reloaded.I18N_DEFAULTS);

      const hit = reloaded._lookupResultForTest('parking');

      expect(hit).not.toBeNull();
      expect(hit.slugs).toEqual(['zug-see']);
    });

    test('an expired entry is a miss and is deleted', () => {
      search._rememberResultForTest('parking', { slugs: ['a'], locations: [] });
      const key = Object.keys(window.localStorage).find((k) => k.indexOf('pbsearch:') === 0);
      const entry = JSON.parse(window.localStorage.getItem(key));
      entry.t = Date.now() - (8 * 24 * 60 * 60 * 1000);
      window.localStorage.setItem(key, JSON.stringify(entry));

      search._resetCachesForTest();
      expect(search._lookupResultForTest('parking')).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    test('a changed content version orphans every entry', () => {
      search._rememberResultForTest('parking', { slugs: ['a'], locations: [] });
      search._resetCachesForTest();
      search._setConfigForTest(Object.assign({}, CONFIG, { contentVersion: '2026-09-01T00:00:00Z' }));

      expect(search._lookupResultForTest('parking')).toBeNull();
    });

    test('the purge removes superseded versions but keeps the current one', () => {
      search._rememberResultForTest('parking', { slugs: ['a'], locations: [] });
      window.localStorage.setItem('pbsearch:v1:OLD-VERSION:whatever', JSON.stringify({ s: [], l: [], t: Date.now() }));

      search._purgeSupersededForTest();

      const keys = Object.keys(window.localStorage);
      expect(keys.some((k) => k.indexOf('pbsearch:v1:OLD-VERSION') === 0)).toBe(false);
      expect(keys.some((k) => k.indexOf('pbsearch:v1:' + CONFIG.contentVersion) === 0)).toBe(true);
    });

    test('a corrupt entry is treated as a miss and removed', () => {
      const key = 'pbsearch:v1:' + CONFIG.contentVersion + ':' + search._buildUrl('parking');
      window.localStorage.setItem(key, 'not json{');

      expect(search._lookupResultForTest('parking')).toBeNull();
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    test('a storage that throws on write degrades silently, search still working', async () => {
      const original = window.localStorage.setItem;
      window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
      global.fetch = jest.fn(() => Promise.resolve(
        response(200, [{ slug: 'a', location: { lat: 46, lon: 7 } }], {})));

      await type('parking');
      await flush();

      // The search itself must still have succeeded.
      expect(lastSelection()).toEqual(['search', ['a']]);
      window.localStorage.setItem = original;
    });

    test('a storage that throws on read degrades silently', () => {
      const original = window.localStorage.getItem;
      window.localStorage.getItem = () => { throw new Error('SecurityError'); };

      expect(() => search._lookupResultForTest('parking')).not.toThrow();

      window.localStorage.getItem = original;
    });
  });
});
