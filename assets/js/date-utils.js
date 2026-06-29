/**
 * Date Utilities Module
 *
 * Provides locale-aware date formatting for the Paddel Buch application.
 * Supports German (de) and English (en) locales.
 *
 * Site-wide standard display format: DD MMM YYYY (e.g. "08 Mar 2026" / "08 Mär 2026").
 * Both locales share the same numeric-day / abbreviated-month / year layout; only the
 * month-name spelling is localised. (formatDateTime / formatLongDate additionally use
 * the Intl API for time and long-form output.)
 */

(function(global) {
  'use strict';

  /**
   * Locale configuration for date formatting
   */
  var localeConfig = {
    de: {
      separator: '.',
      locale: 'de-CH',
      dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
      dateTimeFormat: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      longDateFormat: { day: 'numeric', month: 'long', year: 'numeric' }
    },
    en: {
      separator: '/',
      locale: 'en-GB',
      dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
      dateTimeFormat: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      longDateFormat: { day: 'numeric', month: 'long', year: 'numeric' }
    }
  };

  /**
   * Abbreviated month names per locale for 'short' date format
   */
  var monthsAbbr = {
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
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
    
    var date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Formats a date in the site-wide standard DD MMM YYYY format
   * (e.g. "08 Mar 2026" / "08 Mär 2026").
   *
   * Only the abbreviated month name is localised; the day / month / year layout is
   * identical across locales. The previous locale-specific numeric output
   * (DD.MM.YYYY for de / DD/MM/YYYY for en) has been removed - it was not used by
   * any display path on the site.
   *
   * @param {string|Date|number} dateValue - The date to format
   * @param {string} locale - The locale ('de' or 'en')
   * @returns {string} Formatted date string (DD MMM YYYY)
   */
  function formatDate(dateValue, locale) {
    var date = parseDate(dateValue);
    if (!date) return '';

    var day = String(date.getDate()).padStart(2, '0');
    var year = date.getFullYear();
    var months = monthsAbbr[locale] || monthsAbbr.de;
    var monthName = months[date.getMonth()];
    return day + ' ' + monthName + ' ' + year;
  }

  /**
   * Formats a date with time according to the specified locale
   * 
   * @param {string|Date|number} dateValue - The date to format
   * @param {string} locale - The locale ('de' or 'en')
   * @returns {string} Formatted date-time string
   */
  function formatDateTime(dateValue, locale) {
    var date = parseDate(dateValue);
    if (!date) return '';
    
    var config = localeConfig[locale] || localeConfig.de;
    
    try {
      return new Intl.DateTimeFormat(config.locale, config.dateTimeFormat).format(date);
    } catch (e) {
      // Fallback for environments without Intl support
      var dateStr = formatDate(dateValue, locale);
      var hours = String(date.getHours()).padStart(2, '0');
      var minutes = String(date.getMinutes()).padStart(2, '0');
      return dateStr + ' ' + hours + ':' + minutes;
    }
  }

  /**
   * Formats a date in long format (e.g., "5 December 2025" or "5. Dezember 2025")
   * 
   * @param {string|Date|number} dateValue - The date to format
   * @param {string} locale - The locale ('de' or 'en')
   * @returns {string} Formatted long date string
   */
  function formatLongDate(dateValue, locale) {
    var date = parseDate(dateValue);
    if (!date) return '';
    
    var config = localeConfig[locale] || localeConfig.de;
    
    try {
      return new Intl.DateTimeFormat(config.locale, config.longDateFormat).format(date);
    } catch (e) {
      // Fallback to simple format
      return formatDate(dateValue, locale);
    }
  }

  /**
   * Checks if a date is valid
   * 
   * @param {string|Date|number} dateValue - The date to check
   * @returns {boolean} True if the date is valid
   */
  function isValidDate(dateValue) {
    return parseDate(dateValue) !== null;
  }

  /**
   * Checks if a date is in the future (or today)
   * 
   * @param {string|Date|number} dateValue - The date to check
   * @param {Date} [referenceDate] - Optional reference date (defaults to current date)
   * @returns {boolean} True if the date is today or in the future
   */
  function isDateInFuture(dateValue, referenceDate) {
    var date = parseDate(dateValue);
    if (!date) return false;
    
    var refDate = referenceDate instanceof Date ? referenceDate : new Date();
    
    // Compare dates only (ignore time) by comparing YYYY-MM-DD strings
    var dateStr = date.toISOString().split('T')[0];
    var refDateStr = refDate.toISOString().split('T')[0];
    
    return dateStr >= refDateStr;
  }

  /**
   * Checks if a date is in the past
   * 
   * @param {string|Date|number} dateValue - The date to check
   * @param {Date} [referenceDate] - Optional reference date (defaults to current date)
   * @returns {boolean} True if the date is in the past
   */
  function isDateInPast(dateValue, referenceDate) {
    var date = parseDate(dateValue);
    if (!date) return false;
    
    return !isDateInFuture(dateValue, referenceDate);
  }

  /**
   * Gets the locale separator character
   * 
   * @param {string} locale - The locale ('de' or 'en')
   * @returns {string} The separator character ('.' for de, '/' for en)
   */
  function getLocaleSeparator(locale) {
    var config = localeConfig[locale] || localeConfig.de;
    return config.separator;
  }

  /**
   * Gets the full locale string (e.g., 'de-CH' or 'en-GB')
   * 
   * @param {string} locale - The locale ('de' or 'en')
   * @returns {string} The full locale string
   */
  function getFullLocale(locale) {
    var config = localeConfig[locale] || localeConfig.de;
    return config.locale;
  }

  // Export to global scope
  global.PaddelbuchDateUtils = {
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatLongDate: formatLongDate,
    parseDate: parseDate,
    isValidDate: isValidDate,
    isDateInFuture: isDateInFuture,
    isDateInPast: isDateInPast,
    getLocaleSeparator: getLocaleSeparator,
    getFullLocale: getFullLocale,
    localeConfig: localeConfig,
    monthsAbbr: monthsAbbr
  };

})(typeof window !== 'undefined' ? window : this);
