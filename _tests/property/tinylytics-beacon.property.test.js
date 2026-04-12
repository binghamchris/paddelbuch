/**
 * @jest-environment jsdom
 */

/**
 * Property-Based Tests for Tinylytics Beacon Module
 *
 * Properties 1–2 test the beacon dispatch function (jsdom environment).
 * Properties 3–5 test popup generators for marker.click removal and preservation.
 *
 * **Feature: marker-click-event-fix**
 */

const fc = require('fast-check');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers: load IIFE modules into global scope
// ---------------------------------------------------------------------------

function loadModule(relPath) {
  const absPath = path.join(__dirname, '..', '..', relPath);
  const code = fs.readFileSync(absPath, 'utf-8');
  const fn = new Function(code);
  fn();
}

// ---------------------------------------------------------------------------
// Helpers: mock globals required by popup modules
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

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty event name: alphanumeric + dots/hyphens, like real Tinylytics events */
const eventNameArb = fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/);

/** Event value: slug-like strings */
const eventValueArb = fc.stringMatching(/^[a-z0-9-]{0,40}$/);

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
// Helpers: parse tinylytics attributes from HTML string
// ---------------------------------------------------------------------------

function extractEventAttributes(html) {
  const results = [];
  const tagRe = /<(\w+)\b[^>]*data-tinylytics-event="([^"]*)"[^>]*>/g;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const fullTag = m[0];
    const tag = m[1];
    const event = m[2];
    const valMatch = fullTag.match(/data-tinylytics-event-value="([^"]*)"/);
    results.push({ event: event, value: valMatch ? valMatch[1] : null, tag: tag });
  }
  return results;
}

// =========================================================================
// Property 1: Beacon dispatch correctness
// =========================================================================

describe('Feature: marker-click-event-fix, Property 1: Beacon dispatch correctness', () => {
  beforeEach(() => {
    loadModule('assets/js/tinylytics-beacon.js');
  });

  afterEach(() => {
    delete global.PaddelbuchTinylyticsBeacon;
  });

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   *
   * For any event name and event value, PaddelbuchTinylyticsBeacon.dispatch()
   * SHALL create a DOM element with correct data-tinylytics-event and
   * data-tinylytics-event-value attributes, dispatch a bubbling click
   * MouseEvent on it, and remove the element from the DOM afterwards.
   */
  test('dispatch creates beacon with correct attributes, fires bubbling click, then removes element', () => {
    fc.assert(
      fc.property(eventNameArb, eventValueArb, (eventName, eventValue) => {
        let capturedEvent = null;
        let capturedTarget = null;

        // Listen at document level to capture the bubbling click
        const listener = function (e) {
          capturedEvent = e;
          // Capture attributes while element is still in DOM (during dispatch)
          capturedTarget = {
            tagName: e.target.tagName,
            event: e.target.getAttribute('data-tinylytics-event'),
            value: e.target.getAttribute('data-tinylytics-event-value'),
            inBody: document.body.contains(e.target)
          };
        };
        document.addEventListener('click', listener);

        try {
          global.PaddelbuchTinylyticsBeacon.dispatch(eventName, eventValue);

          // A click event was dispatched and captured at document level
          expect(capturedEvent).not.toBeNull();
          expect(capturedEvent instanceof MouseEvent).toBe(true);

          // The click event bubbled (captured at document level)
          expect(capturedEvent.bubbles).toBe(true);

          // Beacon element had correct attributes at dispatch time
          expect(capturedTarget.tagName).toBe('DIV');
          expect(capturedTarget.event).toBe(eventName);
          expect(capturedTarget.value).toBe(eventValue);

          // Element was in body during dispatch
          expect(capturedTarget.inBody).toBe(true);

          // Element is removed from DOM after dispatch
          const remaining = document.querySelectorAll('[data-tinylytics-event="' + eventName + '"]');
          expect(remaining.length).toBe(0);
        } finally {
          document.removeEventListener('click', listener);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * With a falsy eventName, no element is created and no click is dispatched.
   */
  test('dispatch with falsy eventName is a no-op', () => {
    const falsyValues = [null, undefined, '', 0, false];

    falsyValues.forEach((falsyName) => {
      let clickFired = false;
      const listener = function () { clickFired = true; };
      document.addEventListener('click', listener);

      try {
        const beforeCount = document.body.children.length;
        global.PaddelbuchTinylyticsBeacon.dispatch(falsyName, 'some-value');
        const afterCount = document.body.children.length;

        expect(clickFired).toBe(false);
        expect(afterCount).toBe(beforeCount);
      } finally {
        document.removeEventListener('click', listener);
      }
    });
  });
});

// =========================================================================
// Property 2: Beacon CSS class compliance
// =========================================================================

describe('Feature: marker-click-event-fix, Property 2: Beacon CSS class compliance', () => {
  beforeEach(() => {
    loadModule('assets/js/tinylytics-beacon.js');
  });

  afterEach(() => {
    delete global.PaddelbuchTinylyticsBeacon;
  });

  /**
   * **Validates: Requirements 2.6, 3.7**
   *
   * For any call to PaddelbuchTinylyticsBeacon.dispatch(), the created beacon
   * element SHALL have the CSS class 'tinylytics-beacon' and SHALL NOT have
   * any style attribute, preserving CSP compliance.
   */
  test('beacon element has class tinylytics-beacon and no style attribute', () => {
    fc.assert(
      fc.property(eventNameArb, eventValueArb, (eventName, eventValue) => {
        let capturedClassName = null;
        let capturedStyleAttr = null;

        const listener = function (e) {
          capturedClassName = e.target.className;
          capturedStyleAttr = e.target.getAttribute('style');
        };
        document.addEventListener('click', listener);

        try {
          global.PaddelbuchTinylyticsBeacon.dispatch(eventName, eventValue);

          expect(capturedClassName).toBe('tinylytics-beacon');
          expect(capturedStyleAttr).toBeNull();
        } finally {
          document.removeEventListener('click', listener);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 3: Popup HTML no longer contains marker.click
// =========================================================================

describe('Feature: marker-click-event-fix, Property 3: Popup HTML no longer contains marker.click', () => {
  beforeEach(() => {
    setupPopupGlobals();
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 2.7, 1.5**
   *
   * For any valid entity (spot, rejected spot, obstacle, event notice),
   * the popup HTML SHALL NOT contain data-tinylytics-event="marker.click"
   * on any element.
   */
  test('spot popup does not contain marker.click', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(spotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(spot, locale);
        expect(html).not.toContain('data-tinylytics-event="marker.click"');
      }),
      { numRuns: 100 }
    );
  });

  test('rejected spot popup does not contain marker.click', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(rejectedSpotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, locale);
        expect(html).not.toContain('data-tinylytics-event="marker.click"');
      }),
      { numRuns: 100 }
    );
  });

  test('obstacle popup does not contain marker.click', () => {
    loadModule('assets/js/obstacle-popup.js');
    fc.assert(
      fc.property(obstacleArb, localeArb, (obstacle, locale) => {
        const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, locale);
        expect(html).not.toContain('data-tinylytics-event="marker.click"');
      }),
      { numRuns: 100 }
    );
  });

  test('event notice popup does not contain marker.click', () => {
    loadModule('assets/js/event-notice-popup.js');
    fc.assert(
      fc.property(eventNoticeArb, localeArb, (notice, locale) => {
        const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, locale);
        expect(html).not.toContain('data-tinylytics-event="marker.click"');
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 4: popup.navigate and popup.details preservation
// =========================================================================

describe('Feature: marker-click-event-fix, Property 4: popup.navigate and popup.details preservation', () => {
  beforeEach(() => {
    setupPopupGlobals();
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 3.1, 3.2, 3.6**
   *
   * For any valid spot with slug and location, popup HTML SHALL still contain
   * popup.navigate and popup.details with the correct slug values.
   * For obstacle and event notice, popup.details SHALL still be present.
   */
  test('spot popup preserves popup.navigate and popup.details', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(spotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(spot, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(spot.slug);

        const popupNav = attrs.find(a => a.event === 'popup.navigate');
        expect(popupNav).toBeDefined();
        expect(popupNav.value).toBe(escapedSlug);

        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
      }),
      { numRuns: 100 }
    );
  });

  test('rejected spot popup preserves popup.details', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(rejectedSpotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(spot.slug);

        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
      }),
      { numRuns: 100 }
    );
  });

  test('obstacle popup preserves popup.details', () => {
    loadModule('assets/js/obstacle-popup.js');
    fc.assert(
      fc.property(obstacleArb, localeArb, (obstacle, locale) => {
        const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(obstacle.slug);

        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
      }),
      { numRuns: 100 }
    );
  });

  test('event notice popup preserves popup.details', () => {
    loadModule('assets/js/event-notice-popup.js');
    fc.assert(
      fc.property(eventNoticeArb, localeArb, (notice, locale) => {
        const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, locale);
        const attrs = extractEventAttributes(html);
        const escapedSlug = global.PaddelbuchHtmlUtils.escapeHtml(notice.slug);

        const popupDetails = attrs.find(a => a.event === 'popup.details');
        expect(popupDetails).toBeDefined();
        expect(popupDetails.value).toBe(escapedSlug);
      }),
      { numRuns: 100 }
    );
  });
});

// =========================================================================
// Property 5: Popup structural content preservation
// =========================================================================

describe('Feature: marker-click-event-fix, Property 5: Popup structural content preservation', () => {
  beforeEach(() => {
    setupPopupGlobals();
  });
  afterEach(teardownPopupGlobals);

  /**
   * **Validates: Requirements 3.6**
   *
   * For any valid entity, the popup HTML SHALL still contain the popup-title
   * class and h1 title element, and the more-details button structure when
   * slug is present.
   */
  test('spot popup preserves popup-title, h1, and more-details button', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(spotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateSpotPopupContent(spot, locale);

        expect(html).toContain('popup-title');
        expect(html).toContain('<h1>');
        expect(html).toContain(global.PaddelbuchHtmlUtils.escapeHtml(spot.name));

        // More-details button structure present when slug exists
        if (spot.slug) {
          expect(html).toContain('popup-btn-right');
          expect(html).toContain('popup.details');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('rejected spot popup preserves popup-title, h1, and more-details button', () => {
    loadModule('assets/js/spot-popup.js');
    fc.assert(
      fc.property(rejectedSpotArb, localeArb, (spot, locale) => {
        const html = global.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, locale);

        expect(html).toContain('popup-title');
        expect(html).toContain('<h1>');
        expect(html).toContain(global.PaddelbuchHtmlUtils.escapeHtml(spot.name));

        if (spot.slug) {
          expect(html).toContain('popup-btn-right');
          expect(html).toContain('popup.details');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('obstacle popup preserves popup-title, h1, and more-details button', () => {
    loadModule('assets/js/obstacle-popup.js');
    fc.assert(
      fc.property(obstacleArb, localeArb, (obstacle, locale) => {
        const html = global.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, locale);

        expect(html).toContain('popup-title');
        expect(html).toContain('<h1>');
        expect(html).toContain(global.PaddelbuchHtmlUtils.escapeHtml(obstacle.name));

        if (obstacle.slug) {
          expect(html).toContain('popup-btn-right');
          expect(html).toContain('popup.details');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('event notice popup preserves popup-title, h1, and more-details button', () => {
    loadModule('assets/js/event-notice-popup.js');
    fc.assert(
      fc.property(eventNoticeArb, localeArb, (notice, locale) => {
        const html = global.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, locale);

        expect(html).toContain('popup-title');
        expect(html).toContain('<h1>');
        expect(html).toContain(global.PaddelbuchHtmlUtils.escapeHtml(notice.name));

        if (notice.slug) {
          expect(html).toContain('popup-btn-right');
          expect(html).toContain('popup.details');
        }
      }),
      { numRuns: 100 }
    );
  });
});
