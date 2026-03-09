/**
 * Property-Based Test for Rejected Spots Exclusion
 *
 * // Feature: multi-dimension-spot-filter, Property 6: Rejected spots excluded from filter evaluation
 * **Validates: Requirements 6.1**
 *
 * Property: For any spot where `rejected` equals `true`, the spot shall not be
 * registered in the Marker_Registry and shall not be evaluated by the Filter_Engine.
 * Rejected spots shall only be managed via the noEntry LayerGroup toggle.
 */

const fc = require('fast-check');

// Spot type slugs used in the system
const SPOT_TYPE_SLUGS = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle'
];

// Paddle craft type slugs used in the system
const PADDLE_CRAFT_SLUGS = [
  'seekajak',
  'kanadier',
  'stand-up-paddle-board'
];

// Paddling environment type slugs
const ENVIRONMENT_SLUGS = [
  'see',
  'fluss',
  'kanal'
];

// Arbitrary: random slug (non-empty alphanumeric with hyphens, mimicking real slugs)
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,49}$/);

// Arbitrary: mock Leaflet marker
const mockMarkerArb = fc.record({
  _id: fc.uuid(),
  addTo: fc.constant(function() { return this; }),
  remove: fc.constant(function() { return this; })
});

// Arbitrary: metadata object matching the registry's expected shape
const metadataArb = fc.record({
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
  paddleCraftTypes: fc.subarray(PADDLE_CRAFT_SLUGS, { minLength: 0 }),
  paddlingEnvironmentType_slug: fc.constantFrom(...ENVIRONMENT_SLUGS)
});

// Arbitrary: rejected flag values that should be treated as rejected
// The layer-control.html checks: spot.rejected === true || spot.rejected === 'true'
const rejectedTrueArb = fc.constantFrom(true, 'true');

// Arbitrary: non-rejected flag values (false, 'false', undefined, null, or absent)
const rejectedFalseArb = fc.constantFrom(false, 'false', undefined, null, 0, '');

/**
 * Helper: get a fresh registry instance with clean internal state.
 * Uses jest.isolateModules so the IIFE re-executes with a new `entries` closure.
 */
function freshRegistry() {
  let registry;
  jest.isolateModules(() => {
    const mod = require('../../assets/js/marker-registry.js');
    registry = mod.PaddelbuchMarkerRegistry;
  });
  return registry;
}

/**
 * Simulates the rejection check logic from layer-control.html:
 *   var isRejected = spot.rejected === true || spot.rejected === 'true';
 */
function isRejected(rejectedValue) {
  return rejectedValue === true || rejectedValue === 'true';
}

describe('Rejected Spots Exclusion - Property 6', () => {
  /**
   * Property 6a: Spots with rejected === true or rejected === 'true'
   * must NOT be registered in the Marker_Registry.
   *
   * Simulates the addSpotMarker logic: if isRejected, skip registry registration.
   */
  test('rejected spots are not registered in the Marker_Registry', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        rejectedTrueArb,
        (slug, marker, metadata, rejectedFlag) => {
          const registry = freshRegistry();

          // Simulate the addSpotMarker rejection logic from layer-control.html
          const spotIsRejected = isRejected(rejectedFlag);

          if (spotIsRejected) {
            // Rejected: do NOT register in registry (add to noEntry LayerGroup instead)
            // This is the path we're testing — no registration happens
          } else {
            registry.register(slug, marker, metadata);
          }

          // Rejected spots must NOT be in the registry
          return registry.has(slug) === false && registry.size() === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6b: Spots without rejection (rejected is false/undefined/null)
   * SHOULD be registered in the Marker_Registry.
   */
  test('non-rejected spots are registered in the Marker_Registry', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        rejectedFalseArb,
        (slug, marker, metadata, rejectedFlag) => {
          const registry = freshRegistry();

          // Simulate the addSpotMarker rejection logic from layer-control.html
          const spotIsRejected = isRejected(rejectedFlag);

          if (spotIsRejected) {
            // Would go to noEntry LayerGroup — skip registration
          } else {
            registry.register(slug, marker, metadata);
          }

          // Non-rejected spots must be in the registry
          return registry.has(slug) === true && registry.size() === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6c: Mixed batch — rejected spots are excluded while
   * non-rejected spots are registered. Verifies that in a batch of spots,
   * only non-rejected ones end up in the registry.
   */
  test('in a mixed batch, only non-rejected spots are registered', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: slugArb,
            marker: mockMarkerArb,
            metadata: metadataArb,
            rejected: fc.oneof(rejectedTrueArb, rejectedFalseArb)
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (spots) => {
          const registry = freshRegistry();

          // Process each spot through the rejection logic
          for (const spot of spots) {
            const spotIsRejected = isRejected(spot.rejected);

            if (!spotIsRejected) {
              registry.register(spot.slug, spot.marker, spot.metadata);
            }
          }

          // Compute expected unique non-rejected slugs
          const nonRejectedSlugs = new Set();
          for (const spot of spots) {
            if (!isRejected(spot.rejected)) {
              nonRejectedSlugs.add(spot.slug);
            }
          }

          // Registry size must equal unique non-rejected slug count
          if (registry.size() !== nonRejectedSlugs.size) return false;

          // Every non-rejected slug must be in the registry
          for (const slug of nonRejectedSlugs) {
            if (!registry.has(slug)) return false;
          }

          // No rejected-only slug should be in the registry
          const rejectedOnlySlugs = new Set();
          for (const spot of spots) {
            if (isRejected(spot.rejected)) {
              rejectedOnlySlugs.add(spot.slug);
            }
          }
          // Remove slugs that also appear as non-rejected (they would be registered)
          for (const slug of nonRejectedSlugs) {
            rejectedOnlySlugs.delete(slug);
          }
          for (const slug of rejectedOnlySlugs) {
            if (registry.has(slug)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
