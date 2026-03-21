/**
 * Property-Based Test: Summary figure BEM-modifier classes
 *
 * Feature: chartjs-statistics-dashboard, Property 6: Summary figure BEM-modifier classes
 *
 * For any valid statistics metrics object, each rendered summary figure shall
 * have a BEM-modifier CSS class derived from its metric section.
 *
 * **Validates: Requirements 4.4**
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
    { minLength: 1, maxLength: 5 }
  ),
  dataSourceTypes: fc.array(
    fc.record({
      slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      count: fc.nat({ max: 10000 })
    }),
    { minLength: 1, maxLength: 5 }
  ),
  dataLicenseTypes: fc.array(
    fc.record({
      slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      count: fc.nat({ max: 10000 })
    }),
    { minLength: 1, maxLength: 5 }
  )
});

describe('Summary figure BEM-modifier classes (Property 6)', function () {
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

  it('renders correct BEM-modifier classes on all summary figures for any valid metrics', function () {
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

        // --- Bar chart section figures: spots, obstacles, protected-areas ---
        var barSections = ['spots', 'spot-freshness', 'obstacles', 'protected-areas'];
        for (var b = 0; b < barSections.length; b++) {
          var sectionSlug = barSections[b];
          var figure = contentEl.querySelector('.statistics-figure--' + sectionSlug);
          if (!figure) {
            throw new Error(
              'Missing summary figure with BEM modifier ".statistics-figure--' +
              sectionSlug + '"'
            );
          }
          if (!figure.classList.contains('statistics-figure')) {
            throw new Error(
              'Figure with modifier "--' + sectionSlug +
              '" is missing base class ".statistics-figure"'
            );
          }
        }

        // --- Figures sections: paddleCraftTypes, dataSourceTypes, dataLicenseTypes ---
        var figuresGrids = contentEl.querySelectorAll('.statistics-figures-grid');
        if (figuresGrids.length !== 3) {
          throw new Error(
            'Expected 3 .statistics-figures-grid containers but found ' +
            figuresGrids.length
          );
        }

        // Grid 0 = paddleCraftTypes, Grid 1 = dataSourceTypes, Grid 2 = dataLicenseTypes
        var figureSections = [
          { name: 'paddleCraftTypes', items: metrics.paddleCraftTypes, grid: figuresGrids[0] },
          { name: 'dataSourceTypes', items: metrics.dataSourceTypes, grid: figuresGrids[1] },
          { name: 'dataLicenseTypes', items: metrics.dataLicenseTypes, grid: figuresGrids[2] }
        ];

        for (var f = 0; f < figureSections.length; f++) {
          var section = figureSections[f];
          var figures = section.grid.querySelectorAll('.statistics-figure');

          if (figures.length !== section.items.length) {
            throw new Error(
              section.name + ': expected ' + section.items.length +
              ' figures but found ' + figures.length
            );
          }

          for (var i = 0; i < section.items.length; i++) {
            var expectedSlug = section.items[i].slug;
            var expectedClass = 'statistics-figure--' + expectedSlug;
            if (!figures[i].classList.contains(expectedClass)) {
              throw new Error(
                section.name + ' figure ' + i +
                ': expected class "' + expectedClass +
                '" but found classes "' + figures[i].className + '"'
              );
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
