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
   * Escapes HTML special characters to prevent XSS
   * 
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Strips HTML tags from a string
   * 
   * @param {string} html - HTML string
   * @returns {string} Plain text
   */
  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Truncates text to a maximum length with ellipsis
   * 
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
    
    // Look up translated spot type category label
    var spotTypeLabel = spotTypeSlug;
    if (spotTypeSlug && Object.prototype.hasOwnProperty.call(spotTypeNames, spotTypeSlug)) {
      spotTypeLabel = spotTypeNames[spotTypeSlug][locale] || spotTypeNames[spotTypeSlug]['de'] || spotTypeSlug;
    }
    
    html.push('<div class="spot-popup">');
    
    // Category header with icon and translated spot type label (Requirement 2.1)
    html.push('<div class="spot-popup-header">');
    html.push('<img src="' + iconPath + '" alt="" height="20" width="20" class="spot-icon spot-icon-light" loading="lazy" />');
    html.push('<span class="spot-popup-category">' + escapeHtml(spotTypeLabel) + '</span>');
    html.push('</div>');
    
    // Divider between header and title (Requirement 2.1)
    html.push('<hr class="spot-popup-divider">');
    
    // Spot name as prominent heading (Requirement 2.1)
    html.push('<h3 class="spot-popup-title">' + escapeHtml(spot.name) + '</h3>');
    
    // Description excerpt (Requirement 3.1)
    if (spot.description) {
      var plainText = stripHtml(spot.description);
      var excerpt = truncate(plainText, 150);
      if (excerpt) {
        html.push('<div class="spot-popup-description">');
        html.push('<p>' + escapeHtml(excerpt) + '</p>');
        html.push('</div>');
      }
    }
    
    // Paddle craft types as bullet list with translated names (Requirement 2.2)
    if (spot.paddleCraftTypes && spot.paddleCraftTypes.length > 0) {
      html.push('<div class="spot-popup-craft-types">');
      html.push('<span class="spot-popup-label">' + labels.potentiallyUsableBy + ':</span>');
      html.push('<ul class="spot-popup-craft-list">');
      for (var i = 0; i < spot.paddleCraftTypes.length; i++) {
        var craftSlug = spot.paddleCraftTypes[i];
        var craftName = craftSlug;
        if (Object.prototype.hasOwnProperty.call(paddleCraftTypeNames, craftSlug)) {
          craftName = paddleCraftTypeNames[craftSlug][locale] || paddleCraftTypeNames[craftSlug]['de'] || craftSlug;
        }
        html.push('<li>' + escapeHtml(craftName) + '</li>');
      }
      html.push('</ul>');
      html.push('</div>');
    }
    
    // GPS coordinates with text copy button (Requirements 2.3, 3.2)
    var lat = spot.location ? (spot.location.lat || spot.location.latitude) : null;
    var lon = spot.location ? (spot.location.lon || spot.location.lng || spot.location.longitude) : null;
    
    if (lat !== null && lon !== null) {
      html.push('<div class="spot-popup-gps">');
      html.push('<span class="spot-popup-label">' + labels.gps + ':</span>');
      html.push('<span class="spot-popup-value">' + lat + ', ' + lon + '</span>');
      html.push('<button type="button" class="btn btn-sm btn-outline-light copy-btn" ');
      html.push('onclick="PaddelbuchClipboard.copyGPS(\'' + lat + '\', \'' + lon + '\', this)" ');
      html.push('title="' + labels.copyGps + '" aria-label="' + labels.copyGps + '">');
      html.push(labels.copy);
      html.push('</button>');
      html.push('</div>');
    }
    
    // Approximate address with text copy button (Requirements 2.3, 3.3)
    if (spot.approximateAddress) {
      var escapedAddress = escapeHtml(spot.approximateAddress).replace(/'/g, "\\'");
      html.push('<div class="spot-popup-address">');
      html.push('<span class="spot-popup-label">' + labels.approxAddress + ':</span>');
      html.push('<span class="spot-popup-value">' + escapeHtml(spot.approximateAddress) + '</span>');
      html.push('<button type="button" class="btn btn-sm btn-outline-light copy-btn" ');
      html.push('onclick="PaddelbuchClipboard.copyAddress(\'' + escapedAddress + '\', this)" ');
      html.push('title="' + labels.copyAddress + '" aria-label="' + labels.copyAddress + '">');
      html.push(labels.copy);
      html.push('</button>');
      html.push('</div>');
    }
    
    // Action buttons
    html.push('<div class="spot-popup-actions">');
    
    // Navigation button (Requirement 2.4)
    if (lat !== null && lon !== null) {
      html.push('<a href="https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon + '" ');
      html.push('target="_blank" rel="noopener noreferrer" ');
      html.push('class="btn btn-sm btn-outline-primary navigate-btn" ');
      html.push('title="' + labels.navigate + '" aria-label="' + labels.navigate + '">');
      html.push(getNavigateIcon());
      html.push(labels.navigate);
      html.push('</a>');
    }
    
    // More details link (Requirement 3.6)
    if (spot.slug) {
      html.push('<a href="' + localePrefix + '/einstiegsorte/' + escapeHtml(spot.slug) + '/" ');
      html.push('class="btn btn-sm btn-primary spot-popup-details-link">');
      html.push(labels.moreDetails);
      html.push('</a>');
    }
    
    html.push('</div>'); // .spot-popup-actions
    html.push('</div>'); // .spot-popup
    
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
    
    html.push('<div class="spot-popup rejected-spot-popup">');
    
    // Header with icon and name
    html.push('<div class="spot-popup-header">');
    html.push('<img src="' + iconPath + '" alt="" height="20" width="20" class="spot-icon spot-icon-light" loading="lazy" />');
    html.push('<strong class="spot-popup-name">' + escapeHtml(spot.name) + '</strong>');
    html.push('</div>');
    
    // Rejection reason (from description)
    if (spot.description) {
      var plainText = stripHtml(spot.description);
      html.push('<div class="spot-popup-description rejection-reason">');
      html.push('<p>' + escapeHtml(plainText) + '</p>');
      html.push('</div>');
    }
    
    // More details link
    if (spot.slug) {
      html.push('<div class="spot-popup-actions">');
      html.push('<a href="' + localePrefix + '/einstiegsorte/' + escapeHtml(spot.slug) + '/" ');
      html.push('class="btn btn-sm btn-primary spot-popup-details-link">');
      html.push(labels.moreDetails);
      html.push('</a>');
      html.push('</div>');
    }
    
    html.push('</div>');
    
    return html.join('');
  }

  // Export to global scope
  global.PaddelbuchSpotPopup = {
    generateSpotPopupContent: generateSpotPopupContent,
    generateRejectedSpotPopupContent: generateRejectedSpotPopupContent,
    getIconPath: getIconPath,
    getLabels: getLabels,
    escapeHtml: escapeHtml,
    stripHtml: stripHtml,
    truncate: truncate
  };

})(typeof window !== 'undefined' ? window : this);
