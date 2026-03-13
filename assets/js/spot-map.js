/**
 * Spot Map Module
 *
 * Initializes the spot detail page map. Calls PaddelbuchMap.init to create
 * the base map, then adds the spot marker with popup.
 *
 * Expects map-config JSON to include:
 *   spotLat, spotLon, spotTypeSlug, isRejected, spotData, locale
 *
 * Requirement: R1
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    var configEl = document.getElementById('map-config');
    if (!configEl) return;
    var config = JSON.parse(configEl.textContent);
    if (config.spotLat == null || config.spotLon == null) return;
    var map = PaddelbuchMap.init('spot-map');
    var markerIcon = PaddelbuchMarkerStyles.getSpotIcon(config.spotTypeSlug, config.isRejected);
    var marker = L.marker([config.spotLat, config.spotLon], { icon: markerIcon }).addTo(map);
    var spotData = config.spotData;
    var locale = config.locale || 'de';
    var popupHtml;
    if (window.PaddelbuchSpotPopup) {
      if (config.isRejected) {
        popupHtml = window.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spotData, locale);
      } else {
        popupHtml = window.PaddelbuchSpotPopup.generateSpotPopupContent(spotData, locale);
      }
    } else {
      popupHtml = '<strong>' + (spotData.name || '') + '</strong>';
    }
    marker.bindPopup(popupHtml, { maxWidth: 350 });
    window.paddelbuchMap = map;
  });
})();
