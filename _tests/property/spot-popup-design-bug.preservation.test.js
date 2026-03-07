/**
 * Preservation Property Tests — Spot Popup Design Fix
 *
 * **Property 2: Preservation** — Existing Functional Behavior Unchanged
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * These tests run on UNFIXED code to establish the baseline behavior that
 * must be preserved after the fix is applied.
 *
 * EXPECTED OUTCOME: All tests PASS on unfixed code.
 */

const fc = require('fast-check');

// --- Minimal DOM mock for escapeHtml() ---
global.document = {
  createElement: function () {
    return {
      textContent: '',
      get innerHTML() {
        return this.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
    };
  }
};

// Load the module
const spotPopupModule = require('../../assets/js/spot-popup.js');
const PaddelbuchSpotPopup =
  global.PaddelbuchSpotPopup || spotPopupModule.PaddelbuchSpotPopup || spotPopupModule;
const { generateSpotPopupContent, generateRejectedSpotPopupContent } = PaddelbuchSpotPopup;

// --- Known valid slugs from data files ---
const SPOT_TYPE_SLUGS = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle'
];

const CRAFT_TYPE_SLUGS = ['seekajak', 'kanadier', 'stand-up-paddle-board'];

const LOCALES = ['de', 'en'];

// --- fast-check arbitraries ---

/** Generates a random spot name (safe alphanumeric + spaces) */
const arbSpotName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
  { minLength: 1, maxLength: 40 }
);

/** Generates a random slug */
const arbSlug = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 3, maxLength: 30 }
);

/** Generates a latitude in valid range */
const arbLat = fc.double({ min: 45.5, max: 48.0, noNaN: true, noDefaultInfinity: true });

/** Generates a longitude in valid range */
const arbLon = fc.double({ min: 5.5, max: 10.5, noNaN: true, noDefaultInfinity: true });

/** Generates an optional location object or null */
const arbLocation = fc.oneof(
  fc.constant(null),
  fc.record({ lat: arbLat, lon: arbLon })
);

/** Generates an optional description (HTML string) or falsy */
const arbDescription = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
    { minLength: 1, maxLength: 100 }
  ).map(s => '<p>' + s + '</p>')
);

/** Generates an optional address or falsy */
const arbAddress = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,'.split('')),
    { minLength: 5, maxLength: 60 }
  )
);

/** Generates an optional array of craft type slugs or falsy */
const arbCraftTypes = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant([]),
  fc.subarray(CRAFT_TYPE_SLUGS, { minLength: 1, maxLength: 3 })
);

/** Generates a locale */
const arbLocale = fc.constantFrom(...LOCALES);

/** Generates a full non-rejected spot object */
const arbSpot = fc.record({
  name: arbSpotName,
  slug: arbSlug,
  description: arbDescription,
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
  rejected: fc.constant(false),
  location: arbLocation,
  approximateAddress: arbAddress,
  paddleCraftTypes: arbCraftTypes
});

/** Generates a rejected spot object */
const arbRejectedSpot = fc.record({
  name: arbSpotName,
  slug: arbSlug,
  description: arbDescription,
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
  rejected: fc.constant(true),
  location: arbLocation,
  approximateAddress: arbAddress,
  paddleCraftTypes: arbCraftTypes
});


// ============================================================================
// PRESERVATION PROPERTY TESTS
// ============================================================================

describe('Preservation Property Tests — Spot Popup Design (Property 2)', () => {

  /**
   * **Validates: Requirements 3.1**
   * Spots without description omit the description section.
   */
  describe('3.1 — Spots without description omit description section', () => {
    test('property: no description field → no description section in HTML', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: fc.constantFrom(undefined, null, ''),
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.record({ lat: arbLat, lon: arbLon }),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            // Description section must NOT appear
            expect(html).not.toContain('spot-popup-description');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: spot WITH description → description section IS present', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
              { minLength: 1, maxLength: 100 }
            ).map(s => '<p>' + s + '</p>'),
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.record({ lat: arbLat, lon: arbLon }),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).toContain('spot-popup-description');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.2**
   * Spots without GPS omit the GPS section and navigate button.
   */
  describe('3.2 — Spots without GPS omit GPS section and navigate button', () => {
    test('property: no location → no GPS section and no navigate button', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.constant(null),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).not.toContain('spot-popup-gps');
            expect(html).not.toContain('navigate-btn');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: spot WITH location → GPS section and navigate button ARE present', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.record({ lat: arbLat, lon: arbLon }),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).toContain('spot-popup-gps');
            expect(html).toContain('navigate-btn');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.3**
   * Spots without address omit the address section.
   */
  describe('3.3 — Spots without address omit address section', () => {
    test('property: no address → no address section in HTML', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: arbLocation,
            approximateAddress: fc.constantFrom(undefined, null, ''),
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).not.toContain('spot-popup-address');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: spot WITH address → address section IS present', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: arbLocation,
            approximateAddress: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,'.split('')),
              { minLength: 5, maxLength: 60 }
            ),
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).toContain('spot-popup-address');
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  /**
   * **Validates: Requirements 3.4**
   * Spots without craft types omit the craft types section.
   */
  describe('3.4 — Spots without craft types omit craft types section', () => {
    test('property: no craft types → no craft types section in HTML', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: arbLocation,
            approximateAddress: arbAddress,
            paddleCraftTypes: fc.constantFrom(undefined, null, [])
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).not.toContain('spot-popup-craft-types');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: spot WITH craft types → craft types section IS present', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: arbLocation,
            approximateAddress: arbAddress,
            paddleCraftTypes: fc.subarray(CRAFT_TYPE_SLUGS, { minLength: 1, maxLength: 3 })
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            expect(html).toContain('spot-popup-craft-types');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.5**
   * Rejected spots render the rejection-specific popup layout with no-entry icon
   * and rejection reason.
   */
  describe('3.5 — Rejected spot popup layout is preserved', () => {
    test('property: rejected spot uses no-entry icon and rejection-specific layout', () => {
      fc.assert(
        fc.property(
          arbRejectedSpot,
          arbLocale,
          (spot, locale) => {
            const html = generateRejectedSpotPopupContent(spot, locale);

            // Must have the rejected-spot-popup class
            expect(html).toContain('rejected-spot-popup');

            // Must use the no-entry icon
            expect(html).toContain('noentry');

            // Must NOT have GPS, address, craft types, or navigate sections
            expect(html).not.toContain('spot-popup-gps');
            expect(html).not.toContain('spot-popup-address');
            expect(html).not.toContain('spot-popup-craft-types');
            expect(html).not.toContain('navigate-btn');
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: rejected spot with description shows rejection reason', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
              { minLength: 1, maxLength: 100 }
            ).map(s => '<p>' + s + '</p>'),
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(true),
            location: arbLocation,
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateRejectedSpotPopupContent(spot, locale);
            expect(html).toContain('rejection-reason');
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  /**
   * **Validates: Requirements 3.6**
   * "More details" link points to the correct spot detail page with locale prefix.
   */
  describe('3.6 — Detail page link format is preserved with correct locale prefix', () => {
    test('property: de locale → detail link has no locale prefix', () => {
      fc.assert(
        fc.property(
          arbSpot,
          (spot) => {
            const html = generateSpotPopupContent(spot, 'de');
            if (spot.slug) {
              const linkRegex = new RegExp(
                'href="(/einstiegsorte/' + spot.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/)"'
              );
              expect(html).toMatch(linkRegex);
              // Must NOT have /de/ prefix for German locale
              expect(html).not.toContain('href="/de/einstiegsorte/');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: en locale → detail link has /en prefix', () => {
      fc.assert(
        fc.property(
          arbSpot,
          (spot) => {
            const html = generateSpotPopupContent(spot, 'en');
            if (spot.slug) {
              const linkRegex = new RegExp(
                'href="(/en/einstiegsorte/' + spot.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/)"'
              );
              expect(html).toMatch(linkRegex);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: rejected spot detail link also uses correct locale prefix', () => {
      fc.assert(
        fc.property(
          arbRejectedSpot,
          arbLocale,
          (spot, locale) => {
            const html = generateRejectedSpotPopupContent(spot, locale);
            if (spot.slug) {
              const expectedPrefix = locale === 'de' ? '' : '/' + locale;
              const expectedHref = expectedPrefix + '/einstiegsorte/' + spot.slug + '/';
              expect(html).toContain('href="' + expectedHref + '"');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.7 (navigation URL)**
   * Navigate button links to Google Maps with correct coordinates.
   */
  describe('3.7a — Navigation URL format is preserved with correct coordinates', () => {
    test('property: navigate button links to Google Maps with spot coordinates', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.record({ lat: arbLat, lon: arbLon }),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            const expectedUrl =
              'https://www.google.com/maps/dir/?api=1&destination=' +
              spot.location.lat + ',' + spot.location.lon;
            expect(html).toContain(expectedUrl);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 3.7 (clipboard copy)**
   * Copy button click handler copies the correct GPS/address value to clipboard.
   */
  describe('3.7b — Clipboard copy functionality is preserved', () => {
    test('property: GPS copy button calls PaddelbuchClipboard.copyGPS with correct coords', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: fc.record({ lat: arbLat, lon: arbLon }),
            approximateAddress: arbAddress,
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            const expectedCall =
              "PaddelbuchClipboard.copyGPS('" + spot.location.lat + "', '" + spot.location.lon + "'";
            expect(html).toContain(expectedCall);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('property: address copy button calls PaddelbuchClipboard.copyAddress with correct value', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: arbSpotName,
            slug: arbSlug,
            description: arbDescription,
            spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS),
            rejected: fc.constant(false),
            location: arbLocation,
            approximateAddress: fc.stringOf(
              fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,'.split('')),
              { minLength: 5, maxLength: 60 }
            ),
            paddleCraftTypes: arbCraftTypes
          }),
          arbLocale,
          (spot, locale) => {
            const html = generateSpotPopupContent(spot, locale);
            const expectedCall = "PaddelbuchClipboard.copyAddress('" + spot.approximateAddress + "'";
            expect(html).toContain(expectedCall);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

}); // end describe
