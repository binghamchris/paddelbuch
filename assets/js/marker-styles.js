/**
 * Marker Styles Module
 * 
 * Defines Leaflet icon configurations for each spot type and event notices.
 * Icons are created lazily on first use to avoid requiring Leaflet at load time.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * Spot Type Slugs:
 * - 'einstieg-ausstieg' (Entry & Exit)
 * - 'nur-einstieg' (Entry Only)
 * - 'nur-ausstieg' (Exit Only)
 * - 'rasthalte' (Rest)
 * - 'notauswasserungsstelle' (Emergency Exit)
 * - Rejected spots use 'no-entry' marker
 */

(function(global) {
  'use strict';

  // Base path for marker images
  var basePath = '/assets/images/markers/';
  
  // Common icon settings
  var commonSettings = {
    shadowUrl: null,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
    shadowSize: [0, 0],
    shadowAnchor: [0, 0]
  };

  // Icon URL configs (no Leaflet dependency)
  var iconUrls = {
    spotEinstiegAusstieg: basePath + 'startingspots-entryexit.svg',
    spotNurEinstieg: basePath + 'startingspots-entry.svg',
    spotNurAusstieg: basePath + 'otherspots-exit.svg',
    spotRasthalte: basePath + 'otherspots-rest.svg',
    spotNotauswasserung: basePath + 'otherspots-emergency.svg',
    rejectedSpot: basePath + 'otherspots-noentry.svg',
    waterwayEventNotice: basePath + 'waterwayevent.svg'
  };

  // Cache for lazily created L.Icon instances
  var iconCache = {};

  /**
   * Creates a Leaflet icon with the specified image URL.
   * Requires Leaflet (L) to be available at call time.
   * @param {string} iconUrl - URL to the marker icon image
   * @returns {L.Icon} Leaflet icon instance
   */
  function createIcon(iconUrl) {
    return L.icon({
      iconUrl: iconUrl,
      iconRetinaUrl: iconUrl,
      shadowUrl: commonSettings.shadowUrl,
      iconSize: commonSettings.iconSize,
      iconAnchor: commonSettings.iconAnchor,
      popupAnchor: commonSettings.popupAnchor,
      shadowSize: commonSettings.shadowSize,
      shadowAnchor: commonSettings.shadowAnchor
    });
  }

  /**
   * Gets or creates a cached Leaflet icon for the given key.
   * @param {string} key - Icon key from iconUrls
   * @returns {L.Icon} Leaflet icon instance
   */
  function getOrCreateIcon(key) {
    if (!iconCache[key]) {
      iconCache[key] = createIcon(iconUrls[key]);
    }
    return iconCache[key];
  }

  /**
   * Lazy marker styles accessor -- creates icons on first access.
   */
  var markerStyles = {
    get spotEinstiegAusstiegIcon() { return getOrCreateIcon('spotEinstiegAusstieg'); },
    get spotNurEinstiegIcon() { return getOrCreateIcon('spotNurEinstieg'); },
    get spotNurAusstiegIcon() { return getOrCreateIcon('spotNurAusstieg'); },
    get spotRasthalteIcon() { return getOrCreateIcon('spotRasthalte'); },
    get spotNotauswasserungIcon() { return getOrCreateIcon('spotNotauswasserung'); },
    get rejectedSpotIcon() { return getOrCreateIcon('rejectedSpot'); },
    get waterwayEventNoticeIcon() { return getOrCreateIcon('waterwayEventNotice'); }
  };

  /**
   * Maps spot type slugs to their corresponding marker icons
   * 
   * Property 1: Spot Marker Icon Assignment
   * For any spot with a valid spot type, the Map_System shall assign the marker icon
   * that corresponds to that spot type.
   * 
   * @param {string} spotTypeSlug - The slug of the spot type
   * @param {boolean} isRejected - Whether the spot is rejected
   * @returns {L.Icon} The appropriate Leaflet icon for the spot type
   */
  function getSpotIcon(spotTypeSlug, isRejected) {
    // Rejected spots always use the no-entry icon (Requirement 2.6)
    if (isRejected) {
      return markerStyles.rejectedSpotIcon;
    }

    // Map spot type slugs to icons
    var iconMap = {
      'einstieg-ausstieg': markerStyles.spotEinstiegAusstiegIcon,      // Entry & Exit (Req 2.1)
      'nur-einstieg': markerStyles.spotNurEinstiegIcon,                // Entry Only (Req 2.2)
      'nur-ausstieg': markerStyles.spotNurAusstiegIcon,                // Exit Only (Req 2.3)
      'rasthalte': markerStyles.spotRasthalteIcon,                     // Rest (Req 2.4)
      'notauswasserungsstelle': markerStyles.spotNotauswasserungIcon   // Emergency (Req 2.5)
    };

    // Use hasOwnProperty to avoid inherited properties like 'toString', 'valueOf', etc.
    if (Object.prototype.hasOwnProperty.call(iconMap, spotTypeSlug)) {
      return iconMap[spotTypeSlug];
    }
    return markerStyles.spotEinstiegAusstiegIcon;
  }

  /**
   * Gets the event notice marker icon
   * @returns {L.Icon} The event notice icon
   */
  function getEventNoticeIcon() {
    return markerStyles.waterwayEventNoticeIcon;
  }

  // Export to global scope
  global.PaddelbuchMarkerStyles = {
    markerStyles: markerStyles,
    getSpotIcon: getSpotIcon,
    getEventNoticeIcon: getEventNoticeIcon,
    createIcon: createIcon
  };

})(typeof window !== 'undefined' ? window : this);
