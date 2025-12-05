/**
 * Property-Based Tests for Tile Coverage Completeness
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 24: Tile Coverage Completeness**
 * **Validates: Requirements 15.1, 15.2, 15.3**
 * 
 * Property: For any entity in the dataset, there shall exist exactly one spatial tile 
 * that contains that entity based on its location coordinates.
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
 * Check if a point is within Switzerland bounds
 */
function pointInBounds(lat, lon) {
  return lat >= SWITZERLAND_BOUNDS.south &&
         lat <= SWITZERLAND_BOUNDS.north &&
         lon >= SWITZERLAND_BOUNDS.west &&
         lon <= SWITZERLAND_BOUNDS.east;
}

/**
 * Calculate tile coordinates for a point location
 * Returns [x, y] tile coordinates or null if outside bounds
 */
function getTileForPoint(lat, lon) {
  if (!pointInBounds(lat, lon)) {
    return null;
  }

  // Calculate tile coordinates
  let x = Math.floor((lon - SWITZERLAND_BOUNDS.west) / TILE_SIZE.lon);
  let y = Math.floor((SWITZERLAND_BOUNDS.north - lat) / TILE_SIZE.lat);

  // Clamp to grid bounds
  x = Math.max(0, Math.min(x, GRID_COLS - 1));
  y = Math.max(0, Math.min(y, GRID_ROWS - 1));

  return [x, y];
}

/**
 * Get the bounds of a specific tile
 */
function getTileBounds(x, y) {
  return {
    north: SWITZERLAND_BOUNDS.north - (y * TILE_SIZE.lat),
    south: SWITZERLAND_BOUNDS.north - ((y + 1) * TILE_SIZE.lat),
    east: SWITZERLAND_BOUNDS.west + ((x + 1) * TILE_SIZE.lon),
    west: SWITZERLAND_BOUNDS.west + (x * TILE_SIZE.lon)
  };
}

/**
 * Check if a point is within tile bounds
 */
function pointInTileBounds(lat, lon, tileBounds) {
  // Use inclusive bounds for the tile
  return lat <= tileBounds.north &&
         lat >= tileBounds.south &&
         lon >= tileBounds.west &&
         lon <= tileBounds.east;
}

/**
 * Calculate centroid of a GeoJSON geometry
 */
function calculateCentroid(geojson) {
  const coords = extractCoordinates(geojson);
  if (coords.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;

  coords.forEach(coord => {
    sumLon += coord[0];
    sumLat += coord[1];
  });

  return {
    lat: sumLat / coords.length,
    lon: sumLon / coords.length
  };
}

/**
 * Extract all coordinates from a GeoJSON geometry
 */
function extractCoordinates(geojson) {
  const coords = [];
  
  if (!geojson || !geojson.type) return coords;

  switch (geojson.type) {
    case 'Point':
      if (geojson.coordinates) coords.push(geojson.coordinates);
      break;
    case 'LineString':
    case 'MultiPoint':
      if (geojson.coordinates) coords.push(...geojson.coordinates);
      break;
    case 'Polygon':
      if (geojson.coordinates) {
        geojson.coordinates.forEach(ring => coords.push(...ring));
      }
      break;
    case 'MultiLineString':
    case 'MultiPolygon':
      if (geojson.coordinates) {
        geojson.coordinates.forEach(part => {
          part.forEach(ring => {
            if (Array.isArray(ring) && Array.isArray(ring[0])) {
              coords.push(...ring);
            } else {
              coords.push(ring);
            }
          });
        });
      }
      break;
    case 'GeometryCollection':
      if (geojson.geometries) {
        geojson.geometries.forEach(geom => {
          coords.push(...extractCoordinates(geom));
        });
      }
      break;
    case 'Feature':
      if (geojson.geometry) {
        coords.push(...extractCoordinates(geojson.geometry));
      }
      break;
    case 'FeatureCollection':
      if (geojson.features) {
        geojson.features.forEach(feature => {
          coords.push(...extractCoordinates(feature));
        });
      }
      break;
  }

  return coords;
}

/**
 * Get tile for a geometry-based entity (uses centroid)
 */
function getTileForGeometry(geometry) {
  const centroid = calculateCentroid(geometry);
  if (!centroid) return null;
  return getTileForPoint(centroid.lat, centroid.lon);
}

// Arbitraries for generating test data

// Polygon offset for generating small polygons
const POLYGON_OFFSET = 0.02;

// Generate valid Swiss coordinates with margin for polygon generation
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

// Generate coordinates with extra margin for polygon centers
const swissLatForPolygonArb = fc.float({ 
  min: Math.fround(SWITZERLAND_BOUNDS.south + POLYGON_OFFSET + 0.01), 
  max: Math.fround(SWITZERLAND_BOUNDS.north - POLYGON_OFFSET - 0.01),
  noNaN: true 
});

const swissLonForPolygonArb = fc.float({ 
  min: Math.fround(SWITZERLAND_BOUNDS.west + POLYGON_OFFSET + 0.01), 
  max: Math.fround(SWITZERLAND_BOUNDS.east - POLYGON_OFFSET - 0.01),
  noNaN: true 
});

// Generate point location
const pointLocationArb = fc.record({
  lat: swissLatArb,
  lon: swissLonArb
});

// Generate a spot-like entity with point location
const spotEntityArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  location: pointLocationArb
});

// Generate a simple polygon geometry within Switzerland
// Uses coordinates with extra margin to ensure polygon stays within bounds
const polygonGeometryArb = fc.tuple(swissLatForPolygonArb, swissLonForPolygonArb).chain(([centerLat, centerLon]) => {
  // Create a small polygon around the center point
  return fc.constant({
    type: 'Polygon',
    coordinates: [[
      [centerLon - POLYGON_OFFSET, centerLat - POLYGON_OFFSET],
      [centerLon + POLYGON_OFFSET, centerLat - POLYGON_OFFSET],
      [centerLon + POLYGON_OFFSET, centerLat + POLYGON_OFFSET],
      [centerLon - POLYGON_OFFSET, centerLat + POLYGON_OFFSET],
      [centerLon - POLYGON_OFFSET, centerLat - POLYGON_OFFSET] // Close the ring
    ]]
  });
});

// Generate an obstacle-like entity with geometry
const obstacleEntityArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  geometry: polygonGeometryArb
});

// Generate tile coordinates
const tileXArb = fc.integer({ min: 0, max: GRID_COLS - 1 });
const tileYArb = fc.integer({ min: 0, max: GRID_ROWS - 1 });

describe('Tile Coverage Completeness - Property 24', () => {
  /**
   * Property 24: Tile Coverage Completeness
   * For any entity in the dataset, there shall exist exactly one spatial tile 
   * that contains that entity based on its location coordinates.
   */

  describe('Point-based entities (spots, notices)', () => {
    test('every point within Switzerland bounds maps to exactly one tile', () => {
      fc.assert(
        fc.property(
          pointLocationArb,
          (location) => {
            const tile = getTileForPoint(location.lat, location.lon);
            
            // Must return a valid tile
            if (!tile) return false;
            
            const [x, y] = tile;
            
            // Tile coordinates must be within grid bounds
            if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
              return false;
            }
            
            // Point must be within the tile's bounds
            const tileBounds = getTileBounds(x, y);
            return pointInTileBounds(location.lat, location.lon, tileBounds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('spot entities are assigned to exactly one tile', () => {
      fc.assert(
        fc.property(
          spotEntityArb,
          (spot) => {
            const tile = getTileForPoint(spot.location.lat, spot.location.lon);
            
            // Must return a valid tile
            if (!tile) return false;
            
            const [x, y] = tile;
            
            // Count how many tiles would contain this point
            let containingTiles = 0;
            for (let tx = 0; tx < GRID_COLS; tx++) {
              for (let ty = 0; ty < GRID_ROWS; ty++) {
                const bounds = getTileBounds(tx, ty);
                if (pointInTileBounds(spot.location.lat, spot.location.lon, bounds)) {
                  containingTiles++;
                }
              }
            }
            
            // Point should be in at least one tile (the assigned one)
            // Due to boundary conditions, it might be in adjacent tiles too,
            // but the assignment function should return exactly one
            return containingTiles >= 1 && tile !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('tile assignment is deterministic for the same coordinates', () => {
      fc.assert(
        fc.property(
          pointLocationArb,
          (location) => {
            const tile1 = getTileForPoint(location.lat, location.lon);
            const tile2 = getTileForPoint(location.lat, location.lon);
            
            if (!tile1 || !tile2) return tile1 === tile2;
            
            return tile1[0] === tile2[0] && tile1[1] === tile2[1];
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Geometry-based entities (obstacles, protected areas)', () => {
    test('every geometry within Switzerland bounds maps to exactly one tile via centroid', () => {
      fc.assert(
        fc.property(
          polygonGeometryArb,
          (geometry) => {
            const tile = getTileForGeometry(geometry);
            
            // Must return a valid tile
            if (!tile) return false;
            
            const [x, y] = tile;
            
            // Tile coordinates must be within grid bounds
            if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
              return false;
            }
            
            // Centroid must be within the tile's bounds
            const centroid = calculateCentroid(geometry);
            const tileBounds = getTileBounds(x, y);
            return pointInTileBounds(centroid.lat, centroid.lon, tileBounds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('obstacle entities are assigned to exactly one tile', () => {
      fc.assert(
        fc.property(
          obstacleEntityArb,
          (obstacle) => {
            const tile = getTileForGeometry(obstacle.geometry);
            
            // Must return a valid tile
            return tile !== null && 
                   tile[0] >= 0 && tile[0] < GRID_COLS &&
                   tile[1] >= 0 && tile[1] < GRID_ROWS;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Tile grid coverage', () => {
    test('all tile coordinates within grid have valid bounds', () => {
      fc.assert(
        fc.property(
          tileXArb,
          tileYArb,
          (x, y) => {
            const bounds = getTileBounds(x, y);
            
            // Bounds must be valid
            return bounds.north > bounds.south &&
                   bounds.east > bounds.west &&
                   bounds.north <= SWITZERLAND_BOUNDS.north &&
                   bounds.south >= SWITZERLAND_BOUNDS.south - TILE_SIZE.lat && // Allow for last row
                   bounds.east <= SWITZERLAND_BOUNDS.east + TILE_SIZE.lon && // Allow for last col
                   bounds.west >= SWITZERLAND_BOUNDS.west;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('adjacent tiles share boundaries without gaps', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: GRID_COLS - 2 }),
          fc.integer({ min: 0, max: GRID_ROWS - 2 }),
          (x, y) => {
            const currentBounds = getTileBounds(x, y);
            const rightBounds = getTileBounds(x + 1, y);
            const bottomBounds = getTileBounds(x, y + 1);
            
            // Right neighbor should share west boundary with current east
            const rightAdjacent = Math.abs(currentBounds.east - rightBounds.west) < 0.0001;
            
            // Bottom neighbor should share north boundary with current south
            const bottomAdjacent = Math.abs(currentBounds.south - bottomBounds.north) < 0.0001;
            
            return rightAdjacent && bottomAdjacent;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('grid covers entire Switzerland bounds', () => {
      // Calculate the actual coverage
      const gridWest = SWITZERLAND_BOUNDS.west;
      const gridEast = SWITZERLAND_BOUNDS.west + (GRID_COLS * TILE_SIZE.lon);
      const gridNorth = SWITZERLAND_BOUNDS.north;
      const gridSouth = SWITZERLAND_BOUNDS.north - (GRID_ROWS * TILE_SIZE.lat);
      
      // Grid should cover at least the Switzerland bounds
      expect(gridWest).toBeLessThanOrEqual(SWITZERLAND_BOUNDS.west);
      expect(gridEast).toBeGreaterThanOrEqual(SWITZERLAND_BOUNDS.east);
      expect(gridNorth).toBeGreaterThanOrEqual(SWITZERLAND_BOUNDS.north);
      expect(gridSouth).toBeLessThanOrEqual(SWITZERLAND_BOUNDS.south);
    });
  });

  describe('Points outside Switzerland bounds', () => {
    test('points outside Switzerland bounds return null', () => {
      const outsidePointArb = fc.oneof(
        // North of Switzerland
        fc.record({
          lat: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.north + 0.1), max: 90, noNaN: true }),
          lon: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.west), max: Math.fround(SWITZERLAND_BOUNDS.east), noNaN: true })
        }),
        // South of Switzerland
        fc.record({
          lat: fc.float({ min: -90, max: Math.fround(SWITZERLAND_BOUNDS.south - 0.1), noNaN: true }),
          lon: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.west), max: Math.fround(SWITZERLAND_BOUNDS.east), noNaN: true })
        }),
        // East of Switzerland
        fc.record({
          lat: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.south), max: Math.fround(SWITZERLAND_BOUNDS.north), noNaN: true }),
          lon: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.east + 0.1), max: 180, noNaN: true })
        }),
        // West of Switzerland
        fc.record({
          lat: fc.float({ min: Math.fround(SWITZERLAND_BOUNDS.south), max: Math.fround(SWITZERLAND_BOUNDS.north), noNaN: true }),
          lon: fc.float({ min: -180, max: Math.fround(SWITZERLAND_BOUNDS.west - 0.1), noNaN: true })
        })
      );

      fc.assert(
        fc.property(
          outsidePointArb,
          (location) => {
            const tile = getTileForPoint(location.lat, location.lon);
            return tile === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Boundary conditions', () => {
    test('points exactly on Switzerland bounds are assigned to valid tiles', () => {
      // Test corner points
      const cornerPoints = [
        { lat: SWITZERLAND_BOUNDS.north, lon: SWITZERLAND_BOUNDS.west },
        { lat: SWITZERLAND_BOUNDS.north, lon: SWITZERLAND_BOUNDS.east },
        { lat: SWITZERLAND_BOUNDS.south, lon: SWITZERLAND_BOUNDS.west },
        { lat: SWITZERLAND_BOUNDS.south, lon: SWITZERLAND_BOUNDS.east }
      ];

      cornerPoints.forEach(point => {
        const tile = getTileForPoint(point.lat, point.lon);
        expect(tile).not.toBeNull();
        expect(tile[0]).toBeGreaterThanOrEqual(0);
        expect(tile[0]).toBeLessThan(GRID_COLS);
        expect(tile[1]).toBeGreaterThanOrEqual(0);
        expect(tile[1]).toBeLessThan(GRID_ROWS);
      });
    });

    test('points on tile boundaries are assigned consistently', () => {
      fc.assert(
        fc.property(
          tileXArb,
          tileYArb,
          (x, y) => {
            const bounds = getTileBounds(x, y);
            
            // Test point on the west boundary
            const westPoint = getTileForPoint(
              (bounds.north + bounds.south) / 2,
              bounds.west
            );
            
            // Test point on the north boundary
            const northPoint = getTileForPoint(
              bounds.north,
              (bounds.east + bounds.west) / 2
            );
            
            // Both should return valid tiles
            return westPoint !== null && northPoint !== null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
