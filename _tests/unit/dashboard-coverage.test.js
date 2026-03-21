/**
 * Unit Tests for Coverage Dashboard Module
 *
 * Tests legend DOM structure, popup HTML classes, layer creation with
 * correct colours, activation/deactivation lifecycle, and registry integration.
 *
 * Validates: Requirements 4.6, 6.5
 *
 * @jest-environment jsdom
 */

var mockLayers;
var mockMap;

function createMockLayer() {
  var layer = {
    bindPopup: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn()
  };
  mockLayers.push(layer);
  return layer;
}

function setupGlobals() {
  mockLayers = [];
  mockMap = { invalidateSize: jest.fn() };

  global.L = {
    geoJSON: jest.fn(function(_geojson, _opts) {
      return createMockLayer();
    })
  };

  window.PaddelbuchDashboardData = {
    freshnessMetrics: [],
    coverageMetrics: [
      {
        slug: 'aare',
        name: 'Aare',
        spotCount: 5,
        coveredSegments: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [[7.4, 46.9], [7.45, 46.95]] } }
        ],
        uncoveredSegments: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [[7.5, 47.0], [7.55, 47.05]] } }
        ]
      }
    ]
  };
}

function setupDOM() {
  document.body.innerHTML =
    '<div id="dashboard-legend"></div>' +
    '<script type="application/json" id="coverage-i18n">' +
    JSON.stringify({
      name: 'Waterway Coverage',
      description: 'How much of the length of each river or shore of each lake has spots.',
      legend_title: 'Waterway Coverage',
      covered: 'Covered (within 5 km)',
      not_covered: 'Not Covered',
      popup_spots: 'Spots'
    }) +
    '</script>';
}

function loadModule() {
  delete window.PaddelbuchCoverageDashboard;
  delete window.PaddelbuchDashboardRegistry;
  jest.isolateModules(function() {
    require('../../assets/js/coverage-dashboard.js');
  });
  return window.PaddelbuchCoverageDashboard;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.PaddelbuchCoverageDashboard;
  delete window.PaddelbuchDashboardRegistry;
  delete window.PaddelbuchDashboardData;
  delete global.L;
});

describe('PaddelbuchCoverageDashboard', () => {
  test('has id "coverage"', () => {
    setupDOM();
    setupGlobals();
    var mod = loadModule();
    expect(mod.id).toBe('coverage');
  });

  test('getName() returns localised name', () => {
    setupDOM();
    setupGlobals();
    var mod = loadModule();
    expect(mod.getName()).toBe('Waterway Coverage');
  });

  test('usesMap is true', () => {
    setupDOM();
    setupGlobals();
    var mod = loadModule();
    expect(mod.usesMap).toBe(true);
  });

  test('registers on PaddelbuchDashboardRegistry', () => {
    setupDOM();
    setupGlobals();
    loadModule();
    var registry = window.PaddelbuchDashboardRegistry;
    expect(Array.isArray(registry)).toBe(true);
    expect(registry.length).toBe(1);
    expect(registry[0].id).toBe('coverage');
  });

  describe('activate()', () => {
    test('creates L.geoJSON layers for covered and uncovered segments', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // One metric with both covered and uncovered segments = 2 layers
      expect(global.L.geoJSON).toHaveBeenCalledTimes(2);
    });

    test('uses green (#07753f) for covered segments', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // First geoJSON call is for covered segments
      var coveredOpts = global.L.geoJSON.mock.calls[0][1];
      expect(coveredOpts.style.color).toBe('#07753f');
    });

    test('uses red (#c40200) for uncovered segments', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // Second geoJSON call is for uncovered segments
      var uncoveredOpts = global.L.geoJSON.mock.calls[1][1];
      expect(uncoveredOpts.style.color).toBe('#c40200');
    });

    test('binds popup to each layer', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      for (var i = 0; i < mockLayers.length; i++) {
        expect(mockLayers[i].bindPopup).toHaveBeenCalledTimes(1);
      }
    });

    test('popup HTML contains popup-icon-div class', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('popup-icon-div');
    });

    test('popup HTML contains popup-title class', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('popup-title');
    });

    test('popup HTML does not contain popup-btn class (coverage has no detail link)', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).not.toContain('popup-btn');
    });

    test('popup HTML includes waterway name', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('Aare');
    });

    test('adds layers to the map', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      for (var i = 0; i < mockLayers.length; i++) {
        expect(mockLayers[i].addTo).toHaveBeenCalledWith(mockMap);
      }
    });

    test('skips empty covered segments', () => {
      setupDOM();
      setupGlobals();
      // Override with metric that has no covered segments
      window.PaddelbuchDashboardData.coverageMetrics = [{
        slug: 'rhein',
        name: 'Rhein',
        spotCount: 0,
        coveredSegments: null,
        uncoveredSegments: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [[8.0, 47.5], [8.1, 47.6]] } }
        ]
      }];
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // Only 1 layer (uncovered only)
      expect(global.L.geoJSON).toHaveBeenCalledTimes(1);
      expect(global.L.geoJSON.mock.calls[0][1].style.color).toBe('#c40200');
    });
  });

  describe('legend rendering', () => {
    test('renders legend with two items (covered and not covered)', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      var items = legendEl.querySelectorAll('.dashboard-legend-item');
      expect(items.length).toBe(2);
    });

    test('legend contains covered colour class', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      expect(legendEl.innerHTML).toContain('dashboard-legend-swatch--covered');
    });

    test('legend contains uncovered colour class', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      expect(legendEl.innerHTML).toContain('dashboard-legend-swatch--uncovered');
    });

    test('legend contains covered and not covered labels', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      var html = legendEl.innerHTML;
      expect(html).toContain('Covered (within 5 km)');
      expect(html).toContain('Not Covered');
    });
  });

  describe('deactivate()', () => {
    test('removes all layers from the map', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });
      var layersBefore = mockLayers.slice();

      mod.deactivate();

      for (var i = 0; i < layersBefore.length; i++) {
        expect(layersBefore[i].remove).toHaveBeenCalledTimes(1);
      }
    });

    test('clears legend content', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });
      expect(legendEl.innerHTML).not.toBe('');

      mod.deactivate();
      expect(legendEl.innerHTML).toBe('');
    });
  });

  describe('i18n fallback', () => {
    test('uses German defaults when #coverage-i18n is missing', () => {
      document.body.innerHTML = '<div id="dashboard-legend"></div>';
      setupGlobals();
      var mod = loadModule();

      expect(mod.getName()).toBe('Gewässerabdeckung');
    });
  });
});
