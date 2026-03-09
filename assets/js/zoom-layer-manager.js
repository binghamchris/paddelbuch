/**
 * Zoom-Based Layer Manager Module
 * 
 * Manages layer visibility based on zoom level.
 * Loads obstacles and protected areas only at zoom >= 12.
 * Hides these layers when zoom < 12.
 * 
 * Requirements: 14.3, 14.4
 * 
 * Property 23: Zoom-Based Layer Visibility
 * For any zoom level below the threshold (zoom < 12), obstacles and protected areas
 * shall not be loaded or displayed. For any zoom level at or above the threshold
 * (zoom >= 12), obstacles and protected areas within the viewport shall be loaded
 * and displayed.
 */

(function(global) {
  'use strict';

  // Zoom threshold for detail layers (obstacles, protected areas)
  var DETAIL_LAYER_ZOOM_THRESHOLD = 12;

  // Track current visibility state
  var layerVisibility = {
    obstacles: false,
    protected: false
  };

  // Track if layers have been loaded for current viewport
  var layersLoaded = {
    obstacles: false,
    protected: false
  };

  /**
   * Check if detail layers should be visible at the given zoom level
   * 
   * @param {number} zoom - Current zoom level
   * @returns {boolean} True if detail layers should be visible
   */
  function shouldShowDetailLayers(zoom) {
    return zoom >= DETAIL_LAYER_ZOOM_THRESHOLD;
  }

  /**
   * Get the zoom threshold for detail layers
   * 
   * @returns {number} The zoom threshold
   */
  function getDetailLayerZoomThreshold() {
    return DETAIL_LAYER_ZOOM_THRESHOLD;
  }

  /**
   * Show or hide detail layers based on zoom level
   * 
   * @param {L.Map} map - Leaflet map instance
   * @param {number} zoom - Current zoom level
   * @param {Object} layerGroups - Object containing layer groups
   */
  function updateLayerVisibility(map, zoom, layerGroups) {
    if (!map || !layerGroups) {
      return;
    }

    var shouldShow = shouldShowDetailLayers(zoom);

    // Update obstacles layer visibility (Requirement 14.3)
    if (layerGroups.obstacles) {
      if (shouldShow && !layerVisibility.obstacles) {
        // Show obstacles layer
        if (!map.hasLayer(layerGroups.obstacles)) {
          layerGroups.obstacles.addTo(map);
        }
        layerVisibility.obstacles = true;
      } else if (!shouldShow && layerVisibility.obstacles) {
        // Hide obstacles layer
        if (map.hasLayer(layerGroups.obstacles)) {
          map.removeLayer(layerGroups.obstacles);
        }
        layerVisibility.obstacles = false;
      }
    }

    // Update protected areas layer visibility (Requirement 14.4)
    if (layerGroups.protectedAreas) {
      if (shouldShow && !layerVisibility.protected) {
        // Show protected areas layer
        if (!map.hasLayer(layerGroups.protectedAreas)) {
          layerGroups.protectedAreas.addTo(map);
        }
        layerVisibility.protected = true;
      } else if (!shouldShow && layerVisibility.protected) {
        // Hide protected areas layer
        if (map.hasLayer(layerGroups.protectedAreas)) {
          map.removeLayer(layerGroups.protectedAreas);
        }
        layerVisibility.protected = false;
      }
    }
  }

  /**
   * Initialize zoom-based layer management for a map
   * 
   * @param {L.Map} map - Leaflet map instance
   * @param {Object} layerGroups - Object containing layer groups
   * @param {Object} options - Configuration options
   */
  function initZoomLayerManager(map, layerGroups, options) {
    if (!map) {
      console.warn('ZoomLayerManager: Map not provided');
      return;
    }

    options = options || {};

    // Set initial visibility based on current zoom
    var currentZoom = map.getZoom();
    
    // Initially hide detail layers if zoom is below threshold
    if (!shouldShowDetailLayers(currentZoom)) {
      if (layerGroups.obstacles && map.hasLayer(layerGroups.obstacles)) {
        map.removeLayer(layerGroups.obstacles);
      }
      if (layerGroups.protectedAreas && map.hasLayer(layerGroups.protectedAreas)) {
        map.removeLayer(layerGroups.protectedAreas);
      }
      layerVisibility.obstacles = false;
      layerVisibility.protected = false;
    } else {
      layerVisibility.obstacles = map.hasLayer(layerGroups.obstacles);
      layerVisibility.protected = map.hasLayer(layerGroups.protectedAreas);
    }

    // Listen for zoom changes — only toggle visibility, data loading is
    // handled by the caller (map-init / detail-map-layers) via its own
    // moveend handler to avoid duplicate layers stacking up.
    map.on('zoomend', function() {
      var zoom = map.getZoom();
      updateLayerVisibility(map, zoom, layerGroups);
    });

    console.log('ZoomLayerManager initialized with threshold:', DETAIL_LAYER_ZOOM_THRESHOLD);
  }

  /**
   * Get current layer visibility state
   * 
   * @returns {Object} Current visibility state for detail layers
   */
  function getLayerVisibility() {
    return {
      obstacles: layerVisibility.obstacles,
      protected: layerVisibility.protected
    };
  }

  /**
   * Reset layer visibility tracking
   * Useful when clearing and reloading data
   */
  function resetVisibilityState() {
    layerVisibility.obstacles = false;
    layerVisibility.protected = false;
    layersLoaded.obstacles = false;
    layersLoaded.protected = false;
  }

  // Export to global scope
  global.PaddelbuchZoomLayerManager = {
    // Constants
    DETAIL_LAYER_ZOOM_THRESHOLD: DETAIL_LAYER_ZOOM_THRESHOLD,
    
    // Functions
    shouldShowDetailLayers: shouldShowDetailLayers,
    getDetailLayerZoomThreshold: getDetailLayerZoomThreshold,
    updateLayerVisibility: updateLayerVisibility,
    initZoomLayerManager: initZoomLayerManager,
    getLayerVisibility: getLayerVisibility,
    resetVisibilityState: resetVisibilityState
  };

})(typeof window !== 'undefined' ? window : this);
