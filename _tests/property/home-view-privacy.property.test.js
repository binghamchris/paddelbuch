/**
 * Home View Memory: end-to-end privacy property
 *
 * @jest-environment jsdom
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 8.1**
 *
 * For any home map view, the whole round trip -- open a details page from the
 * home map, click the close button, load the home page again -- must:
 *   - restore exactly the rounded view, through the real home-map.js handler;
 *   - never put the view in a URL or history state;
 *   - never write a cookie or localStorage, or any sessionStorage key beyond the
 *     two known ones;
 *   - leave every data-tinylytics-* attribute byte-identical;
 *   - never call the Tinylytics beacon, sendBeacon, fetch or XMLHttpRequest;
 *   - never write to the console.
 */

var fc = require('fast-check');
var fs = require('fs');
var path = require('path');

var memory = require(path.resolve(__dirname, '../../assets/js/home-view-memory.js'));
var HOME_MAP_SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'home-map.js'), 'utf-8');

// Mirrors the home map config in _includes/map-init.html.
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

var COLLECTIONS = ['einstiegsorte', 'gewaesser', 'hindernisse', 'gewaesserereignisse'];
var PAGE_TYPES = ['spot', 'waterway', 'obstacle', 'notice'];
var CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'];

var viewArb = fc.record({
  lat: fc.double({ min: 45.0, max: 49.4, noNaN: true }),
  lng: fc.double({ min: 4.5, max: 11.8, noNaN: true }),
  zoom: fc.integer({ min: 7, max: 20 })
});
var scenarioArb = fc.record({
  view: viewArb,
  collection: fc.constantFrom.apply(fc, COLLECTIONS),
  pageType: fc.constantFrom.apply(fc, PAGE_TYPES),
  english: fc.boolean(),
  slug: fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+){0,3}$/)
});

var homeHandler;
var spies;
var originalFetch;

/** Runs home-map.js once and captures its DOMContentLoaded handler. */
function captureHomeHandler() {
  var spy = jest.spyOn(document, 'addEventListener');
  new Function(HOME_MAP_SOURCE)();
  var call = spy.mock.calls.find(function(c) { return c[0] === 'DOMContentLoaded'; });
  spy.mockRestore();
  return call[1];
}

/**
 * Calls the home handler and removes any document listeners it adds once the
 * run finishes, so 100 runs do not stack 200 listeners on one document.
 */
function runHomeLoad(added) {
  var original = document.addEventListener;
  document.addEventListener = function(type, listener, options) {
    added.push([type, listener, options]);
    return original.call(document, type, listener, options);
  };
  try {
    homeHandler();
  } finally {
    document.addEventListener = original;
  }
}

function renderHome(scenario) {
  var prefix = scenario.english ? '/en' : '';
  var href = prefix + '/' + scenario.collection + '/' + scenario.slug + '/';
  document.body.innerHTML =
    '<header><a class="navbar-brand" href="' + prefix + '/">Paddel Buch</a></header>' +
    '<div id="map"></div>' +
    '<script type="application/json" id="map-config">' + JSON.stringify(HOME_CONFIG) + '</script>' +
    '<div class="leaflet-popup"><button class="popup-btn popup-btn-right" ' +
    'data-tinylytics-event="popup.details" data-tinylytics-event-value="' + scenario.slug + '">' +
    '<a id="details-link" href="' + href + '">Weitere Details</a></button></div>';
}

// Mirrors the rendered output of _includes/detail-close-btn.html, which
// spec/detail_close_btn_spec.rb pins against the real include.
function renderDetails(scenario) {
  var prefix = scenario.english ? '/en' : '';
  document.body.innerHTML =
    '<div class="spot-description"><div class="detail-close-row">' +
    '<a href="' + prefix + '/" class="detail-close-btn" title="Back to map" aria-label="Back to map" ' +
    'data-tinylytics-event="detail.close" data-tinylytics-event-value="' + scenario.pageType + '">' +
    '<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">' +
    '<path d="M2 2L14 14"/></svg></a></div>' +
    '<a class="btn navigate-btn" href="https://www.google.com/maps/dir/?api=1&amp;destination=46.9,7.4" ' +
    'data-tinylytics-event="navigate.click" data-tinylytics-event-value="' + scenario.slug + '">Navigieren zu</a>' +
    '</div>';
}

/** Every data-tinylytics-* attribute in the document, in document order. */
function tinylyticsAttributes() {
  var found = [];
  document.querySelectorAll('*').forEach(function(el) {
    Array.prototype.forEach.call(el.attributes, function(attr) {
      if (attr.name.indexOf('data-tinylytics') === 0) {
        found.push(el.tagName + '|' + attr.name + '=' + attr.value);
      }
    });
  });
  return found;
}

/** Stops jsdom's unimplemented navigation; registered after the module's listeners. */
function guardNavigation(anchor) {
  anchor.addEventListener('click', function(event) { event.preventDefault(); });
}

function plainClick(element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function sessionKeys() {
  var keys = [];
  for (var i = 0; i < window.sessionStorage.length; i++) {
    keys.push(window.sessionStorage.key(i));
  }
  return keys.sort();
}

beforeAll(function() {
  window.PaddelbuchHomeViewMemory = memory;
  homeHandler = captureHomeHandler();
});

beforeEach(function() {
  spies = {
    pushState: jest.spyOn(window.history, 'pushState'),
    replaceState: jest.spyOn(window.history, 'replaceState'),
    xhrOpen: jest.spyOn(XMLHttpRequest.prototype, 'open'),
    beacon: jest.fn(),
    sendBeacon: jest.fn(function() { return true; }),
    fetch: jest.fn(),
    console: {}
  };
  CONSOLE_METHODS.forEach(function(method) {
    spies.console[method] = jest.spyOn(console, method).mockImplementation(function() {});
  });
  window.PaddelbuchTinylyticsBeacon = { dispatch: spies.beacon };
  Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, writable: true, value: spies.sendBeacon });
  originalFetch = window.fetch;
  window.fetch = spies.fetch;
});

afterEach(function() {
  jest.restoreAllMocks();
  delete window.PaddelbuchTinylyticsBeacon;
  delete window.navigator.sendBeacon;
  if (originalFetch === undefined) {
    delete window.fetch;
  } else {
    window.fetch = originalFetch;
  }
  delete window.PaddelbuchMap;
  delete window.paddelbuchMap;
  delete window.paddelbuchHomeTargetZoom;
});

afterAll(function() {
  delete window.PaddelbuchHomeViewMemory;
});

describe('Privacy property: the home view never leaves the browser', function() {
  test('a full open-close-restore round trip', function() {
    fc.assert(
      fc.property(scenarioArb, function(scenario) {
        var added = [];
        window.sessionStorage.clear();
        window.localStorage.clear();

        try {
          var view = scenario.view;
          var liveMap = {
            getCenter: function() { return { lat: view.lat, lng: view.lng }; },
            getZoom: function() { return view.zoom; }
          };
          window.PaddelbuchMap = { init: jest.fn(function() { return liveMap; }) };

          // 1. Home page load, then open a details page from a popup.
          renderHome(scenario);
          runHomeLoad(added);
          expect(window.PaddelbuchMap.init).toHaveBeenLastCalledWith('map', undefined);

          var homeAttrsBefore = tinylyticsAttributes();
          var link = document.getElementById('details-link');
          guardNavigation(link);
          plainClick(link);
          expect(tinylyticsAttributes()).toEqual(homeAttrsBefore);
          expect(sessionKeys()).toEqual([memory.VIEW_KEY]);

          // 2. Details page: click the close button.
          renderDetails(scenario);
          memory.wireDetailsPage(document);
          var detailAttrsBefore = tinylyticsAttributes();
          var closeButton = document.querySelector('.detail-close-btn');
          guardNavigation(closeButton);
          plainClick(closeButton);

          expect(tinylyticsAttributes()).toEqual(detailAttrsBefore);
          expect(closeButton.getAttribute('data-tinylytics-event')).toBe('detail.close');
          expect(closeButton.getAttribute('data-tinylytics-event-value')).toBe(scenario.pageType);
          expect(closeButton.getAttribute('href')).toBe(scenario.english ? '/en/' : '/');
          expect(sessionKeys()).toEqual([memory.RESTORE_KEY, memory.VIEW_KEY].sort());
          expect(window.sessionStorage.getItem(memory.RESTORE_KEY)).toBe('1');

          // 3. Home page load via the close button: the map is created at the view.
          renderHome(scenario);
          window.PaddelbuchMap.init.mockClear();
          runHomeLoad(added);
          expect(window.PaddelbuchMap.init).toHaveBeenCalledWith('map', {
            initialView: {
              center: [memory.round5(view.lat), memory.round5(view.lng)],
              zoom: view.zoom
            }
          });
          expect(sessionKeys()).toEqual([memory.VIEW_KEY]);

          // Nothing about the view went anywhere else.
          expect(spies.pushState).not.toHaveBeenCalled();
          expect(spies.replaceState).not.toHaveBeenCalled();
          expect(window.location.search).toBe('');
          expect(window.location.hash).toBe('');
          expect(window.localStorage.length).toBe(0);
          expect(document.cookie).toBe('');
          expect(spies.beacon).not.toHaveBeenCalled();
          expect(spies.sendBeacon).not.toHaveBeenCalled();
          expect(spies.fetch).not.toHaveBeenCalled();
          expect(spies.xhrOpen).not.toHaveBeenCalled();
          CONSOLE_METHODS.forEach(function(method) {
            expect(spies.console[method]).not.toHaveBeenCalled();
          });
        } finally {
          added.forEach(function(entry) {
            document.removeEventListener(entry[0], entry[1], entry[2]);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  test('blocked storage: the close button still navigates and nothing leaks (Req 6.4)', function() {
    var ownDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: function() { throw new Error('SecurityError: site data blocked'); }
    });

    try {
      renderDetails({ english: false, pageType: 'obstacle', slug: 'wehr' });
      memory.wireDetailsPage(document);
      var closeButton = document.querySelector('.detail-close-btn');
      var followed = { count: 0, defaultPrevented: null };
      closeButton.addEventListener('click', function(event) {
        followed.count++;
        followed.defaultPrevented = event.defaultPrevented;
        event.preventDefault();
      });

      expect(function() { plainClick(closeButton); }).not.toThrow();
      expect(followed).toEqual({ count: 1, defaultPrevented: false });
      expect(closeButton.getAttribute('data-tinylytics-event-value')).toBe('obstacle');
      expect(window.localStorage.length).toBe(0);
      expect(document.cookie).toBe('');
      CONSOLE_METHODS.forEach(function(method) {
        expect(spies.console[method]).not.toHaveBeenCalled();
      });
    } finally {
      if (ownDescriptor) {
        Object.defineProperty(window, 'sessionStorage', ownDescriptor);
      } else {
        delete window.sessionStorage;
      }
    }
  });
});
