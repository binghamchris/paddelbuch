/**
 * Unit Tests for SCSS Component Structure
 *
 * Verifies that the statistics dashboard SCSS file exists, is imported in the
 * components manifest, and defines all required CSS class names.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
 *
 * @jest-environment node
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');
var SCSS_PATH = path.join(ROOT, '_sass/components/_statistics-dashboard.scss');
var COMPONENTS_PATH = path.join(ROOT, '_sass/components/_components.scss');

describe('SCSS component structure', function () {
  test('_statistics-dashboard.scss file exists', function () {
    expect(fs.existsSync(SCSS_PATH)).toBe(true);
  });

  test('_components.scss imports statistics-dashboard', function () {
    var content = fs.readFileSync(COMPONENTS_PATH, 'utf8');
    expect(content).toContain('@import "statistics-dashboard"');
  });

  describe('required class definitions', function () {
    var scss;

    beforeAll(function () {
      scss = fs.readFileSync(SCSS_PATH, 'utf8');
    });

    test('defines .statistics-section', function () {
      expect(scss).toContain('.statistics-section');
    });

    test('defines .statistics-figure', function () {
      expect(scss).toContain('.statistics-figure');
    });

    test('defines .statistics-chart-container', function () {
      expect(scss).toContain('.statistics-chart-container');
    });

    test('defines .statistics-legend', function () {
      expect(scss).toContain('.statistics-legend');
    });

    test('defines .statistics-bar', function () {
      expect(scss).toContain('.statistics-bar');
    });
  });
});
