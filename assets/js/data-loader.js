/**
 * Data Loader Module
 * 
 * Manages dynamic loading of map data based on viewport bounds and zoom level.
 * Implements viewport-based tile loading with caching and debouncing.
 * 
 * Requirements: 14.1, 14.2, 14.5
 * 
 * Key Functions:
 * - loadDataForBounds(bounds, zoom, locale): Fetches data for the current viewport
 * - getTilesForBounds(bounds): Calculates which spatial tiles intersect the viewport
 * - fetchTile(layer, x, y, locale): Fetches a single tile from the API
 * - shouldLoadLayer(layer, zoom): Determines if a layer should be loaded at current zoom
 */

(function(global) {
  'use strict';

  // Layer configurations with zoom thresholds
  var LAYER_CONFIG = {
    spots: {
      minZoom: 0,
      path: 'spots'
    },
    notices: {
      minZoom: 0,
      path: 'notices'
    },
    obstacles: {
      minZoom: 12,  // Requirement 14.3: Load obstacles only at zoom >= 12
      path: 'obstacles'
    },
    protected: {
      minZoom: 12,  // Requirement 14.4: Load protected areas only at zoom >= 12
      path: 'protected'
    }
  };

  // Debounce delay in milliseconds (Requirement 14.6)
  var DEBOUNCE_DELAY = 300;

  // In-memory cache for loaded tiles
  // Cache key format: {layer}-{x}-{y}-{locale}
  var tileCache = {};

  // Pending fetch promises to prevent duplicate requests
  var pendingFetches = {};

  // Debounce timer reference
  var debounceTimer = null;

  // Callbacks for data updates
  var dataCallbacks = [];

  /**
   * Get spatial utils module (must be loaded before this module)
   */
  function getSpatialUtils() {
    return global.PaddelbuchSpatialUtils;
  }

  /**
   * Determine if a layer should be loaded at the current zoom level
   * 
   * @param {string} layer - Layer name ('spots', 'notices', 'obstacles', 'protected')
   * @param {number} zoom - Current zoom level
   * @returns {boolean} True if layer should be loaded
   */
  function shouldLoadLayer(layer, zoom) {
    var config = LAYER_CONFIG[layer];
    if (!config) {
      return false;
    }
    return zoom >= config.minZoom;
  }

  /**
   * Get tiles that intersect with the given bounds
   * 
   * @param {Object} bounds - Bounds object with north, south, east, west
   * @returns {Array} Array of {x, y} tile coordinates
   */
  function getTilesForBounds(bounds) {
    var spatialUtils = getSpatialUtils();
    if (!spatialUtils) {
      console.warn('PaddelbuchSpatialUtils not loaded');
      return [];
    }
    return spatialUtils.boundsToTileCoords(bounds);
  }

  /**
   * Generate cache key for a tile
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @returns {string} Cache key
   */
  function getCacheKey(layer, x, y, locale) {
    return layer + '-' + x + '-' + y + '-' + locale;
  }

  /**
   * Check if a tile is already cached
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @returns {boolean} True if tile is cached
   */
  function isTileCached(layer, x, y, locale) {
    var key = getCacheKey(layer, x, y, locale);
    return tileCache.hasOwnProperty(key);
  }

  /**
   * Get cached tile data
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @returns {Object|null} Cached tile data or null
   */
  function getCachedTile(layer, x, y, locale) {
    var key = getCacheKey(layer, x, y, locale);
    return tileCache[key] || null;
  }

  /**
   * Store tile data in cache
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @param {Object} data - Tile data to cache
   */
  function cacheTile(layer, x, y, locale, data) {
    var key = getCacheKey(layer, x, y, locale);
    tileCache[key] = data;
  }

  /**
   * Fetch a single tile from the API
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @returns {Promise} Promise resolving to tile data
   */
  function fetchTile(layer, x, y, locale) {
    var key = getCacheKey(layer, x, y, locale);

    // Return cached data if available (Requirement 14.5)
    if (tileCache.hasOwnProperty(key)) {
      return Promise.resolve(tileCache[key]);
    }

    // Return pending fetch if one exists
    if (pendingFetches.hasOwnProperty(key)) {
      return pendingFetches[key];
    }

    // Build tile URL
    var config = LAYER_CONFIG[layer];
    if (!config) {
      return Promise.reject(new Error('Unknown layer: ' + layer));
    }

    var url = '/api/tiles/' + config.path + '/' + locale + '/' + x + '_' + y + '.json';

    // Create fetch promise
    var fetchPromise = fetch(url)
      .then(function(response) {
        if (!response.ok) {
          // Tile might not exist (empty tile)
          if (response.status === 404) {
            return { data: [] };
          }
          throw new Error('Failed to fetch tile: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        // Cache the result
        cacheTile(layer, x, y, locale, data);
        // Remove from pending
        delete pendingFetches[key];
        return data;
      })
      .catch(function(error) {
        // Remove from pending on error
        delete pendingFetches[key];
        // Cache empty result to prevent repeated failed requests
        cacheTile(layer, x, y, locale, { data: [] });
        console.warn('Error fetching tile ' + key + ':', error);
        return { data: [] };
      });

    // Store pending fetch
    pendingFetches[key] = fetchPromise;

    return fetchPromise;
  }

  /**
   * Load data for the given bounds and zoom level
   * 
   * @param {Object} bounds - Bounds object with north, south, east, west
   * @param {number} zoom - Current zoom level
   * @param {string} locale - Locale code ('de' or 'en')
   * @returns {Promise} Promise resolving to loaded data by layer
   */
  function loadDataForBounds(bounds, zoom, locale) {
    var spatialUtils = getSpatialUtils();
    if (!spatialUtils) {
      return Promise.reject(new Error('PaddelbuchSpatialUtils not loaded'));
    }

    // Expand bounds slightly for pre-loading
    var expandedBounds = spatialUtils.expandBounds(bounds, 0.1);
    
    // Get tiles for the expanded bounds
    var tiles = getTilesForBounds(expandedBounds);
    
    if (tiles.length === 0) {
      return Promise.resolve({
        spots: [],
        notices: [],
        obstacles: [],
        protected: []
      });
    }

    // Determine which layers to load based on zoom
    var layersToLoad = Object.keys(LAYER_CONFIG).filter(function(layer) {
      return shouldLoadLayer(layer, zoom);
    });

    // Create fetch promises for all needed tiles
    var fetchPromises = [];
    var fetchMeta = []; // Track which layer each promise belongs to

    layersToLoad.forEach(function(layer) {
      tiles.forEach(function(tile) {
        fetchPromises.push(fetchTile(layer, tile.x, tile.y, locale));
        fetchMeta.push({ layer: layer, x: tile.x, y: tile.y });
      });
    });

    // Wait for all fetches to complete
    return Promise.all(fetchPromises).then(function(results) {
      // Organize results by layer
      var dataByLayer = {
        spots: [],
        notices: [],
        obstacles: [],
        protected: []
      };

      results.forEach(function(result, index) {
        var meta = fetchMeta[index];
        if (result && result.data && Array.isArray(result.data)) {
          // Merge data, avoiding duplicates by slug
          var existingSlugs = {};
          dataByLayer[meta.layer].forEach(function(item) {
            existingSlugs[item.slug] = true;
          });
          
          result.data.forEach(function(item) {
            if (!existingSlugs[item.slug]) {
              dataByLayer[meta.layer].push(item);
              existingSlugs[item.slug] = true;
            }
          });
        }
      });

      return dataByLayer;
    });
  }

  /**
   * Debounced version of loadDataForBounds
   * Prevents excessive API calls during rapid pan/zoom (Requirement 14.6)
   * 
   * @param {Object} bounds - Bounds object
   * @param {number} zoom - Current zoom level
   * @param {string} locale - Locale code
   * @param {Function} callback - Callback function(error, data)
   */
  function loadDataForBoundsDebounced(bounds, zoom, locale, callback) {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(function() {
      loadDataForBounds(bounds, zoom, locale)
        .then(function(data) {
          callback(null, data);
        })
        .catch(function(error) {
          callback(error, null);
        });
    }, DEBOUNCE_DELAY);
  }

  /**
   * Register a callback for data updates
   * 
   * @param {Function} callback - Callback function(data)
   */
  function onDataUpdate(callback) {
    if (typeof callback === 'function') {
      dataCallbacks.push(callback);
    }
  }

  /**
   * Notify all registered callbacks of data update
   * 
   * @param {Object} data - Updated data by layer
   */
  function notifyDataUpdate(data) {
    dataCallbacks.forEach(function(callback) {
      try {
        callback(data);
      } catch (e) {
        console.error('Error in data update callback:', e);
      }
    });
  }

  /**
   * Clear the tile cache
   * Useful for forcing a refresh of data
   */
  function clearCache() {
    tileCache = {};
    pendingFetches = {};
  }

  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
  function getCacheStats() {
    return {
      cachedTiles: Object.keys(tileCache).length,
      pendingFetches: Object.keys(pendingFetches).length
    };
  }

  /**
   * Get all layers that should be visible at the given zoom level
   * 
   * @param {number} zoom - Current zoom level
   * @returns {Array} Array of layer names
   */
  function getVisibleLayers(zoom) {
    return Object.keys(LAYER_CONFIG).filter(function(layer) {
      return shouldLoadLayer(layer, zoom);
    });
  }

  /**
   * Get layers that should be hidden at the given zoom level
   * 
   * @param {number} zoom - Current zoom level
   * @returns {Array} Array of layer names
   */
  function getHiddenLayers(zoom) {
    return Object.keys(LAYER_CONFIG).filter(function(layer) {
      return !shouldLoadLayer(layer, zoom);
    });
  }

  // Export to global scope
  global.PaddelbuchDataLoader = {
    // Configuration
    LAYER_CONFIG: LAYER_CONFIG,
    DEBOUNCE_DELAY: DEBOUNCE_DELAY,
    
    // Core functions
    loadDataForBounds: loadDataForBounds,
    loadDataForBoundsDebounced: loadDataForBoundsDebounced,
    getTilesForBounds: getTilesForBounds,
    fetchTile: fetchTile,
    shouldLoadLayer: shouldLoadLayer,
    
    // Layer visibility
    getVisibleLayers: getVisibleLayers,
    getHiddenLayers: getHiddenLayers,
    
    // Cache management
    isTileCached: isTileCached,
    getCachedTile: getCachedTile,
    clearCache: clearCache,
    getCacheStats: getCacheStats,
    
    // Callbacks
    onDataUpdate: onDataUpdate,
    notifyDataUpdate: notifyDataUpdate
  };

})(typeof window !== 'undefined' ? window : this);
