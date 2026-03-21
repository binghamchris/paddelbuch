/**
 * Unit Tests for Chart.js Vendor Dependency and Script Load Order
 *
 * Verifies that Chart.js is properly integrated into the vendor asset pipeline
 * and that the script load order in datenqualitaet.html is correct.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 11.1, 11.2
 *
 * @jest-environment node
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');

describe('Chart.js Vendor Dependency and Script Load Order', function () {
  describe('package.json', function () {
    var pkg;

    beforeAll(function () {
      var content = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
      pkg = JSON.parse(content);
    });

    test('lists chart.js in production dependencies', function () {
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies['chart.js']).toBeDefined();
    });
  });

  describe('copy-vendor-assets.js', function () {
    var scriptContent;

    beforeAll(function () {
      scriptContent = fs.readFileSync(
        path.join(ROOT, 'scripts/copy-vendor-assets.js'),
        'utf8'
      );
    });

    test('includes chart.umd.js source path', function () {
      expect(scriptContent).toContain(
        'node_modules/chart.js/dist/chart.umd.js'
      );
    });

    test('includes chart.umd.js destination path', function () {
      expect(scriptContent).toContain(
        'assets/js/vendor/chart.umd.js'
      );
    });
  });

  describe('datenqualitaet.html script load order', function () {
    var scripts;

    beforeAll(function () {
      var content = fs.readFileSync(
        path.join(ROOT, 'offene-daten/datenqualitaet.html'),
        'utf8'
      );

      // Extract the YAML front matter between --- delimiters
      var fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(fmMatch).not.toBeNull();

      // Extract the scripts array entries from the front matter
      var scriptsMatch = fmMatch[1].match(
        /scripts:\s*\n((?:\s+-\s+.*\n?)*)/
      );
      expect(scriptsMatch).not.toBeNull();

      scripts = scriptsMatch[1]
        .split('\n')
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.startsWith('- '); })
        .map(function (line) { return line.replace(/^-\s+/, ''); });
    });

    test('includes /assets/js/vendor/chart.umd.js', function () {
      expect(scripts).toContain('/assets/js/vendor/chart.umd.js');
    });

    test('chart.umd.js appears after dashboard-data.js', function () {
      var chartIndex = scripts.indexOf('/assets/js/vendor/chart.umd.js');
      var dataIndex = scripts.findIndex(function (s) {
        return s.includes('dashboard-data.js');
      });

      expect(dataIndex).toBeGreaterThanOrEqual(0);
      expect(chartIndex).toBeGreaterThan(dataIndex);
    });

    test('chart.umd.js appears before statistics-dashboard.js', function () {
      var chartIndex = scripts.indexOf('/assets/js/vendor/chart.umd.js');
      var statsIndex = scripts.findIndex(function (s) {
        return s.includes('statistics-dashboard.js');
      });

      expect(statsIndex).toBeGreaterThanOrEqual(0);
      expect(chartIndex).toBeLessThan(statsIndex);
    });
  });
});
