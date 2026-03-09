/**
 * Obstacle Popup Module
 * 
 * Generates popup content for obstacles displayed on the map.
 * 
 * Requirements: 5.3
 * - Display obstacle name
 * - Display portage possibility status (Yes, No, or Unknown)
 * - Link to obstacle detail page
 */

(function(global) {
  'use strict';

  /**
   * Localized strings for popup content
   */
  var strings = {
    de: {
      portageLabel: 'Umtragen möglich',
      yes: 'Ja',
      no: 'Nein',
      unknown: 'Unbekannt',
      moreDetails: 'Weitere Details'
    },
    en: {
      portageLabel: 'Portage possible',
      yes: 'Yes',
      no: 'No',
      unknown: 'Unknown',
      moreDetails: 'More details'
    }
  };

  /**
   * Gets the portage possibility status text based on the obstacle data
   * 
   * @param {Object} obstacle - The obstacle data object
   * @param {string} locale - The current locale ('de' or 'en')
   * @returns {string} The localized portage status text
   */
  function getPortageStatus(obstacle, locale) {
    var localeStrings = strings[locale] || strings.de;
    
    // Check isPortagePossible field
    if (obstacle.isPortagePossible === true || obstacle.isPortagePossible === 'true') {
      return localeStrings.yes;
    } else if (obstacle.isPortagePossible === false || obstacle.isPortagePossible === 'false') {
      return localeStrings.no;
    }
    
    return localeStrings.unknown;
  }

  /**
   * Generates the HTML content for an obstacle popup
   * 
   * @param {Object} obstacle - The obstacle data object
   * @param {string} locale - The current locale ('de' or 'en')
   * @returns {string} HTML string for the popup content
   */
  function generateObstaclePopupContent(obstacle, locale) {
    var localeStrings = strings[locale] || strings.de;
    var localePrefix = (locale && locale !== 'de') ? '/' + locale : '';
    
    // Obstacle name — matches Gatsby's .popup-title > h1 structure
    var html = '<span class="popup-title"><h1>' + escapeHtml(obstacle.name || 'Obstacle') + '</h1></span>';
    
    // Portage possibility status in a table — matches Gatsby's table layout
    html += '<table><tbody>';
    html += '<tr><th>' + localeStrings.portageLabel + ':</th>';
    html += '<td>' + getPortageStatus(obstacle, locale) + '</td></tr>';
    html += '</tbody></table>';
    
    // Link to obstacle detail page — matches Gatsby's .popup-btn structure
    if (obstacle.slug) {
      html += '<button class="popup-btn popup-btn-right obstacle-details-btn">';
      html += '<a class="popup-btn-right" hreflang="' + (locale || 'de') + '" href="' + localePrefix + '/hindernisse/' + encodeURIComponent(obstacle.slug) + '/">';
      html += localeStrings.moreDetails;
      html += '</a></button>';
    }
    
    return html;
  }

  /**
   * Escapes HTML special characters to prevent XSS
   * 
   * @param {string} text - The text to escape
   * @returns {string} The escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Export to global scope
  global.PaddelbuchObstaclePopup = {
    generateObstaclePopupContent: generateObstaclePopupContent,
    getPortageStatus: getPortageStatus,
    strings: strings
  };

})(typeof window !== 'undefined' ? window : this);
