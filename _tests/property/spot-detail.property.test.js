/**
 * Property-Based Tests for Spot Detail Page Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 3: Spot Detail Page Contains Required Information**
 * **Validates: Requirements 3.6**
 * 
 * Property: For any non-rejected spot, the detail page shall display the full description,
 * GPS coordinates, approximate address, waterway link, paddle craft types, and last updated timestamp.
 */

const fc = require('fast-check');

// Valid spot type slugs
const VALID_SPOT_TYPES = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle'
];

// Valid paddle craft type slugs
const VALID_PADDLE_CRAFT_TYPES = [
  'kajak',
  'kanu',
  'sup',
  'ruderboot',
  'schlauchboot'
];

/**
 * Generates spot detail page content based on spot data.
 * This simulates what the spot.html layout would render for non-rejected spots.
 * 
 * @param {Object} spot - The spot data object
 * @param {Object} waterway - The waterway data object (optional)
 * @returns {Object} Object containing the detail page content fields
 */
function generateSpotDetailContent(spot, waterway = null) {
  const content = {
    hasFullDescription: false,
    hasGPS: false,
    hasApproximateAddress: false,
    hasWaterwayLink: false,
    hasPaddleCraftTypes: false,
    hasLastUpdated: false,
    fullDescription: null,
    gps: null,
    approximateAddress: null,
    waterwayLink: null,
    paddleCraftTypes: [],
    lastUpdated: null
  };

  // Full description (Requirement 3.6)
  if (spot.description && spot.description.trim().length > 0) {
    content.hasFullDescription = true;
    content.fullDescription = spot.description;
  }

  // GPS coordinates (Requirement 3.6)
  if (spot.location) {
    const lat = spot.location.lat || spot.location.latitude;
    const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      content.hasGPS = true;
      content.gps = { lat, lon };
    }
  }

  // Approximate address (Requirement 3.6)
  if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
    content.hasApproximateAddress = true;
    content.approximateAddress = spot.approximateAddress;
  }

  // Waterway link (Requirement 3.6)
  if (waterway && waterway.slug && waterway.name) {
    content.hasWaterwayLink = true;
    content.waterwayLink = {
      slug: waterway.slug,
      name: waterway.name,
      url: `/gewaesser/${waterway.slug}/`
    };
  }

  // Paddle craft types (Requirement 3.6)
  if (spot.paddleCraftTypes && Array.isArray(spot.paddleCraftTypes) && spot.paddleCraftTypes.length > 0) {
    content.hasPaddleCraftTypes = true;
    content.paddleCraftTypes = spot.paddleCraftTypes;
  }

  // Last updated timestamp (Requirement 3.6)
  if (spot.updatedAt) {
    content.hasLastUpdated = true;
    content.lastUpdated = spot.updatedAt;
  }

  return content;
}

/**
 * Validates that a spot detail page contains all required information
 * based on the spot data provided.
 * 
 * @param {Object} spot - The spot data
 * @param {Object} waterway - The waterway data (optional)
 * @param {Object} detailContent - The generated detail page content
 * @returns {boolean} True if all required fields are present
 */
function validateDetailContent(spot, waterway, detailContent) {
  // Full description must be present if spot has description
  if (spot.description && spot.description.trim().length > 0) {
    if (!detailContent.hasFullDescription || detailContent.fullDescription !== spot.description) {
      return false;
    }
  }

  // GPS must be present if spot has valid location
  if (spot.location) {
    const lat = spot.location.lat || spot.location.latitude;
    const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      if (!detailContent.hasGPS) {
        return false;
      }
    }
  }

  // Address must be present if spot has approximate address
  if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
    if (!detailContent.hasApproximateAddress || detailContent.approximateAddress !== spot.approximateAddress) {
      return false;
    }
  }

  // Waterway link must be present if waterway is provided
  if (waterway && waterway.slug && waterway.name) {
    if (!detailContent.hasWaterwayLink) {
      return false;
    }
  }

  // Paddle craft types must be present if spot has them
  if (spot.paddleCraftTypes && Array.isArray(spot.paddleCraftTypes) && spot.paddleCraftTypes.length > 0) {
    if (!detailContent.hasPaddleCraftTypes) {
      return false;
    }
    if (detailContent.paddleCraftTypes.length !== spot.paddleCraftTypes.length) {
      return false;
    }
  }

  // Last updated must be present if spot has updatedAt
  if (spot.updatedAt) {
    if (!detailContent.hasLastUpdated) {
      return false;
    }
  }

  return true;
}

// Arbitraries for generating test data
const validSpotTypeArb = fc.constantFrom(...VALID_SPOT_TYPES);
const validPaddleCraftTypeArb = fc.constantFrom(...VALID_PADDLE_CRAFT_TYPES);

const locationArb = fc.record({
  lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
  lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
});

const waterwayArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31'), noInvalidDate: true })
  .map(d => d.toISOString());

const nonRejectedSpotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 1000 }),
    fc.string({ minLength: 1, maxLength: 500 }).map(s => `<p>${s}</p><p>More content here.</p>`)
  ),
  spotType_slug: validSpotTypeArb,
  rejected: fc.constant(false), // Non-rejected spots only
  location: fc.option(locationArb, { nil: undefined }),
  approximateAddress: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
  ),
  paddleCraftTypes: fc.array(validPaddleCraftTypeArb, { minLength: 0, maxLength: 5 }),
  waterway_slug: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
  updatedAt: fc.option(isoDateArb, { nil: undefined })
});

describe('Spot Detail Page Content - Property 3', () => {
  /**
   * Property 3: Spot Detail Page Contains Required Information
   * For any non-rejected spot, the detail page shall display the full description,
   * GPS coordinates, approximate address, waterway link, paddle craft types,
   * and last updated timestamp.
   */

  describe('Detail page contains all required information based on spot data', () => {
    test('detail page includes full description when spot has description', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb,
          (spot) => {
            const detailContent = generateSpotDetailContent(spot);
            
            if (spot.description && spot.description.trim().length > 0) {
              return detailContent.hasFullDescription && 
                     detailContent.fullDescription === spot.description;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail page includes GPS coordinates when spot has valid location', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb.filter(s => s.location !== undefined),
          (spot) => {
            const detailContent = generateSpotDetailContent(spot);
            
            if (spot.location) {
              const lat = spot.location.lat || spot.location.latitude;
              const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
              if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
                return detailContent.hasGPS && 
                       detailContent.gps.lat === lat && 
                       detailContent.gps.lon === lon;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail page includes approximate address when spot has address', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb,
          (spot) => {
            const detailContent = generateSpotDetailContent(spot);
            
            if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
              return detailContent.hasApproximateAddress && 
                     detailContent.approximateAddress === spot.approximateAddress;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail page includes waterway link when waterway is provided', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb,
          waterwayArb,
          (spot, waterway) => {
            const detailContent = generateSpotDetailContent(spot, waterway);
            
            return detailContent.hasWaterwayLink && 
                   detailContent.waterwayLink.slug === waterway.slug &&
                   detailContent.waterwayLink.name === waterway.name;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterway link URL follows correct pattern /gewaesser/{slug}/', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb,
          waterwayArb,
          (spot, waterway) => {
            const detailContent = generateSpotDetailContent(spot, waterway);
            
            if (detailContent.hasWaterwayLink) {
              return detailContent.waterwayLink.url === `/gewaesser/${waterway.slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail page includes paddle craft types when spot has them', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb.filter(s => s.paddleCraftTypes && s.paddleCraftTypes.length > 0),
          (spot) => {
            const detailContent = generateSpotDetailContent(spot);
            
            return detailContent.hasPaddleCraftTypes && 
                   detailContent.paddleCraftTypes.length === spot.paddleCraftTypes.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail page includes last updated timestamp when spot has updatedAt', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb.filter(s => s.updatedAt !== undefined),
          (spot) => {
            const detailContent = generateSpotDetailContent(spot);
            
            return detailContent.hasLastUpdated && 
                   detailContent.lastUpdated === spot.updatedAt;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete detail page validation', () => {
    test('all required fields are present based on spot and waterway data', () => {
      fc.assert(
        fc.property(
          nonRejectedSpotArb,
          fc.option(waterwayArb, { nil: null }),
          (spot, waterway) => {
            const detailContent = generateSpotDetailContent(spot, waterway);
            return validateDetailContent(spot, waterway, detailContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('empty description results in no description section', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false,
        description: ''
      };
      const detailContent = generateSpotDetailContent(spot);
      expect(detailContent.hasFullDescription).toBe(false);
    });

    test('whitespace-only description results in no description section', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false,
        description: '   '
      };
      const detailContent = generateSpotDetailContent(spot);
      expect(detailContent.hasFullDescription).toBe(false);
    });

    test('missing location results in no GPS section', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false
      };
      const detailContent = generateSpotDetailContent(spot);
      expect(detailContent.hasGPS).toBe(false);
    });

    test('null waterway results in no waterway link', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false
      };
      const detailContent = generateSpotDetailContent(spot, null);
      expect(detailContent.hasWaterwayLink).toBe(false);
    });

    test('empty paddle craft types array results in no craft types section', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false,
        paddleCraftTypes: []
      };
      const detailContent = generateSpotDetailContent(spot);
      expect(detailContent.hasPaddleCraftTypes).toBe(false);
    });

    test('missing updatedAt results in no last updated section', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false
      };
      const detailContent = generateSpotDetailContent(spot);
      expect(detailContent.hasLastUpdated).toBe(false);
    });
  });

  describe('Full description is not truncated', () => {
    test('long descriptions are preserved in full', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 500, maxLength: 2000 }),
          (longDescription) => {
            const spot = {
              name: 'Test Spot',
              slug: 'test-spot',
              rejected: false,
              description: longDescription
            };
            const detailContent = generateSpotDetailContent(spot);
            
            // Full description should NOT be truncated (unlike popup)
            return detailContent.fullDescription === longDescription;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
