/**
 * Unit Tests for Dashboard Data Module
 *
 * Tests JSON block parsing from <script type="application/json"> elements
 * and graceful handling of missing or malformed data.
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 *
 * @jest-environment jsdom
 */

function setJsonBlock(id, data) {
  var el = document.createElement('script');
  el.type = 'application/json';
  el.id = id;
  el.textContent = JSON.stringify(data);
  document.body.appendChild(el);
}

function setRawJsonBlock(id, rawText) {
  var el = document.createElement('script');
  el.type = 'application/json';
  el.id = id;
  el.textContent = rawText;
  document.body.appendChild(el);
}

/**
 * Load the module in isolation and return the exposed global.
 * The IIFE assigns to `window` in jsdom, but jest.isolateModules
 * scopes the require. We read from window after loading.
 */
function loadModule() {
  delete window.PaddelbuchDashboardData;
  var result;
  jest.isolateModules(function() {
    require('../../assets/js/dashboard-data.js');
  });
  result = window.PaddelbuchDashboardData;
  return result;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.PaddelbuchDashboardData;
});

describe('PaddelbuchDashboardData', () => {
  test('parses freshness-data JSON block into freshnessMetrics', () => {
    var freshness = [
      { slug: 'zurichsee', name: 'Zürichsee', spotCount: 12, medianAgeDays: 450, color: '#4ab31f' }
    ];
    setJsonBlock('freshness-data', freshness);
    setJsonBlock('coverage-data', []);

    var data = loadModule();

    expect(data.freshnessMetrics).toEqual(freshness);
  });

  test('parses coverage-data JSON block into coverageMetrics', () => {
    var coverage = [
      { slug: 'aare', name: 'Aare', spotCount: 5, coveredSegments: [], uncoveredSegments: [] }
    ];
    setJsonBlock('freshness-data', []);
    setJsonBlock('coverage-data', coverage);

    var data = loadModule();

    expect(data.coverageMetrics).toEqual(coverage);
  });

  test('returns empty array when freshness-data element is missing', () => {
    setJsonBlock('coverage-data', [{ slug: 'aare' }]);

    var data = loadModule();

    expect(data.freshnessMetrics).toEqual([]);
  });

  test('returns empty array when coverage-data element is missing', () => {
    setJsonBlock('freshness-data', [{ slug: 'zurichsee' }]);

    var data = loadModule();

    expect(data.coverageMetrics).toEqual([]);
  });

  test('returns empty arrays when both elements are missing', () => {
    var data = loadModule();

    expect(data.freshnessMetrics).toEqual([]);
    expect(data.coverageMetrics).toEqual([]);
  });

  test('returns empty array for malformed JSON', () => {
    setRawJsonBlock('freshness-data', '{ invalid json !!!');
    setJsonBlock('coverage-data', []);

    var data = loadModule();

    expect(data.freshnessMetrics).toEqual([]);
  });

  test('returns empty array when JSON block contains a non-array value', () => {
    setJsonBlock('freshness-data', { not: 'an array' });
    setJsonBlock('coverage-data', []);

    var data = loadModule();

    expect(data.freshnessMetrics).toEqual([]);
  });

  test('exposes data on window global', () => {
    setJsonBlock('freshness-data', []);
    setJsonBlock('coverage-data', []);

    loadModule();

    expect(window.PaddelbuchDashboardData).toBeDefined();
    expect(window.PaddelbuchDashboardData).toHaveProperty('freshnessMetrics');
    expect(window.PaddelbuchDashboardData).toHaveProperty('coverageMetrics');
  });

  test('handles multiple freshness metric objects', () => {
    var freshness = [
      { slug: 'zurichsee', name: 'Zürichsee', spotCount: 12, medianAgeDays: 450, color: '#4ab31f' },
      { slug: 'aare', name: 'Aare', spotCount: 8, medianAgeDays: 200, color: '#66cc33' },
      { slug: 'rhein', name: 'Rhein', spotCount: 0, medianAgeDays: null, color: '#9b59b6' }
    ];
    setJsonBlock('freshness-data', freshness);
    setJsonBlock('coverage-data', []);

    var data = loadModule();

    expect(data.freshnessMetrics).toHaveLength(3);
    expect(data.freshnessMetrics).toEqual(freshness);
  });
});
