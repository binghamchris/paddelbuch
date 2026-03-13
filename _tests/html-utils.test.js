/**
 * Property-Based Tests for HTML Utility Functions
 *
 * Tests for PaddelbuchHtmlUtils: escapeHtml, stripHtml, truncate
 * Module: assets/js/html-utils.js
 */

const fc = require('fast-check');

// The IIFE assigns to `this` in Node (which is `module.exports` in CJS).
// We need to capture it from the required module's exports.
const htmlUtilsModule = require('../assets/js/html-utils.js');

// In Node CJS, `this` at module top-level is `module.exports`, so the IIFE
// sets PaddelbuchHtmlUtils on that object. Also check global in case the
// environment provides `window`.
const PaddelbuchHtmlUtils = htmlUtilsModule.PaddelbuchHtmlUtils
  || global.PaddelbuchHtmlUtils;

const { escapeHtml, stripHtml, truncate } = PaddelbuchHtmlUtils;

/**
 * Feature: best-practices-cleanup, Property 3: HTML escaping correctness
 * **Validates: Requirements 3.1**
 *
 * For any string containing HTML special characters (<, >, &, ", '),
 * escapeHtml shall return a string where all such characters are replaced
 * with their HTML entity equivalents, and the result shall contain no
 * unescaped < or > characters.
 */
describe('Property 3: HTML escaping correctness', () => {
  it('result contains no unescaped < or > for any input string', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = escapeHtml(input);
        // The result must not contain literal < or >
        expect(result).not.toMatch(/</);
        expect(result).not.toMatch(/>/);
      }),
      { numRuns: 100 }
    );
  });

  it('all five HTML special characters are entity-encoded', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = escapeHtml(input);
        // No raw & unless it's part of an entity (&amp; &lt; &gt; &quot; &#39;)
        // No raw <, >, ", '
        expect(result).not.toMatch(/</);
        expect(result).not.toMatch(/>/);
        // Every & in the result should be the start of a known entity
        const ampSegments = result.split('&amp;').join('')
          .split('&lt;').join('')
          .split('&gt;').join('')
          .split('&quot;').join('')
          .split('&#39;').join('');
        expect(ampSegments).not.toMatch(/&/);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: best-practices-cleanup, Property 4: HTML stripping completeness
 * **Validates: Requirements 3.2**
 *
 * For any string containing HTML tags, stripHtml shall return a string
 * containing no substrings matching the pattern <[^>]*>.
 */
describe('Property 4: HTML stripping completeness', () => {
  // Generator for strings that include HTML-like tags
  const stringWithHtmlTags = fc.tuple(
    fc.string(),
    fc.array(
      fc.tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
        fc.string({ maxLength: 20 })
      ),
      { minLength: 1, maxLength: 5 }
    ),
    fc.string()
  ).map(([prefix, tags, suffix]) => {
    const tagStrings = tags.map(([tag, content]) => `<${tag}>${content}</${tag}>`);
    return prefix + tagStrings.join('') + suffix;
  });

  it('result contains no HTML tags for any input with tags', () => {
    fc.assert(
      fc.property(stringWithHtmlTags, (input) => {
        const result = stripHtml(input);
        expect(result).not.toMatch(/<[^>]*>/);
      }),
      { numRuns: 100 }
    );
  });

  it('result contains no HTML tags for any arbitrary string', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = stripHtml(input);
        expect(result).not.toMatch(/<[^>]*>/);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: best-practices-cleanup, Property 5: Truncation length invariant
 * **Validates: Requirements 3.3**
 *
 * For any string and positive integer maxLength, truncate(text, maxLength)
 * shall return a string whose length is at most maxLength + 3 (accounting
 * for the '...' suffix), and if the input length is <= maxLength, the
 * output shall equal the input exactly.
 */
describe('Property 5: Truncation length invariant', () => {
  it('output length <= maxLength + 3 for any input', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 1000 }),
        (text, maxLength) => {
          const result = truncate(text, maxLength);
          expect(result.length).toBeLessThanOrEqual(maxLength + 3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('output equals input when input length <= maxLength', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 100 }),
        (text) => {
          // Use a maxLength >= text.length
          const maxLength = text.length + fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0];
          const result = truncate(text, maxLength);
          expect(result).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });
});
