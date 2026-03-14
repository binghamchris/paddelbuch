/**
 * Property-Based Tests for Waterway Event Notice List Filtering
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 17: Waterway Event Notice List Filtering**
 * **Validates: Requirements 7.5**
 * 
 * Property: For any waterway detail page, the event notice list shall contain only notices 
 * that affect that waterway AND have an end date in the future.
 */

const fc = require('fast-check');

/**
 * Filter event notices for a specific waterway
 * This mirrors the logic used in the event-list.html include
 * 
 * @param {Array} notices - Array of event notice objects
 * @param {string} waterwaySlug - The slug of the waterway to filter for
 * @param {Date} currentDate - The current date for comparison
 * @returns {Array} Filtered array of notices affecting the waterway with future end dates
 */
function filterNoticesForWaterway(notices, waterwaySlug, currentDate) {
  if (!Array.isArray(notices) || !waterwaySlug) {
    return [];
  }

  const today = currentDate instanceof Date ? currentDate : new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

  return notices.filter(notice => {
    // Check if notice has a valid end date in the future
    if (!notice.endDate) return false;
    
    const endDateStr = typeof notice.endDate === 'string' 
      ? notice.endDate.split('T')[0] 
      : new Date(notice.endDate).toISOString().split('T')[0];
    
    if (endDateStr < todayStr) return false;

    // Check if notice affects this waterway
    if (!Array.isArray(notice.waterways)) return false;
    
    return notice.waterways.includes(waterwaySlug);
  });
}

/**
 * Check if a date string is in the future relative to a reference date
 * 
 * @param {string} dateStr - Date string in ISO format
 * @param {Date} referenceDate - Reference date for comparison
 * @returns {boolean} True if dateStr is >= referenceDate
 */
function isDateInFuture(dateStr, referenceDate) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const refDate = new Date(referenceDate);
  // Compare dates only (ignore time)
  return date.toISOString().split('T')[0] >= refDate.toISOString().split('T')[0];
}

// Arbitraries for generating test data

const localeArb = fc.constantFrom('de', 'en');
const slugArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate dates within a reasonable range
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
  noInvalidDate: true
});

// Generate an ISO date string
const dateStringArb = dateArb.map(d => d.toISOString().split('T')[0]);

// Generate an array of waterway slugs
const waterwaySlugArrayArb = fc.array(slugArb, { minLength: 0, maxLength: 5 });

// Generate an event notice
const eventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: localeArb,
  description: fc.string({ minLength: 0, maxLength: 500 }),
  startDate: dateStringArb,
  endDate: dateStringArb,
  waterways: waterwaySlugArrayArb
});

// Generate an array of event notices
const eventNoticesArrayArb = fc.array(eventNoticeArb, { minLength: 0, maxLength: 30 });

// Generate a reference date (today)
const referenceDateArb = fc.date({
  min: new Date('2023-01-01'),
  max: new Date('2027-12-31'),
  noInvalidDate: true
});

describe('Waterway Event Notice List Filtering - Property 17', () => {
  /**
   * Property 17: Waterway Event Notice List Filtering
   * 
   * For any waterway detail page, the event notice list shall contain only notices 
   * that affect that waterway AND have an end date in the future.
   */

  describe('Filtering by waterway', () => {
    test('all returned notices affect the specified waterway', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Every returned notice must have the waterway in its waterways array
            return filtered.every(notice => 
              Array.isArray(notice.waterways) && 
              notice.waterways.includes(waterwaySlug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices not affecting the waterway are excluded', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Count notices that don't affect this waterway
            const notAffecting = notices.filter(n => 
              !Array.isArray(n.waterways) || !n.waterways.includes(waterwaySlug)
            );
            
            // None of these should be in the filtered result
            return notAffecting.every(n => 
              !filtered.some(f => f.slug === n.slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filtering by end date', () => {
    test('all returned notices have end date in the future', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Every returned notice must have an end date >= reference date
            return filtered.every(notice => 
              isDateInFuture(notice.endDate, referenceDate)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices with past end dates are excluded', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Find notices with past end dates
            const pastNotices = notices.filter(n => 
              n.endDate && !isDateInFuture(n.endDate, referenceDate)
            );
            
            // None of these should be in the filtered result
            return pastNotices.every(n => 
              !filtered.some(f => f.slug === n.slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices without end date are excluded', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: slugArb,
              name: fc.string({ minLength: 1, maxLength: 100 }),
              locale: localeArb,
              description: fc.string({ minLength: 0, maxLength: 500 }),
              startDate: dateStringArb,
              endDate: fc.constant(null),
              waterways: waterwaySlugArrayArb
            }),
            { minLength: 1, maxLength: 10 }
          ),
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            // Add the waterway to all notices to ensure they would match otherwise
            const noticesWithWaterway = notices.map(n => ({
              ...n,
              waterways: [...(n.waterways || []), waterwaySlug]
            }));
            
            const filtered = filterNoticesForWaterway(noticesWithWaterway, waterwaySlug, referenceDate);
            
            // All notices have null endDate, so none should be returned
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined filtering (waterway AND future date)', () => {
    test('only notices matching BOTH criteria are returned', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Every returned notice must satisfy both conditions
            return filtered.every(notice => 
              Array.isArray(notice.waterways) && 
              notice.waterways.includes(waterwaySlug) &&
              isDateInFuture(notice.endDate, referenceDate)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all notices matching both criteria are included', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Find all notices that should match
            const shouldMatch = notices.filter(n => 
              Array.isArray(n.waterways) && 
              n.waterways.includes(waterwaySlug) &&
              n.endDate &&
              isDateInFuture(n.endDate, referenceDate)
            );
            
            // All matching notices should be in the result
            return shouldMatch.every(n => 
              filtered.some(f => f.slug === n.slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('result count equals count of notices matching both criteria', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Count notices that should match
            const expectedCount = notices.filter(n => 
              Array.isArray(n.waterways) && 
              n.waterways.includes(waterwaySlug) &&
              n.endDate &&
              isDateInFuture(n.endDate, referenceDate)
            ).length;
            
            return filtered.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('empty notices array returns empty result', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          (waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway([], waterwaySlug, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null notices returns empty result', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          (waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(null, waterwaySlug, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('undefined notices returns empty result', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          (waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(undefined, waterwaySlug, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null waterway slug returns empty result', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, null, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty waterway slug returns empty result', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, '', referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices with empty waterways array are excluded', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              slug: slugArb,
              name: fc.string({ minLength: 1, maxLength: 100 }),
              locale: localeArb,
              endDate: dateStringArb,
              waterways: fc.constant([])
            }),
            { minLength: 1, maxLength: 10 }
          ),
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filtering is deterministic', () => {
    test('same inputs always produce same output', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered1 = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            const filtered2 = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            if (filtered1.length !== filtered2.length) return false;
            
            return filtered1.every((n, i) => n.slug === filtered2[i].slug);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filtering preserves notice data', () => {
    test('filtered notices retain all original properties', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          slugArb,
          referenceDateArb,
          (notices, waterwaySlug, referenceDate) => {
            const filtered = filterNoticesForWaterway(notices, waterwaySlug, referenceDate);
            
            // Each filtered notice should be identical to its original
            return filtered.every(filteredNotice => {
              const original = notices.find(n => n.slug === filteredNotice.slug);
              if (!original) return false;
              
              return filteredNotice.name === original.name &&
                     filteredNotice.endDate === original.endDate &&
                     filteredNotice.locale === original.locale;
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
