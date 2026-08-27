/**
 * Semantic Search Module
 *
 * @jest-environment jsdom
 *
 * **Feature: semantic-search, Unit coverage for the search module helpers**
 * **Validates: Requirements 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 6.1**
 *
 * Covers the pure helpers (result parsing, count formatting, URL building,
 * string merging, config coercion) plus the dimension config and match function
 * that make search AND-combine with the checkbox filter dimensions.
 */

var path = require('path');

var SemanticSearch = require(path.resolve(__dirname, '../../assets/js/semantic-search.js'));

describe('PaddelbuchSemanticSearch', () => {
  describe('Dual_Export', () => {
    test('require() returns the same object attached to the global', () => {
      expect(SemanticSearch).toBe(window.PaddelbuchSemanticSearch);
    });

    test('exposes the documented public API', () => {
      expect(typeof SemanticSearch.init).toBe('function');
      expect(typeof SemanticSearch.isConfigured).toBe('function');
      expect(typeof SemanticSearch.getDimensionConfig).toBe('function');
      expect(typeof SemanticSearch.matchFn).toBe('function');
      expect(typeof SemanticSearch.clearSearch).toBe('function');
    });
  });

  describe('matchFn', () => {
    test('matches a marker whose slug is in the selection', () => {
      var selected = new Set(['aare-thun', 'zurichsee-nord']);
      expect(SemanticSearch.matchFn({ slug: 'aare-thun' }, selected)).toBe(true);
    });

    test('rejects a marker whose slug is absent from the selection', () => {
      var selected = new Set(['aare-thun']);
      expect(SemanticSearch.matchFn({ slug: 'rhein-basel' }, selected)).toBe(false);
    });

    test('rejects a marker with no slug rather than throwing', () => {
      var selected = new Set(['aare-thun']);
      expect(SemanticSearch.matchFn({}, selected)).toBe(false);
    });

    test('rejects null metadata rather than throwing', () => {
      var selected = new Set(['aare-thun']);
      expect(SemanticSearch.matchFn(null, selected)).toBe(false);
    });
  });

  describe('getDimensionConfig', () => {
    test('declares no options so the engine starts the dimension inactive', () => {
      var dim = SemanticSearch.getDimensionConfig();
      expect(dim.options).toEqual([]);
      expect(typeof dim.matchFn).toBe('function');
      expect(dim.key).toBeTruthy();
    });
  });

  describe('_parseResults', () => {
    test('extracts slugs and coordinates from an API array', () => {
      var parsed = SemanticSearch._parseResults([
        { slug: 'aare-thun', location: { lat: 46.75, lon: 7.63 }, score: 0.8 },
        { slug: 'rhein-basel', location: { lat: 47.55, lon: 7.59 }, score: 0.6 }
      ]);
      expect(parsed.slugs).toEqual(['aare-thun', 'rhein-basel']);
      expect(parsed.locations).toEqual([
        { lat: 46.75, lon: 7.63 },
        { lat: 47.55, lon: 7.59 }
      ]);
    });

    test('keeps the slug when coordinates are missing', () => {
      var parsed = SemanticSearch._parseResults([
        { slug: 'no-coords', location: null, score: 0.5 }
      ]);
      expect(parsed.slugs).toEqual(['no-coords']);
      expect(parsed.locations).toEqual([]);
    });

    test('skips entries with no slug, which cannot be used as a filter key', () => {
      var parsed = SemanticSearch._parseResults([
        { slug: 'good', location: { lat: 46, lon: 7 } },
        { location: { lat: 47, lon: 8 } },
        null
      ]);
      expect(parsed.slugs).toEqual(['good']);
    });

    test('rejects a non-array payload instead of reporting an empty result', () => {
      // This previously asserted the opposite -- that a non-array yielded zero
      // slugs. That was the bug: zero slugs is indistinguishable from a genuine
      // empty result, so the caller applied the no-match sentinel and hid EVERY
      // marker, presenting a backend fault as "no spots match your search".
      expect(() => SemanticSearch._parseResults(null)).toThrow();
      expect(() => SemanticSearch._parseResults({})).toThrow();
      expect(() => SemanticSearch._parseResults({ length: 0 })).toThrow();

      // An empty ARRAY remains a valid successful result.
      expect(SemanticSearch._parseResults([]).slugs).toEqual([]);
    });

    test('ignores non-numeric coordinates', () => {
      var parsed = SemanticSearch._parseResults([
        { slug: 'bad-coords', location: { lat: '46.75', lon: 7.63 } }
      ]);
      expect(parsed.slugs).toEqual(['bad-coords']);
      expect(parsed.locations).toEqual([]);
    });
  });

  describe('_formatCount', () => {
    beforeEach(() => {
      SemanticSearch._setStringsForTest({
        noResults: 'none',
        resultsOne: 'one',
        resultsMany: '{count} many'
      });
    });

    test('uses the no-results string for zero', () => {
      expect(SemanticSearch._formatCount(0)).toBe('none');
    });

    test('uses the singular string for one', () => {
      expect(SemanticSearch._formatCount(1)).toBe('one');
    });

    test('substitutes the count into the plural string', () => {
      expect(SemanticSearch._formatCount(7)).toBe('7 many');
    });
  });

  describe('_buildUrl', () => {
    beforeEach(() => {
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search',
        apiKey: 'k',
        locale: 'de',
        limit: 40,
        minScore: 0.25,
        dimensionKey: 'search'
      });
    });

    test('encodes the query, locale and limit', () => {
      var url = SemanticSearch._buildUrl('Aare Thun');
      expect(url).toContain('q=Aare%20Thun');
      expect(url).toContain('locale=de');
      expect(url).toContain('limit=40');
      expect(url).toContain('minScore=0.25');
    });

    test('percent-encodes umlauts so the query survives transport', () => {
      var url = SemanticSearch._buildUrl('Z\u00fcrichsee');
      expect(url).toContain('q=Z%C3%BCrichsee');
    });

    test('appends with & when the endpoint already carries a query string', () => {
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search?stage=prod',
        locale: 'en',
        limit: 10,
        minScore: 0.3,
        dimensionKey: 'search'
      });
      var url = SemanticSearch._buildUrl('lake');
      expect(url).toContain('?stage=prod&q=lake');
    });

    test('omits minScore when it is outside the valid cosine range', () => {
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search',
        locale: 'de',
        limit: 40,
        minScore: 5,
        dimensionKey: 'search'
      });
      expect(SemanticSearch._buildUrl('x')).not.toContain('minScore');
    });

    test('omits minScore entirely when it is null', () => {
      // Null means "no relevance floor". A single cosine floor cut German far
      // harder than English for the same concept, which was the reported
      // 40-versus-36 asymmetry.
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search',
        locale: 'de',
        limit: 500,
        minScore: null,
        fields: 'slim',
        dimensionKey: 'search'
      });
      expect(SemanticSearch._buildUrl('parking')).not.toContain('minScore');
    });

    test('requests the slim projection when configured', () => {
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search',
        locale: 'en',
        limit: 500,
        minScore: null,
        fields: 'slim',
        dimensionKey: 'search'
      });
      var url = SemanticSearch._buildUrl('parking');
      expect(url).toContain('fields=slim');
      expect(url).toContain('limit=500');
    });
  });

  describe('defaults', () => {
    test('default limit carries every match to a broad term', () => {
      // "parking" matches 441 of 737 spots on the live index; a smaller limit
      // silently truncated the result the user asked for.
      expect(SemanticSearch.DEFAULTS.limit).toBeGreaterThanOrEqual(441);
    });

    test('no relevance floor is applied by default', () => {
      expect(SemanticSearch.DEFAULTS.minScore).toBeNull();
    });

    test('the slim projection is the default', () => {
      // Only slug and location are read by this module; the full form carries
      // rendered HTML that would be downloaded and discarded.
      expect(SemanticSearch.DEFAULTS.fields).toBe('slim');
    });

    test('_numberOr and the nullable variant differ on absent values', () => {
      // A missing limit must fall back to a number; a missing floor must stay null.
      expect(SemanticSearch._numberOr(undefined, 500)).toBe(500);
      expect(SemanticSearch.DEFAULTS.minScore).toBeNull();
    });
  });

  describe('_mergeStrings', () => {
    test('supplied values override defaults', () => {
      var merged = SemanticSearch._mergeStrings(
        { a: 'default-a', b: 'default-b' },
        { a: 'custom-a' }
      );
      expect(merged.a).toBe('custom-a');
      expect(merged.b).toBe('default-b');
    });

    test('blank supplied values fall back to the default', () => {
      // The i18n plugin renders a missing key as an empty string, so a blank
      // must not blank out the UI.
      var merged = SemanticSearch._mergeStrings({ a: 'default-a' }, { a: '' });
      expect(merged.a).toBe('default-a');
    });

    test('ignores keys not present in the defaults', () => {
      var merged = SemanticSearch._mergeStrings({ a: 'x' }, { z: 'y' });
      expect(merged.z).toBeUndefined();
    });
  });

  describe('_numberOr', () => {
    test('accepts numbers and numeric strings', () => {
      expect(SemanticSearch._numberOr(5, 1)).toBe(5);
      expect(SemanticSearch._numberOr('7', 1)).toBe(7);
      expect(SemanticSearch._numberOr(0, 9)).toBe(0);
    });

    test('falls back for unusable values', () => {
      expect(SemanticSearch._numberOr('abc', 3)).toBe(3);
      expect(SemanticSearch._numberOr(null, 3)).toBe(3);
      expect(SemanticSearch._numberOr(undefined, 3)).toBe(3);
      expect(SemanticSearch._numberOr(NaN, 3)).toBe(3);
      expect(SemanticSearch._numberOr(Infinity, 3)).toBe(3);
    });
  });

  describe('isConfigured', () => {
    test('returns false when no config element is present', () => {
      SemanticSearch._setConfigForTest(null);
      document.body.innerHTML = '';
      expect(SemanticSearch.isConfigured()).toBe(false);
    });

    test('returns false when the config element has no endpoint', () => {
      SemanticSearch._setConfigForTest(null);
      document.body.innerHTML =
        '<script type="application/json" id="semantic-search-config">' +
        '{"apiKey":"k","locale":"de"}</script>';
      expect(SemanticSearch.isConfigured()).toBe(false);
    });

    test('returns false when the config element is not valid JSON', () => {
      SemanticSearch._setConfigForTest(null);
      document.body.innerHTML =
        '<script type="application/json" id="semantic-search-config">not json</script>';
      expect(SemanticSearch.isConfigured()).toBe(false);
    });

    test('returns true once an endpoint is configured', () => {
      SemanticSearch._setConfigForTest(null);
      document.body.innerHTML =
        '<script type="application/json" id="semantic-search-config">' +
        '{"endpoint":"https://api.example.com/prod/search","locale":"de"}</script>';
      expect(SemanticSearch.isConfigured()).toBe(true);
    });
  });

  describe('init', () => {
    beforeEach(() => {
      SemanticSearch._setConfigForTest({
        endpoint: 'https://api.example.com/prod/search',
        apiKey: 'k',
        locale: 'de',
        limit: 40,
        minScore: 0.25,
        minQueryLength: 2,
        debounceMs: 350,
        dimensionKey: 'search',
        fitPadding: 40,
        fitMaxZoom: 12
      });
      SemanticSearch._setStringsForTest(SemanticSearch.I18N_DEFAULTS);
      document.body.innerHTML = '<div id="host"></div>';
    });

    test('renders a search input and a live status region into the host', () => {
      var host = document.getElementById('host');
      expect(SemanticSearch.init(null, host)).toBe(true);

      var input = host.querySelector('input.search-box-input');
      expect(input).not.toBeNull();
      expect(input.getAttribute('type')).toBe('search');
      expect(input.getAttribute('aria-label')).toBeTruthy();

      var status = host.querySelector('.search-box-status');
      expect(status).not.toBeNull();
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });

    test('associates the status region with the input for assistive tech', () => {
      var host = document.getElementById('host');
      SemanticSearch.init(null, host);
      var input = host.querySelector('input.search-box-input');
      var status = host.querySelector('.search-box-status');
      expect(input.getAttribute('aria-describedby')).toBe(status.id);
    });

    test('renders a labelled clear button, hidden until there is input', () => {
      var host = document.getElementById('host');
      SemanticSearch.init(null, host);
      var clear = host.querySelector('button.search-box-clear');
      expect(clear).not.toBeNull();
      expect(clear.getAttribute('aria-label')).toBeTruthy();
      expect(clear.hidden).toBe(true);
    });

    test('uses no inline style attributes, which the CSP would block', () => {
      var host = document.getElementById('host');
      SemanticSearch.init(null, host);
      expect(host.innerHTML).not.toMatch(/style=/);
    });

    test('returns false and renders nothing when search is unconfigured', () => {
      SemanticSearch._setConfigForTest(null);
      document.body.innerHTML = '<div id="host"></div>';
      var host = document.getElementById('host');
      expect(SemanticSearch.init(null, host)).toBe(false);
      expect(host.innerHTML).toBe('');
    });
  });
});
