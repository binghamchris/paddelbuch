/**
 * Unit Tests for Dashboard Switcher Module
 *
 * Tests tab creation, activation/deactivation flow, container visibility
 * toggling based on usesMap, and auto-initialisation.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 3.9, 4.6, 6.5
 *
 * @jest-environment jsdom
 */

var mockMap;

function createFakeDashboard(id, name, usesMap) {
  return {
    id: id,
    getName: jest.fn(function() { return name; }),
    usesMap: usesMap !== undefined ? usesMap : true,
    activate: jest.fn(),
    deactivate: jest.fn()
  };
}

function setupDOM() {
  document.body.innerHTML =
    '<div id="dashboard-switcher"></div>' +
    '<div id="dashboard-map"></div>' +
    '<div id="dashboard-content"></div>' +
    '<div id="dashboard-legend"></div>';
}

function setupGlobals(dashboards) {
  mockMap = { invalidateSize: jest.fn() };

  window.PaddelbuchDashboardRegistry = dashboards || [];
  window.PaddelbuchDashboardMap = {
    map: mockMap,
    getMap: jest.fn(function() { return mockMap; })
  };
  window.PaddelbuchDashboardData = {
    freshnessMetrics: [],
    coverageMetrics: []
  };
}

function loadModule() {
  delete window.PaddelbuchDashboardSwitcher;
  jest.isolateModules(function() {
    require('../../assets/js/dashboard-switcher.js');
  });
  return window.PaddelbuchDashboardSwitcher;
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.PaddelbuchDashboardSwitcher;
  delete window.PaddelbuchDashboardRegistry;
  delete window.PaddelbuchDashboardMap;
  delete window.PaddelbuchDashboardData;
});

describe('PaddelbuchDashboardSwitcher', () => {
  describe('tab creation', () => {
    test('creates one tab button per registered dashboard', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      var buttons = document.querySelectorAll('[data-dashboard-id]');
      expect(buttons.length).toBe(2);
    });

    test('tab buttons use dashboard getName() as text', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Waterway Freshness');
      var d2 = createFakeDashboard('coverage', 'Waterway Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      var buttons = document.querySelectorAll('[data-dashboard-id]');
      expect(buttons[0].textContent).toBe('Waterway Freshness');
      expect(buttons[1].textContent).toBe('Waterway Coverage');
    });

    test('tab buttons have data-dashboard-id attribute', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      setupGlobals([d1]);

      loadModule();

      var btn = document.querySelector('[data-dashboard-id]');
      expect(btn.getAttribute('data-dashboard-id')).toBe('freshness');
    });

    test('creates button wrapper structure', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      setupGlobals([d1]);

      loadModule();

      var wrapper = document.querySelector('#dashboard-switcher .dashboard-switcher-buttons');
      expect(wrapper).not.toBeNull();
    });

    test('creates no tabs when registry is empty', () => {
      setupDOM();
      setupGlobals([]);

      loadModule();

      var buttons = document.querySelectorAll('[data-dashboard-id]');
      expect(buttons.length).toBe(0);
    });
  });

  describe('initial activation', () => {
    test('activates the first registered dashboard on init', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      expect(d1.activate).toHaveBeenCalledTimes(1);
      expect(d2.activate).not.toHaveBeenCalled();
    });

    test('first tab has active class after init', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      var buttons = document.querySelectorAll('[data-dashboard-id]');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(false);
    });

    test('passes context with map to activate()', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      setupGlobals([d1]);

      loadModule();

      var context = d1.activate.mock.calls[0][0];
      expect(context.map).toBe(mockMap);
      expect(context.legendEl).toBe(document.getElementById('dashboard-legend'));
      expect(context.contentEl).toBe(document.getElementById('dashboard-content'));
    });
  });

  describe('tab switching', () => {
    test('clicking a tab activates the corresponding dashboard', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      // Click the second tab
      var buttons = document.querySelectorAll('[data-dashboard-id]');
      buttons[1].click();

      expect(d2.activate).toHaveBeenCalledTimes(1);
    });

    test('deactivates previous dashboard when switching', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      // Click the second tab
      var buttons = document.querySelectorAll('[data-dashboard-id]');
      buttons[1].click();

      expect(d1.deactivate).toHaveBeenCalledTimes(1);
    });

    test('updates active class on tab buttons when switching', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      loadModule();

      var buttons = document.querySelectorAll('[data-dashboard-id]');
      buttons[1].click();

      expect(buttons[0].classList.contains('active')).toBe(false);
      expect(buttons[1].classList.contains('active')).toBe(true);
    });

    test('clicking the already active tab does not re-activate', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      setupGlobals([d1]);

      loadModule();

      // d1.activate called once on init
      expect(d1.activate).toHaveBeenCalledTimes(1);

      // Click the same tab again
      var btn = document.querySelector('[data-dashboard-id="freshness"]');
      btn.click();

      // Should not be called again
      expect(d1.activate).toHaveBeenCalledTimes(1);
    });
  });

  describe('container visibility', () => {
    test('shows map and hides content when usesMap is true', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness', true);
      setupGlobals([d1]);

      loadModule();

      var mapEl = document.getElementById('dashboard-map');
      var contentEl = document.getElementById('dashboard-content');
      expect(mapEl.style.display).toBe('');
      expect(contentEl.style.display).toBe('none');
    });

    test('hides map and shows content when usesMap is false', () => {
      setupDOM();
      var d1 = createFakeDashboard('table-view', 'Table', false);
      setupGlobals([d1]);

      loadModule();

      var mapEl = document.getElementById('dashboard-map');
      var contentEl = document.getElementById('dashboard-content');
      expect(mapEl.style.display).toBe('none');
      expect(contentEl.style.display).toBe('');
    });

    test('toggles containers when switching between map and non-map dashboards', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness', true);
      var d2 = createFakeDashboard('table-view', 'Table', false);
      setupGlobals([d1, d2]);

      loadModule();

      var mapEl = document.getElementById('dashboard-map');
      var contentEl = document.getElementById('dashboard-content');

      // Initially map-based
      expect(mapEl.style.display).toBe('');
      expect(contentEl.style.display).toBe('none');

      // Switch to non-map
      document.querySelectorAll('[data-dashboard-id]')[1].click();
      expect(mapEl.style.display).toBe('none');
      expect(contentEl.style.display).toBe('');
    });
  });

  describe('getActiveDashboard()', () => {
    test('returns the currently active dashboard', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      setupGlobals([d1]);

      var switcher = loadModule();

      expect(switcher.getActiveDashboard()).toBe(d1);
    });

    test('returns the new dashboard after switching', () => {
      setupDOM();
      var d1 = createFakeDashboard('freshness', 'Freshness');
      var d2 = createFakeDashboard('coverage', 'Coverage');
      setupGlobals([d1, d2]);

      var switcher = loadModule();

      document.querySelectorAll('[data-dashboard-id]')[1].click();
      expect(switcher.getActiveDashboard()).toBe(d2);
    });
  });
});
