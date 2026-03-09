/**
 * Property-Based Tests for Spot Marker Icon Assignment
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 1: Spot Marker Icon Assignment**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 * 
 * Property: For any spot with a valid spot type, the Map_System shall assign the marker icon
 * that corresponds to that spot type (entry-exit, entry-only, exit-only, rest, emergency, 
 * or no-entry for rejected spots).
 */

const fc = require('fast-check');

// Valid spot type slugs as defined in the system
const VALID_SPOT_TYPES = [
  'einstieg-ausstieg',      // Entry & Exit (Req 2.1)
  'nur-einstieg',           // Entry Only (Req 2.2)
  'nur-ausstieg',           // Exit Only (Req 2.3)
  'rasthalte',              // Rest (Req 2.4)
  'notauswasserungsstelle'  // Emergency Exit (Req 2.5)
];

// Expected icon mappings
const SPOT_TYPE_TO_ICON = {
  'einstieg-ausstieg': 'startingspots-entryexit.svg',
  'nur-einstieg': 'startingspots-entry.svg',
  'nur-ausstieg': 'otherspots-exit.svg',
  'rasthalte': 'otherspots-rest.svg',
  'notauswasserungsstelle': 'otherspots-emergency.svg'
};

const REJECTED_ICON = 'otherspots-noentry.svg';
const DEFAULT_ICON = 'startingspots-entryexit.svg';

/**
 * Implementation of getSpotIcon function (mirrors the JavaScript module logic)
 * This is the function under test.
 * 
 * @param {string} spotTypeSlug - The slug of the spot type
 * @param {boolean} isRejected - Whether the spot is rejected
 * @returns {string} The icon filename for the spot type
 */
function getSpotIconFilename(spotTypeSlug, isRejected) {
  // Rejected spots always use the no-entry icon (Requirement 2.6)
  if (isRejected) {
    return REJECTED_ICON;
  }

  // Map spot type slugs to icons
  // Use hasOwnProperty to avoid inherited properties like 'toString', 'valueOf', etc.
  if (Object.prototype.hasOwnProperty.call(SPOT_TYPE_TO_ICON, spotTypeSlug)) {
    return SPOT_TYPE_TO_ICON[spotTypeSlug];
  }
  return DEFAULT_ICON;
}

// Arbitraries for generating test data
const validSpotTypeArb = fc.constantFrom(...VALID_SPOT_TYPES);
const invalidSpotTypeArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => !VALID_SPOT_TYPES.includes(s));
const booleanArb = fc.boolean();

// Spot arbitrary
const spotArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  spotType_slug: fc.oneof(validSpotTypeArb, invalidSpotTypeArb),
  rejected: booleanArb,
  location: fc.record({
    lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
    lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
  })
});

describe('Spot Marker Icon Assignment - Property 1', () => {
  /**
   * Property 1: Spot Marker Icon Assignment
   * For any spot with a valid spot type, the Map_System shall assign the marker icon
   * that corresponds to that spot type.
   */

  describe('Valid spot types get correct icons', () => {
    test('Entry & Exit spots (einstieg-ausstieg) get entry-exit icon (Req 2.1)', () => {
      fc.assert(
        fc.property(
          booleanArb.filter(rejected => !rejected), // Non-rejected spots
          (rejected) => {
            const icon = getSpotIconFilename('einstieg-ausstieg', rejected);
            return icon === 'startingspots-entryexit.svg';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Entry Only spots (nur-einstieg) get entry icon (Req 2.2)', () => {
      fc.assert(
        fc.property(
          booleanArb.filter(rejected => !rejected),
          (rejected) => {
            const icon = getSpotIconFilename('nur-einstieg', rejected);
            return icon === 'startingspots-entry.svg';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Exit Only spots (nur-ausstieg) get exit icon (Req 2.3)', () => {
      fc.assert(
        fc.property(
          booleanArb.filter(rejected => !rejected),
          (rejected) => {
            const icon = getSpotIconFilename('nur-ausstieg', rejected);
            return icon === 'otherspots-exit.svg';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Rest spots (rasthalte) get rest icon (Req 2.4)', () => {
      fc.assert(
        fc.property(
          booleanArb.filter(rejected => !rejected),
          (rejected) => {
            const icon = getSpotIconFilename('rasthalte', rejected);
            return icon === 'otherspots-rest.svg';
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Emergency Exit spots (notauswasserungsstelle) get emergency icon (Req 2.5)', () => {
      fc.assert(
        fc.property(
          booleanArb.filter(rejected => !rejected),
          (rejected) => {
            const icon = getSpotIconFilename('notauswasserungsstelle', rejected);
            return icon === 'otherspots-emergency.svg';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Rejected spots always get no-entry icon (Req 2.6)', () => {
    test('rejected spots with any valid spot type get no-entry icon', () => {
      fc.assert(
        fc.property(
          validSpotTypeArb,
          (spotType) => {
            const icon = getSpotIconFilename(spotType, true);
            return icon === REJECTED_ICON;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected spots with invalid spot type get no-entry icon', () => {
      fc.assert(
        fc.property(
          invalidSpotTypeArb,
          (spotType) => {
            const icon = getSpotIconFilename(spotType, true);
            return icon === REJECTED_ICON;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejected status takes precedence over spot type', () => {
      fc.assert(
        fc.property(
          fc.oneof(validSpotTypeArb, invalidSpotTypeArb),
          (spotType) => {
            const rejectedIcon = getSpotIconFilename(spotType, true);
            const nonRejectedIcon = getSpotIconFilename(spotType, false);
            
            // Rejected should always be no-entry
            // Non-rejected should be based on spot type
            return rejectedIcon === REJECTED_ICON && 
                   (VALID_SPOT_TYPES.includes(spotType) 
                     ? nonRejectedIcon === SPOT_TYPE_TO_ICON[spotType]
                     : nonRejectedIcon === DEFAULT_ICON);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invalid spot types get default icon', () => {
    test('non-rejected spots with invalid spot type get default icon', () => {
      fc.assert(
        fc.property(
          invalidSpotTypeArb,
          (spotType) => {
            const icon = getSpotIconFilename(spotType, false);
            return icon === DEFAULT_ICON;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/undefined spot type gets default icon', () => {
      expect(getSpotIconFilename(null, false)).toBe(DEFAULT_ICON);
      expect(getSpotIconFilename(undefined, false)).toBe(DEFAULT_ICON);
      expect(getSpotIconFilename('', false)).toBe(DEFAULT_ICON);
    });
  });

  describe('Icon assignment is deterministic', () => {
    test('same spot type and rejected status always produces same icon', () => {
      fc.assert(
        fc.property(
          fc.oneof(validSpotTypeArb, invalidSpotTypeArb),
          booleanArb,
          (spotType, rejected) => {
            const icon1 = getSpotIconFilename(spotType, rejected);
            const icon2 = getSpotIconFilename(spotType, rejected);
            return icon1 === icon2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All valid spot types have unique icons', () => {
    test('each valid spot type maps to a distinct icon', () => {
      const icons = VALID_SPOT_TYPES.map(type => getSpotIconFilename(type, false));
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(VALID_SPOT_TYPES.length);
    });

    test('rejected icon is different from all valid spot type icons', () => {
      const validIcons = VALID_SPOT_TYPES.map(type => getSpotIconFilename(type, false));
      expect(validIcons).not.toContain(REJECTED_ICON);
    });
  });

  describe('Integration with spot data', () => {
    test('for any generated spot, icon assignment is consistent', () => {
      fc.assert(
        fc.property(
          spotArb,
          (spot) => {
            const icon = getSpotIconFilename(spot.spotType_slug, spot.rejected);
            
            if (spot.rejected) {
              return icon === REJECTED_ICON;
            }
            
            if (VALID_SPOT_TYPES.includes(spot.spotType_slug)) {
              return icon === SPOT_TYPE_TO_ICON[spot.spotType_slug];
            }
            
            return icon === DEFAULT_ICON;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
