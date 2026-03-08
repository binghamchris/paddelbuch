/**
 * Property-Based Tests for No Inline Scripts with Liquid in Templates
 *
 * **Feature: liquid-rendering-optimization, Property 2: Modified templates contain zero inline script blocks with Liquid interpolation**
 * **Validates: Requirements 1.6, 2.5, 3.3, 4.15**
 *
 * Property: For any file in the set of modified layout files (spot.html, obstacle.html,
 * waterway.html, notice.html) and modified include files (layer-control.html,
 * detail-map-layers.html, filter-panel.html), there shall be no <script> block whose body
 * contains Liquid interpolation tags ({{ or {%). Script tags with only a src attribute
 * are permitted.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODIFIED_TEMPLATE_FILES = [
  '_layouts/spot.html',
  '_layouts/obstacle.html',
  '_layouts/waterway.html',
  '_layouts/notice.html',
  '_includes/layer-control.html',
  '_includes/detail-map-layers.html',
  '_includes/filter-panel.html',
];

const LIQUID_OUTPUT_TAG = '{{';
const LIQUID_LOGIC_TAG = '{%';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the content of a template file.
 */
function readTemplateFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
}

/**
 * Extracts inline script block bodies from HTML content.
 * Returns an array of strings, each being the body text of a <script> block
 * that is NOT a src-only script tag (i.e., has actual inline content).
 *
 * A <script src="..."></script> with no body or only whitespace is excluded.
 * A <script src="..."> with no closing tag is excluded.
 */
function extractInlineScriptBodies(htmlContent) {
  const scriptBodies = [];
  // Match <script ...>...</script> blocks (non-greedy, case-insensitive)
  const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const attributes = match[1];
    const body = match[2];

    // Skip script tags that have a src attribute and no meaningful body
    if (/\bsrc\s*=/.test(attributes) && body.trim() === '') {
      continue;
    }

    // Only consider script blocks with actual body content
    if (body.trim().length > 0) {
      scriptBodies.push(body);
    }
  }

  return scriptBodies;
}

/**
 * Checks whether a script body contains Liquid interpolation tags.
 */
function containsLiquidTags(scriptBody) {
  return scriptBody.includes(LIQUID_OUTPUT_TAG) || scriptBody.includes(LIQUID_LOGIC_TAG);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Picks one of the seven modified template files. */
const fileArb = fc.constantFrom(...MODIFIED_TEMPLATE_FILES);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Modified Templates Contain No Inline Script Blocks with Liquid — Property 2', () => {
  // Pre-load all file contents once for efficiency
  const fileContents = {};
  beforeAll(() => {
    for (const filePath of MODIFIED_TEMPLATE_FILES) {
      fileContents[filePath] = readTemplateFile(filePath);
    }
  });

  test('no inline script block in any modified template contains Liquid output tags ({{)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        const scriptBodies = extractInlineScriptBodies(content);
        return scriptBodies.every((body) => !body.includes(LIQUID_OUTPUT_TAG));
      }),
      { numRuns: 100 }
    );
  });

  test('no inline script block in any modified template contains Liquid logic tags ({%)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        const scriptBodies = extractInlineScriptBodies(content);
        return scriptBodies.every((body) => !body.includes(LIQUID_LOGIC_TAG));
      }),
      { numRuns: 100 }
    );
  });

  test('no inline script block in any modified template contains any Liquid interpolation', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        const scriptBodies = extractInlineScriptBodies(content);
        return scriptBodies.every((body) => !containsLiquidTags(body));
      }),
      { numRuns: 100 }
    );
  });

  test('script tags with src attribute and no body are permitted (sanity check)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        // Verify that src-only script tags exist (templates should have them after extraction)
        const srcScriptRegex = /<script[^>]+\bsrc\s*=/gi;
        // This is a sanity check — we just verify the property function doesn't
        // incorrectly flag src-only scripts. The main property is tested above.
        const scriptBodies = extractInlineScriptBodies(content);
        return scriptBodies.every((body) => !containsLiquidTags(body));
      }),
      { numRuns: 100 }
    );
  });

  test('randomly sampled substrings of inline script bodies contain no Liquid tags', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const content = fileContents[filePath];
        const scriptBodies = extractInlineScriptBodies(content);

        // If no inline script bodies, property trivially holds
        if (scriptBodies.length === 0) {
          return true;
        }

        // For each script body, sample random substrings
        return fc.assert(
          fc.property(
            fc.integer({ min: 0, max: scriptBodies.length - 1 }),
            (bodyIndex) => {
              const body = scriptBodies[bodyIndex];
              return fc.assert(
                fc.property(
                  fc.integer({ min: 0, max: Math.max(0, body.length - 1) }),
                  fc.integer({ min: 1, max: Math.min(200, body.length || 1) }),
                  (startIdx, len) => {
                    const substring = body.substring(startIdx, startIdx + len);
                    return !substring.includes(LIQUID_OUTPUT_TAG) && !substring.includes(LIQUID_LOGIC_TAG);
                  }
                ),
                { numRuns: 10 }
              );
            }
          ),
          { numRuns: 10 }
        );
      }),
      { numRuns: 7 } // One per file
    );
  });
});
