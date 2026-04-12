/**
 * @jest-environment jsdom
 */

/**
 * Exploratory Bug Condition Tests — marker.click wrapper divs
 *
 * These tests confirm the bug condition exists on UNFIXED code:
 * - All popup generators wrap content in a div with data-tinylytics-event="marker.click"
 * - No PaddelbuchTinylyticsBeacon module exists yet
 *
 * Passing = bug condition confirmed (the inert wrapper divs are present).
 */

// Load shared utility modules that popup generators depend on
require('../../assets/js/html-utils.js');
require('../../assets/js/date-utils.js');

// Load popup generator modules
require('../../assets/js/spot-popup.js');
require('../../assets/js/obstacle-popup.js');
require('../../assets/js/event-notice-popup.js');

describe('Exploratory: popup generators produce marker.click wrapper divs', () => {
  test('generateSpotPopupContent output contains data-tinylytics-event="marker.click" on wrapper div', () => {
    const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(
      { slug: 'test-spot', name: 'Test Spot', spotType_slug: 'einstieg-ausstieg' },
      'de'
    );
    expect(html).toContain('data-tinylytics-event="marker.click"');
  });

  test('generateRejectedSpotPopupContent output contains data-tinylytics-event="marker.click" on wrapper div', () => {
    const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(
      { slug: 'rejected-spot', name: 'Rejected Spot', rejected: true },
      'de'
    );
    expect(html).toContain('data-tinylytics-event="marker.click"');
  });

  test('generateObstaclePopupContent output contains data-tinylytics-event="marker.click" on wrapper div', () => {
    const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(
      { slug: 'test-obstacle', name: 'Test Obstacle' },
      'de'
    );
    expect(html).toContain('data-tinylytics-event="marker.click"');
  });

  test('generateEventNoticePopupContent output contains data-tinylytics-event="marker.click" on wrapper div', () => {
    const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(
      { slug: 'test-notice', name: 'Test Notice', startDate: '2025-01-01', endDate: '2025-12-31' },
      'de'
    );
    expect(html).toContain('data-tinylytics-event="marker.click"');
  });

  test('PaddelbuchTinylyticsBeacon is undefined (no beacon module exists yet)', () => {
    expect(global.PaddelbuchTinylyticsBeacon).toBeUndefined();
  });
});
