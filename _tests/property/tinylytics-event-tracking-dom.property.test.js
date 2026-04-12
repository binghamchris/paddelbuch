/**
 * @jest-environment jsdom
 */

/**
 * Property-Based Tests for Tinylytics Event Tracking (DOM-based controls)
 *
 * Properties 5 and 6 test the filter panel and dashboard switcher DOM
 * elements for correct data-tinylytics-event attributes.
 *
 * **Feature: tinylytics-event-tracking**
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Leaflet stubs (same pattern as filter-panel-rendering.property.test.js)
// ---------------------------------------------------------------------------

function setupLeafletMocks() {
  window.L = {
    Control: {
      extend: function (proto) {
        function Control() {
          this.options = Object.assign({}, proto.options || {});
          this._onAdd = proto.onAdd.bind(this);
        }
        Control.prototype.addTo = function (map) {
          var container = this._onAdd(map);
          this._container_el = container;
          document.body.appendChild(container);
          return this;
        };
        Control.prototype.getContainer = function () {
          return this._container_el;
        };
        return Control;
      }
    },
    DomUtil: {
      create: function (tagName, className, parentEl) {
        var el = document.createElement(tagName);
        if (className) el.className = className;
        if (parentEl) parentEl.appendChild(el);
        return el;
      },
      hasClass: function (el, name) { return el.classList.contains(name); },
      addClass: function (el, name) { el.classList.add(name); },
      removeClass: function (el, name) { el.classList.remove(name); }
    },
    DomEvent: {
      disableClickPropagation: function () {},
      disableScrollPropagation: function () {}
    },
    layerGroup: function () {
      return { addTo: function () { return this; }, remove: function () {} };
    }
  };
}

function createMockMap() {
  return {
    addControl: jest.fn(),
    on: jest.fn(),
    invalidateSize: jest.fn()
  };
}

function loadFilterPanel() {
  var code = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js'), 'utf-8'
  );
  var fn = new Function(code);
  fn();
  return window.PaddelbuchFilterPanel;
}

// ---------------------------------------------------------------------------
// Arbitraries for Property 5
// ---------------------------------------------------------------------------

const optionSlugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);
const dimensionKeyArb = fc.stringMatching(/^[a-z]{1,10}$/);

const dimensionConfigArb = fc.record({
  key: dimensionKeyArb,
  label: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
  options: fc.array(
    fc.record({
      slug: optionSlugArb,
      label: fc.stringMatching(/^[A-Za-z ]{1,20}$/)
    }),
    { minLength: 1, maxLength: 6 }
  )
});

const dimensionConfigsArb = fc.uniqueArray(dimensionConfigArb, {
  minLength: 1,
  maxLength: 4,
  selector: d => d.key
});

const layerToggleArb = fc.record({
  key: fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/),
  label: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
  defaultChecked: fc.boolean()
}).map(t => ({
  ...t,
  layerGroup: { addTo: function () { return this; }, remove: function () {} }
}));

const layerTogglesArb = fc.uniqueArray(layerToggleArb, {
  minLength: 0,
  maxLength: 4,
  selector: t => t.key
});

// ---------------------------------------------------------------------------
// Arbitraries for Property 6
// ---------------------------------------------------------------------------

const dashboardIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

const dashboardRegArb = fc.record({
  id: dashboardIdArb,
  label: fc.stringMatching(/^[A-Za-z ]{1,20}$/)
});

const dashboardRegsArb = fc.uniqueArray(dashboardRegArb, {
  minLength: 1,
  maxLength: 6,
  selector: d => d.id
});

// =========================================================================
// Property 5: Filter panel checkbox event tracking
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 5: Filter panel checkbox event tracking', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.PaddelbuchFilterEngine;
    delete window.L;
  });

  /**
   * **Validates: Requirements 6.1, 7.1**
   *
   * For any set of dimension configs and layer toggles, every created
   * checkbox SHALL carry the correct event tracking attributes:
   * - Spot-type checkboxes: filter.change with dimension_key:option_slug
   * - Layer toggle checkboxes: layer.toggle with the layer key
   */
  test('every dimension checkbox has filter.change with correct value', () => {
    fc.assert(
      fc.property(dimensionConfigsArb, layerTogglesArb, (dims, layers) => {
        document.body.innerHTML = '';
        delete window.PaddelbuchFilterPanel;
        delete window.L;

        setupLeafletMocks();
        var panel = loadFilterPanel();
        var mockMap = createMockMap();
        panel.init(mockMap, dims, layers);

        // Check dimension checkboxes
        for (var i = 0; i < dims.length; i++) {
          var dim = dims[i];
          for (var j = 0; j < dim.options.length; j++) {
            var opt = dim.options[j];
            var selector = 'input[type="checkbox"][data-dimension="' + dim.key + '"][data-slug="' + opt.slug + '"]';
            var cb = document.querySelector(selector);
            expect(cb).not.toBeNull();
            expect(cb.getAttribute('data-tinylytics-event')).toBe('filter.change');
            expect(cb.getAttribute('data-tinylytics-event-value')).toBe(dim.key + ':' + opt.slug);
          }
        }

        // Check layer toggle checkboxes
        for (var k = 0; k < layers.length; k++) {
          var layer = layers[k];
          var layerCb = document.querySelector('input[type="checkbox"][data-layer="' + layer.key + '"]');
          expect(layerCb).not.toBeNull();
          expect(layerCb.getAttribute('data-tinylytics-event')).toBe('layer.toggle');
          expect(layerCb.getAttribute('data-tinylytics-event-value')).toBe(layer.key);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 6: Dashboard switcher button event tracking
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 6: Dashboard switcher button event tracking', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchDashboardSwitcher;
    delete window.PaddelbuchDashboardRegistry;
    delete window.PaddelbuchDashboardMap;
    delete window.PaddelbuchDashboardData;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchDashboardSwitcher;
    delete window.PaddelbuchDashboardRegistry;
    delete window.PaddelbuchDashboardMap;
    delete window.PaddelbuchDashboardData;
  });

  function setupDashboardDOM() {
    document.body.innerHTML =
      '<div id="dashboard-switcher"></div>' +
      '<div id="dashboard-map"></div>' +
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-legend"></div>';
  }

  function setupDashboardGlobals(dashboards) {
    var mockMap = { invalidateSize: jest.fn() };
    window.PaddelbuchDashboardRegistry = dashboards;
    window.PaddelbuchDashboardMap = {
      map: mockMap,
      getMap: jest.fn(function () { return mockMap; })
    };
    window.PaddelbuchDashboardData = {};
  }

  function loadDashboardSwitcher() {
    delete window.PaddelbuchDashboardSwitcher;
    jest.isolateModules(function () {
      require('../../assets/js/dashboard-switcher.js');
    });
    return window.PaddelbuchDashboardSwitcher;
  }

  /**
   * **Validates: Requirements 8.1**
   *
   * For any set of dashboard registrations, every tab button SHALL carry
   * data-tinylytics-event="dashboard.switch" with the dashboard id as value.
   */
  test('every tab button has dashboard.switch event with correct id value', () => {
    fc.assert(
      fc.property(dashboardRegsArb, (regs) => {
        // Build fake dashboard objects with required methods
        var dashboards = regs.map(function (r) {
          return {
            id: r.id,
            getName: jest.fn(function () { return r.label; }),
            usesMap: true,
            activate: jest.fn(),
            deactivate: jest.fn()
          };
        });

        setupDashboardDOM();
        setupDashboardGlobals(dashboards);
        loadDashboardSwitcher();

        var buttons = document.querySelectorAll('[data-dashboard-id]');
        expect(buttons.length).toBe(dashboards.length);

        for (var i = 0; i < dashboards.length; i++) {
          var btn = buttons[i];
          expect(btn.getAttribute('data-tinylytics-event')).toBe('dashboard.switch');
          expect(btn.getAttribute('data-tinylytics-event-value')).toBe(dashboards[i].id);
        }
      }),
      { numRuns: 100 }
    );
  });
});
