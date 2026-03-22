/**
 * Property-Based Test for Switcher Auto-Discovery
 *
 * // Feature: data-quality-dashboards, Property 8: Switcher auto-discovery
 * **Validates: Requirements 7.2**
 *
 * Property: For any number of dashboard modules registered in
 * PaddelbuchDashboardRegistry, the switcher shall create exactly that many
 * tab buttons, one per registered dashboard, without any code changes to
 * the switcher module.
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

describe('Dashboard Switcher Auto-Discovery - Property 8', function () {
  /**
   * Property 8: For any number of dashboard modules registered in the
   * registry, the switcher creates exactly that many tab buttons, one
   * per registered dashboard.
   */
  test('switcher creates exactly one tab button per registered dashboard', function () {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        function (n) {
          var dashboards = [];
          for (var i = 0; i < n; i++) {
            dashboards.push(createFakeDashboard('dash-' + i));
          }

          setupDOM();
          setupGlobals(dashboards);
          loadSwitcher();

          // Count tab buttons created by the switcher
          var buttons = document.querySelectorAll('[data-dashboard-id]');

          // Invariant 1: Exactly n tab buttons exist
          expect(buttons.length).toBe(n);

          // Invariant 2: Each button's data-dashboard-id matches the
          // corresponding dashboard's id
          for (var i = 0; i < n; i++) {
            expect(buttons[i].getAttribute('data-dashboard-id')).toBe(dashboards[i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
