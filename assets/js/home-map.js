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
 * Home view memory (detail-close-button spec): when the visitor arrives via a
 * details page's close button, the map is created at the view they left from
 * rather than created at the default view and moved. The restore marker is
 * consumed on every load, and links to details pages save the current view.
 * If home-view-memory.js is not loaded, the map behaves exactly as before.
 *
 * Requirements: 2.1
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', function() {
    var configEl = document.getElementById('map-config');
    var config = configEl ? JSON.parse(configEl.textContent) : null;
    var memory = window.PaddelbuchHomeViewMemory;

    // Always consume, so a stale restore marker never survives a home load.
    var initialView = (memory && config)
      ? memory.consumeRestore(memory.limitsFromConfig(config))
      : null;

    var map = PaddelbuchMap.init('map', initialView ? { initialView: initialView } : undefined);
    window.paddelbuchMap = map;

    if (memory) {
      memory.wireHomePage(document, function() { return window.paddelbuchMap; });
    }

    if (!config) return;

    var defaultZoom = config.zoom || 8;

    // Store target zoom for marker-click recentering (default zoom + 3).
    // Derived from the configured default, not from a restored view.
    window.paddelbuchHomeTargetZoom = defaultZoom + 3;
  });
})();
