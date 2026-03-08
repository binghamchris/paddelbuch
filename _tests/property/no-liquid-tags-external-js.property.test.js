/**
 * Property-Based Tests for No Liquid Tags in External JS Files
 *
 * **Feature: liquid-rendering-optimization, Property 1: External JS files contain no Liquid tags**
 * **Validates: Requirements 1.5, 2.4, 4.10, 5.6**
 *
 * Property: For any file in the set {layer-control.js, detail-map-layers.js, filter-panel.js,
 * detail-map.js}, the file content shall contain zero Liquid interpolation tags
 * ({{, }}, {%, %}).
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTERNAL_JS_FILES = [
  'assets/js/layer-control.js',
  'assets/js/detail-map-layers.js',
  'assets/js/filter-panel.js',
  'assets/js/detail-map.js',
];

const LIQUID_PATTERNS = ['{{', '}}', '{%', '%}'];

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the content of an external JS file.
 */
function readExternalJsFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
}

/**
 * Checks whether a substring of the file content starting at a given position
 * contains any Liquid tag pattern.
 */
function substringContainsLiquidTag(content, startIndex, length) {
  const substring = content.substring(startIndex, startIndex + length);
  return LIQUID_PATTERNS.some((pattern) => substring.includes(pattern));
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Picks one of the four external JS files. */
const fileArb = fc.constantFrom(...EXTERNAL_JS_FILES);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('External JS Files Contain No Liquid Tags — Property 1', () => {
  // Pre-load all file contents once for efficiency
  const fileContents = {};
  beforeAll(() => {
    for (const filePath of EXTERNAL_JS_FILES) {
      fileContents[filePath] = readExternalJsFile(filePath);
    }
  });

  test('no random substring of any external JS file contains Liquid tags', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];

        // Generate random start index and length within the file
        return fc.assert(
          fc.property(
            fc.integer({ min: 0, max: Math.max(0, content.length - 1) }),
            fc.integer({ min: 1, max: Math.min(500, content.length) }),
            (startIndex, length) => {
              return !substringContainsLiquidTag(content, startIndex, length);
            }
          ),
          { numRuns: 25 } // 25 substrings per file × 4 files = 100 checks
        );
      }),
      { numRuns: 4 } // One run per file (constantFrom cycles through all 4)
    );
  });

  test('full content of each external JS file contains no Liquid output tags ({{)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        return !content.includes('{{');
      }),
      { numRuns: 100 }
    );
  });

  test('full content of each external JS file contains no Liquid closing output tags (}})', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        return !content.includes('}}');
      }),
      { numRuns: 100 }
    );
  });

  test('full content of each external JS file contains no Liquid logic tags ({%)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        return !content.includes('{%');
      }),
      { numRuns: 100 }
    );
  });

  test('full content of each external JS file contains no Liquid closing logic tags (%})', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        return !content.includes('%}');
      }),
      { numRuns: 100 }
    );
  });

  test('no position in any external JS file starts a Liquid tag pattern', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        for (let i = 0; i < content.length - 1; i++) {
          const twoChar = content[i] + content[i + 1];
          if (LIQUID_PATTERNS.includes(twoChar)) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
