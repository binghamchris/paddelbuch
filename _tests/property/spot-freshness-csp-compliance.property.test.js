/**
 * Property-Based Test: No inline style attributes in rendered HTML
 *
 * Feature: spot-freshness-dashboard, Property 12: No inline style attributes in rendered HTML
 *
 * For any spot data input, the HTML rendered by the Spot Freshness Dashboard
 * (legend, chart container, markers) should not contain any style="..."
 * attributes. All styling must be applied via CSS classes or Leaflet's
 * programmatic style API.
 *
 * Note: SVG attributes like stroke-width are NOT style attributes. Only the
 * pattern style=" is checked.
 *
 * **Validates: Requirements 9.2, 9.4**
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
 * Generates an invalid spot entry -- missing lat, lon, or category.
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

/**
 * Checks that a given HTML string contains no style="..." attributes.
 * Returns an object { found: boolean, count: number } for reporting.
 */
function checkNoInlineStyles(html) {
  var matches = html.match(/style\s*=/gi);
  return {
    found: matches !== null,
    count: matches ? matches.length : 0
  };
}

describe('Spot Freshness CSP Compliance (Property 12)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');
  var divIconCalls;

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    divIconCalls = [];

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

    // Mock Leaflet -- capture divIcon HTML for inspection
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
        divIconCalls.push(opts);
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
   * Feature: spot-freshness-dashboard, Property 12: No inline style attributes in rendered HTML
   *
   * **Validates: Requirements 9.2, 9.4**
   *
   * For any spot data input, the rendered legend, chart container, and marker
   * divIcon HTML should contain no style="..." attributes.
   */
  it('rendered HTML contains no style= attributes in legend, chart container, or markers', function () {
    require(modulePath);

    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(spotArrayArb, freshnessMetricsArb, function (spots, metrics) {
        // Reset divIcon tracking
        divIconCalls.length = 0;

        // Set data
        window.PaddelbuchDashboardData.spotFreshnessMapData = spots;
        window.PaddelbuchDashboardData.statisticsMetrics = {
          spots: { freshness: metrics }
        };

        // Activate
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl, map: {} });

        // --- Check #dashboard-legend ---
        var legendEl = document.getElementById('dashboard-legend');
        var legendHtml = legendEl.innerHTML;
        var legendCheck = checkNoInlineStyles(legendHtml);
        if (legendCheck.found) {
          throw new Error(
            'Found ' + legendCheck.count + ' style= attribute(s) in #dashboard-legend: ' +
            legendHtml.substring(0, 300)
          );
        }

        // --- Check #dashboard-content ---
        var contentHtml = contentEl.innerHTML;
        var contentCheck = checkNoInlineStyles(contentHtml);
        if (contentCheck.found) {
          throw new Error(
            'Found ' + contentCheck.count + ' style= attribute(s) in #dashboard-content: ' +
            contentHtml.substring(0, 300)
          );
        }

        // --- Check divIcon HTML passed to Leaflet markers ---
        for (var i = 0; i < divIconCalls.length; i++) {
          var iconHtml = divIconCalls[i].html || '';
          var iconCheck = checkNoInlineStyles(iconHtml);
          if (iconCheck.found) {
            throw new Error(
              'Found ' + iconCheck.count + ' style= attribute(s) in divIcon HTML for marker ' +
              i + ': ' + iconHtml
            );
          }
        }

        // Deactivate to clean up
        dashboard.deactivate();
      }),
      { numRuns: 100 }
    );
  });
});
