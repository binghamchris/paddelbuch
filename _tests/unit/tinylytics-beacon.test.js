/**
 * @jest-environment jsdom
 */

/**
 * Unit and Integration Tests for Tinylytics Beacon Module
 *
 * Task 10.1: Unit tests for PaddelbuchTinylyticsBeacon module
 * Task 10.2: Integration tests for layer-control.js beacon dispatch calls
 */

const fs = require('fs');
const path = require('path');

// ─── Task 10.1: Unit tests for PaddelbuchTinylyticsBeacon module ───

describe('PaddelbuchTinylyticsBeacon (Task 10.1)', () => {
  beforeAll(() => {
    require('../../assets/js/tinylytics-beacon.js');
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('dispatch("marker.click", "test-slug") creates and removes beacon element', () => {
    var elementSeen = null;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        elementSeen = {
          eventName: e.target.getAttribute('data-tinylytics-event'),
          eventValue: e.target.getAttribute('data-tinylytics-event-value'),
          inDOM: document.body.contains(e.target)
        };
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('marker.click', 'test-slug');

    // Element was created with correct attributes
    expect(elementSeen).not.toBeNull();
    expect(elementSeen.eventName).toBe('marker.click');
    expect(elementSeen.eventValue).toBe('test-slug');
    expect(elementSeen.inDOM).toBe(true);

    // Element is removed after dispatch
    expect(document.querySelector('.tinylytics-beacon')).toBeNull();
  });

  test('beacon element has class "tinylytics-beacon" and no style attribute', () => {
    var beaconEl = null;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        beaconEl = e.target;
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('marker.click', 'test-slug');

    expect(beaconEl).not.toBeNull();
    expect(beaconEl.className).toBe('tinylytics-beacon');
    expect(beaconEl.hasAttribute('style')).toBe(false);
  });

  test('dispatched click event has bubbles: true', () => {
    var eventBubbles = null;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        eventBubbles = e.bubbles;
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('marker.click', 'test-slug');

    expect(eventBubbles).toBe(true);
  });

  test('dispatch(null, "value") is a no-op (no element created)', () => {
    var clickFired = false;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        clickFired = true;
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch(null, 'value');

    expect(clickFired).toBe(false);
    expect(document.querySelector('.tinylytics-beacon')).toBeNull();
  });

  test('dispatch("", "value") is a no-op (no element created)', () => {
    var clickFired = false;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        clickFired = true;
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('', 'value');

    expect(clickFired).toBe(false);
    expect(document.querySelector('.tinylytics-beacon')).toBeNull();
  });

  test('dispatch("marker.click", "") creates element with empty value attribute', () => {
    var capturedValue = null;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        capturedValue = e.target.getAttribute('data-tinylytics-event-value');
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('marker.click', '');

    expect(capturedValue).toBe('');
    expect(document.querySelector('.tinylytics-beacon')).toBeNull();
  });

  test('dispatch("marker.click", null) creates element with null value handling', () => {
    var capturedValue = undefined;
    document.addEventListener('click', function handler(e) {
      if (e.target.classList.contains('tinylytics-beacon')) {
        capturedValue = e.target.getAttribute('data-tinylytics-event-value');
      }
      document.removeEventListener('click', handler);
    });

    window.PaddelbuchTinylyticsBeacon.dispatch('marker.click', null);

    // setAttribute with null converts to the string "null"
    expect(capturedValue).toBe('null');
    expect(document.querySelector('.tinylytics-beacon')).toBeNull();
  });
});


// ─── Task 10.2: Integration tests for layer-control.js beacon dispatch calls ───

describe('Layer-control beacon dispatch integration (Task 10.2)', () => {
  var lastCreatedMarker;
  var lastCreatedLayers;

  function createMockMarker() {
    var handlers = {};
    var m = {
      bindPopup: jest.fn(function() { return m; }),
      addTo: jest.fn(function() { return m; }),
      on: function(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
        return m;
      },
      getLatLng: jest.fn(function() { return { lat: 47, lng: 8 }; }),
      _handlers: handlers,
      _fireClick: function() {
        (handlers['click'] || []).forEach(function(fn) { fn(); });
      }
    };
    lastCreatedMarker = m;
    return m;
  }

  function createMockGeoJSONLayer() {
    var handlers = {};
    var layer = {
      bindPopup: jest.fn(function() { return layer; }),
      addTo: jest.fn(function() { return layer; }),
      bringToFront: jest.fn(function() { return layer; }),
      bringToBack: jest.fn(function() { return layer; }),
      on: function(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
        return layer;
      },
      _handlers: handlers,
      _fireClick: function() {
        (handlers['click'] || []).forEach(function(fn) { fn(); });
      }
    };
    lastCreatedLayers.push(layer);
    return layer;
  }

  function setupLayerControlEnv() {
    lastCreatedMarker = null;
    lastCreatedLayers = [];

    document.body.innerHTML =
      '<script type="application/json" id="layer-control-config">' +
      JSON.stringify({
        currentLocale: 'de',
        localePrefix: '',
        protectedAreaTypeNames: {}
      }) +
      '</script>';

    // Load real html-utils
    var htmlUtilsScript = fs.readFileSync(
      path.join(__dirname, '..', '..', 'assets', 'js', 'html-utils.js'),
      'utf-8'
    );
    (new Function(htmlUtilsScript))();

    // Ensure popup modules are NOT available (trigger fallback paths)
    delete window.PaddelbuchSpotPopup;
    delete window.PaddelbuchObstaclePopup;
    delete window.PaddelbuchEventNoticePopup;

    // Mock PaddelbuchDateUtils
    window.PaddelbuchDateUtils = {
      isDateInFuture: function() { return true; },
      formatDate: function(d) { return d; }
    };

    // Mock PaddelbuchMarkerRegistry
    window.PaddelbuchMarkerRegistry = { register: jest.fn() };

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
      portageStyle: { color: '#4c0561', weight: 4, dashArray: '15 9 1 9' },
      waterwayEventNoticeAreaStyle: { color: '#ffb200' }
    };

    // Mock PaddelbuchTinylyticsBeacon with a spy
    window.PaddelbuchTinylyticsBeacon = { dispatch: jest.fn() };

    // Mock Leaflet
    window.L = {
      layerGroup: function() {
        return {
          addTo: jest.fn(function() { return this; }),
          remove: jest.fn(),
          bringToFront: jest.fn(),
          bringToBack: jest.fn()
        };
      },
      marker: function() { return createMockMarker(); },
      geoJSON: function() { return createMockGeoJSONLayer(); },
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
    (new Function(script))();
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
    delete window.PaddelbuchTinylyticsBeacon;
    delete window.PaddelbuchSpotPopup;
    delete window.PaddelbuchObstaclePopup;
    delete window.PaddelbuchEventNoticePopup;
    delete window.L;
  });

  test('spot marker click dispatches beacon with spot slug', () => {
    setupLayerControlEnv();
    loadLayerControl();

    window.paddelbuchAddSpotMarker({
      name: 'Test Spot',
      slug: 'test-spot',
      location: { lat: 47.0, lon: 8.0 },
      spotType_slug: 'einstieg-ausstieg'
    });

    // Fire all click handlers on the marker
    lastCreatedMarker._fireClick();

    expect(window.PaddelbuchTinylyticsBeacon.dispatch).toHaveBeenCalledWith(
      'marker.click', 'test-spot'
    );
  });

  test('obstacle layer click dispatches beacon with obstacle slug', () => {
    setupLayerControlEnv();
    loadLayerControl();

    window.paddelbuchAddObstacleLayer({
      name: 'Test Obstacle',
      slug: 'test-obstacle',
      geometry: JSON.stringify({ type: 'Point', coordinates: [8.0, 47.0] })
    });

    // The first created geoJSON layer is the obstacle layer
    expect(lastCreatedLayers.length).toBeGreaterThanOrEqual(1);
    lastCreatedLayers[0]._fireClick();

    expect(window.PaddelbuchTinylyticsBeacon.dispatch).toHaveBeenCalledWith(
      'marker.click', 'test-obstacle'
    );
  });

  test('protected area layer click dispatches beacon with slug or name', () => {
    setupLayerControlEnv();
    loadLayerControl();

    window.paddelbuchAddProtectedAreaLayer({
      name: 'Test Protected Area',
      slug: 'test-protected-area',
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[8, 47], [8.1, 47], [8.1, 47.1], [8, 47.1], [8, 47]]] })
    });

    expect(lastCreatedLayers.length).toBeGreaterThanOrEqual(1);
    lastCreatedLayers[0]._fireClick();

    expect(window.PaddelbuchTinylyticsBeacon.dispatch).toHaveBeenCalledWith(
      'marker.click', 'test-protected-area'
    );
  });

  test('protected area without slug falls back to name', () => {
    setupLayerControlEnv();
    loadLayerControl();

    window.paddelbuchAddProtectedAreaLayer({
      name: 'Naturschutzgebiet Rhein',
      geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[8, 47], [8.1, 47], [8.1, 47.1], [8, 47.1], [8, 47]]] })
    });

    expect(lastCreatedLayers.length).toBeGreaterThanOrEqual(1);
    lastCreatedLayers[0]._fireClick();

    expect(window.PaddelbuchTinylyticsBeacon.dispatch).toHaveBeenCalledWith(
      'marker.click', 'Naturschutzgebiet Rhein'
    );
  });

  test('event notice marker click dispatches beacon with notice slug', () => {
    setupLayerControlEnv();
    loadLayerControl();

    window.paddelbuchAddEventNoticeMarker({
      name: 'Test Notice',
      slug: 'test-notice',
      location: { lat: 47.0, lon: 8.0 },
      endDate: '2099-12-31'
    });

    // Fire click on the marker
    lastCreatedMarker._fireClick();

    expect(window.PaddelbuchTinylyticsBeacon.dispatch).toHaveBeenCalledWith(
      'marker.click', 'test-notice'
    );
  });
});
