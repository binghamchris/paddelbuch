/**
 * Property-Based Tests for Event Notice Dual Rendering
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 14: Event Notice Dual Rendering**
 * **Validates: Requirements 7.2**
 * 
 * Property: For any active event notice (future end date), the Map_System shall render 
 * both a marker at the notice location and a GeoJSON polygon for the affected area.
 */

const fc = require('fast-check');

/**
 * Checks if a date string represents a date in the future (or today)
 * 
 * @param {string|Date} dateValue - The date to check
 * @param {Date} [referenceDate] - Optional reference date
 * @returns {boolean} True if the date is today or in the future
 */
function isDateInFuture(dateValue, referenceDate) {
  if (!dateValue) return false;
  
  var date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    date = new Date(dateValue);
  }
  
  if (isNaN(date.getTime())) return false;
  
  var refDate = referenceDate instanceof Date ? referenceDate : new Date();
  var dateStr = date.toISOString().split('T')[0];
  var refDateStr = refDate.toISOString().split('T')[0];
  
  return dateStr >= refDateStr;
}

/**
 * Determines if an event notice should have a marker rendered
 * A marker requires a valid location with lat/lon coordinates
 * 
 * @param {Object} notice - The event notice object
 * @returns {boolean} True if a marker should be rendered
 */
function shouldRenderMarker(notice) {
  if (!notice.location) return false;
  
  var lat = notice.location.lat || notice.location.latitude;
  var lon = notice.location.lon || notice.location.lng || notice.location.longitude;
  
  return lat !== undefined && lat !== null && 
         lon !== undefined && lon !== null &&
         !isNaN(lat) && !isNaN(lon);
}

/**
 * Determines if an event notice should have an affected area polygon rendered
 * An area requires a valid affectedArea GeoJSON
 * 
 * @param {Object} notice - The event notice object
 * @returns {boolean} True if an affected area polygon should be rendered
 */
function shouldRenderAffectedArea(notice) {
  return notice.affectedArea !== undefined && 
         notice.affectedArea !== null && 
         notice.affectedArea !== '';
}

/**
 * Determines what should be rendered for an event notice
 * 
 * Property 14: Event Notice Dual Rendering
 * For any active event notice (future end date), the Map_System shall render 
 * both a marker at the notice location and a GeoJSON polygon for the affected area.
 * 
 * @param {Object} notice - The event notice object
 * @param {Date} [referenceDate] - Optional reference date
 * @returns {Object} Object with renderMarker and renderArea booleans
 */
function determineRendering(notice, referenceDate) {
  // First check if notice is active (future end date)
  if (!isDateInFuture(notice.endDate, referenceDate)) {
    return {
      isActive: false,
      renderMarker: false,
      renderArea: false
    };
  }
  
  return {
    isActive: true,
    renderMarker: shouldRenderMarker(notice),
    renderArea: shouldRenderAffectedArea(notice)
  };
}

/**
 * Validates that a GeoJSON string is parseable
 * 
 * @param {string} geoJsonStr - GeoJSON string to validate
 * @returns {boolean} True if valid GeoJSON
 */
function isValidGeoJson(geoJsonStr) {
  if (!geoJsonStr) return false;
  try {
    var parsed = JSON.parse(geoJsonStr);
    return parsed && (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon' || parsed.type === 'Feature');
  } catch (e) {
    return false;
  }
}

// Arbitraries for generating test data

const localeArb = fc.constantFrom('de', 'en');
const slugArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// Generate dates within a reasonable range
const dateArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31')
});

// Generate an ISO date string
const dateStringArb = dateArb.map(d => d.toISOString().split('T')[0]);

// Generate a valid location object
const locationArb = fc.record({
  lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
  lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
});

// Generate a valid GeoJSON polygon string
const validGeoJsonArb = fc.record({
  lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
  lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true }),
  size: fc.float({ min: Math.fround(0.01), max: Math.fround(0.1), noNaN: true })
}).map(({ lat, lon, size }) => {
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat]
    ]]
  });
});

// Generate a reference date (today)
const referenceDateArb = fc.date({
  min: new Date('2023-01-01'),
  max: new Date('2027-12-31')
});

// Generate an event notice with all fields
const eventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: localeArb,
  description: fc.string({ minLength: 0, maxLength: 500 }),
  startDate: dateStringArb,
  endDate: dateStringArb,
  location: fc.option(locationArb, { nil: undefined }),
  affectedArea: fc.option(validGeoJsonArb, { nil: undefined }),
  waterways: fc.array(slugArb, { minLength: 0, maxLength: 5 })
});

// Generate an active event notice (with future end date)
const activeEventNoticeArb = fc.record({
  slug: slugArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  locale: localeArb,
  description: fc.string({ minLength: 0, maxLength: 500 }),
  startDate: dateStringArb,
  location: locationArb,
  affectedArea: validGeoJsonArb,
  waterways: fc.array(slugArb, { minLength: 0, maxLength: 5 })
}).chain(notice => 
  // Generate an end date that's in the future relative to a reference date
  fc.tuple(
    referenceDateArb,
    fc.integer({ min: 1, max: 365 })
  ).map(([refDate, daysInFuture]) => {
    const futureDate = new Date(refDate);
    futureDate.setDate(futureDate.getDate() + daysInFuture);
    return {
      ...notice,
      endDate: futureDate.toISOString().split('T')[0],
      _referenceDate: refDate
    };
  })
);

describe('Event Notice Dual Rendering - Property 14', () => {
  /**
   * Property 14: Event Notice Dual Rendering
   * 
   * For any active event notice (future end date), the Map_System shall render 
   * both a marker at the notice location and a GeoJSON polygon for the affected area.
   */

  describe('Active notice detection', () => {
    test('notices with future end dates are marked as active', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (notice, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            notice.endDate = futureDate.toISOString().split('T')[0];
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices with past end dates are marked as inactive', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (notice, referenceDate, daysInPast) => {
            const pastDate = new Date(referenceDate);
            pastDate.setDate(pastDate.getDate() - daysInPast);
            notice.endDate = pastDate.toISOString().split('T')[0];
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('inactive notices do not render marker or area', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (notice, referenceDate, daysInPast) => {
            const pastDate = new Date(referenceDate);
            pastDate.setDate(pastDate.getDate() - daysInPast);
            notice.endDate = pastDate.toISOString().split('T')[0];
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.renderMarker === false && rendering.renderArea === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Marker rendering', () => {
    test('active notice with valid location renders marker', () => {
      fc.assert(
        fc.property(
          locationArb,
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (location, slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: location
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderMarker === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice without location does not render marker', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: undefined
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderMarker === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice with null location does not render marker', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: null
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderMarker === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Affected area rendering', () => {
    test('active notice with affectedArea renders area polygon', () => {
      fc.assert(
        fc.property(
          validGeoJsonArb,
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (geoJson, slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              affectedArea: geoJson
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderArea === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice without affectedArea does not render area polygon', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              affectedArea: undefined
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderArea === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice with null affectedArea does not render area polygon', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              affectedArea: null
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderArea === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice with empty string affectedArea does not render area polygon', () => {
      fc.assert(
        fc.property(
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              affectedArea: ''
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && rendering.renderArea === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Dual rendering (both marker and area)', () => {
    test('active notice with both location and affectedArea renders both', () => {
      fc.assert(
        fc.property(
          locationArb,
          validGeoJsonArb,
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (location, geoJson, slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: location,
              affectedArea: geoJson
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && 
                   rendering.renderMarker === true && 
                   rendering.renderArea === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice with location but no affectedArea renders only marker', () => {
      fc.assert(
        fc.property(
          locationArb,
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (location, slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: location,
              affectedArea: undefined
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && 
                   rendering.renderMarker === true && 
                   rendering.renderArea === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('active notice with affectedArea but no location renders only area', () => {
      fc.assert(
        fc.property(
          validGeoJsonArb,
          slugArb,
          referenceDateArb,
          fc.integer({ min: 1, max: 365 }),
          (geoJson, slug, referenceDate, daysInFuture) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + daysInFuture);
            
            const notice = {
              slug: slug,
              name: 'Test Notice',
              endDate: futureDate.toISOString().split('T')[0],
              location: undefined,
              affectedArea: geoJson
            };
            
            const rendering = determineRendering(notice, referenceDate);
            return rendering.isActive === true && 
                   rendering.renderMarker === false && 
                   rendering.renderArea === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('GeoJSON validation', () => {
    test('valid polygon GeoJSON is recognized', () => {
      fc.assert(
        fc.property(
          validGeoJsonArb,
          (geoJson) => {
            return isValidGeoJson(geoJson) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid GeoJSON strings are rejected', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('not json', '{invalid}', '{"type":"Unknown"}', ''),
          (invalidJson) => {
            return isValidGeoJson(invalidJson) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null and undefined are rejected', () => {
      expect(isValidGeoJson(null)).toBe(false);
      expect(isValidGeoJson(undefined)).toBe(false);
    });
  });

  describe('Rendering is deterministic', () => {
    test('same notice and reference date always produces same rendering decision', () => {
      fc.assert(
        fc.property(
          eventNoticeArb,
          referenceDateArb,
          (notice, referenceDate) => {
            const rendering1 = determineRendering(notice, referenceDate);
            const rendering2 = determineRendering(notice, referenceDate);
            
            return rendering1.isActive === rendering2.isActive &&
                   rendering1.renderMarker === rendering2.renderMarker &&
                   rendering1.renderArea === rendering2.renderArea;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
