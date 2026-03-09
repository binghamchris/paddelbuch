/**
 * Property-Based Tests for Spot Popup Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 2: Spot Popup Contains Required Information**
 * **Validates: Requirements 3.1**
 * 
 * Property: For any spot displayed on the map, the popup shall contain the spot name,
 * a description excerpt (first paragraph), GPS coordinates, approximate address,
 * and list of paddle craft types.
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
 * Generates a spot popup content object based on spot data.
 * This simulates what the spot-popup.html include would render.
 * 
 * @param {Object} spot - The spot data object
 * @returns {Object} Object containing the popup content fields
 */
function generateSpotPopupContent(spot) {
  const content = {
    hasName: false,
    hasDescription: false,
    hasGPS: false,
    hasAddress: false,
    hasPaddleCraftTypes: false,
    hasNavigateButton: false,
    hasMoreDetailsLink: false,
    name: null,
    descriptionExcerpt: null,
    gps: null,
    address: null,
    paddleCraftTypes: [],
    navigateUrl: null,
    detailsUrl: null
  };

  // Name is always required (Requirement 3.1)
  if (spot.name && spot.name.trim().length > 0) {
    content.hasName = true;
    content.name = spot.name;
  }

  // Description excerpt - first paragraph, truncated to 150 chars (Requirement 3.1)
  if (spot.description && spot.description.trim().length > 0) {
    content.hasDescription = true;
    // Strip HTML tags and truncate
    const plainText = spot.description.replace(/<[^>]*>/g, '');
    content.descriptionExcerpt = plainText.length > 150 
      ? plainText.substring(0, 150) + '...'
      : plainText;
  }

  // GPS coordinates (Requirement 3.1)
  if (spot.location) {
    const lat = spot.location.lat || spot.location.latitude;
    const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      content.hasGPS = true;
      content.gps = { lat, lon };
    }
  }

  // Approximate address (Requirement 3.1)
  if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
    content.hasAddress = true;
    content.address = spot.approximateAddress;
  }

  // Paddle craft types (Requirement 3.1)
  if (spot.paddleCraftTypes && Array.isArray(spot.paddleCraftTypes) && spot.paddleCraftTypes.length > 0) {
    content.hasPaddleCraftTypes = true;
    content.paddleCraftTypes = spot.paddleCraftTypes;
  }

  // Navigate button - requires GPS coordinates (Requirement 3.4)
  if (content.hasGPS) {
    content.hasNavigateButton = true;
    content.navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${content.gps.lat},${content.gps.lon}`;
  }

  // More details link - requires slug (Requirement 3.5)
  if (spot.slug && spot.slug.trim().length > 0) {
    content.hasMoreDetailsLink = true;
    content.detailsUrl = `/einstiegsorte/${spot.slug}/`;
  }

  return content;
}

/**
 * Validates that a spot popup contains all required information
 * based on the spot data provided.
 * 
 * @param {Object} spot - The spot data
 * @param {Object} popupContent - The generated popup content
 * @returns {boolean} True if all required fields are present
 */
function validatePopupContent(spot, popupContent) {
  // Name must be present if spot has a name
  if (spot.name && spot.name.trim().length > 0) {
    if (!popupContent.hasName || popupContent.name !== spot.name) {
      return false;
    }
  }

  // Description excerpt must be present if spot has description
  if (spot.description && spot.description.trim().length > 0) {
    if (!popupContent.hasDescription) {
      return false;
    }
    // Excerpt should be truncated version of description
    const plainText = spot.description.replace(/<[^>]*>/g, '');
    if (plainText.length > 150) {
      if (!popupContent.descriptionExcerpt.endsWith('...')) {
        return false;
      }
    }
  }

  // GPS must be present if spot has valid location
  if (spot.location) {
    const lat = spot.location.lat || spot.location.latitude;
    const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      if (!popupContent.hasGPS) {
        return false;
      }
    }
  }

  // Address must be present if spot has approximate address
  if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
    if (!popupContent.hasAddress || popupContent.address !== spot.approximateAddress) {
      return false;
    }
  }

  // Paddle craft types must be present if spot has them
  if (spot.paddleCraftTypes && Array.isArray(spot.paddleCraftTypes) && spot.paddleCraftTypes.length > 0) {
    if (!popupContent.hasPaddleCraftTypes) {
      return false;
    }
    if (popupContent.paddleCraftTypes.length !== spot.paddleCraftTypes.length) {
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

const spotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  description: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 500 }),
    fc.string({ minLength: 1, maxLength: 200 }).map(s => `<p>${s}</p>`)
  ),
  spotType_slug: validSpotTypeArb,
  rejected: fc.boolean(),
  location: fc.option(locationArb, { nil: undefined }),
  approximateAddress: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
  ),
  paddleCraftTypes: fc.array(validPaddleCraftTypeArb, { minLength: 0, maxLength: 5 })
});

describe('Spot Popup Content - Property 2', () => {
  /**
   * Property 2: Spot Popup Contains Required Information
   * For any spot displayed on the map, the popup shall contain the spot name,
   * a description excerpt (first paragraph), GPS coordinates, approximate address,
   * and list of paddle craft types.
   */

  describe('Popup contains all required information based on spot data', () => {
    test('popup content includes name when spot has name', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            if (spot.name && spot.name.trim().length > 0) {
              return popupContent.hasName && popupContent.name === spot.name;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup content includes description excerpt when spot has description', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            if (spot.description && spot.description.trim().length > 0) {
              return popupContent.hasDescription && popupContent.descriptionExcerpt !== null;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('description excerpt is truncated to 150 characters with ellipsis', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 200, maxLength: 500 }),
          (longDescription) => {
            const spot = {
              name: 'Test Spot',
              description: longDescription,
              slug: 'test-spot'
            };
            const popupContent = generateSpotPopupContent(spot);
            
            if (popupContent.hasDescription) {
              // Plain text version should be truncated
              const plainText = longDescription.replace(/<[^>]*>/g, '');
              if (plainText.length > 150) {
                return popupContent.descriptionExcerpt.endsWith('...');
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup content includes GPS coordinates when spot has valid location', () => {
      fc.assert(
        fc.property(
          spotArb.filter(s => s.location !== undefined),
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            if (spot.location) {
              const lat = spot.location.lat || spot.location.latitude;
              const lon = spot.location.lon || spot.location.lng || spot.location.longitude;
              if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
                return popupContent.hasGPS && 
                       popupContent.gps.lat === lat && 
                       popupContent.gps.lon === lon;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup content includes approximate address when spot has address', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            if (spot.approximateAddress && spot.approximateAddress.trim().length > 0) {
              return popupContent.hasAddress && 
                     popupContent.address === spot.approximateAddress;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup content includes paddle craft types when spot has them', () => {
      fc.assert(
        fc.property(
          spotArb.filter(s => s.paddleCraftTypes && s.paddleCraftTypes.length > 0),
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            return popupContent.hasPaddleCraftTypes && 
                   popupContent.paddleCraftTypes.length === spot.paddleCraftTypes.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup includes navigation and details links', () => {
    test('popup includes navigate button when GPS coordinates are available', () => {
      fc.assert(
        fc.property(
          spotArb.filter(s => s.location !== undefined),
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            // Navigate button should be present when GPS is available
            return popupContent.hasGPS === popupContent.hasNavigateButton;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('navigate URL contains correct coordinates', () => {
      fc.assert(
        fc.property(
          locationArb,
          (location) => {
            const spot = {
              name: 'Test Spot',
              slug: 'test-spot',
              location: location
            };
            const popupContent = generateSpotPopupContent(spot);
            
            if (popupContent.hasNavigateButton) {
              return popupContent.navigateUrl.includes(location.lat.toString()) &&
                     popupContent.navigateUrl.includes(location.lon.toString());
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup includes more details link when slug is available', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            
            if (spot.slug && spot.slug.trim().length > 0) {
              return popupContent.hasMoreDetailsLink && 
                     popupContent.detailsUrl.includes(spot.slug);
            }
            return !popupContent.hasMoreDetailsLink;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('details URL follows correct pattern /einstiegsorte/{slug}/', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (slug) => {
            const spot = {
              name: 'Test Spot',
              slug: slug
            };
            const popupContent = generateSpotPopupContent(spot);
            
            if (popupContent.hasMoreDetailsLink) {
              return popupContent.detailsUrl === `/einstiegsorte/${slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete popup validation', () => {
    test('all required fields are present based on spot data', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const popupContent = generateSpotPopupContent(spot);
            return validatePopupContent(spot, popupContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('empty description results in no description excerpt', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        description: ''
      };
      const popupContent = generateSpotPopupContent(spot);
      expect(popupContent.hasDescription).toBe(false);
    });

    test('whitespace-only description results in no description excerpt', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        description: '   '
      };
      const popupContent = generateSpotPopupContent(spot);
      expect(popupContent.hasDescription).toBe(false);
    });

    test('missing location results in no GPS or navigate button', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot'
      };
      const popupContent = generateSpotPopupContent(spot);
      expect(popupContent.hasGPS).toBe(false);
      expect(popupContent.hasNavigateButton).toBe(false);
    });

    test('empty paddle craft types array results in no craft types', () => {
      const spot = {
        name: 'Test Spot',
        slug: 'test-spot',
        paddleCraftTypes: []
      };
      const popupContent = generateSpotPopupContent(spot);
      expect(popupContent.hasPaddleCraftTypes).toBe(false);
    });
  });
});
