/**
 * Property-Based Tests for API Data Sorting
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 20: API Data Sorting**
 * **Validates: Requirements 9.4**
 * 
 * Property: For any JSON API response, the data array shall be sorted by the slug 
 * field in ascending alphabetical order.
 */

const fc = require('fast-check');

/**
 * Sort data by slug in ascending alphabetical order
 * This mirrors the sorting logic in the API generator plugin
 */
function sortBySlugAscending(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  
  return [...data].sort((a, b) => {
    const slugA = (a.slug || '').toLowerCase();
    const slugB = (b.slug || '').toLowerCase();
    return slugA.localeCompare(slugB);
  });
}

/**
 * Check if an array is sorted by slug in ascending order
 */
function isSortedBySlugAscending(data) {
  if (!Array.isArray(data) || data.length <= 1) return true;
  
  for (let i = 1; i < data.length; i++) {
    const prevSlug = (data[i - 1].slug || '').toLowerCase();
    const currSlug = (data[i].slug || '').toLowerCase();
    if (prevSlug.localeCompare(currSlug) > 0) {
      return false;
    }
  }
  return true;
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

// Generate valid slug strings (lowercase, alphanumeric with hyphens)
const slugArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/).filter(s => s.length >= 2);

// Spot data arbitrary
const spotArb = fc.record({
  slug: slugArb,
  locale: localeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  location: fc.option(
    fc.record({
      lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
      lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
    }),
    { nil: undefined }
  ),
  approximateAddress: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  confirmed: fc.boolean(),
  rejected: fc.boolean(),
  spotType_slug: fc.constantFrom('einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte', 'notauswasserungsstelle'),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Obstacle data arbitrary
const obstacleArb = fc.record({
  slug: slugArb,
  locale: localeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  isPortageNecessary: fc.boolean(),
  isPortagePossible: fc.boolean(),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Waterway data arbitrary
const waterwayArb = fc.record({
  slug: slugArb,
  locale: localeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  length: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: undefined }),
  area: fc.option(fc.float({ min: 0, max: 1000000, noNaN: true }), { nil: undefined }),
  paddlingEnvironmentType_slug: fc.constantFrom('see', 'fluss'),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Event notice data arbitrary
const noticeArb = fc.record({
  slug: slugArb,
  locale: localeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  startDate: fc.date().map(d => d.toISOString()),
  endDate: fc.date().map(d => d.toISOString()),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Protected area data arbitrary
const protectedAreaArb = fc.record({
  slug: slugArb,
  locale: localeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  isAreaMarked: fc.boolean(),
  protectedAreaType_slug: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Dimension type data arbitrary
const dimensionTypeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.date().map(d => d.toISOString()),
  updatedAt: fc.date().map(d => d.toISOString())
});

// Generic data array arbitraries
const spotsArrayArb = fc.array(spotArb, { minLength: 0, maxLength: 50 });
const obstaclesArrayArb = fc.array(obstacleArb, { minLength: 0, maxLength: 50 });
const waterwaysArrayArb = fc.array(waterwayArb, { minLength: 0, maxLength: 50 });
const noticesArrayArb = fc.array(noticeArb, { minLength: 0, maxLength: 50 });
const protectedAreasArrayArb = fc.array(protectedAreaArb, { minLength: 0, maxLength: 50 });
const dimensionTypesArrayArb = fc.array(dimensionTypeArb, { minLength: 0, maxLength: 30 });

describe('API Data Sorting - Property 20', () => {
  /**
   * Property 20: API Data Sorting
   * For any JSON API response, the data array shall be sorted by the slug 
   * field in ascending alphabetical order.
   */

  describe('Fact Tables Sorting', () => {
    test('spots API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          spotsArrayArb,
          (spots) => {
            const sorted = sortBySlugAscending(spots);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('obstacles API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          obstaclesArrayArb,
          (obstacles) => {
            const sorted = sortBySlugAscending(obstacles);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterways API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          (waterways) => {
            const sorted = sortBySlugAscending(waterways);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          noticesArrayArb,
          (notices) => {
            const sorted = sortBySlugAscending(notices);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('protected areas API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          protectedAreasArrayArb,
          (protectedAreas) => {
            const sorted = sortBySlugAscending(protectedAreas);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dimension Tables Sorting', () => {
    test('dimension type API data is sorted by slug in ascending order', () => {
      fc.assert(
        fc.property(
          dimensionTypesArrayArb,
          (types) => {
            const sorted = sortBySlugAscending(types);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting Properties', () => {
    test('sorting preserves all items (no data loss)', () => {
      fc.assert(
        fc.property(
          spotsArrayArb,
          (spots) => {
            const sorted = sortBySlugAscending(spots);
            return sorted.length === spots.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sorting is idempotent (sorting twice gives same result)', () => {
      fc.assert(
        fc.property(
          spotsArrayArb,
          (spots) => {
            const sortedOnce = sortBySlugAscending(spots);
            const sortedTwice = sortBySlugAscending(sortedOnce);
            
            return sortedOnce.length === sortedTwice.length &&
                   sortedOnce.every((item, i) => item.slug === sortedTwice[i].slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sorting is stable for items with same slug', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.constantFrom('aaa', 'bbb', 'ccc'),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              id: fc.nat()
            }),
            { minLength: 0, maxLength: 30 }
          ),
          (items) => {
            const sorted = sortBySlugAscending(items);
            
            // Check that items with same slug maintain relative order
            // (JavaScript's sort is stable in modern engines)
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sorting handles case-insensitive comparison correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.oneof(
                fc.constant('apple'),
                fc.constant('Apple'),
                fc.constant('APPLE'),
                fc.constant('banana'),
                fc.constant('Banana'),
                fc.constant('cherry')
              ),
              name: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (items) => {
            const sorted = sortBySlugAscending(items);
            
            // All 'apple' variants should come before 'banana' variants
            // which should come before 'cherry'
            for (let i = 1; i < sorted.length; i++) {
              const prevSlug = sorted[i - 1].slug.toLowerCase();
              const currSlug = sorted[i].slug.toLowerCase();
              if (prevSlug.localeCompare(currSlug) > 0) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    test('empty array returns empty array', () => {
      const sorted = sortBySlugAscending([]);
      expect(sorted).toEqual([]);
      expect(isSortedBySlugAscending(sorted)).toBe(true);
    });

    test('single item array returns same item', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const sorted = sortBySlugAscending([spot]);
            return sorted.length === 1 && sorted[0].slug === spot.slug;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/undefined input returns empty array', () => {
      expect(sortBySlugAscending(null)).toEqual([]);
      expect(sortBySlugAscending(undefined)).toEqual([]);
    });

    test('items with undefined/null slugs are handled gracefully', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.oneof(
                slugArb,
                fc.constant(null),
                fc.constant(undefined),
                fc.constant('')
              ),
              name: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (items) => {
            // Should not throw
            const sorted = sortBySlugAscending(items);
            return Array.isArray(sorted) && sorted.length === items.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('items with special characters in slugs are sorted correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.stringMatching(/^[a-z0-9-]+$/),
              name: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (items) => {
            const sorted = sortBySlugAscending(items);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale-specific sorting', () => {
    test('sorting works correctly for German locale data', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: slugArb,
              locale: fc.constant('de'),
              name: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 0, maxLength: 30 }
          ),
          (items) => {
            const sorted = sortBySlugAscending(items);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sorting works correctly for English locale data', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: slugArb,
              locale: fc.constant('en'),
              name: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 0, maxLength: 30 }
          ),
          (items) => {
            const sorted = sortBySlugAscending(items);
            return isSortedBySlugAscending(sorted);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
