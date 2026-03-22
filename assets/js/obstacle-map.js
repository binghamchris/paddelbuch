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

    var bounds = null;

    if (geometry) {
      // Render obstacle polygon (red)
      var obstacleLayer = L.geoJSON(geometry, {
        style: PaddelbuchLayerStyles.getLayerStyle('obstacle')
      }).addTo(map);

      bounds = obstacleLayer.getBounds();
    }

    // Render portage route if present (Requirement 5.2)
    var portageRoute = parseGeometry(config.portageRoute, 'portage route');
    if (portageRoute) {
      var portageLayer = L.geoJSON(portageRoute, {
        style: PaddelbuchLayerStyles.getLayerStyle('portageRoute')
      }).addTo(map);

      // Extend bounds to include the portage route
      var portageBounds = portageLayer.getBounds();
      if (portageBounds.isValid()) {
        bounds = bounds ? bounds.extend(portageBounds) : portageBounds;
      }
    }

    // Fit map to combined bounds of obstacle + portage route
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Store map globally for the data layer pipeline
    window.paddelbuchMap = map;
  });
})();
