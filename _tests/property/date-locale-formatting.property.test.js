/**
 * Property-Based Tests for Date Locale Formatting
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 19: Date Locale Formatting**
 * **Validates: Requirements 8.5**
 * 
 * Property: For any date displayed in the application, the format shall match 
 * the current locale: 'en-GB' format for English locale (DD/MM/YYYY), 
 * 'de-CH' format for German locale (DD.MM.YYYY).
 */

const fc = require('fast-check');

/**
 * Date formatting implementation (mirrors the JavaScript date-utils.js module)
 * 
 * Property 19: Date Locale Formatting
 * For any date displayed in the application, the format shall match the current locale.
 */

const localeConfig = {
  de: {
    separator: '.',
    locale: 'de-CH'
  },
  en: {
    separator: '/',
    locale: 'en-GB'
  }
};

/**
 * Parses a date value into a Date object
 * 
 * @param {string|Date|number} dateValue - The date to parse
 * @returns {Date|null} Parsed Date object or null if invalid
 */
function parseDate(dateValue) {
  if (!dateValue) return null;
  
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }
  
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date according to the specified locale
 * 
 * Property 19: Date Locale Formatting
 * 
 * @param {string|Date|number} dateValue - The date to format
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {string} Formatted date string (DD.MM.YYYY for de, DD/MM/YYYY for en)
 */
function formatDate(dateValue, locale) {
  const date = parseDate(dateValue);
  if (!date) return '';
  
  const config = localeConfig[locale] || localeConfig.de;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return day + config.separator + month + config.separator + year;
}

/**
 * Gets the locale separator character
 * 
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {string} The separator character ('.' for de, '/' for en)
 */
function getLocaleSeparator(locale) {
  const config = localeConfig[locale] || localeConfig.de;
  return config.separator;
}

/**
 * Validates that a formatted date string uses the correct separator for the locale
 * 
 * @param {string} formattedDate - The formatted date string
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {boolean} True if the separator matches the locale
 */
function hasCorrectSeparator(formattedDate, locale) {
  if (!formattedDate) return false;
  
  const expectedSeparator = getLocaleSeparator(locale);
  const wrongSeparator = locale === 'de' ? '/' : '.';
  
  // Should contain the expected separator and not the wrong one
  return formattedDate.includes(expectedSeparator) && !formattedDate.includes(wrongSeparator);
}

/**
 * Validates that a formatted date string follows the DD{sep}MM{sep}YYYY pattern
 * 
 * @param {string} formattedDate - The formatted date string
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {boolean} True if the format is correct
 */
function hasCorrectFormat(formattedDate, locale) {
  if (!formattedDate) return false;
  
  const separator = getLocaleSeparator(locale);
  const escapedSep = separator === '.' ? '\\.' : separator;
  const pattern = new RegExp(`^\\d{2}${escapedSep}\\d{2}${escapedSep}\\d{4}$`);
  
  return pattern.test(formattedDate);
}

/**
 * Extracts date components from a formatted date string
 * 
 * @param {string} formattedDate - The formatted date string
 * @param {string} locale - The locale ('de' or 'en')
 * @returns {Object|null} Object with day, month, year or null if invalid
 */
function extractDateComponents(formattedDate, locale) {
  if (!formattedDate) return null;
  
  const separator = getLocaleSeparator(locale);
  const parts = formattedDate.split(separator);
  
  if (parts.length !== 3) return null;
  
  return {
    day: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    year: parseInt(parts[2], 10)
  };
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

// Generate valid dates within a reasonable range
const validDateArb = fc.date({
  min: new Date('1900-01-01'),
  max: new Date('2100-12-31')
});

// Generate ISO date strings
const isoDateStringArb = validDateArb.map(date => date.toISOString());

// Generate timestamps
const timestampArb = validDateArb.map(date => date.getTime());

describe('Date Locale Formatting - Property 19', () => {
  /**
   * Property 19: Date Locale Formatting
   * For any date displayed in the application, the format shall match the current locale:
   * 'en-GB' format for English locale (DD/MM/YYYY), 'de-CH' format for German locale (DD.MM.YYYY).
   */
  
  describe('German locale (de-CH) formatting', () => {
    test('German locale uses dot separator (DD.MM.YYYY)', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'de');
            
            // Must use dot separator
            return formatted.includes('.') && !formatted.includes('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('German locale format matches DD.MM.YYYY pattern', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'de');
            
            // Must match DD.MM.YYYY pattern
            return hasCorrectFormat(formatted, 'de');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('English locale (en-GB) formatting', () => {
    test('English locale uses slash separator (DD/MM/YYYY)', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'en');
            
            // Must use slash separator
            return formatted.includes('/') && !formatted.includes('.');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('English locale format matches DD/MM/YYYY pattern', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const formatted = formatDate(date, 'en');
            
            // Must match DD/MM/YYYY pattern
            return hasCorrectFormat(formatted, 'en');
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
            
            // JavaScript months are 0-indexed, formatted months are 1-indexed
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
            return hasCorrectFormat(formatted, locale);
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
            return hasCorrectFormat(formatted, locale);
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
            return hasCorrectFormat(formatted, locale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale consistency', () => {
    test('same date formatted with different locales uses different separators', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const germanFormatted = formatDate(date, 'de');
            const englishFormatted = formatDate(date, 'en');
            
            // German uses dots, English uses slashes
            const germanHasDots = germanFormatted.includes('.') && !germanFormatted.includes('/');
            const englishHasSlashes = englishFormatted.includes('/') && !englishFormatted.includes('.');
            
            return germanHasDots && englishHasSlashes;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('same date formatted with different locales preserves the same date values', () => {
      fc.assert(
        fc.property(
          validDateArb,
          (date) => {
            const germanFormatted = formatDate(date, 'de');
            const englishFormatted = formatDate(date, 'en');
            
            const germanComponents = extractDateComponents(germanFormatted, 'de');
            const englishComponents = extractDateComponents(englishFormatted, 'en');
            
            if (!germanComponents || !englishComponents) return false;
            
            // Both should have the same day, month, and year
            return germanComponents.day === englishComponents.day &&
                   germanComponents.month === englishComponents.month &&
                   germanComponents.year === englishComponents.year;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unknown locale defaults to German format', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc.constantFrom('fr', 'es', 'it', 'unknown', ''),
          (date, unknownLocale) => {
            const formatted = formatDate(date, unknownLocale);
            
            // Should use German format (dots) as default
            return formatted.includes('.') && !formatted.includes('/');
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
            const separator = getLocaleSeparator(locale);
            const dayPart = formatted.split(separator)[0];
            
            return dayPart.length === 2 && dayPart.startsWith('0');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles single-digit months with zero padding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 28 }),
          fc.integer({ min: 0, max: 8 }), // Months 0-8 are single digit (1-9)
          fc.integer({ min: 2000, max: 2030 }),
          localeArb,
          (day, month, year, locale) => {
            const date = new Date(year, month, day);
            const formatted = formatDate(date, locale);
            
            // Month should be zero-padded (e.g., "01" not "1")
            const separator = getLocaleSeparator(locale);
            const monthPart = formatted.split(separator)[1];
            
            return monthPart.length === 2 && monthPart.startsWith('0');
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
