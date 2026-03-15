/**
 * Property-Based Tests for Protected Area Popup Content
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 12: Protected Area Popup Contains Required Information**
 * **Validates: Requirements 6.2**
 * 
 * Property: For any protected area displayed on the map, the popup shall contain the protected area name and type.
 */

const fc = require('fast-check');

/**
 * Localized strings for popup content (mirrors layer-control.html)
 */
const strings = {
  de: {
    defaultName: 'Schutzgebiet'
  },
  en: {
    defaultName: 'Protected Area'
  }
};

/**
 * Generates the popup content object for a protected area.
 * This simulates what the layer-control.html include would render.
 * 
 * @param {Object} protectedArea - The protected area data object
 * @param {string} locale - The current locale ('de' or 'en')
 * @param {Object} [typeNames={}] - Lookup map from slug to translated type name (built from protected_area_types data)
 * @returns {Object} Object containing the popup content fields
 */
function generateProtectedAreaPopupContent(protectedArea, locale, typeNames) {
  typeNames = typeNames || {};
  const localeStrings = strings[locale] || strings.de;
  
  const content = {
    hasName: false,
    hasType: false,
    name: null,
    typeName: null
  };

  // Name is always required (Requirement 6.2)
  // Use provided name or fall back to localized default
  if (protectedArea.name && protectedArea.name.trim().length > 0) {
    content.hasName = true;
    content.name = protectedArea.name;
  } else {
    // Default name is used when no name provided
    content.hasName = true;
    content.name = localeStrings.defaultName;
  }

  // Protected area type (Requirement 6.2)
  // Check multiple possible field names for type, resolving slug via typeNames lookup
  let typeName = null;
  if (protectedArea.protectedAreaType_name) {
    typeName = protectedArea.protectedAreaType_name;
  } else if (protectedArea.protectedAreaType && protectedArea.protectedAreaType.name) {
    typeName = protectedArea.protectedAreaType.name;
  } else if (protectedArea.protectedAreaType_slug && Object.prototype.hasOwnProperty.call(typeNames, protectedArea.protectedAreaType_slug)) {
    // Resolve slug to translated name via lookup map
    typeName = typeNames[protectedArea.protectedAreaType_slug];
  } else if (protectedArea.protectedAreaType_slug) {
    // Final fallback to slug if no translation found
    typeName = protectedArea.protectedAreaType_slug;
  }
  
  if (typeName && typeName.trim().length > 0) {
    content.hasType = true;
    content.typeName = typeName;
  }

  return content;
}

/**
 * Validates that a protected area popup contains all required information
 * 
 * @param {Object} protectedArea - The protected area data
 * @param {Object} popupContent - The generated popup content
 * @param {string} locale - The current locale
 * @returns {boolean} True if all required fields are present
 */
function validatePopupContent(protectedArea, popupContent, locale) {
  const localeStrings = strings[locale] || strings.de;
  
  // Name must always be present (either from data or default)
  if (!popupContent.hasName || !popupContent.name) {
    return false;
  }

  // If protected area has a name, it should match
  if (protectedArea.name && protectedArea.name.trim().length > 0) {
    if (popupContent.name !== protectedArea.name) {
      return false;
    }
  } else {
    // Should use default name
    if (popupContent.name !== localeStrings.defaultName) {
      return false;
    }
  }

  // Type should be present if provided in any form
  const hasTypeData = protectedArea.protectedAreaType_name || 
                      (protectedArea.protectedAreaType && protectedArea.protectedAreaType.name) ||
                      protectedArea.protectedAreaType_slug;
  
  if (hasTypeData) {
    if (!popupContent.hasType || !popupContent.typeName) {
      return false;
    }
  }

  return true;
}

// Arbitraries for generating test data
const localeArb = fc.constantFrom('de', 'en');

const protectedAreaTypeArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0)
});

// Protected area with nested type object (like from Contentful)
const protectedAreaWithNestedTypeArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.constant('{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}'),
  protectedAreaType: protectedAreaTypeArb,
  isAreaMarked: fc.boolean()
});

// Protected area with flat type fields (like from Jekyll data)
const protectedAreaWithFlatTypeArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.constant('{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}'),
  protectedAreaType_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  protectedAreaType_slug: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  isAreaMarked: fc.boolean()
});

// Protected area with only slug for type (fallback case)
const protectedAreaWithTypeSlugOnlyArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.constant('{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}'),
  protectedAreaType_slug: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0)
});

// Protected area without type information
const protectedAreaWithoutTypeArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  geometry: fc.constant('{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}')
});

// Protected area without name (should use default)
const protectedAreaWithoutNameArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  geometry: fc.constant('{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}'),
  protectedAreaType_name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
});

// Combined arbitrary for any valid protected area
const protectedAreaArb = fc.oneof(
  protectedAreaWithNestedTypeArb,
  protectedAreaWithFlatTypeArb,
  protectedAreaWithTypeSlugOnlyArb
);

describe('Protected Area Popup Content - Property 12', () => {
  /**
   * Property 12: Protected Area Popup Contains Required Information
   * For any protected area displayed on the map, the popup shall contain the protected area name and type.
   */

  describe('Popup contains protected area name', () => {
    test('popup includes name when protected area has name', () => {
      fc.assert(
        fc.property(
          protectedAreaArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            
            if (protectedArea.name && protectedArea.name.trim().length > 0) {
              return popupContent.hasName && popupContent.name === protectedArea.name;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup uses default name when protected area has no name', () => {
      fc.assert(
        fc.property(
          protectedAreaWithoutNameArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            const expectedDefault = locale === 'en' ? 'Protected Area' : 'Schutzgebiet';
            
            return popupContent.hasName && popupContent.name === expectedDefault;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup always has a name (either from data or default)', () => {
      fc.assert(
        fc.property(
          fc.oneof(protectedAreaArb, protectedAreaWithoutNameArb),
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            return popupContent.hasName === true && popupContent.name !== null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup contains protected area type', () => {
    test('popup includes type when protectedAreaType.name is available (nested)', () => {
      fc.assert(
        fc.property(
          protectedAreaWithNestedTypeArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            
            return popupContent.hasType && 
                   popupContent.typeName === protectedArea.protectedAreaType.name;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup includes type when protectedAreaType_name is available (flat)', () => {
      fc.assert(
        fc.property(
          protectedAreaWithFlatTypeArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            
            return popupContent.hasType && 
                   popupContent.typeName === protectedArea.protectedAreaType_name;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup resolves type slug to translated name via lookup map', () => {
      fc.assert(
        fc.property(
          protectedAreaWithTypeSlugOnlyArb,
          localeArb,
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          (protectedArea, locale, translatedName) => {
            const typeNames = Object.create(null);
            typeNames[protectedArea.protectedAreaType_slug] = translatedName;
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale, typeNames);
            
            return popupContent.hasType && 
                   popupContent.typeName === translatedName;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup falls back to type slug when no translation found in lookup', () => {
      fc.assert(
        fc.property(
          protectedAreaWithTypeSlugOnlyArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale, {});
            
            return popupContent.hasType && 
                   popupContent.typeName === protectedArea.protectedAreaType_slug;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('popup has no type when type information is missing', () => {
      fc.assert(
        fc.property(
          protectedAreaWithoutTypeArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            
            return popupContent.hasType === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Locale-specific content', () => {
    test('German locale uses German default name', () => {
      const protectedArea = { slug: 'test', geometry: '{}' };
      const popupContent = generateProtectedAreaPopupContent(protectedArea, 'de');
      
      expect(popupContent.name).toBe('Schutzgebiet');
    });

    test('English locale uses English default name', () => {
      const protectedArea = { slug: 'test', geometry: '{}' };
      const popupContent = generateProtectedAreaPopupContent(protectedArea, 'en');
      
      expect(popupContent.name).toBe('Protected Area');
    });

    test('unknown locale defaults to German', () => {
      const protectedArea = { slug: 'test', geometry: '{}' };
      const popupContent = generateProtectedAreaPopupContent(protectedArea, 'fr');
      
      expect(popupContent.name).toBe('Schutzgebiet');
    });
  });

  describe('Complete popup validation', () => {
    test('all required fields are present based on protected area data', () => {
      fc.assert(
        fc.property(
          protectedAreaArb,
          localeArb,
          (protectedArea, locale) => {
            const popupContent = generateProtectedAreaPopupContent(protectedArea, locale);
            return validatePopupContent(protectedArea, popupContent, locale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Popup generation is deterministic', () => {
    test('same protected area and locale always produces same popup content', () => {
      fc.assert(
        fc.property(
          protectedAreaArb,
          localeArb,
          (protectedArea, locale) => {
            const content1 = generateProtectedAreaPopupContent(protectedArea, locale);
            const content2 = generateProtectedAreaPopupContent(protectedArea, locale);
            
            return content1.hasName === content2.hasName &&
                   content1.name === content2.name &&
                   content1.hasType === content2.hasType &&
                   content1.typeName === content2.typeName;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Type field priority', () => {
    test('protectedAreaType_name takes priority over nested type', () => {
      const protectedArea = {
        slug: 'test',
        name: 'Test Area',
        geometry: '{}',
        protectedAreaType_name: 'Flat Type Name',
        protectedAreaType: { name: 'Nested Type Name', slug: 'nested-slug' }
      };
      
      const popupContent = generateProtectedAreaPopupContent(protectedArea, 'de');
      
      expect(popupContent.typeName).toBe('Flat Type Name');
    });

    test('nested type.name takes priority over slug only', () => {
      const protectedArea = {
        slug: 'test',
        name: 'Test Area',
        geometry: '{}',
        protectedAreaType: { name: 'Nested Type Name', slug: 'nested-slug' },
        protectedAreaType_slug: 'flat-slug'
      };
      
      const popupContent = generateProtectedAreaPopupContent(protectedArea, 'de');
      
      expect(popupContent.typeName).toBe('Nested Type Name');
    });
  });
});
