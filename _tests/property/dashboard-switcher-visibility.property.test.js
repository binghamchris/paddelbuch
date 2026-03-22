/**
 * Property-Based Test for Map/Content Container Visibility
 *
 * // Feature: data-quality-dashboards, Property 9: Map/content container visibility
 * **Validates: Requirements 7.4, 7.5**
 *
 * Property: For any dashboard activation, if the dashboard's usesMap is
 * true, the map container shall be visible and the content container hidden;
 * if usesMap is false, the map container shall be hidden and the content
 * container visible.
 *
 * @jest-environment jsdom
 */

const fc = require('fast-check');

/**
 * Creates a fake dashboard with a given id and usesMap value.
 */
function createFakeDashboard(id, usesMap) {
  return {
    id: id,
    getName: jest.fn(function () { return 'Dashboard ' + id; }),
    usesMap: usesMap,
    activate: jest.fn(),
    deactivate: jest.fn()
  };
}

/**
 * Sets up the required DOM elements for the switcher.
 */
function setupDOM() {
  document.body.innerHTML =
    '<div id="dashboard-switcher"></div>' +
    '<div id="dashboard-map"></div>' +
    '<div id="dashboard-content"></div>' +
    '<div id="dashboard-legend"></div>';
}

/**
 * Sets up the required window globals for the switcher module.
 */
function setupGlobals(dashboards) {
  var mockMap = { invalidateSize: jest.fn() };

  window.PaddelbuchDashboardRegistry = dashboards;
  window.PaddelbuchDashboardMap = {
    map: mockMap,
    getMap: jest.fn(function () { return mockMap; })
  };
  window.PaddelbuchDashboardData = {
    freshnessMetrics: [],
    coverageMetrics: []
  };
}

/**
 * Loads the switcher module in isolation so the IIFE re-executes
 * with fresh closure state.
 */
function loadSwitcher() {
  delete window.PaddelbuchDashboardSwitcher;
  jest.isolateModules(function () {
    require('../../assets/js/dashboard-switcher.js');
  });
  return window.PaddelbuchDashboardSwitcher;
}

afterEach(function () {
  document.body.innerHTML = '';
  delete window.PaddelbuchDashboardSwitcher;
  delete window.PaddelbuchDashboardRegistry;
  delete window.PaddelbuchDashboardMap;
  delete window.PaddelbuchDashboardData;
});

describe('Dashboard Switcher Container Visibility - Property 9', function () {
  /**
   * Property 9: For any dashboard activation, if the dashboard's usesMap
   * is true, the map container shall be visible and the content container
   * hidden; if usesMap is false, the map container shall be hidden and the
   * content container visible.
   */
  test('map and content container visibility matches the active dashboard usesMap flag', function () {
    var scenarioArb = fc.integer({ min: 1, max: 6 }).chain(function (n) {
      return fc.tuple(
        fc.array(fc.boolean(), { minLength: n, maxLength: n }),
        fc.array(fc.integer({ min: 0, max: n - 1 }), { minLength: 1, maxLength: 20 })
      );
    });

    fc.assert(
      fc.property(scenarioArb, function (scenario) {
        var usesMapValues = scenario[0];
        var selections = scenario[1];

        var dashboards = [];
        for (var i = 0; i < usesMapValues.length; i++) {
          dashboards.push(createFakeDashboard('dash-' + i, usesMapValues[i]));
        }

        setupDOM();
        setupGlobals(dashboards);
        var switcher = loadSwitcher();

        var mapEl = document.getElementById('dashboard-map');
        var contentEl = document.getElementById('dashboard-content');

        // After init, dashboard 0 is active -- verify its visibility
        if (dashboards[0].usesMap) {
          expect(mapEl.style.display).toBe('');
          expect(contentEl.style.display).toBe('none');
        } else {
          expect(mapEl.style.display).toBe('none');
          expect(contentEl.style.display).toBe('');
        }

        // Walk through the random selection sequence
        for (var s = 0; s < selections.length; s++) {
          var selectedIdx = selections[s];
          var selectedId = 'dash-' + selectedIdx;

          // Simulate a tab click via the exposed API (handles both
          // same-tab no-op and cross-tab switch)
          switcher.activateDashboard(selectedId);

          var selectedDashboard = dashboards[selectedIdx];

          if (selectedDashboard.usesMap) {
            // Map visible, content hidden
            expect(mapEl.style.display).toBe('');
            expect(contentEl.style.display).toBe('none');
          } else {
            // Map hidden, content visible
            expect(mapEl.style.display).toBe('none');
            expect(contentEl.style.display).toBe('');
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
