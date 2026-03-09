/**
 * Property-Based Tests for Obstacle Detail Page Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 10: Obstacle Detail Page Contains Required Information**
 * **Validates: Requirements 5.4**
 * 
 * Property: For any obstacle, the detail page shall display the obstacle type, GPS coordinates
 * (center of geometry), waterway link, and last updated timestamp. If description exists, it shall be displayed.
 */

const fc = require('fast-check');

/**
 * Localized strings for detail page content
 */
const strings = {
  de: {
    gps: 'GPS',
    waterway: 'Gewässer',
    portage_possible: 'Portage möglich',
    last_updated: 'Zuletzt aktualisiert',
    summary: 'Kurzfassung',
    yes: 'Ja',
    no: 'Nein',
    unknown: 'Unbekannt'
  },
  en: {
    gps: 'GPS',
    waterway: 'Waterway',
    portage_possible: 'Portage Possible',
    last_updated: 'Last Updated',
    summary: 'Summary',
    yes: 'Yes',
    no: 'No',
    unknown: 'Unknown'
  }
};

/**
 * Calculates the center point of a GeoJSON geometry.
 * This mirrors the logic that would be used to calculate centerLat/centerLon.
 * 
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {Object|null} Object with lat and lon, or null if invalid
 */
function calculateGeometryCenter(geometry) {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  let coords = [];
  
  // Extract all coordinates based on geometry type
  if (geometry.type === 'Point') {
    return { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
  } else if (geometry.type === 'Polygon') {
    // Use the first ring (exterior ring)
    coords = geometry.coordinates[0] || [];
  } else if (geometry.type === 'MultiPolygon') {
    // Flatten all exterior rings
    geometry.coordinates.forEach(polygon => {
      if (polygon[0]) {
        coords = coords.concat(polygon[0]);
      }
    });
  } else if (geometry.type === 'LineString') {
    coords = geometry.coordinates;
  }

  if (coords.length === 0) {
    return null;
  }

  // Calculate centroid
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
 * Generates the detail page content object for an obstacle.
 * This simulates what the obstacle-detail-content.html include would render.
 * 
 * @param {Object} obstacle - The obstacle data object
 * @param {Object} waterway - The waterway data object (optional)
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {Object} Object containing the detail page content fields
 */
function generateObstacleDetailContent(obstacle, waterway, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    hasObstacleType: false,
    hasGpsCoordinates: false,
    hasWaterwayLink: false,
    hasLastUpdated: false,
    hasDescription: false,
    hasPortageStatus: false,
    obstacleType: null,
    gpsCoordinates: null,
    waterwayName: null,
    waterwayUrl: null,
    lastUpdated: null,
    description: null,
    portageStatus: null
  };

  // Obstacle type (Requirement 5.4)
  if (obstacle.obstacleType_slug) {
    content.hasObstacleType = true;
    content.obstacleType = obstacle.obstacleType_slug;
  }

  // GPS coordinates - center of geometry (Requirement 5.4)
  if (obstacle.centerLat && obstacle.centerLon) {
    content.hasGpsCoordinates = true;
    content.gpsCoordinates = {
      lat: obstacle.centerLat,
      lon: obstacle.centerLon
    };
  } else if (obstacle.geometry) {
    // Calculate center from geometry if not pre-calculated
    const geometry = typeof obstacle.geometry === 'string' 
      ? JSON.parse(obstacle.geometry) 
      : obstacle.geometry;
    const center = calculateGeometryCenter(geometry);
    if (center) {
      content.hasGpsCoordinates = true;
      content.gpsCoordinates = center;
    }
  }

  // Waterway link (Requirement 5.4)
  if (waterway && waterway.slug && waterway.name) {
    content.hasWaterwayLink = true;
    content.waterwayName = waterway.name;
    content.waterwayUrl = `/gewaesser/${waterway.slug}/`;
  }

  // Last updated timestamp (Requirement 5.4)
  if (obstacle.updatedAt) {
    content.hasLastUpdated = true;
    content.lastUpdated = obstacle.updatedAt;
  }

  // Description (optional, shown if exists)
  if (obstacle.description && obstacle.description.trim().length > 0) {
    content.hasDescription = true;
    content.description = obstacle.description;
  }

  // Portage status (always shown)
  content.hasPortageStatus = true;
  if (obstacle.isPortagePossible === true) {
    content.portageStatus = localeStrings.yes;
  } else if (obstacle.isPortagePossible === false) {
    content.portageStatus = localeStrings.no;
  } else {
    content.portageStatus = localeStrings.unknown;
  }

  return content;
}

/**
 * Validates that an obstacle detail page contains all required information
 * 
 * @param {Object} obstacle - The obstacle data
 * @param {Object} waterway - The waterway data (optional)
 * @param {Object} detailContent - The generated detail content
 * @param {string} locale - The current locale
 * @returns {boolean} True if all required fields are present
 */
function validateDetailContent(obstacle, waterway, detailContent, locale) {
  // GPS coordinates must be present if obstacle has geometry or pre-calculated center
  if ((obstacle.centerLat && obstacle.centerLon) || obstacle.geometry) {
    if (!detailContent.hasGpsCoordinates) {
      return false;
    }
  }

  // Waterway link must be present if waterway exists
  if (waterway && waterway.slug && waterway.name) {
    if (!detailContent.hasWaterwayLink || 
        detailContent.waterwayName !== waterway.name ||
        !detailContent.waterwayUrl.includes(waterway.slug)) {
      return false;
    }
  }

  // Last updated must be present if obstacle has updatedAt
  if (obstacle.updatedAt) {
    if (!detailContent.hasLastUpdated) {
      return false;
    }
  }

  // Portage status must always be present
  if (!detailContent.hasPortageStatus) {
    return false;
  }

  return true;
}

// Valid GeoJSON polygon for obstacle geometry
const validPolygonGeoJson = {
  type: 'Polygon',
  coordinates: [[[8.0, 47.0], [8.1, 47.0], [8.1, 47.1], [8.0, 47.1], [8.0, 47.0]]]
};

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

const coordinateArb = fc.record({
  lat: fc.double({ min: 45.8, max: 47.8, noNaN: true }),
  lon: fc.double({ min: 5.9, max: 10.5, noNaN: true })
});

const geometryArb = fc.constant(validPolygonGeoJson);

const obstacleTypeSlugArb = fc.constantFrom(
  'wehr',
  'staustufe',
  'bruecke',
  'fels',
  'stromschnelle'
);

const waterwayArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

const dateStringArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  .map(d => d.toISOString());

const portageStatusArb = fc.oneof(
  fc.constant(true),
  fc.constant(false),
  fc.constant(null),
  fc.constant(undefined)
);

// Full obstacle with all fields
const obstacleArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  obstacleType_slug: obstacleTypeSlugArb,
  geometry: geometryArb,
  centerLat: fc.double({ min: 45.8, max: 47.8, noNaN: true }),
  centerLon: fc.double({ min: 5.9, max: 10.5, noNaN: true }),
  waterway_slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 500 }),
  updatedAt: dateStringArb,
  isPortagePossible: portageStatusArb
});

// Obstacle with minimal fields
const minimalObstacleArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

describe('Obstacle Detail Page Content - Property 10', () => {
  /**
   * Property 10: Obstacle Detail Page Contains Required Information
   * For any obstacle, the detail page shall display the obstacle type, GPS coordinates
   * (center of geometry), waterway link, and last updated timestamp.
   */

  describe('GPS coordinates display', () => {
    test('GPS coordinates are displayed when centerLat/centerLon exist', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            if (obstacle.centerLat && obstacle.centerLon) {
              return content.hasGpsCoordinates === true &&
                     content.gpsCoordinates.lat === obstacle.centerLat &&
                     content.gpsCoordinates.lon === obstacle.centerLon;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('GPS coordinates are calculated from geometry when center not pre-calculated', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            geometry: geometryArb
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            // Should have GPS coordinates calculated from geometry
            return content.hasGpsCoordinates === true &&
                   content.gpsCoordinates !== null &&
                   typeof content.gpsCoordinates.lat === 'number' &&
                   typeof content.gpsCoordinates.lon === 'number';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Waterway link display', () => {
    test('waterway link is displayed when waterway exists', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          waterwayArb,
          localeArb,
          (obstacle, waterway, locale) => {
            const content = generateObstacleDetailContent(obstacle, waterway, locale);
            
            return content.hasWaterwayLink === true &&
                   content.waterwayName === waterway.name &&
                   content.waterwayUrl === `/gewaesser/${waterway.slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no waterway link when waterway is null', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            return content.hasWaterwayLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Last updated timestamp display', () => {
    test('last updated is displayed when updatedAt exists', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            if (obstacle.updatedAt) {
              return content.hasLastUpdated === true &&
                     content.lastUpdated === obstacle.updatedAt;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no last updated when updatedAt is missing', () => {
      fc.assert(
        fc.property(
          minimalObstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            return content.hasLastUpdated === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Obstacle type display', () => {
    test('obstacle type is displayed when obstacleType_slug exists', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            if (obstacle.obstacleType_slug) {
              return content.hasObstacleType === true &&
                     content.obstacleType === obstacle.obstacleType_slug;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Description display', () => {
    test('description is displayed when it exists and is non-empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            description: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0)
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            return content.hasDescription === true &&
                   content.description === obstacle.description;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no description when it is empty or missing', () => {
      fc.assert(
        fc.property(
          minimalObstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            
            return content.hasDescription === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Portage status display', () => {
    test('portage status is always displayed', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content = generateObstacleDetailContent(obstacle, null, locale);
            return content.hasPortageStatus === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "Yes" when isPortagePossible is true', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: true };
            const content = generateObstacleDetailContent(obstacle, null, locale);
            const expected = locale === 'en' ? 'Yes' : 'Ja';
            return content.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "No" when isPortagePossible is false', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: false };
            const content = generateObstacleDetailContent(obstacle, null, locale);
            const expected = locale === 'en' ? 'No' : 'Nein';
            return content.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "Unknown" when isPortagePossible is null/undefined', () => {
      fc.assert(
        fc.property(
          localeArb,
          fc.constantFrom(null, undefined),
          (locale, portageValue) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: portageValue };
            const content = generateObstacleDetailContent(obstacle, null, locale);
            const expected = locale === 'en' ? 'Unknown' : 'Unbekannt';
            return content.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete detail page validation', () => {
    test('all required fields are present based on obstacle data', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          fc.option(waterwayArb, { nil: null }),
          localeArb,
          (obstacle, waterway, locale) => {
            const content = generateObstacleDetailContent(obstacle, waterway, locale);
            return validateDetailContent(obstacle, waterway, content, locale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Detail content generation is deterministic', () => {
    test('same obstacle and locale always produces same detail content', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          fc.option(waterwayArb, { nil: null }),
          localeArb,
          (obstacle, waterway, locale) => {
            const content1 = generateObstacleDetailContent(obstacle, waterway, locale);
            const content2 = generateObstacleDetailContent(obstacle, waterway, locale);
            
            return content1.hasObstacleType === content2.hasObstacleType &&
                   content1.hasGpsCoordinates === content2.hasGpsCoordinates &&
                   content1.hasWaterwayLink === content2.hasWaterwayLink &&
                   content1.hasLastUpdated === content2.hasLastUpdated &&
                   content1.hasDescription === content2.hasDescription &&
                   content1.hasPortageStatus === content2.hasPortageStatus;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL pattern follows specification', () => {
    test('waterway URL follows /gewaesser/{slug}/ pattern', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          waterwayArb,
          localeArb,
          (obstacle, waterway, locale) => {
            const content = generateObstacleDetailContent(obstacle, waterway, locale);
            
            if (content.hasWaterwayLink) {
              return content.waterwayUrl === `/gewaesser/${waterway.slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
