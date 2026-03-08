/**
 * Property-Based Tests for Liquid Template Content Reduction
 *
 * **Feature: liquid-rendering-optimization, Property 8: Liquid template content reduction**
 * **Validates: Requirements 7.1**
 *
 * Property: For any modified layout or include file, the number of characters inside
 * <script> blocks that require Liquid processing shall be strictly less after extraction
 * than before extraction.
 *
 * Approach: Baseline character counts were captured from the pre-extraction commit
 * (1e7dcd9) using the extractInlineScriptBodies helper. The current (post-extraction)
 * files are read at test time and their Liquid script character counts are compared
 * against the baselines.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Baseline character counts of inline <script> block content containing Liquid
 * interpolation tags, measured from the pre-extraction commit (1e7dcd9).
 *
 * Only files that had a positive baseline are included — filter-panel.html had
 * zero Liquid script characters before extraction, so the "strictly less"
 * property does not apply to it.
 */
const BASELINE_LIQUID_SCRIPT_CHARS = {
  '_layouts/spot.html': 3218,
  '_layouts/obstacle.html': 3037,
  '_layouts/waterway.html': 2414,
  '_layouts/notice.html': 5116,
  '_includes/layer-control.html': 17795,
  '_includes/detail-map-layers.html': 4939,
};

const FILES_WITH_REDUCTION = Object.keys(BASELINE_LIQUID_SCRIPT_CHARS);

// ---------------------------------------------------------------------------
// Helpers (same pattern as Property 2 test)
// ---------------------------------------------------------------------------

/**
 * Extracts inline script block bodies from HTML content.
 * Returns an array of strings, each being the body text of a <script> block
 * that is NOT a src-only script tag (i.e., has actual inline content).
 */
function extractInlineScriptBodies(htmlContent) {
  const scriptBodies = [];
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
 * Counts the total number of characters inside inline <script> blocks
 * that contain Liquid interpolation tags ({{ or {%).
 */
function countLiquidScriptChars(htmlContent) {
  const bodies = extractInlineScriptBodies(htmlContent);
  return bodies
    .filter((body) => body.includes('{{') || body.includes('{%'))
    .reduce((sum, body) => sum + body.length, 0);
}

/**
 * Reads the content of a template file.
 */
function readTemplateFile(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Picks one of the six files that had Liquid script content before extraction. */
const fileArb = fc.constantFrom(...FILES_WITH_REDUCTION);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Liquid Template Content Reduction — Property 8', () => {
  // Pre-load all file contents once
  const fileContents = {};
  beforeAll(() => {
    for (const filePath of FILES_WITH_REDUCTION) {
      fileContents[filePath] = readTemplateFile(filePath);
    }
  });

  test('Liquid script character count is strictly less after extraction than before', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const currentContent = fileContents[filePath];
        const afterChars = countLiquidScriptChars(currentContent);
        const beforeChars = BASELINE_LIQUID_SCRIPT_CHARS[filePath];

        return afterChars < beforeChars;
      }),
      { numRuns: 100 }
    );
  });

  test('all files with Liquid baselines now have zero Liquid script characters', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const currentContent = fileContents[filePath];
        const afterChars = countLiquidScriptChars(currentContent);

        return afterChars === 0;
      }),
      { numRuns: 100 }
    );
  });

  test('reduction magnitude is equal to the full baseline (complete removal)', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        const currentContent = fileContents[filePath];
        const afterChars = countLiquidScriptChars(currentContent);
        const beforeChars = BASELINE_LIQUID_SCRIPT_CHARS[filePath];
        const reduction = beforeChars - afterChars;

        // The reduction should equal the entire baseline — all Liquid script
        // content was removed, not just partially reduced.
        return reduction === beforeChars;
      }),
      { numRuns: 100 }
    );
  });

  test('each baseline was a positive number of characters', () => {
    fc.assert(
      fc.property(fileArb, (filePath) => {
        // Sanity check: every file in our set had Liquid script content before
        return BASELINE_LIQUID_SCRIPT_CHARS[filePath] > 0;
      }),
      { numRuns: 100 }
    );
  });
});
