/**
 * Home Map Module
 *
 * Initializes the home page map. Calls PaddelbuchMap.init to create the base
 * map and stores the instance globally for use by the data loading pipeline.
 *
 * Also stores the home-page target zoom (default + 3) so that marker click
 * handlers can zoom in when recentering on the home page map.
 *
 * When a popup is closed without another popup opening immediately after
 * (i.e. the user manually dismissed it), the map resets to its default
 * center and zoom level.
 *
 * The home page map has no geometry to render or bounds to fit -- it just needs
 * the map instance stored globally.
 *
 * Requirements: 2.1
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    var map = PaddelbuchMap.init('map');
    window.paddelbuchMap = map;

    var configEl = document.getElementById('map-config');
    if (!configEl) return;

    var config = JSON.parse(configEl.textContent);
    var defaultZoom = config.zoom || 8;
    var defaultCenter = [config.center.lat, config.center.lon];

    // Store target zoom for marker-click recentering (default zoom + 3)
    window.paddelbuchHomeTargetZoom = defaultZoom + 3;

    // Reset map to default view when a popup is closed manually.
    // A short timer distinguishes manual close from marker-to-marker
    // navigation: if popupopen fires before the timer, the reset is
    // cancelled so clicking between markers behaves normally.
    var resetTimer = null;

    map.on('popupclose', function() {
      resetTimer = setTimeout(function() {
        map.setView(defaultCenter, defaultZoom);
        resetTimer = null;
      }, 150);
    });

    map.on('popupopen', function() {
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    });
  });
})();
