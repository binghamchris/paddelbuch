/**
 * No-Matches Handling
 *
 * @jest-environment jsdom
 *
 * **Feature: semantic-search, Property: an empty result hides every marker and says so**
 * **Validates: Requirements 5.5, 5.6**
 *
 * The API now returns an empty array when nothing satisfies the query, rather
 * than a best-effort set. That creates a trap on the client: the filter engine
 * treats an EMPTY selection as "dimension inactive" and skips it, so passing the
 * empty result straight through would reveal EVERY spot -- the exact opposite of
 * "no matches found".
 *
 * These tests pin the distinction between the two empty-looking states:
 *   - search cleared      -> dimension inactive -> all markers visible
 *   - search found nothing -> dimension active  -> no markers visible
 */

var path = require('path');

var SemanticSearch = require(path.resolve(__dirname, '../../assets/js/semantic-search.js'));

function freshFilterEngine() {
  var engine;
  jest.isolateModules(function() {
    var mod = require('../../assets/js/filter-engine.js');
    engine = mod.PaddelbuchFilterEngine || (typeof window !== 'undefined'
      ? window.PaddelbuchFilterEngine
      : undefined);
  });
  return engine;
}

var SPOTS = [
  { slug: 'aare-thun', spotType_slug: 'einstieg-ausstieg', paddleCraftTypes: ['hardshell'] },
  { slug: 'zurichsee-nord', spotType_slug: 'rasthalte', paddleCraftTypes: ['hardshell'] },
  { slug: 'bielersee-sud', spotType_slug: 'nur-einstieg', paddleCraftTypes: ['hardshell'] }
];

function visibleCount(engine) {
  return SPOTS.filter(function(s) { return engine.evaluateMarker(s); }).length;
}

describe('An empty result set hides every marker', () => {
  var engine;

  beforeEach(() => {
    engine = freshFilterEngine();
    engine.init([SemanticSearch.getDimensionConfig()], { fake: 'map' });
  });

  test('a cleared search leaves every marker visible', () => {
    engine.setDimensionSelection('search', null);
    expect(visibleCount(engine)).toBe(SPOTS.length);
  });

  test('a search that matched nothing hides every marker', () => {
    // This is what the module does on an empty API response.
    engine.setDimensionSelection('search', [SemanticSearch.NO_MATCH_SENTINEL]);
    expect(visibleCount(engine)).toBe(0);
  });

  test('the naive approach would have revealed everything', () => {
    // Documents the trap: passing the empty array straight through deactivates
    // the dimension, so all three markers come back.
    engine.setDimensionSelection('search', []);
    expect(visibleCount(engine)).toBe(SPOTS.length);
  });

  test('the sentinel cannot collide with a real slug', () => {
    var sentinel = SemanticSearch.NO_MATCH_SENTINEL;
    expect(sentinel).toEqual(expect.stringContaining('\u0000'));
    SPOTS.forEach(function(s) {
      expect(s.slug).not.toEqual(sentinel);
      expect(/^[a-z0-9-]+$/.test(s.slug)).toBe(true);
    });
  });

  test('a real match set still shows exactly those markers', () => {
    engine.setDimensionSelection('search', ['aare-thun', 'bielersee-sud']);
    expect(visibleCount(engine)).toBe(2);
    expect(engine.evaluateMarker(SPOTS[1])).toBe(false);
  });

  test('recovering from no-matches restores the markers', () => {
    engine.setDimensionSelection('search', [SemanticSearch.NO_MATCH_SENTINEL]);
    expect(visibleCount(engine)).toBe(0);
    engine.setDimensionSelection('search', null);
    expect(visibleCount(engine)).toBe(SPOTS.length);
  });
});

describe('The central map notice', () => {
  var mapContainer;
  var fakeMap;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div><div id="host"></div>';
    mapContainer = document.getElementById('map');
    fakeMap = { getContainer: function() { return mapContainer; }, on: function() {} };

    SemanticSearch._setConfigForTest({
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
      fitMaxZoom: 12
    });
    SemanticSearch._setStringsForTest(SemanticSearch.I18N_DEFAULTS);
    SemanticSearch.init(null, document.getElementById('host'));
    SemanticSearch._buildNoticeForTest(fakeMap);
  });

  test('the notice is built inside the map container, not the search control', () => {
    var notice = mapContainer.querySelector('.map-search-notice');
    expect(notice).not.toBeNull();
    expect(document.getElementById('host').querySelector('.map-search-notice')).toBeNull();
  });

  test('it is a direct child of the map container so panning cannot move it', () => {
    var notice = mapContainer.querySelector('.map-search-notice');
    expect(notice.parentElement).toBe(mapContainer);
  });

  test('it is hidden until there is something to say', () => {
    expect(mapContainer.querySelector('.map-search-notice').hidden).toBe(true);
  });

  test('showing it reveals a title and a next step', () => {
    SemanticSearch._showNoticeForTest('Nothing found', 'Try another word.');
    var notice = mapContainer.querySelector('.map-search-notice');
    expect(notice.hidden).toBe(false);
    expect(notice.querySelector('.map-search-notice-title').textContent).toBe('Nothing found');
    expect(notice.querySelector('.map-search-notice-hint').textContent).toBe('Try another word.');
  });

  test('the hint tells the user what to do next, not just what went wrong', () => {
    // The requirement is actionable guidance, so the default must mention a
    // recovery path rather than only reporting the failure.
    var hint = SemanticSearch.I18N_DEFAULTS.noResultsHint.toLowerCase();
    expect(hint.length).toBeGreaterThan(30);
    expect(/loesch|clear|anderen|different|weniger|fewer/.test(hint)).toBe(true);
  });

  test('it offers a clear-search button', () => {
    var button = mapContainer.querySelector('button.map-search-notice-clear');
    expect(button).not.toBeNull();
    expect(button.getAttribute('type')).toBe('button');
    expect(button.textContent).toBeTruthy();
  });

  test('the clear button empties the input and hides the notice', () => {
    var input = document.querySelector('.search-box-input');
    input.value = 'zzzznotaword';
    SemanticSearch._showNoticeForTest('Nothing found', 'Try another word.');

    mapContainer.querySelector('button.map-search-notice-clear').click();

    expect(input.value).toBe('');
    expect(mapContainer.querySelector('.map-search-notice').hidden).toBe(true);
  });

  test('hiding it again works', () => {
    SemanticSearch._showNoticeForTest('x', 'y');
    SemanticSearch._hideNoticeForTest();
    expect(mapContainer.querySelector('.map-search-notice').hidden).toBe(true);
  });

  test('it is announced once, as a live region', () => {
    var inner = mapContainer.querySelector('.map-search-notice-inner');
    expect(inner.getAttribute('role')).toBe('status');
    expect(inner.getAttribute('aria-live')).toBe('polite');
  });

  test('it uses no inline styles, which the CSP would drop', () => {
    expect(mapContainer.innerHTML).not.toMatch(/style=/);
  });

  test('building twice does not duplicate the notice', () => {
    SemanticSearch._buildNoticeForTest(fakeMap);
    expect(mapContainer.querySelectorAll('.map-search-notice').length).toBe(1);
  });

  test('a map without a container is handled without throwing', () => {
    expect(function() {
      SemanticSearch._buildNoticeForTest({ getContainer: function() { return null; } });
    }).not.toThrow();
    expect(function() {
      SemanticSearch._buildNoticeForTest(null);
    }).not.toThrow();
  });
});

describe('The no-matches message', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    SemanticSearch._setConfigForTest({
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
      fitMaxZoom: 12
    });
    SemanticSearch._setStringsForTest(SemanticSearch.I18N_DEFAULTS);
    SemanticSearch.init(null, document.getElementById('host'));
  });

  test('a localised no-results string exists to display', () => {
    expect(SemanticSearch.I18N_DEFAULTS.noResults).toBeTruthy();
  });

  test('zero results formats as the no-results message, not "0 results"', () => {
    expect(SemanticSearch._formatCount(0)).toBe(SemanticSearch.I18N_DEFAULTS.noResults);
  });

  test('the status region is a live region so the message is announced', () => {
    var status = document.querySelector('.search-box-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });
});
