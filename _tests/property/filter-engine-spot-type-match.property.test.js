/**
 * Property-Based Test for Spot Type Match Function
 *
 * // Feature: multi-dimension-spot-filter, Property 2: Spot type match function
 * **Validates: Requirements 2.5**
 *
 * Property: For any spot with a spotType_slug value and for any set of selected
 * spot type slugs, the spot type match function shall return true if and only if
 * the spot's spotType_slug is a member of the selected set.
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

const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

describe('Filter Engine Spot Type Match - Property 2', () => {
  /**
   * Property 2: Spot type match function
   *
   * The spot type matchFn returns selectedSlugs.has(metadata.spotType_slug).
   * We verify this by initializing the engine with a spotType dimension,
   * setting the filter state to a random set of selected slugs, and asserting
   * evaluateMarker matches the expected Set.has result.
   */
  test('spot type match returns true iff spotType_slug is in the selected set', () => {
    fc.assert(
      fc.property(
        slugArb,
        fc.uniqueArray(slugArb, { minLength: 0, maxLength: 10 }),
        (spotTypeSlug, selectedSlugsArray) => {
          const engine = freshFilterEngine();

          // Build the selected set from the generated array
          const selectedSet = new Set(selectedSlugsArray);

          // All possible option slugs = selected slugs + the test slug (to ensure it's a valid option)
          const allOptionSlugs = new Set(selectedSlugsArray);
          allOptionSlugs.add(spotTypeSlug);

          // Build dimension config with the spot type matchFn from the design doc
          const dimensionConfigs = [{
            key: 'spotType',
            label: 'Spot Type',
            options: [...allOptionSlugs].map(slug => ({ slug, label: slug })),
            matchFn: function(metadata, selectedSlugs) {
              return selectedSlugs.has(metadata.spotType_slug);
            }
          }];

          const mockMap = {};
          engine.init(dimensionConfigs, mockMap);

          // Deselect all options first (init selects all by default)
          [...allOptionSlugs].forEach(slug => {
            engine.setOption('spotType', slug, false);
          });

          // Select only the desired slugs
          selectedSlugsArray.forEach(slug => {
            engine.setOption('spotType', slug, true);
          });

          const metadata = { spotType_slug: spotTypeSlug };

          // If selected set is empty, dimension is inactive -> evaluateMarker returns true
          // Otherwise, result should match selectedSet.has(spotTypeSlug)
          const expected = selectedSet.size === 0 ? true : selectedSet.has(spotTypeSlug);
          const actual = engine.evaluateMarker(metadata);

          return actual === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
