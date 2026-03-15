/**
 * Property-Based Tests for Event Notice Date Filtering
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 13: Event Notice Date Filtering**
 * **Validates: Requirements 7.1**
 * 
 * Property: For any set of waterway event notices, only notices where the end date 
 * is in the future (relative to current date) shall be displayed on the map.
 */

const fc = require('fast-check');

/**
 * Checks if a date string represents a date in the future (or today)
 * This mirrors the logic in event-notice-popup.js
 * 
 * @param {string|Date} dateValue - The date to check (ISO string or Date object)
 * @param {Date} [referenceDate] - Optional reference date (defaults to current date)
 * @returns {boolean} True if the date is today or in the future
 */
function isDateInFuture(dateValue, referenceDate) {
  if (!dateValue) return false;
  
  var date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    date = new Date(dateValue);
  }
  
  // Check for invalid date
  if (isNaN(date.getTime())) return false;
  
  var refDate = referenceDate instanceof Date ? referenceDate : new Date();
  
  // Compare dates only (ignore time) by comparing YYYY-MM-DD strings
  var dateStr = date.toISOString().split('T')[0];
  var refDateStr = refDate.toISOString().split('T')[0];
  
  return dateStr >= refDateStr;
}

/**
 * Filters event notices to only include those with future end dates
 * This mirrors the logic in event-notice-popup.js
 * 
 * @param {Array} notices - Array of event notice objects
 * @param {Date} [referenceDate] - Optional reference date (defaults to current date)
 * @returns {Array} Filtered array of notices with future end dates
 */
function filterActiveNotices(notices, referenceDate) {
  if (!Array.isArray(notices)) return [];
  
  return notices.filter(function(notice) {
    return isDateInFuture(notice.endDate, referenceDate);
  });
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

// Generate a location object
const locationArb = fc.record({
  lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
  lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
});

// Generate an event notice
const eventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: localeArb,
  description: fc.string({ minLength: 0, maxLength: 500 }),
  startDate: dateStringArb,
  endDate: dateStringArb,
  location: fc.option(locationArb, { nil: undefined }),
  affectedArea: fc.option(fc.constant('{"type":"Polygon","coordinates":[[[6.0,46.0],[6.1,46.0],[6.1,46.1],[6.0,46.1],[6.0,46.0]]]}'), { nil: undefined }),
  waterways: fc.array(slugArb, { minLength: 0, maxLength: 5 })
});

// Generate an array of event notices
const eventNoticesArrayArb = fc.array(eventNoticeArb, { minLength: 0, maxLength: 30 });

// Generate a reference date (today)
const referenceDateArb = fc.date({
  min: new Date('2023-01-01'),
  max: new Date('2027-12-31'),
  noInvalidDate: true
});

describe('Event Notice Date Filtering - Property 13', () => {
  /**
   * Property 13: Event Notice Date Filtering
   * 
   * For any set of waterway event notices, only notices where the end date 
   * is in the future (relative to current date) shall be displayed on the map.
   */

  describe('isDateInFuture function', () => {
    test('returns true for dates in the future', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            const futureDateStr = futureDate.toISOString().split('T')[0];
            
            return isDateInFuture(futureDateStr, referenceDate) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns true for today (same date)', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          (referenceDate) => {
            const todayStr = referenceDate.toISOString().split('T')[0];
            return isDateInFuture(todayStr, referenceDate) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns false for dates in the past', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (referenceDate, daysInPast) => {
            const pastDate = new Date(referenceDate);
            pastDate.setDate(pastDate.getDate() - daysInPast);
            const pastDateStr = pastDate.toISOString().split('T')[0];
            
            return isDateInFuture(pastDateStr, referenceDate) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns false for null or undefined dates', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          fc.constantFrom(null, undefined, ''),
          (referenceDate, invalidDate) => {
            return isDateInFuture(invalidDate, referenceDate) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns false for invalid date strings', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          fc.constantFrom('not-a-date', 'invalid', '2023-13-45', 'abc123'),
          (referenceDate, invalidDate) => {
            return isDateInFuture(invalidDate, referenceDate) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles Date objects as input', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            // Pass Date object instead of string
            return isDateInFuture(futureDate, referenceDate) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('filterActiveNotices function', () => {
    test('all returned notices have end date in the future', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
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
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
            // Find notices with past end dates
            const pastNotices = notices.filter(n => 
              n.endDate && !isDateInFuture(n.endDate, referenceDate)
            );
            
            // None of these should be in the filtered result
            return pastNotices.every(n => 
              !filtered.includes(n)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all notices with future end dates are included', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
            // Find notices with future end dates
            const futureNotices = notices.filter(n => 
              isDateInFuture(n.endDate, referenceDate)
            );
            
            // All of these should be in the filtered result
            return futureNotices.every(n => 
              filtered.includes(n)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('result count equals count of notices with future end dates', () => {
      fc.assert(
        fc.property(
          eventNoticesArrayArb,
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
            // Count notices that should match
            const expectedCount = notices.filter(n => 
              isDateInFuture(n.endDate, referenceDate)
            ).length;
            
            return filtered.length === expectedCount;
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
              startDate: dateStringArb,
              endDate: fc.constant(null),
              location: fc.option(locationArb, { nil: undefined })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
            // All notices have null endDate, so none should be returned
            return filtered.length === 0;
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
          referenceDateArb,
          (referenceDate) => {
            const filtered = filterActiveNotices([], referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null notices returns empty result', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          (referenceDate) => {
            const filtered = filterActiveNotices(null, referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('undefined notices returns empty result', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          (referenceDate) => {
            const filtered = filterActiveNotices(undefined, referenceDate);
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
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered1 = filterActiveNotices(notices, referenceDate);
            const filtered2 = filterActiveNotices(notices, referenceDate);
            
            if (filtered1.length !== filtered2.length) return false;
            
            return filtered1.every((n, i) => n === filtered2[i]);
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
          referenceDateArb,
          (notices, referenceDate) => {
            const filtered = filterActiveNotices(notices, referenceDate);
            
            // Each filtered notice should be reference-identical to its original
            // (filter returns the same objects, not copies)
            return filtered.every(filteredNotice => {
              return notices.includes(filteredNotice);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Date boundary conditions', () => {
    test('notice ending exactly on reference date is included', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          slugArb,
          (referenceDate, slug) => {
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: referenceDate.toISOString().split('T')[0]
            };
            
            const filtered = filterActiveNotices([notice], referenceDate);
            return filtered.length === 1 && filtered[0].slug === slug;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notice ending one day before reference date is excluded', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          slugArb,
          (referenceDate, slug) => {
            const yesterday = new Date(referenceDate);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: yesterday.toISOString().split('T')[0]
            };
            
            const filtered = filterActiveNotices([notice], referenceDate);
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notice ending one day after reference date is included', () => {
      fc.assert(
        fc.property(
          referenceDateArb,
          slugArb,
          (referenceDate, slug) => {
            const tomorrow = new Date(referenceDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: tomorrow.toISOString().split('T')[0]
            };
            
            const filtered = filterActiveNotices([notice], referenceDate);
            return filtered.length === 1 && filtered[0].slug === slug;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
