/**
 * Property-Based Tests for Tinylytics Event Tracking
 *
 * Tests that all popup generators and control modules produce correct
 * data-tinylytics-event and data-tinylytics-event-value attributes.
 *
 * Properties 1–4 test HTML-string popup generators (node environment).
 * Properties 5–6 test DOM-building controls (jsdom environment, separate file).
 *
 * **Feature: tinylytics-event-tracking**
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers: mock globals required by the popup modules
// ---------------------------------------------------------------------------

function setupPopupGlobals() {
  global.PaddelbuchHtmlUtils = {
    escapeHtml: function (str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    stripHtml: function (str) {
      return String(str).replace(/<[^>]*>/g, '');
    },
    truncate: function (str, len) {
      if (!str) return '';
      if (str.length <= len) return str;
      return str.substring(0, len) + '...';
    }
  };

  // event-notice-popup.js depends on PaddelbuchDateUtils
  global.PaddelbuchDateUtils = {
    isDateInFuture: function () { return true; },
    formatDate: function (d) { return String(d); }
  };
}

function teardownPopupGlobals() {
  delete global.PaddelbuchHtmlUtils;
  delete global.PaddelbuchDateUtils;
  delete global.PaddelbuchSpotPopup;
  delete global.PaddelbuchObstaclePopup;
  delete global.PaddelbuchEventNoticePopup;
}

function loadModule(relPath) {
  const absPath = path.join(__dirname, '..', '..', relPath);
  const code = fs.readFileSync(absPath, 'utf-8');
  // Execute the IIFE; it attaches to `global` (== `window` in browser)
  const fn = new Function(code);
  fn();
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Slug: lowercase alphanumeric + hyphens, non-empty */
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,29}$/);

const nameArb = fc.string({ minLength: 1, maxLength: 60 }).filter(s => s.trim().length > 0);

const localeArb = fc.constantFrom('de', 'en');

const locationArb = fc.record({
  lat: fc.float({ min: Math.fround(45.8), max: Math.fround(47.8), noNaN: true }),
  lon: fc.float({ min: Math.fround(5.9), max: Math.fround(10.5), noNaN: true })
});

const spotArb = fc.record({
  slug: slugArb,
  name: nameArb,
  location: locationArb,
  spotType_slug: fc.constantFrom(
    'einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg',
    'rasthalte', 'notauswasserungsstelle'
  ),
  description: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 100 }))
});

const rejectedSpotArb = fc.record({
  slug: slugArb,
  name: nameArb,
  rejected: fc.constant(true),
  description: fc.oneof(fc.constant(''), fc.string({ minLength: 1, maxLength: 100 }))
});

const obstacleArb = fc.record({
  slug: slugArb,
  name: nameArb,
  isPortagePossible: fc.oneof(fc.constant(true), fc.constant(false), fc.constant(null))
});

const eventNoticeArb = fc.record({
  slug: slugArb,
  name: nameArb,
  startDate: fc.constant('2025-01-01'),
  endDate: fc.constant('2026-12-31')
});

// ---------------------------------------------------------------------------
// Helpers: parse attributes from HTML string
// ---------------------------------------------------------------------------

/**
 * Extracts all data-tinylytics-event / data-tinylytics-event-value pairs
 * from an HTML string. Returns an array of { event, value, tag } objects.
 */
function extractEventAttributes(html) {
  const results = [];
  // Match opening tags that contain data-tinylytics-event
  const tagRe = /<(\w+)\b[^>]*data-tinylytics-event="([^"]*)"[^>]*>/g;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const fullTag = m[0];
    const tag = m[1];
    const event = m[2];
    // Extract optional value attribute from the same tag
    const valMatch = fullTag.match(/data-tinylytics-event-value="([^"]*)"/);
    results.push({ event: event, value: valMatch ? valMatch[1] : null, tag: tag });
  }
  return results;
}

// =========================================================================
// Property 1: Spot popup event tracking completeness
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 1: Spot popup event tracking completeness', () => {
  beforeEach(() => {
    setupPopupGlobals();
    loadModule('assets/js/spot-popup.js');
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 2.1, 3.1, 4.1**
   *
   * For any valid spot with slug, location, and name the HTML returned by
   * generateSpotPopupContent SHALL contain marker.click, popup.navigate,
   * and popup.details with the correct slug values.
   */
  test('output contains marker.click, popup.navigate, and popup.details with correct slug', () => {
    fc.assert(
      fc.property(spotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(spot, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(spot.slug);

        // marker.click on wrapper div
        const markerClick = attrs.find(a => a.event === 'marker.click');
        expect(markerClick).toBeDefined();
        expect(markerClick.value).toBe(escapedSlug);
        expect(markerClick.tag).toBe('div');

        // popup.navigate on button (spot has location)
        const popupNav = attrs.find(a => a.event === 'popup.navigate');
        expect(popupNav).toBeDefined();
        expect(popupNav.value).toBe(escapedSlug);
        expect(popupNav.tag).toBe('button');

        // popup.details on button (spot has slug)
        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
        expect(popupDetails.tag).toBe('button');
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 2: Rejected spot popup event tracking completeness
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 2: Rejected spot popup event tracking completeness', () => {
  beforeEach(() => {
    setupPopupGlobals();
    loadModule('assets/js/spot-popup.js');
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 2.2, 4.2**
   *
   * For any valid rejected spot with slug and name the HTML returned by
   * generateRejectedSpotPopupContent SHALL contain marker.click and
   * popup.details with the correct slug values.
   */
  test('output contains marker.click and popup.details with correct slug', () => {
    fc.assert(
      fc.property(rejectedSpotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(spot.slug);

        // marker.click on wrapper div
        const markerClick = attrs.find(a => a.event === 'marker.click');
        expect(markerClick).toBeDefined();
        expect(markerClick.value).toBe(escapedSlug);
        expect(markerClick.tag).toBe('div');

        // popup.details on button
        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
        expect(popupDetails.tag).toBe('button');

        // Should NOT have popup.navigate (rejected spots have no navigate button)
        const popupNav = attrs.find(a => a.event === 'popup.navigate');
        expect(popupNav).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 3: Obstacle popup event tracking completeness
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 3: Obstacle popup event tracking completeness', () => {
  beforeEach(() => {
    setupPopupGlobals();
    loadModule('assets/js/obstacle-popup.js');
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 2.3, 4.3**
   *
   * For any valid obstacle with slug and name the HTML returned by
   * generateObstaclePopupContent SHALL contain marker.click and
   * popup.details with the correct slug values.
   */
  test('output contains marker.click and popup.details with correct slug', () => {
    fc.assert(
      fc.property(obstacleArb, localeArb, (obstacle, locale) => {
        const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(obstacle.slug);

        // marker.click on wrapper div
        const markerClick = attrs.find(a => a.event === 'marker.click');
        expect(markerClick).toBeDefined();
        expect(markerClick.value).toBe(escapedSlug);
        expect(markerClick.tag).toBe('div');

        // popup.details on button
        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
        expect(popupDetails.tag).toBe('button');
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 4: Event notice popup event tracking completeness
// =========================================================================

describe('Feature: tinylytics-event-tracking, Property 4: Event notice popup event tracking completeness', () => {
  beforeEach(() => {
    setupPopupGlobals();
    loadModule('assets/js/event-notice-popup.js');
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 2.4, 4.4**
   *
   * For any valid event notice with slug and name the HTML returned by
   * generateEventNoticePopupContent SHALL contain marker.click and
   * popup.details with the correct slug values.
   */
  test('output contains marker.click and popup.details with correct slug', () => {
    fc.assert(
      fc.property(eventNoticeArb, localeArb, (notice, locale) => {
        const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(notice.slug);

        // marker.click on wrapper div
        const markerClick = attrs.find(a => a.event === 'marker.click');
        expect(markerClick).toBeDefined();
        expect(markerClick.value).toBe(escapedSlug);
        expect(markerClick.tag).toBe('div');

        // popup.details on button
        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
        expect(popupDetails.tag).toBe('button');
      }),
      { numRuns: 100 }
    );
  });
});
