/**
 * Obstacle Map Module
 *
 * Initializes the obstacle detail page map. Calls PaddelbuchMap.init to create
 * the base map, then renders obstacle geometry and optional portage route,
 * and fits map bounds.
 *
 * Expects map-config JSON to include:
 *   geometry: GeoJSON geometry object or string (optional)
 *   portageRoute: GeoJSON geometry for portage route (optional)
 *
 * Requirement: R1
 */

(function() {
  'use strict';

  /**
   * Parses a geometry value that may be a JSON string or an object.
   * @param {*} data - geometry data
   * @param {string} label - label for error logging
   * @returns {Object|null} parsed GeoJSON geometry or null
   */
  function parseGeometry(data, label) {
    if (!data) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse ' + label + ':', e);
        return null;
      }
    }
    return data;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var map = PaddelbuchMap.init('obstacle-map');

    var configEl = document.getElementById('map-config');
    var config = JSON.parse(configEl.textContent);

    var geometry = parseGeometry(config.geometry, 'obstacle geometry');

    if (geometry) {
      // Render obstacle polygon (red)
      var obstacleLayer = L.geoJSON(geometry, {
        style: PaddelbuchLayerStyles.getLayerStyle('obstacle')
      }).addTo(map);

      var bounds = obstacleLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    // Render portage route if present (Requirement 5.2)
    var portageRoute = parseGeometry(config.portageRoute, 'portage route');
    if (portageRoute) {
      L.geoJSON(portageRoute, {
        style: PaddelbuchLayerStyles.getLayerStyle('portageRoute')
      }).addTo(map);
    }

    // Store map globally for the data layer pipeline
    window.paddelbuchMap = map;
  });
})();
