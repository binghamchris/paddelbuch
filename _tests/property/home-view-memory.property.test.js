/**
 * Home View Memory: property tests
 *
 * @jest-environment jsdom
 *
 * **Feature: detail-close-button**
 * **Validates: Requirements 2.2, 3.4, 6.1, 6.2, 8.3**
 *
 * Property 1: any in-bounds view saves and then restores to its rounded self.
 * Property 2: near-miss records (one thing wrong with a valid record) never restore.
 * Property 3: arbitrary stored content never throws, and anything that does
 *             restore passes isValidView.
 */

var fc = require('fast-check');
var path = require('path');

var memory = require(path.resolve(__dirname, '../../assets/js/home-view-memory.js'));

// Mirrors the home map config in _includes/map-init.html.
var LIMITS = memory.limitsFromConfig({
  maxBounds: [[45.0, 4.5], [49.4, 11.8]],
  minZoom: 7,
  maxZoom: 20
});

var RUNS = { numRuns: 200 };

function makeStorage() {
  var data = {};
  return {
    data: data,
    getItem: function(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function(key, value) { data[key] = String(value); },
    removeItem: function(key) { delete data[key]; }
  };
}

function fakeMap(lat, lng, zoom) {
  return {
    getCenter: function() { return { lat: lat, lng: lng }; },
    getZoom: function() { return zoom; }
  };
}

var latArb = fc.double({ min: LIMITS.south, max: LIMITS.north, noNaN: true });
var lngArb = fc.double({ min: LIMITS.west, max: LIMITS.east, noNaN: true });
var zoomArb = fc.oneof(
  fc.integer({ min: LIMITS.minZoom, max: LIMITS.maxZoom }),
  fc.double({ min: LIMITS.minZoom, max: LIMITS.maxZoom, noNaN: true })
);
var validRecordArb = fc.record({ lat: latArb, lng: lngArb, zoom: zoomArb }).map(function(r) {
  return memory.serialiseView(r.lat, r.lng, r.zoom);
});

function restoreRaw(raw) {
  var store = makeStorage();
  store.setItem(memory.VIEW_KEY, raw);
  memory.requestRestore(store);
  return memory.consumeRestore(LIMITS, store);
}

describe('Property 1: round trip', function() {
  test('an in-bounds view restores to its rounded self', function() {
    fc.assert(
      fc.property(latArb, lngArb, zoomArb, function(lat, lng, zoom) {
        var store = makeStorage();
        expect(memory.saveView(fakeMap(lat, lng, zoom), store)).toBe(true);
        memory.requestRestore(store);

        var restored = memory.consumeRestore(LIMITS, store);

        expect(restored).toEqual({
          center: [memory.round5(lat), memory.round5(lng)],
          zoom: zoom
        });
      }),
      RUNS
    );
  });
});

describe('Property 2: near-miss records never restore', function() {
  var outOfRange = fc.oneof(
    latArb.map(function() { return { field: 'lat', value: LIMITS.north + 0.001 }; }),
    fc.double({ min: -90, max: LIMITS.south - 1e-6, noNaN: true }).map(function(v) { return { field: 'lat', value: v }; }),
    fc.double({ min: LIMITS.north + 1e-6, max: 90, noNaN: true }).map(function(v) { return { field: 'lat', value: v }; }),
    fc.double({ min: -180, max: LIMITS.west - 1e-6, noNaN: true }).map(function(v) { return { field: 'lng', value: v }; }),
    fc.double({ min: LIMITS.east + 1e-6, max: 180, noNaN: true }).map(function(v) { return { field: 'lng', value: v }; }),
    fc.double({ min: -5, max: LIMITS.minZoom - 1e-6, noNaN: true }).map(function(v) { return { field: 'zoom', value: v }; }),
    fc.double({ min: LIMITS.maxZoom + 1e-6, max: 40, noNaN: true }).map(function(v) { return { field: 'zoom', value: v }; })
  );

  test('a field outside the bounds or zoom range', function() {
    fc.assert(
      fc.property(validRecordArb, outOfRange, function(record, change) {
        var broken = Object.assign({}, record);
        broken[change.field] = change.value;
        expect(restoreRaw(JSON.stringify(broken))).toBeNull();
      }),
      RUNS
    );
  });

  test('an extra key', function() {
    var extraKey = fc.string({ minLength: 1 }).filter(function(k) {
      return ['lat', 'lng', 'zoom', '__proto__'].indexOf(k) === -1;
    });
    fc.assert(
      fc.property(validRecordArb, extraKey, fc.jsonValue(), function(record, key, value) {
        var broken = Object.assign({}, record);
        broken[key] = value;
        expect(restoreRaw(JSON.stringify(broken))).toBeNull();
      }),
      RUNS
    );
  });

  test('a missing key', function() {
    fc.assert(
      fc.property(validRecordArb, fc.constantFrom('lat', 'lng', 'zoom'), function(record, key) {
        var broken = Object.assign({}, record);
        delete broken[key];
        expect(restoreRaw(JSON.stringify(broken))).toBeNull();
      }),
      RUNS
    );
  });

  test('a field that is not a finite number', function() {
    var notANumber = fc.oneof(
      fc.string(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.integer(), { maxLength: 3 }),
      fc.dictionary(fc.string(), fc.integer(), { maxKeys: 2 })
    );
    fc.assert(
      fc.property(validRecordArb, fc.constantFrom('lat', 'lng', 'zoom'), notANumber, function(record, key, value) {
        var broken = Object.assign({}, record);
        broken[key] = value;
        expect(restoreRaw(JSON.stringify(broken))).toBeNull();
      }),
      RUNS
    );
  });

  test('an infinite value written as 1e999', function() {
    fc.assert(
      fc.property(validRecordArb, fc.constantFrom('lat', 'lng', 'zoom'), fc.boolean(), function(record, key, negative) {
        var raw = JSON.stringify(record).replace(
          new RegExp('"' + key + '":[^,}]+'),
          '"' + key + '":' + (negative ? '-' : '') + '1e999'
        );
        expect(restoreRaw(raw)).toBeNull();
      }),
      RUNS
    );
  });
});

describe('Property 3: arbitrary stored content', function() {
  var anything = fc.oneof(
    fc.string(),
    fc.json(),
    fc.jsonValue().map(function(v) { return JSON.stringify(v); }),
    validRecordArb.map(function(r) { return JSON.stringify(r); })
  );

  test('never throws, and every restored view is valid', function() {
    fc.assert(
      fc.property(anything, function(raw) {
        var restored;
        expect(function() { restored = restoreRaw(raw); }).not.toThrow();
        if (restored !== null) {
          var record = { lat: restored.center[0], lng: restored.center[1], zoom: restored.zoom };
          expect(memory.isValidView(record, LIMITS)).toBe(true);
        }
      }),
      RUNS
    );
  });

  test('an arbitrary restore marker value other than "1" never restores and is always removed', function() {
    fc.assert(
      fc.property(validRecordArb, fc.string().filter(function(s) { return s !== '1'; }), function(record, marker) {
        var store = makeStorage();
        store.setItem(memory.VIEW_KEY, JSON.stringify(record));
        store.setItem(memory.RESTORE_KEY, marker);

        expect(memory.consumeRestore(LIMITS, store)).toBeNull();
        expect(store.getItem(memory.RESTORE_KEY)).toBeNull();
      }),
      RUNS
    );
  });
});
