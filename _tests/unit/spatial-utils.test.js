/**
 * Unit Tests for Spatial Utilities Module
 *
 * Tests coordinate validation and spatial calculations for the Paddel Buch application.
 * Requirements: 14.1, 14.2 - Viewport-based data loading
 *
 * Exercises the real shipping module (assets/js/spatial-utils.js) via require() (it has
 * a Dual_Export), so these tests cannot drift from the implementation. In Node there is
 * no #paddelbuch-geo-constants element, so the module uses its built-in default
 * Switzerland bounds / tile size (which match _config.yml).
 */

const {
  SWITZERLAND_BOUNDS,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  pointInSwitzerlandBounds,
  pointInBounds,
  boundsToTileCoords,
  tileCoordsToBounds,
  expandBounds,
  boundsIntersect,
  getTileKey
} = require('../../assets/js/spatial-utils.js');

describe('Spatial Utilities', () => {
  describe('Constants', () => {
    test('Switzerland bounds are defined correctly', () => {
      expect(SWITZERLAND_BOUNDS).toEqual({
        north: 47.8,
        south: 45.8,
        east: 10.5,
        west: 5.9
      });
    });

    test('Tile size is defined', () => {
      expect(TILE_SIZE.lat).toBe(0.25);
      expect(TILE_SIZE.lon).toBe(0.46);
    });

    test('Grid dimensions are calculated', () => {
      expect(GRID_COLS).toBeGreaterThan(0);
      expect(GRID_ROWS).toBeGreaterThan(0);
    });
  });

  describe('pointInSwitzerlandBounds', () => {
    test('returns true for point inside Switzerland', () => {
      expect(pointInSwitzerlandBounds(46.9480, 7.4474)).toBe(true);
    });

    test('returns true for point at Switzerland center', () => {
      expect(pointInSwitzerlandBounds(46.8, 8.2)).toBe(true);
    });

    test('returns false for point north of Switzerland', () => {
      expect(pointInSwitzerlandBounds(48.0, 8.0)).toBe(false);
    });

    test('returns false for point south of Switzerland', () => {
      expect(pointInSwitzerlandBounds(45.0, 8.0)).toBe(false);
    });

    test('returns false for point east of Switzerland', () => {
      expect(pointInSwitzerlandBounds(46.8, 11.0)).toBe(false);
    });

    test('returns false for point west of Switzerland', () => {
      expect(pointInSwitzerlandBounds(46.8, 5.0)).toBe(false);
    });

    test('returns true for point on boundary', () => {
      expect(pointInSwitzerlandBounds(47.8, 10.5)).toBe(true);
      expect(pointInSwitzerlandBounds(45.8, 5.9)).toBe(true);
    });
  });

  describe('pointInBounds', () => {
    const testBounds = { north: 47.0, south: 46.0, east: 8.0, west: 7.0 };

    test('returns true for point inside bounds', () => {
      expect(pointInBounds({ lat: 46.5, lon: 7.5 }, testBounds)).toBe(true);
    });

    test('returns true for point on boundary', () => {
      expect(pointInBounds({ lat: 47.0, lon: 8.0 }, testBounds)).toBe(true);
    });

    test('returns false for point outside bounds', () => {
      expect(pointInBounds({ lat: 48.0, lon: 7.5 }, testBounds)).toBe(false);
    });

    test('returns false for invalid point', () => {
      expect(pointInBounds(null, testBounds)).toBe(false);
      expect(pointInBounds({}, testBounds)).toBe(false);
      expect(pointInBounds({ lat: 'invalid' }, testBounds)).toBe(false);
    });

    test('returns false for invalid bounds', () => {
      expect(pointInBounds({ lat: 46.5, lon: 7.5 }, null)).toBe(false);
      expect(pointInBounds({ lat: 46.5, lon: 7.5 }, {})).toBe(false);
    });
  });

  describe('boundsToTileCoords', () => {
    test('returns tiles for bounds within Switzerland', () => {
      const bounds = { north: 47.0, south: 46.5, east: 7.5, west: 7.0 };
      const tiles = boundsToTileCoords(bounds);
      expect(Array.isArray(tiles)).toBe(true);
      expect(tiles.length).toBeGreaterThan(0);
      tiles.forEach(tile => {
        expect(tile).toHaveProperty('x');
        expect(tile).toHaveProperty('y');
        expect(typeof tile.x).toBe('number');
        expect(typeof tile.y).toBe('number');
      });
    });

    test('returns empty array for bounds outside Switzerland', () => {
      const bounds = { north: 50.0, south: 49.0, east: 12.0, west: 11.0 };
      const tiles = boundsToTileCoords(bounds);
      expect(tiles).toEqual([]);
    });

    test('returns empty array for invalid bounds', () => {
      expect(boundsToTileCoords(null)).toEqual([]);
      expect(boundsToTileCoords({})).toEqual([]);
      expect(boundsToTileCoords({ north: 'invalid' })).toEqual([]);
    });

    test('clamps bounds to Switzerland', () => {
      const bounds = { north: 50.0, south: 45.0, east: 12.0, west: 4.0 };
      const tiles = boundsToTileCoords(bounds);
      expect(tiles.length).toBeGreaterThan(0);
    });
  });

  describe('tileCoordsToBounds', () => {
    test('returns bounds for valid tile coordinates', () => {
      const bounds = tileCoordsToBounds(0, 0);
      expect(bounds).not.toBeNull();
      expect(bounds).toHaveProperty('north');
      expect(bounds).toHaveProperty('south');
      expect(bounds).toHaveProperty('east');
      expect(bounds).toHaveProperty('west');
    });

    test('returns null for negative coordinates', () => {
      expect(tileCoordsToBounds(-1, 0)).toBeNull();
      expect(tileCoordsToBounds(0, -1)).toBeNull();
    });

    test('returns null for coordinates beyond grid', () => {
      expect(tileCoordsToBounds(100, 0)).toBeNull();
      expect(tileCoordsToBounds(0, 100)).toBeNull();
    });

    test('returns null for non-numeric coordinates', () => {
      expect(tileCoordsToBounds('a', 0)).toBeNull();
      expect(tileCoordsToBounds(0, 'b')).toBeNull();
    });
  });

  describe('expandBounds', () => {
    const testBounds = { north: 47.0, south: 46.0, east: 8.0, west: 7.0 };

    test('expands bounds by default factor', () => {
      const expanded = expandBounds(testBounds);
      expect(expanded.north).toBeGreaterThan(testBounds.north);
      expect(expanded.south).toBeLessThan(testBounds.south);
      expect(expanded.east).toBeGreaterThan(testBounds.east);
      expect(expanded.west).toBeLessThan(testBounds.west);
    });

    test('expands bounds by specified factor', () => {
      const expanded = expandBounds(testBounds, 0.5);
      const latRange = testBounds.north - testBounds.south;
      const expectedExpansion = latRange * 0.5;
      expect(expanded.north).toBeCloseTo(testBounds.north + expectedExpansion, 5);
    });

    test('returns null for invalid bounds', () => {
      expect(expandBounds(null)).toBeNull();
      expect(expandBounds({})).toBeNull();
    });
  });

  describe('boundsIntersect', () => {
    const bounds1 = { north: 47.0, south: 46.0, east: 8.0, west: 7.0 };

    test('returns true for overlapping bounds', () => {
      const bounds2 = { north: 46.5, south: 45.5, east: 7.5, west: 6.5 };
      expect(boundsIntersect(bounds1, bounds2)).toBe(true);
    });

    test('returns true for contained bounds', () => {
      const bounds2 = { north: 46.8, south: 46.2, east: 7.8, west: 7.2 };
      expect(boundsIntersect(bounds1, bounds2)).toBe(true);
    });

    test('returns false for non-overlapping bounds', () => {
      const bounds2 = { north: 45.0, south: 44.0, east: 6.0, west: 5.0 };
      expect(boundsIntersect(bounds1, bounds2)).toBe(false);
    });

    test('returns false for null bounds', () => {
      expect(boundsIntersect(null, bounds1)).toBe(false);
      expect(boundsIntersect(bounds1, null)).toBe(false);
    });
  });

  describe('getTileKey', () => {
    test('generates correct cache key', () => {
      const key = getTileKey('spots', 1, 2, 'de');
      expect(key).toBe('spots-1-2-de');
    });

    test('generates unique keys for different parameters', () => {
      const key1 = getTileKey('spots', 1, 2, 'de');
      const key2 = getTileKey('spots', 1, 2, 'en');
      const key3 = getTileKey('obstacles', 1, 2, 'de');
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });
});
