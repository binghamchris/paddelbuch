/**
 * Home View Memory Module
 *
 * Remembers the home map's centre and zoom while a visitor reads a details page,
 * so the details pane's close button can return them to the view they left.
 *
 * Privacy contract (spec: detail-close-button, Requirements 4 and 5):
 *   - The view is kept ONLY in this tab's sessionStorage. It is never put in a
 *     URL, history state, cookie or any other storage, never sent over the
 *     network, and never written to the console.
 *   - This module has no analytics code. The close button's analytics event is
 *     a static attribute rendered by Liquid at build time, and nothing here
 *     reads or writes it.
 *   - A source-guard test fails if this file starts using any API that could
 *     move the view off the device.
 *
 * Flow:
 *   1. Home page: a click on a link to a details page saves the view
 *      (wireHomePage, capture phase so nothing in between can swallow it).
 *   2. Details page: a plain click on the close button sets a one-time restore
 *      marker (wireDetailsPage). The link is followed normally.
 *   3. Home page load: consumeRestore always removes the marker, and returns
 *      the saved view only when the marker was set and the view is valid.
 *
 * Every public function catches its own exceptions: blocked, full or tampered
 * storage degrades to "no restore", never to an error on the page.
 */

(function(global) {
  'use strict';

  // Key style follows the search cache ('pbsearch:v1:...'). The schema version
  // lives in the key, so a future format change uses new keys and old records
  // are simply ignored.
  var STORAGE_PREFIX = 'pbhomeview';
  var STORAGE_SCHEMA = 'v1';
  var VIEW_KEY = STORAGE_PREFIX + ':' + STORAGE_SCHEMA + ':view';
  var RESTORE_KEY = STORAGE_PREFIX + ':' + STORAGE_SCHEMA + ':restore';
  var RESTORE_VALUE = '1';

  // Paths of the four details collections, German at the root and English under /en.
  var DETAILS_PATH = /^(\/en)?\/(einstiegsorte|gewaesser|hindernisse|gewaesserereignisse)\/[^\/]+\/?$/;

  var VIEW_KEYS = ['lat', 'lng', 'zoom'];
  var WIRED_FLAG = '_pbHomeViewWired';

  /**
   * Returns this tab's sessionStorage, or null when it is absent or blocked.
   * Merely reading window.sessionStorage throws a SecurityError when the
   * visitor has blocked site data, so the access itself is guarded.
   *
   * @returns {Storage|null}
   */
  function getStorage() {
    try {
      if (typeof window === 'undefined' || !window) return null;
      return window.sessionStorage || null;
    } catch (e) {
      return null;
    }
  }

  function resolveStorage(storage) {
    return storage === undefined ? getStorage() : storage;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  /**
   * Rounds to 5 decimal places (about 1 m): no visible change to the view,
   * and no more precision stored than the feature needs.
   */
  function round5(value) {
    return Math.round(value * 1e5) / 1e5;
  }

  /**
   * @param {number} lat
   * @param {number} lng
   * @param {number} zoom
   * @returns {{lat: number, lng: number, zoom: number}}
   */
  function serialiseView(lat, lng, zoom) {
    return { lat: round5(lat), lng: round5(lng), zoom: zoom };
  }

  /**
   * Saves the map's current centre and zoom as the view record.
   *
   * @param {L.Map} map
   * @param {Storage|null} [storage] - defaults to sessionStorage
   * @returns {boolean} true when the record was written
   */
  function saveView(map, storage) {
    try {
      var store = resolveStorage(storage);
      if (!store || !map) return false;
      var center = map.getCenter();
      var record = serialiseView(center.lat, center.lng, map.getZoom());
      store.setItem(VIEW_KEY, JSON.stringify(record));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Reads the validation limits from the home page's map config, so bounds and
   * zoom range have a single source of truth (_includes/map-init.html).
   *
   * @param {Object} config - parsed #map-config
   * @returns {{south: number, west: number, north: number, east: number,
   *            minZoom: number, maxZoom: number}|null}
   */
  function limitsFromConfig(config) {
    try {
      if (!config || !Array.isArray(config.maxBounds) || config.maxBounds.length !== 2) {
        return null;
      }
      var sw = config.maxBounds[0];
      var ne = config.maxBounds[1];
      if (!Array.isArray(sw) || !Array.isArray(ne) || sw.length !== 2 || ne.length !== 2) {
        return null;
      }
      var limits = {
        south: sw[0],
        west: sw[1],
        north: ne[0],
        east: ne[1],
        minZoom: config.minZoom,
        maxZoom: config.maxZoom
      };
      for (var key in limits) {
        if (Object.prototype.hasOwnProperty.call(limits, key) && !isFiniteNumber(limits[key])) {
          return null;
        }
      }
      return limits;
    } catch (e) {
      return null;
    }
  }

  /**
   * True only for a plain object with exactly the keys lat, lng and zoom, all
   * finite numbers, inside the home map's bounds and zoom range (inclusive).
   *
   * @param {*} record
   * @param {Object|null} limits - from limitsFromConfig
   * @returns {boolean}
   */
  function isValidView(record, limits) {
    if (!limits) return false;
    if (record === null || typeof record !== 'object' || Array.isArray(record)) return false;

    var keys = Object.keys(record).sort();
    if (keys.length !== VIEW_KEYS.length) return false;
    for (var i = 0; i < VIEW_KEYS.length; i++) {
      if (keys[i] !== VIEW_KEYS[i]) return false;
    }

    var lat = record.lat;
    var lng = record.lng;
    var zoom = record.zoom;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !isFiniteNumber(zoom)) return false;

    if (lat < limits.south || lat > limits.north) return false;
    if (lng < limits.west || lng > limits.east) return false;
    if (zoom < limits.minZoom || zoom > limits.maxZoom) return false;

    return true;
  }

  /**
   * Sets the one-time restore marker. Called by the close button.
   *
   * @param {Storage|null} [storage]
   * @returns {boolean} true when the marker was written
   */
  function requestRestore(storage) {
    try {
      var store = resolveStorage(storage);
      if (!store) return false;
      store.setItem(RESTORE_KEY, RESTORE_VALUE);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Called on every home page load. Always removes the restore marker, then
   * returns the saved view when the marker was set and the record is valid.
   * The view record itself is kept, so closing the same details page again
   * after using the back button returns to the same view.
   *
   * @param {Object|null} limits - from limitsFromConfig
   * @param {Storage|null} [storage]
   * @returns {{center: number[], zoom: number}|null}
   */
  function consumeRestore(limits, storage) {
    try {
      var store = resolveStorage(storage);
      if (!store) return null;

      var marker = null;
      try {
        marker = store.getItem(RESTORE_KEY);
      } catch (e) {
        marker = null;
      }
      try {
        store.removeItem(RESTORE_KEY);
      } catch (e) {
        // Nothing more can be done; the marker check below still decides.
      }
      if (marker !== RESTORE_VALUE) return null;

      var raw = store.getItem(VIEW_KEY);
      if (typeof raw !== 'string') return null;

      var record = JSON.parse(raw);
      if (!isValidView(record, limits)) return null;

      return { center: [record.lat, record.lng], zoom: record.zoom };
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {HTMLAnchorElement} anchor
   * @param {string} origin - the page's own origin
   * @returns {boolean} true for a same-origin link to a details page
   */
  function isDetailsLink(anchor, origin) {
    try {
      if (!anchor || !origin || anchor.origin !== origin) return false;
      return DETAILS_PATH.test(anchor.pathname);
    } catch (e) {
      return false;
    }
  }

  /**
   * A primary-button click with no modifier key: the visitor is following the
   * link in this tab. Keyboard activation (Enter) produces the same event.
   *
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  function isUnmodifiedPrimaryClick(event) {
    return !!event &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey;
  }

  /**
   * Home page: save the view when a details link is clicked (or middle-clicked).
   * Capture phase on the document, so no listener between the link and the
   * document can stop the save by stopping propagation.
   *
   * @param {Document} doc
   * @param {function(): L.Map} getMap
   * @param {Storage|null} [storage]
   * @returns {boolean} true when the listeners were added
   */
  function wireHomePage(doc, getMap, storage) {
    if (!doc || typeof doc.addEventListener !== 'function') return false;

    function onActivate(event) {
      try {
        if (event.type === 'auxclick' && event.button !== 1) return;
        var target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        var anchor = target.closest('a[href]');
        if (!anchor) return;
        var origin = doc.location ? doc.location.origin : '';
        if (!isDetailsLink(anchor, origin)) return;
        saveView(typeof getMap === 'function' ? getMap() : null, storage);
      } catch (e) {
        // Never interfere with the navigation the visitor asked for.
      }
    }

    doc.addEventListener('click', onActivate, true);
    doc.addEventListener('auxclick', onActivate, true);
    return true;
  }

  /**
   * Details page: a plain click on the close button sets the restore marker.
   * Modified clicks (new tab or window) do not, because the marker would stay
   * in this tab and take over its next, unrelated visit to the home page.
   *
   * @param {Document} doc
   * @param {Storage|null} [storage]
   * @returns {number} how many buttons were wired by this call
   */
  function wireDetailsPage(doc, storage) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return 0;

    var buttons = doc.querySelectorAll('.detail-close-btn');
    var wired = 0;
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (button[WIRED_FLAG]) continue;
      button[WIRED_FLAG] = true;
      button.addEventListener('click', function(event) {
        if (isUnmodifiedPrimaryClick(event)) {
          requestRestore(storage);
        }
      });
      wired++;
    }
    return wired;
  }

  global.PaddelbuchHomeViewMemory = {
    VIEW_KEY: VIEW_KEY,
    RESTORE_KEY: RESTORE_KEY,
    RESTORE_VALUE: RESTORE_VALUE,
    DETAILS_PATH: DETAILS_PATH,
    getStorage: getStorage,
    round5: round5,
    serialiseView: serialiseView,
    saveView: saveView,
    limitsFromConfig: limitsFromConfig,
    isValidView: isValidView,
    requestRestore: requestRestore,
    consumeRestore: consumeRestore,
    isDetailsLink: isDetailsLink,
    isUnmodifiedPrimaryClick: isUnmodifiedPrimaryClick,
    wireHomePage: wireHomePage,
    wireDetailsPage: wireDetailsPage
  };

  // Details pages load this script from the close-button include; wire it as
  // soon as the button exists. On the home page there is no button, so this is
  // a no-op there (home-map.js calls wireHomePage itself, since it owns the map).
  if (typeof document !== 'undefined' && document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        wireDetailsPage(document);
      });
    } else {
      wireDetailsPage(document);
    }
  }

  // Dual export: the same API for Node/Jest via module.exports.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PaddelbuchHomeViewMemory;
  }

})(typeof window !== 'undefined' ? window : this);
