/**
 * Property-Based Test for Marker Registry Round-Trip
 *
 * // Feature: multi-dimension-spot-filter, Property 4: Marker registry round-trip
 * **Validates: Requirements 4.1, 4.2, 4.4**
 *
 * Property: For any spot slug, Leaflet marker, and metadata object (containing
 * spotType_slug, paddleCraftTypes, and paddlingEnvironmentType_slug), after calling
 * register(slug, marker, metadata), iterating with forEach shall yield an entry
 * with the same slug, marker reference, and metadata values.
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
 * In Node's CommonJS, `this` inside the IIFE is `module.exports`,
 * so PaddelbuchMarkerRegistry is attached to the module's exports object.
 */
function freshRegistry() {
  let registry;
  jest.isolateModules(() => {
    const mod = require('../../assets/js/marker-registry.js');
    registry = mod.PaddelbuchMarkerRegistry;
  });
  return registry;
}

describe('Marker Registry Round-Trip - Property 4', () => {
  /**
   * Property 4: Marker registry round-trip
   *
   * For any slug, marker, and metadata, after register(slug, marker, metadata),
   * forEach yields an entry with the same slug, marker reference, and metadata values.
   */
  test('registered entry is retrievable via forEach with correct slug, marker, and metadata', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        (slug, marker, metadata) => {
          const registry = freshRegistry();

          registry.register(slug, marker, metadata);

          // Collect all entries via forEach
          const found = [];
          registry.forEach((entrySlug, entryMarker, entryMetadata) => {
            found.push({ slug: entrySlug, marker: entryMarker, metadata: entryMetadata });
          });

          // Exactly one entry should exist
          if (found.length !== 1) return false;

          const entry = found[0];

          // Slug must match
          if (entry.slug !== slug) return false;

          // Marker reference must be the same object
          if (entry.marker !== marker) return false;

          // Metadata fields must match
          if (entry.metadata.spotType_slug !== metadata.spotType_slug) return false;
          if (entry.metadata.paddlingEnvironmentType_slug !== metadata.paddlingEnvironmentType_slug) return false;

          // paddleCraftTypes array must have same elements
          if (entry.metadata.paddleCraftTypes.length !== metadata.paddleCraftTypes.length) return false;
          for (let i = 0; i < metadata.paddleCraftTypes.length; i++) {
            if (entry.metadata.paddleCraftTypes[i] !== metadata.paddleCraftTypes[i]) return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('has() returns true for a registered slug', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        (slug, marker, metadata) => {
          const registry = freshRegistry();

          registry.register(slug, marker, metadata);

          return registry.has(slug) === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('size() returns 1 after a single registration', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        (slug, marker, metadata) => {
          const registry = freshRegistry();

          registry.register(slug, marker, metadata);

          return registry.size() === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('forEach visits the registered entry exactly once', () => {
    fc.assert(
      fc.property(
        slugArb,
        mockMarkerArb,
        metadataArb,
        (slug, marker, metadata) => {
          const registry = freshRegistry();

          registry.register(slug, marker, metadata);

          let visitCount = 0;
          registry.forEach((entrySlug) => {
            if (entrySlug === slug) visitCount++;
          });

          return visitCount === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('multiple distinct registrations are all retrievable via forEach', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(slugArb, { minLength: 1, maxLength: 10 }),
        fc.array(metadataArb, { minLength: 10, maxLength: 10 }),
        (slugs, metadataList) => {
          const registry = freshRegistry();

          // Create a unique marker per slug
          const markers = slugs.map((_, i) => ({ _id: i, addTo: function() {}, remove: function() {} }));

          // Register each
          for (let i = 0; i < slugs.length; i++) {
            registry.register(slugs[i], markers[i], metadataList[i]);
          }

          // Verify size
          if (registry.size() !== slugs.length) return false;

          // Collect all entries
          const foundSlugs = new Set();
          registry.forEach((entrySlug, entryMarker, entryMetadata) => {
            foundSlugs.add(entrySlug);

            // Find the index of this slug
            const idx = slugs.indexOf(entrySlug);
            if (idx === -1) return false;

            // Verify marker reference
            if (entryMarker !== markers[idx]) return false;

            // Verify metadata
            if (entryMetadata.spotType_slug !== metadataList[idx].spotType_slug) return false;
          });

          // All slugs must have been visited
          return foundSlugs.size === slugs.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});
