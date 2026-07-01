/**
 * Dual Export Round-Trip
 *
 * @jest-environment jsdom
 *
 * **Feature: quality-and-tooling-hardening, Property 6: Dual export round-trip**
 * **Validates: Requirements 6.1, 6.2**
 *
 * For any module given a Dual_Export, requiring it in Node/Jest returns the SAME public
 * API object that the module attaches to the global when loaded in a browser-like
 * environment. In jsdom (window === global), the IIFE assigns the API to
 * window.<Name>, and the Dual_Export sets module.exports to that same object, so
 * require() === window.<Name>. The browser global path therefore remains intact
 * (Requirement 6.2) while Node/Jest can require the real module.
 */

describe('Property 6: Dual export round-trip', () => {
  test('spatial-utils.js: require() returns the same object attached to window', () => {
    const required = require('../../assets/js/spatial-utils.js');
    expect(required).toBe(window.PaddelbuchSpatialUtils);
    expect(typeof required).toBe('object');

    ['SWITZERLAND_BOUNDS', 'TILE_SIZE', 'GRID_COLS', 'GRID_ROWS',
     'pointInSwitzerlandBounds', 'pointToTile', 'isValidCoordinate', 'hasValidCoordinates',
     'pointInBounds', 'boundsToTileCoords', 'tileCoordsToBounds', 'expandBounds',
     'boundsIntersect', 'getTileKey'].forEach((key) => {
      expect(required).toHaveProperty(key);
    });
  });

  test('spot-popup.js: require() returns the same object attached to window', () => {
    require('../../assets/js/html-utils.js'); // dependency of spot-popup
    const required = require('../../assets/js/spot-popup.js');
    expect(required).toBe(window.PaddelbuchSpotPopup);
    expect(typeof required).toBe('object');

    ['generateSpotPopupContent', 'generateRejectedSpotPopupContent', 'getIconPath', 'getLabels']
      .forEach((key) => {
        expect(required).toHaveProperty(key);
      });
  });

  test('the dual-exported API functions are callable (browser global path intact)', () => {
    const su = require('../../assets/js/spatial-utils.js');
    // A representative call works identically whether reached via require or window global.
    expect(su.isValidCoordinate(0)).toBe(true);
    expect(su.isValidCoordinate(NaN)).toBe(false);
    expect(window.PaddelbuchSpatialUtils.isValidCoordinate(0)).toBe(true);
    expect(su.pointToTile).toBe(window.PaddelbuchSpatialUtils.pointToTile);
  });
});
