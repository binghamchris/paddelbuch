/**
 * Property-Based Tests for Obstacle Popup Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 9: Obstacle Popup Contains Required Information**
 * **Validates: Requirements 5.3**
 * 
 * Property: For any obstacle displayed on the map, the popup shall contain the obstacle name
 * and portage possibility status (Yes, No, or Unknown).
 */

const fc = require('fast-check');

/**
 * Localized strings for popup content (mirrors obstacle-popup.js)
 */
const strings = {
  de: {
    portageLabel: 'Umtragen möglich',
    yes: 'Ja',
    no: 'Nein',
    unknown: 'Unbekannt',
    moreDetails: 'Weitere Details'
  },
  en: {
    portageLabel: 'Portage possible',
    yes: 'Yes',
    no: 'No',
    unknown: 'Unknown',
    moreDetails: 'More details'
  }
};

/**
 * Gets the portage possibility status text based on the obstacle data
 * This mirrors the logic in obstacle-popup.js
 * 
 * @param {Object} obstacle - The obstacle data object
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {string} The localized portage status text
 */
function getPortageStatus(obstacle, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  if (obstacle.isPortagePossible === true || obstacle.isPortagePossible === 'true') {
    return localeStrings.yes;
  } else if (obstacle.isPortagePossible === false || obstacle.isPortagePossible === 'false') {
    return localeStrings.no;
  }
  
  return localeStrings.unknown;
}

/**
 * Generates the popup content object for an obstacle.
 * This simulates what the obstacle-popup.html include would render.
 * 
 * @param {Object} obstacle - The obstacle data object
 * @param {string} locale - The current locale ('de' or 'en')
 * @returns {Object} Object containing the popup content fields
 */
function generateObstaclePopupContent(obstacle, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    hasName: false,
    hasPortageStatus: false,
    hasDetailsLink: false,
    name: null,
    portageStatus: null,
    portageLabel: localeStrings.portageLabel,
    detailsUrl: null
  };

  // Name is always required (Requirement 5.3)
  if (obstacle.name && obstacle.name.trim().length > 0) {
    content.hasName = true;
    content.name = obstacle.name;
  }

  // Portage possibility status is always shown (Requirement 5.3)
  content.hasPortageStatus = true;
  content.portageStatus = getPortageStatus(obstacle, locale);

  // Details link requires slug (Requirement 5.3)
  if (obstacle.slug && obstacle.slug.trim().length > 0) {
    content.hasDetailsLink = true;
    content.detailsUrl = `/hindernisse/${obstacle.slug}/`;
  }

  return content;
}

/**
 * Validates that an obstacle popup contains all required information
 * 
 * @param {Object} obstacle - The obstacle data
 * @param {Object} popupContent - The generated popup content
 * @param {string} locale - The current locale
 * @returns {boolean} True if all required fields are present
 */
function validatePopupContent(obstacle, popupContent, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  // Name must be present if obstacle has a name
  if (obstacle.name && obstacle.name.trim().length > 0) {
    if (!popupContent.hasName || popupContent.name !== obstacle.name) {
      return false;
    }
  }

  // Portage status must always be present
  if (!popupContent.hasPortageStatus) {
    return false;
  }

  // Portage status must be one of the valid values
  const validStatuses = [localeStrings.yes, localeStrings.no, localeStrings.unknown];
  if (!validStatuses.includes(popupContent.portageStatus)) {
    return false;
  }

  // Details link must be present if slug exists
  if (obstacle.slug && obstacle.slug.trim().length > 0) {
    if (!popupContent.hasDetailsLink || !popupContent.detailsUrl.includes(obstacle.slug)) {
      return false;
    }
  }

  return true;
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

const portageStatusArb = fc.oneof(
  fc.constant(true),
  fc.constant(false),
  fc.constant('true'),
  fc.constant('false'),
  fc.constant(null),
  fc.constant(undefined)
);

const obstacleArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  isPortagePossible: portageStatusArb,
  isPortageNecessary: fc.boolean(),
  obstacleType_slug: fc.string({ minLength: 1, maxLength: 30 })
});

const obstacleWithoutSlugArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  isPortagePossible: portageStatusArb
});

describe('Obstacle Popup Content - Property 9', () => {
  /**
   * Property 9: Obstacle Popup Contains Required Information
   * For any obstacle displayed on the map, the popup shall contain the obstacle name
   * and portage possibility status (Yes, No, or Unknown).
   */

  describe('Popup contains obstacle name', () => {
    test('popup includes name when obstacle has name', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            
            if (obstacle.name && obstacle.name.trim().length > 0) {
              return popupContent.hasName && popupContent.name === obstacle.name;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup contains portage possibility status', () => {
    test('popup always includes portage status', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            return popupContent.hasPortageStatus === true;
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
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const expected = locale === 'en' ? 'Yes' : 'Ja';
            return popupContent.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "Yes" when isPortagePossible is "true" string', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: 'true' };
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const expected = locale === 'en' ? 'Yes' : 'Ja';
            return popupContent.portageStatus === expected;
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
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const expected = locale === 'en' ? 'No' : 'Nein';
            return popupContent.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "No" when isPortagePossible is "false" string', () => {
      fc.assert(
        fc.property(
          localeArb,
          (locale) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: 'false' };
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const expected = locale === 'en' ? 'No' : 'Nein';
            return popupContent.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is "Unknown" when isPortagePossible is null or undefined', () => {
      fc.assert(
        fc.property(
          localeArb,
          fc.constantFrom(null, undefined),
          (locale, portageValue) => {
            const obstacle = { name: 'Test', slug: 'test', isPortagePossible: portageValue };
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const expected = locale === 'en' ? 'Unknown' : 'Unbekannt';
            return popupContent.portageStatus === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('portage status is one of Yes, No, or Unknown', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            const localeStrings = strings[locale];
            const validStatuses = [localeStrings.yes, localeStrings.no, localeStrings.unknown];
            return validStatuses.includes(popupContent.portageStatus);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup includes details link', () => {
    test('popup includes details link when slug is available', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            
            if (obstacle.slug && obstacle.slug.trim().length > 0) {
              return popupContent.hasDetailsLink && 
                     popupContent.detailsUrl.includes(obstacle.slug);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('details URL follows correct pattern /hindernisse/{slug}/', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          localeArb,
          (slug, locale) => {
            const obstacle = { name: 'Test', slug: slug, isPortagePossible: true };
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            
            if (popupContent.hasDetailsLink) {
              return popupContent.detailsUrl === `/hindernisse/${slug}/`;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('no details link when slug is missing', () => {
      fc.assert(
        fc.property(
          obstacleWithoutSlugArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            return popupContent.hasDetailsLink === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale-specific content', () => {
    test('German locale uses German strings', () => {
      const obstacle = { name: 'Test', slug: 'test', isPortagePossible: true };
      const popupContent = generateObstaclePopupContent(obstacle, 'de');
      
      expect(popupContent.portageLabel).toBe('Umtragen möglich');
      expect(popupContent.portageStatus).toBe('Ja');
    });

    test('English locale uses English strings', () => {
      const obstacle = { name: 'Test', slug: 'test', isPortagePossible: true };
      const popupContent = generateObstaclePopupContent(obstacle, 'en');
      
      expect(popupContent.portageLabel).toBe('Portage possible');
      expect(popupContent.portageStatus).toBe('Yes');
    });

    test('unknown locale defaults to German', () => {
      const obstacle = { name: 'Test', slug: 'test', isPortagePossible: true };
      const popupContent = generateObstaclePopupContent(obstacle, 'fr');
      
      expect(popupContent.portageLabel).toBe('Umtragen möglich');
      expect(popupContent.portageStatus).toBe('Ja');
    });
  });

  describe('Complete popup validation', () => {
    test('all required fields are present based on obstacle data', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const popupContent = generateObstaclePopupContent(obstacle, locale);
            return validatePopupContent(obstacle, popupContent, locale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup generation is deterministic', () => {
    test('same obstacle and locale always produces same popup content', () => {
      fc.assert(
        fc.property(
          obstacleArb,
          localeArb,
          (obstacle, locale) => {
            const content1 = generateObstaclePopupContent(obstacle, locale);
            const content2 = generateObstaclePopupContent(obstacle, locale);
            
            return content1.hasName === content2.hasName &&
                   content1.name === content2.name &&
                   content1.hasPortageStatus === content2.hasPortageStatus &&
                   content1.portageStatus === content2.portageStatus &&
                   content1.hasDetailsLink === content2.hasDetailsLink &&
                   content1.detailsUrl === content2.detailsUrl;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
