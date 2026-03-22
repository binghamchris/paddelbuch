/**
 * Property-Based Test for Marker Registry Deduplication
 *
 * // Feature: multi-dimension-spot-filter, Property 5: Marker registry deduplication
 * **Validates: Requirements 4.3, 9.3**
 *
 * Property: For any sequence of register calls where some slugs appear more than
 * once, size() shall equal the number of unique slugs in the sequence, and forEach
 * shall visit each unique slug exactly once.
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

// Arbitrary: mock Leaflet marker (plain object with a unique identity)
const mockMarkerArb = fc.record({
  _id: fc.uuid(),
  addTo: fc.constant(function() {}),
  remove: fc.constant(function() {})
});

// Arbitrary: metadata object matching the registry's expected shape
const metadataArb = fc.record({
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
  paddleCraftTypes: fc.subarray(PADDLE_CRAFT_SLUGS, { minLength: 0 }),
  paddlingEnvironmentType_slug: fc.constantFrom(...ENVIRONMENT_SLUGS)
});

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
 * Arbitrary: generate a sequence of register calls with intentional slug duplicates.
 * Uses a constrained slug pool (1-5 unique slugs) and draws 2-20 calls from that pool,
 * guaranteeing at least some duplicates when the call count exceeds the pool size.
 */
const registerCallSequenceArb = fc
  .uniqueArray(slugArb, { minLength: 1, maxLength: 5 })
  .chain((slugPool) =>
    fc.tuple(
      fc.constant(slugPool),
      fc.array(
        fc.tuple(
          fc.constantFrom(...slugPool),
          mockMarkerArb,
          metadataArb
        ),
        { minLength: 2, maxLength: 20 }
      )
    )
  );

describe('Marker Registry Deduplication - Property 5', () => {
  /**
   * Property 5: size() equals the number of unique slugs after registering
   * a sequence with intentional duplicates.
   */
  test('size() equals unique slug count after registering duplicates', () => {
    fc.assert(
      fc.property(
        registerCallSequenceArb,
        ([slugPool, calls]) => {
          const registry = freshRegistry();

          // Register all calls (including duplicates)
          for (const [slug, marker, metadata] of calls) {
            registry.register(slug, marker, metadata);
          }

          // Compute unique slugs from the call sequence
          const uniqueSlugs = new Set(calls.map(([slug]) => slug));

          return registry.size() === uniqueSlugs.size;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: forEach visits each unique slug exactly once after registering
   * a sequence with intentional duplicates.
   */
  test('forEach visits each unique slug exactly once', () => {
    fc.assert(
      fc.property(
        registerCallSequenceArb,
        ([slugPool, calls]) => {
          const registry = freshRegistry();

          // Register all calls (including duplicates)
          for (const [slug, marker, metadata] of calls) {
            registry.register(slug, marker, metadata);
          }

          // Collect visited slugs
          const visitedSlugs = [];
          registry.forEach((entrySlug) => {
            visitedSlugs.push(entrySlug);
          });

          // Compute unique slugs from the call sequence
          const uniqueSlugs = new Set(calls.map(([slug]) => slug));

          // Must visit exactly the unique slug count
          if (visitedSlugs.length !== uniqueSlugs.size) return false;

          // Each unique slug must appear exactly once
          const visitedSet = new Set(visitedSlugs);
          if (visitedSet.size !== visitedSlugs.length) return false;

          // Every unique slug must have been visited
          for (const slug of uniqueSlugs) {
            if (!visitedSet.has(slug)) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: The first registration wins -- duplicate register calls
   * do not overwrite the original marker or metadata.
   */
  test('duplicate register calls preserve the first marker and metadata', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        mockMarkerArb,
        metadataArb,
        (slug, firstMarker, firstMeta, secondMarker, secondMeta) => {
          const registry = freshRegistry();

          registry.register(slug, firstMarker, firstMeta);
          registry.register(slug, secondMarker, secondMeta);

          // Size must be 1
          if (registry.size() !== 1) return false;

          // forEach must yield the first marker and metadata
          let found = null;
          registry.forEach((entrySlug, entryMarker, entryMetadata) => {
            if (entrySlug === slug) {
              found = { marker: entryMarker, metadata: entryMetadata };
            }
          });

          if (!found) return false;

          // Must be the first registration's marker
          if (found.marker !== firstMarker) return false;

          // Must be the first registration's metadata
          if (found.metadata.spotType_slug !== firstMeta.spotType_slug) return false;
          if (found.metadata.paddlingEnvironmentType_slug !== firstMeta.paddlingEnvironmentType_slug) return false;
          if (found.metadata.paddleCraftTypes.length !== firstMeta.paddleCraftTypes.length) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
