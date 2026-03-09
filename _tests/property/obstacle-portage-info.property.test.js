/**
 * Property-Based Tests for Obstacle Portage Information Display
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 11: Obstacle Portage Information Display**
 * **Validates: Requirements 5.5**
 * 
 * Property: For any obstacle with portage information (portageRoute, portageDescription, portageDistance),
 * the detail page shall display the portage distance, description, exit spot link, and re-entry spot link.
 */

const fc = require('fast-check');

/**
 * Localized strings for portage information
 */
const strings = {
  de: {
    portage_route_for: 'Portage-Route für',
    portage_distance: 'Portage-Distanz',
    portage_description: 'Portage-Beschreibung',
    exit_spot: 'Ausstiegsstelle',
    reentry_spot: 'Wiedereinstiegsstelle'
  },
  en: {
    portage_route_for: 'Portage route for',
    portage_distance: 'Portage Distance',
    portage_description: 'Portage Description',
    exit_spot: 'Exit Spot',
    reentry_spot: 'Re-entry Spot'
  }
};

// Valid GeoJSON line for portage route
const validLineGeoJson = {
  type: 'LineString',
  coordinates: [[8.0, 47.0], [8.05, 47.05], [8.1, 47.1]]
};

/**
 * Determines if the portage information section should be displayed.
 * The section is shown when any of: portageRoute, portageDescription, or portageDistance exists.
 * 
 * @param {Object} obstacle - The obstacle data object
 * @returns {boolean} True if portage section should be displayed
 */
function shouldShowPortageSection(obstacle) {
  return !!(obstacle.portageRoute || obstacle.portageDescription || obstacle.portageDistance);
}

/**
 * Generates the portage information content for an obstacle.
 * This simulates what the obstacle-detail-content.html include would render.
 * 
 * @param {Object} obstacle - The obstacle data object
 * @param {Object} exitSpot - The exit spot data object (optional)
 * @param {Object} reentrySpot - The re-entry spot data object (optional)
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {Object} Object containing the portage information content
 */
function generatePortageInfoContent(obstacle, exitSpot, reentrySpot, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    shouldShowSection: shouldShowPortageSection(obstacle),
    hasPortageDistance: false,
    hasPortageDescription: false,
    hasExitSpotLink: false,
    hasReentrySpotLink: false,
    portageDistance: null,
    portageDescription: null,
    exitSpotName: null,
    exitSpotUrl: null,
    reentrySpotName: null,
    reentrySpotUrl: null,
    sectionTitle: null
  };

  // If section shouldn't be shown, return early
  if (!content.shouldShowSection) {
    return content;
  }

  // Section title
  content.sectionTitle = `${localeStrings.portage_route_for} ${obstacle.name}`;

  // Portage distance (Requirement 5.5)
  if (obstacle.portageDistance && obstacle.portageDistance > 0) {
    content.hasPortageDistance = true;
    content.portageDistance = obstacle.portageDistance;
  }

  // Portage description (Requirement 5.5)
  if (obstacle.portageDescription && obstacle.portageDescription.trim().length > 0) {
    content.hasPortageDescription = true;
    content.portageDescription = obstacle.portageDescription;
  }

  // Exit spot link (Requirement 5.5)
  if (exitSpot && exitSpot.slug && exitSpot.name) {
    content.hasExitSpotLink = true;
    content.exitSpotName = exitSpot.name;
    content.exitSpotUrl = `/einstiegsorte/${exitSpot.slug}/`;
  }

  // Re-entry spot link (Requirement 5.5)
  if (reentrySpot && reentrySpot.slug && reentrySpot.name) {
    content.hasReentrySpotLink = true;
    content.reentrySpotName = reentrySpot.name;
    content.reentrySpotUrl = `/einstiegsorte/${reentrySpot.slug}/`;
  }

  return content;
}

/**
 * Validates that portage information is correctly displayed
 * 
 * @param {Object} obstacle - The obstacle data
 * @param {Object} exitSpot - The exit spot data (optional)
 * @param {Object} reentrySpot - The re-entry spot data (optional)
 * @param {Object} portageContent - The generated portage content
 * @returns {boolean} True if portage information is correctly displayed
 */
function validatePortageContent(obstacle, exitSpot, reentrySpot, portageContent) {
  // Section should only show when portage info exists
  const shouldShow = shouldShowPortageSection(obstacle);
  if (portageContent.shouldShowSection !== shouldShow) {
    return false;
  }

  // If section shouldn't show, no further validation needed
  if (!shouldShow) {
    return true;
  }

  // Portage distance should be shown when it exists and is positive
  if (obstacle.portageDistance && obstacle.portageDistance > 0) {
    if (!portageContent.hasPortageDistance || 
        portageContent.portageDistance !== obstacle.portageDistance) {
      return false;
    }
  }

  // Portage description should be shown when it exists
  if (obstacle.portageDescription && obstacle.portageDescription.trim().length > 0) {
    if (!portageContent.hasPortageDescription) {
      return false;
    }
  }

  // Exit spot link should be shown when exit spot exists
  if (exitSpot && exitSpot.slug && exitSpot.name) {
    if (!portageContent.hasExitSpotLink ||
        portageContent.exitSpotName !== exitSpot.name ||
        !portageContent.exitSpotUrl.includes(exitSpot.slug)) {
      return false;
    }
  }

  // Re-entry spot link should be shown when re-entry spot exists
  if (reentrySpot && reentrySpot.slug && reentrySpot.name) {
    if (!portageContent.hasReentrySpotLink ||
        portageContent.reentrySpotName !== reentrySpot.name ||
        !portageContent.reentrySpotUrl.includes(reentrySpot.slug)) {
      return false;
    }
  }

  return true;
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

const portageRouteArb = fc.oneof(
  fc.constant(validLineGeoJson),
  fc.constant(JSON.stringify(validLineGeoJson)),
  fc.constant(null),
  fc.constant(undefined)
);

const portageDistanceArb = fc.oneof(
  fc.integer({ min: 1, max: 5000 }),
  fc.constant(0),
  fc.constant(null),
  fc.constant(undefined)
);

const portageDescriptionArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined)
);

const spotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
});

// Obstacle with portage information
const obstacleWithPortageInfoArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  portageRoute: fc.constant(validLineGeoJson),
  portageDistance: fc.integer({ min: 1, max: 5000 }),
  portageDescription: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  exitSpot_slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  reentrySpot_slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
});

// Obstacle without portage information
const obstacleWithoutPortageInfoArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  portageRoute: fc.constant(null),
  portageDistance: fc.constant(null),
  portageDescription: fc.constant(null)
});

// Obstacle with partial portage information
const obstacleWithPartialPortageArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  portageRoute: portageRouteArb,
  portageDistance: portageDistanceArb,
  portageDescription: portageDescriptionArb
});

describe('Obstacle Portage Information Display - Property 11', () => {
  /**
   * Property 11: Obstacle Portage Information Display
   * For any obstacle with portage information (portageRoute, portageDescription, portageDistance),
   * the detail page shall display the portage distance, description, exit spot link, and re-entry spot link.
   */

  describe('Portage section visibility', () => {
    test('portage section is shown when obstacle has portage route', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            portageRoute: fc.constant(validLineGeoJson)
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.shouldShowSection === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage section is shown when obstacle has portage distance', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            portageDistance: fc.integer({ min: 1, max: 5000 })
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.shouldShowSection === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage section is shown when obstacle has portage description', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            portageDescription: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0)
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.shouldShowSection === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage section is NOT shown when obstacle has no portage information', () => {
      fc.assert(
        fc.property(
          obstacleWithoutPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.shouldShowSection === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Portage distance display', () => {
    test('portage distance is displayed when it exists and is positive', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            
            if (obstacle.portageDistance && obstacle.portageDistance > 0) {
              return content.hasPortageDistance === true &&
                     content.portageDistance === obstacle.portageDistance;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage distance is NOT displayed when it is zero', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            portageRoute: fc.constant(validLineGeoJson),
            portageDistance: fc.constant(0)
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.hasPortageDistance === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Portage description display', () => {
    test('portage description is displayed when it exists and is non-empty', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            
            if (obstacle.portageDescription && obstacle.portageDescription.trim().length > 0) {
              return content.hasPortageDescription === true &&
                     content.portageDescription === obstacle.portageDescription;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage description is NOT displayed when it is empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            portageRoute: fc.constant(validLineGeoJson),
            portageDescription: fc.constant('')
          }),
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.hasPortageDescription === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Exit spot link display', () => {
    test('exit spot link is displayed when exit spot exists', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          spotArb,
          localeArb,
          (obstacle, exitSpot, locale) => {
            const content = generatePortageInfoContent(obstacle, exitSpot, null, locale);
            
            return content.hasExitSpotLink === true &&
                   content.exitSpotName === exitSpot.name &&
                   content.exitSpotUrl === `/einstiegsorte/${exitSpot.slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no exit spot link when exit spot is null', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.hasExitSpotLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Re-entry spot link display', () => {
    test('re-entry spot link is displayed when re-entry spot exists', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          spotArb,
          localeArb,
          (obstacle, reentrySpot, locale) => {
            const content = generatePortageInfoContent(obstacle, null, reentrySpot, locale);
            
            return content.hasReentrySpotLink === true &&
                   content.reentrySpotName === reentrySpot.name &&
                   content.reentrySpotUrl === `/einstiegsorte/${reentrySpot.slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no re-entry spot link when re-entry spot is null', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            return content.hasReentrySpotLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete portage information validation', () => {
    test('all portage fields are correctly displayed based on obstacle data', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          fc.option(spotArb, { nil: null }),
          fc.option(spotArb, { nil: null }),
          localeArb,
          (obstacle, exitSpot, reentrySpot, locale) => {
            const content = generatePortageInfoContent(obstacle, exitSpot, reentrySpot, locale);
            return validatePortageContent(obstacle, exitSpot, reentrySpot, content);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Portage content generation is deterministic', () => {
    test('same obstacle and spots always produces same portage content', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          fc.option(spotArb, { nil: null }),
          fc.option(spotArb, { nil: null }),
          localeArb,
          (obstacle, exitSpot, reentrySpot, locale) => {
            const content1 = generatePortageInfoContent(obstacle, exitSpot, reentrySpot, locale);
            const content2 = generatePortageInfoContent(obstacle, exitSpot, reentrySpot, locale);
            
            return content1.shouldShowSection === content2.shouldShowSection &&
                   content1.hasPortageDistance === content2.hasPortageDistance &&
                   content1.hasPortageDescription === content2.hasPortageDescription &&
                   content1.hasExitSpotLink === content2.hasExitSpotLink &&
                   content1.hasReentrySpotLink === content2.hasReentrySpotLink;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL patterns follow specification', () => {
    test('exit spot URL follows /einstiegsorte/{slug}/ pattern', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          spotArb,
          localeArb,
          (obstacle, exitSpot, locale) => {
            const content = generatePortageInfoContent(obstacle, exitSpot, null, locale);
            
            if (content.hasExitSpotLink) {
              return content.exitSpotUrl === `/einstiegsorte/${exitSpot.slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('re-entry spot URL follows /einstiegsorte/{slug}/ pattern', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          spotArb,
          localeArb,
          (obstacle, reentrySpot, locale) => {
            const content = generatePortageInfoContent(obstacle, null, reentrySpot, locale);
            
            if (content.hasReentrySpotLink) {
              return content.reentrySpotUrl === `/einstiegsorte/${reentrySpot.slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Section title includes obstacle name', () => {
    test('section title contains obstacle name', () => {
      fc.assert(
        fc.property(
          obstacleWithPortageInfoArb,
          localeArb,
          (obstacle, locale) => {
            const content = generatePortageInfoContent(obstacle, null, null, locale);
            
            if (content.shouldShowSection) {
              return content.sectionTitle.includes(obstacle.name);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
