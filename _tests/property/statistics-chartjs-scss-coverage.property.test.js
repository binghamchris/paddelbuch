/**
 * Property-Based Test: SCSS BEM-modifier coverage for all segment slugs
 *
 * Feature: chartjs-statistics-dashboard, Property 7: SCSS BEM-modifier coverage for all segment slugs
 *
 * For any known segment slug (spot types, obstacle segments, PA types),
 * the SCSS file shall contain a corresponding `.statistics-legend-swatch--{slug}` class.
 *
 * **Validates: Requirements 6.6**
 *
 * @jest-environment node
 */

var fc = require('fast-check');
var fs = require('fs');
var path = require('path');

var SCSS_PATH = path.resolve(__dirname, '../../_sass/components/_statistics-dashboard.scss');

var SPOT_TYPE_SLUGS = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle',
  'no-entry'
];

var OBSTACLE_TYPE_SLUGS = [
  'with-portage',
  'without-portage'
];

var PA_TYPE_SLUGS = [
  'naturschutzgebiet',
  'fahrverbotzone',
  'schilfgebiet',
  'schwimmbereich',
  'industriegebiet',
  'schiesszone',
  'teleskizone',
  'privatbesitz',
  'wasserskizone'
];

var ALL_SLUGS = SPOT_TYPE_SLUGS.concat(OBSTACLE_TYPE_SLUGS).concat(PA_TYPE_SLUGS);

describe('SCSS BEM-modifier coverage (Property 7)', function () {
  var scssContent;

  beforeAll(function () {
    scssContent = fs.readFileSync(SCSS_PATH, 'utf8');
  });

  it('SCSS file contains a .statistics-legend-swatch--{slug} class for any known segment slug', function () {
    fc.assert(
      fc.property(
        fc.constantFrom.apply(fc, ALL_SLUGS),
        function (slug) {
          var expectedClass = '.statistics-legend-swatch--' + slug;
          if (scssContent.indexOf(expectedClass) === -1) {
            throw new Error(
              'SCSS is missing BEM-modifier class: ' + expectedClass
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
