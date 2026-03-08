/**
 * Property-Based Tests for Valid data-page-type Attributes
 *
 * **Feature: liquid-rendering-optimization, Property 3: Map container data-page-type is valid**
 * **Validates: Requirements 4.3**
 *
 * Property: For any detail layout file in {spot.html, obstacle.html, waterway.html, notice.html},
 * the map container element shall have a data-page-type attribute whose value is exactly one of
 * spot, obstacle, waterway, or notice, matching the layout's page type.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Mapping from layout file path to its expected data-page-type value.
 */
const LAYOUT_PAGE_TYPE_MAP = {
  '_layouts/spot.html': 'spot',
  '_layouts/obstacle.html': 'obstacle',
  '_layouts/waterway.html': 'waterway',
  '_layouts/notice.html': 'notice',
};

const LAYOUT_FILES = Object.keys(LAYOUT_PAGE_TYPE_MAP);
const VALID_PAGE_TYPES = ['spot', 'obstacle', 'waterway', 'notice'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a layout file from disk.
 */
function readLayoutFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
}

/**
 * Finds the map container element (a <div> with id ending in "-map" and class "map")
 * and extracts the data-page-type attribute value.
 *
 * Returns the data-page-type value or null if not found.
 */
function extractDataPageType(htmlContent) {
  // Match a <div> with id="...-map" and class="map" that has a data-page-type attribute.
  // The attributes can appear in any order within the opening tag.
  const mapContainerRegex = /<div\s[^>]*\bid="[a-z]+-map"[^>]*\bclass="map"[^>]*>/gi;
  const match = mapContainerRegex.exec(htmlContent);
  if (!match) return null;

  const tag = match[0];
  const pageTypeMatch = /\bdata-page-type="([^"]*)"/.exec(tag);
  return pageTypeMatch ? pageTypeMatch[1] : null;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Picks one of the four detail layout files. */
const layoutFileArb = fc.constantFrom(...LAYOUT_FILES);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Map Container data-page-type is Valid — Property 3', () => {
  // Pre-load all file contents once
  const fileContents = {};
  beforeAll(() => {
    for (const filePath of LAYOUT_FILES) {
      fileContents[filePath] = readLayoutFile(filePath);
    }
  });

  test('each layout file has a map container with a data-page-type attribute', () => {
    fc.assert(
      fc.property(layoutFileArb, (filePath) => {
        const content = fileContents[filePath];
        const pageType = extractDataPageType(content);
        return pageType !== null;
      }),
      { numRuns: 100 }
    );
  });

  test('data-page-type value is one of the valid page types', () => {
    fc.assert(
      fc.property(layoutFileArb, (filePath) => {
        const content = fileContents[filePath];
        const pageType = extractDataPageType(content);
        return VALID_PAGE_TYPES.includes(pageType);
      }),
      { numRuns: 100 }
    );
  });

  test('data-page-type value matches the layout file name', () => {
    fc.assert(
      fc.property(layoutFileArb, (filePath) => {
        const content = fileContents[filePath];
        const pageType = extractDataPageType(content);
        const expected = LAYOUT_PAGE_TYPE_MAP[filePath];
        return pageType === expected;
      }),
      { numRuns: 100 }
    );
  });

  test('data-page-type is on a div with id ending in -map and class map', () => {
    fc.assert(
      fc.property(layoutFileArb, (filePath) => {
        const content = fileContents[filePath];
        const expected = LAYOUT_PAGE_TYPE_MAP[filePath];

        // Verify the map container div has the expected id pattern
        const expectedId = `${expected}-map`;
        const idRegex = new RegExp(`<div\\s[^>]*\\bid="${expectedId}"[^>]*\\bclass="map"[^>]*>`);
        const match = idRegex.exec(content);
        if (!match) return false;

        // Verify data-page-type is on this same element
        const tag = match[0];
        const pageTypeMatch = /\bdata-page-type="([^"]*)"/.exec(tag);
        return pageTypeMatch !== null && pageTypeMatch[1] === expected;
      }),
      { numRuns: 100 }
    );
  });
});
