/**
 * Property-Based Test for Craft Filter Default-Selected Behaviour
 *
 * // Feature: paddlecraft-types-change, Property 4: Craft filter options default to selected
 * // Validates: Requirements 2.1
 *
 * Property: For any craft dimension configuration, after Filter_Engine
 * initialisation the dimension's selected set shall contain every option slug
 * (all options selected by default).
 *
 * This exercises the actual `assets/js/filter-engine.js` `init`, which seeds
 * each dimension's selected set with every option's slug.
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

// Slugs restricted to the option-slug shape used elsewhere in the filter tests.
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

// The two-option craft dimension introduced by this feature, in order.
const CRAFT_OPTION_SLUGS = ['klappbar-und-aufblasbar', 'hardshell'];

describe('Craft Filter Default-Selected - Property 4', () => {
  /**
   * Property 4: Craft filter options default to selected.
   *
   * After init, filterState[dimension.key] must be a Set containing exactly
   * every option slug of that dimension. We always include the fixed
   * two-option craft dimension, plus randomly generated additional dimensions
   * to exercise the init logic across arbitrary configurations.
   */
  test('after init, each dimension selected set contains every option slug', () => {
    // Generator for a single dimension config with a unique key and unique option slugs.
    const dimensionArb = fc.record({
      key: slugArb,
      options: fc.uniqueArray(
        slugArb.map(slug => ({ slug })),
        { minLength: 0, maxLength: 8, selector: o => o.slug }
      )
    });

    fc.assert(
      fc.property(
        fc.uniqueArray(dimensionArb, { minLength: 0, maxLength: 5, selector: d => d.key }),
        (randomDimensions) => {
          const engine = freshFilterEngine();

          // Fixed two-option craft dimension for this feature.
          const craftDimension = {
            key: 'paddleCraftType',
            label: 'Paddle Craft Type',
            options: CRAFT_OPTION_SLUGS.map(slug => ({ slug, label: slug }))
          };

          // Ensure random dimensions never collide with the craft dimension key.
          const otherDimensions = randomDimensions.filter(d => d.key !== 'paddleCraftType');
          const dimensionConfigs = [craftDimension, ...otherDimensions];

          const mockMap = {};
          engine.init(dimensionConfigs, mockMap);

          const state = engine.getFilterState();

          // For every dimension, the selected set must equal the set of its option slugs.
          for (const dim of dimensionConfigs) {
            const selected = state[dim.key];
            if (!(selected instanceof Set)) return false;

            const expectedSlugs = dim.options.map(o => o.slug);

            // Selected set contains every option slug...
            for (const slug of expectedSlugs) {
              if (!selected.has(slug)) return false;
            }
            // ...and nothing beyond the option slugs.
            if (selected.size !== expectedSlugs.length) return false;
          }

          // Explicit check on the craft dimension: both new options default-selected.
          const craftSelected = state['paddleCraftType'];
          return (
            craftSelected.size === CRAFT_OPTION_SLUGS.length &&
            CRAFT_OPTION_SLUGS.every(slug => craftSelected.has(slug))
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
