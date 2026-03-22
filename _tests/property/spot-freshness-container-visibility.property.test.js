/**
 * Property-Based Tests: Container visibility for Spot Freshness Dashboard
 *
 * Feature: spot-freshness-dashboard, Property 1: Dual-container visibility on activation
 * Feature: spot-freshness-dashboard, Property 2: Container visibility reverts on dashboard switch
 *
 * Property 1: For any dashboard module with `usesBoth: true`, when activated
 * via the dashboard switcher, both `#dashboard-map` and `#dashboard-content`
 * containers should have `display` not equal to `'none'`.
 *
 * Property 2: For any sequence where a `usesBoth` dashboard is activated
 * followed by a non-`usesBoth` dashboard, the second activation should
 * restore the standard single-container visibility.
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');

/**
 * Arbitrary that generates a random dashboard configuration object.
 * usesMap and usesBoth are independent booleans.
 */
var dashboardConfigArb = fc.record({
  usesMap: fc.boolean(),
  usesBoth: fc.boolean()
});

/**
 * Creates a fake dashboard with the given id and configuration.
 *
 * @param {string} id
 * @param {Object} config - { usesMap, usesBoth }
 * @returns {Object} dashboard module stub
 */
function createFakeDashboard(id, config) {
  var d = {
    id: id,
    getName: jest.fn(function () { return 'Dashboard ' + id; }),
    usesMap: config.usesMap,
    activate: jest.fn(),
    deactivate: jest.fn()
  };
  if (config.usesBoth) {
    d.usesBoth = true;
  }
  return d;
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

describe('Spot Freshness Container Visibility Properties', function () {
  /**
   * Feature: spot-freshness-dashboard, Property 1: Dual-container visibility on activation
   *
   * **Validates: Requirements 2.1**
   *
   * For any dashboard module with usesBoth: true, when activated via the
   * dashboard switcher, both #dashboard-map and #dashboard-content containers
   * should have display not equal to 'none'.
   */
  it('both containers are visible when a usesBoth dashboard is activated', function () {
    fc.assert(
      fc.property(
        // Generate 1-5 non-usesBoth dashboards as padding, plus one usesBoth dashboard
        fc.array(dashboardConfigArb, { minLength: 0, maxLength: 5 }),
        dashboardConfigArb,
        function (otherConfigs, usesBothBase) {
          // Force the target dashboard to have usesBoth: true
          var usesBothConfig = { usesMap: usesBothBase.usesMap, usesBoth: true };

          // Build the registry: other dashboards first, then the usesBoth one
          var dashboards = [];
          for (var i = 0; i < otherConfigs.length; i++) {
            dashboards.push(createFakeDashboard('other-' + i, otherConfigs[i]));
          }
          var usesBothDashboard = createFakeDashboard('uses-both', usesBothConfig);
          dashboards.push(usesBothDashboard);

          setupDOM();
          setupGlobals(dashboards);
          var switcher = loadSwitcher();

          // Activate the usesBoth dashboard
          switcher.activateDashboard('uses-both');

          var mapEl = document.getElementById('dashboard-map');
          var contentEl = document.getElementById('dashboard-content');

          // Both containers must be visible (display !== 'none')
          if (mapEl.style.display === 'none') {
            throw new Error(
              '#dashboard-map should be visible for usesBoth dashboard, but display is "none"'
            );
          }
          if (contentEl.style.display === 'none') {
            throw new Error(
              '#dashboard-content should be visible for usesBoth dashboard, but display is "none"'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: spot-freshness-dashboard, Property 2: Container visibility reverts on dashboard switch
   *
   * **Validates: Requirements 2.2**
   *
   * For any sequence where a usesBoth dashboard is activated followed by a
   * non-usesBoth dashboard, the second activation should restore the standard
   * single-container visibility: if usesMap is true then content is hidden and
   * map is shown, if usesMap is false then map is hidden and content is shown.
   */
  it('container visibility reverts to standard logic after switching from usesBoth to non-usesBoth', function () {
    fc.assert(
      fc.property(
        // Generate a non-usesBoth dashboard config for the second activation
        fc.record({
          usesMap: fc.boolean(),
          usesBoth: fc.constant(false)
        }),
        // The usesBoth dashboard can have any usesMap value
        fc.boolean(),
        function (nonBothConfig, usesBothUsesMap) {
          var usesBothDashboard = createFakeDashboard('both-dash', {
            usesMap: usesBothUsesMap,
            usesBoth: true
          });
          var standardDashboard = createFakeDashboard('standard-dash', nonBothConfig);

          setupDOM();
          setupGlobals([usesBothDashboard, standardDashboard]);
          var switcher = loadSwitcher();

          // Step 1: Activate the usesBoth dashboard
          switcher.activateDashboard('both-dash');

          // Step 2: Switch to the non-usesBoth dashboard
          switcher.activateDashboard('standard-dash');

          var mapEl = document.getElementById('dashboard-map');
          var contentEl = document.getElementById('dashboard-content');

          if (nonBothConfig.usesMap) {
            // Standard map dashboard: map visible, content hidden
            if (mapEl.style.display === 'none') {
              throw new Error(
                'After switching to usesMap:true dashboard, #dashboard-map should be visible but display is "none"'
              );
            }
            if (contentEl.style.display !== 'none') {
              throw new Error(
                'After switching to usesMap:true dashboard, #dashboard-content should be hidden but display is "' +
                contentEl.style.display + '"'
              );
            }
          } else {
            // Standard content dashboard: map hidden, content visible
            if (mapEl.style.display !== 'none') {
              throw new Error(
                'After switching to usesMap:false dashboard, #dashboard-map should be hidden but display is "' +
                mapEl.style.display + '"'
              );
            }
            if (contentEl.style.display === 'none') {
              throw new Error(
                'After switching to usesMap:false dashboard, #dashboard-content should be visible but display is "none"'
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
