/**
 * Property-Based Test for Paddle Craft Type Match Function
 *
 * // Feature: multi-dimension-spot-filter, Property 3: Paddle craft type match function -- set intersection
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
   * Property 3: Paddle craft type match function -- set intersection
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

          // Compute expected: if selected set is empty, dimension is inactive -> true
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


/**
 * Property-Based Test for the two-option craft dimension (paddlecraft-types-change)
 *
 * // Feature: paddlecraft-types-change, Property 5: Craft dimension applies set-intersection with empty-selection meaning no restriction
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
 *
 * Property: For any spot paddleCraftTypes array and for any selected set of craft
 * slugs drawn from the two new options ([klappbar-und-aufblasbar, hardshell]), the
 * Filter_Engine considers the craft dimension satisfied if and only if either the
 * selected set contains every option (or is empty) -- imposing no restriction -- or
 * the intersection of the spot's paddleCraftTypes with the selected set is non-empty.
 */

const TWO_CRAFT_OPTIONS = ['klappbar-und-aufblasbar', 'hardshell'];

describe('Filter Engine Craft Type Match - two-option dimension (Property 5)', () => {
  /**
   * Property 5: Craft dimension set-intersection over the new two-option set.
   *
   * Exercises the reduced-cardinality dimension matching the new
   * { klappbar-und-aufblasbar, hardshell } option set. The underlying
   * set-intersection semantics are unchanged from the generic Property 3 above;
   * this scenario pins the behaviour to the two new craft slugs and covers the
   * "all selected" and "none selected" no-restriction cases (Requirements 2.2, 2.4)
   * alongside the strict-subset intersection cases (Requirements 2.3, 2.5).
   */
  test('two-option craft dimension satisfied iff all/none selected (no restriction) or intersection non-empty', () => {
    fc.assert(
      fc.property(
        // Spot references a non-empty subset of the two new craft options.
        fc.subarray(TWO_CRAFT_OPTIONS, { minLength: 1 }),
        // Selected set is any subset of the two options (0, 1, or 2 selected).
        fc.subarray(TWO_CRAFT_OPTIONS, { minLength: 0 }),
        (paddleCraftTypes, selectedSlugsArray) => {
          const engine = freshFilterEngine();

          const selectedSet = new Set(selectedSlugsArray);

          const dimensionConfigs = [{
            key: 'paddleCraftType',
            label: 'Paddle Craft Type',
            options: TWO_CRAFT_OPTIONS.map(slug => ({ slug, label: slug })),
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

          // Deselect all options first (init selects all by default),
          // then select exactly the desired subset.
          TWO_CRAFT_OPTIONS.forEach(slug => {
            engine.setOption('paddleCraftType', slug, false);
          });
          selectedSlugsArray.forEach(slug => {
            engine.setOption('paddleCraftType', slug, true);
          });

          const metadata = { paddleCraftTypes: paddleCraftTypes };

          // Expected per Property 5:
          //  - selected set empty OR contains every option -> no restriction (true)
          //  - otherwise (strict subset) -> intersection must be non-empty
          const containsAllOptions = TWO_CRAFT_OPTIONS.every(slug => selectedSet.has(slug));
          const hasIntersection = paddleCraftTypes.some(t => selectedSet.has(t));
          const expected = (selectedSet.size === 0 || containsAllOptions) ? true : hasIntersection;
          const actual = engine.evaluateMarker(metadata);

          return actual === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
