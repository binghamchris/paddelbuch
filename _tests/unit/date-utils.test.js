/**
 * Unit Tests for Date Utilities Module
 *
 * Tests date formatting functions for the Paddel Buch application.
 * Site-wide standard display format: DD MMM YYYY (e.g. "05 Dez 2025" / "05 Dec 2025").
 *
 * Exercises the real shipping module (assets/js/date-utils.js) via require()
 * rather than an inline copy, so these tests cannot drift from the implementation.
 */

// The IIFE assigns PaddelbuchDateUtils to `this`, which in Node CJS is `module.exports`.
const dateUtilsModule = require('../../assets/js/date-utils.js');
const PaddelbuchDateUtils = dateUtilsModule.PaddelbuchDateUtils || global.PaddelbuchDateUtils;

const {
  parseDate,
  formatDate,
  isValidDate,
  isDateInFuture,
  isDateInPast,
  getLocaleSeparator,
  getFullLocale
} = PaddelbuchDateUtils;

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

    test('formats date with German locale (DD MMM YYYY)', () => {
      const result = formatDate(testDate, 'de');
      expect(result).toBe('05 Dez 2025');
    });

    test('formats date with English locale (DD MMM YYYY)', () => {
      const result = formatDate(testDate, 'en');
      expect(result).toBe('05 Dec 2025');
    });

    test('defaults to German month names for unknown locale', () => {
      const result = formatDate(testDate, 'fr');
      expect(result).toBe('05 Dez 2025');
    });

    test('returns empty string for invalid date', () => {
      expect(formatDate('invalid', 'de')).toBe('');
    });

    test('returns empty string for null date', () => {
      expect(formatDate(null, 'de')).toBe('');
    });

    test('handles single digit day with padding', () => {
      const date = new Date(2025, 0, 5); // January
      expect(formatDate(date, 'de')).toBe('05 Jan 2025');
      expect(formatDate(date, 'en')).toBe('05 Jan 2025');
    });

    test('produces DD MMM YYYY when no third argument is given', () => {
      const date = new Date(2025, 11, 5);
      expect(formatDate(date, 'de')).toBe('05 Dez 2025');
      expect(formatDate(date, 'en')).toBe('05 Dec 2025');
    });

    test('formats date with short format for German locale', () => {
      const date = new Date(2025, 2, 8); // March
      expect(formatDate(date, 'de', 'short')).toBe('08 Mär 2025');
    });

    test('formats date with short format for English locale', () => {
      const date = new Date(2025, 2, 8); // March
      expect(formatDate(date, 'en', 'short')).toBe('08 Mar 2025');
    });

    test('defaults to German month names for unknown locale (short)', () => {
      const date = new Date(2025, 2, 8);
      expect(formatDate(date, 'fr', 'short')).toBe('08 Mär 2025');
    });

    test('returns empty string for invalid date (short)', () => {
      expect(formatDate('invalid', 'de', 'short')).toBe('');
    });

    test('returns empty string for null date (short)', () => {
      expect(formatDate(null, 'de', 'short')).toBe('');
    });

    test('ignores a legacy "numeric" argument — numeric output has been removed', () => {
      const date = new Date(2025, 11, 5);
      // The locale-specific DD.MM.YYYY / DD/MM/YYYY output no longer exists;
      // any third argument is ignored and the DD MMM YYYY standard is produced.
      expect(formatDate(date, 'de', 'numeric')).toBe('05 Dez 2025');
      expect(formatDate(date, 'en', 'numeric')).toBe('05 Dec 2025');
      expect(formatDate(date, 'de', 'numeric')).toBe(formatDate(date, 'de'));
    });

    test('covers all months for de locale', () => {
      const expectedDe = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      for (let m = 0; m < 12; m++) {
        const date = new Date(2025, m, 15);
        const result = formatDate(date, 'de');
        expect(result).toBe('15 ' + expectedDe[m] + ' 2025');
      }
    });

    test('covers all months for en locale', () => {
      const expectedEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        const date = new Date(2025, m, 15);
        const result = formatDate(date, 'en');
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
