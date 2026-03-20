/**
 * Property-Based Test for Switcher State Management
 *
 * // Feature: data-quality-dashboards, Property 7: Switcher state management
 * **Validates: Requirements 1.9, 7.6**
 *
 * Property: For any sequence of dashboard selections from the registry,
 * after each selection only the most recently selected dashboard's layers
 * shall be present on the map (or its content visible in the content
 * container), and all previously active dashboards shall have been
 * deactivated with no residual layers or DOM content.
 *
 * @jest-environment jsdom
 */

const fc = require('fast-check');

/**
 * Creates a fake dashboard with jest.fn() spies for activate/deactivate.
 */
function createFakeDashboard(id) {
  return {
    id: id,
    getName: jest.fn(function () { return 'Dashboard ' + id; }),
    usesMap: true,
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

describe('Dashboard Switcher State Management - Property 7', function () {
  /**
   * Property 7: For any sequence of dashboard selections, after each
   * selection only the most recently selected dashboard is active and
   * all others have been deactivated with no residual state.
   *
   * We simulate tab clicks (which skip re-activation of the already-active
   * dashboard) and verify the invariant after every step.
   */
  test('only the most recently selected dashboard is active after any selection sequence', function () {
    var registrySizeArb = fc.integer({ min: 2, max: 6 });

    var scenarioArb = registrySizeArb.chain(function (n) {
      return fc.tuple(
        fc.constant(n),
        fc.array(fc.integer({ min: 0, max: n - 1 }), { minLength: 1, maxLength: 20 })
      );
    });

    fc.assert(
      fc.property(scenarioArb, function (scenario) {
        var n = scenario[0];
        var selections = scenario[1];

        var dashboards = [];
        for (var i = 0; i < n; i++) {
          dashboards.push(createFakeDashboard('dash-' + i));
        }

        setupDOM();
        setupGlobals(dashboards);
        var switcher = loadSwitcher();

        // After init, dashboard 0 is active. Clear counters for clean reasoning.
        for (var i = 0; i < dashboards.length; i++) {
          dashboards[i].activate.mockClear();
          dashboards[i].deactivate.mockClear();
        }

        var currentActiveIdx = 0;

        for (var s = 0; s < selections.length; s++) {
          var selectedIdx = selections[s];
          var selectedId = 'dash-' + selectedIdx;

          // Clear call counts before this step
          for (var j = 0; j < dashboards.length; j++) {
            dashboards[j].activate.mockClear();
            dashboards[j].deactivate.mockClear();
          }

          // Simulate a tab click via the DOM button
          var btn = document.querySelector('[data-dashboard-id="' + selectedId + '"]');
          btn.click();

          // --- Invariant 1: getActiveDashboard returns the selected dashboard ---
          var active = switcher.getActiveDashboard();
          if (active !== dashboards[selectedIdx]) {
            return false;
          }

          if (selectedIdx !== currentActiveIdx) {
            // --- Invariant 2: The newly selected dashboard was activated exactly once ---
            if (dashboards[selectedIdx].activate.mock.calls.length !== 1) {
              return false;
            }

            // --- Invariant 3: The previously active dashboard was deactivated exactly once ---
            if (dashboards[currentActiveIdx].deactivate.mock.calls.length !== 1) {
              return false;
            }

            // --- Invariant 4: No other dashboard was touched ---
            for (var k = 0; k < dashboards.length; k++) {
              if (k === selectedIdx || k === currentActiveIdx) continue;
              if (dashboards[k].activate.mock.calls.length !== 0) return false;
              if (dashboards[k].deactivate.mock.calls.length !== 0) return false;
            }

            currentActiveIdx = selectedIdx;
          } else {
            // Clicking the already-active tab is a no-op (onTabClick guards this)
            // --- Invariant 5: No dashboard was activated or deactivated ---
            for (var k = 0; k < dashboards.length; k++) {
              if (dashboards[k].activate.mock.calls.length !== 0) return false;
              if (dashboards[k].deactivate.mock.calls.length !== 0) return false;
            }
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
