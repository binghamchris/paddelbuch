/**
 * Property-Based Test: i18n fallback to German defaults
 *
 * Feature: spot-freshness-dashboard, Property 10: i18n fallback to German defaults
 *
 * For any i18n JSON block content (including absent block, empty object, or object
 * with missing keys), the getStrings() function shall return a complete strings
 * object where every key has a non-empty value, falling back to the German default
 * when the i18n source is missing or incomplete.
 *
 * **Validates: Requirements 7.2, 1.2**
 *
 * @jest-environment jsdom
 */

var fc = require('fast-check');
var path = require('path');

// --- German defaults (the expected fallback values) ---

var GERMAN_DEFAULTS = {
  name: 'Einstiegsort-Aktualität',
  description: 'Wie kürzlich jeder einzelne Einstiegsort, der Paddlern zur Verfügung steht, aktualisiert wurde.',
  fresh: 'Aktuell (≤ 2 Jahre)',
  aging: 'Alternd (2–5 Jahre)',
  stale: 'Veraltet (> 5 Jahre)',
  chart_title: 'Aktualität der Einstiegsorte',
  popup_age: 'Alter',
  popup_years: 'Jahre'
};

var ALL_KEYS = Object.keys(GERMAN_DEFAULTS);

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
    // state 0: key is absent
  }
  return { states: states, values: values, i18nObj: obj };
});

describe('Property 10: i18n fallback to German defaults', function () {
  var modulePath = path.resolve(__dirname, '../../assets/js/spot-freshness-dashboard.js');

  beforeEach(function () {
    document.body.innerHTML = '';
    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    delete require.cache[modulePath];
  });

  afterEach(function () {
    delete window.PaddelbuchSpotFreshnessDashboard;
    delete window.PaddelbuchDashboardRegistry;
    document.body.innerHTML = '';
  });

  /**
   * Helper: set up or remove the #spot-freshness-i18n element.
   */
  function setI18nElement(i18nObj) {
    var existing = document.getElementById('spot-freshness-i18n');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
    if (i18nObj !== null) {
      var el = document.createElement('script');
      el.id = 'spot-freshness-i18n';
      el.type = 'application/json';
      el.textContent = JSON.stringify(i18nObj);
      document.body.appendChild(el);
    }
  }

  it('getStrings() returns complete object with non-empty values for any i18n content', function () {
    // Load the module once — getStrings() is exposed on the global and reads
    // from the DOM on each call, so we can manipulate the DOM per iteration.
    require(modulePath);

    var dashboard = window.PaddelbuchSpotFreshnessDashboard;
    expect(dashboard).toBeDefined();
    expect(typeof dashboard.getStrings).toBe('function');

    fc.assert(
      fc.property(partialI18nArb, fc.boolean(), function (generated, includeElement) {
        var states = generated.states;
        var values = generated.values;
        var i18nObj = generated.i18nObj;

        // Set up or remove the i18n element
        if (includeElement) {
          setI18nElement(i18nObj);
        } else {
          setI18nElement(null);
        }

        var strings = dashboard.getStrings();

        // Every key must be present and non-empty
        for (var k = 0; k < ALL_KEYS.length; k++) {
          var key = ALL_KEYS[k];
          if (strings[key] == null || strings[key] === '') {
            throw new Error(
              'Key "' + key + '" is missing or empty. Got: ' + JSON.stringify(strings[key])
            );
          }
        }

        // Verify correct value: German default or custom value
        for (var j = 0; j < ALL_KEYS.length; j++) {
          var currentKey = ALL_KEYS[j];
          if (!includeElement) {
            // No i18n element: must use German default
            if (strings[currentKey] !== GERMAN_DEFAULTS[currentKey]) {
              throw new Error(
                'No i18n element: expected "' + GERMAN_DEFAULTS[currentKey] +
                '" for key "' + currentKey + '" but got "' + strings[currentKey] + '"'
              );
            }
          } else {
            var state = states[j];
            if (state === 2 && values[j].length > 0) {
              // Custom non-empty value provided
              if (strings[currentKey] !== values[j]) {
                throw new Error(
                  'Custom value for "' + currentKey + '": expected "' + values[j] +
                  '" but got "' + strings[currentKey] + '"'
                );
              }
            } else {
              // Missing or empty: must fall back to German default
              if (strings[currentKey] !== GERMAN_DEFAULTS[currentKey]) {
                throw new Error(
                  'Missing/empty "' + currentKey + '": expected "' +
                  GERMAN_DEFAULTS[currentKey] + '" but got "' + strings[currentKey] + '"'
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
