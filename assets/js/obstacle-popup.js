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
    var html = '<div class="obstacle-popup">';
    
    // Obstacle name (Requirement 5.3)
    html += '<div class="obstacle-popup-header">';
    html += '<strong class="obstacle-popup-name">' + escapeHtml(obstacle.name || 'Obstacle') + '</strong>';
    html += '</div>';
    
    // Portage possibility status (Requirement 5.3)
    html += '<div class="obstacle-popup-portage">';
    html += '<span class="obstacle-popup-label">' + localeStrings.portageLabel + ': </span>';
    html += '<span class="obstacle-popup-value">' + getPortageStatus(obstacle, locale) + '</span>';
    html += '</div>';
    
    // Link to obstacle detail page (Requirement 5.3)
    if (obstacle.slug) {
      html += '<div class="obstacle-popup-actions">';
      html += '<a href="/hindernisse/' + encodeURIComponent(obstacle.slug) + '/" class="btn btn-sm btn-primary obstacle-popup-details-link">';
      html += localeStrings.moreDetails;
      html += '</a>';
      html += '</div>';
    }
    
    html += '</div>';
    
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
