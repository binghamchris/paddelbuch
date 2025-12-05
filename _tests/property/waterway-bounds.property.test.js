/**
 * Property-Based Tests for Waterway Detail Map Bounds
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 7: Waterway Detail Map Bounds**
 * **Validates: Requirements 4.6**
 * 
 * Property: For any waterway with a geometry, the detail page map bounds shall be 
 * calculated from the waterway's GeoJSON geometry.
 */

const fc = require('fast-check');

/**
 * Calculate bounds from a GeoJSON geometry
 * This mirrors the logic used in the waterway detail layout
 * 
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {Object|null} Bounds object with north, south, east, west or null if invalid
 */
function calculateBoundsFromGeometry(geometry) {
  if (!geometry || !geometry.type) {
    return null;
  }

  let coordinates = [];

  // Extract all coordinates from the geometry
  switch (geometry.type) {
    case 'Point':
      coordinates = [geometry.coordinates];
      break;
    case 'LineString':
    case 'MultiPoint':
      coordinates = geometry.coordinates;
      break;
    case 'Polygon':
    case 'MultiLineString':
      coordinates = geometry.coordinates.flat();
      break;
    case 'MultiPolygon':
      coordinates = geometry.coordinates.flat(2);
      break;
    case 'GeometryCollection':
      if (geometry.geometries) {
        for (const geom of geometry.geometries) {
          const subBounds = calculateBoundsFromGeometry(geom);
          if (subBounds) {
            // Merge bounds
            coordinates.push([subBounds.west, subBounds.south]);
            coordinates.push([subBounds.east, subBounds.north]);
          }
        }
      }
      break;
    default:
      return null;
  }

  if (coordinates.length === 0) {
    return null;
  }

  // Calculate bounds from coordinates [lon, lat]
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const coord of coordinates) {
    if (Array.isArray(coord) && coord.length >= 2) {
      const [lon, lat] = coord;
      if (typeof lon === 'number' && typeof lat === 'number' && 
          !isNaN(lon) && !isNaN(lat)) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  if (minLon === Infinity || maxLon === -Infinity || 
      minLat === Infinity || maxLat === -Infinity) {
    return null;
  }

  return {
    north: maxLat,
    south: minLat,
    east: maxLon,
    west: minLon
  };
}

/**
 * Check if a point is within bounds
 * 
 * @param {Array} coord - [lon, lat] coordinate
 * @param {Object} bounds - Bounds object with north, south, east, west
 * @returns {boolean} True if point is within bounds
 */
function isPointInBounds(coord, bounds) {
  if (!coord || !bounds || coord.length < 2) return false;
  const [lon, lat] = coord;
  return lat >= bounds.south && lat <= bounds.north &&
         lon >= bounds.west && lon <= bounds.east;
}

/**
 * Check if bounds are valid (non-empty and finite)
 * 
 * @param {Object} bounds - Bounds object
 * @returns {boolean} True if bounds are valid
 */
function areBoundsValid(bounds) {
  if (!bounds) return false;
  return typeof bounds.north === 'number' && isFinite(bounds.north) &&
         typeof bounds.south === 'number' && isFinite(bounds.south) &&
         typeof bounds.east === 'number' && isFinite(bounds.east) &&
         typeof bounds.west === 'number' && isFinite(bounds.west) &&
         bounds.north >= bounds.south &&
         bounds.east >= bounds.west;
}

// Arbitraries for generating test data

// Generate valid Swiss coordinates (approximately)
// Use Math.fround to ensure 32-bit float compatibility
const swissLonArb = fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true });
const swissLatArb = fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true });
const coordinateArb = fc.tuple(swissLonArb, swissLatArb);

// Generate a Point geometry
const pointGeometryArb = coordinateArb.map(coord => ({
  type: 'Point',
  coordinates: coord
}));

// Generate a LineString geometry (at least 2 points)
const lineStringGeometryArb = fc.array(coordinateArb, { minLength: 2, maxLength: 20 })
  .map(coords => ({
    type: 'LineString',
    coordinates: coords
  }));

// Generate a Polygon geometry (closed ring with at least 4 points)
const polygonRingArb = fc.array(coordinateArb, { minLength: 3, maxLength: 15 })
  .map(coords => {
    // Close the ring by adding the first point at the end
    return [...coords, coords[0]];
  });

const polygonGeometryArb = polygonRingArb.map(ring => ({
  type: 'Polygon',
  coordinates: [ring]
}));

// Generate any valid geometry type
const geometryArb = fc.oneof(
  pointGeometryArb,
  lineStringGeometryArb,
  polygonGeometryArb
);

// Generate a waterway with geometry
const waterwayWithGeometryArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: fc.constantFrom('de', 'en'),
  geometry: geometryArb,
  paddlingEnvironmentType_slug: fc.constantFrom('see', 'fluss'),
  area: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }), { nil: undefined }),
  length: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }), { nil: undefined })
});

// Generate a waterway without geometry
const waterwayWithoutGeometryArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: fc.constantFrom('de', 'en'),
  geometry: fc.constant(null),
  paddlingEnvironmentType_slug: fc.constantFrom('see', 'fluss'),
  area: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(1000), noNaN: true }), { nil: undefined }),
  length: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }), { nil: undefined })
});

describe('Waterway Detail Map Bounds - Property 7', () => {
  /**
   * Property 7: Waterway Detail Map Bounds
   * 
   * For any waterway with a geometry, the detail page map bounds shall be 
   * calculated from the waterway's GeoJSON geometry.
   */

  describe('Bounds calculation from geometry', () => {
    test('bounds are calculated correctly for Point geometry', () => {
      fc.assert(
        fc.property(
          pointGeometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            
            if (!bounds) return false;
            
            // For a point, bounds should be exactly the point coordinates
            const [lon, lat] = geometry.coordinates;
            return bounds.north === lat && bounds.south === lat &&
                   bounds.east === lon && bounds.west === lon;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds are calculated correctly for LineString geometry', () => {
      fc.assert(
        fc.property(
          lineStringGeometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            
            if (!bounds) return false;
            
            // All coordinates should be within bounds
            return geometry.coordinates.every(coord => 
              isPointInBounds(coord, bounds)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds are calculated correctly for Polygon geometry', () => {
      fc.assert(
        fc.property(
          polygonGeometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            
            if (!bounds) return false;
            
            // All coordinates in the outer ring should be within bounds
            return geometry.coordinates[0].every(coord => 
              isPointInBounds(coord, bounds)
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds contain all geometry coordinates', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            
            if (!bounds) return false;
            
            // Extract all coordinates and verify they're within bounds
            let coordinates = [];
            switch (geometry.type) {
              case 'Point':
                coordinates = [geometry.coordinates];
                break;
              case 'LineString':
                coordinates = geometry.coordinates;
                break;
              case 'Polygon':
                coordinates = geometry.coordinates[0];
                break;
            }
            
            return coordinates.every(coord => isPointInBounds(coord, bounds));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds are tight (no unnecessary padding)', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            
            if (!bounds) return false;
            
            // Extract all coordinates
            let coordinates = [];
            switch (geometry.type) {
              case 'Point':
                coordinates = [geometry.coordinates];
                break;
              case 'LineString':
                coordinates = geometry.coordinates;
                break;
              case 'Polygon':
                coordinates = geometry.coordinates[0];
                break;
            }
            
            // At least one coordinate should touch each bound
            const touchesNorth = coordinates.some(c => c[1] === bounds.north);
            const touchesSouth = coordinates.some(c => c[1] === bounds.south);
            const touchesEast = coordinates.some(c => c[0] === bounds.east);
            const touchesWest = coordinates.some(c => c[0] === bounds.west);
            
            return touchesNorth && touchesSouth && touchesEast && touchesWest;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Bounds validity', () => {
    test('calculated bounds are always valid for valid geometries', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            return areBoundsValid(bounds);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds have north >= south', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            if (!bounds) return false;
            return bounds.north >= bounds.south;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bounds have east >= west', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds = calculateBoundsFromGeometry(geometry);
            if (!bounds) return false;
            return bounds.east >= bounds.west;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('null geometry returns null bounds', () => {
      const bounds = calculateBoundsFromGeometry(null);
      expect(bounds).toBeNull();
    });

    test('undefined geometry returns null bounds', () => {
      const bounds = calculateBoundsFromGeometry(undefined);
      expect(bounds).toBeNull();
    });

    test('empty geometry object returns null bounds', () => {
      const bounds = calculateBoundsFromGeometry({});
      expect(bounds).toBeNull();
    });

    test('geometry with invalid type returns null bounds', () => {
      const bounds = calculateBoundsFromGeometry({ type: 'InvalidType', coordinates: [] });
      expect(bounds).toBeNull();
    });

    test('waterway without geometry should not produce bounds', () => {
      fc.assert(
        fc.property(
          waterwayWithoutGeometryArb,
          (waterway) => {
            const bounds = calculateBoundsFromGeometry(waterway.geometry);
            return bounds === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Bounds calculation is deterministic', () => {
    test('same geometry always produces same bounds', () => {
      fc.assert(
        fc.property(
          geometryArb,
          (geometry) => {
            const bounds1 = calculateBoundsFromGeometry(geometry);
            const bounds2 = calculateBoundsFromGeometry(geometry);
            
            if (bounds1 === null && bounds2 === null) return true;
            if (bounds1 === null || bounds2 === null) return false;
            
            return bounds1.north === bounds2.north &&
                   bounds1.south === bounds2.south &&
                   bounds1.east === bounds2.east &&
                   bounds1.west === bounds2.west;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
