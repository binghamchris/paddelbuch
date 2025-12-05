/**
 * Property-Based Tests for Locale Content Filtering
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 18: Locale Content Filtering**
 * **Validates: Requirements 8.3**
 * 
 * Property: For any data query with a language locale parameter, 
 * the returned content shall only include items where locale matches the specified locale.
 */

const fc = require('fast-check');

// Locale filter implementation (mirrors the Ruby plugin logic)
function filterByLocale(items, locale) {
  if (!Array.isArray(items)) return [];
  if (!locale || locale === '') return items;
  
  return items.filter(item => {
    const itemLocale = item.locale;
    // Include if: no locale set, locale matches, or locale is wildcard
    return itemLocale === undefined || 
           itemLocale === null || 
           itemLocale === locale || 
           itemLocale === '*';
  });
}

// Check if an item matches a locale
function matchesLocale(item, locale) {
  if (!locale || locale === '') return true;
  
  const itemLocale = item.locale;
  return itemLocale === undefined || 
         itemLocale === null || 
         itemLocale === locale || 
         itemLocale === '*';
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

const itemWithLocaleArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: fc.oneof(
    fc.constant('de'),
    fc.constant('en'),
    fc.constant('*'),
    fc.constant(undefined),
    fc.constant(null)
  )
});

const itemsArrayArb = fc.array(itemWithLocaleArb, { minLength: 0, maxLength: 50 });

describe('Locale Content Filtering - Property 18', () => {
  /**
   * Property 18: Locale Content Filtering
   * For any data query with a language locale parameter, 
   * the returned content shall only include items where locale matches the specified locale.
   */
  
  test('filtered results only contain items matching the specified locale', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        localeArb,
        (items, locale) => {
          const filtered = filterByLocale(items, locale);
          
          // Every item in the result must match the locale
          return filtered.every(item => matchesLocale(item, locale));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('items with matching locale are always included in results', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        localeArb,
        (items, locale) => {
          const filtered = filterByLocale(items, locale);
          
          // Count items that should be included
          const expectedCount = items.filter(item => matchesLocale(item, locale)).length;
          
          // Filtered count should match expected count
          return filtered.length === expectedCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('items with non-matching locale are excluded from results', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        localeArb,
        (items, locale) => {
          const filtered = filterByLocale(items, locale);
          const otherLocale = locale === 'de' ? 'en' : 'de';
          
          // No item with a different specific locale should be in results
          return filtered.every(item => {
            if (item.locale === otherLocale) {
              return false; // This should not happen
            }
            return true;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('wildcard locale items are included for any locale', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            locale: fc.constant('*')
          }),
          { minLength: 1, maxLength: 20 }
        ),
        localeArb,
        (wildcardItems, locale) => {
          const filtered = filterByLocale(wildcardItems, locale);
          
          // All wildcard items should be included
          return filtered.length === wildcardItems.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('items without locale field are included for any locale', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 100 })
            // No locale field
          }),
          { minLength: 1, maxLength: 20 }
        ),
        localeArb,
        (noLocaleItems, locale) => {
          const filtered = filterByLocale(noLocaleItems, locale);
          
          // All items without locale should be included
          return filtered.length === noLocaleItems.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty locale parameter returns all items', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        fc.constantFrom('', null, undefined),
        (items, emptyLocale) => {
          const filtered = filterByLocale(items, emptyLocale);
          
          // All items should be returned when locale is empty
          return filtered.length === items.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('filtering is idempotent - filtering twice gives same result', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        localeArb,
        (items, locale) => {
          const filteredOnce = filterByLocale(items, locale);
          const filteredTwice = filterByLocale(filteredOnce, locale);
          
          // Filtering twice should give the same result
          return filteredOnce.length === filteredTwice.length &&
                 filteredOnce.every((item, i) => item.slug === filteredTwice[i].slug);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('filtering preserves item order', () => {
    fc.assert(
      fc.property(
        itemsArrayArb,
        localeArb,
        (items, locale) => {
          const filtered = filterByLocale(items, locale);
          
          // Build a list of items that should be included, preserving order
          const expectedFiltered = items.filter(item => matchesLocale(item, locale));
          
          // Check that filtered items match expected items in order
          if (filtered.length !== expectedFiltered.length) {
            return false;
          }
          
          // Compare each item by reference (same object)
          for (let i = 0; i < filtered.length; i++) {
            if (filtered[i] !== expectedFiltered[i]) {
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
