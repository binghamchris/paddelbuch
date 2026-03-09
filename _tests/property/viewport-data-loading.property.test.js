/**
 * Property-Based Tests for Viewport Data Loading Completeness
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 22: Viewport Data Loading Completeness**
 * **Validates: Requirements 14.1, 14.2**
 * 
 * Property: For any map viewport bounds, all spots and event notices whose location
 * falls within those bounds shall be loaded and displayed on the map.
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

/**
 * Check if a point is within given bounds
 */
function pointInBounds(point, bounds) {
  if (!point || typeof point.lat !== 'number' || typeof point.lon !== 'number') {
    return false;
  }
  return point.lat >= bounds.south &&
         point.lat <= bounds.north &&
         point.lon >= bounds.west &&
         point.lon <= bounds.east;
}

/**
 * Convert bounds to tile coordinates
 * Returns an array of tile coordinates that intersect with the given bounds
 */
function boundsToTileCoords(bounds) {
  if (!bounds || typeof bounds.north !== 'number') {
    return [];
  }

  // Clamp bounds to Switzerland
  const clampedBounds = {
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
  let minX = Math.floor((clampedBounds.west - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let maxX = Math.floor((clampedBounds.east - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let minY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.north) / TILE_SIZE.lat);
  let maxY = Math.floor((SWITZERLAND_BOUNDS.north - clampedBounds.south) / TILE_SIZE.lat);

  // Clamp to grid bounds
  minX = Math.max(0, Math.min(minX, GRID_COLS - 1));
  maxX = Math.max(0, Math.min(maxX, GRID_COLS - 1));
  minY = Math.max(0, Math.min(minY, GRID_ROWS - 1));
  maxY = Math.max(0, Math.min(maxY, GRID_ROWS - 1));

  // Generate tile coordinates
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

/**
 * Convert tile coordinates to bounds
 */
function tileCoordsToBounds(x, y) {
  return {
    north: SWITZERLAND_BOUNDS.north - (y * TILE_SIZE.lat),
    south: SWITZERLAND_BOUNDS.north - ((y + 1) * TILE_SIZE.lat),
    east: SWITZERLAND_BOUNDS.west + ((x + 1) * TILE_SIZE.lon),
    west: SWITZERLAND_BOUNDS.west + (x * TILE_SIZE.lon)
  };
}

/**
 * Get tile for a point location
 */
function getTileForPoint(lat, lon) {
  if (lat < SWITZERLAND_BOUNDS.south || lat > SWITZERLAND_BOUNDS.north ||
      lon < SWITZERLAND_BOUNDS.west || lon > SWITZERLAND_BOUNDS.east) {
    return null;
  }

  let x = Math.floor((lon - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let y = Math.floor((SWITZERLAND_BOUNDS.north - lat) / TILE_SIZE.lat);

  // Clamp to grid bounds
  x = Math.max(0, Math.min(x, GRID_COLS - 1));
  y = Math.max(0, Math.min(y, GRID_ROWS - 1));

  return { x, y };
}

/**
 * Simulate loading data for bounds
 * Returns all entities whose locations fall within the tiles that intersect the bounds
 */
function simulateLoadDataForBounds(bounds, entities) {
  const tiles = boundsToTileCoords(bounds);
  const loadedEntities = [];
  const loadedSlugs = new Set();

  entities.forEach(entity => {
    if (!entity.location) return;
    
    const tile = getTileForPoint(entity.location.lat, entity.location.lon);
    if (!tile) return;

    // Check if entity's tile is in the tiles to load
    const tileInBounds = tiles.some(t => t.x === tile.x && t.y === tile.y);
    if (tileInBounds && !loadedSlugs.has(entity.slug)) {
      loadedEntities.push(entity);
      loadedSlugs.add(entity.slug);
    }
  });

  return loadedEntities;
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

// Generate point location
const pointLocationArb = fc.record({
  lat: swissLatArb,
  lon: swissLonArb
});

// Generate a spot entity
const spotEntityArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).map(s => 'spot-' + s.replace(/[^a-z0-9]/gi, '')),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  location: pointLocationArb,
  spotType_slug: fc.constantFrom('einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte', 'notauswasserungsstelle')
});

// Generate an event notice entity
const eventNoticeEntityArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).map(s => 'notice-' + s.replace(/[^a-z0-9]/gi, '')),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  location: pointLocationArb,
  startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }).map(d => d.toISOString()),
  endDate: fc.date({ min: new Date('2025-01-01'), max: new Date('2026-12-31') }).map(d => d.toISOString())
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

// Generate a list of spot entities
const spotListArb = fc.array(spotEntityArb, { minLength: 1, maxLength: 20 });

// Generate a list of event notice entities
const noticeListArb = fc.array(eventNoticeEntityArb, { minLength: 1, maxLength: 10 });

describe('Viewport Data Loading Completeness - Property 22', () => {
  /**
   * Property 22: Viewport Data Loading Completeness
   * For any map viewport bounds, all spots and event notices whose location
   * falls within those bounds shall be loaded and displayed on the map.
   */

  describe('Spots loading', () => {
    test('all spots within viewport bounds are included in loaded data', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          spotListArb,
          (bounds, spots) => {
            // Get spots that should be loaded (in tiles that intersect bounds)
            const loadedSpots = simulateLoadDataForBounds(bounds, spots);
            
            // Get spots that are actually within the bounds
            const spotsInBounds = spots.filter(spot => 
              pointInBounds(spot.location, bounds)
            );
            
            // Every spot within bounds should be in loaded data
            // (loaded data may include more spots from edge tiles)
            return spotsInBounds.every(spot => 
              loadedSpots.some(loaded => loaded.slug === spot.slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('loaded spots come from tiles that intersect the viewport', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          spotListArb,
          (bounds, spots) => {
            const loadedSpots = simulateLoadDataForBounds(bounds, spots);
            const tiles = boundsToTileCoords(bounds);
            
            // Every loaded spot should be in a tile that intersects the viewport
            return loadedSpots.every(spot => {
              const spotTile = getTileForPoint(spot.location.lat, spot.location.lon);
              return spotTile && tiles.some(t => t.x === spotTile.x && t.y === spotTile.y);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Event notices loading', () => {
    test('all event notices within viewport bounds are included in loaded data', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          noticeListArb,
          (bounds, notices) => {
            const loadedNotices = simulateLoadDataForBounds(bounds, notices);
            
            const noticesInBounds = notices.filter(notice => 
              pointInBounds(notice.location, bounds)
            );
            
            return noticesInBounds.every(notice => 
              loadedNotices.some(loaded => loaded.slug === notice.slug)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tile coverage for viewport', () => {
    test('viewport bounds map to at least one tile', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          (bounds) => {
            const tiles = boundsToTileCoords(bounds);
            return tiles.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all tiles for viewport are within grid bounds', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          (bounds) => {
            const tiles = boundsToTileCoords(bounds);
            return tiles.every(tile => 
              tile.x >= 0 && tile.x < GRID_COLS &&
              tile.y >= 0 && tile.y < GRID_ROWS
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('tiles cover the entire viewport', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          (bounds) => {
            const tiles = boundsToTileCoords(bounds);
            
            if (tiles.length === 0) return true;
            
            // Get combined bounds of all tiles
            let combinedNorth = -Infinity;
            let combinedSouth = Infinity;
            let combinedEast = -Infinity;
            let combinedWest = Infinity;
            
            tiles.forEach(tile => {
              const tileBounds = tileCoordsToBounds(tile.x, tile.y);
              combinedNorth = Math.max(combinedNorth, tileBounds.north);
              combinedSouth = Math.min(combinedSouth, tileBounds.south);
              combinedEast = Math.max(combinedEast, tileBounds.east);
              combinedWest = Math.min(combinedWest, tileBounds.west);
            });
            
            // Clamp viewport bounds to Switzerland
            const clampedBounds = {
              north: Math.min(bounds.north, SWITZERLAND_BOUNDS.north),
              south: Math.max(bounds.south, SWITZERLAND_BOUNDS.south),
              east: Math.min(bounds.east, SWITZERLAND_BOUNDS.east),
              west: Math.max(bounds.west, SWITZERLAND_BOUNDS.west)
            };
            
            // Combined tile bounds should cover the clamped viewport
            return combinedNorth >= clampedBounds.north &&
                   combinedSouth <= clampedBounds.south &&
                   combinedEast >= clampedBounds.east &&
                   combinedWest <= clampedBounds.west;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No duplicate loading', () => {
    test('each entity is loaded at most once', () => {
      fc.assert(
        fc.property(
          viewportBoundsArb,
          spotListArb,
          (bounds, spots) => {
            const loadedSpots = simulateLoadDataForBounds(bounds, spots);
            const slugs = loadedSpots.map(s => s.slug);
            const uniqueSlugs = new Set(slugs);
            return slugs.length === uniqueSlugs.size;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Empty viewport handling', () => {
    test('viewport outside Switzerland returns empty tiles', () => {
      const outsideBoundsArb = fc.oneof(
        // North of Switzerland
        fc.constant({ north: 50, south: 49, east: 8, west: 7 }),
        // South of Switzerland
        fc.constant({ north: 44, south: 43, east: 8, west: 7 }),
        // East of Switzerland
        fc.constant({ north: 47, south: 46, east: 12, west: 11 }),
        // West of Switzerland
        fc.constant({ north: 47, south: 46, east: 5, west: 4 })
      );

      fc.assert(
        fc.property(
          outsideBoundsArb,
          (bounds) => {
            const tiles = boundsToTileCoords(bounds);
            return tiles.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
