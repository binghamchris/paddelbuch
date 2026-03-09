/**
 * Property-Based Test for AND-Logic Evaluation
 *
 * // Feature: multi-dimension-spot-filter, Property 1: AND-logic evaluation across active dimensions
 * **Validates: Requirements 1.2, 1.5**
 *
 * Property: For any set of spot metadata and for any filter state (with any number
 * of dimensions, each having zero or more selected options), evaluateMarker(metadata)
 * shall return true if and only if the spot satisfies every dimension that has at
 * least one option selected. A dimension with no options selected (empty set) shall
 * be treated as inactive and shall not affect the result.
 */

const fc = require('fast-check');

/**
 * Helper: get a fresh filter engine instance with clean internal state.
 * Uses jest.isolateModules so the IIFE re-executes with fresh closure state.
 */
function freshFilterEngine() {
  let engine;
  jest.isolateModules(() => {
    const mod = require('../../assets/js/filter-engine.js');
    engine = mod.PaddelbuchFilterEngine;
  });
  return engine;
}

/**
 * Arbitrary: generate a dimension config with a deterministic matchFn.
 *
 * Each dimension has a key, a set of all possible option slugs, and a matchFn
 * that checks whether the metadata's value for that dimension key is in the
 * selected set. We use a simple "slug membership" pattern so we can manually
 * replicate the AND-logic check in the test assertion.
 */
const dimensionKeyArb = fc.stringMatching(/^[a-z]{1,10}$/);
const optionSlugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

/**
 * Generate a single dimension config: key, options array, and which options
 * are selected in the filter state.
 */
const dimensionArb = fc.record({
  key: dimensionKeyArb,
  options: fc.uniqueArray(optionSlugArb, { minLength: 1, maxLength: 8, selector: (s) => s }),
  selectedIndices: fc.array(fc.nat({ max: 7 }), { minLength: 0, maxLength: 8 })
}).map(({ key, options, selectedIndices }) => {
  // Deduplicate and clamp selected indices to valid range
  const validIndices = [...new Set(selectedIndices.filter(i => i < options.length))];
  const selectedSlugs = validIndices.map(i => options[i]);

  return {
    key,
    options,
    selectedSlugs
  };
});

/**
 * Generate a full test scenario: 1-5 dimensions with unique keys,
 * plus a metadata value per dimension key.
 */
const scenarioArb = fc
  .array(dimensionArb, { minLength: 1, maxLength: 5 })
  .chain((dims) => {
    // Ensure unique dimension keys
    const seen = new Set();
    const uniqueDims = dims.filter(d => {
      if (seen.has(d.key)) return false;
      seen.add(d.key);
      return true;
    });

    // For each dimension, generate a metadata value (either one of the
    // dimension's options or a random slug that may not be in the options)
    const metaValueArbs = uniqueDims.map(d =>
      fc.oneof(
        fc.constantFrom(...d.options),           // value from the dimension's options
        optionSlugArb                             // random value (may or may not match)
      )
    );

    return fc.tuple(fc.constant(uniqueDims), ...metaValueArbs);
  })
  .map(([dims, ...metaValues]) => {
    const metadata = {};
    dims.forEach((d, i) => {
      metadata[d.key] = metaValues[i];
    });
    return { dims, metadata };
  });

describe('Filter Engine AND-Logic Evaluation - Property 1', () => {
  /**
   * Property 1: AND-logic evaluation across active dimensions
   *
   * evaluateMarker returns true iff ALL active dimensions' matchFn return true.
   * A dimension is active when its selected set is non-empty.
   */
  test('evaluateMarker result matches manual AND-logic check across random dimensions', () => {
    fc.assert(
      fc.property(
        scenarioArb,
        ({ dims, metadata }) => {
          const engine = freshFilterEngine();

          // Build dimension configs with matchFn that checks slug membership
          const dimensionConfigs = dims.map(d => ({
            key: d.key,
            label: d.key,
            options: d.options.map(slug => ({ slug, label: slug })),
            matchFn: function(meta, selectedSet) {
              return selectedSet.has(meta[d.key]);
            }
          }));

          // Mock map (not used by evaluateMarker, but needed for init)
          const mockMap = {};

          engine.init(dimensionConfigs, mockMap);

          // Set the filter state: deselect all first, then select only the desired ones
          dims.forEach(d => {
            // Deselect all options first
            d.options.forEach(slug => {
              engine.setOption(d.key, slug, false);
            });
            // Select only the chosen ones
            d.selectedSlugs.forEach(slug => {
              engine.setOption(d.key, slug, true);
            });
          });

          // Compute expected result manually using AND-logic
          let expected = true;
          for (let i = 0; i < dims.length; i++) {
            const d = dims[i];
            const selectedSet = new Set(d.selectedSlugs);

            // Skip inactive dimensions (empty selected set)
            if (selectedSet.size === 0) {
              continue;
            }

            // Check if metadata value is in the selected set
            if (!selectedSet.has(metadata[d.key])) {
              expected = false;
              break;
            }
          }

          const actual = engine.evaluateMarker(metadata);

          return actual === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: when ALL dimensions are inactive (empty selected sets),
   * evaluateMarker should return true for any metadata.
   */
  test('all dimensions inactive (empty selected sets) returns true for any metadata', () => {
    fc.assert(
      fc.property(
        fc.array(dimensionKeyArb, { minLength: 1, maxLength: 5 }).map(keys => [...new Set(keys)]),
        fc.record({
          spotType_slug: optionSlugArb,
          paddleCraftTypes: fc.array(optionSlugArb, { minLength: 0, maxLength: 3 })
        }),
        (keys, metadata) => {
          const engine = freshFilterEngine();

          // Build dimensions with options but we'll deselect all
          const dimensionConfigs = keys.map(key => ({
            key,
            label: key,
            options: [{ slug: 'opt-a', label: 'A' }, { slug: 'opt-b', label: 'B' }],
            matchFn: function(meta, selectedSet) {
              return selectedSet.has(meta[key]);
            }
          }));

          engine.init(dimensionConfigs, {});

          // Deselect all options in every dimension
          keys.forEach(key => {
            engine.setOption(key, 'opt-a', false);
            engine.setOption(key, 'opt-b', false);
          });

          // All dimensions inactive → should return true
          return engine.evaluateMarker(metadata) === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
