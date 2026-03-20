/**
 * Unit Tests for Freshness Dashboard Module
 *
 * Tests legend DOM structure, popup HTML classes, layer creation,
 * activation/deactivation lifecycle, and registry integration.
 *
 * Validates: Requirements 3.9, 6.5
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

  // Provide sample freshness metrics
  window.PaddelbuchDashboardData = {
    freshnessMetrics: [
      {
        slug: 'zurichsee',
        name: 'Zürichsee',
        spotCount: 12,
        medianAgeDays: 450,
        color: '#4ab31f',
        geometry: { type: 'Polygon', coordinates: [[[8.5, 47.3], [8.6, 47.3], [8.6, 47.4], [8.5, 47.3]]] }
      },
      {
        slug: 'aare',
        name: 'Aare',
        spotCount: 0,
        medianAgeDays: null,
        color: '#9013fe',
        geometry: { type: 'LineString', coordinates: [[7.4, 46.9], [7.5, 47.0]] }
      }
    ],
    coverageMetrics: []
  };
}

function setupDOM() {
  document.body.innerHTML =
    '<div id="dashboard-legend"></div>' +
    '<script type="application/json" id="freshness-i18n">' +
    JSON.stringify({
      name: 'Data Freshness',
      legend_title: 'Median Age of Entries',
      fresh: 'Fresh (0 days)',
      aging: 'Aging (3 years)',
      stale: 'Stale (5+ years)',
      no_data: 'No Data',
      popup_spots: 'Spots',
      popup_median_age: 'Median Age',
      popup_days: 'days',
      popup_no_data: 'No data available'
    }) +
    '</script>';
}

function loadModule() {
  delete window.PaddelbuchFreshnessDashboard;
  delete window.PaddelbuchDashboardRegistry;
  jest.isolateModules(function() {
    require('../../assets/js/freshness-dashboard.js');
  });
  return window.PaddelbuchFreshnessDashboard;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.PaddelbuchFreshnessDashboard;
  delete window.PaddelbuchDashboardRegistry;
  delete window.PaddelbuchDashboardData;
  delete global.L;
});

describe('PaddelbuchFreshnessDashboard', () => {
  test('has id "freshness"', () => {
    setupDOM();
    setupGlobals();
    var mod = loadModule();
    expect(mod.id).toBe('freshness');
  });

  test('getName() returns localised name', () => {
    setupDOM();
    setupGlobals();
    var mod = loadModule();
    expect(mod.getName()).toBe('Data Freshness');
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
    expect(registry[0].id).toBe('freshness');
  });

  describe('activate()', () => {
    test('creates L.geoJSON layers for each metric with geometry', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      // Two metrics, both have geometry
      expect(global.L.geoJSON).toHaveBeenCalledTimes(2);
    });

    test('applies correct colour styling from pre-computed metric', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // First call: Zürichsee with green colour
      var firstCallOpts = global.L.geoJSON.mock.calls[0][1];
      expect(firstCallOpts.style.color).toBe('#4ab31f');
      expect(firstCallOpts.style.fillColor).toBe('#4ab31f');

      // Second call: Aare with purple (no data)
      var secondCallOpts = global.L.geoJSON.mock.calls[1][1];
      expect(secondCallOpts.style.color).toBe('#9013fe');
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

    test('popup HTML contains popup-btn class', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('popup-btn');
    });

    test('popup HTML includes waterway name', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      var popupHtml = mockLayers[0].bindPopup.mock.calls[0][0];
      expect(popupHtml).toContain('Zürichsee');
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

    test('skips metrics without geometry', () => {
      setupDOM();
      setupGlobals();
      // Add a metric with no geometry
      window.PaddelbuchDashboardData.freshnessMetrics.push({
        slug: 'no-geom',
        name: 'No Geom',
        spotCount: 0,
        medianAgeDays: null,
        color: '#9013fe',
        geometry: null
      });
      var mod = loadModule();

      mod.activate({ map: mockMap, legendEl: document.getElementById('dashboard-legend') });

      // Only 2 layers created (the third metric has no geometry)
      expect(global.L.geoJSON).toHaveBeenCalledTimes(2);
    });
  });

  describe('legend rendering', () => {
    test('renders legend with gradient bar', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      expect(legendEl.innerHTML).toContain('dashboard-legend-gradient');
      expect(legendEl.innerHTML).toContain('dashboard-legend-bar');
    });

    test('renders legend with "no data" indicator', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      expect(legendEl.innerHTML).toContain('No Data');
      expect(legendEl.innerHTML).toContain('#9013fe');
    });

    test('renders legend title', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      expect(legendEl.querySelector('h4').textContent).toBe('Median Age of Entries');
    });

    test('renders fresh/aging/stale labels', () => {
      setupDOM();
      setupGlobals();
      var mod = loadModule();
      var legendEl = document.getElementById('dashboard-legend');

      mod.activate({ map: mockMap, legendEl: legendEl });

      var html = legendEl.innerHTML;
      expect(html).toContain('Fresh (0 days)');
      expect(html).toContain('Aging (3 years)');
      expect(html).toContain('Stale (5+ years)');
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
    test('uses German defaults when #freshness-i18n is missing', () => {
      // Set up DOM without i18n block
      document.body.innerHTML = '<div id="dashboard-legend"></div>';
      setupGlobals();
      var mod = loadModule();

      expect(mod.getName()).toBe('Datenaktualität');
    });
  });
});
