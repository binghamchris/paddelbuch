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

function loadModule() {
  delete window.PaddelbuchDashboardMap;
  jest.isolateModules(function() {
    require('../../assets/js/dashboard-map.js');
  });
  return window.PaddelbuchDashboardMap;
}

afterEach(() => {
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

  test('adds Positron vector tiles via L.maplibreGL', () => {
    document.body.innerHTML = '<div id="dashboard-map"></div>';
    setupLeafletMock();

    loadModule();

    expect(L.maplibreGL).toHaveBeenCalledWith({
      style: 'https://tiles.openfreemap.org/styles/positron'
    });
    expect(mockMaplibreLayer.addTo).toHaveBeenCalledWith(mockMapInstance);
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
