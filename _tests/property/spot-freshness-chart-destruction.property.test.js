/**
 * Property-Based Test: Chart destroyed on deactivation
 *
 * Feature: spot-freshness-dashboard, Property 5: Chart destroyed on deactivation
 *
 * For any activation followed by deactivation of the Spot Freshness Dashboard,
 * all Chart.js instances created during activation should be destroyed
 * (no lingering chart references).
 *
 * **Validates: Requirements 3.4, 8.2**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Arbitraries ---

/**
 * Generates random freshness metrics { fresh, aging, stale } with
 * non-negative integer counts.
 */
var freshnessMetricsArb = fc.record({
  fresh: fc.nat({ max: 10000 }),
  aging: fc.nat({ max: 10000 }),
  stale: fc.nat({ max: 10000 })
});

/**
 * Generates a random number of activate/deactivate cycles (1–5).
 */
var cycleCountArb = fc.integer({ min: 1, max: 5 });

describe('Spot Freshness Chart Destruction (Property 5)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');
  var chartInstances;

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock Chart.js — captures every instance created
    chartInstances = [];
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

    window.PaddelbuchColors = {
      green1: '#07753f',
      warningYellow: '#ffb200',
      dangerRed: '#c40200'
    };
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

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
    document.body.innerHTML = '';
  });

  /**
   * Feature: spot-freshness-dashboard, Property 5: Chart destroyed on deactivation
   *
   * **Validates: Requirements 3.4, 8.2**
   *
   * For any freshness metrics and any number of activate/deactivate cycles,
   * after each deactivation all Chart.js instances created during the preceding
   * activation should have .destroy() called, and no instances should linger.
   */
  it('all Chart.js instances are destroyed after each deactivation cycle', function () {
    require(modulePath);

    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(freshnessMetricsArb, cycleCountArb, function (metrics, cycles) {
        // Set metrics data
        window.PaddelbuchDashboardData.statisticsMetrics = {
          spots: { freshness: metrics }
        };

        for (var c = 0; c < cycles; c++) {
          // Reset tracking for this cycle
          chartInstances.length = 0;

          // --- Activate ---
          var contentEl = document.getElementById('dashboard-content');
          dashboard.activate({ contentEl: contentEl });

          var createdCount = chartInstances.length;

          // At least one chart should be created when Chart is available
          if (createdCount < 1) {
            throw new Error(
              'Cycle ' + (c + 1) + ': Expected at least 1 Chart.js instance after activate(), got ' + createdCount
            );
          }

          // Verify none are destroyed yet
          for (var i = 0; i < chartInstances.length; i++) {
            if (chartInstances[i].destroyed) {
              throw new Error(
                'Cycle ' + (c + 1) + ': Instance ' + i + ' should not be destroyed immediately after activate()'
              );
            }
          }

          // Keep references to instances from this activation
          var batch = chartInstances.slice();

          // --- Deactivate ---
          dashboard.deactivate();

          // Verify ALL instances from this activation have been destroyed
          for (var j = 0; j < batch.length; j++) {
            if (!batch[j].destroyed) {
              throw new Error(
                'Cycle ' + (c + 1) + ': Instance ' + j + ' should have destroyed === true after deactivate()'
              );
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
