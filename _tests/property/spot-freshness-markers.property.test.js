/**
 * Property-Based Tests: Marker count and shape/colour for Spot Freshness Dashboard
 *
 * Feature: spot-freshness-dashboard, Property 6: Marker count equals valid spots
 * Feature: spot-freshness-dashboard, Property 7: Marker shape and colour match freshness category
 *
 * Property 6: For any array of spot data entries, the number of markers added to
 * the map should equal the count of entries that have a non-null lat, non-null lon,
 * and a valid category (fresh, aging, or stale). Spots failing any of these
 * conditions should produce zero markers.
 *
 * Property 7: For any spot with a valid category and location, the marker should
 * use the correct SVG shape element (circle for fresh, polygon for aging, rect for
 * stale) and the correct fill colour from PaddelbuchColors.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Constants ---

var VALID_CATEGORIES = ['fresh', 'aging', 'stale'];

/**
 * Expected SVG shape element tag for each freshness category.
 */
var EXPECTED_SHAPE_ELEMENTS = {
  fresh: 'circle',
  aging: 'polygon',
  stale: 'rect'
};

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
  // null lat
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.constant(null),
    lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
    category: fc.constantFrom('fresh', 'aging', 'stale')
  }),
  // null lon
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
    lon: fc.constant(null),
    category: fc.constantFrom('fresh', 'aging', 'stale')
  }),
  // missing category (empty string is falsy)
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
    lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
    category: fc.constant('')
  }),
  // null category
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
    lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
    category: fc.constant(null)
  }),
  // invalid category string (not in SHAPES)
  fc.record({
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
    lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true }),
    category: fc.string({ minLength: 1, maxLength: 10 }).filter(function (s) {
      return VALID_CATEGORIES.indexOf(s) === -1;
    })
  })
);

/**
 * Generates a mixed array of valid and invalid spot entries.
 */
var spotArrayArb = fc.array(
  fc.oneof(
    { weight: 3, arbitrary: validSpotArb },
    { weight: 1, arbitrary: invalidSpotArb }
  ),
  { minLength: 0, maxLength: 40 }
);

/**
 * Generates a random hex colour string like '#a1b2c3'.
 */
var hexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(function (rgb) {
  function toHex(n) {
    var h = n.toString(16);
    return h.length === 1 ? '0' + h : h;
  }
  return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
});

/**
 * Generates a random PaddelbuchColors object with the three freshness colour keys.
 */
var paddelbuchColorsArb = fc.record({
  green1: hexColorArb,
  warningYellow: hexColorArb,
  dangerRed: hexColorArb
});


describe('Spot Freshness Marker Properties', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');
  var markersAdded;
  var divIconCalls;
  var colorsObj;

  beforeAll(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    markersAdded = [];
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

    // Mutable colours object — the module captures a reference to this
    colorsObj = { green1: '#07753f', warningYellow: '#ffb200', dangerRed: '#c40200' };
    window.PaddelbuchColors = colorsObj;
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    // Mock Leaflet — the module captures window.L at load time
    window.L = {
      layerGroup: function () {
        return {
          _layers: [],
          addLayer: function (layer) {
            this._layers.push(layer);
            markersAdded.push(layer);
          },
          addTo: function () { return this; },
          remove: function () { this._layers = []; }
        };
      },
      marker: function (latlng, opts) {
        return { latlng: latlng, options: opts };
      },
      divIcon: function (opts) {
        divIconCalls.push(opts);
        return opts;
      }
    };

    require(modulePath);
  });

  afterAll(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete window.L;
    delete require.cache[modulePath];
    document.body.innerHTML = '';
  });

  /**
   * Feature: spot-freshness-dashboard, Property 6: Marker count equals valid spots
   *
   * **Validates: Requirements 4.1, 4.5, 4.6**
   *
   * For any array of spot data entries (some valid, some with null lat/lon/category),
   * the number of markers added to the layer group should equal the count of entries
   * with non-null lat, non-null lon, and a valid category (fresh, aging, or stale).
   */
  it('marker count equals the number of entries with valid lat, lon, and category', function () {
    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(spotArrayArb, function (spots) {
        // Reset tracking
        markersAdded.length = 0;
        divIconCalls.length = 0;

        // Set spot data
        window.PaddelbuchDashboardData.spotFreshnessMapData = spots;

        // Build a mock map object
        var mockMap = {};

        // Activate
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl, map: mockMap });

        // Count expected valid spots: non-null lat, non-null lon, and category in VALID_CATEGORIES
        var expectedCount = 0;
        for (var i = 0; i < spots.length; i++) {
          var s = spots[i];
          if (s.lat != null && s.lon != null && s.category && VALID_CATEGORIES.indexOf(s.category) !== -1) {
            expectedCount++;
          }
        }

        if (markersAdded.length !== expectedCount) {
          throw new Error(
            'Expected ' + expectedCount + ' markers but got ' + markersAdded.length +
            ' (spots: ' + JSON.stringify(spots.map(function (s) {
              return { lat: s.lat, lon: s.lon, category: s.category };
            })) + ')'
          );
        }

        // Deactivate to clean up
        dashboard.deactivate();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: spot-freshness-dashboard, Property 7: Marker shape and colour match freshness category
   *
   * **Validates: Requirements 4.2, 4.3**
   *
   * For each valid spot, the marker's divIcon HTML should contain the correct SVG
   * shape element (circle for fresh, polygon for aging, rect for stale) and the
   * correct fill colour resolved from PaddelbuchColors via getColor().
   */
  it('marker SVG contains correct shape element and fill colour for each category', function () {
    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(
        fc.array(validSpotArb, { minLength: 1, maxLength: 30 }),
        paddelbuchColorsArb,
        function (spots, colors) {
          // Reset tracking
          markersAdded.length = 0;
          divIconCalls.length = 0;

          // Mutate the shared colours object
          colorsObj.green1 = colors.green1;
          colorsObj.warningYellow = colors.warningYellow;
          colorsObj.dangerRed = colors.dangerRed;

          // Set spot data (all valid)
          window.PaddelbuchDashboardData.spotFreshnessMapData = spots;

          var mockMap = {};
          var contentEl = document.getElementById('dashboard-content');
          dashboard.activate({ contentEl: contentEl, map: mockMap });

          // Should have one divIcon call per valid spot
          if (divIconCalls.length !== spots.length) {
            throw new Error(
              'Expected ' + spots.length + ' divIcon calls but got ' + divIconCalls.length
            );
          }

          var colorMap = dashboard.FRESHNESS_COLOR_MAP;

          for (var i = 0; i < spots.length; i++) {
            var spot = spots[i];
            var iconOpts = divIconCalls[i];
            var html = iconOpts.html;

            // Verify correct shape element
            var expectedTag = EXPECTED_SHAPE_ELEMENTS[spot.category];
            if (html.indexOf('<' + expectedTag) === -1) {
              throw new Error(
                'Spot ' + i + ' (category=' + spot.category + '): expected <' + expectedTag +
                '> in SVG but got: ' + html
              );
            }

            // Verify correct fill colour
            var colorKey = colorMap[spot.category];
            var expectedColor = dashboard.getColor(colorKey);
            if (html.indexOf('fill="' + expectedColor + '"') === -1) {
              throw new Error(
                'Spot ' + i + ' (category=' + spot.category + '): expected fill="' +
                expectedColor + '" but got: ' + html
              );
            }
          }

          // Deactivate to clean up
          dashboard.deactivate();
        }
      ),
      { numRuns: 100 }
    );
  });
});
