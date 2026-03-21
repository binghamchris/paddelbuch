/**
 * Property-Based Test: Legend has exactly three entries
 *
 * Feature: spot-freshness-dashboard, Property 8: Legend has exactly three entries
 *
 * For any spot data input (including empty data), the shared legend should always
 * render exactly three entries: Fresh, Aging, and Stale. The "No Data" category
 * from the Waterway Freshness Dashboard should never appear.
 *
 * **Validates: Requirements 5.2**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Constants ---

var VALID_CATEGORIES = ['fresh', 'aging', 'stale'];

// --- Arbitraries ---

/**
 * Generates a valid spot entry with non-null lat, lon, and a valid category.
 */
var validSpotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 30 }),
  lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
  category: fc.constantFrom('fresh', 'aging', 'stale')
});

/**
 * Generates an invalid spot entry — missing lat, lon, or category.
 */
var invalidSpotArb = fc.oneof(
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.constant(null),
    lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
    category: fc.constantFrom('fresh', 'aging', 'stale')
  }),
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
    lon: fc.constant(null),
    category: fc.constant(null)
  })
);

/**
 * Generates a mixed array of valid and invalid spot entries (including empty).
 */
var spotArrayArb = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: validSpotArb },
    { weight: 1, arbitrary: invalidSpotArb }
  ),
  { minLength: 0, maxLength: 40 }
);

/**
 * Generates random freshness metrics { fresh, aging, stale }.
 */
var freshnessMetricsArb = fc.record({
  fresh: fc.nat({ max: 10000 }),
  aging: fc.nat({ max: 10000 }),
  stale: fc.nat({ max: 10000 })
});

describe('Spot Freshness Legend (Property 8)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock Chart.js
    window.Chart = function MockChart(canvas, config) {
      var instance = {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () { this.destroyed = true; }
      };
      return instance;
    };

    window.PaddelbuchColors = {
      green1: '#07753f',
      warningYellow: '#ffb200',
      dangerRed: '#c40200'
    };

    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    // Mock Leaflet
    window.L = {
      layerGroup: function () {
        return {
          _layers: [],
          addLayer: function (layer) { this._layers.push(layer); },
          addTo: function () { return this; },
          remove: function () { this._layers = []; }
        };
      },
      marker: function (latlng, opts) {
        return { latlng: latlng, options: opts, bindPopup: function () { return this; } };
      },
      divIcon: function (opts) {
        return opts;
      }
    };

    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete require.cache[modulePath];
  });

  afterEach(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete window.L;
    document.body.innerHTML = '';
  });

  /**
   * Feature: spot-freshness-dashboard, Property 8: Legend has exactly three entries
   *
   * **Validates: Requirements 5.2**
   *
   * For any spot data input (including empty data), the shared legend should
   * always render exactly three entries: Fresh, Aging, and Stale. The "No Data"
   * category from the Waterway Freshness Dashboard should never appear.
   */
  it('legend always renders exactly three entries (Fresh, Aging, Stale) for any spot data', function () {
    require(modulePath);

    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(spotArrayArb, freshnessMetricsArb, function (spots, metrics) {
        // Set data
        window.PaddelbuchDashboardData.spotFreshnessMapData = spots;
        window.PaddelbuchDashboardData.statisticsMetrics = {
          spots: { freshness: metrics }
        };

        // Activate
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl, map: {} });

        // Query legend entries
        var legendEl = document.getElementById('dashboard-legend');
        var entries = legendEl.querySelectorAll('.dashboard-legend-item');

        // Must be exactly 3
        if (entries.length !== 3) {
          throw new Error(
            'Expected exactly 3 legend entries but got ' + entries.length +
            ' (spots count: ' + spots.length + ')'
          );
        }

        // Verify no "No Data" text appears in the legend
        var legendText = legendEl.textContent.toLowerCase();
        if (legendText.indexOf('no data') !== -1 || legendText.indexOf('keine daten') !== -1) {
          throw new Error(
            'Legend should not contain a "No Data" entry but found: ' + legendEl.textContent
          );
        }

        // Deactivate to clean up
        dashboard.deactivate();
      }),
      { numRuns: 100 }
    );
  });
});
