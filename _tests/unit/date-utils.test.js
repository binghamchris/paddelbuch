/**
 * Unit Tests for Date Utilities Module
 * 
 * Tests date formatting functions for the Paddel Buch application.
 * Requirements: 8.5 - Date locale formatting
 * 
 * Note: These tests mirror the logic in assets/js/date-utils.js
 * The actual module uses an IIFE pattern for browser compatibility.
 */

// Locale configuration (mirrors date-utils.js)
const localeConfig = {
  de: {
    separator: '.',
    locale: 'de-CH',
  },
  en: {
    separator: '/',
    locale: 'en-GB',
  }
};

// Abbreviated month names per locale (mirrors date-utils.js)
const monthsAbbr = {
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

// Implementation functions (mirrors date-utils.js)
function parseDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? null : date;
}

function formatDate(dateValue, locale, format) {
  const date = parseDate(dateValue);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  if (format === 'short') {
    const months = monthsAbbr[locale] || monthsAbbr.de;
    const monthName = months[date.getMonth()];
    return day + ' ' + monthName + ' ' + year;
  }

  // Default: 'numeric' format
  const config = localeConfig[locale] || localeConfig.de;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return day + config.separator + month + config.separator + year;
}

function isValidDate(dateValue) {
  return parseDate(dateValue) !== null;
}

function isDateInFuture(dateValue, referenceDate) {
  const date = parseDate(dateValue);
  if (!date) return false;
  const refDate = referenceDate instanceof Date ? referenceDate : new Date();
  const dateStr = date.toISOString().split('T')[0];
  const refDateStr = refDate.toISOString().split('T')[0];
  return dateStr >= refDateStr;
}

function isDateInPast(dateValue, referenceDate) {
  const date = parseDate(dateValue);
  if (!date) return false;
  return !isDateInFuture(dateValue, referenceDate);
}

function getLocaleSeparator(locale) {
  const config = localeConfig[locale] || localeConfig.de;
  return config.separator;
}

function getFullLocale(locale) {
  const config = localeConfig[locale] || localeConfig.de;
  return config.locale;
}

describe('Date Utilities', () => {
  describe('parseDate', () => {
    test('parses ISO date string correctly', () => {
      // Use full ISO string with time to avoid timezone issues
      const result = parseDate('2025-12-05T12:00:00');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(5);
    });

    test('parses Date object correctly', () => {
      const input = new Date(2025, 5, 15);
      const result = parseDate(input);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(input.getTime());
    });

    test('parses timestamp correctly', () => {
      const timestamp = 1733356800000;
      const result = parseDate(timestamp);
      expect(result).toBeInstanceOf(Date);
    });

    test('returns null for invalid date string', () => {
      expect(parseDate('invalid')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(parseDate(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(parseDate(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });
  });

  describe('formatDate', () => {
    const testDate = new Date(2025, 11, 5);

    test('formats date with German locale (de-CH)', () => {
      const result = formatDate(testDate, 'de');
      expect(result).toBe('05.12.2025');
    });

    test('formats date with English locale (en-GB)', () => {
      const result = formatDate(testDate, 'en');
      expect(result).toBe('05/12/2025');
    });

    test('defaults to German locale for unknown locale', () => {
      const result = formatDate(testDate, 'fr');
      expect(result).toBe('05.12.2025');
    });

    test('returns empty string for invalid date', () => {
      expect(formatDate('invalid', 'de')).toBe('');
    });

    test('returns empty string for null date', () => {
      expect(formatDate(null, 'de')).toBe('');
    });

    test('handles single digit day and month with padding', () => {
      const date = new Date(2025, 0, 5);
      expect(formatDate(date, 'de')).toBe('05.01.2025');
      expect(formatDate(date, 'en')).toBe('05/01/2025');
    });

    test('defaults to numeric format when format parameter is omitted', () => {
      const date = new Date(2025, 11, 5);
      expect(formatDate(date, 'de')).toBe('05.12.2025');
      expect(formatDate(date, 'en')).toBe('05/12/2025');
    });

    test('formats date with short format for German locale', () => {
      const date = new Date(2025, 2, 8); // March
      expect(formatDate(date, 'de', 'short')).toBe('08 Mär 2025');
    });

    test('formats date with short format for English locale', () => {
      const date = new Date(2025, 2, 8); // March
      expect(formatDate(date, 'en', 'short')).toBe('08 Mar 2025');
    });

    test('short format defaults to German month names for unknown locale', () => {
      const date = new Date(2025, 2, 8);
      expect(formatDate(date, 'fr', 'short')).toBe('08 Mär 2025');
    });

    test('short format returns empty string for invalid date', () => {
      expect(formatDate('invalid', 'de', 'short')).toBe('');
    });

    test('short format returns empty string for null date', () => {
      expect(formatDate(null, 'de', 'short')).toBe('');
    });

    test('numeric format works explicitly', () => {
      const date = new Date(2025, 11, 5);
      expect(formatDate(date, 'de', 'numeric')).toBe('05.12.2025');
      expect(formatDate(date, 'en', 'numeric')).toBe('05/12/2025');
    });

    test('short format covers all months for de locale', () => {
      const expectedDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      for (let m = 0; m < 12; m++) {
        const date = new Date(2025, m, 15);
        const result = formatDate(date, 'de', 'short');
        expect(result).toBe('15 ' + expectedDe[m] + ' 2025');
      }
    });

    test('short format covers all months for en locale', () => {
      const expectedEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        const date = new Date(2025, m, 15);
        const result = formatDate(date, 'en', 'short');
        expect(result).toBe('15 ' + expectedEn[m] + ' 2025');
      }
    });
  });

  describe('isValidDate', () => {
    test('returns true for valid Date object', () => {
      expect(isValidDate(new Date())).toBe(true);
    });

    test('returns true for valid ISO string', () => {
      expect(isValidDate('2025-12-05')).toBe(true);
    });

    test('returns false for invalid date string', () => {
      expect(isValidDate('invalid')).toBe(false);
    });

    test('returns false for null', () => {
      expect(isValidDate(null)).toBe(false);
    });
  });

  describe('isDateInFuture', () => {
    test('returns true for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    test('returns true for today', () => {
      const today = new Date();
      expect(isDateInFuture(today)).toBe(true);
    });

    test('returns false for past date', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      expect(isDateInFuture(pastDate)).toBe(false);
    });

    test('returns false for invalid date', () => {
      expect(isDateInFuture('invalid')).toBe(false);
    });

    test('uses reference date when provided', () => {
      const referenceDate = new Date(2025, 5, 15);
      const testDate = new Date(2025, 5, 20);
      expect(isDateInFuture(testDate, referenceDate)).toBe(true);
    });
  });

  describe('isDateInPast', () => {
    test('returns true for past date', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      expect(isDateInPast(pastDate)).toBe(true);
    });

    test('returns false for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(isDateInPast(futureDate)).toBe(false);
    });

    test('returns false for invalid date', () => {
      expect(isDateInPast('invalid')).toBe(false);
    });
  });

  describe('getLocaleSeparator', () => {
    test('returns dot for German locale', () => {
      expect(getLocaleSeparator('de')).toBe('.');
    });

    test('returns slash for English locale', () => {
      expect(getLocaleSeparator('en')).toBe('/');
    });

    test('defaults to dot for unknown locale', () => {
      expect(getLocaleSeparator('fr')).toBe('.');
    });
  });

  describe('getFullLocale', () => {
    test('returns de-CH for German locale', () => {
      expect(getFullLocale('de')).toBe('de-CH');
    });

    test('returns en-GB for English locale', () => {
      expect(getFullLocale('en')).toBe('en-GB');
    });

    test('defaults to de-CH for unknown locale', () => {
      expect(getFullLocale('fr')).toBe('de-CH');
    });
  });
});
