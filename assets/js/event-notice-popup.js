/**
 * Event Notice Popup Module
 * 
 * Generates popup content for waterway event notices displayed on the map.
 * Includes date filtering logic to only show notices with future end dates.
 * 
 * Requirements: 7.1, 7.2, 7.3
 * - Filter notices by end date (only future dates)
 * - Display marker and affected area polygon
 * - Display name, description excerpt, start date, end date
 * - Link to event notice detail page
 * 
 * Property 13: Event Notice Date Filtering
 * Property 14: Event Notice Dual Rendering
 * Property 15: Event Notice Popup Contains Required Information
 */

(function(global) {
  'use strict';

  /**
   * Localized strings for popup content
   */
  var strings = {
    de: {
      startDate: 'Ungefähres Startdatum',
      endDate: 'Ungefähres Enddatum',
      moreDetails: 'Weitere Details'
    },
    en: {
      startDate: 'Approx. Start Date',
      endDate: 'Approx. End Date',
      moreDetails: 'More details'
    }
  };

  /**
   * Filters event notices to only include those with future end dates
   * 
   * Property 13: Event Notice Date Filtering
   * 
   * @param {Array} notices - Array of event notice objects
   * @param {Date} [referenceDate] - Optional reference date (defaults to current date)
   * @returns {Array} Filtered array of notices with future end dates
   */
  function filterActiveNotices(notices, referenceDate) {
    if (!Array.isArray(notices)) return [];
    
    return notices.filter(function(notice) {
      return PaddelbuchDateUtils.isDateInFuture(notice.endDate, referenceDate);
    });
  }

  /**
   * Generates the HTML content for an event notice popup
   * 
   * Property 15: Event Notice Popup Contains Required Information
   * For any event notice displayed on the map, the popup shall contain 
   * the notice name, description excerpt, start date, and end date.
   * 
   * Requirements: 7.3
   * 
   * @param {Object} notice - The event notice data object
   * @param {string} locale - The current locale ('de' or 'en')
   * @returns {string} HTML string for the popup content
   */
  function generateEventNoticePopupContent(notice, locale) {
    var localeStrings = strings[locale] || strings.de;
    var localePrefix = (locale && locale !== 'de') ? '/' + locale : '';
    var escapedSlug = notice.slug ? PaddelbuchHtmlUtils.escapeHtml(notice.slug) : '';
    
    // Outer wrapper (marker.click tracking moved to beacon dispatch in layer-control.js)
    var html = '<div>';
    
    // Title (Requirement 7.3)
    html += '<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(notice.name || '') + '</h1></span>';
    
    // Dates in a table matching the original Gatsby layout (Requirement 7.3)
    html += '<table class="popup-details-table popup-eventnotice-table"><tbody>';
    
    // Start date row
    if (notice.startDate) {
      html += '<tr>';
      html += '<th>' + localeStrings.startDate + ':</th>';
      html += '<td>' + PaddelbuchDateUtils.formatDate(notice.startDate, locale, 'short') + '</td>';
      html += '</tr>';
    }
    
    // End date row
    if (notice.endDate) {
      html += '<tr>';
      html += '<th>' + localeStrings.endDate + ':</th>';
      html += '<td>' + PaddelbuchDateUtils.formatDate(notice.endDate, locale, 'short') + '</td>';
      html += '</tr>';
    }
    
    html += '</tbody></table>';
    
    // Link to event notice detail page (Requirement 7.3)
    if (notice.slug) {
      html += '<button class="popup-btn popup-btn-right" data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedSlug + '">';
      html += '<a class="popup-btn-right" hreflang="' + (locale || 'de') + '" href="' + localePrefix + '/gewaesserereignisse/' + encodeURIComponent(notice.slug) + '/">';
      html += localeStrings.moreDetails;
      html += '</a></button>';
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Checks if an event notice should be rendered (has valid location and future end date)
   * 
   * @param {Object} notice - The event notice data object
   * @param {Date} [referenceDate] - Optional reference date
   * @returns {boolean} True if the notice should be rendered
   */
  function shouldRenderNotice(notice, referenceDate) {
    // Must have a future end date
    if (!PaddelbuchDateUtils.isDateInFuture(notice.endDate, referenceDate)) {
      return false;
    }
    
    // Must have a location for the marker
    if (!notice.location) {
      return false;
    }
    
    var lat = notice.location.lat || notice.location.latitude;
    var lon = notice.location.lon || notice.location.lng || notice.location.longitude;
    
    return lat !== undefined && lon !== undefined;
  }

  /**
   * Checks if an event notice has an affected area polygon
   * 
   * Property 14: Event Notice Dual Rendering
   * For any active event notice (future end date), the Map_System shall render 
   * both a marker at the notice location and a GeoJSON polygon for the affected area.
   * 
   * @param {Object} notice - The event notice data object
   * @returns {boolean} True if the notice has an affected area
   */
  function hasAffectedArea(notice) {
    return notice.affectedArea !== undefined && notice.affectedArea !== null;
  }

  // Export to global scope
  global.PaddelbuchEventNoticePopup = {
    generateEventNoticePopupContent: generateEventNoticePopupContent,
    filterActiveNotices: filterActiveNotices,
    shouldRenderNotice: shouldRenderNotice,
    hasAffectedArea: hasAffectedArea,
    strings: strings
  };

})(typeof window !== 'undefined' ? window : this);
