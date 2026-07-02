// Validates: Requirements 1.5, 3.1, 3.2
// Feature: paddlecraft-types-change, Task 2.3: icon-asset existence (regression guard)
//
// The two new paddle-craft-type SVG icons were committed on branch
// `feat/paddlecraft-types-change`. This test does NOT create them; it only guards
// against their accidental removal, since the filter dimension, the craft-icon
// include, and the statistics dashboard all reference these exact paths.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const EXPECTED_ICONS = [
  'assets/images/icons/foldables-dark.svg',
  'assets/images/icons/hardshell-dark.svg',
];

describe('paddle craft type icon assets (regression guard)', () => {
  test.each(EXPECTED_ICONS)('%s exists on disk', (relPath) => {
    const full = path.join(ROOT, relPath);
    expect(fs.existsSync(full)).toBe(true);
  });
});
