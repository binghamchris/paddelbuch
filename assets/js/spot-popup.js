/**
 * Spot Popup Module
 * 
 * Generates HTML content for spot popups that matches the structure
 * of the _includes/spot-popup.html template.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

(function(global) {
  'use strict';

  // Icon paths for spot types
  var iconBasePath = '/assets/images/icons/';
  
  var spotTypeIcons = {
    'einstieg-ausstieg': 'entryexit',
    'nur-einstieg': 'entry',
    'nur-ausstieg': 'exit',
    'rasthalte': 'rest',
    'notauswasserungsstelle': 'emergency'
  };

  // Spot type translated names (sourced from spot_types.yml)
  var spotTypeNames = {
    'einstieg-ausstieg': { de: 'Ein- und Ausstieg', en: 'Entry and Exit' },
    'nur-einstieg': { de: 'Nur Einstieg', en: 'Entry Only' },
    'nur-ausstieg': { de: 'Nur Ausstieg', en: 'Exit Only' },
    'rasthalte': { de: 'Rasthalte', en: 'Rest Stop' },
    'notauswasserungsstelle': { de: 'Notauswasserungsstelle', en: 'Emergency Landing' }
  };

  // Paddle craft type translated names (sourced from paddle_craft_types.yml)
  var paddleCraftTypeNames = {
    'seekajak': { de: 'Seekajak', en: 'Sea Kayak' },
    'kanadier': { de: 'Kanadier', en: 'Canoe' },
    'stand-up-paddle-board': { de: 'Stand Up Paddle Board (SUP)', en: 'Stand Up Paddle Board (SUP)' }
  };

  /**
   * Gets the icon filename for a spot type
   * 
   * @param {string} spotTypeSlug - The spot type slug
   * @param {boolean} isRejected - Whether the spot is rejected
   * @param {string} variant - 'light' or 'dark'
   * @returns {string} The icon filename
   */
  function getIconPath(spotTypeSlug, isRejected, variant) {
    variant = variant || 'light';
    var iconName = 'entryexit'; // default
    
    if (isRejected) {
      iconName = 'noentry';
    } else if (spotTypeSlug && Object.prototype.hasOwnProperty.call(spotTypeIcons, spotTypeSlug)) {
      iconName = spotTypeIcons[spotTypeSlug];
    }
    
    return iconBasePath + iconName + '-' + variant + '.svg';
  }

  /**
   * Gets localized labels based on locale
   * 
   * @param {string} locale - Current locale ('de' or 'en')
   * @returns {Object} Localized labels
   */
  function getLabels(locale) {
    if (locale === 'en') {
      return {
        gps: 'GPS',
        approxAddress: 'Approx. Address',
        type: 'Type',
        potentiallyUsableBy: 'Potentially Usable By',
        copy: 'Copy',
        copyGps: 'Copy GPS to clipboard',
        copyAddress: 'Copy approx. address to clipboard',
        navigate: 'Navigate To',
        moreDetails: 'More details'
      };
    }
    // Default to German
    return {
      gps: 'GPS',
      approxAddress: 'Ungefähre Adresse',
      type: 'Typ',
      potentiallyUsableBy: 'Potenziell nutzbar f\u00fcr',
      copy: 'Kopieren',
      copyGps: 'GPS in der Zwischenablage kopieren',
      copyAddress: 'Ungefähre Adresse in der Zwischenablage kopieren',
      navigate: 'Navigieren zu',
      moreDetails: 'Weitere Details'
    };
  }

  /**
   * Generates the copy button SVG icon
   * 
   * @returns {string} SVG HTML
   */
  function getCopyIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">' +
      '<path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>' +
      '<path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>' +
      '</svg>';
  }

  /**
   * Generates the navigate button SVG icon
   * 
   * @returns {string} SVG HTML
   */
  function getNavigateIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" class="navigate-icon">' +
      '<path fill-rule="evenodd" d="M8 0a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V3H6a.5.5 0 0 1 0-1h1.5V.5A.5.5 0 0 1 8 0z"/>' +
      '<path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 8a5 5 0 1 1 10 0A5 5 0 0 1 3 8z"/>' +
      '<path d="M8 5.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V10a.5.5 0 0 1-1 0V8.5H6a.5.5 0 0 1 0-1h1.5V6a.5.5 0 0 1 .5-.5z"/>' +
      '</svg>';
  }

  /**
   * Generates HTML content for a spot popup
   * Matches the structure of _includes/spot-popup.html
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   * 
   * @param {Object} spot - The spot data object
   * @param {string} locale - Current locale ('de' or 'en')
   * @returns {string} HTML content for the popup
   */
  function generateSpotPopupContent(spot, locale) {
      locale = locale || 'de';
      var labels = getLabels(locale);
      var localePrefix = (locale !== 'de') ? '/' + locale : '';
      var html = [];

      var isRejected = spot.rejected === true || spot.rejected === 'true';
      var spotTypeSlug = spot.spotType_slug || spot.spotTypeSlug || spot.spot_type_slug;
      var iconPath = getIconPath(spotTypeSlug, isRejected, 'light');
      var escapedSlug = spot.slug ? PaddelbuchHtmlUtils.escapeHtml(spot.slug) : '';

      // Look up translated spot type category label
      var spotTypeLabel = spotTypeSlug;
      if (spotTypeSlug && Object.prototype.hasOwnProperty.call(spotTypeNames, spotTypeSlug)) {
        spotTypeLabel = spotTypeNames[spotTypeSlug][locale] || spotTypeNames[spotTypeSlug]['de'] || spotTypeSlug;
      }

      // Outer wrapper with marker.click event tracking
      html.push('<div data-tinylytics-event="marker.click" data-tinylytics-event-value="' + escapedSlug + '">');

      // Header: icon + category label (matches Gatsby .popup-icon-div)
      html.push('<div class="popup-icon-div">');
      html.push('<span class="popup-icon"><img src="' + iconPath + '" alt="" width="20" height="20" loading="lazy" /></span>');
      html.push(PaddelbuchHtmlUtils.escapeHtml(spotTypeLabel));
      html.push('</div>');

      // Title (matches Gatsby .popup-title > h1)
      html.push('<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(spot.name) + '</h1></span>');

      // Description
      var description = spot.description || spot.description_excerpt;
      if (description) {
        var plainText = PaddelbuchHtmlUtils.stripHtml(description);
        var excerpt = PaddelbuchHtmlUtils.truncate(plainText, 150);
        if (excerpt) {
          html.push('<div><p>' + PaddelbuchHtmlUtils.escapeHtml(excerpt) + '</p></div>');
        }
      }

      // Navigate button (matches Gatsby structure: button > a)
      var lat = spot.location ? (spot.location.lat || spot.location.latitude) : null;
      var lon = spot.location ? (spot.location.lon || spot.location.lng || spot.location.longitude) : null;
      if (lat !== null && lon !== null) {
        html.push('<button type="button" class="popup-btn" data-tinylytics-event="popup.navigate" data-tinylytics-event-value="' + escapedSlug + '">');
        html.push('<a href="https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon + '" ');
        html.push('target="_blank" rel="noopener noreferrer">' + labels.navigate + '</a></button>');
      }

      // More details button (matches Gatsby structure: button.popup-btn-right > a)
      if (spot.slug) {
        html.push('<button class="popup-btn popup-btn-right" data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedSlug + '">');
        html.push('<a href="' + localePrefix + '/einstiegsorte/' + PaddelbuchHtmlUtils.escapeHtml(spot.slug) + '/">');
        html.push(labels.moreDetails + '</a></button>');
      }

      html.push('</div>');
      return html.join('');
    }

  /**
   * Generates HTML content for a rejected spot popup
   * 
   * @param {Object} spot - The spot data object
   * @param {string} locale - Current locale ('de' or 'en')
   * @returns {string} HTML content for the popup
   */
  function generateRejectedSpotPopupContent(spot, locale) {
    locale = locale || 'de';
    var labels = getLabels(locale);
    var localePrefix = (locale !== 'de') ? '/' + locale : '';
    var html = [];
    
    var iconPath = getIconPath(null, true, 'light');
    var noEntryLabel = (locale === 'en') ? 'No Entry Spot' : 'Kein Zutritt Ort';
    var iconAlt = (locale === 'en') ? 'No entry spot icon' : 'Kein Zutritt Symbol';
    var escapedSlug = spot.slug ? PaddelbuchHtmlUtils.escapeHtml(spot.slug) : '';

    // Outer wrapper with marker.click event tracking
    html.push('<div data-tinylytics-event="marker.click" data-tinylytics-event-value="' + escapedSlug + '">');

    // Header: icon + category label (matches .popup-icon-div from Gatsby)
    html.push('<div class="popup-icon-div">');
    html.push('<span class="popup-icon">');
    html.push('<img src="' + iconPath + '" alt="' + iconAlt + '" height="20" width="20" loading="lazy" />');
    html.push('</span>');
    html.push(PaddelbuchHtmlUtils.escapeHtml(noEntryLabel));
    html.push('</div>');
    
    // Title
    html.push('<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(spot.name) + '</h1></span>');
    
    // Description (rejection reason)
    var description = spot.description || spot.description_excerpt;
    if (description) {
      var plainText = PaddelbuchHtmlUtils.stripHtml(description);
      html.push('<div><p>' + PaddelbuchHtmlUtils.escapeHtml(plainText) + '</p></div>');
    }
    
    // More details button (matches regular spot popup: button.popup-btn-right > a)
    if (spot.slug) {
      html.push('<button class="popup-btn popup-btn-right" data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedSlug + '">');
      html.push('<a href="' + localePrefix + '/einstiegsorte/' + PaddelbuchHtmlUtils.escapeHtml(spot.slug) + '/">');
      html.push(labels.moreDetails + '</a></button>');
    }

    html.push('</div>');
    return html.join('');
  }

  // Export to global scope
  global.PaddelbuchSpotPopup = {
    generateSpotPopupContent: generateSpotPopupContent,
    generateRejectedSpotPopupContent: generateRejectedSpotPopupContent,
    getIconPath: getIconPath,
    getLabels: getLabels
  };

})(typeof window !== 'undefined' ? window : this);
