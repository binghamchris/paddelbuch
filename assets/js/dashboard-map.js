/**
 * Paddelbuch Dashboard Map Module
 *
 * Creates a shared Leaflet map instance for the data quality dashboards,
 * using OpenFreeMap Positron vector tiles via the MapLibre GL / Leaflet bridge.
 * The map is created once and shared across all map-based dashboards.
 *
 * Expects a <div id="dashboard-map"> element in the page.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

(function(global) {
  'use strict';

  var mapContainer = document.getElementById('dashboard-map');
  if (!mapContainer) {
    return;
  }

  var map = L.map('dashboard-map', {
    center: [46.801111, 8.226667],
    zoom: 8,
    maxBounds: [[45.8, 5.9], [47.8, 10.5]],
    maxBoundsViscosity: 1.0,
    minZoom: 7,
    zoomControl: false,
    attributionControl: false
  });

  L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/positron'
  }).addTo(map);

  L.control.attribution({ position: 'bottomright' })
    .addAttribution('&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors')
    .addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  global.PaddelbuchDashboardMap = {
    map: map,
    getMap: function() {
      return map;
    }
  };

})(typeof window !== 'undefined' ? window : this);
