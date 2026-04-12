/**
 * @jest-environment jsdom
 */

/**
 * Exploratory Bug Condition Tests - marker.click wrapper divs
 *
 * These tests were originally written to confirm the bug condition on UNFIXED code.
 * Now that the fix has been applied (Tasks 2-10), they verify the fix is in place:
 * - All popup generators no longer wrap content in a div with data-tinylytics-event="marker.click"
 * - PaddelbuchTinylyticsBeacon module now exists
 */

// Load shared utility modules that popup generators depend on
require('../../assets/js/html-utils.js');
require('../../assets/js/date-utils.js');

// Load popup generator modules
require('../../assets/js/spot-popup.js');
require('../../assets/js/obstacle-popup.js');
require('../../assets/js/event-notice-popup.js');

// Load beacon module
require('../../assets/js/tinylytics-beacon.js');

describe('Post-fix: popup generators no longer produce marker.click wrapper divs', () => {
  test('generateSpotPopupContent output does NOT contain data-tinylytics-event="marker.click"', () => {
    const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(
      { slug: 'test-spot', name: 'Test Spot', spotType_slug: 'einstieg-ausstieg' },
      'de'
    );
    expect(html).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('generateRejectedSpotPopupContent output does NOT contain data-tinylytics-event="marker.click"', () => {
    const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(
      { slug: 'rejected-spot', name: 'Rejected Spot', rejected: true },
      'de'
    );
    expect(html).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('generateObstaclePopupContent output does NOT contain data-tinylytics-event="marker.click"', () => {
    const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(
      { slug: 'test-obstacle', name: 'Test Obstacle' },
      'de'
    );
    expect(html).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('generateEventNoticePopupContent output does NOT contain data-tinylytics-event="marker.click"', () => {
    const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(
      { slug: 'test-notice', name: 'Test Notice', startDate: '2025-01-01', endDate: '2025-12-31' },
      'de'
    );
    expect(html).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('PaddelbuchTinylyticsBeacon is defined (beacon module now exists)', () => {
    expect(global.PaddelbuchTinylyticsBeacon).toBeDefined();
    expect(typeof global.PaddelbuchTinylyticsBeacon.dispatch).toBe('function');
  });
});
