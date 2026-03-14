/**
 * Notice Map Module
 *
 * Initializes the event notice detail page map. Calls PaddelbuchMap.init to
 * create the base map, then handles the three-path notice logic:
 *   (a) fit bounds to affected area geometry if present
 *   (b) center on notice location if no affected area but location exists
 *   (c) keep default Switzerland view otherwise
 *
 * Expects map-config JSON to include:
 *   affectedArea: GeoJSON geometry (optional)
 *   location: { lat, lon } (optional)
 *
 * Requirements: R1, R2
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    var map = PaddelbuchMap.init('notice-map');

    var configEl = document.getElementById('map-config');
    var config = JSON.parse(configEl.textContent);

    if (config.affectedArea) {
      // (a) Fit bounds to affected area geometry
      var geometryData = config.affectedArea;
      var geometry;

      if (typeof geometryData === 'string') {
        try {
          geometry = JSON.parse(geometryData);
        } catch (e) {
          console.error('Failed to parse affected area geometry:', e);
          geometry = null;
        }
      } else {
        geometry = geometryData;
      }

      if (geometry) {
        var affectedAreaLayer = L.geoJSON(geometry, {
          style: PaddelbuchLayerStyles.getLayerStyle('eventNoticeArea')
        }).addTo(map);

        var bounds = affectedAreaLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    } else if (config.location && config.location.lat != null && config.location.lon != null) {
      // (b) Center on notice location
      map.setView([config.location.lat, config.location.lon], 14);
    }
    // (c) Default view is already set by PaddelbuchMap.init

    // Store map globally for the data layer pipeline
    window.paddelbuchMap = map;
  });
})();
