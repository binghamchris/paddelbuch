/**
 * @jest-environment jsdom
 *
 * Feature: quality-and-tooling-hardening, Property 4: Popup output unchanged after de-duplication
 * Validates: Requirements 4.2, 4.4
 *
 * After removing the inline fallback popup builders from layer-control.js, the popup
 * HTML bound for spots, obstacles and event notices under normal operation (all popup
 * modules loaded) must equal the output of the corresponding popup module. That output
 * IS the pre-change baseline, because the module-present branch was always taken when
 * the modules are loaded (they are included before layer-control.js on every map page).
 *
 * The test runs the real layer-control.js in jsdom with the real popup modules and a
 * minimal Leaflet mock that captures every bindPopup() call, then asserts the captured
 * HTML equals the module output for arbitrary inputs.
 */

const fs = require('fs');
const path = require('path');
const fc = require('fast-check');

const ROOT = path.resolve(__dirname, '../..');
const LOCALE = 'de';

let boundPopups;

beforeAll(() => {
  // CSP-safe JSON config block read by layer-control.js at load time.
  document.body.innerHTML =
    '<script id="layer-control-config" type="application/json">' +
    JSON.stringify({ currentLocale: LOCALE, localePrefix: '', protectedAreaTypeNames: {} }) +
    '</script>';

  boundPopups = [];

  function makeLayer() {
    return {
      bindPopup: function (content) { boundPopups.push(content); return this; },
      on: function () { return this; },
      addTo: function () { return this; },
      bringToFront: function () { return this; },
      bringToBack: function () { return this; },
      getLatLng: function () { return { lat: 0, lng: 0 }; }
    };
  }

  // Minimal Leaflet mock (window === global in jest jsdom, so bare `L` resolves too).
  window.L = {
    marker: function () { return makeLayer(); },
    geoJSON: function () { return makeLayer(); },
    layerGroup: function () { return makeLayer(); },
    Icon: { Default: { prototype: {} } }
  };

  window.paddelbuchMap = {
    getZoom: function () { return 8; },
    setView: function () {},
    panTo: function () {},
    hasLayer: function () { return false; },
    addLayer: function () {},
    on: function () {}
  };

  // Dependencies layer-control.js calls for non-rejected spots.
  window.PaddelbuchMarkerRegistry = { register: function () {} };
  window.PaddelbuchFilterEngine = { evaluateMarker: function () { return true; } };

  // Real popup modules and their dependencies (attach to window in jsdom).
  require('../../assets/js/html-utils.js');
  require('../../assets/js/date-utils.js');
  require('../../assets/js/spot-popup.js');
  require('../../assets/js/obstacle-popup.js');
  require('../../assets/js/event-notice-popup.js');

  // Load layer-control.js and run its deferred initialiser (setTimeout(init, 50)).
  jest.useFakeTimers();
  require('../../assets/js/layer-control.js');
  jest.advanceTimersByTime(100);
  jest.useRealTimers();
});

// A far-future ISO date so notices are never filtered out as expired.
const FUTURE_DATE = '2099-12-31';

const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/);
const nameArb = fc.string({ minLength: 1, maxLength: 40 });
const latArb = fc.double({ min: 45.8, max: 47.8, noNaN: true, noDefaultInfinity: true });
const lonArb = fc.double({ min: 5.9, max: 10.5, noNaN: true, noDefaultInfinity: true });
const spotTypeArb = fc.constantFrom(
  'einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte', 'notauswasserungsstelle'
);

describe('Property 4: Popup output unchanged after de-duplication', () => {
  test('layer-control.js exposes the marker/layer functions after init', () => {
    expect(typeof window.paddelbuchAddSpotMarker).toBe('function');
    expect(typeof window.paddelbuchAddObstacleLayer).toBe('function');
    expect(typeof window.paddelbuchAddEventNoticeMarker).toBe('function');
  });

  test('spot popup equals PaddelbuchSpotPopup.generateSpotPopupContent', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nameArb,
          slug: slugArb,
          description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          location: fc.record({ lat: latArb, lon: lonArb }),
          spotType_slug: fc.option(spotTypeArb, { nil: undefined }),
          rejected: fc.constant(false)
        }),
        (spot) => {
          boundPopups.length = 0;
          window.paddelbuchAddSpotMarker(spot);
          const expected = window.PaddelbuchSpotPopup.generateSpotPopupContent(spot, LOCALE);
          return boundPopups.length === 1 && boundPopups[0] === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejected spot popup equals PaddelbuchSpotPopup.generateRejectedSpotPopupContent', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nameArb,
          slug: slugArb,
          description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          location: fc.record({ lat: latArb, lon: lonArb }),
          rejected: fc.constant(true)
        }),
        (spot) => {
          boundPopups.length = 0;
          window.paddelbuchAddSpotMarker(spot);
          const expected = window.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, LOCALE);
          return boundPopups.length === 1 && boundPopups[0] === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('obstacle popup equals PaddelbuchObstaclePopup.generateObstaclePopupContent', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nameArb,
          slug: slugArb,
          isPortagePossible: fc.constantFrom(true, false, null, undefined),
          geometry: fc.constant({ type: 'Point', coordinates: [8.0, 47.0] })
        }),
        (obstacle) => {
          boundPopups.length = 0;
          window.paddelbuchAddObstacleLayer(obstacle);
          const expected = window.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, LOCALE);
          // No portageRoute, so exactly one bindPopup (the obstacle layer).
          return boundPopups.length === 1 && boundPopups[0] === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('event notice popup equals PaddelbuchEventNoticePopup.generateEventNoticePopupContent', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: nameArb,
          slug: slugArb,
          startDate: fc.option(fc.constant('2099-01-01'), { nil: undefined }),
          endDate: fc.constant(FUTURE_DATE),
          location: fc.record({ lat: latArb, lon: lonArb })
        }),
        (notice) => {
          boundPopups.length = 0;
          window.paddelbuchAddEventNoticeMarker(notice);
          const expected = window.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, LOCALE);
          // No affectedArea, so exactly one bindPopup (the notice marker).
          return boundPopups.length === 1 && boundPopups[0] === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});
