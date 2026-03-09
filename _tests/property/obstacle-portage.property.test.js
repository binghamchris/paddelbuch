/**
 * Property-Based Tests for Obstacle Portage Route Conditional Rendering
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 8: Obstacle Portage Route Conditional Rendering**
 * **Validates: Requirements 5.2**
 * 
 * Property: For any obstacle with a portage route defined, the Map_System shall render
 * the portage route as a GeoJSON line layer. For obstacles without a portage route,
 * no portage line shall be rendered.
 */

const fc = require('fast-check');

/**
 * Simulates the rendering decision for an obstacle's portage route.
 * This mirrors the logic in layer-control.html's addObstacleLayer function.
 * 
 * @param {Object} obstacle - The obstacle data object
 * @returns {Object} Object containing rendering decisions
 */
function determinePortageRouteRendering(obstacle) {
  const result = {
    shouldRenderObstacle: false,
    shouldRenderPortageRoute: false,
    obstacleGeometry: null,
    portageRouteGeometry: null,
    error: null
  };

  // Check if obstacle has geometry
  if (!obstacle.geometry) {
    return result;
  }

  // Try to parse obstacle geometry
  try {
    const geoJson = typeof obstacle.geometry === 'string' 
      ? JSON.parse(obstacle.geometry) 
      : obstacle.geometry;
    
    result.shouldRenderObstacle = true;
    result.obstacleGeometry = geoJson;
  } catch (e) {
    result.error = 'Invalid obstacle geometry';
    return result;
  }

  // Check if portage route should be rendered (Requirement 5.2)
  if (obstacle.portageRoute) {
    try {
      const portageGeoJson = typeof obstacle.portageRoute === 'string' 
        ? JSON.parse(obstacle.portageRoute) 
        : obstacle.portageRoute;
      
      result.shouldRenderPortageRoute = true;
      result.portageRouteGeometry = portageGeoJson;
    } catch (e) {
      // Invalid portage route - don't render it but obstacle still renders
      result.shouldRenderPortageRoute = false;
    }
  }

  return result;
}

// Valid GeoJSON polygon for obstacle geometry
const validPolygonGeoJson = {
  type: 'Polygon',
  coordinates: [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]]
};

// Valid GeoJSON line for portage route
const validLineGeoJson = {
  type: 'LineString',
  coordinates: [[8.0, 47.0], [8.05, 47.05], [8.1, 47.1]]
};

// Arbitraries for generating test data
const validPolygonArb = fc.constant(validPolygonGeoJson);
const validLineArb = fc.constant(validLineGeoJson);

const validPolygonStringArb = fc.constant(JSON.stringify(validPolygonGeoJson));
const validLineStringArb = fc.constant(JSON.stringify(validLineGeoJson));

// Invalid JSON strings that will fail JSON.parse()
const invalidJsonArb = fc.oneof(
  fc.constant('not valid json'),
  fc.constant('{invalid}'),
  fc.constant('')
);

// Obstacle with portage route
const obstacleWithPortageArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.oneof(validPolygonArb, validPolygonStringArb),
  portageRoute: fc.oneof(validLineArb, validLineStringArb),
  isPortagePossible: fc.boolean(),
  isPortageNecessary: fc.boolean()
});

// Obstacle without portage route
const obstacleWithoutPortageArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.oneof(validPolygonArb, validPolygonStringArb),
  portageRoute: fc.constant(null),
  isPortagePossible: fc.boolean(),
  isPortageNecessary: fc.boolean()
});

// Obstacle with undefined portage route
const obstacleWithUndefinedPortageArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.oneof(validPolygonArb, validPolygonStringArb),
  isPortagePossible: fc.boolean(),
  isPortageNecessary: fc.boolean()
});

// Obstacle with invalid (unparseable) portage route JSON
const obstacleWithInvalidPortageArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.oneof(validPolygonArb, validPolygonStringArb),
  portageRoute: invalidJsonArb,
  isPortagePossible: fc.boolean(),
  isPortageNecessary: fc.boolean()
});

describe('Obstacle Portage Route Conditional Rendering - Property 8', () => {
  /**
   * Property 8: Obstacle Portage Route Conditional Rendering
   * For any obstacle with a portage route defined, the Map_System shall render
   * the portage route as a GeoJSON line layer. For obstacles without a portage route,
   * no portage line shall be rendered.
   */

  describe('Obstacles with valid portage routes', () => {
    test('portage route is rendered when obstacle has valid portageRoute', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            // Both obstacle and portage route should be rendered
            return result.shouldRenderObstacle === true && 
                   result.shouldRenderPortageRoute === true &&
                   result.portageRouteGeometry !== null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage route geometry is preserved correctly', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            if (result.shouldRenderPortageRoute) {
              // The geometry should be a valid GeoJSON object
              return result.portageRouteGeometry !== null &&
                     typeof result.portageRouteGeometry === 'object' &&
                     result.portageRouteGeometry.type !== undefined;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Obstacles without portage routes', () => {
    test('no portage route is rendered when portageRoute is null', () => {
      fc.assert(
        fc.property(
          obstacleWithoutPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            // Obstacle should render but portage route should not
            return result.shouldRenderObstacle === true && 
                   result.shouldRenderPortageRoute === false &&
                   result.portageRouteGeometry === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no portage route is rendered when portageRoute is undefined', () => {
      fc.assert(
        fc.property(
          obstacleWithUndefinedPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            // Obstacle should render but portage route should not
            return result.shouldRenderObstacle === true && 
                   result.shouldRenderPortageRoute === false &&
                   result.portageRouteGeometry === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Obstacles with unparseable portage route JSON', () => {
    test('unparseable portage route JSON does not prevent obstacle rendering', () => {
      fc.assert(
        fc.property(
          obstacleWithInvalidPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            // Obstacle should still render even if portage route JSON is unparseable
            return result.shouldRenderObstacle === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('unparseable portage route JSON is not rendered', () => {
      fc.assert(
        fc.property(
          obstacleWithInvalidPortageArb,
          (obstacle) => {
            const result = determinePortageRouteRendering(obstacle);
            
            // Portage route should not be rendered if JSON is unparseable
            return result.shouldRenderPortageRoute === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Obstacles without geometry', () => {
    test('obstacle without geometry does not render anything', () => {
      const obstacleWithoutGeometry = {
        slug: 'test-obstacle',
        name: 'Test Obstacle',
        portageRoute: validLineGeoJson
      };
      
      const result = determinePortageRouteRendering(obstacleWithoutGeometry);
      
      expect(result.shouldRenderObstacle).toBe(false);
      expect(result.shouldRenderPortageRoute).toBe(false);
    });
  });

  describe('Rendering decision is deterministic', () => {
    test('same obstacle always produces same rendering decision', () => {
      fc.assert(
        fc.property(
          fc.oneof(obstacleWithPortageArb, obstacleWithoutPortageArb),
          (obstacle) => {
            const result1 = determinePortageRouteRendering(obstacle);
            const result2 = determinePortageRouteRendering(obstacle);
            
            return result1.shouldRenderObstacle === result2.shouldRenderObstacle &&
                   result1.shouldRenderPortageRoute === result2.shouldRenderPortageRoute;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Portage route presence is the sole determinant', () => {
    test('isPortagePossible does not affect portage route rendering', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (hasPortageRoute, isPortagePossible) => {
            const obstacle = {
              slug: 'test-obstacle',
              name: 'Test Obstacle',
              geometry: validPolygonGeoJson,
              portageRoute: hasPortageRoute ? validLineGeoJson : null,
              isPortagePossible: isPortagePossible
            };
            
            const result = determinePortageRouteRendering(obstacle);
            
            // Portage route rendering depends only on portageRoute presence
            return result.shouldRenderPortageRoute === hasPortageRoute;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('isPortageNecessary does not affect portage route rendering', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          (hasPortageRoute, isPortageNecessary) => {
            const obstacle = {
              slug: 'test-obstacle',
              name: 'Test Obstacle',
              geometry: validPolygonGeoJson,
              portageRoute: hasPortageRoute ? validLineGeoJson : null,
              isPortageNecessary: isPortageNecessary
            };
            
            const result = determinePortageRouteRendering(obstacle);
            
            // Portage route rendering depends only on portageRoute presence
            return result.shouldRenderPortageRoute === hasPortageRoute;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
