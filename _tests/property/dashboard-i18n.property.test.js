/**
 * Property-Based Test for Translation Key Completeness
 *
 * // Feature: data-quality-dashboards, Property 10: Translation key completeness
 * **Validates: Requirements 1.5**
 *
 * Property: For any translation key referenced in the dashboard page template
 * and JavaScript modules, that key shall exist in both _i18n/de.yml and
 * _i18n/en.yml with a non-empty string value.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * All translation keys referenced by the dashboard feature:
 * - nav.data_quality_dashboards (header.html navigation link)
 * - dashboards.* (dashboard page template and JS modules)
 */
const DASHBOARD_TRANSLATION_KEYS = [
  'nav.data_quality_dashboards',
  'dashboards.title',
  'dashboards.description',
  'dashboards.freshness.name',
  'dashboards.freshness.legend_title',
  'dashboards.freshness.fresh',
  'dashboards.freshness.aging',
  'dashboards.freshness.stale',
  'dashboards.freshness.no_data',
  'dashboards.freshness.popup_spots',
  'dashboards.freshness.popup_median_age',
  'dashboards.freshness.popup_days',
  'dashboards.freshness.popup_no_data',
  'dashboards.coverage.name',
  'dashboards.coverage.legend_title',
  'dashboards.coverage.covered',
  'dashboards.coverage.not_covered',
  'dashboards.coverage.popup_spots'
];

/**
 * Resolves a dotted key path (e.g. "dashboards.freshness.name") against
 * a nested object parsed from YAML. Returns the leaf value or undefined
 * if any segment is missing.
 */
function resolveKey(obj, dottedKey) {
  var parts = dottedKey.split('.');
  var current = obj;
  for (var i = 0; i < parts.length; i++) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[parts[i]];
  }
  return current;
}

// Load and parse both locale files once before all tests
var deYamlPath = path.resolve(__dirname, '../../_i18n/de.yml');
var enYamlPath = path.resolve(__dirname, '../../_i18n/en.yml');
var deData = yaml.load(fs.readFileSync(deYamlPath, 'utf8'));
var enData = yaml.load(fs.readFileSync(enYamlPath, 'utf8'));

describe('Dashboard i18n Key Completeness - Property 10', function () {
  /**
   * Property 10: For any translation key referenced in the dashboard page
   * template and JavaScript modules, that key shall exist in both de.yml
   * and en.yml with a non-empty string value.
   */
  test('every dashboard translation key exists in both locales with a non-empty string', function () {
    fc.assert(
      fc.property(
        fc.constantFrom.apply(fc, DASHBOARD_TRANSLATION_KEYS),
        function (key) {
          // Assert key exists in de.yml with a non-empty string value
          var deValue = resolveKey(deData, key);
          expect(deValue).toBeDefined();
          expect(typeof deValue).toBe('string');
          expect(deValue.trim().length).toBeGreaterThan(0);

          // Assert key exists in en.yml with a non-empty string value
          var enValue = resolveKey(enData, key);
          expect(enValue).toBeDefined();
          expect(typeof enValue).toBe('string');
          expect(enValue.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
