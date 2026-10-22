/**
 * Home View Memory: source guard
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 4.4, 5.1, 5.2, 5.3, 5.4**
 *
 * A deny-list backstop to the behavioural privacy tests. The View_Store holds the
 * visitor's map view, which may be their location, so it must not use any API
 * that could move that view off the device or into analytics. Comments are
 * stripped first, so the module can still explain what it does not do.
 */

var fs = require('fs');
var path = require('path');

var MODULE_PATH = path.join(__dirname, '..', '..', 'assets', 'js', 'home-view-memory.js');

// Removes block comments and line comments that start a line or follow whitespace.
// The module's one regex literal contains no whitespace-preceded '//'.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

var FORBIDDEN = [
  ['tinylytics', /tinylytics/i],
  ['setAttribute', /setAttribute/],
  ['removeAttribute', /removeAttribute/],
  ['pushState', /pushState/],
  ['replaceState', /replaceState/],
  ['localStorage', /localStorage/],
  ['cookie', /cookie/i],
  ['location.hash', /location\s*\.\s*hash/],
  ['location.search', /location\s*\.\s*search/],
  ['location.href', /location\s*\.\s*href/],
  ['sendBeacon', /sendBeacon/],
  ['fetch', /\bfetch\b/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['console', /\bconsole\s*\./]
];

describe('home-view-memory.js source guard', function() {
  var code = stripComments(fs.readFileSync(MODULE_PATH, 'utf-8'));

  test('comment stripping leaves the code in place', function() {
    expect(code).toContain('sessionStorage');
    expect(code).toContain('PaddelbuchHomeViewMemory');
    expect(code).not.toContain('Privacy contract');
  });

  test.each(FORBIDDEN)('does not use %s', function(_name, pattern) {
    expect(code).not.toMatch(pattern);
  });
});
