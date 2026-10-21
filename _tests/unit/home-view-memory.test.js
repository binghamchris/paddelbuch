/**
 * Home View Memory: module contract
 *
 * @jest-environment jsdom
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 2.2, 2.5, 2.6, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 5.5, 5.6, 6.1, 6.2, 6.3**
 */

var path = require('path');

var memory = require(path.resolve(__dirname, '../../assets/js/home-view-memory.js'));

// Mirrors the home map config in _includes/map-init.html.
var HOME_CONFIG = {
  maxBounds: [[45.0, 4.5], [49.4, 11.8]],
  minZoom: 7,
  maxZoom: 20
};
var LIMITS = memory.limitsFromConfig(HOME_CONFIG);

function makeStorage() {
  var data = {};
  return {
    data: data,
    getItem: function(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function(key, value) {
      data[key] = String(value);
    },
    removeItem: function(key) {
      delete data[key];
    }
  };
}

function throwingStorage() {
  function fail() {
    throw new Error('SecurityError: storage is blocked');
  }
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function fakeMap(lat, lng, zoom) {
  return {
    getCenter: function() { return { lat: lat, lng: lng }; },
    getZoom: function() { return zoom; }
  };
}

/**
 * jsdom does not implement navigation, so a followed link logs an error. This
 * registers a listener that runs AFTER the module's own listeners, records
 * whether they cancelled the event, then cancels it to stop the navigation.
 */
function guardNavigation(anchor) {
  var seen = { defaultPrevented: null, count: 0 };
  anchor.addEventListener('click', function(event) {
    seen.defaultPrevented = event.defaultPrevented;
    seen.count++;
    event.preventDefault();
  });
  return seen;
}

function click(element, init) {
  var event = new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, button: 0 }, init || {}));
  element.dispatchEvent(event);
  return event;
}

function storeValidRecord(store, record) {
  store.setItem(memory.VIEW_KEY, JSON.stringify(record || { lat: 46.95, lng: 7.44, zoom: 12 }));
}

describe('keys and serialisation', function() {
  test('storage keys follow the pbsearch:v1 style', function() {
    expect(memory.VIEW_KEY).toBe('pbhomeview:v1:view');
    expect(memory.RESTORE_KEY).toBe('pbhomeview:v1:restore');
    expect(memory.RESTORE_VALUE).toBe('1');
  });

  test('round5 rounds to five decimal places', function() {
    expect(memory.round5(46.8011114)).toBe(46.80111);
    expect(memory.round5(8.2266678)).toBe(8.22667);
    expect(memory.round5(7)).toBe(7);
  });

  test('saveView writes exactly lat, lng and zoom, rounded (Req 2.2)', function() {
    var store = makeStorage();
    expect(memory.saveView(fakeMap(46.80111149, 8.22666712, 11), store)).toBe(true);

    var record = JSON.parse(store.data[memory.VIEW_KEY]);
    expect(Object.keys(record).sort()).toEqual(['lat', 'lng', 'zoom']);
    expect(record).toEqual({ lat: 46.80111, lng: 8.22667, zoom: 11 });
    expect(Object.keys(store.data)).toEqual([memory.VIEW_KEY]);
  });

  test('saveView replaces an earlier record', function() {
    var store = makeStorage();
    memory.saveView(fakeMap(46, 7, 9), store);
    memory.saveView(fakeMap(47, 8, 13), store);
    expect(JSON.parse(store.data[memory.VIEW_KEY])).toEqual({ lat: 47, lng: 8, zoom: 13 });
  });

  test('requestRestore writes the constant "1" and nothing else (Req 5.5, 5.6)', function() {
    var store = makeStorage();
    expect(memory.requestRestore(store)).toBe(true);
    expect(store.data).toEqual({ 'pbhomeview:v1:restore': '1' });
  });
});

describe('limitsFromConfig (Req 6.3)', function() {
  test('reads bounds and zoom range from the map config', function() {
    expect(LIMITS).toEqual({ south: 45, west: 4.5, north: 49.4, east: 11.8, minZoom: 7, maxZoom: 20 });
  });

  test.each([
    ['null config', null],
    ['no maxBounds', { minZoom: 7, maxZoom: 20 }],
    ['no minZoom', { maxBounds: [[45, 4.5], [49.4, 11.8]], maxZoom: 20 }],
    ['no maxZoom', { maxBounds: [[45, 4.5], [49.4, 11.8]], minZoom: 7 }],
    ['malformed maxBounds', { maxBounds: [45, 4.5, 49.4, 11.8], minZoom: 7, maxZoom: 20 }],
    ['string bound', { maxBounds: [['45', 4.5], [49.4, 11.8]], minZoom: 7, maxZoom: 20 }]
  ])('returns null for %s', function(_label, config) {
    expect(memory.limitsFromConfig(config)).toBeNull();
  });
});

describe('consumeRestore', function() {
  test('returns the saved view when the marker is set (Req 3.4)', function() {
    var store = makeStorage();
    storeValidRecord(store, { lat: 46.95, lng: 7.44, zoom: 12 });
    memory.requestRestore(store);
    expect(memory.consumeRestore(LIMITS, store)).toEqual({ center: [46.95, 7.44], zoom: 12 });
  });

  test('is one-time: a second home load does not restore (Req 3.3)', function() {
    var store = makeStorage();
    storeValidRecord(store);
    memory.requestRestore(store);
    expect(memory.consumeRestore(LIMITS, store)).not.toBeNull();
    expect(memory.consumeRestore(LIMITS, store)).toBeNull();
  });

  test('removes a marker whose value is not "1" (Req 3.3)', function() {
    var store = makeStorage();
    storeValidRecord(store);
    store.setItem(memory.RESTORE_KEY, 'true');
    expect(memory.consumeRestore(LIMITS, store)).toBeNull();
    expect(store.getItem(memory.RESTORE_KEY)).toBeNull();
  });

  test('without the marker, does not restore even with a record present (Req 3.5)', function() {
    var store = makeStorage();
    storeValidRecord(store);
    expect(memory.consumeRestore(LIMITS, store)).toBeNull();
  });

  test('keeps the view record after a restore (Req 3.7)', function() {
    var store = makeStorage();
    storeValidRecord(store, { lat: 46.95, lng: 7.44, zoom: 12 });
    memory.requestRestore(store);
    memory.consumeRestore(LIMITS, store);
    expect(store.getItem(memory.VIEW_KEY)).not.toBeNull();

    memory.requestRestore(store);
    expect(memory.consumeRestore(LIMITS, store)).toEqual({ center: [46.95, 7.44], zoom: 12 });
  });

  test('returns null when limits are null', function() {
    var store = makeStorage();
    storeValidRecord(store);
    memory.requestRestore(store);
    expect(memory.consumeRestore(null, store)).toBeNull();
  });

  test.each([
    ['not JSON', '{lat:46'],
    ['an array', '[46.9, 7.4, 12]'],
    ['null', 'null'],
    ['an extra key', '{"lat":46.9,"lng":7.4,"zoom":12,"bearing":0}'],
    ['a missing key', '{"lat":46.9,"lng":7.4}'],
    ['a string number', '{"lat":"46.9","lng":7.4,"zoom":12}'],
    ['an infinite value', '{"lat":1e999,"lng":7.4,"zoom":12}'],
    ['latitude north of the bounds', '{"lat":49.5,"lng":7.4,"zoom":12}'],
    ['longitude west of the bounds', '{"lat":46.9,"lng":4.4,"zoom":12}'],
    ['zoom below minZoom', '{"lat":46.9,"lng":7.4,"zoom":6}'],
    ['zoom above maxZoom', '{"lat":46.9,"lng":7.4,"zoom":21}']
  ])('rejects a record that is %s (Req 6.2)', function(_label, raw) {
    var store = makeStorage();
    store.setItem(memory.VIEW_KEY, raw);
    memory.requestRestore(store);
    expect(memory.consumeRestore(LIMITS, store)).toBeNull();
  });

  test('accepts values on the inclusive edges of the limits', function() {
    var store = makeStorage();
    storeValidRecord(store, { lat: 49.4, lng: 4.5, zoom: 20 });
    memory.requestRestore(store);
    expect(memory.consumeRestore(LIMITS, store)).toEqual({ center: [49.4, 4.5], zoom: 20 });
  });
});

describe('unusable storage (Req 6.1)', function() {
  test('every function survives storage methods that throw', function() {
    var store = throwingStorage();
    expect(memory.saveView(fakeMap(46.9, 7.4, 12), store)).toBe(false);
    expect(memory.requestRestore(store)).toBe(false);
    expect(memory.consumeRestore(LIMITS, store)).toBeNull();
  });

  test('every function survives null storage', function() {
    expect(memory.saveView(fakeMap(46.9, 7.4, 12), null)).toBe(false);
    expect(memory.requestRestore(null)).toBe(false);
    expect(memory.consumeRestore(LIMITS, null)).toBeNull();
  });

  describe('when reading window.sessionStorage throws', function() {
    var ownDescriptor;

    beforeEach(function() {
      ownDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get: function() { throw new Error('SecurityError: site data blocked'); }
      });
    });

    afterEach(function() {
      if (ownDescriptor) {
        Object.defineProperty(window, 'sessionStorage', ownDescriptor);
      } else {
        delete window.sessionStorage;
      }
    });

    test('getStorage returns null and the defaults degrade quietly', function() {
      expect(memory.getStorage()).toBeNull();
      expect(memory.saveView(fakeMap(46.9, 7.4, 12))).toBe(false);
      expect(memory.requestRestore()).toBe(false);
      expect(memory.consumeRestore(LIMITS)).toBeNull();
    });
  });

  test('getStorage returns the real sessionStorage when it is usable', function() {
    expect(memory.getStorage()).toBe(window.sessionStorage);
  });
});

describe('isDetailsLink', function() {
  function anchor(href) {
    var a = document.createElement('a');
    a.setAttribute('href', href);
    return a;
  }
  var origin = window.location.origin;

  test.each([
    '/einstiegsorte/bonigen-bootsrampe/',
    '/gewaesser/thunersee/',
    '/hindernisse/wehr-thun/',
    '/gewaesserereignisse/sperrung-aare/',
    '/en/einstiegsorte/bonigen-bootsrampe/',
    '/en/gewaesser/thunersee/',
    '/en/hindernisse/wehr-thun',
    '/en/gewaesserereignisse/sperrung-aare/',
    '/einstiegsorte/bonigen-bootsrampe/?ref=popup',
    '/gewaesser/seen'
  ])('matches %s', function(href) {
    expect(memory.isDetailsLink(anchor(href), origin)).toBe(true);
  });

  test.each([
    '/',
    '/en/',
    '/ueber/',
    '/datenschutz/',
    '/einstiegsorte/',
    '/einstiegsorte/a/b/',
    '/de/einstiegsorte/x/',
    'https://www.google.com/maps/dir/?api=1&destination=46.9,7.4',
    'https://example.org/einstiegsorte/x/'
  ])('does not match %s', function(href) {
    expect(memory.isDetailsLink(anchor(href), origin)).toBe(false);
  });

  test('rejects missing input', function() {
    expect(memory.isDetailsLink(null, origin)).toBe(false);
    expect(memory.isDetailsLink(anchor('/einstiegsorte/x/'), '')).toBe(false);
  });
});

describe('isUnmodifiedPrimaryClick', function() {
  test('accepts a plain primary click', function() {
    expect(memory.isUnmodifiedPrimaryClick({ button: 0 })).toBe(true);
  });

  test.each([
    ['Ctrl', { button: 0, ctrlKey: true }],
    ['Meta', { button: 0, metaKey: true }],
    ['Shift', { button: 0, shiftKey: true }],
    ['Alt', { button: 0, altKey: true }],
    ['middle button', { button: 1 }],
    ['right button', { button: 2 }]
  ])('rejects a click with %s', function(_label, event) {
    expect(memory.isUnmodifiedPrimaryClick(event)).toBe(false);
  });

  test('rejects a missing event', function() {
    expect(memory.isUnmodifiedPrimaryClick(null)).toBe(false);
  });
});

describe('wireHomePage (Req 2.1, 2.3, 2.6)', function() {
  // Each test gets a fresh document body, but listeners on the document persist
  // across tests, so every test uses its own storage and map.
  beforeEach(function() {
    document.body.innerHTML = '';
  });

  test('saves the view on a details link click, even when propagation is stopped below the document', function() {
    var store = makeStorage();
    memory.wireHomePage(document, function() { return fakeMap(46.68, 7.86, 13); }, store);

    document.body.innerHTML =
      '<div class="leaflet-popup"><button class="popup-btn"><a id="details" href="/einstiegsorte/bonigen-bootsrampe/">Weitere Details</a></button></div>';
    var popup = document.querySelector('.leaflet-popup');
    popup.addEventListener('click', function(event) { event.stopPropagation(); });
    var link = document.getElementById('details');
    var seen = guardNavigation(link);

    click(link);

    expect(JSON.parse(store.data[memory.VIEW_KEY])).toEqual({ lat: 46.68, lng: 7.86, zoom: 13 });
    expect(seen.count).toBe(1);
    expect(seen.defaultPrevented).toBe(false);
  });

  test('saves when the click lands on an element inside the link', function() {
    var store = makeStorage();
    memory.wireHomePage(document, function() { return fakeMap(47.37, 8.54, 14); }, store);

    document.body.innerHTML = '<a id="details" href="/en/hindernisse/wehr/"><span id="inner">More details</span></a>';
    guardNavigation(document.getElementById('details'));
    click(document.getElementById('inner'));

    expect(JSON.parse(store.data[memory.VIEW_KEY])).toEqual({ lat: 47.37, lng: 8.54, zoom: 14 });
  });

  test('saves on a middle click, not on a right click', function() {
    var store = makeStorage();
    memory.wireHomePage(document, function() { return fakeMap(46.2, 6.15, 12); }, store);

    document.body.innerHTML = '<a id="details" href="/gewaesser/genfersee/">Genfersee</a>';
    var link = document.getElementById('details');

    link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }));
    expect(store.data[memory.VIEW_KEY]).toBeUndefined();

    link.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(JSON.parse(store.data[memory.VIEW_KEY])).toEqual({ lat: 46.2, lng: 6.15, zoom: 12 });
  });

  test('does not save for links that are not details links (Req 2.3)', function() {
    var store = makeStorage();
    memory.wireHomePage(document, function() { return fakeMap(46.9, 7.4, 12); }, store);

    document.body.innerHTML =
      '<a id="about" href="/ueber/">About</a>' +
      '<a id="nav" href="https://www.google.com/maps/dir/?api=1&destination=46.9,7.4">Navigate</a>' +
      '<button id="plain">Filter</button>';
    guardNavigation(document.getElementById('about'));
    guardNavigation(document.getElementById('nav'));

    click(document.getElementById('about'));
    click(document.getElementById('nav'));
    click(document.getElementById('plain'));
    click(document.body);

    expect(store.data).toEqual({});
  });

  test('a failing map does not break the click', function() {
    memory.wireHomePage(document, function() { throw new Error('no map'); }, makeStorage());

    document.body.innerHTML = '<a id="details" href="/einstiegsorte/x/">x</a>';
    var seen = guardNavigation(document.getElementById('details'));
    expect(function() { click(document.getElementById('details')); }).not.toThrow();
    expect(seen.defaultPrevented).toBe(false);
  });

  test('returns false for a missing document', function() {
    expect(memory.wireHomePage(null, function() {}, makeStorage())).toBe(false);
  });
});

describe('wireDetailsPage (Req 3.1, 3.2)', function() {
  function renderCloseButton() {
    document.body.innerHTML =
      '<div class="obstacle-title"><span class="h1 detail-close-slot"><a href="/" class="detail-close-btn" data-tinylytics-event="detail.close" data-tinylytics-event-value="obstacle">' +
      '<svg aria-hidden="true" focusable="false"><path d="M0 0"/></svg></a></span><h1>Wehr</h1></div>';
    return document.querySelector('.detail-close-btn');
  }

  test('a plain click sets the marker and lets the link be followed', function() {
    var store = makeStorage();
    var button = renderCloseButton();
    expect(memory.wireDetailsPage(document, store)).toBe(1);
    var seen = guardNavigation(button);

    click(button);

    expect(store.data).toEqual({ 'pbhomeview:v1:restore': '1' });
    expect(seen.defaultPrevented).toBe(false);
  });

  test.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }]
  ])('a %s-click does not set the marker', function(_label, init) {
    var store = makeStorage();
    var button = renderCloseButton();
    memory.wireDetailsPage(document, store);
    guardNavigation(button);

    click(button, init);

    expect(store.data).toEqual({});
  });

  test('wiring twice adds only one listener', function() {
    var store = makeStorage();
    var setItem = jest.spyOn(store, 'setItem');
    var button = renderCloseButton();
    expect(memory.wireDetailsPage(document, store)).toBe(1);
    expect(memory.wireDetailsPage(document, store)).toBe(0);
    guardNavigation(button);

    click(button);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  test('blocked storage still lets the link be followed (Req 6.4)', function() {
    var button = renderCloseButton();
    memory.wireDetailsPage(document, throwingStorage());
    var seen = guardNavigation(button);

    expect(function() { click(button); }).not.toThrow();
    expect(seen.count).toBe(1);
    expect(seen.defaultPrevented).toBe(false);
  });

  test('returns 0 for a page without a close button or a document', function() {
    document.body.innerHTML = '<p>no button</p>';
    expect(memory.wireDetailsPage(document, makeStorage())).toBe(0);
    expect(memory.wireDetailsPage(null, makeStorage())).toBe(0);
  });
});
