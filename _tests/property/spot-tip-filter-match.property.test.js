/**
 * Property-Based Test for spotTipType Filter Match Function
 *
 * // Feature: spot-tips, Property 4: spotTipType Filter Match Function Correctness
 * **Validates: Requirements 2.6, 2.7**
 *
 * Property: For any spot metadata with a spotTipType_slugs array and any set of
 * selected option slugs, the spotTipType match function shall return true if and
 * only if: (a) the spot has at least one tip slug present in the selected set, OR
 * (b) the spot has zero tip slugs and __no_tips__ is in the selected set.
 */

const fc = require('fast-check');

/**
 * Helper: get a fresh filter engine instance with clean internal state.
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

describe('Filter Engine spotTipType Match - Property 4', () => {
  /**
   * Property 4: spotTipType Filter Match Function Correctness
   *
   * The spotTipType matchFn checks:
   * - If spot has no tips (empty array): returns selected.has('__no_tips__')
   * - If spot has tips: returns true if any tip slug is in the selected set
   *
   * We verify this by initializing the engine with a spotTipType dimension,
   * setting the filter state to a random set of selected slugs, and asserting
   * evaluateMarker matches the expected logic.
   */
  test('spotTipType match returns true iff (a) tip slug in selected set, or (b) zero tips and __no_tips__ selected', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(slugArb, { minLength: 0, maxLength: 6 }),
        fc.uniqueArray(slugArb, { minLength: 0, maxLength: 8 }),
        fc.boolean(),
        (spotTipTypeSlugs, selectedTipSlugs, includeNoTips) => {
          const engine = freshFilterEngine();

          // Build the selected set: the tip slugs plus optionally __no_tips__
          const selectedArray = includeNoTips
            ? [...selectedTipSlugs, '__no_tips__']
            : [...selectedTipSlugs];
          const selectedSet = new Set(selectedArray);

          // All possible option slugs = selected + spot's tip slugs + __no_tips__
          const allOptionSlugs = new Set(selectedArray);
          spotTipTypeSlugs.forEach(slug => allOptionSlugs.add(slug));
          allOptionSlugs.add('__no_tips__');

          // Build dimension config with the spotTipType matchFn from the design doc
          const dimensionConfigs = [{
            key: 'spotTipType',
            label: 'Spot Tips',
            options: [...allOptionSlugs].map(slug => ({ slug, label: slug })),
            matchFn: function(meta, selected) {
              var tipSlugs = meta.spotTipType_slugs || [];
              if (tipSlugs.length === 0) {
                return selected.has('__no_tips__');
              }
              for (var i = 0; i < tipSlugs.length; i++) {
                if (selected.has(tipSlugs[i])) return true;
              }
              return false;
            }
          }];

          const mockMap = {};
          engine.init(dimensionConfigs, mockMap);

          // Deselect all options first (init selects all by default)
          [...allOptionSlugs].forEach(slug => {
            engine.setOption('spotTipType', slug, false);
          });

          // Select only the desired slugs
          selectedArray.forEach(slug => {
            engine.setOption('spotTipType', slug, true);
          });

          const metadata = { spotTipType_slugs: spotTipTypeSlugs };

          // Compute expected result:
          // If selected set is empty, dimension is inactive → evaluateMarker returns true
          if (selectedSet.size === 0) {
            return engine.evaluateMarker(metadata) === true;
          }

          // Otherwise apply the match logic:
          let expected;
          if (spotTipTypeSlugs.length === 0) {
            // No tips → visible only if __no_tips__ is selected
            expected = selectedSet.has('__no_tips__');
          } else {
            // Has tips → visible if any tip slug is in selected set
            expected = spotTipTypeSlugs.some(s => selectedSet.has(s));
          }

          return engine.evaluateMarker(metadata) === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
