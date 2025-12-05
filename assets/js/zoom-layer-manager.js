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
    var locale = options.locale || 'de';

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

    // Listen for zoom changes
    map.on('zoomend', function() {
      var zoom = map.getZoom();
      updateLayerVisibility(map, zoom, layerGroups);
      
      // Load data if zooming in past threshold and data not yet loaded
      if (shouldShowDetailLayers(zoom) && global.PaddelbuchDataLoader) {
        var bounds = map.getBounds();
        var boundsObj = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        };
        
        // Trigger data load for detail layers
        loadDetailLayersIfNeeded(boundsObj, zoom, locale, layerGroups);
      }
    });

    // Listen for move events to load data for new viewport
    map.on('moveend', function() {
      var zoom = map.getZoom();
      if (shouldShowDetailLayers(zoom) && global.PaddelbuchDataLoader) {
        var bounds = map.getBounds();
        var boundsObj = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        };
        
        loadDetailLayersIfNeeded(boundsObj, zoom, locale, layerGroups);
      }
    });

    console.log('ZoomLayerManager initialized with threshold:', DETAIL_LAYER_ZOOM_THRESHOLD);
  }

  /**
   * Load detail layers (obstacles, protected areas) if needed
   * 
   * @param {Object} bounds - Viewport bounds
   * @param {number} zoom - Current zoom level
   * @param {string} locale - Current locale
   * @param {Object} layerGroups - Layer groups object
   */
  function loadDetailLayersIfNeeded(bounds, zoom, locale, layerGroups) {
    if (!global.PaddelbuchDataLoader) {
      return;
    }

    // Use debounced loading to prevent excessive requests
    global.PaddelbuchDataLoader.loadDataForBoundsDebounced(
      bounds,
      zoom,
      locale,
      function(error, data) {
        if (error) {
          console.warn('Error loading detail layers:', error);
          return;
        }

        // Add obstacles to layer group
        if (data.obstacles && data.obstacles.length > 0 && layerGroups.obstacles) {
          data.obstacles.forEach(function(obstacle) {
            if (global.paddelbuchAddObstacleLayer) {
              global.paddelbuchAddObstacleLayer(obstacle);
            }
          });
        }

        // Add protected areas to layer group
        if (data.protected && data.protected.length > 0 && layerGroups.protectedAreas) {
          data.protected.forEach(function(area) {
            if (global.paddelbuchAddProtectedAreaLayer) {
              global.paddelbuchAddProtectedAreaLayer(area);
            }
          });
        }
      }
    );
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
