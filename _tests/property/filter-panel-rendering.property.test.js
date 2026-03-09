/**
 * @jest-environment jsdom
 */

/**
 * Property-Based Test for Filter Panel Rendering from Configuration
 *
 * // Feature: multi-dimension-spot-filter, Property 8: Filter panel renders checkbox groups from configuration
 * **Validates: Requirements 8.3**
 *
 * Property: For any valid dimension configuration array with N dimensions,
 * the Filter_Panel shall render exactly N <fieldset> elements in the spot
 * filter section, each containing a number of checkboxes equal to the number
 * of options in that dimension's configuration.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

/**
 * Extract the JavaScript code from filter-panel.html's <script> tag.
 */
function getFilterPanelScript() {
  const htmlPath = path.join(__dirname, '..', '..', '_includes', 'filter-panel.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No <script> tag found in filter-panel.html');
  return scriptMatch[1];
}

/**
 * Set up Leaflet mocks on the global/window object.
 * L.Control.extend returns a constructor whose instances have addTo(map)
 * that calls onAdd() and appends the result to document.body.
 * L.DomUtil.create creates real DOM elements (jsdom provides document).
 */
function setupLeafletMocks() {
  window.L = {
    Control: {
      extend: function(proto) {
        function Control() {
          this.options = Object.assign({}, proto.options || {});
          this._onAdd = proto.onAdd.bind(this);
        }
        Control.prototype.addTo = function(map) {
          var container = this._onAdd(map);
          this._container_el = container;
          document.body.appendChild(container);
          if (map._addControlCb) map._addControlCb(this);
          return this;
        };
        Control.prototype.getContainer = function() {
          return this._container_el;
        };
        return Control;
      }
    },
    DomUtil: {
      create: function(tagName, className, parentEl) {
        var el = document.createElement(tagName);
        if (className) el.className = className;
        if (parentEl) parentEl.appendChild(el);
        return el;
      },
      hasClass: function(el, name) {
        return el.classList.contains(name);
      },
      addClass: function(el, name) {
        el.classList.add(name);
      },
      removeClass: function(el, name) {
        el.classList.remove(name);
      }
    },
    DomEvent: {
      disableClickPropagation: function() {},
      disableScrollPropagation: function() {}
    }
  };
}

/**
 * Create a mock map object with addControl and on methods.
 */
function createMockMap() {
  return {
    addControl: jest.fn(),
    on: jest.fn()
  };
}

/**
 * Load a fresh FilterPanel instance by evaluating the script in current window context.
 */
function loadFilterPanel() {
  const script = getFilterPanelScript();
  // Execute the IIFE in the current window context
  const fn = new Function(script);
  fn();
  return window.PaddelbuchFilterPanel;
}

/** Arbitrary: option slug */
const optionSlugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

/** Arbitrary: dimension key */
const dimensionKeyArb = fc.stringMatching(/^[a-z]{1,10}$/);

/**
 * Arbitrary: a single dimension config with 1–8 options.
 */
const dimensionConfigArb = fc.record({
  key: dimensionKeyArb,
  label: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
  options: fc.array(
    fc.record({
      slug: optionSlugArb,
      label: fc.stringMatching(/^[A-Za-z ]{1,20}$/)
    }),
    { minLength: 1, maxLength: 8 }
  )
}).map(dim => ({
  ...dim,
  matchFn: function(meta, selectedSet) {
    return selectedSet.has(meta[dim.key]);
  }
}));

/**
 * Arbitrary: array of 1–5 dimension configs with unique keys.
 */
const dimensionConfigsArb = fc.uniqueArray(dimensionConfigArb, {
  minLength: 1,
  maxLength: 5,
  selector: d => d.key
});

describe('Filter Panel Rendering - Property 8', () => {
  beforeEach(() => {
    // Clean DOM and globals
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.PaddelbuchFilterEngine;
    delete window.L;
  });

  /**
   * Property 8: Filter panel renders checkbox groups from configuration
   *
   * For any dimension config array with N dimensions, the panel renders
   * exactly N fieldsets, each with the correct number of checkboxes.
   */
  test('renders exactly N fieldsets with correct checkbox counts per dimension', () => {
    fc.assert(
      fc.property(
        dimensionConfigsArb,
        (dimensionConfigs) => {
          // Fresh DOM
          document.body.innerHTML = '';
          delete window.PaddelbuchFilterPanel;
          delete window.L;

          // Set up mocks and load panel
          setupLeafletMocks();
          const panel = loadFilterPanel();
          const mockMap = createMockMap();

          // Init the panel with the random dimension configs and no layer toggles
          panel.init(mockMap, dimensionConfigs, []);

          // Query rendered fieldsets from the DOM
          const fieldsets = document.querySelectorAll('fieldset');
          expect(fieldsets.length).toBe(dimensionConfigs.length);

          // For each fieldset, verify checkbox count matches option count
          for (let i = 0; i < dimensionConfigs.length; i++) {
            const expectedOptionCount = dimensionConfigs[i].options.length;
            const checkboxes = fieldsets[i].querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBe(expectedOptionCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
