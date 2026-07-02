/**
 * Spot Map Module
 *
 * Initializes the spot detail page map. Calls PaddelbuchMap.init to create
 * the base map and exposes it as window.paddelbuchMap.
 *
 * The spot's own marker is intentionally NOT created here. On detail pages the
 * shared data pipeline (see detail-map-layers.html -> layer-control.js
 * addSpotMarker) already renders every spot in view -- including this one -- with
 * the correct icon (the composite Halo/Bead icon for spots that carry tips), a
 * localised accessible label, and the spot popup. Adding a second marker here
 * produced a duplicate: a plain base pin sitting directly behind the pipeline's
 * marker. For a spot with tips the two icons differ in size, so the plain pin
 * peeked out above the composite pin as a "doubled marker" visual artefact.
 * Leaving marker creation to the single pipeline path removes that duplication.
 *
 * Expects map-config JSON to include: spotLat, spotLon.
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
    window.paddelbuchMap = map;
  });
})();
