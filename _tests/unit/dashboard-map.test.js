/**
 * Unit Tests for Dashboard Map Module
 *
 * Tests Leaflet map creation with Positron vector tiles via L.maplibreGL,
 * correct centre/bounds/zoom configuration, and global exposure.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * @jest-environment jsdom
 */

var mockMapInstance;
var mockMaplibreLayer;
var mockZoomControl;
var mockAttributionControl;

function setupLeafletMock() {
  mockMapInstance = {
    _options: null
  };

  mockMaplibreLayer = {
    addTo: jest.fn().mockReturnThis()
  };

  mockZoomControl = {
    addTo: jest.fn().mockReturnThis()
  };

  mockAttributionControl = {
    addAttribution: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis()
  };

  global.L = {
    map: jest.fn(function(_id, options) {
      mockMapInstance._options = options;
      return mockMapInstance;
    }),
    maplibreGL: jest.fn(function() {
      return mockMaplibreLayer;
    }),
    control: {
      zoom: jest.fn(function() {
        return mockZoomControl;
      }),
      attribution: jest.fn(function() {
        return mockAttributionControl;
      })
    }
  };
}

// Each load of the module that waits for MapLibre registers a ready listener
// on window. Record them so afterEach can remove them; otherwise a listener
// from an earlier test fires in a later one.
var registeredListeners = [];
var realAddEventListener = window.addEventListener.bind(window);
window.addEventListener = function(type, listener, options) {
  registeredListeners.push([type, listener, options]);
  return realAddEventListener(type, listener, options);
};

function loadModule() {
  delete window.PaddelbuchDashboardMap;
  jest.isolateModules(function() {
    require('../../assets/js/dashboard-map.js');
  });
  return window.PaddelbuchDashboardMap;
}

afterEach(() => {
  registeredListeners.forEach(function(entry) {
    window.removeEventListener(entry[0], entry[1], entry[2]);
  });
  registeredListeners = [];
  document.body.innerHTML = '';
  delete window.PaddelbuchDashboardMap;
  delete global.L;
});

describe('PaddelbuchDashboardMap', () => {
  test('does not create map when #dashboard-map is missing', () => {
    setupLeafletMock();

    var result = loadModule();

    expect(result).toBeUndefined();
    expect(L.map).not.toHaveBeenCalled();
  });

  test('creates map in #dashboard-map element', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(L.map).toHaveBeenCalledWith('dashboard-map', expect.any(Object));
  });

  test('centres map on Switzerland at [46.801111, 8.226667] with zoom 8', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    var options = mockMapInstance._options;
    expect(options.center).toEqual([46.801111, 8.226667]);
    expect(options.zoom).toBe(8);
  });

  test('sets max bounds to Switzerland with viscosity 1.0', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    var options = mockMapInstance._options;
    expect(options.maxBounds).toEqual([[45.8, 5.9], [47.8, 10.5]]);
    expect(options.maxBoundsViscosity).toBe(1.0);
  });

  test('sets minZoom to 7', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(mockMapInstance._options.minZoom).toBe(7);
  });

  test('disables default zoom control', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(mockMapInstance._options.zoomControl).toBe(false);
  });

  test('disables default attribution control', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(mockMapInstance._options.attributionControl).toBe(false);
  });

  // MapLibre 6 loads as an ES module after the page is parsed
  // (assets/js/maplibre-loader.js), so the basemap is added either straight
  // away, when the loader has already finished, or on its ready event.
  describe('Positron basemap via L.maplibreGL', () => {
    afterEach(() => {
      delete window.PaddelbuchMaplibreReady;
    });

    function expectBasemapAddedOnce() {
      expect(L.maplibreGL).toHaveBeenCalledTimes(1);
      expect(L.maplibreGL).toHaveBeenCalledWith({
        style: 'https://tiles.openfreemap.org/styles/positron'
      });
      expect(mockMaplibreLayer.addTo).toHaveBeenCalledTimes(1);
      expect(mockMaplibreLayer.addTo).toHaveBeenCalledWith(mockMapInstance);
    }

    test('is added straight away when MapLibre is already loaded', () => {
      document.body.innerHTML = '<div id="dashboard-map"></div>';
      setupLeafletMock();
      window.PaddelbuchMaplibreReady = true;

      loadModule();

      expectBasemapAddedOnce();
    });

    test('waits for paddelbuch:maplibre-ready when MapLibre is still loading', () => {
      document.body.innerHTML = '<div id="dashboard-map"></div>';
      setupLeafletMock();

      var result = loadModule();

      // The Leaflet map exists at once, so dashboards can add their layers.
      expect(result.getMap()).toBe(mockMapInstance);
      expect(L.maplibreGL).not.toHaveBeenCalled();

      window.PaddelbuchMaplibreReady = true;
      window.dispatchEvent(new Event('paddelbuch:maplibre-ready'));
      expectBasemapAddedOnce();

      // A repeated event never adds a second basemap.
      window.dispatchEvent(new Event('paddelbuch:maplibre-ready'));
      expectBasemapAddedOnce();
    });

    test('waits for the event when the ready flag is set but the bridge is missing', () => {
      document.body.innerHTML = '<div id="dashboard-map"></div>';
      setupLeafletMock();
      window.PaddelbuchMaplibreReady = true;
      var bridge = L.maplibreGL;
      delete L.maplibreGL;

      loadModule();

      L.maplibreGL = bridge;
      expect(L.maplibreGL).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('paddelbuch:maplibre-ready'));
      expectBasemapAddedOnce();
    });
  });

  test('adds zoom control at bottom-right', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(L.control.zoom).toHaveBeenCalledWith({ position: 'bottomright' });
    expect(mockZoomControl.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  test('adds attribution control with OpenStreetMap text', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(L.control.attribution).toHaveBeenCalledWith({ position: 'bottomright' });
    expect(mockAttributionControl.addAttribution).toHaveBeenCalledWith(
      expect.stringContaining('OpenStreetMap')
    );
    expect(mockAttributionControl.addTo).toHaveBeenCalledWith(mockMapInstance);
  });

  test('exposes map instance on window.PaddelbuchDashboardMap', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    var result = loadModule();

    expect(result).toBeDefined();
    expect(result.map).toBe(mockMapInstance);
  });

  test('exposes getMap() that returns the map instance', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    var result = loadModule();

    expect(typeof result.getMap).toBe('function');
    expect(result.getMap()).toBe(mockMapInstance);
  });
});
