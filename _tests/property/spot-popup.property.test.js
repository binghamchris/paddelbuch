/**
 * Property-Based Tests for Spot Popup Content
 *
 * @jest-environment jsdom
 *
 * **Feature: paddelbuch-swiss-paddle-map, Property 2: Spot Popup Contains Required Information**
 * **Validates: Requirements 3.1, 6.1, 6.6**
 *
 * Converted from an inline content model to exercise the REAL shipping module
 * (assets/js/spot-popup.js, via its Dual_Export + html-utils dependency). The real popup
 * renders, for any spot: the (HTML-escaped) spot name, the localised spot-type label, a
 * description excerpt when a description is present, a "navigate" link when coordinates
 * are present, and a "more details" link when a slug is present.
 */

const fc = require('fast-check');

// Real modules (attach to window === global in jsdom).
require('../../assets/js/html-utils.js');
require('../../assets/js/spot-popup.js');

const { generateSpotPopupContent, getLabels } = global.PaddelbuchSpotPopup;
const { escapeHtml, stripHtml, truncate } = global.PaddelbuchHtmlUtils;

const VALID_SPOT_TYPES = [
  'einstieg-ausstieg',
  'nur-einstieg',
  'nur-ausstieg',
  'rasthalte',
  'notauswasserungsstelle'
];

// Simple slug (no characters that HTML-escaping would alter), so URL assertions are exact.
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,40}$/);
const nameArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);
const locationArb = fc.record({
  lat: fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true }),
  lon: fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true })
});

const spotArb = fc.record({
  slug: slugArb,
  name: nameArb,
  description: fc.oneof(
    fc.constant(undefined),
    fc.string({ minLength: 1, maxLength: 400 }),
    fc.string({ minLength: 1, maxLength: 200 }).map((s) => '<p>' + s + '</p>')
  ),
  spotType_slug: fc.constantFrom(...VALID_SPOT_TYPES),
  rejected: fc.constant(false),
  location: fc.option(locationArb, { nil: undefined }),
  paddleCraftTypes: fc.array(fc.constantFrom('seekajak', 'kanadier', 'stand-up-paddle-board'), { maxLength: 3 })
});

describe('Spot Popup Content - Property 2 (real module)', () => {
  test('output is a non-empty <div> wrapper string', () => {
    fc.assert(
      fc.property(spotArb, (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        return typeof html === 'string' && html.indexOf('<div>') === 0 && html.trim().endsWith('</div>');
      }),
      { numRuns: 100 }
    );
  });

  test('popup contains the HTML-escaped spot name inside the title', () => {
    fc.assert(
      fc.property(spotArb, (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        const expected = '<span class="popup-title"><h1>' + escapeHtml(spot.name) + '</h1></span>';
        return html.includes(expected);
      }),
      { numRuns: 100 }
    );
  });

  test('popup never contains an unescaped <script> from the name', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('<script>x</script>', '<img src=x onerror=y>', 'a<b>c', '"\'&<>'),
        (rawName) => {
          const html = generateSpotPopupContent({ name: rawName, slug: 'x', spotType_slug: 'rasthalte' }, 'de');
          // The escaped name is present; the raw dangerous markup is not.
          return html.includes(escapeHtml(rawName)) && !html.includes('<script>x</script>');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('popup includes a description excerpt when a (non-empty) description is present', () => {
    fc.assert(
      fc.property(spotArb, (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        const plain = spot.description ? stripHtml(spot.description) : '';
        if (plain && plain.trim().length > 0) {
          const excerpt = escapeHtml(truncate(plain, 150));
          return html.includes('<div><p>' + excerpt + '</p></div>');
        }
        return true; // no description -> excerpt not required
      }),
      { numRuns: 100 }
    );
  });

  test('popup includes a navigate link with the coordinates when a location is present', () => {
    fc.assert(
      fc.property(spotArb.filter((s) => s.location !== undefined), (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        const lat = spot.location.lat;
        const lon = spot.location.lon;
        return html.includes('destination=' + lat + ',' + lon) &&
          html.includes(getLabels('de').navigate);
      }),
      { numRuns: 100 }
    );
  });

  test('popup includes a more-details link to /einstiegsorte/{slug}/ when a slug is present', () => {
    fc.assert(
      fc.property(spotArb, (spot) => {
        const html = generateSpotPopupContent(spot, 'de');
        return html.includes('/einstiegsorte/' + spot.slug + '/');
      }),
      { numRuns: 100 }
    );
  });

  test('English locale uses the English navigate/details labels', () => {
    fc.assert(
      fc.property(spotArb.filter((s) => s.location !== undefined), (spot) => {
        const html = generateSpotPopupContent(spot, 'en');
        return html.includes('Navigate To') && html.includes('More details') &&
          html.includes('/en/einstiegsorte/' + spot.slug + '/');
      }),
      { numRuns: 100 }
    );
  });

  describe('Edge cases', () => {
    test('no location -> no navigate link', () => {
      const html = generateSpotPopupContent({ name: 'Test', slug: 'test', spotType_slug: 'rasthalte' }, 'de');
      expect(html).not.toContain('maps/dir');
    });

    test('no description -> no excerpt paragraph', () => {
      const html = generateSpotPopupContent({ name: 'Test', slug: 'test', spotType_slug: 'rasthalte' }, 'de');
      expect(html).not.toContain('<div><p>');
    });
  });
});
