/**
 * Waterway Map Module
 *
 * Initializes the waterway detail page map. Calls PaddelbuchMap.init to create
 * the base map, then parses waterway geometry and fits map bounds.
 *
 * Expects map-config JSON to include:
 *   geometry: GeoJSON geometry object or string (optional)
 *
 * Requirement: R1
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    var map = PaddelbuchMap.init('waterway-map');

    var configEl = document.getElementById('map-config');
    var config = JSON.parse(configEl.textContent);

    // Parse waterway geometry for bounds calculation (Property 7)
    var geometry = null;
    if (config.geometry) {
      if (typeof config.geometry === 'string') {
        try {
          geometry = JSON.parse(config.geometry);
        } catch (e) {
          console.error('Failed to parse waterway geometry:', e);
        }
      } else {
        geometry = config.geometry;
      }
    }

    // Fit bounds from waterway geometry without rendering the polygon
    if (geometry) {
      var tempLayer = L.geoJSON(geometry);
      var bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }

    // Store map globally for the data layer pipeline
    window.paddelbuchMap = map;
  });
})();
