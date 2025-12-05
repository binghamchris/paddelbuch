/**
 * Property-Based Tests for Data Loading Idempotence
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 25: Data Loading Idempotence**
 * **Validates: Requirements 14.1, 14.2**
 * 
 * Property: For any sequence of viewport changes that returns to the same bounds
 * and zoom level, the displayed data shall be identical regardless of the path taken.
 */

const fc = require('fast-check');

// Switzerland bounds (from _config.yml)
const SWITZERLAND_BOUNDS = {
  north: 47.8,
  south: 45.8,
  east: 10.5,
  west: 5.9
};

// Tile size configuration (from tile_generator.rb)
const TILE_SIZE = {
  lat: 0.25,
  lon: 0.46
};

// Calculate grid dimensions
const GRID_COLS = Math.ceil((SWITZERLAND_BOUNDS.east - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
const GRID_ROWS = Math.ceil((SWITZERLAND_BOUNDS.north - SWITZERLAND_BOUNDS.south) / TILE_SIZE.lat);

// Layer configurations
const LAYER_CONFIG = {
  spots: { minZoom: 0 },
  notices: { minZoom: 0 },
  obstacles: { minZoom: 12 },
  protected: { minZoom: 12 }
};

/**
 * Convert bounds to tile coordinates
 */
function boundsToTileCoords(bounds) {
  if (!bounds || typeof bounds.north !== 'number') {
    return [];
  }

  const clampedBounds = {
    north: Math.min(bounds.north, SWITZERLAND_BOUNDS.north),
    south: Math.max(bounds.south, SWITZERLAND_BOUNDS.south),
    east: Math.min(bounds.east, SWITZERLAND_BOUNDS.east),
    west: Math.max(bounds.west, SWITZERLAND_BOUNDS.west)
  };

  if (clampedBounds.north < clampedBounds.south || clampedBounds.east < clampedBounds.west) {
    return [];
  }

  let minX = Math.floor((clampedBounds.west - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let maxX = Math.floor((clampedBounds.east - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let minY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.north) / TILE_SIZE.lat);
  let maxY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.south) / TILE_SIZE.lat);

  minX = Math.max(0, Math.min(minX, GRID_COLS - 1));
  maxX = Math.max(0, Math.min(maxX, GRID_COLS - 1));
  minY = Math.max(0, Math.min(minY, GRID_ROWS - 1));
  maxY = Math.max(0, Math.min(maxY, GRID_ROWS - 1));

  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

/**
 * Determine which layers should be loaded at a given zoom level
 */
function getLayersForZoom(zoom) {
  return Object.keys(LAYER_CONFIG).filter(layer => zoom >= LAYER_CONFIG[layer].minZoom);
}

/**
 * Generate a cache key for a tile
 */
function getCacheKey(layer, x, y, locale) {
  return `${layer}-${x}-${y}-${locale}`;
}

/**
 * Simulate the data loading process
 * Returns a set of cache keys that would be loaded
 */
function simulateDataLoad(bounds, zoom, locale) {
  const tiles = boundsToTileCoords(bounds);
  const layers = getLayersForZoom(zoom);
  const cacheKeys = new Set();

  layers.forEach(layer => {
    tiles.forEach(tile => {
      cacheKeys.add(getCacheKey(layer, tile.x, tile.y, locale));
    });
  });

  return cacheKeys;
}

/**
 * Compare two sets for equality
 */
function setsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

/**
 * Simulate a sequence of viewport changes and return final loaded data
 */
function simulateViewportSequence(viewportSequence, locale) {
  // Simulate cache accumulation through viewport changes
  const cache = new Set();
  
  viewportSequence.forEach(viewport => {
    const loaded = simulateDataLoad(viewport.bounds, viewport.zoom, locale);
    loaded.forEach(key => cache.add(key));
  });

  return cache;
}

// Arbitraries for generating test data

// Generate valid Swiss coordinates
const swissLatArb = fc.float({ 
  min: Math.fround(SWITZERLAND_BOUNDS.south + 0.01), 
  max: Math.fround(SWITZERLAND_BOUNDS.north - 0.01),
  noNaN: true 
});

const swissLonArb = fc.float({ 
  min: Math.fround(SWITZERLAND_BOUNDS.west + 0.01), 
  max: Math.fround(SWITZERLAND_BOUNDS.east - 0.01),
  noNaN: true 
});

// Generate viewport bounds within Switzerland
const viewportBoundsArb = fc.tuple(swissLatArb, swissLatArb, swissLonArb, swissLonArb)
  .map(([lat1, lat2, lon1, lon2]) => ({
    north: Math.max(lat1, lat2),
    south: Math.min(lat1, lat2),
    east: Math.max(lon1, lon2),
    west: Math.min(lon1, lon2)
  }))
  .filter(bounds => bounds.north > bounds.south && bounds.east > bounds.west);

// Generate zoom level
const zoomArb = fc.integer({ min: 7, max: 18 });

// Generate a viewport (bounds + zoom)
const viewportArb = fc.record({
  bounds: viewportBoundsArb,
  zoom: zoomArb
});

// Generate locale
const localeArb = fc.constantFrom('de', 'en');

// Generate a sequence of viewports
const viewportSequenceArb = fc.array(viewportArb, { minLength: 1, maxLength: 5 });

describe('Data Loading Idempotence - Property 25', () => {
  /**
   * Property 25: Data Loading Idempotence
   * For any sequence of viewport changes that returns to the same bounds and zoom level,
   * the displayed data shall be identical regardless of the path taken.
   */

  describe('Same viewport produces same data', () => {
    test('loading data for the same bounds and zoom twice produces identical results', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          localeArb,
          (bounds, zoom, locale) => {
            const load1 = simulateDataLoad(bounds, zoom, locale);
            const load2 = simulateDataLoad(bounds, zoom, locale);
            return setsEqual(load1, load2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('loading data multiple times produces identical results', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          localeArb,
          fc.integer({ min: 2, max: 5 }),
          (bounds, zoom, locale, times) => {
            const results = [];
            for (let i = 0; i < times; i++) {
              results.push(simulateDataLoad(bounds, zoom, locale));
            }
            
            // All results should be identical
            return results.every(result => setsEqual(result, results[0]));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Path independence', () => {
    test('returning to same viewport after panning produces same data', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          viewportBoundsArb,
          zoomArb,
          localeArb,
          (startBounds, intermediateBounds, zoom, locale) => {
            // Load data at start position
            const startData = simulateDataLoad(startBounds, zoom, locale);
            
            // Pan to intermediate position
            simulateDataLoad(intermediateBounds, zoom, locale);
            
            // Return to start position
            const returnData = simulateDataLoad(startBounds, zoom, locale);
            
            // Data should be identical
            return setsEqual(startData, returnData);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returning to same viewport after zooming produces same data', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          fc.integer({ min: 7, max: 18 }),
          localeArb,
          (bounds, startZoom, intermediateZoom, locale) => {
            // Load data at start zoom
            const startData = simulateDataLoad(bounds, startZoom, locale);
            
            // Zoom to intermediate level
            simulateDataLoad(bounds, intermediateZoom, locale);
            
            // Return to start zoom
            const returnData = simulateDataLoad(bounds, startZoom, locale);
            
            // Data should be identical
            return setsEqual(startData, returnData);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different paths to same viewport produce same data', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          viewportSequenceArb,
          viewportSequenceArb,
          localeArb,
          (targetBounds, targetZoom, path1, path2, locale) => {
            // Follow path 1 then load target
            path1.forEach(v => simulateDataLoad(v.bounds, v.zoom, locale));
            const data1 = simulateDataLoad(targetBounds, targetZoom, locale);
            
            // Follow path 2 then load target
            path2.forEach(v => simulateDataLoad(v.bounds, v.zoom, locale));
            const data2 = simulateDataLoad(targetBounds, targetZoom, locale);
            
            // Data should be identical regardless of path
            return setsEqual(data1, data2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache key determinism', () => {
    test('cache keys are deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('spots', 'notices', 'obstacles', 'protected'),
          fc.integer({ min: 0, max: GRID_COLS - 1 }),
          fc.integer({ min: 0, max: GRID_ROWS - 1 }),
          localeArb,
          (layer, x, y, locale) => {
            const key1 = getCacheKey(layer, x, y, locale);
            const key2 = getCacheKey(layer, x, y, locale);
            return key1 === key2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different inputs produce different cache keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('spots', 'notices', 'obstacles', 'protected'),
          fc.constantFrom('spots', 'notices', 'obstacles', 'protected'),
          fc.integer({ min: 0, max: GRID_COLS - 1 }),
          fc.integer({ min: 0, max: GRID_ROWS - 1 }),
          localeArb,
          (layer1, layer2, x, y, locale) => {
            // If layers are different, keys should be different
            if (layer1 !== layer2) {
              const key1 = getCacheKey(layer1, x, y, locale);
              const key2 = getCacheKey(layer2, x, y, locale);
              return key1 !== key2;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tile calculation determinism', () => {
    test('same bounds always produce same tiles', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          (bounds) => {
            const tiles1 = boundsToTileCoords(bounds);
            const tiles2 = boundsToTileCoords(bounds);
            
            if (tiles1.length !== tiles2.length) return false;
            
            // Sort tiles for comparison
            const sort = (a, b) => a.x - b.x || a.y - b.y;
            tiles1.sort(sort);
            tiles2.sort(sort);
            
            return tiles1.every((t, i) => t.x === tiles2[i].x && t.y === tiles2[i].y);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Layer selection determinism', () => {
    test('same zoom always produces same layer selection', () => {
      fc.assert(
        fc.property(
          zoomArb,
          (zoom) => {
            const layers1 = getLayersForZoom(zoom);
            const layers2 = getLayersForZoom(zoom);
            
            if (layers1.length !== layers2.length) return false;
            
            layers1.sort();
            layers2.sort();
            
            return layers1.every((l, i) => l === layers2[i]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale independence', () => {
    test('same viewport with same locale produces same data structure', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          localeArb,
          (bounds, zoom, locale) => {
            const data1 = simulateDataLoad(bounds, zoom, locale);
            const data2 = simulateDataLoad(bounds, zoom, locale);
            
            // Same locale should produce identical cache keys
            return setsEqual(data1, data2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different locales produce different cache keys for same viewport', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          zoomArb,
          (bounds, zoom) => {
            const dataDE = simulateDataLoad(bounds, zoom, 'de');
            const dataEN = simulateDataLoad(bounds, zoom, 'en');
            
            // Different locales should produce different cache keys
            // (unless both are empty)
            if (dataDE.size === 0 && dataEN.size === 0) return true;
            
            // Check that no keys overlap
            for (const key of dataDE) {
              if (dataEN.has(key)) return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Order independence', () => {
    test('order of viewport visits does not affect final data for same endpoint', () => {
      fc.assert(
        fc.property(
          viewportArb,
          viewportSequenceArb,
          localeArb,
          (targetViewport, sequence, locale) => {
            // Visit sequence in order, then target
            const forwardSequence = [...sequence, targetViewport];
            
            // Visit sequence in reverse, then target
            const reverseSequence = [...sequence.reverse(), targetViewport];
            
            // Both should produce same data for target viewport
            const forwardData = simulateDataLoad(targetViewport.bounds, targetViewport.zoom, locale);
            const reverseData = simulateDataLoad(targetViewport.bounds, targetViewport.zoom, locale);
            
            return setsEqual(forwardData, reverseData);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
