/**
 * Property-Based Tests for Waterway Menu Sorting and Limiting
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 5: Waterway Menu Sorting and Limiting**
 * **Validates: Requirements 4.1, 4.2**
 * 
 * Property: For any set of waterways marked for menu display, lakes shall be sorted 
 * by area descending and limited to 10, and rivers shall be sorted by length descending 
 * and limited to 10.
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 6: Waterway List Alphabetical Sorting**
 * **Validates: Requirements 4.3, 4.4**
 * 
 * Property: For any list of waterways (lakes or rivers), the items shall be sorted 
 * alphabetically by name in ascending order.
 */

const fc = require('fast-check');

// Implementation of waterway filtering and sorting (mirrors the Ruby plugin logic)
function topLakesByArea(waterways, locale, limit = 10) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  
  return waterways
    .filter(w => 
      w.locale === locale && 
      w.paddlingEnvironmentType_slug === 'see' && 
      w.showInMenu === true
    )
    .sort((a, b) => (b.area || 0) - (a.area || 0))
    .slice(0, limit);
}

function topRiversByLength(waterways, locale, limit = 10) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  
  return waterways
    .filter(w => 
      w.locale === locale && 
      w.paddlingEnvironmentType_slug === 'fluss' && 
      w.showInMenu === true
    )
    .sort((a, b) => (b.length || 0) - (a.length || 0))
    .slice(0, limit);
}

function sortWaterwaysAlphabetically(waterways) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  
  return [...waterways].sort((a, b) => 
    (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
  );
}

/**
 * Get all lakes for a locale, sorted alphabetically by name
 * Lakes are waterways with paddlingEnvironmentType_slug == "see"
 * Implements Property 6: Waterway List Alphabetical Sorting
 * Validates: Requirements 4.3
 */
function lakesAlphabetically(waterways, locale) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  
  return waterways
    .filter(w => w.locale === locale && w.paddlingEnvironmentType_slug === 'see')
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
}

/**
 * Get all rivers for a locale, sorted alphabetically by name
 * Rivers are waterways with paddlingEnvironmentType_slug == "fluss"
 * Implements Property 6: Waterway List Alphabetical Sorting
 * Validates: Requirements 4.4
 */
function riversAlphabetically(waterways, locale) {
  if (!Array.isArray(waterways) || waterways.length === 0) return [];
  
  return waterways
    .filter(w => w.locale === locale && w.paddlingEnvironmentType_slug === 'fluss')
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');
const environmentTypeArb = fc.constantFrom('see', 'fluss');

const waterwayArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: localeArb,
  paddlingEnvironmentType_slug: environmentTypeArb,
  showInMenu: fc.boolean(),
  area: fc.option(fc.float({ min: 0, max: 1000000, noNaN: true }), { nil: undefined }),
  length: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: undefined })
});

const waterwaysArrayArb = fc.array(waterwayArb, { minLength: 0, maxLength: 50 });

describe('Waterway Menu Sorting and Limiting - Property 5', () => {
  /**
   * Property 5: Waterway Menu Sorting and Limiting
   * For any set of waterways marked for menu display, lakes shall be sorted 
   * by area descending and limited to 10, and rivers shall be sorted by length 
   * descending and limited to 10.
   */

  describe('Lakes (sorted by area descending)', () => {
    test('lakes are sorted by area in descending order', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            
            // Check that lakes are sorted by area descending
            for (let i = 1; i < lakes.length; i++) {
              const prevArea = lakes[i - 1].area || 0;
              const currArea = lakes[i].area || 0;
              if (prevArea < currArea) {
                return false; // Not in descending order
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes result is limited to 10 items', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            return lakes.length <= 10;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes result only contains waterways with paddlingEnvironmentType_slug "see"', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            return lakes.every(lake => lake.paddlingEnvironmentType_slug === 'see');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes result only contains waterways with showInMenu true', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            return lakes.every(lake => lake.showInMenu === true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes result only contains waterways matching the locale', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            return lakes.every(lake => lake.locale === locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes with largest areas are selected when more than 10 exist', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = topLakesByArea(waterways, locale);
            
            // Get all eligible lakes
            const allEligibleLakes = waterways.filter(w => 
              w.locale === locale && 
              w.paddlingEnvironmentType_slug === 'see' && 
              w.showInMenu === true
            );
            
            if (allEligibleLakes.length <= 10) {
              // All eligible lakes should be included
              return lakes.length === allEligibleLakes.length;
            }
            
            // The smallest lake in results should be >= any lake not in results
            const minAreaInResults = Math.min(...lakes.map(l => l.area || 0));
            const notInResults = allEligibleLakes.filter(l => 
              !lakes.some(r => r.slug === l.slug)
            );
            
            return notInResults.every(l => (l.area || 0) <= minAreaInResults);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rivers (sorted by length descending)', () => {
    test('rivers are sorted by length in descending order', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            
            // Check that rivers are sorted by length descending
            for (let i = 1; i < rivers.length; i++) {
              const prevLength = rivers[i - 1].length || 0;
              const currLength = rivers[i].length || 0;
              if (prevLength < currLength) {
                return false; // Not in descending order
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers result is limited to 10 items', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            return rivers.length <= 10;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers result only contains waterways with paddlingEnvironmentType_slug "fluss"', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            return rivers.every(river => river.paddlingEnvironmentType_slug === 'fluss');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers result only contains waterways with showInMenu true', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            return rivers.every(river => river.showInMenu === true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers result only contains waterways matching the locale', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            return rivers.every(river => river.locale === locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers with longest lengths are selected when more than 10 exist', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = topRiversByLength(waterways, locale);
            
            // Get all eligible rivers
            const allEligibleRivers = waterways.filter(w => 
              w.locale === locale && 
              w.paddlingEnvironmentType_slug === 'fluss' && 
              w.showInMenu === true
            );
            
            if (allEligibleRivers.length <= 10) {
              // All eligible rivers should be included
              return rivers.length === allEligibleRivers.length;
            }
            
            // The shortest river in results should be >= any river not in results
            const minLengthInResults = Math.min(...rivers.map(r => r.length || 0));
            const notInResults = allEligibleRivers.filter(r => 
              !rivers.some(res => res.slug === r.slug)
            );
            
            return notInResults.every(r => (r.length || 0) <= minLengthInResults);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Alphabetical sorting (for list pages)', () => {
    test('waterways are sorted alphabetically by name (case-insensitive)', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          (waterways) => {
            const sorted = sortWaterwaysAlphabetically(waterways);
            
            // Check that waterways are sorted alphabetically
            for (let i = 1; i < sorted.length; i++) {
              const prevName = (sorted[i - 1].name || '').toLowerCase();
              const currName = (sorted[i].name || '').toLowerCase();
              if (prevName.localeCompare(currName) > 0) {
                return false; // Not in alphabetical order
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('alphabetical sorting preserves all items', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          (waterways) => {
            const sorted = sortWaterwaysAlphabetically(waterways);
            return sorted.length === waterways.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('alphabetical sorting is idempotent', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          (waterways) => {
            const sortedOnce = sortWaterwaysAlphabetically(waterways);
            const sortedTwice = sortWaterwaysAlphabetically(sortedOnce);
            
            return sortedOnce.length === sortedTwice.length &&
                   sortedOnce.every((item, i) => item.slug === sortedTwice[i].slug);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('empty waterways array returns empty result for lakes', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const lakes = topLakesByArea([], locale);
            return lakes.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty waterways array returns empty result for rivers', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const rivers = topRiversByLength([], locale);
            return rivers.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/undefined waterways returns empty result', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const lakesNull = topLakesByArea(null, locale);
            const lakesUndefined = topLakesByArea(undefined, locale);
            const riversNull = topRiversByLength(null, locale);
            const riversUndefined = topRiversByLength(undefined, locale);
            
            return lakesNull.length === 0 && 
                   lakesUndefined.length === 0 &&
                   riversNull.length === 0 &&
                   riversUndefined.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterways with undefined area/length are treated as 0', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              locale: fc.constant('de'),
              paddlingEnvironmentType_slug: fc.constant('see'),
              showInMenu: fc.constant(true),
              area: fc.constant(undefined)
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (waterways) => {
            const lakes = topLakesByArea(waterways, 'de');
            // Should not throw and should return results
            return lakes.length === Math.min(waterways.length, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 6: Waterway List Alphabetical Sorting
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 6: Waterway List Alphabetical Sorting**
 * **Validates: Requirements 4.3, 4.4**
 * 
 * Property: For any list of waterways (lakes or rivers), the items shall be sorted 
 * alphabetically by name in ascending order.
 */
describe('Waterway List Alphabetical Sorting - Property 6', () => {
  
  describe('Lakes list page (sorted alphabetically)', () => {
    test('lakes are sorted alphabetically by name (ascending, case-insensitive)', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = lakesAlphabetically(waterways, locale);
            
            // Check that lakes are sorted alphabetically
            for (let i = 1; i < lakes.length; i++) {
              const prevName = (lakes[i - 1].name || '').toLowerCase();
              const currName = (lakes[i].name || '').toLowerCase();
              if (prevName.localeCompare(currName) > 0) {
                return false; // Not in alphabetical order
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes list only contains waterways with paddlingEnvironmentType_slug "see"', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = lakesAlphabetically(waterways, locale);
            return lakes.every(lake => lake.paddlingEnvironmentType_slug === 'see');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes list only contains waterways matching the locale', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = lakesAlphabetically(waterways, locale);
            return lakes.every(lake => lake.locale === locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes list includes all lakes for the locale (no limit)', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const lakes = lakesAlphabetically(waterways, locale);
            const expectedCount = waterways.filter(w => 
              w.locale === locale && w.paddlingEnvironmentType_slug === 'see'
            ).length;
            return lakes.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('lakes list sorting is idempotent', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const sortedOnce = lakesAlphabetically(waterways, locale);
            const sortedTwice = lakesAlphabetically(sortedOnce, locale);
            
            return sortedOnce.length === sortedTwice.length &&
                   sortedOnce.every((item, i) => item.slug === sortedTwice[i].slug);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rivers list page (sorted alphabetically)', () => {
    test('rivers are sorted alphabetically by name (ascending, case-insensitive)', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = riversAlphabetically(waterways, locale);
            
            // Check that rivers are sorted alphabetically
            for (let i = 1; i < rivers.length; i++) {
              const prevName = (rivers[i - 1].name || '').toLowerCase();
              const currName = (rivers[i].name || '').toLowerCase();
              if (prevName.localeCompare(currName) > 0) {
                return false; // Not in alphabetical order
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers list only contains waterways with paddlingEnvironmentType_slug "fluss"', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = riversAlphabetically(waterways, locale);
            return rivers.every(river => river.paddlingEnvironmentType_slug === 'fluss');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers list only contains waterways matching the locale', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = riversAlphabetically(waterways, locale);
            return rivers.every(river => river.locale === locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers list includes all rivers for the locale (no limit)', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const rivers = riversAlphabetically(waterways, locale);
            const expectedCount = waterways.filter(w => 
              w.locale === locale && w.paddlingEnvironmentType_slug === 'fluss'
            ).length;
            return rivers.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rivers list sorting is idempotent', () => {
      fc.assert(
        fc.property(
          waterwaysArrayArb,
          localeArb,
          (waterways, locale) => {
            const sortedOnce = riversAlphabetically(waterways, locale);
            const sortedTwice = riversAlphabetically(sortedOnce, locale);
            
            return sortedOnce.length === sortedTwice.length &&
                   sortedOnce.every((item, i) => item.slug === sortedTwice[i].slug);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases for list pages', () => {
    test('empty waterways array returns empty result for lakes list', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const lakes = lakesAlphabetically([], locale);
            return lakes.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty waterways array returns empty result for rivers list', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const rivers = riversAlphabetically([], locale);
            return rivers.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/undefined waterways returns empty result for list pages', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const lakesNull = lakesAlphabetically(null, locale);
            const lakesUndefined = lakesAlphabetically(undefined, locale);
            const riversNull = riversAlphabetically(null, locale);
            const riversUndefined = riversAlphabetically(undefined, locale);
            
            return lakesNull.length === 0 && 
                   lakesUndefined.length === 0 &&
                   riversNull.length === 0 &&
                   riversUndefined.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterways with empty names are handled correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: fc.string({ minLength: 1, maxLength: 50 }),
              name: fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined), fc.string({ minLength: 1, maxLength: 100 })),
              locale: fc.constant('de'),
              paddlingEnvironmentType_slug: fc.constant('see'),
              showInMenu: fc.boolean(),
              area: fc.option(fc.float({ min: 0, max: 1000000, noNaN: true }), { nil: undefined })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (waterways) => {
            // Should not throw
            const lakes = lakesAlphabetically(waterways, 'de');
            return Array.isArray(lakes);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
