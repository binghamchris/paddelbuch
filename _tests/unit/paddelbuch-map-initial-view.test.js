/**
 * PaddelbuchMap.init: optional initial view
 *
 * @jest-environment jsdom
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 3.4, 3.9**
 *
 * The home page passes { initialView } to start the map at a restored view.
 * Every other caller passes nothing, and must get exactly the config's view.
 */

var fs = require('fs');
var path = require('path');

var SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'paddelbuch-map.js'), 'utf-8');

var HOME_CONFIG = {
  center: { lat: 46.801111, lon: 8.226667 },
  zoom: 8,
  maxZoom: 20,
  mapboxUrl: 'https://tiles.example/{z}/{x}/{y}.png',
  locale: 'de',
  maxBounds: [[45.0, 4.5], [49.4, 11.8]],
  maxBoundsViscosity: 1.0,
  minZoom: 7,
  zoomControl: false
};

var DETAIL_CONFIG = {
  center: { lat: 46.68, lon: 7.86 },
  zoom: 15,
  maxZoom: 18,
  mapboxUrl: 'https://tiles.example/{z}/{x}/{y}.png',
  locale: 'en'
};

function setup(config) {
  document.body.innerHTML =
    '<div id="map"></div><script type="application/json" id="map-config">' + JSON.stringify(config) + '</script>';

  var fakeMap = { zoomControl: { setPosition: jest.fn() } };
  window.L = {
    map: jest.fn(function() { return fakeMap; }),
    latLngBounds: jest.fn(function(bounds) { return { bounds: bounds }; }),
    tileLayer: jest.fn(function() { return { addTo: jest.fn() }; }),
    control: {
      zoom: jest.fn(function() { return { addTo: jest.fn() }; }),
      locate: jest.fn(function() { return { addTo: jest.fn() }; })
    }
  };

  new Function(SOURCE)();
  return { fakeMap: fakeMap, L: window.L };
}

afterEach(function() {
  delete window.L;
  delete window.PaddelbuchMap;
  delete window.switzerlandBounds;
});

describe('PaddelbuchMap.init initial view', function() {
  test('without options, the map starts at the config view (home)', function() {
    var env = setup(HOME_CONFIG);
    window.PaddelbuchMap.init('map');

    var mapOptions = env.L.map.mock.calls[0][1];
    expect(env.L.map.mock.calls[0][0]).toBe('map');
    expect(mapOptions.center).toEqual([46.801111, 8.226667]);
    expect(mapOptions.zoom).toBe(8);
  });

  test('without options, a details page map starts at its config view (Req 3.9)', function() {
    var env = setup(DETAIL_CONFIG);
    window.PaddelbuchMap.init('map');

    var mapOptions = env.L.map.mock.calls[0][1];
    expect(mapOptions.center).toEqual([46.68, 7.86]);
    expect(mapOptions.zoom).toBe(15);
    expect(mapOptions.maxBounds).toBeUndefined();
  });

  test('an empty options object changes nothing', function() {
    var env = setup(HOME_CONFIG);
    window.PaddelbuchMap.init('map', {});

    var mapOptions = env.L.map.mock.calls[0][1];
    expect(mapOptions.center).toEqual([46.801111, 8.226667]);
    expect(mapOptions.zoom).toBe(8);
  });

  test('initialView replaces centre and zoom and keeps everything else (Req 3.4)', function() {
    var env = setup(HOME_CONFIG);
    var map = window.PaddelbuchMap.init('map', { initialView: { center: [46.95, 7.44], zoom: 13 } });

    var mapOptions = env.L.map.mock.calls[0][1];
    expect(map).toBe(env.fakeMap);
    expect(mapOptions.center).toEqual([46.95, 7.44]);
    expect(mapOptions.zoom).toBe(13);
    expect(mapOptions.minZoom).toBe(7);
    expect(mapOptions.maxBounds).toEqual({ bounds: [[45.0, 4.5], [49.4, 11.8]] });
    expect(mapOptions.maxBoundsViscosity).toBe(1.0);
    expect(mapOptions.zoomControl).toBe(false);
    expect(env.L.control.zoom).toHaveBeenCalledWith({ position: 'bottomright' });
    expect(env.L.control.locate).toHaveBeenCalledTimes(1);
    expect(env.L.tileLayer).toHaveBeenCalledTimes(1);
  });

  test('L.map is called exactly once, so the map is created at the view rather than moved to it', function() {
    var env = setup(HOME_CONFIG);
    window.PaddelbuchMap.init('map', { initialView: { center: [47.37, 8.54], zoom: 14 } });

    expect(env.L.map).toHaveBeenCalledTimes(1);
    expect(env.fakeMap.setView).toBeUndefined();
  });
});
