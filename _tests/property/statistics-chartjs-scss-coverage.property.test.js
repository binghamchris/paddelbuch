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

var SPOT_TYPE_CLASSES = [
  'spot-pos-0', 'spot-pos-1', 'spot-pos-2',
  'spot-pos-3', 'spot-pos-4', 'spot-pos-5'
];

var OBSTACLE_TYPE_SLUGS = [
  'with-portage',
  'without-portage'
];

var PA_TYPE_CLASSES = [
  'pa-pos-0', 'pa-pos-1', 'pa-pos-2',
  'pa-pos-3', 'pa-pos-4', 'pa-pos-5',
  'pa-pos-6', 'pa-pos-7', 'pa-pos-8'
];

var ALL_SLUGS = SPOT_TYPE_CLASSES.concat(OBSTACLE_TYPE_SLUGS).concat(PA_TYPE_CLASSES);

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
