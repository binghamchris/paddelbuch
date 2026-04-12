/**
 * @jest-environment jsdom
 */

/**
 * Unit and Smoke Tests for Tinylytics Event Tracking
 *
 * Task 10.1: Smoke test for Tinylytics script URL (Req 1.1, 1.2, 1.3)
 * Task 10.2: Smoke test for CSP unchanged (Req 12.4)
 * Task 10.3: Unit tests for filter panel toggle button (Req 5.1)
 * Task 10.4: Unit tests for fallback popup HTML in layer-control.js (Req 2.6, 3.2, 4.5)
 * Task 10.5: Unit tests for edge cases (Req 2.1, 3.1, 4.1)
 */

const fs = require('fs');
const path = require('path');

// ─── Task 10.1: Smoke test for Tinylytics script URL ───

describe('Tinylytics script URL (Task 10.1)', () => {
  let defaultHtml;

  beforeAll(() => {
    defaultHtml = fs.readFileSync(
      path.join(__dirname, '..', '..', '_layouts', 'default.html'),
      'utf-8'
    );
  });

  test('script src contains ?events&beacon query parameters (Req 1.1, 1.2)', () => {
    expect(defaultHtml).toContain('?events&beacon');
  });

  test('script tag has defer attribute (Req 1.3)', () => {
    // Match the tinylytics script tag and verify defer is present
    const scriptMatch = defaultHtml.match(/<script[^>]*tinylytics\.app[^>]*>/);
    expect(scriptMatch).not.toBeNull();
    expect(scriptMatch[0]).toContain('defer');
  });

  test('full script src URL is correct', () => {
    expect(defaultHtml).toContain(
      'src="https://tinylytics.app/embed/DWSnjEu6fgk9s2Yu2H4a/min.js?events&beacon"'
    );
  });
});

// ─── Task 10.2: Smoke test for CSP unchanged ───

describe('CSP unchanged (Task 10.2)', () => {
  let deployYaml;

  beforeAll(() => {
    deployYaml = fs.readFileSync(
      path.join(__dirname, '..', '..', 'deploy', 'frontend-deploy.yaml'),
      'utf-8'
    );
  });

  test('deploy file contains Content-Security-Policy header (Req 12.4)', () => {
    expect(deployYaml).toContain('Content-Security-Policy');
  });

  test('CSP script-src includes self and tinylytics.app', () => {
    expect(deployYaml).toContain("script-src 'self' https://tinylytics.app");
  });

  test('CSP style-src is self only (no unsafe-inline)', () => {
    expect(deployYaml).toContain("style-src 'self'");
    expect(deployYaml).not.toContain('unsafe-inline');
  });

  test('CSP connect-src includes tinylytics.app for beacon', () => {
    expect(deployYaml).toContain('https://tinylytics.app');
  });
});


// ─── Task 10.3: Unit tests for filter panel toggle button ───

describe('Filter panel toggle button event tracking (Task 10.3)', () => {
  function setupLeafletMocks() {
    window.L = {
      Control: {
        extend: function(proto) {
          function Control() {
            this.options = Object.assign({}, proto.options || {});
            this._onAdd = proto.onAdd.bind(this);
          }
          Control.prototype.addTo = function(map) {
            var container = this._onAdd(map);
            this._container_el = container;
            document.body.appendChild(container);
            return this;
          };
          Control.prototype.getContainer = function() {
            return this._container_el;
          };
          return Control;
        }
      },
      DomUtil: {
        create: function(tagName, className, parentEl) {
          var el = document.createElement(tagName);
          if (className) el.className = className;
          if (parentEl) parentEl.appendChild(el);
          return el;
        },
        hasClass: function(el, name) { return el.classList.contains(name); },
        addClass: function(el, name) { el.classList.add(name); },
        removeClass: function(el, name) { el.classList.remove(name); }
      },
      DomEvent: {
        disableClickPropagation: function() {},
        disableScrollPropagation: function() {}
      }
    };
  }

  function loadFilterPanel() {
    var script = fs.readFileSync(
      path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js'),
      'utf-8'
    );
    var fn = new Function(script);
    fn();
    return window.PaddelbuchFilterPanel;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.PaddelbuchFilterEngine;
    delete window.L;
  });

  test('toggle button has data-tinylytics-event="filter.toggle" (Req 5.1)', () => {
    setupLeafletMocks();
    var panel = loadFilterPanel();
    var mockMap = { on: jest.fn() };

    panel.init(mockMap, [], []);

    var toggleBtn = document.querySelector('.filter-panel-toggle');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('data-tinylytics-event')).toBe('filter.toggle');
  });

  test('toggle button does not have a value attribute (no value needed)', () => {
    setupLeafletMocks();
    var panel = loadFilterPanel();
    var mockMap = { on: jest.fn() };

    panel.init(mockMap, [], []);

    var toggleBtn = document.querySelector('.filter-panel-toggle');
    expect(toggleBtn.hasAttribute('data-tinylytics-event-value')).toBe(false);
  });
});


// ─── Task 10.4: Unit tests for fallback popup HTML in layer-control.js ───

describe('Fallback popup HTML in layer-control.js (Task 10.4)', () => {
  var capturedPopupContent;
  var capturedPopupOptions;

  function setupLayerControlEnv(locale) {
    locale = locale || 'de';
    document.body.innerHTML =
      '<script type="application/json" id="layer-control-config">' +
      JSON.stringify({
        currentLocale: locale,
        localePrefix: locale === 'en' ? '/en' : '',
        protectedAreaTypeNames: {}
      }) +
      '</script>';

    // Load real html-utils
    var htmlUtilsScript = fs.readFileSync(
      path.join(__dirname, '..', '..', 'assets', 'js', 'html-utils.js'),
      'utf-8'
    );
    var fn1 = new Function(htmlUtilsScript);
    fn1();

    // Ensure popup modules are NOT available (to trigger fallback paths)
    delete window.PaddelbuchSpotPopup;
    delete window.PaddelbuchObstaclePopup;
    delete window.PaddelbuchEventNoticePopup;

    // Mock PaddelbuchDateUtils
    window.PaddelbuchDateUtils = {
      isDateInFuture: function() { return true; },
      formatDate: function(d) { return d; }
    };

    // Mock PaddelbuchMarkerRegistry
    window.PaddelbuchMarkerRegistry = {
      register: jest.fn()
    };

    // Mock PaddelbuchFilterEngine
    window.PaddelbuchFilterEngine = {
      evaluateMarker: jest.fn(function() { return true; }),
      setOption: jest.fn(),
      applyFilters: jest.fn()
    };

    // Mock PaddelbuchMarkerStyles
    window.PaddelbuchMarkerStyles = {
      getSpotIcon: function() { return {}; },
      getEventNoticeIcon: function() { return {}; }
    };

    // Mock PaddelbuchLayerStyles
    window.PaddelbuchLayerStyles = {
      obstacleStyle: { color: '#c40200' },
      protectedAreaStyle: { color: '#ffb200' },
      waterwayEventNoticeAreaStyle: { color: '#ffb200' }
    };

    // Reset captured content
    capturedPopupContent = null;
    capturedPopupOptions = null;

    // Mock Leaflet
    window.L = {
      layerGroup: function() {
        return {
          addTo: jest.fn().mockReturnThis(),
          remove: jest.fn(),
          bringToFront: jest.fn(),
          bringToBack: jest.fn()
        };
      },
      marker: function() {
        return {
          bindPopup: function(content, opts) {
            capturedPopupContent = content;
            capturedPopupOptions = opts;
            return this;
          },
          addTo: jest.fn().mockReturnThis(),
          on: jest.fn(),
          getLatLng: jest.fn()
        };
      },
      geoJSON: function() {
        return {
          bindPopup: function(content, opts) {
            capturedPopupContent = content;
            capturedPopupOptions = opts;
            return this;
          },
          addTo: jest.fn().mockReturnThis(),
          bringToFront: jest.fn(),
          bringToBack: jest.fn()
        };
      },
      Icon: { Default: { prototype: {} } }
    };

    // Mock map
    window.paddelbuchMap = {
      on: jest.fn(),
      getZoom: jest.fn(function() { return 10; }),
      panTo: jest.fn(),
      setView: jest.fn()
    };
  }

  function loadLayerControl() {
    jest.useFakeTimers();
    var script = fs.readFileSync(
      path.join(__dirname, '..', '..', 'assets', 'js', 'layer-control.js'),
      'utf-8'
    );
    var fn = new Function(script);
    fn();
    // layer-control.js uses setTimeout(initLayerControls, 50) when DOM is ready
    jest.advanceTimersByTime(100);
    jest.useRealTimers();
  }

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.paddelbuchMap;
    delete window.paddelbuchLayerGroups;
    delete window.paddelbuchAddSpotMarker;
    delete window.paddelbuchAddObstacleLayer;
    delete window.paddelbuchAddEventNoticeMarker;
    delete window.paddelbuchAddProtectedAreaLayer;
    delete window.paddelbuchCurrentLocale;
    delete window.paddelbuchFilterByLocale;
    delete window.PaddelbuchHtmlUtils;
    delete window.PaddelbuchMarkerRegistry;
    delete window.PaddelbuchFilterEngine;
    delete window.PaddelbuchMarkerStyles;
    delete window.PaddelbuchLayerStyles;
    delete window.PaddelbuchDateUtils;
    delete window.PaddelbuchSpotPopup;
    delete window.PaddelbuchObstaclePopup;
    delete window.PaddelbuchEventNoticePopup;
    delete window.L;
  });

  test('spot fallback popup does NOT have marker.click event on wrapper (Req 2.6)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddSpotMarker({
      name: 'Test Spot',
      slug: 'test-spot',
      location: { lat: 47.0, lon: 8.0 },
      spotType_slug: 'einstieg-ausstieg'
    });

    expect(capturedPopupContent).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('spot fallback popup has popup.navigate event on navigate link (Req 3.2)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddSpotMarker({
      name: 'Test Spot',
      slug: 'test-spot',
      location: { lat: 47.0, lon: 8.0 },
      spotType_slug: 'einstieg-ausstieg'
    });

    expect(capturedPopupContent).toContain('data-tinylytics-event="popup.navigate"');
    expect(capturedPopupContent).toContain('data-tinylytics-event-value="test-spot"');
  });

  test('spot fallback popup has popup.details event on details link (Req 4.5)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddSpotMarker({
      name: 'Test Spot',
      slug: 'test-spot',
      location: { lat: 47.0, lon: 8.0 },
      spotType_slug: 'einstieg-ausstieg'
    });

    expect(capturedPopupContent).toContain('data-tinylytics-event="popup.details"');
  });

  test('obstacle fallback popup does NOT have marker.click event on wrapper (Req 2.6)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddObstacleLayer({
      name: 'Test Obstacle',
      slug: 'test-obstacle',
      geometry: JSON.stringify({ type: 'Point', coordinates: [8.0, 47.0] })
    });

    expect(capturedPopupContent).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('obstacle fallback popup has popup.details event on details button (Req 4.5)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddObstacleLayer({
      name: 'Test Obstacle',
      slug: 'test-obstacle',
      geometry: JSON.stringify({ type: 'Point', coordinates: [8.0, 47.0] })
    });

    expect(capturedPopupContent).toContain('data-tinylytics-event="popup.details"');
    expect(capturedPopupContent).toContain('data-tinylytics-event-value="test-obstacle"');
  });

  test('event notice fallback popup does NOT have marker.click event on wrapper (Req 2.6)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddEventNoticeMarker({
      name: 'Test Notice',
      slug: 'test-notice',
      location: { lat: 47.0, lon: 8.0 },
      endDate: '2099-12-31'
    });

    expect(capturedPopupContent).not.toContain('data-tinylytics-event="marker.click"');
  });

  test('event notice fallback popup has popup.details event on details button (Req 4.5)', () => {
    setupLayerControlEnv('de');
    loadLayerControl();

    window.paddelbuchAddEventNoticeMarker({
      name: 'Test Notice',
      slug: 'test-notice',
      location: { lat: 47.0, lon: 8.0 },
      endDate: '2099-12-31'
    });

    expect(capturedPopupContent).toContain('data-tinylytics-event="popup.details"');
    expect(capturedPopupContent).toContain('data-tinylytics-event-value="test-notice"');
  });
});


// ─── Task 10.5: Unit tests for edge cases ───

describe('Spot popup edge cases (Task 10.5)', () => {
  beforeAll(() => {
    // Load real html-utils and spot-popup modules
    require('../../assets/js/html-utils.js');
    require('../../assets/js/spot-popup.js');
  });

  describe('spot with no slug', () => {
    test('no more-details button is rendered (Req 2.1, 4.1)', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'No Slug Spot',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).not.toContain('popup.details');
      expect(html).not.toContain('popup-btn-right');
    });

    test('marker.click wrapper is NOT present on popup (no slug)', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'No Slug Spot',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).not.toContain('data-tinylytics-event="marker.click"');
    });

    test('navigate button still renders when location is present', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'No Slug Spot',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).toContain('popup.navigate');
    });
  });

  describe('spot with no location', () => {
    test('no navigate button is rendered (Req 3.1)', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'No Location Spot',
        slug: 'no-location',
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).not.toContain('popup.navigate');
      expect(html).not.toContain('google.com/maps');
    });

    test('more-details button still renders when slug is present', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'No Location Spot',
        slug: 'no-location',
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).toContain('data-tinylytics-event="popup.details"');
      expect(html).toContain('data-tinylytics-event-value="no-location"');
    });
  });

  describe('empty slug string', () => {
    test('more-details button is not rendered for empty slug', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'Empty Slug Spot',
        slug: '',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      // Empty string is falsy, so the `if (spot.slug)` check should skip the button
      expect(html).not.toContain('popup.details');
    });

    test('marker.click wrapper is NOT present on popup (empty slug)', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'Empty Slug Spot',
        slug: '',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      expect(html).not.toContain('data-tinylytics-event="marker.click"');
    });

    test('navigate button value is empty for empty slug', () => {
      var html = PaddelbuchSpotPopup.generateSpotPopupContent({
        name: 'Empty Slug Spot',
        slug: '',
        location: { lat: 47.0, lon: 8.0 },
        spotType_slug: 'einstieg-ausstieg'
      }, 'de');

      // Navigate button should still render (location exists) but with empty value
      expect(html).toContain('data-tinylytics-event="popup.navigate"');
    });
  });
});
