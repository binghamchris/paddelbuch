/**
 * Spatial Utilities Module
 * 
 * Provides utility functions for spatial calculations including:
 * - Bounds-to-tile coordinate conversion
 * - Point-in-bounds checking
 * - Bounds expansion for pre-loading
 * 
 * Requirements: 14.1, 14.2
 */

(function(global) {
  'use strict';

  // Switzerland bounds (from _config.yml)
  var SWITZERLAND_BOUNDS = {
    north: 47.8,
    south: 45.8,
    east: 10.5,
    west: 5.9
  };

  // Tile size configuration (from tile_generator.rb)
  // Approximately 10km x 10km tiles
  var TILE_SIZE = {
    lat: 0.25,
    lon: 0.46
  };

  // Calculate grid dimensions
  var GRID_COLS = Math.ceil((SWITZERLAND_BOUNDS.east - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  var GRID_ROWS = Math.ceil((SWITZERLAND_BOUNDS.north - SWITZERLAND_BOUNDS.south) / TILE_SIZE.lat);

  /**
   * Check if a point is within Switzerland bounds
   * 
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {boolean} True if point is within Switzerland bounds
   */
  function pointInSwitzerlandBounds(lat, lon) {
    return lat >= SWITZERLAND_BOUNDS.south &&
           lat <= SWITZERLAND_BOUNDS.north &&
           lon >= SWITZERLAND_BOUNDS.west &&
           lon <= SWITZERLAND_BOUNDS.east;
  }

  /**
   * Check if a point is within given bounds
   * 
   * @param {Object} point - Point with lat and lon properties
   * @param {Object} bounds - Bounds object with north, south, east, west properties
   * @returns {boolean} True if point is within bounds
   */
  function pointInBounds(point, bounds) {
    if (!point || typeof point.lat !== 'number' || typeof point.lon !== 'number') {
      return false;
    }
    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return false;
    }
    return point.lat >= bounds.south &&
           point.lat <= bounds.north &&
           point.lon >= bounds.west &&
           point.lon <= bounds.east;
  }

  /**
   * Convert Leaflet bounds to tile coordinates
   * Returns an array of tile coordinates that intersect with the given bounds
   * 
   * @param {Object} bounds - Bounds object with north, south, east, west properties
   * @returns {Array} Array of {x, y} tile coordinate objects
   */
  function boundsToTileCoords(bounds) {
    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return [];
    }

    // Clamp bounds to Switzerland
    var clampedBounds = {
      north: Math.min(bounds.north, SWITZERLAND_BOUNDS.north),
      south: Math.max(bounds.south, SWITZERLAND_BOUNDS.south),
      east: Math.min(bounds.east, SWITZERLAND_BOUNDS.east),
      west: Math.max(bounds.west, SWITZERLAND_BOUNDS.west)
    };

    // Check if bounds intersect with Switzerland at all
    if (clampedBounds.north < clampedBounds.south || clampedBounds.east < clampedBounds.west) {
      return [];
    }

    // Calculate tile range
    var minX = Math.floor((clampedBounds.west - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
    var maxX = Math.floor((clampedBounds.east - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
    var minY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.north) / TILE_SIZE.lat);
    var maxY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.south) / TILE_SIZE.lat);

    // Clamp to grid bounds
    minX = Math.max(0, Math.min(minX, GRID_COLS - 1));
    maxX = Math.max(0, Math.min(maxX, GRID_COLS - 1));
    minY = Math.max(0, Math.min(minY, GRID_ROWS - 1));
    maxY = Math.max(0, Math.min(maxY, GRID_ROWS - 1));

    // Generate tile coordinates
    var tiles = [];
    for (var x = minX; x <= maxX; x++) {
      for (var y = minY; y <= maxY; y++) {
        tiles.push({ x: x, y: y });
      }
    }

    return tiles;
  }

  /**
   * Convert tile coordinates back to bounds
   * 
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @returns {Object} Bounds object with north, south, east, west properties
   */
  function tileCoordsToBounds(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' ||
        x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
      return null;
    }

    return {
      north: SWITZERLAND_BOUNDS.north - (y * TILE_SIZE.lat),
      south: SWITZERLAND_BOUNDS.north - ((y + 1) * TILE_SIZE.lat),
      east: SWITZERLAND_BOUNDS.west + ((x + 1) * TILE_SIZE.lon),
      west: SWITZERLAND_BOUNDS.west + (x * TILE_SIZE.lon)
    };
  }

  /**
   * Expand bounds by a factor for pre-loading adjacent areas
   * 
   * @param {Object} bounds - Bounds object with north, south, east, west properties
   * @param {number} factor - Expansion factor (e.g., 0.2 for 20% expansion)
   * @returns {Object} Expanded bounds object
   */
  function expandBounds(bounds, factor) {
    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return null;
    }

    factor = typeof factor === 'number' ? factor : 0.2;

    var latRange = bounds.north - bounds.south;
    var lonRange = bounds.east - bounds.west;
    var latExpansion = latRange * factor;
    var lonExpansion = lonRange * factor;

    return {
      north: bounds.north + latExpansion,
      south: bounds.south - latExpansion,
      east: bounds.east + lonExpansion,
      west: bounds.west - lonExpansion
    };
  }

  /**
   * Check if two bounds objects intersect
   * 
   * @param {Object} bounds1 - First bounds object
   * @param {Object} bounds2 - Second bounds object
   * @returns {boolean} True if bounds intersect
   */
  function boundsIntersect(bounds1, bounds2) {
    if (!bounds1 || !bounds2) {
      return false;
    }
    return !(bounds1.east < bounds2.west ||
             bounds1.west > bounds2.east ||
             bounds1.north < bounds2.south ||
             bounds1.south > bounds2.north);
  }

  /**
   * Convert Leaflet LatLngBounds to our bounds format
   * 
   * @param {L.LatLngBounds} leafletBounds - Leaflet bounds object
   * @returns {Object} Bounds object with north, south, east, west properties
   */
  function leafletBoundsToObject(leafletBounds) {
    if (!leafletBounds || typeof leafletBounds.getNorth !== 'function') {
      return null;
    }
    return {
      north: leafletBounds.getNorth(),
      south: leafletBounds.getSouth(),
      east: leafletBounds.getEast(),
      west: leafletBounds.getWest()
    };
  }

  /**
   * Get tile key string for caching
   * 
   * @param {string} layer - Layer name
   * @param {number} x - Tile X coordinate
   * @param {number} y - Tile Y coordinate
   * @param {string} locale - Locale code
   * @returns {string} Cache key string
   */
  function getTileKey(layer, x, y, locale) {
    return layer + '-' + x + '-' + y + '-' + locale;
  }

  // Export to global scope
  global.PaddelbuchSpatialUtils = {
    // Constants
    SWITZERLAND_BOUNDS: SWITZERLAND_BOUNDS,
    TILE_SIZE: TILE_SIZE,
    GRID_COLS: GRID_COLS,
    GRID_ROWS: GRID_ROWS,
    
    // Functions
    pointInSwitzerlandBounds: pointInSwitzerlandBounds,
    pointInBounds: pointInBounds,
    boundsToTileCoords: boundsToTileCoords,
    tileCoordsToBounds: tileCoordsToBounds,
    expandBounds: expandBounds,
    boundsIntersect: boundsIntersect,
    leafletBoundsToObject: leafletBoundsToObject,
    getTileKey: getTileKey
  };

})(typeof window !== 'undefined' ? window : this);
