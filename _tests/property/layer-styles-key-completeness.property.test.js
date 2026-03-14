/**
 * Regression Tests: Layer Styles Key Completeness
 *
 * Prevents regression of the bug where layer-styles.js was missing the
 * 'eventNoticeArea' key in its getLayerStyle() style map. This caused
 * notice-map.js to fall back to lakeStyle (no fill, blue outline) instead
 * of the yellow semi-transparent polygon for affected areas.
 *
 * Also verifies that every getLayerStyle() call site across the codebase
 * uses a key that actually exists in the style map.
 *
 * Feature: best-practices-cleanup
 * Validates: Requirements 5.2, 7.2
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

const layerStylesPath = path.join(__dirname, '..', '..', 'assets', 'js', 'layer-styles.js');
const layerStylesSource = fs.readFileSync(layerStylesPath, 'utf-8');

// Extract all keys from the styleMap in getLayerStyle()
function extractStyleMapKeys(source) {
  const mapMatch = source.match(/var styleMap\s*=\s*\{([^}]+)\}/s);
  if (!mapMatch) return [];
  const keys = [];
  const keyPattern = /'([^']+)'/g;
  let m;
  while ((m = keyPattern.exec(mapMatch[1])) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

// Find all getLayerStyle('...') call sites across JS and HTML files
function findGetLayerStyleCallKeys() {
  const jsDir = path.join(__dirname, '..', '..', 'assets', 'js');
  const includesDir = path.join(__dirname, '..', '..', '_includes');
  const callKeys = [];
  const pattern = /getLayerStyle\(['"]([^'"]+)['"]\)/g;

  // Scan JS files
  if (fs.existsSync(jsDir)) {
    fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(file => {
      const content = fs.readFileSync(path.join(jsDir, file), 'utf-8');
      let m;
      while ((m = pattern.exec(content)) !== null) {
        callKeys.push({ key: m[1], file: file });
      }
    });
  }

  // Scan HTML includes
  if (fs.existsSync(includesDir)) {
    fs.readdirSync(includesDir).filter(f => f.endsWith('.html')).forEach(file => {
      const content = fs.readFileSync(path.join(includesDir, file), 'utf-8');
      let m;
      while ((m = pattern.exec(content)) !== null) {
        callKeys.push({ key: m[1], file: file });
      }
    });
  }

  return callKeys;
}

const styleMapKeys = extractStyleMapKeys(layerStylesSource);
const callSites = findGetLayerStyleCallKeys();

describe('Regression: Layer styles key completeness', () => {
  test('styleMap must contain the eventNoticeArea key', () => {
    // This was the missing key that caused the notice-map.js bug
    expect(styleMapKeys).toContain('eventNoticeArea');
  });

  test('styleMap must contain all expected layer type keys', () => {
    const requiredKeys = [
      'lake',
      'waterway',
      'protectedArea',
      'protected',
      'obstacle',
      'portage',
      'portageRoute',
      'eventNotice',
      'waterwayEvent',
      'eventArea',
      'eventNoticeArea'
    ];

    requiredKeys.forEach(key => {
      expect(styleMapKeys).toContain(key);
    });
  });

  test('every getLayerStyle() call site uses a key that exists in the styleMap', () => {
    // This is the key regression guard: if someone adds a new getLayerStyle('foo')
    // call, this test will fail unless 'foo' is in the styleMap
    expect(callSites.length).toBeGreaterThan(0);

    callSites.forEach(({ key, file }) => {
      expect(styleMapKeys).toContain(key);
    });
  });

  test('styleMap keys are exhaustively tested against all call sites (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...callSites),
        (callSite) => {
          return styleMapKeys.includes(callSite.key);
        }
      ),
      { numRuns: callSites.length * 10 }
    );
  });
});

describe('Layer styles module exports', () => {
  test('exports PaddelbuchLayerStyles with getLayerStyle function', () => {
    expect(layerStylesSource).toMatch(/global\.PaddelbuchLayerStyles\s*=/);
    expect(layerStylesSource).toMatch(/getLayerStyle:\s*getLayerStyle/);
  });

  test('exports all named style objects', () => {
    const requiredExports = [
      'lakeStyle',
      'protectedAreaStyle',
      'obstacleStyle',
      'portageStyle',
      'waterwayEventNoticeAreaStyle'
    ];

    requiredExports.forEach(name => {
      expect(layerStylesSource).toMatch(new RegExp(`${name}:\\s*${name}`));
    });
  });
});
