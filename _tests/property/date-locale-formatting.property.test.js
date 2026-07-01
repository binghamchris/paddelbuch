/**
 * Property-Based Tests for Date Locale Formatting
 *
 * **Feature: quality-and-tooling-hardening, Property (date formatting standard)**
 * **Validates: Requirements 7.3, 7.4**
 *
 * The site-wide standard display format is DD MMM YYYY (e.g. "05 Dez 2025" /
 * "05 Dec 2025"). The previously-asserted locale-specific numeric output
 * (DD.MM.YYYY for de, DD/MM/YYYY for en) has been removed from
 * assets/js/date-utils.js (Task 1.5); these property tests now exercise the
 * real module and validate the DD MMM YYYY standard rather than an inline copy.
 *
 * Both locales share the same numeric-day / abbreviated-month / year layout; only
 * the month-name spelling is localised.
 */

const fc = require('fast-check');

// The IIFE assigns PaddelbuchDateUtils to `this`, which in Node CJS is `module.exports`.
const dateUtilsModule = require('../../assets/js/date-utils.js');
const PaddelbuchDateUtils = dateUtilsModule.PaddelbuchDateUtils || global.PaddelbuchDateUtils;

const { formatDate, monthsAbbr } = PaddelbuchDateUtils;

// DD MMM YYYY: 2-digit day, space, 3-char month abbreviation (incl. German umlauts), space, 4-digit year
const STANDARD_PATTERN = /^\d{2} [A-Za-zÄäÖöÜü]{3} \d{4}$/;

/**
 * Extracts day/month/year from a DD MMM YYYY string using the locale's month table.
 *
 * @param {string} formattedDate - The formatted date string
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {Object|null} { day, month (1-indexed), year } or null if not parseable
 */
function extractDateComponents(formattedDate, locale) {
  if (!formattedDate) return null;

  const parts = formattedDate.split(' ');
  if (parts.length !== 3) return null;

  const months = monthsAbbr[locale] || monthsAbbr.de;
  const monthIndex = months.indexOf(parts[1]);
  if (monthIndex === -1) return null;

  return {
    day: parseInt(parts[0], 10),
    month: monthIndex + 1,
    year: parseInt(parts[2], 10)
  };
}

function hasStandardFormat(formattedDate) {
  return !!formattedDate && STANDARD_PATTERN.test(formattedDate);
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

// Generate valid dates within a reasonable range
const validDateArb = fc.date({
  min: new Date('1900-01-01'),
  max: new Date('2100-12-31'),
  noInvalidDate: true
});

// Generate ISO date strings
const isoDateStringArb = validDateArb.map(date => date.toISOString());

// Generate timestamps.
// NOTE: the module's parseDate guards with `if (!dateValue) return null`, so the
// numeric timestamp 0 (the Unix epoch) is treated as "no date" and yields ''. The
// site only ever formats ISO strings / Date objects (never a raw 0 timestamp), so we
// exclude that single degenerate value rather than change runtime behaviour (Req 0).
const timestampArb = validDateArb.map(date => date.getTime()).filter(ts => ts !== 0);

describe('Date Locale Formatting - DD MMM YYYY standard', () => {
  describe('German locale (de) formatting', () => {
    test('German locale produces DD MMM YYYY with German month abbreviations', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'de');
            return hasStandardFormat(formatted) &&
              monthsAbbr.de.includes(formatted.split(' ')[1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('German locale month abbreviation matches the calendar month', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'de');
            return formatted.split(' ')[1] === monthsAbbr.de[date.getMonth()];
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('English locale (en) formatting', () => {
    test('English locale produces DD MMM YYYY with English month abbreviations', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'en');
            return hasStandardFormat(formatted) &&
              monthsAbbr.en.includes(formatted.split(' ')[1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('English locale month abbreviation matches the calendar month', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'en');
            return formatted.split(' ')[1] === monthsAbbr.en[date.getMonth()];
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no separator-based numeric output (no dots or slashes) is produced', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted = formatDate(date, locale);
            return !formatted.includes('.') && !formatted.includes('/');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Date value preservation', () => {
    test('formatted date preserves the original day value', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted = formatDate(date, locale);
            const components = extractDateComponents(formatted, locale);

            if (!components) return false;

            return components.day === date.getDate();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formatted date preserves the original month value', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted = formatDate(date, locale);
            const components = extractDateComponents(formatted, locale);

            if (!components) return false;

            // JavaScript months are 0-indexed, extracted months are 1-indexed
            return components.month === date.getMonth() + 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formatted date preserves the original year value', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted = formatDate(date, locale);
            const components = extractDateComponents(formatted, locale);

            if (!components) return false;

            return components.year === date.getFullYear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Input type handling', () => {
    test('handles Date objects correctly', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted = formatDate(date, locale);
            return hasStandardFormat(formatted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles ISO date strings correctly', () => {
      fc.assert(
        fc.property(
          isoDateStringArb,
          localeArb,
          (isoString, locale) => {
            const formatted = formatDate(isoString, locale);
            return hasStandardFormat(formatted);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles timestamps correctly', () => {
      fc.assert(
        fc.property(
          timestampArb,
          localeArb,
          (timestamp, locale) => {
            const formatted = formatDate(timestamp, locale);
            return hasStandardFormat(formatted);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale consistency', () => {
    test('same date in different locales preserves identical day/month/year', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const germanFormatted = formatDate(date, 'de');
            const englishFormatted = formatDate(date, 'en');

            const germanComponents = extractDateComponents(germanFormatted, 'de');
            const englishComponents = extractDateComponents(englishFormatted, 'en');

            if (!germanComponents || !englishComponents) return false;

            return germanComponents.day === englishComponents.day &&
                   germanComponents.month === englishComponents.month &&
                   germanComponents.year === englishComponents.year;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unknown locale defaults to German month names', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc.constantFrom('fr', 'es', 'it', 'unknown', ''),
          (date, unknownLocale) => {
            const formatted = formatDate(date, unknownLocale);
            const germanFormatted = formatDate(date, 'de');

            // Unknown locales fall back to the German month table
            return formatted === germanFormatted;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('returns empty string for null input', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            return formatDate(null, locale) === '';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns empty string for undefined input', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            return formatDate(undefined, locale) === '';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns empty string for invalid date string', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('invalid', 'not-a-date', '2024-13-45', 'abc123'),
          localeArb,
          (invalidDate, locale) => {
            return formatDate(invalidDate, locale) === '';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles single-digit days with zero padding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }),
          fc.integer({ min: 0, max: 11 }),
          fc.integer({ min: 2000, max: 2030 }),
          localeArb,
          (day, month, year, locale) => {
            const date = new Date(year, month, day);
            const formatted = formatDate(date, locale);

            // Day should be zero-padded (e.g., "01" not "1")
            const dayPart = formatted.split(' ')[0];

            return dayPart.length === 2 && dayPart.startsWith('0');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('month component is always a 3-character abbreviation', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }),
          fc.integer({ min: 0, max: 11 }),
          fc.integer({ min: 2000, max: 2030 }),
          localeArb,
          (day, month, year, locale) => {
            const date = new Date(year, month, day);
            const formatted = formatDate(date, locale);

            const monthPart = formatted.split(' ')[1];
            return monthPart.length === 3;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Formatting determinism', () => {
    test('formatting the same date twice produces identical results', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const formatted1 = formatDate(date, locale);
            const formatted2 = formatDate(date, locale);

            return formatted1 === formatted2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('formatting is pure - no side effects', () => {
      fc.assert(
        fc.property(
          validDateArb,
          localeArb,
          (date, locale) => {
            const originalTime = date.getTime();
            formatDate(date, locale);

            // Date object should not be modified
            return date.getTime() === originalTime;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
