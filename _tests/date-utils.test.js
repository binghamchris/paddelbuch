/**
 * Property-Based Tests for Date Utility Functions
 *
 * Tests for PaddelbuchDateUtils: isDateInFuture, formatDate
 * Module: assets/js/date-utils.js
 */

const fc = require('fast-check');

// The IIFE assigns PaddelbuchDateUtils to `this`, which in Node CJS is `module.exports`.
const dateUtilsModule = require('../assets/js/date-utils.js');
const PaddelbuchDateUtils = dateUtilsModule.PaddelbuchDateUtils
  || global.PaddelbuchDateUtils;

const { isDateInFuture, formatDate, monthsAbbr } = PaddelbuchDateUtils;

/**
 * Feature: best-practices-cleanup, Property 6: Date-in-future uses date-only comparison
 * **Validates: Requirements 3.7**
 *
 * For any two dates where the date-only components (YYYY-MM-DD) are equal,
 * isDateInFuture(date, referenceDate) shall return true regardless of the
 * time components. For any date whose date-only component is strictly before
 * the reference date's date-only component, isDateInFuture shall return false.
 */
describe('Property 6: Date-in-future uses date-only comparison', () => {
  // Generator for a valid UTC date component (year, month, day)
  // Using UTC avoids timezone shifts when toISOString() converts to UTC
  const dateComponentArb = fc.record({
    year: fc.integer({ min: 2000, max: 2050 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }) // 28 to avoid invalid day-of-month
  });

  // Generator for UTC time components (hours, minutes, seconds, ms)
  const timeComponentArb = fc.record({
    hours: fc.integer({ min: 0, max: 23 }),
    minutes: fc.integer({ min: 0, max: 59 }),
    seconds: fc.integer({ min: 0, max: 59 }),
    ms: fc.integer({ min: 0, max: 999 })
  });

  // Helper: create a Date from UTC components so toISOString() date part is predictable
  function utcDate(comp, time) {
    return new Date(Date.UTC(comp.year, comp.month, comp.day,
      time.hours, time.minutes, time.seconds, time.ms));
  }

  it('same-day dates return true regardless of time components', () => {
    fc.assert(
      fc.property(
        dateComponentArb,
        timeComponentArb,
        timeComponentArb,
        (dateComp, time1, time2) => {
          // Both dates share the same UTC year/month/day but have different times
          const date = utcDate(dateComp, time1);
          const ref = utcDate(dateComp, time2);

          const result = isDateInFuture(date, ref);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('strictly past dates return false', () => {
    fc.assert(
      fc.property(
        dateComponentArb,
        fc.integer({ min: 1, max: 365 }), // days in the past
        timeComponentArb,
        timeComponentArb,
        (refComp, daysBefore, time1, time2) => {
          const ref = utcDate(refComp, time1);

          // Create a UTC date that is daysBefore days before the reference
          const pastDate = new Date(Date.UTC(
            refComp.year, refComp.month, refComp.day - daysBefore,
            time2.hours, time2.minutes, time2.seconds, time2.ms));

          // Verify the date-only component is actually strictly before
          const pastStr = pastDate.toISOString().split('T')[0];
          const refStr = ref.toISOString().split('T')[0];
          // Only assert when the date-only part is strictly before
          if (pastStr < refStr) {
            const result = isDateInFuture(pastDate, ref);
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: best-practices-cleanup, Property 7: Format date dual format support
 * **Validates: Requirements 3.8**
 *
 * For any valid date and locale (de or en), formatDate(date, locale, 'numeric')
 * shall produce a string matching DD.MM.YYYY (for de) or DD/MM/YYYY (for en),
 * and formatDate(date, locale, 'short') shall produce a string matching
 * DD MMM YYYY where MMM is a three-letter abbreviated month name in the correct locale.
 */
describe('Property 7: Format date dual format support', () => {
  // Generator for valid dates within a reasonable range (UTC to avoid timezone shifts)
  const validDateArb = fc.record({
    year: fc.integer({ min: 1970, max: 2099 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }) // 28 to avoid invalid day-of-month
  }).map(({ year, month, day }) => new Date(Date.UTC(year, month, day, 12, 0, 0)));

  const localeArb = fc.constantFrom('de', 'en');

  it('numeric format matches DD.MM.YYYY for de and DD/MM/YYYY for en', () => {
    fc.assert(
      fc.property(validDateArb, localeArb, (date, locale) => {
        const result = formatDate(date, locale, 'numeric');

        if (locale === 'de') {
          // DD.MM.YYYY
          expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        } else {
          // DD/MM/YYYY
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        }

        // Verify the components match the actual date
        // formatDate uses local getters; at noon UTC the local date matches in all timezones
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        const sep = locale === 'de' ? '.' : '/';
        expect(result).toBe(day + sep + month + sep + year);
      }),
      { numRuns: 100 }
    );
  });

  it('short format matches DD MMM YYYY pattern', () => {
    fc.assert(
      fc.property(validDateArb, localeArb, (date, locale) => {
        const result = formatDate(date, locale, 'short');

        // DD MMM YYYY pattern: 2-digit day, space, 3-char month abbr, space, 4-digit year
        expect(result).toMatch(/^\d{2} [A-Za-zÄäÖöÜü]{3} \d{4}$/);

        // Verify the month abbreviation is correct for the locale
        // formatDate uses local getters; at noon UTC the local date matches in all timezones
        const expectedMonths = monthsAbbr[locale];
        const day = String(date.getDate()).padStart(2, '0');
        const monthName = expectedMonths[date.getMonth()];
        const year = String(date.getFullYear());
        expect(result).toBe(day + ' ' + monthName + ' ' + year);
      }),
      { numRuns: 100 }
    );
  });
});
