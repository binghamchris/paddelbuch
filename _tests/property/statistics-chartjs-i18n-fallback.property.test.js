/**
 * Property-Based Test: i18n German fallback
 *
 * Feature: chartjs-statistics-dashboard, Property 8: i18n German fallback
 *
 * For any page state where the #statistics-i18n JSON block is absent or contains
 * empty values, the getStrings() function shall return a complete object with all
 * required keys populated with German default strings.
 *
 * **Validates: Requirements 9.2**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- German defaults (the expected fallback values) ---

var GERMAN_DEFAULTS = {
  name: 'Statistiken',
  description: 'Übersicht über den Inhalt der Paddel Buch Datenbank.',
  spots_title: 'Einstiegsorte',
  obstacles_title: 'Hindernisse',
  protected_areas_title: 'Schutzgebiete',
  paddle_craft_title: 'Verfügbare Einstiegsorte nach Paddelboot-Typ',
  data_source_title: 'Einträge nach Datenquelle',
  data_license_title: 'Einträge nach Datenlizenz',
  with_portage: 'Mit Portage-Route',
  without_portage: 'Ohne Portage-Route',
  no_entry: 'Kein Zutritt'
};

var ALL_KEYS = Object.keys(GERMAN_DEFAULTS);

// --- Minimal metrics for activation ---

var MINIMAL_METRICS = {
  spots: { total: 10, byType: [{ slug: 'einstieg-ausstieg', name: 'Ein- und Ausstieg', count: 10 }] },
  obstacles: { total: 5, withPortageRoute: 3, withoutPortageRoute: 2 },
  protectedAreas: { total: 3, byType: [{ slug: 'naturschutzgebiet', name: 'Naturschutzgebiet', count: 3 }] },
  paddleCraftTypes: [],
  dataSourceTypes: [],
  dataLicenseTypes: []
};

// --- Arbitraries ---

/**
 * Generates a partial i18n object where each key is independently:
 * - 0: absent (missing from the object)
 * - 1: present with an empty string
 * - 2: present with a non-empty custom value
 */
var partialI18nArb = fc.tuple(
  fc.array(fc.constantFrom(0, 1, 2), { minLength: ALL_KEYS.length, maxLength: ALL_KEYS.length }),
  fc.array(fc.string({ minLength: 1, maxLength: 40 }), { minLength: ALL_KEYS.length, maxLength: ALL_KEYS.length })
).map(function (tuple) {
  var states = tuple[0];
  var values = tuple[1];
  var obj = {};
  for (var i = 0; i < ALL_KEYS.length; i++) {
    if (states[i] === 1) {
      obj[ALL_KEYS[i]] = '';
    } else if (states[i] === 2) {
      obj[ALL_KEYS[i]] = values[i];
    }
    // state 0: key is absent from the object
  }
  return { states: states, values: values, i18nObj: obj };
});

describe('i18n German fallback (Property 8)', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/statistics-dashboard.js');

  beforeEach(function () {
    document.body.innerHTML =
      '<div id="dashboard-content"></div>' +
      '<div id="dashboard-title"></div>' +
      '<div id="dashboard-description"></div>' +
      '<div id="dashboard-legend"></div>';

    // Mock window.Chart
    window.Chart = function MockChart(canvas, config) {
      return {
        canvas: canvas,
        config: config,
        destroyed: false,
        destroy: function () { this.destroyed = true; }
      };
    };

    // Mock PaddelbuchColors
    window.PaddelbuchColors = {
      spotTypeEntryExit: '#2e86c1',
      obstacleWithPortage: '#07753f',
      obstacleWithoutPortage: '#c40200',
      paTypeNaturschutzgebiet: '#1a5276',
      green1: '#07753f',
      warningYellow: '#ffb200',
      dangerRed: '#c40200',
      purple1: '#69599b'
    };

    window.PaddelbuchDashboardData = { statisticsMetrics: MINIMAL_METRICS };

    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete require.cache[modulePath];
  });

  afterEach(function () {
    delete window.Chart;
    delete window.PaddelbuchColors;
    delete window.PaddelbuchDashboardData;
    delete window.PaddelbuchStatisticsDashboard;
    delete window.PaddelbuchDashboardRegistry;
    document.body.innerHTML = '';
  });

  /**
   * Helper: set up or remove the #statistics-i18n element.
   */
  function setI18nElement(i18nObj) {
    var existing = document.getElementById('statistics-i18n');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
    if (i18nObj !== null) {
      var el = document.createElement('script');
      el.id = 'statistics-i18n';
      el.type = 'application/json';
      el.textContent = JSON.stringify(i18nObj);
      document.body.appendChild(el);
    }
  }

  it('uses German defaults for all keys when #statistics-i18n is absent or has empty/missing values', function () {
    // Load the module once - getStrings() is called fresh on each activate()
    require(modulePath);

    var dashboard = window.PaddelbuchStatisticsDashboard;
    expect(dashboard).toBeDefined();

    fc.assert(
      fc.property(partialI18nArb, fc.boolean(), function (generated, includeElement) {
        var states = generated.states;
        var values = generated.values;
        var i18nObj = generated.i18nObj;

        // Set up or remove the i18n element before activation
        if (includeElement) {
          setI18nElement(i18nObj);
        } else {
          setI18nElement(null);
        }

        // Activate the dashboard (calls getStrings() internally)
        var contentEl = document.getElementById('dashboard-content');
        dashboard.activate({ contentEl: contentEl });

        // --- Verify dashboard title (uses 'name' key) ---
        var titleEl = document.getElementById('dashboard-title');
        var titleText = titleEl.textContent;
        var nameKeyIndex = 0; // 'name' is the first key

        if (!includeElement) {
          // No i18n element at all: must use German default
          if (titleText !== GERMAN_DEFAULTS.name) {
            throw new Error(
              'No i18n element: expected title "' + GERMAN_DEFAULTS.name +
              '" but got "' + titleText + '"'
            );
          }
        } else {
          var nameState = states[nameKeyIndex];
          if (nameState === 2 && values[nameKeyIndex].length > 0) {
            if (titleText !== values[nameKeyIndex]) {
              throw new Error(
                'Custom name "' + values[nameKeyIndex] +
                '": expected title to match but got "' + titleText + '"'
              );
            }
          } else {
            if (titleText !== GERMAN_DEFAULTS.name) {
              throw new Error(
                'Missing/empty name: expected title "' + GERMAN_DEFAULTS.name +
                '" but got "' + titleText + '"'
              );
            }
          }
        }

        // --- Verify section headings ---
        var sectionTitles = contentEl.querySelectorAll('.statistics-section-title');
        var headingKeys = [
          'spots_title', 'obstacles_title', 'protected_areas_title',
          'paddle_craft_title', 'data_source_title', 'data_license_title'
        ];

        for (var h = 0; h < headingKeys.length; h++) {
          var key = headingKeys[h];
          var keyIndex = ALL_KEYS.indexOf(key);
          var headingText = sectionTitles[h].textContent;

          if (!includeElement) {
            if (headingText !== GERMAN_DEFAULTS[key]) {
              throw new Error(
                'No i18n element: expected heading "' + GERMAN_DEFAULTS[key] +
                '" for ' + key + ' but got "' + headingText + '"'
              );
            }
          } else {
            var keyState = states[keyIndex];
            if (keyState === 2 && values[keyIndex].length > 0) {
              if (headingText !== values[keyIndex]) {
                throw new Error(
                  'Custom ' + key + ' "' + values[keyIndex] +
                  '": expected heading to match but got "' + headingText + '"'
                );
              }
            } else {
              if (headingText !== GERMAN_DEFAULTS[key]) {
                throw new Error(
                  'Missing/empty ' + key + ': expected heading "' +
                  GERMAN_DEFAULTS[key] + '" but got "' + headingText + '"'
                );
              }
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
