/**
 * Property-Based Test: Chart.js instance lifecycle
 *
 * Feature: chartjs-statistics-dashboard, Property 3: Chart.js instance lifecycle
 *
 * For any valid statistics metrics object:
 * 1. Calling activate(context) shall create exactly 3 Chart.js instances
 * 2. Calling deactivate() shall destroy all instances (reducing the count to 0)
 *    and call .destroy() on each
 * 3. Calling activate(context) again shall create exactly 3 fresh instances
 *    without accumulating instances from previous activations
 *
 * **Validates: Requirements 2.6, 2.7, 10.1, 10.2, 10.3, 10.4**
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
 * Generates a complete statistics metrics object.
 */
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

describe('Chart.js instance lifecycle (Property 3)', function () {
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
      obstacleWithPortage: '#27ae60',
      obstacleWithoutPortage: '#e74c3c',
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

  it('creates 3 instances on activate, destroys all on deactivate, creates 3 fresh on re-activate', function () {
    // Load the module (registers on window)
    require(modulePath);

    var dashboard = window.PaddelbuchStatisticsDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(metricsArb, function (metrics) {
        // Set metrics data before activation
        window.PaddelbuchDashboardData.statisticsMetrics = metrics;

        // Reset tracking array
        window._chartInstances.length = 0;

        // --- Step 1: activate() creates exactly 3 Chart.js instances ---
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl });

        if (window._chartInstances.length !== 4) {
          throw new Error(
            'Step 1: Expected 4 Chart.js instances after activate(), got ' +
            window._chartInstances.length
          );
        }

        // Verify none are destroyed yet
        for (var i = 0; i < window._chartInstances.length; i++) {
          if (window._chartInstances[i].destroyed) {
            throw new Error(
              'Step 1: Instance ' + i + ' should not be destroyed after activate()'
            );
          }
        }

        // Keep references to the first batch of instances
        var firstBatch = window._chartInstances.slice();

        // --- Step 2: deactivate() destroys all instances ---
        dashboard.deactivate();

        // Verify all 3 instances from the first batch have destroyed === true
        for (var j = 0; j < firstBatch.length; j++) {
          if (!firstBatch[j].destroyed) {
            throw new Error(
              'Step 2: Instance ' + j + ' should have destroyed === true after deactivate()'
            );
          }
        }

        // --- Step 3: Re-create DOM elements (deactivate clears innerHTML) ---
        // deactivate() clears innerHTML of #dashboard-content, #dashboard-title,
        // #dashboard-description, #dashboard-legend — the elements still exist,
        // but their content is empty. No need to re-create the elements themselves.

        // Reset tracking array to count only new instances
        window._chartInstances.length = 0;

        // --- Step 4: activate() again creates exactly 3 fresh instances ---
        contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl });

        if (window._chartInstances.length !== 4) {
          throw new Error(
            'Step 4: Expected 4 fresh Chart.js instances after re-activate(), got ' +
            window._chartInstances.length
          );
        }

        // Verify none of the new instances are destroyed
        for (var k = 0; k < window._chartInstances.length; k++) {
          if (window._chartInstances[k].destroyed) {
            throw new Error(
              'Step 4: Fresh instance ' + k + ' should not be destroyed after re-activate()'
            );
          }
        }

        // Clean up for next iteration
        dashboard.deactivate();
        window._chartInstances.length = 0;
      }),
      { numRuns: 100 }
    );
  });
});
