/**
 * Property-Based Test: All UI elements cleared on deactivation
 *
 * Feature: spot-freshness-dashboard, Property 11: All UI elements cleared on deactivation
 *
 * For any activation followed by deactivation of the Spot Freshness Dashboard,
 * the `#dashboard-legend`, `#dashboard-content`, `#dashboard-title`, and
 * `#dashboard-description` elements should all have empty content, and the map
 * should have no markers from this dashboard.
 *
 * **Validates: Requirements 8.1, 8.3, 5.5**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Arbitraries ---

/**
 * Generates random freshness metrics { fresh, aging, stale }.
 */
var freshnessMetricsArb = fc.record({
  fresh: fc.nat({ max: 500 }),
  aging: fc.nat({ max: 500 }),
  stale: fc.nat({ max: 500 })
});

/**
 * Generates a valid spot entry with non-null lat, lon, and a valid category.
 */
var validSpotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 20 }),
  lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
  category: fc.constantFrom('fresh', 'aging', 'stale')
});

/**
 * Generates a random array of spot data entries (0-30 items).
 */
var spotArrayArb = fc.array(validSpotArb, { minLength: 0, maxLength: 30 });

describe('Spot Freshness Deactivation Cleanup (Property 11)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');
  var layerGroupRemoved;

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    layerGroupRemoved = false;

    // Mock Chart.js
    window.Chart = function MockChart(canvas, config) {
      return {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () { this.destroyed = true; }
      };
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
          remove: function () {
            layerGroupRemoved = true;
            this._layers = [];
          }
        };
      },
      marker: function (latlng, opts) {
        return { latlng: latlng, options: opts, bindPopup: function () { return this; } };
      },
      divIcon: function (opts) { return opts; }
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
   * Feature: spot-freshness-dashboard, Property 11: All UI elements cleared on deactivation
   *
   * **Validates: Requirements 8.1, 8.3, 5.5**
   *
   * For any random spot data and freshness metrics, after activate() then
   * deactivate(), all four DOM elements (#dashboard-legend, #dashboard-content,
   * #dashboard-title, #dashboard-description) should have empty content, and
   * the marker layer group should have been removed from the map.
   */
  it('all UI elements are empty and markers removed after activate then deactivate', function () {
    require(modulePath);

    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(freshnessMetricsArb, spotArrayArb, function (metrics, spots) {
        // Reset tracking
        layerGroupRemoved = false;

        // Set data
        window.PaddelbuchDashboardData.statisticsMetrics = {
          spots: { freshness: metrics }
        };
        window.PaddelbuchDashboardData.spotFreshnessMapData = spots;

        var mockMap = {};
        var contentEl = document.getElementById('dashboard-content');

        // --- Activate ---
        dashboard.activate({ contentEl: contentEl, map: mockMap });

        // Verify activation actually rendered something when there is data
        var legendEl = document.getElementById('dashboard-legend');
        var titleEl = document.getElementById('dashboard-title');

        // Legend should have content after activation (always 3 entries)
        if (legendEl.innerHTML === '') {
          throw new Error('Legend should have content after activation');
        }
        // Title should have content after activation
        if (titleEl.textContent === '') {
          throw new Error('Title should have content after activation');
        }

        // --- Deactivate ---
        dashboard.deactivate();

        // Verify all four DOM elements are empty
        var legend = document.getElementById('dashboard-legend');
        if (legend.innerHTML !== '') {
          throw new Error(
            '#dashboard-legend should be empty after deactivate, got: ' + legend.innerHTML
          );
        }

        var content = document.getElementById('dashboard-content');
        if (content.innerHTML !== '') {
          throw new Error(
            '#dashboard-content should be empty after deactivate, got: ' + content.innerHTML
          );
        }

        var title = document.getElementById('dashboard-title');
        if (title.textContent !== '') {
          throw new Error(
            '#dashboard-title should be empty after deactivate, got: ' + title.textContent
          );
        }

        var description = document.getElementById('dashboard-description');
        if (description.innerHTML !== '') {
          throw new Error(
            '#dashboard-description should be empty after deactivate, got: ' + description.innerHTML
          );
        }

        // Verify marker layer group was removed (if spots were provided)
        if (spots.length > 0 && !layerGroupRemoved) {
          throw new Error(
            'Marker layer group should have been removed from the map after deactivate'
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
