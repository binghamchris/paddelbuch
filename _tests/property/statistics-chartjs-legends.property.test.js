/**
 * Property-Based Test: Legend BEM-modifier classes and entry counts
 *
 * Feature: chartjs-statistics-dashboard, Property 5: Legend BEM-modifier classes and entry counts
 *
 * For any valid statistics metrics object with varying numbers of types, verify
 * each legend has correct entry count and BEM-modifier classes.
 *
 * **Validates: Requirements 3.3, 3.4, 3.6**
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

// --- Arbitraries ---

/**
 * Generates a byType array entry with a slug drawn from the given set.
 */
function byTypeEntryArb(slugs) {
  return fc.record({
    slug: fc.constantFrom.apply(fc, slugs),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    count: fc.nat({ max: 10000 })
  });
}

/**
 * Generates a complete statistics metrics object with unique slugs per byType array.
 */
var metricsArb = fc.record({
  spots: fc.record({
    total: fc.nat({ max: 50000 }),
    byType: fc.uniqueArray(byTypeEntryArb(SPOT_TYPE_SLUGS), {
      minLength: 0,
      maxLength: 6,
      selector: function(entry) { return entry.slug; }
    })
  }),
  obstacles: fc.record({
    total: fc.nat({ max: 10000 }),
    withPortageRoute: fc.nat({ max: 5000 }),
    withoutPortageRoute: fc.nat({ max: 5000 })
  }),
  protectedAreas: fc.record({
    total: fc.nat({ max: 10000 }),
    byType: fc.uniqueArray(byTypeEntryArb(PA_TYPE_SLUGS), {
      minLength: 0,
      maxLength: 9,
      selector: function(entry) { return entry.slug; }
    })
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

describe('Legend BEM-modifier classes and entry counts (Property 5)', function () {
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

    // Mock PaddelbuchColors with known colour keys
    window.PaddelbuchColors = {
      spotTypeEntryExit: '#2e86c1',
      spotTypeEntryOnly: '#28b463',
      spotTypeExitOnly: '#e67e22',
      spotTypeRest: '#8e44ad',
      spotTypeEmergency: '#c0392b',
      spotTypeNoEntry: '#7f8c8d',
      obstacleWithPortage: '#07753f',
      obstacleWithoutPortage: '#c40200',
      paTypeNaturschutzgebiet: '#1a5276',
      paTypeFahrverbotzone: '#d4ac0d',
      paTypeSchilfgebiet: '#117a65',
      paTypeSchwimmbereich: '#2980b9',
      paTypeIndustriegebiet: '#6c3483',
      paTypeSchiesszone: '#a93226',
      paTypeTeleskizone: '#d68910',
      paTypePrivatbesitz: '#839192',
      paTypeWasserskizone: '#1f618d',
      green1: '#07753f',
      warningYellow: '#ffb200',
      dangerRed: '#c40200',
      purple1: '#69599b'
    };

    // Initialise dashboard data holder
    window.PaddelbuchDashboardData = { statisticsMetrics: {} };

    // Clear any previously loaded module
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;

    // Clear require cache so the IIFE re-executes
    delete require.cache[modulePath];
  });

  afterEach(function () {
    // Clean up globals
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete window._chartInstances;
    document.body.innerHTML = '';
  });

  it('renders correct legend entry counts and BEM-modifier swatch classes for any valid metrics', function () {
    // Load the module (registers on window)
    require(modulePath);

    var dashboard = window.PaddelbuchStatisticsDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(metricsArb, function (metrics) {
        // Set metrics data before activation
        window.PaddelbuchDashboardData.statisticsMetrics = metrics;

        // Reset chart tracking
        window._chartInstances.length = 0;

        // Activate the dashboard
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl });

        // Query all .statistics-legend elements - they appear in order:
        // index 0 = spots, index 1 = obstacles, index 2 = protected areas
        var legends = contentEl.querySelectorAll('.statistics-legend');

        if (legends.length !== 3) {
          throw new Error(
            'Expected 3 legends but found ' + legends.length
          );
        }

        // --- Spots legend (index 0) ---
        var spotsLegend = legends[0];
        var spotsItems = spotsLegend.querySelectorAll('.statistics-legend-item');
        var expectedSpotCount = (metrics.spots.byType || []).length;

        if (spotsItems.length !== expectedSpotCount) {
          throw new Error(
            'Spots legend: expected ' + expectedSpotCount +
            ' items but found ' + spotsItems.length
          );
        }

        // Verify each spot swatch has the correct positional BEM-modifier class
        var sortedSpotsByType = (metrics.spots.byType || []).slice().sort(function(a, b) { return b.count - a.count; });
        for (var s = 0; s < spotsItems.length; s++) {
          var spotSwatch = spotsItems[s].querySelector('.statistics-legend-swatch');
          if (!spotSwatch) {
            throw new Error(
              'Spots legend item ' + s + ' is missing a .statistics-legend-swatch element'
            );
          }
          var expectedSpotClass = 'statistics-legend-swatch--spot-pos-' + s;
          if (!spotSwatch.classList.contains(expectedSpotClass)) {
            throw new Error(
              'Spots legend swatch ' + s + ': expected class "' + expectedSpotClass +
              '" but found classes "' + spotSwatch.className + '"'
            );
          }
        }

        // --- Obstacles legend (index 1) ---
        var obstaclesLegend = legends[1];
        var obstaclesItems = obstaclesLegend.querySelectorAll('.statistics-legend-item');

        if (obstaclesItems.length !== 2) {
          throw new Error(
            'Obstacles legend: expected 2 items but found ' + obstaclesItems.length
          );
        }

        // Verify obstacle swatches contain both with-portage and without-portage (order depends on counts)
        var obstacleSlugsFound = [];
        for (var oi = 0; oi < 2; oi++) {
          var obsSwatch = obstaclesItems[oi].querySelector('.statistics-legend-swatch');
          if (!obsSwatch) {
            throw new Error('Obstacles legend item ' + oi + ' is missing a .statistics-legend-swatch element');
          }
          if (obsSwatch.classList.contains('statistics-legend-swatch--with-portage')) {
            obstacleSlugsFound.push('with-portage');
          } else if (obsSwatch.classList.contains('statistics-legend-swatch--without-portage')) {
            obstacleSlugsFound.push('without-portage');
          } else {
            throw new Error(
              'Obstacles legend item ' + oi + ': unexpected swatch classes "' + obsSwatch.className + '"'
            );
          }
        }
        if (obstacleSlugsFound.indexOf('with-portage') === -1 || obstacleSlugsFound.indexOf('without-portage') === -1) {
          throw new Error('Obstacles legend: missing expected swatch classes, found: ' + obstacleSlugsFound.join(', '));
        }

        // --- Protected areas legend (index 2) ---
        var paLegend = legends[2];
        var paItems = paLegend.querySelectorAll('.statistics-legend-item');
        var expectedPACount = (metrics.protectedAreas.byType || []).length;

        if (paItems.length !== expectedPACount) {
          throw new Error(
            'Protected areas legend: expected ' + expectedPACount +
            ' items but found ' + paItems.length
          );
        }

        // Verify each PA swatch has the correct positional BEM-modifier class
        var sortedPAByType = (metrics.protectedAreas.byType || []).slice().sort(function(a, b) { return b.count - a.count; });
        for (var p = 0; p < paItems.length; p++) {
          var paSwatch = paItems[p].querySelector('.statistics-legend-swatch');
          if (!paSwatch) {
            throw new Error(
              'PA legend item ' + p + ' is missing a .statistics-legend-swatch element'
            );
          }
          var expectedPAClass = 'statistics-legend-swatch--pa-pos-' + p;
          if (!paSwatch.classList.contains(expectedPAClass)) {
            throw new Error(
              'PA legend swatch ' + p + ': expected class "' + expectedPAClass +
              '" but found classes "' + paSwatch.className + '"'
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
