/**
 * @jest-environment jsdom
 */

/**
 * Requirement 9: every exported function must be safe to call when search is
 * unconfigured, which is a supported configuration -- a local build, or a deploy
 * with the feature flag on.
 *
 * The bug this pins: applySelection dereferenced config.dimensionKey with no
 * guard, so the exported clearSearch() threw on an unconfigured build.
 * getDimensionConfig already guarded, which is what made the omission a slip
 * rather than a decision.
 *
 * The walk over the whole export surface is the point. A future export that
 * forgets the guard should fail here without anyone remembering to add a case.
 */

const path = require('path');

const MODULE_PATH = path.join(__dirname, '..', '..', 'assets', 'js', 'semantic-search.js');

function loadUnconfigured() {
  let mod;
  jest.isolateModules(() => {
    mod = require(MODULE_PATH);
  });
  const search = mod || window.PaddelbuchSemanticSearch;
  // No #semantic-search-config element in the DOM, so readConfig returns null.
  search._setConfigForTest(null);
  return search;
}

/** Arguments that are individually reasonable, so a throw means a real fault. */
const SAFE_ARGS = {
  init: [null, null],
  createControl: [null],
  isConfigured: [],
  getDimensionConfig: [],
  matchFn: [{ slug: 'x' }, new Set(['x'])],
  clearSearch: [],
  _parseResults: [[]],
  _formatCount: [0],
  _buildUrl: ['parking'],
  _mergeStrings: [{ a: 'x' }, {}],
  _numberOr: [1, 2],
  _buildNoticeForTest: [null],
  _showNoticeForTest: ['t', 'h'],
  _hideNoticeForTest: [],
  _setConfigForTest: [null],
  _setStringsForTest: [{}],
  _getStringsForTest: []
};

describe('the search module when unconfigured', () => {
  let search;

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterEngine;
    search = loadUnconfigured();
  });

  test('reports itself as not configured', () => {
    expect(search.isConfigured()).toBe(false);
  });

  test('init renders nothing and returns false', () => {
    document.body.innerHTML = '<div id="host"></div>';
    expect(search.init(null, document.getElementById('host'))).toBe(false);
    expect(document.querySelector('.search-box')).toBeNull();
  });

  test('createControl returns null rather than building a control', () => {
    expect(search.createControl(null)).toBeNull();
  });

  test('clearSearch does not throw -- the specific bug this requirement names', () => {
    expect(() => search.clearSearch()).not.toThrow();
  });

  test('every exported function is callable without throwing', () => {
    const names = Object.keys(search).filter((k) => typeof search[k] === 'function');

    // Guard against the walk silently covering nothing.
    expect(names.length).toBeGreaterThan(8);

    const unexpected = [];
    names.forEach((name) => {
      const args = SAFE_ARGS[name];
      if (args === undefined) {
        unexpected.push(name);
        return;
      }
      try {
        search[name].apply(null, args);
      } catch (err) {
        throw new Error('export ' + name + ' threw when unconfigured: ' + err.message);
      }
    });

    // A new export with no entry above is a failure, not a skip: it would
    // otherwise slip through this test unexercised.
    expect(unexpected).toEqual([]);
  });

  test('the exported constants are still readable', () => {
    expect(typeof search.NO_MATCH_SENTINEL).toBe('string');
    expect(search.DEFAULTS).toBeDefined();
    expect(search.I18N_DEFAULTS).toBeDefined();
  });

  test('buildUrl yields an empty string rather than a broken URL', () => {
    // It is exported for tests, so it holds the same contract as the rest of the
    // surface instead of relying on its callers to check config first.
    expect(search._buildUrl('parking')).toBe('');
  });

  test('a filter engine present but no config still cannot be driven', () => {
    const setDimensionSelection = jest.fn();
    window.PaddelbuchFilterEngine = { setDimensionSelection, applyFilters: jest.fn() };

    search.clearSearch();

    // Nothing should reach the engine: with no config there is no dimension key
    // to address, and inventing one would touch a dimension nobody registered.
    expect(setDimensionSelection).not.toHaveBeenCalled();
  });
});
