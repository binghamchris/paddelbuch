/**
 * Preservation Property Tests -- Spot Popup Design Fix
 *
 * **Property 2: Preservation** -- Existing Functional Behavior Unchanged
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * Tests use the Gatsby HTML structure (popup-btn, popup-icon-div, etc.)
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

const htmlUtilsModule = require('../../assets/js/html-utils.js');
global.PaddelbuchHtmlUtils = global.PaddelbuchHtmlUtils || htmlUtilsModule.PaddelbuchHtmlUtils || htmlUtilsModule;
const spotPopupModule = require('../../assets/js/spot-popup.js');
const PaddelbuchSpotPopup =
  global.PaddelbuchSpotPopup || spotPopupModule.PaddelbuchSpotPopup || spotPopupModule;
const { generateSpotPopupContent, generateRejectedSpotPopupContent } = PaddelbuchSpotPopup;

const SPOT_TYPE_SLUGS = [
  'einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg',
  'rasthalte', 'notauswasserungsstelle'
];
const CRAFT_TYPE_SLUGS = ['seekajak', 'kanadier', 'stand-up-paddle-board'];
const LOCALES = ['de', 'en'];

// --- fast-check arbitraries ---
const arbSpotName = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
  minLength: 1, maxLength: 40
});
const arbSlug = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  minLength: 3, maxLength: 30
});
const arbLat = fc.double({ min: 45.5, max: 48.0, noNaN: true, noDefaultInfinity: true });
const arbLon = fc.double({ min: 5.5, max: 10.5, noNaN: true, noDefaultInfinity: true });
const arbLocation = fc.oneof(fc.constant(null), fc.record({ lat: arbLat, lon: arbLon }));
const arbDescription = fc.oneof(
  fc.constant(undefined), fc.constant(null), fc.constant(''),
  fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), minLength: 1, maxLength: 100 }).map(s => '<p>' + s + '</p>')
);
const arbAddress = fc.oneof(
  fc.constant(undefined), fc.constant(null), fc.constant(''),
  fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,'.split('')), minLength: 5, maxLength: 60 })
);
const arbCraftTypes = fc.oneof(
  fc.constant(undefined), fc.constant(null), fc.constant([]),
  fc.subarray(CRAFT_TYPE_SLUGS, { minLength: 1, maxLength: 3 })
);
const arbLocale = fc.constantFrom(...LOCALES);
const arbSpot = fc.record({
  name: arbSpotName, slug: arbSlug, description: arbDescription,
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
  location: arbLocation, approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
});
const arbRejectedSpot = fc.record({
  name: arbSpotName, slug: arbSlug, description: arbDescription,
  spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(true),
  location: arbLocation, approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
});

describe('Preservation Property Tests -- Spot Popup Design (Property 2)', () => {

  describe('3.1 -- Spots without description omit description section', () => {
    test('property: no description -> no <p> content after popup-title', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug, description: fc.constantFrom(undefined, null, ''),
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
          location: fc.record({ lat: arbLat, lon: arbLon }),
          approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateSpotPopupContent(spot, locale);
          // After the title h1, there should be no <div><p> description block
          const afterTitle = html.split('</h1></span>')[1] || '';
          expect(afterTitle).not.toMatch(/^<div><p>/);
        }
      ), { numRuns: 50 });
    });

    test('property: spot WITH description -> description paragraph IS present', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug,
          description: fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), minLength: 1, maxLength: 100 }).map(s => '<p>' + s + '</p>'),
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
          location: fc.record({ lat: arbLat, lon: arbLon }),
          approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateSpotPopupContent(spot, locale);
          const afterTitle = html.split('</h1></span>')[1] || '';
          expect(afterTitle).toMatch(/<div><p>/);
        }
      ), { numRuns: 50 });
    });
  });

  describe('3.2 -- Spots without GPS omit navigate button', () => {
    test('property: no location -> no navigate button', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug, description: arbDescription,
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
          location: fc.constant(null), approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateSpotPopupContent(spot, locale);
          expect(html).not.toContain('google.com/maps/dir');
        }
      ), { numRuns: 50 });
    });

    test('property: spot WITH location -> navigate button IS present', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug, description: arbDescription,
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
          location: fc.record({ lat: arbLat, lon: arbLon }),
          approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateSpotPopupContent(spot, locale);
          expect(html).toContain('google.com/maps/dir');
        }
      ), { numRuns: 50 });
    });
  });

  describe('3.5 -- Rejected spot popup layout matches Gatsby design', () => {
    test('property: rejected spot uses popup-icon-div with no-entry icon and popup-title', () => {
      fc.assert(fc.property(arbRejectedSpot, arbLocale, (spot, locale) => {
        const html = generateRejectedSpotPopupContent(spot, locale);
        expect(html).toContain('popup-icon-div');
        expect(html).toContain('noentry');
        expect(html).toContain('popup-title');
        expect(html).not.toContain('>GPS:<');
        expect(html).not.toContain('google.com/maps/dir');
      }), { numRuns: 50 });
    });

    test('property: rejected spot with description shows rejection reason in simple div/p', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug,
          description: fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), minLength: 1, maxLength: 100 }).map(s => '<p>' + s + '</p>'),
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(true),
          location: arbLocation, approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateRejectedSpotPopupContent(spot, locale);
          // Description is in a simple <div><p>...</p></div> (Gatsby structure)
          expect(html).toMatch(/<div><p>.+<\/p><\/div>/);
        }
      ), { numRuns: 50 });
    });

    test('property: rejected spot shows "No Entry Spot" / "Kein Zutritt Ort" label', () => {
      fc.assert(fc.property(arbRejectedSpot, arbLocale, (spot, locale) => {
        const html = generateRejectedSpotPopupContent(spot, locale);
        if (locale === 'en') {
          expect(html).toContain('No Entry Spot');
        } else {
          expect(html).toContain('Kein Zutritt Ort');
        }
      }), { numRuns: 50 });
    });
  });

  describe('3.6 -- Detail page link format is preserved with correct locale prefix', () => {
    test('property: de locale -> detail link has no locale prefix', () => {
      fc.assert(fc.property(arbSpot, (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        if (spot.slug) {
          expect(html).toContain('href="/einstiegsorte/' + spot.slug + '/"');
          expect(html).not.toContain('href="/de/einstiegsorte/');
        }
      }), { numRuns: 50 });
    });

    test('property: en locale -> detail link has /en prefix', () => {
      fc.assert(fc.property(arbSpot, (spot) => {
        const html = generateSpotPopupContent(spot, 'en');
        if (spot.slug) {
          expect(html).toContain('href="/en/einstiegsorte/' + spot.slug + '/"');
        }
      }), { numRuns: 50 });
    });

    test('property: rejected spot detail link uses correct locale prefix', () => {
      fc.assert(fc.property(arbRejectedSpot, arbLocale, (spot, locale) => {
        const html = generateRejectedSpotPopupContent(spot, locale);
        if (spot.slug) {
          const expectedPrefix = locale === 'de' ? '' : '/' + locale;
          expect(html).toContain('href="' + expectedPrefix + '/einstiegsorte/' + spot.slug + '/"');
        }
      }), { numRuns: 50 });
    });
  });

  describe('3.7a -- Navigation URL format is preserved with correct coordinates', () => {
    test('property: navigate button links to Google Maps with spot coordinates', () => {
      fc.assert(fc.property(
        fc.record({
          name: arbSpotName, slug: arbSlug, description: arbDescription,
          spotType_slug: fc.constantFrom(...SPOT_TYPE_SLUGS), rejected: fc.constant(false),
          location: fc.record({ lat: arbLat, lon: arbLon }),
          approximateAddress: arbAddress, paddleCraftTypes: arbCraftTypes
        }),
        arbLocale,
        (spot, locale) => {
          const html = generateSpotPopupContent(spot, locale);
          const expectedUrl = 'https://www.google.com/maps/dir/?api=1&destination=' +
            spot.location.lat + ',' + spot.location.lon;
          expect(html).toContain(expectedUrl);
        }
      ), { numRuns: 50 });
    });
  });

});
