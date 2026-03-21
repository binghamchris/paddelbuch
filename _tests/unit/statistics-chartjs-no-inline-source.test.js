/**
 * Unit Tests for No Inline Styles in statistics-dashboard.js (Static Analysis)
 *
 * Reads the JS source file and verifies that it contains zero occurrences of
 * inline style patterns — both `style=` string literals used for HTML generation
 * and `.style.` property assignments on DOM elements.
 *
 * Validates: Requirements 5.1, 5.2
 *
 * @jest-environment node
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '../..');
var SOURCE_PATH = path.join(ROOT, 'assets/js/statistics-dashboard.js');

describe('No inline styles in statistics-dashboard.js source', function () {
  var source;

  beforeAll(function () {
    source = fs.readFileSync(SOURCE_PATH, 'utf8');
  });

  test('contains zero occurrences of style= in string literals', function () {
    var matches = source.match(/style=/g);
    expect(matches).toBeNull();
  });

  test('contains zero occurrences of .style. property assignments', function () {
    var matches = source.match(/\.style\./g);
    expect(matches).toBeNull();
  });
});
