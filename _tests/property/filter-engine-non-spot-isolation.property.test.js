/**
 * Property-Based Test for Non-Spot Layer Isolation
 *
 * // Feature: multi-dimension-spot-filter, Property 7: Filter engine does not alter non-spot layers
 * **Validates: Requirements 7.4**
 *
 * Property: For any filter state change and subsequent call to applyFilters(),
 * the visibility state of non-spot LayerGroups (event notices, obstacles,
 * protected areas) on the map shall remain unchanged. The Filter_Engine only
 * iterates markers in PaddelbuchMarkerRegistry and calls addTo(map) or
 * marker.remove() on them -- it never touches non-spot LayerGroups.
 */

const fc = require('fast-check');

/**
 * Helper: get fresh filter engine and marker registry instances.
 * Uses jest.isolateModules so the IIFE re-executes with fresh closure state.
 */
function freshModules() {
  let engine, registry;
  jest.isolateModules(() => {
    const regMod = require('../../assets/js/marker-registry.js');
    registry = regMod.PaddelbuchMarkerRegistry;

    // Marker registry must be on global before filter engine loads
    global.PaddelbuchMarkerRegistry = registry;

    const engMod = require('../../assets/js/filter-engine.js');
    engine = engMod.PaddelbuchFilterEngine;
  });
  return { engine, registry };
}

/** Arbitrary: option slug */
const optionSlugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

/** Arbitrary: spot type slugs used in the spot type dimension */
const spotTypeSlugs = ['einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte', 'notauswasserungsstelle'];

/** Arbitrary: craft type slugs used in the craft type dimension */
const craftTypeSlugs = ['seekajak', 'kanadier', 'stand-up-paddle-board'];

/**
 * Arbitrary: generate a filter state scenario -- a subset of selected slugs
 * per dimension (spot type and craft type).
 */
const filterStateArb = fc.record({
  selectedSpotTypes: fc.subarray(spotTypeSlugs, { minLength: 0 }),
  selectedCraftTypes: fc.subarray(craftTypeSlugs, { minLength: 0 })
});

/**
 * Arbitrary: generate a set of spot markers to register in the registry.
 */
const spotArb = fc.record({
  slug: fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
  spotType_slug: fc.constantFrom(...spotTypeSlugs),
  paddleCraftTypes: fc.subarray(craftTypeSlugs, { minLength: 1 }),
  paddlingEnvironmentType_slug: fc.constantFrom('see', 'fluss', 'kanal')
});

const spotsArb = fc.uniqueArray(spotArb, { minLength: 0, maxLength: 10, selector: s => s.slug });

describe('Filter Engine Non-Spot Layer Isolation - Property 7', () => {
  afterEach(() => {
    delete global.PaddelbuchMarkerRegistry;
  });

  /**
   * Property 7: applyFilters() does not call addTo or remove on non-spot LayerGroups.
   *
   * We set up a mock map that has non-spot LayerGroups (event notices, obstacles,
   * protected areas) with jest.fn() tracking on addTo and remove. We register
   * spot markers in the registry, call applyFilters with various filter states,
   * and assert the non-spot LayerGroups were never touched.
   */
  test('applyFilters never calls addTo or remove on non-spot LayerGroups', () => {
    fc.assert(
      fc.property(
        spotsArb,
        filterStateArb,
        (spots, filterState) => {
          const { engine, registry } = freshModules();

          // Create mock non-spot LayerGroups with call tracking
          const eventNoticesLayer = {
            addTo: jest.fn(),
            remove: jest.fn()
          };
          const obstaclesLayer = {
            addTo: jest.fn(),
            remove: jest.fn()
          };
          const protectedAreasLayer = {
            addTo: jest.fn(),
            remove: jest.fn()
          };

          // Mock map object -- non-spot layers are "on" the map but the filter
          // engine should never interact with them
          const mockMap = {
            _eventNotices: eventNoticesLayer,
            _obstacles: obstaclesLayer,
            _protectedAreas: protectedAreasLayer
          };

          // Build dimension configs matching the real application setup
          const dimensionConfigs = [
            {
              key: 'spotType',
              label: 'Spot Type',
              options: spotTypeSlugs.map(s => ({ slug: s, label: s })),
              matchFn: function(meta, selectedSet) {
                return selectedSet.has(meta.spotType_slug);
              }
            },
            {
              key: 'paddleCraftType',
              label: 'Paddle Craft Type',
              options: craftTypeSlugs.map(s => ({ slug: s, label: s })),
              matchFn: function(meta, selectedSet) {
                var types = meta.paddleCraftTypes || [];
                for (var i = 0; i < types.length; i++) {
                  if (selectedSet.has(types[i])) return true;
                }
                return false;
              }
            }
          ];

          engine.init(dimensionConfigs, mockMap);

          // Register spot markers with their own addTo/remove mocks
          spots.forEach(spot => {
            const marker = {
              addTo: jest.fn(),
              remove: jest.fn()
            };
            registry.register(spot.slug, marker, {
              spotType_slug: spot.spotType_slug,
              paddleCraftTypes: spot.paddleCraftTypes,
              paddlingEnvironmentType_slug: spot.paddlingEnvironmentType_slug
            });
          });

          // Apply the random filter state
          spotTypeSlugs.forEach(slug => {
            engine.setOption('spotType', slug, filterState.selectedSpotTypes.includes(slug));
          });
          craftTypeSlugs.forEach(slug => {
            engine.setOption('paddleCraftType', slug, filterState.selectedCraftTypes.includes(slug));
          });

          // Execute applyFilters
          engine.applyFilters();

          // Assert: non-spot LayerGroups were NEVER touched
          expect(eventNoticesLayer.addTo).not.toHaveBeenCalled();
          expect(eventNoticesLayer.remove).not.toHaveBeenCalled();
          expect(obstaclesLayer.addTo).not.toHaveBeenCalled();
          expect(obstaclesLayer.remove).not.toHaveBeenCalled();
          expect(protectedAreasLayer.addTo).not.toHaveBeenCalled();
          expect(protectedAreasLayer.remove).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

});
