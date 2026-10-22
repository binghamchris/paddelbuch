/**
 * home-map.js: restore wiring
 *
 * @jest-environment jsdom
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 2.1, 3.3, 3.4, 3.5, 3.6, 3.8, 6.3**
 *
 * home-map.js consumes the restore marker on every load, passes initialView to
 * PaddelbuchMap.init only after a valid consume, wires saving on details links,
 * and keeps the marker-click target zoom tied to the configured default zoom.
 * Without home-view-memory.js it must behave exactly as before.
 */

var fs = require('fs');
var path = require('path');

var SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'home-map.js'), 'utf-8');
var memory = require(path.resolve(__dirname, '../../assets/js/home-view-memory.js'));

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

var fakeMap;

/**
 * Runs home-map.js and returns its DOMContentLoaded handler, captured rather
 * than fired through the document so handlers from earlier tests never re-run.
 */
function loadHandler() {
  var spy = jest.spyOn(document, 'addEventListener');
  new Function(SOURCE)();
  var call = spy.mock.calls.find(function(c) { return c[0] === 'DOMContentLoaded'; });
  spy.mockRestore();
  return call[1];
}

beforeEach(function() {
  window.sessionStorage.clear();
  document.body.innerHTML =
    '<div id="map"></div><script type="application/json" id="map-config">' + JSON.stringify(HOME_CONFIG) + '</script>';
  fakeMap = {
    getCenter: function() { return { lat: 47.05, lng: 8.31, zoom: 0 }; },
    getZoom: function() { return 12; }
  };
  window.PaddelbuchMap = { init: jest.fn(function() { return fakeMap; }) };
  window.PaddelbuchHomeViewMemory = memory;
});

afterEach(function() {
  delete window.PaddelbuchMap;
  delete window.PaddelbuchHomeViewMemory;
  delete window.paddelbuchMap;
  delete window.paddelbuchHomeTargetZoom;
});

describe('home-map.js restore wiring', function() {
  test('with a marker and a valid record, the map is created at the saved view (Req 3.4)', function() {
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 46.95, lng: 7.44, zoom: 13 }));
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');

    loadHandler()();

    expect(window.PaddelbuchMap.init).toHaveBeenCalledTimes(1);
    expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', {
      initialView: { center: [46.95, 7.44], zoom: 13 }
    });
    expect(window.paddelbuchMap).toBe(fakeMap);
  });

  test('without a marker, the map starts at the default view even with a record (Req 3.5)', function() {
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 46.95, lng: 7.44, zoom: 13 }));

    loadHandler()();

    expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', undefined);
  });

  test('with a marker but an invalid record, the map starts at the default view (Req 3.6)', function() {
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 52.52, lng: 13.4, zoom: 13 }));
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');

    loadHandler()();

    expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', undefined);
  });

  test('the marker is consumed on every load (Req 3.3)', function() {
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');
    loadHandler()();
    expect(window.sessionStorage.getItem(memory.RESTORE_KEY)).toBeNull();
  });

  test('validation limits come from #map-config (Req 6.3)', function() {
    var narrowed = Object.assign({}, HOME_CONFIG, { maxZoom: 12 });
    document.getElementById('map-config').textContent = JSON.stringify(narrowed);
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 46.95, lng: 7.44, zoom: 13 }));
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');

    loadHandler()();

    expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', undefined);
  });

  test('the marker-click target zoom stays default + 3 after a restore', function() {
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 46.95, lng: 7.44, zoom: 15 }));
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');

    loadHandler()();

    expect(window.paddelbuchHomeTargetZoom).toBe(11);
  });

  test('a details link click saves the live map view (Req 2.1)', function() {
    var wire = jest.spyOn(memory, 'wireHomePage');
    loadHandler()();
    expect(wire).toHaveBeenCalledTimes(1);
    expect(wire.mock.calls[0][0]).toBe(document);
    expect(wire.mock.calls[0][1]()).toBe(fakeMap);
    wire.mockRestore();
  });

  test('without home-view-memory.js, behaviour is unchanged (Req 3.8)', function() {
    delete window.PaddelbuchHomeViewMemory;
    window.sessionStorage.setItem(memory.VIEW_KEY, JSON.stringify({ lat: 46.95, lng: 7.44, zoom: 13 }));
    window.sessionStorage.setItem(memory.RESTORE_KEY, '1');

    expect(function() { loadHandler()(); }).not.toThrow();

    expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', undefined);
    expect(window.paddelbuchMap).toBe(fakeMap);
    expect(window.paddelbuchHomeTargetZoom).toBe(11);
    expect(window.sessionStorage.getItem(memory.RESTORE_KEY)).toBe('1');
  });
});
