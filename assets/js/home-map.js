/**
 * Home Map Module
 *
 * Initializes the home page map. Calls PaddelbuchMap.init to create the base
 * map and stores the instance globally for use by the data loading pipeline.
 *
 * The home page map has no geometry to render or bounds to fit — it just needs
 * the map instance stored globally.
 *
 * Requirements: 2.1
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    window.paddelbuchMap = PaddelbuchMap.init('map');
  });
})();
