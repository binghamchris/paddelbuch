/**
 * Unit Tests for GeoJSON Parsing and Validation
 * 
 * Tests GeoJSON parsing patterns used throughout the Paddel Buch application.
 * The application uses JSON.parse() to convert GeoJSON strings from Contentful
 * and passes them to Leaflet's L.geoJSON() for rendering.
 * 
 * Requirements: Testing Strategy - Test GeoJSON parsing
 */

describe('GeoJSON Parsing', () => {
  describe('Valid GeoJSON Structures', () => {
    test('parses valid Point geometry', () => {
      const geoJsonString = JSON.stringify({
        type: 'Point',
        coordinates: [8.0, 47.0]
      });
      
      const parsed = JSON.parse(geoJsonString);
      expect(parsed.type).toBe('Point');
      expect(parsed.coordinates).toEqual([8.0, 47.0]);
    });

    test('parses valid Polygon geometry', () => {
      const geoJsonString = JSON.stringify({
        type: 'Polygon',
        coordinates: [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]]
      });
      
      const parsed = JSON.parse(geoJsonString);
      expect(parsed.type).toBe('Polygon');
      expect(parsed.coordinates[0].length).toBe(5);
      // First and last coordinates should be the same (closed polygon)
      expect(parsed.coordinates[0][0]).toEqual(parsed.coordinates[0][4]);
    });

    test('parses valid LineString geometry', () => {
      const geoJsonString = JSON.stringify({
        type: 'LineString',
        coordinates: [[8.0, 47.0], [8.05, 47.05], [8.1, 47.1]]
      });
      
      const parsed = JSON.parse(geoJsonString);
      expect(parsed.type).toBe('LineString');
      expect(parsed.coordinates.length).toBe(3);
    });

    test('parses valid MultiPolygon geometry', () => {
      const geoJsonString = JSON.stringify({
        type: 'MultiPolygon',
        coordinates: [
          [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]],
          [[[9.0, 46.0], [9.1, 46.0], [9.1, 46.1], [9.0, 46.1], [9.0, 46.0]]]
        ]
      });
      
      const parsed = JSON.parse(geoJsonString);
      expect(parsed.type).toBe('MultiPolygon');
      expect(parsed.coordinates.length).toBe(2);
    });
  });

  describe('Invalid GeoJSON Handling', () => {
    test('throws error for invalid JSON string', () => {
      expect(() => JSON.parse('not valid json')).toThrow();
    });

    test('throws error for empty string', () => {
      expect(() => JSON.parse('')).toThrow();
    });

    test('parses null as null', () => {
      expect(JSON.parse('null')).toBeNull();
    });
  });


  describe('GeoJSON Coordinate Validation', () => {
    /**
     * Validates that coordinates are within valid ranges
     * Longitude: -180 to 180
     * Latitude: -90 to 90
     */
    function isValidCoordinate(coord) {
      if (!Array.isArray(coord) || coord.length < 2) return false;
      const [lon, lat] = coord;
      return typeof lon === 'number' && typeof lat === 'number' &&
             lon >= -180 && lon <= 180 &&
             lat >= -90 && lat <= 90;
    }

    /**
     * Validates that coordinates are within Switzerland bounds
     */
    function isSwissCoordinate(coord) {
      if (!Array.isArray(coord) || coord.length < 2) return false;
      const [lon, lat] = coord;
      return lon >= 5.9 && lon <= 10.5 &&
             lat >= 45.8 && lat <= 47.8;
    }

    test('validates coordinates within global bounds', () => {
      expect(isValidCoordinate([8.0, 47.0])).toBe(true);
      expect(isValidCoordinate([0, 0])).toBe(true);
      expect(isValidCoordinate([-180, -90])).toBe(true);
      expect(isValidCoordinate([180, 90])).toBe(true);
    });

    test('rejects coordinates outside global bounds', () => {
      expect(isValidCoordinate([181, 0])).toBe(false);
      expect(isValidCoordinate([0, 91])).toBe(false);
      expect(isValidCoordinate([-181, 0])).toBe(false);
      expect(isValidCoordinate([0, -91])).toBe(false);
    });

    test('rejects invalid coordinate formats', () => {
      expect(isValidCoordinate(null)).toBe(false);
      expect(isValidCoordinate([])).toBe(false);
      expect(isValidCoordinate([8.0])).toBe(false);
      expect(isValidCoordinate(['a', 'b'])).toBe(false);
    });

    test('validates Swiss coordinates', () => {
      // Bern
      expect(isSwissCoordinate([7.4474, 46.9480])).toBe(true);
      // Zurich
      expect(isSwissCoordinate([8.5417, 47.3769])).toBe(true);
      // Geneva
      expect(isSwissCoordinate([6.1432, 46.2044])).toBe(true);
    });

    test('rejects non-Swiss coordinates', () => {
      // Paris
      expect(isSwissCoordinate([2.3522, 48.8566])).toBe(false);
      // Munich
      expect(isSwissCoordinate([11.5820, 48.1351])).toBe(false);
    });
  });

  describe('GeoJSON Bounds Calculation', () => {
    /**
     * Calculates bounds from a GeoJSON geometry
     * Returns { north, south, east, west } or null if invalid
     */
    function calculateBounds(geometry) {
      if (!geometry || !geometry.coordinates) return null;

      let coords = [];
      
      // Extract all coordinates based on geometry type
      switch (geometry.type) {
        case 'Point':
          coords = [geometry.coordinates];
          break;
        case 'LineString':
          coords = geometry.coordinates;
          break;
        case 'Polygon':
          coords = geometry.coordinates[0] || [];
          break;
        case 'MultiPolygon':
          geometry.coordinates.forEach(polygon => {
            coords = coords.concat(polygon[0] || []);
          });
          break;
        default:
          return null;
      }

      if (coords.length === 0) return null;

      let north = -Infinity, south = Infinity;
      let east = -Infinity, west = Infinity;

      coords.forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const [lon, lat] = coord;
          if (typeof lon === 'number' && typeof lat === 'number') {
            north = Math.max(north, lat);
            south = Math.min(south, lat);
            east = Math.max(east, lon);
            west = Math.min(west, lon);
          }
        }
      });

      if (north === -Infinity) return null;

      return { north, south, east, west };
    }

    test('calculates bounds for Point', () => {
      const geometry = { type: 'Point', coordinates: [8.0, 47.0] };
      const bounds = calculateBounds(geometry);
      expect(bounds).toEqual({ north: 47.0, south: 47.0, east: 8.0, west: 8.0 });
    });

    test('calculates bounds for Polygon', () => {
      const geometry = {
        type: 'Polygon',
        coordinates: [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]]
      };
      const bounds = calculateBounds(geometry);
      expect(bounds.north).toBe(47.1);
      expect(bounds.south).toBe(47.0);
      expect(bounds.east).toBe(8.1);
      expect(bounds.west).toBe(8.0);
    });

    test('calculates bounds for LineString', () => {
      const geometry = {
        type: 'LineString',
        coordinates: [[8.0, 47.0], [8.5, 47.5], [9.0, 47.0]]
      };
      const bounds = calculateBounds(geometry);
      expect(bounds.north).toBe(47.5);
      expect(bounds.south).toBe(47.0);
      expect(bounds.east).toBe(9.0);
      expect(bounds.west).toBe(8.0);
    });

    test('returns null for invalid geometry', () => {
      expect(calculateBounds(null)).toBeNull();
      expect(calculateBounds({})).toBeNull();
      expect(calculateBounds({ type: 'Unknown' })).toBeNull();
    });
  });
});
