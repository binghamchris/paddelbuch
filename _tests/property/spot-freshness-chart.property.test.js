/**
 * Property-Based Tests: Chart colours and data for Spot Freshness Dashboard
 *
 * Feature: spot-freshness-dashboard, Property 3: Chart colours match PaddelbuchColors
 * Feature: spot-freshness-dashboard, Property 4: Chart data reflects pre-computed metrics
 *
 * Property 3: For any PaddelbuchColors configuration, the spot freshness chart
 * datasets shall use colors.green1 for the Fresh segment, colors.warningYellow
 * for the Aging segment, and colors.dangerRed for the Stale segment — with no
 * hardcoded hex values.
 *
 * Property 4: For any freshness metrics object { fresh: F, aging: A, stale: S },
 * the chart shall render three dataset segments whose percentage values correspond
 * to F/(F+A+S)*100, A/(F+A+S)*100, and S/(F+A+S)*100 respectively.
 *
 * **Validates: Requirements 3.2, 3.3, 5.4**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Arbitraries ---

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

/**
 * Generates random freshness metrics { fresh, aging, stale } with
 * non-negative integer counts.
 */
var freshnessMetricsArb = fc.record({
  fresh: fc.nat({ max: 10000 }),
  aging: fc.nat({ max: 10000 }),
  stale: fc.nat({ max: 10000 })
});

describe('Spot Freshness Chart Properties', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');
  var chartInstances = [];
  var colorsObj;

  beforeAll(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock Chart.js — captures every instance created
    window.Chart = function MockChart(canvas, config) {
      var instance = {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () { this.destroyed = true; }
      };
      chartInstances.push(instance);
      return instance;
    };

    // Create a mutable colours object; the module captures a reference to it
    colorsObj = { green1: '#07753f', warningYellow: '#ffb200', dangerRed: '#c40200' };
    window.PaddelbuchColors = colorsObj;
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    require(modulePath);
  });

  afterAll(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete require.cache[modulePath];
    document.body.innerHTML = '';
  });

  /**
   * Feature: spot-freshness-dashboard, Property 3: Chart colours match PaddelbuchColors
   *
   * **Validates: Requirements 3.2, 5.4**
   *
   * For each random PaddelbuchColors configuration, mutate the shared colours
   * object and verify createStackedBarChart uses the correct colour values via
   * getColor() for each freshness category.
   */
  it('chart dataset colours match PaddelbuchColors for each freshness category', function () {
    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(paddelbuchColorsArb, freshnessMetricsArb, function (colors, metrics) {
        chartInstances.length = 0;

        // Mutate the shared object so the module's captured reference sees new values
        colorsObj.green1 = colors.green1;
        colorsObj.warningYellow = colors.warningYellow;
        colorsObj.dangerRed = colors.dangerRed;

        var colorMap = dashboard.FRESHNESS_COLOR_MAP;

        // Verify the colour map keys are correct
        if (colorMap['fresh'] !== 'green1') {
          throw new Error('FRESHNESS_COLOR_MAP.fresh should be "green1", got "' + colorMap['fresh'] + '"');
        }
        if (colorMap['aging'] !== 'warningYellow') {
          throw new Error('FRESHNESS_COLOR_MAP.aging should be "warningYellow", got "' + colorMap['aging'] + '"');
        }
        if (colorMap['stale'] !== 'dangerRed') {
          throw new Error('FRESHNESS_COLOR_MAP.stale should be "dangerRed", got "' + colorMap['stale'] + '"');
        }

        // Build segments the same way activate() does
        var segments = [
          { name: 'Fresh', count: metrics.fresh, colorKey: colorMap['fresh'], slug: 'fresh' },
          { name: 'Aging', count: metrics.aging, colorKey: colorMap['aging'], slug: 'aging' },
          { name: 'Stale', count: metrics.stale, colorKey: colorMap['stale'], slug: 'stale' }
        ];

        var canvas = document.createElement('canvas');
        dashboard.createStackedBarChart(canvas, segments);

        if (chartInstances.length !== 1) {
          throw new Error('Expected 1 chart instance, got ' + chartInstances.length);
        }

        var datasets = chartInstances[0].config.data.datasets;

        if (datasets.length !== 3) {
          throw new Error('Expected 3 datasets, got ' + datasets.length);
        }

        // Fresh segment uses green1
        if (datasets[0].backgroundColor !== colors.green1) {
          throw new Error(
            'Fresh segment: expected "' + colors.green1 +
            '" but got "' + datasets[0].backgroundColor + '"'
          );
        }

        // Aging segment uses warningYellow
        if (datasets[1].backgroundColor !== colors.warningYellow) {
          throw new Error(
            'Aging segment: expected "' + colors.warningYellow +
            '" but got "' + datasets[1].backgroundColor + '"'
          );
        }

        // Stale segment uses dangerRed
        if (datasets[2].backgroundColor !== colors.dangerRed) {
          throw new Error(
            'Stale segment: expected "' + colors.dangerRed +
            '" but got "' + datasets[2].backgroundColor + '"'
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: spot-freshness-dashboard, Property 4: Chart data reflects pre-computed metrics
   *
   * **Validates: Requirements 3.3**
   *
   * For each random freshness metrics object, verify the chart data percentages
   * match F/(F+A+S)*100, A/(F+A+S)*100, S/(F+A+S)*100.
   */
  it('chart dataset percentages match F/(F+A+S)*100, A/(F+A+S)*100, S/(F+A+S)*100', function () {
    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(freshnessMetricsArb, function (metrics) {
        chartInstances.length = 0;

        var colorMap = dashboard.FRESHNESS_COLOR_MAP;
        var segments = [
          { name: 'Fresh', count: metrics.fresh, colorKey: colorMap['fresh'], slug: 'fresh' },
          { name: 'Aging', count: metrics.aging, colorKey: colorMap['aging'], slug: 'aging' },
          { name: 'Stale', count: metrics.stale, colorKey: colorMap['stale'], slug: 'stale' }
        ];

        var canvas = document.createElement('canvas');
        dashboard.createStackedBarChart(canvas, segments);

        if (chartInstances.length !== 1) {
          throw new Error('Expected 1 chart instance, got ' + chartInstances.length);
        }

        var datasets = chartInstances[0].config.data.datasets;
        var total = metrics.fresh + metrics.aging + metrics.stale;

        var expectedFresh = total > 0 ? (metrics.fresh / total) * 100 : 0;
        var expectedAging = total > 0 ? (metrics.aging / total) * 100 : 0;
        var expectedStale = total > 0 ? (metrics.stale / total) * 100 : 0;

        var actualFresh = datasets[0].data[0];
        var actualAging = datasets[1].data[0];
        var actualStale = datasets[2].data[0];

        var epsilon = 1e-9;

        if (Math.abs(actualFresh - expectedFresh) > epsilon) {
          throw new Error(
            'Fresh percentage: expected ' + expectedFresh +
            ' but got ' + actualFresh +
            ' (metrics: fresh=' + metrics.fresh + ', aging=' + metrics.aging + ', stale=' + metrics.stale + ')'
          );
        }

        if (Math.abs(actualAging - expectedAging) > epsilon) {
          throw new Error(
            'Aging percentage: expected ' + expectedAging +
            ' but got ' + actualAging +
            ' (metrics: fresh=' + metrics.fresh + ', aging=' + metrics.aging + ', stale=' + metrics.stale + ')'
          );
        }

        if (Math.abs(actualStale - expectedStale) > epsilon) {
          throw new Error(
            'Stale percentage: expected ' + expectedStale +
            ' but got ' + actualStale +
            ' (metrics: fresh=' + metrics.fresh + ', aging=' + metrics.aging + ', stale=' + metrics.stale + ')'
          );
        }

        // When total > 0, percentages should sum to ~100
        if (total > 0) {
          var sum = actualFresh + actualAging + actualStale;
          if (Math.abs(sum - 100) > epsilon) {
            throw new Error('Percentages should sum to 100, but got ' + sum);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
