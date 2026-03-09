/**
 * Property-Based Test for Paddle Craft Type Match Function
 *
 * // Feature: multi-dimension-spot-filter, Property 3: Paddle craft type match function — set intersection
 * **Validates: Requirements 3.5**
 *
 * Property: For any spot with a paddleCraftTypes array and for any set of selected
 * paddle craft type slugs, the paddle craft type match function shall return true
 * if and only if the intersection of the spot's paddleCraftTypes array and the
 * selected set is non-empty.
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

describe('Filter Engine Craft Type Match - Property 3', () => {
  /**
   * Property 3: Paddle craft type match function — set intersection
   *
   * The paddle craft type matchFn iterates the spot's paddleCraftTypes array
   * and returns true if any element is in the selected set.
   * We verify this by initializing the engine with a paddleCraftType dimension,
   * setting the filter state to a random set of selected slugs, and asserting
   * evaluateMarker matches whether the intersection is non-empty.
   */
  test('craft type match returns true iff paddleCraftTypes intersects selected set', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(slugArb, { minLength: 0, maxLength: 8 }),
        fc.uniqueArray(slugArb, { minLength: 0, maxLength: 10 }),
        (paddleCraftTypes, selectedSlugsArray) => {
          const engine = freshFilterEngine();

          const selectedSet = new Set(selectedSlugsArray);

          // All possible option slugs = selected slugs + spot's craft types (to ensure valid options)
          const allOptionSlugs = new Set(selectedSlugsArray);
          paddleCraftTypes.forEach(slug => allOptionSlugs.add(slug));

          // Build dimension config with the paddle craft type matchFn from the design doc
          const dimensionConfigs = [{
            key: 'paddleCraftType',
            label: 'Paddle Craft Type',
            options: [...allOptionSlugs].map(slug => ({ slug, label: slug })),
            matchFn: function(meta, selected) {
              var types = meta.paddleCraftTypes || [];
              for (var i = 0; i < types.length; i++) {
                if (selected.has(types[i])) return true;
              }
              return false;
            }
          }];

          const mockMap = {};
          engine.init(dimensionConfigs, mockMap);

          // Deselect all options first (init selects all by default)
          [...allOptionSlugs].forEach(slug => {
            engine.setOption('paddleCraftType', slug, false);
          });

          // Select only the desired slugs
          selectedSlugsArray.forEach(slug => {
            engine.setOption('paddleCraftType', slug, true);
          });

          const metadata = { paddleCraftTypes: paddleCraftTypes };

          // Compute expected: if selected set is empty, dimension is inactive → true
          // Otherwise, true iff intersection of paddleCraftTypes and selectedSet is non-empty
          const hasIntersection = paddleCraftTypes.some(t => selectedSet.has(t));
          const expected = selectedSet.size === 0 ? true : hasIntersection;
          const actual = engine.evaluateMarker(metadata);

          return actual === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
