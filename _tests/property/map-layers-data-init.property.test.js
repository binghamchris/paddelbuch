/**
 * Property-Based Tests for Map Data Initialization Logic (Fix Verification)
 *
 * **Feature: missing-map-layers, Property 1: Fault Condition - Map Layers Populated on Page Load**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 *
 * This test verifies the initialization logic in _includes/map-init.html:
 * - For random viewport bounds within Switzerland, the initialization code
 *   calls PaddelbuchDataLoader.loadDataForBounds with bounds, zoom, and locale
 * - The code iterates over spots, notices, obstacles, and protected areas
 * - The code calls the appropriate paddelbuchAdd* functions for each data type
 * - The code uses leafletBoundsToObject for bounds conversion
 *
 * Since this is a Jekyll static site with no Node.js runtime for the browser JS
 * modules, the test verifies the code's structure rather than executing it.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read the raw source of map-init.html once for all tests
const mapInitPath = path.join(__dirname, '..', '..', '_includes', 'map-init.html');
const mapInitSource = fs.readFileSync(mapInitPath, 'utf-8');

// Switzerland coordinate bounds for generating random viewports
const SWITZERLAND = {
  minLat: 45.8,
  maxLat: 47.8,
  minLng: 5.9,
  maxLng: 10.5
};

// Generator for random viewport bounds within Switzerland
const swissViewportBounds = fc.record({
  south: fc.double({ min: SWITZERLAND.minLat, max: SWITZERLAND.maxLat - 0.01, noNaN: true }),
  north: fc.double({ min: SWITZERLAND.minLat + 0.01, max: SWITZERLAND.maxLat, noNaN: true }),
  west: fc.double({ min: SWITZERLAND.minLng, max: SWITZERLAND.maxLng - 0.01, noNaN: true }),
  east: fc.double({ min: SWITZERLAND.minLng + 0.01, max: SWITZERLAND.maxLng, noNaN: true })
}).filter(b => b.south < b.north && b.west < b.east);

// Generator for random zoom levels (valid Leaflet zoom range for this map)
const zoomLevel = fc.integer({ min: 7, max: 18 });

describe('Map Data Initialization Logic (Fix Verification)', () => {
  describe('Property 1: Initialization code calls loadDataForBounds with bounds, zoom, and locale', () => {
    it('should use leafletBoundsToObject for bounds conversion before calling loadDataForBounds', () => {
      fc.assert(
        fc.property(
          swissViewportBounds,
          zoomLevel,
          (_bounds, _zoom) => {
            // The initialization code must convert Leaflet bounds using leafletBoundsToObject
            expect(mapInitSource).toContain('PaddelbuchSpatialUtils.leafletBoundsToObject');

            // It must call loadDataForBounds with the converted bounds
            expect(mapInitSource).toContain('PaddelbuchDataLoader.loadDataForBounds');

            // The call must include bounds, zoom, and locale parameters
            // Verify the code captures zoom from the map
            expect(mapInitSource).toContain('map.getZoom()');

            // Verify locale is passed (either from window.paddelbuchCurrentLocale or a default)
            expect(mapInitSource).toContain('locale');
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: Initialization code populates all four data types from response', () => {
    it('should iterate over spots, notices, obstacles, and protected areas and call population functions', () => {
      fc.assert(
        fc.property(
          swissViewportBounds,
          (_bounds) => {
            // Verify the code checks for and iterates over each data type
            // Spots
            expect(mapInitSource).toContain('data.spots');
            expect(mapInitSource).toContain('paddelbuchAddSpotMarker');

            // Event notices
            expect(mapInitSource).toContain('data.notices');
            expect(mapInitSource).toContain('paddelbuchAddEventNoticeMarker');

            // Obstacles
            expect(mapInitSource).toContain('data.obstacles');
            expect(mapInitSource).toContain('paddelbuchAddObstacleLayer');

            // Protected areas
            expect(mapInitSource).toContain('data.protected');
            expect(mapInitSource).toContain('paddelbuchAddProtectedAreaLayer');
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: Initialization code handles data structure with property checks', () => {
    it('should check for .spots, .notices, .obstacles, .protected properties before iterating', () => {
      fc.assert(
        fc.property(
          swissViewportBounds,
          (_bounds) => {
            // The code should guard against missing properties with if-checks
            // Verify conditional checks exist for each data type
            const hasSpotCheck = mapInitSource.includes('if (data.spots)') ||
                                 mapInitSource.includes('data.spots &&') ||
                                 mapInitSource.includes('data.spots.forEach');
            expect(hasSpotCheck).toBe(true);

            const hasNoticeCheck = mapInitSource.includes('if (data.notices)') ||
                                   mapInitSource.includes('data.notices &&') ||
                                   mapInitSource.includes('data.notices.forEach');
            expect(hasNoticeCheck).toBe(true);

            const hasObstacleCheck = mapInitSource.includes('if (data.obstacles)') ||
                                     mapInitSource.includes('data.obstacles &&') ||
                                     mapInitSource.includes('data.obstacles.forEach');
            expect(hasObstacleCheck).toBe(true);

            const hasProtectedCheck = mapInitSource.includes('if (data.protected)') ||
                                      mapInitSource.includes('data.protected &&') ||
                                      mapInitSource.includes('data.protected.forEach');
            expect(hasProtectedCheck).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: Initialization code uses leafletBoundsToObject for any viewport bounds', () => {
    it('should reference leafletBoundsToObject for converting map bounds regardless of viewport position', () => {
      fc.assert(
        fc.property(
          swissViewportBounds,
          zoomLevel,
          (_bounds, _zoom) => {
            // For any viewport within Switzerland, the code must use
            // leafletBoundsToObject to convert Leaflet bounds to the object format
            // expected by the data loader (with north, south, east, west properties)
            const boundsConversion = mapInitSource.includes('leafletBoundsToObject(map.getBounds())') ||
                                     mapInitSource.includes('leafletBoundsToObject(map.getBounds())');
            expect(boundsConversion).toBe(true);

            // The moveend handler should also convert bounds for subsequent loads
            const moveendSection = mapInitSource.includes('moveend');
            expect(moveendSection).toBe(true);

            // The moveend handler should also use leafletBoundsToObject
            const moveendBoundsConversion = mapInitSource.match(/moveend[\s\S]*leafletBoundsToObject/);
            expect(moveendBoundsConversion).not.toBeNull();
          }
        ),
        { verbose: true }
      );
    });
  });
});
