/**
 * @jest-environment jsdom
 */

/**
 * A query ending in a connector must not be sent.
 *
 * Why this exists
 * ---------------
 * The search fires after a 350 ms debounce, so pausing mid-sentence sent a request for
 * an unfinished query. Measured against the live API on 2026-08-28, that was not merely
 * wasteful:
 *
 *   "und"            ->   0 results   a "no matches" notice for an unfinished word
 *   "parkplatz ohne" ->   6 results   NOT the 429 that "parkplatz" returns
 *
 * The second is a visible defect: `ohne` is a negator in the backend's lexical model,
 * so it forms its own query group which is then strictly ANDed against nothing. Typing
 * "parkplatz ohne toiletten" flashed six wrong spots before correcting.
 *
 * These tests pin the predicate rather than the DOM plumbing, because the predicate is
 * where every decision lives and it is pure.
 */

'use strict';

const path = require('path');

const search = require('../../assets/js/semantic-search.js');

const endsWithConnector = search._endsWithConnector;

describe('connector detection', () => {
  describe('defers queries that are mid-thought', () => {
    test.each([
      ['parking and', 'English conjunction -- the reported case'],
      ['parkplatz und', 'German conjunction'],
      ['toiletten oder', 'German alternative'],
      ['parkplatz mit', 'German preposition taking an object'],
      ['parking with', 'English preposition taking an object'],
      ['parkplatz ohne', 'German negator -- returns 6 results, not 429'],
      ['parking without', 'English negator'],
      ['parkplatz keine', 'German negator variant'],
      ['spot near', 'English proximity preposition'],
      ['spot nahe', 'German proximity preposition'],
      ['strand von', 'German origin preposition'],
    ])('defers %j (%s)', (query) => {
      expect(endsWithConnector(query)).toBe(true);
    });

    test('defers a query that is only a connector', () => {
      // "und" alone returns 0 results, so firing it shows a "no matches" notice for a
      // word the user had not finished typing.
      expect(endsWithConnector('und')).toBe(true);
      expect(endsWithConnector('and')).toBe(true);
    });
  });

  describe('does not defer complete queries', () => {
    test.each([
      ['parkplatz'],
      ['parking'],
      ['wc'],
      ['parkplatz und toiletten'],
      ['parkplatz ohne toiletten'],
      ['parking and bbq'],
      ['zürichsee'],
      ['quiet lake for beginners'],
    ])('sends %j', (query) => {
      expect(endsWithConnector(query)).toBe(false);
    });
  });

  describe('normalisation', () => {
    test('is case-insensitive, because mobile keyboards autocapitalise', () => {
      expect(endsWithConnector('Parkplatz UND')).toBe(true);
      expect(endsWithConnector('Parkplatz Ohne')).toBe(true);
    });

    test('handles the umlaut form and the transliterated form of für', () => {
      expect(endsWithConnector('platz für')).toBe(true);
      expect(endsWithConnector('platz fur')).toBe(true);
    });

    test('is not confused by multiple spaces between words', () => {
      expect(endsWithConnector('parkplatz   und')).toBe(true);
      expect(endsWithConnector('parkplatz   toiletten')).toBe(false);
    });

    test('treats an empty or whitespace-only query as sendable', () => {
      // The minimum-length guard runs first and owns that case, so this must not
      // claim responsibility for it.
      expect(endsWithConnector('')).toBe(false);
      expect(endsWithConnector(null)).toBe(false);
      expect(endsWithConnector(undefined)).toBe(false);
    });
  });

  describe('words that merely begin with a connector', () => {
    test('defers the prefix but sends the full word', () => {
      // Typing "underwater" pauses at "und" and defers one request, then fires
      // normally from "unde" onward. Deferring the prefix is a free saving rather
      // than a defect.
      expect(endsWithConnector('und')).toBe(true);
      expect(endsWithConnector('unde')).toBe(false);
      expect(endsWithConnector('underwater')).toBe(false);
    });

    test('sends words that merely contain a connector', () => {
      expect(endsWithConnector('mitte')).toBe(false);
      expect(endsWithConnector('nordufer')).toBe(false);
      expect(endsWithConnector('bootshaus')).toBe(false);
    });
  });

  describe('the connector list itself', () => {
    test('covers both languages for every concept it includes', () => {
      const list = search._CONNECTORS;
      const pairs = [
        ['and', 'und'],
        ['or', 'oder'],
        ['with', 'mit'],
        ['without', 'ohne'],
        ['near', 'nahe'],
        ['from', 'von'],
      ];
      for (const [en, de] of pairs) {
        expect(list[en]).toBe(true);
        expect(list[de]).toBe(true);
      }
    });

    test('stays short, because it is not the backend stopword set', () => {
      // The backend's STOPWORDS has 84 entries including "meter", "sehr", "hier",
      // "bitte" and "beachten" -- words that carry no following term and would
      // suppress complete queries. Reusing it would be the obvious "simplification"
      // and it would be wrong, so the size is pinned.
      expect(Object.keys(search._CONNECTORS).length).toBeLessThan(40);
    });

    test('excludes stopwords that can legitimately end a query', () => {
      const list = search._CONNECTORS;
      for (const word of ['meter', 'sehr', 'hier', 'bitte', 'beachten', 'direkt']) {
        expect(list[word]).toBeUndefined();
      }
    });
  });
});

describe('the guard is actually wired into onInput', () => {
  // The predicate tests above all pass with the guard call deleted from onInput,
  // which would leave the behaviour unprotected while looking well tested. These
  // drive the real module against a mocked fetch, so they fail if the wiring goes.
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

  let mod;
  let mapStub;

  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  };

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

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve([])
    }));

    jest.isolateModules(() => {
      mod = require(MODULE_PATH);
    });
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
    delete global.fetch;
  });

  test('sends no request for a query ending in a connector', async () => {
    await type('parkplatz und');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends no request for a query ending in a negator', async () => {
    // The measured defect: "parkplatz ohne" returned 6 spots, not 429.
    await type('parkplatz ohne');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends the request once the query is complete', async () => {
    await type('parkplatz und toiletten');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('the reported sequence costs one request, not two', async () => {
    // "parking and" then "parking and bbq" -- the case that prompted this work.
    await type('parking and');
    await type('parking and bbq');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('parking%20and%20bbq');
  });

  test('a result already on screen is left alone when a request is withheld', async () => {
    await type('parkplatz');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const selectionCalls = window.PaddelbuchFilterEngine.setDimensionSelection.mock.calls.length;

    await type('parkplatz und');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(window.PaddelbuchFilterEngine.setDimensionSelection.mock.calls.length)
      .toBe(selectionCalls);
  });
});
