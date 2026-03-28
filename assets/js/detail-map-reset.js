/**
 * Detail Map Reset Module
 *
 * On detail pages, resets the map to its default view (center + zoom) when
 * the user manually closes a popup. Does NOT reset when the user clicks
 * from one marker to another (the old popup closes and a new one opens
 * within the debounce window, so the reset is cancelled).
 *
 * The default view is captured after a short delay to allow any fitBounds
 * animation from the detail map script to settle first.
 *
 * Loaded only on detail pages via detail-map-layers.html.
 */
(function() {
  'use strict';

  function init() {
    var map = window.paddelbuchMap;
    if (!map) {
      setTimeout(init, 100);
      return;
    }

    // Wait for fitBounds / setView animation to settle before capturing defaults
    setTimeout(function() {
      var defaultCenter = map.getCenter();
      var resetTimer = null;

      map.on('popupclose', function() {
        resetTimer = setTimeout(function() {
          map.panTo(defaultCenter);
          resetTimer = null;
        }, 150);
      });

      map.on('popupopen', function() {
        if (resetTimer) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
      });
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
