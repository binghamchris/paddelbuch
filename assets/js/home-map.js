/**
 * Home Map Module
 *
 * Initializes the home page map. Calls PaddelbuchMap.init to create the base
 * map and stores the instance globally for use by the data loading pipeline.
 *
 * Also stores the home-page target zoom (default + 3) so that marker click
 * handlers can zoom in when recentering on the home page map.
 *
 * The home page map has no geometry to render or bounds to fit -- it just needs
 * the map instance stored globally.
 *
 * Requirements: 2.1
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    window.paddelbuchMap = PaddelbuchMap.init('map');

    // Store target zoom for marker-click recentering (default zoom + 3)
    var configEl = document.getElementById('map-config');
    if (configEl) {
      var config = JSON.parse(configEl.textContent);
      window.paddelbuchHomeTargetZoom = (config.zoom || 8) + 3;
    }
  });
})();
