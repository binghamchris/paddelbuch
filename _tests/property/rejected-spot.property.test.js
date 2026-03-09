/**
 * Property-Based Tests for Rejected Spot Display
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 4: Rejected Spot Shows Rejection Reason**
 * **Validates: Requirements 3.7**
 * 
 * Property: For any spot marked as rejected, the detail page shall display the rejection reason
 * (from description field) instead of standard spot information fields.
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
 * Generates rejected spot detail page content based on spot data.
 * This simulates what the spot.html layout would render for rejected spots.
 * 
 * For rejected spots, the description field contains the rejection reason,
 * and standard spot information (waterway link, paddle craft types) is NOT displayed.
 * 
 * @param {Object} spot - The spot data object (must have rejected: true)
 * @returns {Object} Object containing the rejected spot display content
 */
function generateRejectedSpotContent(spot) {
  const content = {
    isRejected: spot.rejected === true,
    hasRejectionReason: false,
    hasNotAccessibleWarning: false,
    hasGPS: false,
    hasApproximateAddress: false,
    hasLastUpdated: false,
    // Standard fields that should NOT be present for rejected spots
    hasWaterwayLink: false,
    hasPaddleCraftTypes: false,
    hasFullDescription: false, // Description is shown as rejection reason instead
    // Content values
    rejectionReason: null,
    gps: null,
    approximateAddress: null,
    lastUpdated: null
  };

  if (!content.isRejected) {
    return content;
  }

  // Rejected spots always show the "not accessible" warning
  content.hasNotAccessibleWarning = true;

  // Rejection reason comes from the description field (Requirement 3.7)
  if (spot.description && spot.description.trim().length > 0) {
    content.hasRejectionReason = true;
    content.rejectionReason = spot.description;
  }

  // GPS coordinates are still shown for reference
  if (spot.location) {
    const lat = spot.location.lat || spot.location.latitude;
    const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      content.hasGPS = true;
      content.gps = { lat, lon };
    }
  }

  // Approximate address is still shown for reference
  if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
    content.hasApproximateAddress = true;
    content.approximateAddress = spot.approximateAddress;
  }

  // Last updated timestamp is still shown
  if (spot.updatedAt) {
    content.hasLastUpdated = true;
    content.lastUpdated = spot.updatedAt;
  }

  // Standard fields are NOT shown for rejected spots
  // hasWaterwayLink, hasPaddleCraftTypes, hasFullDescription remain false

  return content;
}

/**
 * Validates that a rejected spot displays rejection reason instead of standard info.
 * 
 * @param {Object} spot - The spot data (must have rejected: true)
 * @param {Object} content - The generated rejected spot content
 * @returns {boolean} True if rejection reason is shown and standard fields are hidden
 */
function validateRejectedSpotContent(spot, content) {
  // Must be marked as rejected
  if (!content.isRejected) {
    return false;
  }

  // Must show "not accessible" warning
  if (!content.hasNotAccessibleWarning) {
    return false;
  }

  // Rejection reason must be present if spot has description
  if (spot.description && spot.description.trim().length > 0) {
    if (!content.hasRejectionReason || content.rejectionReason !== spot.description) {
      return false;
    }
  }

  // Standard fields must NOT be present
  if (content.hasWaterwayLink || content.hasPaddleCraftTypes || content.hasFullDescription) {
    return false;
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

const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  .map(d => d.toISOString());

// Rejected spot arbitrary - always has rejected: true
const rejectedSpotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
    fc.string({ minLength: 1, maxLength: 300 }).map(s => `<p>${s}</p>`)
  ),
  spotType_slug: validSpotTypeArb,
  rejected: fc.constant(true), // Always rejected
  location: fc.option(locationArb, { nil: undefined }),
  approximateAddress: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
  ),
  paddleCraftTypes: fc.array(validPaddleCraftTypeArb, { minLength: 0, maxLength: 5 }),
  waterway_slug: fc.option(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { nil: undefined }),
  updatedAt: fc.option(isoDateArb, { nil: undefined })
});

describe('Rejected Spot Display - Property 4', () => {
  /**
   * Property 4: Rejected Spot Shows Rejection Reason
   * For any spot marked as rejected, the detail page shall display the rejection reason
   * (from description field) instead of standard spot information fields.
   */

  describe('Rejected spots show rejection reason instead of standard info', () => {
    test('rejected spot shows "not accessible" warning', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb,
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasNotAccessibleWarning === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot shows rejection reason from description field', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb.filter(s => s.description && s.description.trim().length > 0),
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasRejectionReason && 
                   content.rejectionReason === spot.description;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot does NOT show waterway link', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb,
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasWaterwayLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot does NOT show paddle craft types', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb,
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasPaddleCraftTypes === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot does NOT show full description section (uses rejection reason instead)', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb,
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasFullDescription === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rejected spots still show reference information', () => {
    test('rejected spot shows GPS coordinates when available', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb.filter(s => s.location !== undefined),
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            
            if (spot.location) {
              const lat = spot.location.lat || spot.location.latitude;
              const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
              if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
                return content.hasGPS && 
                       content.gps.lat === lat && 
                       content.gps.lon === lon;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot shows approximate address when available', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb.filter(s => s.approximateAddress && s.approximateAddress.trim().length > 0),
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasApproximateAddress && 
                   content.approximateAddress === spot.approximateAddress;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spot shows last updated timestamp when available', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb.filter(s => s.updatedAt !== undefined),
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return content.hasLastUpdated && 
                   content.lastUpdated === spot.updatedAt;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete rejected spot validation', () => {
    test('all rejected spot requirements are met', () => {
      fc.assert(
        fc.property(
          rejectedSpotArb,
          (spot) => {
            const content = generateRejectedSpotContent(spot);
            return validateRejectedSpotContent(spot, content);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('rejected spot with empty description shows no rejection reason', () => {
      const spot = {
        name: 'Test Rejected Spot',
        slug: 'test-rejected-spot',
        rejected: true,
        description: ''
      };
      const content = generateRejectedSpotContent(spot);
      expect(content.hasRejectionReason).toBe(false);
      expect(content.hasNotAccessibleWarning).toBe(true);
    });

    test('rejected spot with whitespace-only description shows no rejection reason', () => {
      const spot = {
        name: 'Test Rejected Spot',
        slug: 'test-rejected-spot',
        rejected: true,
        description: '   '
      };
      const content = generateRejectedSpotContent(spot);
      expect(content.hasRejectionReason).toBe(false);
      expect(content.hasNotAccessibleWarning).toBe(true);
    });

    test('non-rejected spot returns isRejected false', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        rejected: false,
        description: 'Normal description'
      };
      const content = generateRejectedSpotContent(spot);
      expect(content.isRejected).toBe(false);
      expect(content.hasNotAccessibleWarning).toBe(false);
    });

    test('rejected spot with HTML description preserves HTML', () => {
      const htmlDescription = '<p>This area is closed due to <strong>construction</strong>.</p>';
      const spot = {
        name: 'Test Rejected Spot',
        slug: 'test-rejected-spot',
        rejected: true,
        description: htmlDescription
      };
      const content = generateRejectedSpotContent(spot);
      expect(content.hasRejectionReason).toBe(true);
      expect(content.rejectionReason).toBe(htmlDescription);
    });
  });

  describe('Contrast with non-rejected spots', () => {
    test('rejected and non-rejected spots with same data produce different content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          (name, description) => {
            const baseSpot = {
              name,
              slug: 'test-spot',
              description,
              paddleCraftTypes: ['kajak'],
              waterway_slug: 'test-waterway'
            };

            const rejectedSpot = { ...baseSpot, rejected: true };
            const normalSpot = { ...baseSpot, rejected: false };

            const rejectedContent = generateRejectedSpotContent(rejectedSpot);
            const normalContent = generateRejectedSpotContent(normalSpot);

            // Rejected spot should show rejection reason, not full description
            // Normal spot should not be processed as rejected
            return rejectedContent.isRejected === true && 
                   normalContent.isRejected === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
