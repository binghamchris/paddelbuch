/**
 * Locale Filter Module
 * 
 * Provides locale-based data filtering for map data.
 * Ensures markers and layers only show content matching the current locale.
 * 
 * Requirements: 8.3
 * 
 * Property 18: Locale Content Filtering
 * For any data query with a language locale parameter, 
 * the returned content shall only include items where locale matches the specified locale.
 */

(function(global) {
  'use strict';

  /**
   * Filters an array of items by locale
   * 
   * Items are included if:
   * - They have no locale field (undefined/null)
   * - Their locale matches the specified locale
   * - Their locale is '*' (wildcard - matches all locales)
   * 
   * @param {Array} items - Array of data items to filter
   * @param {string} locale - The locale to filter by ('de', 'en', etc.)
   * @returns {Array} Filtered items matching the locale
   */
  function filterByLocale(items, locale) {
    if (!Array.isArray(items)) {
      return [];
    }
    
    // If no locale specified, return all items
    if (!locale || locale === '') {
      return items;
    }
    
    return items.filter(function(item) {
      return matchesLocale(item, locale);
    });
  }

  /**
   * Checks if a single item matches the specified locale
   * 
   * @param {Object} item - The item to check
   * @param {string} locale - The locale to match against
   * @returns {boolean} True if the item matches the locale
   */
  function matchesLocale(item, locale) {
    // If no locale specified, everything matches
    if (!locale || locale === '') {
      return true;
    }
    
    // Get the item's locale (support both property access styles)
    var itemLocale = item.locale || item['locale'];
    
    // Include if:
    // - No locale set on item (undefined or null)
    // - Locale matches exactly
    // - Locale is wildcard '*'
    return itemLocale === undefined || 
           itemLocale === null || 
           itemLocale === locale || 
           itemLocale === '*';
  }

  /**
   * Filters spots by locale
   * 
   * @param {Array} spots - Array of spot objects
   * @param {string} locale - The locale to filter by
   * @returns {Array} Spots matching the locale
   */
  function filterSpotsByLocale(spots, locale) {
    return filterByLocale(spots, locale);
  }

  /**
   * Filters event notices by locale
   * 
   * @param {Array} notices - Array of event notice objects
   * @param {string} locale - The locale to filter by
   * @returns {Array} Event notices matching the locale
   */
  function filterEventNoticesByLocale(notices, locale) {
    return filterByLocale(notices, locale);
  }

  /**
   * Filters obstacles by locale
   * 
   * @param {Array} obstacles - Array of obstacle objects
   * @param {string} locale - The locale to filter by
   * @returns {Array} Obstacles matching the locale
   */
  function filterObstaclesByLocale(obstacles, locale) {
    return filterByLocale(obstacles, locale);
  }

  /**
   * Filters protected areas by locale
   * 
   * @param {Array} protectedAreas - Array of protected area objects
   * @param {string} locale - The locale to filter by
   * @returns {Array} Protected areas matching the locale
   */
  function filterProtectedAreasByLocale(protectedAreas, locale) {
    return filterByLocale(protectedAreas, locale);
  }

  /**
   * Filters waterways by locale
   * 
   * @param {Array} waterways - Array of waterway objects
   * @param {string} locale - The locale to filter by
   * @returns {Array} Waterways matching the locale
   */
  function filterWaterwaysByLocale(waterways, locale) {
    return filterByLocale(waterways, locale);
  }

  /**
   * Gets the current locale from the page or defaults to 'de'
   * 
   * @returns {string} The current locale
   */
  function getCurrentLocale() {
    // Try to get from global variable set by layer-control
    if (global.paddelbuchCurrentLocale) {
      return global.paddelbuchCurrentLocale;
    }
    
    // Try to get from HTML lang attribute
    var htmlLang = document.documentElement.lang;
    if (htmlLang && (htmlLang === 'de' || htmlLang === 'en')) {
      return htmlLang;
    }
    
    // Try to get from URL path (e.g., /en/...)
    var pathMatch = window.location.pathname.match(/^\/(de|en)\//);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Default to German
    return 'de';
  }

  /**
   * Filters all map data by the current locale
   * 
   * @param {Object} data - Object containing arrays of map data
   * @param {string} locale - The locale to filter by (optional, uses current if not provided)
   * @returns {Object} Filtered data object
   */
  function filterAllMapData(data, locale) {
    var currentLocale = locale || getCurrentLocale();
    
    return {
      spots: filterByLocale(data.spots || [], currentLocale),
      eventNotices: filterByLocale(data.eventNotices || data.notices || [], currentLocale),
      obstacles: filterByLocale(data.obstacles || [], currentLocale),
      protectedAreas: filterByLocale(data.protectedAreas || data.protected_areas || [], currentLocale),
      waterways: filterByLocale(data.waterways || [], currentLocale)
    };
  }

  // Export to global scope
  global.PaddelbuchLocaleFilter = {
    filterByLocale: filterByLocale,
    matchesLocale: matchesLocale,
    filterSpotsByLocale: filterSpotsByLocale,
    filterEventNoticesByLocale: filterEventNoticesByLocale,
    filterObstaclesByLocale: filterObstaclesByLocale,
    filterProtectedAreasByLocale: filterProtectedAreasByLocale,
    filterWaterwaysByLocale: filterWaterwaysByLocale,
    getCurrentLocale: getCurrentLocale,
    filterAllMapData: filterAllMapData
  };

})(typeof window !== 'undefined' ? window : this);
