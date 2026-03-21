/**
 * Property-Based Test: Chart.js dataset colour and label correctness
 *
 * Feature: chartjs-statistics-dashboard, Property 2: Chart.js dataset colour and label correctness
 *
 * For any valid statistics metrics object and for any bar chart section, each
 * Chart.js dataset's backgroundColor shall equal the colour value from
 * PaddelbuchColors for the corresponding segment slug, and each dataset's label
 * shall equal the localised type name from the metrics data.
 *
 * **Validates: Requirements 2.4, 2.5**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- Known slugs ---

var SPOT_TYPE_SLUGS = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle',
  'no-entry'
];

var PA_TYPE_SLUGS = [
  'naturschutzgebiet',
  'fahrverbotzone',
  'schilfgebiet',
  'schwimmbereich',
  'industriegebiet',
  'schiesszone',
  'teleskizone',
  'privatbesitz',
  'wasserskizone'
];

// --- Gradient arrays (must match the module's SPOT_GRADIENT / PA_GRADIENT) ---
// Colours are assigned by sort position (index 0 = largest category = darkest).

var SPOT_GRADIENT_COLORS = [
  '#4c0561', '#e07a5f', '#2a9d8f', '#cb3cf6', '#69599b', '#e693be'
];

var PA_GRADIENT_COLORS = [
  '#4c0561', '#e07a5f', '#2a9d8f', '#cb3cf6', '#437695', '#e693be',
  '#69599b', '#3cc4f6', '#606589'
];

var OBSTACLE_COLOR_MAP = {
  'with-portage': 'obstacleWithPortage',
  'without-portage': 'obstacleWithoutPortage'
};

// --- Mock PaddelbuchColors values ---

var MOCK_COLORS = {
  // Gradient palette keys used by SPOT_GRADIENT / PA_GRADIENT in the module
  chartGradientSpot1: '#4c0561',
  chartGradientSpot2: '#e07a5f',
  chartGradientSpot3: '#2a9d8f',
  chartGradientSpot4: '#cb3cf6',
  chartGradientSpot5: '#69599b',
  chartGradientSpot6: '#e693be',
  chartGradientPa1: '#4c0561',
  chartGradientPa2: '#e07a5f',
  chartGradientPa3: '#2a9d8f',
  chartGradientPa4: '#cb3cf6',
  chartGradientPa5: '#437695',
  chartGradientPa6: '#e693be',
  chartGradientPa7: '#69599b',
  chartGradientPa8: '#3cc4f6',
  chartGradientPa9: '#606589',
  // Obstacle colours (slug-based)
  obstacleWithPortage: '#07753f',
  obstacleWithoutPortage: '#c40200'
};

// --- Arbitraries ---

function byTypeEntryArb(slugs) {
  return fc.record({
    slug: fc.constantFrom.apply(fc, slugs),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    count: fc.nat({ max: 10000 })
  });
}

var metricsArb = fc.record({
  spots: fc.record({
    total: fc.nat({ max: 50000 }),
    byType: fc.array(byTypeEntryArb(SPOT_TYPE_SLUGS), { minLength: 0, maxLength: 6 })
  }),
  obstacles: fc.record({
    total: fc.nat({ max: 10000 }),
    withPortageRoute: fc.nat({ max: 5000 }),
    withoutPortageRoute: fc.nat({ max: 5000 })
  }),
  protectedAreas: fc.record({
    total: fc.nat({ max: 10000 }),
    byType: fc.array(byTypeEntryArb(PA_TYPE_SLUGS), { minLength: 0, maxLength: 9 })
  }),
  paddleCraftTypes: fc.array(
    fc.record({
      slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      count: fc.nat({ max: 10000 })
    }),
    { minLength: 0, maxLength: 5 }
  ),
  dataSourceTypes: fc.array(
    fc.record({
      slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      count: fc.nat({ max: 10000 })
    }),
    { minLength: 0, maxLength: 5 }
  ),
  dataLicenseTypes: fc.array(
    fc.record({
      slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      count: fc.nat({ max: 10000 })
    }),
    { minLength: 0, maxLength: 5 }
  )
});


describe('Chart.js dataset colour and label correctness (Property 2)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/statistics-dashboard.js');

  beforeEach(function () {
    // Set up DOM elements required by the module
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock window.Chart as a constructor that records calls
    var chartInstances = [];
    window._chartInstances = chartInstances;
    window.Chart = function MockChart(canvas, config) {
      var instance = {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () {
          this.destroyed = true;
        }
      };
      chartInstances.push(instance);
      return instance;
    };

    // Mock PaddelbuchColors with known colour values
    window.PaddelbuchColors = Object.assign({}, MOCK_COLORS);

    // Initialise dashboard data holder
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    // Clear any previously loaded module
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;

    // Clear require cache so the IIFE re-executes
    delete require.cache[modulePath];
  });

  afterEach(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete window._chartInstances;
    document.body.innerHTML = '';
  });

  it('each Chart.js dataset backgroundColor matches PaddelbuchColors and label matches the localised type name', function () {
    // Load the module
    require(modulePath);

    var dashboard = window.PaddelbuchStatisticsDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(metricsArb, function (metrics) {
        // Set metrics data before activation
        window.PaddelbuchDashboardData.statisticsMetrics = metrics;

        // Reset chart instances
        window._chartInstances.length = 0;

        // Activate the dashboard
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl });

        // Should have exactly 3 chart instances (spots, obstacles, protected-areas)
        if (window._chartInstances.length !== 3) {
          throw new Error(
            'Expected 3 Chart instances but found ' + window._chartInstances.length
          );
        }

        // --- Spots chart (index 0) ---
        var spotsChart = window._chartInstances[0];
        var spotsDatasets = spotsChart.config.data.datasets;
        var spotsByType = (metrics.spots.byType || []).slice().sort(function(a, b) { return b.count - a.count; });

        if (spotsDatasets.length !== spotsByType.length) {
          throw new Error(
            'Spots chart: expected ' + spotsByType.length +
            ' datasets but found ' + spotsDatasets.length
          );
        }

        for (var i = 0; i < spotsByType.length; i++) {
          var spotEntry = spotsByType[i];
          var spotDataset = spotsDatasets[i];
          var expectedColor = SPOT_GRADIENT_COLORS[i] || '#999999';

          if (spotDataset.backgroundColor !== expectedColor) {
            throw new Error(
              'Spots dataset[' + i + '] (slug: ' + spotEntry.slug +
              '): expected backgroundColor "' + expectedColor +
              '" but got "' + spotDataset.backgroundColor + '"'
            );
          }

          if (spotDataset.label !== spotEntry.name) {
            throw new Error(
              'Spots dataset[' + i + '] (slug: ' + spotEntry.slug +
              '): expected label "' + spotEntry.name +
              '" but got "' + spotDataset.label + '"'
            );
          }
        }

        // --- Obstacles chart (index 1) ---
        var obstaclesChart = window._chartInstances[1];
        var obstaclesDatasets = obstaclesChart.config.data.datasets;

        // Obstacles always have exactly 2 datasets: with-portage and without-portage
        // After sorting by count descending, order depends on data
        if (obstaclesDatasets.length !== 2) {
          throw new Error(
            'Obstacles chart: expected 2 datasets but found ' + obstaclesDatasets.length
          );
        }

        var expectedWithLabel = 'Mit Portage-Route';
        var expectedWithoutLabel = 'Ohne Portage-Route';
        var expectedWithPortageColor = MOCK_COLORS[OBSTACLE_COLOR_MAP['with-portage']];
        var expectedWithoutPortageColor = MOCK_COLORS[OBSTACLE_COLOR_MAP['without-portage']];

        for (var oi = 0; oi < 2; oi++) {
          var od = obstaclesDatasets[oi];
          if (od.label === expectedWithLabel) {
            if (od.backgroundColor !== expectedWithPortageColor) {
              throw new Error(
                'Obstacles with-portage: expected backgroundColor "' +
                expectedWithPortageColor + '" but got "' + od.backgroundColor + '"'
              );
            }
          } else if (od.label === expectedWithoutLabel) {
            if (od.backgroundColor !== expectedWithoutPortageColor) {
              throw new Error(
                'Obstacles without-portage: expected backgroundColor "' +
                expectedWithoutPortageColor + '" but got "' + od.backgroundColor + '"'
              );
            }
          } else {
            throw new Error(
              'Obstacles dataset[' + oi + ']: unexpected label "' + od.label + '"'
            );
          }
        }

        // --- Protected areas chart (index 2) ---
        var paChart = window._chartInstances[2];
        var paDatasets = paChart.config.data.datasets;
        var paByType = (metrics.protectedAreas.byType || []).slice().sort(function(a, b) { return b.count - a.count; });

        if (paDatasets.length !== paByType.length) {
          throw new Error(
            'Protected areas chart: expected ' + paByType.length +
            ' datasets but found ' + paDatasets.length
          );
        }

        for (var j = 0; j < paByType.length; j++) {
          var paEntry = paByType[j];
          var paDataset = paDatasets[j];
          var expectedPaColor = PA_GRADIENT_COLORS[j] || '#999999';

          if (paDataset.backgroundColor !== expectedPaColor) {
            throw new Error(
              'PA dataset[' + j + '] (slug: ' + paEntry.slug +
              '): expected backgroundColor "' + expectedPaColor +
              '" but got "' + paDataset.backgroundColor + '"'
            );
          }

          if (paDataset.label !== paEntry.name) {
            throw new Error(
              'PA dataset[' + j + '] (slug: ' + paEntry.slug +
              '): expected label "' + paEntry.name +
              '" but got "' + paDataset.label + '"'
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
