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
 * Read the JavaScript code for the filter panel.
 * After CSP extraction, the code lives in assets/js/filter-panel.js
 * rather than inline in filter-panel.html.
 */
function getFilterPanelScript() {
  const jsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js');
  return fs.readFileSync(jsPath, 'utf-8');
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
 * Arbitrary: a single dimension config with 1-8 options.
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
 * Arbitrary: array of 1-5 dimension configs with unique keys.
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


/**
 * Property-Based Test for Craft Dimension Control Rendering (icon + label + order)
 *
 * // Feature: paddlecraft-types-change, Property 3: Filter panel renders one control per option, in order
 * **Validates: Requirements 1.6**
 *
 * Property: For the two-option paddle craft type dimension (ordered
 * `klappbar-und-aufblasbar` then `hardshell`), the Filter_Panel shall render
 * exactly one checkbox-labelled control per option, in the same order as the
 * dimension options, each control carrying its option's assigned standalone icon
 * and its localised label.
 *
 * The existing "Property 8" test above verifies the generic fieldset/checkbox
 * counts. This test additionally exercises option ORDER and the icon + localised
 * label rendering for the craft dimension's `iconOnly` options, which the generic
 * count-only test does not cover.
 */

// Ordered craft slugs + their assigned icons (design "Filter dimension option").
const CRAFT_SLUGS = ['klappbar-und-aufblasbar', 'hardshell'];
const CRAFT_ICONS = {
  'klappbar-und-aufblasbar': '/assets/images/icons/foldables-dark.svg',
  'hardshell': '/assets/images/icons/hardshell-dark.svg'
};

/** Arbitrary: a localised, non-empty label for a craft option. */
const localisedLabelArb = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,19}$/);

describe('Filter Panel Craft Dimension Rendering - Property 3', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.PaddelbuchFilterEngine;
    delete window.L;
  });

  test('renders one control per craft option, in order, each with its icon and localised label', () => {
    fc.assert(
      fc.property(
        localisedLabelArb, // label for klappbar-und-aufblasbar
        localisedLabelArb, // label for hardshell
        (labelKlappbar, labelHardshell) => {
          // Fresh DOM/globals per run
          document.body.innerHTML = '';
          delete window.PaddelbuchFilterPanel;
          delete window.L;

          const craftLabels = {
            'klappbar-und-aufblasbar': labelKlappbar,
            'hardshell': labelHardshell
          };

          // Build the two-option craft dimension, ordered as the generator emits it,
          // each option carrying its standalone (iconOnly) icon + localised label.
          const craftDimension = {
            key: 'paddleCraftType',
            label: 'Paddle Craft Type',
            options: CRAFT_SLUGS.map(slug => ({
              slug: slug,
              label: craftLabels[slug],
              icon: CRAFT_ICONS[slug],
              iconOnly: true
            })),
            matchFn: function(meta, selectedSet) {
              return (meta.paddleCraftTypes || []).some(s => selectedSet.has(s));
            }
          };

          setupLeafletMocks();
          const panel = loadFilterPanel();
          const mockMap = createMockMap();

          panel.init(mockMap, [craftDimension], []);

          // Exactly one fieldset for the single craft dimension.
          const fieldsets = document.querySelectorAll('fieldset');
          expect(fieldsets.length).toBe(1);

          // Exactly one checkbox-labelled control per option, in order.
          const labels = fieldsets[0].querySelectorAll('label');
          expect(labels.length).toBe(CRAFT_SLUGS.length);

          for (let j = 0; j < CRAFT_SLUGS.length; j++) {
            const slug = CRAFT_SLUGS[j];
            const controlLabel = labels[j];

            // One checkbox per control, matching the option's slug in order.
            const checkbox = controlLabel.querySelector('input[type="checkbox"]');
            expect(checkbox).not.toBeNull();
            expect(checkbox.getAttribute('data-slug')).toBe(slug);

            // Standalone icon present with the option's assigned src.
            const iconImg = controlLabel.querySelector('img.filter-icon-standalone');
            expect(iconImg).not.toBeNull();
            expect(iconImg.getAttribute('src')).toBe(CRAFT_ICONS[slug]);

            // Localised label text present on the control.
            expect(controlLabel.textContent).toContain(craftLabels[slug]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
