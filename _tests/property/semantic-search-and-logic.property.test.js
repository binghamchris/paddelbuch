/**
 * Search AND Filter Combination
 *
 * **Feature: semantic-search, Property 1: Search AND-combines with every filter dimension**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * A marker is visible if and only if it satisfies the search selection AND every
 * active checkbox dimension. Clearing the search must restore exactly the set
 * that the checkbox dimensions alone would show -- an empty search selection
 * means "dimension inactive", never "match nothing".
 *
 * Runs in the default node environment, matching the existing filter-engine
 * property tests: filter-engine.js has no Dual_Export, so with `window`
 * undefined its IIFE receives module.exports as its global and attaches
 * PaddelbuchFilterEngine there.
 */

var fc = require('fast-check');
var path = require('path');

var SemanticSearch = require(path.resolve(__dirname, '../../assets/js/semantic-search.js'));

var SPOT_TYPES = ['einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte'];
var CRAFT_TYPES = ['hardshell', 'klappbar-und-aufblasbar'];

/**
 * Load a filter engine with fresh closure state, per the existing pattern in
 * _tests/property/filter-engine-and-logic.property.test.js.
 */
function freshFilterEngine() {
  var engine;
  jest.isolateModules(function() {
    var mod = require('../../assets/js/filter-engine.js');
    engine = mod.PaddelbuchFilterEngine;
  });
  return engine;
}

/**
 * The checkbox dimension configs, mirroring assets/js/map-data-init.js.
 */
function checkboxDimensions() {
  return [
    {
      key: 'spotType',
      options: SPOT_TYPES.map(function(s) { return { slug: s }; }),
      matchFn: function(meta, selected) {
        return selected.has(meta.spotType_slug);
      }
    },
    {
      key: 'paddleCraftType',
      options: CRAFT_TYPES.map(function(s) { return { slug: s }; }),
      matchFn: function(meta, selected) {
        var types = meta.paddleCraftTypes || [];
        for (var i = 0; i < types.length; i++) {
          if (selected.has(types[i])) return true;
        }
        return false;
      }
    }
  ];
}

/**
 * Build an engine carrying the checkbox dimensions plus the search dimension,
 * with the checkbox selections set to the given subsets.
 */
function engineWith(spotTypeSel, craftSel) {
  var engine = freshFilterEngine();
  var dims = checkboxDimensions();
  dims.push(SemanticSearch.getDimensionConfig());
  engine.init(dims, { fake: 'map' });

  var state = engine.getFilterState();
  state.spotType = new Set(spotTypeSel);
  state.paddleCraftType = new Set(craftSel);
  return engine;
}

/**
 * Reference oracle: evaluate a spot against only the checkbox dimensions.
 */
function checkboxOnlyVisible(spot, spotTypeSel, craftSel) {
  var dims = checkboxDimensions();
  var state = { spotType: new Set(spotTypeSel), paddleCraftType: new Set(craftSel) };
  for (var i = 0; i < dims.length; i++) {
    var sel = state[dims[i].key];
    if (!sel || sel.size === 0) continue;
    if (!dims[i].matchFn(spot, sel)) return false;
  }
  return true;
}

var spotArb = fc.record({
  slug: fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/),
  spotType_slug: fc.constantFrom.apply(null, SPOT_TYPES),
  paddleCraftTypes: fc.subarray(CRAFT_TYPES, { minLength: 0 })
});

var spotsArb = fc.uniqueArray(spotArb, {
  minLength: 1,
  maxLength: 15,
  selector: function(s) { return s.slug; }
});

var spotTypeSelArb = fc.subarray(SPOT_TYPES, { minLength: 1 });
var craftSelArb = fc.subarray(CRAFT_TYPES, { minLength: 1 });

describe('Property 1: search AND-combines with the checkbox dimensions', () => {
  test('a marker is visible iff it matches search AND every active dimension', () => {
    fc.assert(
      fc.property(
        spotsArb,
        spotTypeSelArb,
        craftSelArb,
        fc.nat(),
        function(spots, spotTypeSel, craftSel, matchSeed) {
          var engine = engineWith(spotTypeSel, craftSel);

          // A deterministic, arbitrary subset of slugs stands in for the API's
          // semantic matches.
          var matched = spots
            .filter(function(_s, i) { return ((i + matchSeed) % 2) === 0; })
            .map(function(s) { return s.slug; });
          var matchedSet = new Set(matched);

          engine.setDimensionSelection('search', matched);

          // An empty match list leaves the search dimension INACTIVE, which the
          // engine skips, so the expectation collapses to the checkboxes alone.
          // That deliberate semantics is what makes clearing a search restore
          // every marker; Property 2 pins it directly.
          var searchActive = matched.length > 0;

          spots.forEach(function(spot) {
            var expected =
              (!searchActive || matchedSet.has(spot.slug)) &&
              checkboxOnlyVisible(spot, spotTypeSel, craftSel);
            expect(engine.evaluateMarker(spot)).toBe(expected);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('search never widens the result set beyond the checkbox filters', () => {
    fc.assert(
      fc.property(spotsArb, spotTypeSelArb, craftSelArb, function(spots, spotTypeSel, craftSel) {
        var engine = engineWith(spotTypeSel, craftSel);

        // Search matches everything, so it constrains nothing on its own.
        engine.setDimensionSelection('search', spots.map(function(s) { return s.slug; }));

        spots.forEach(function(spot) {
          if (engine.evaluateMarker(spot)) {
            expect(checkboxOnlyVisible(spot, spotTypeSel, craftSel)).toBe(true);
          }
        });
      }),
      { numRuns: 100 }
    );
  });

  test('a spot excluded by search is hidden however permissive the checkboxes are', () => {
    fc.assert(
      fc.property(spotsArb, function(spots) {
        // Every checkbox option selected, i.e. the most permissive filter state.
        var engine = engineWith(SPOT_TYPES, CRAFT_TYPES);
        engine.setDimensionSelection('search', [spots[0].slug]);

        spots.slice(1).forEach(function(spot) {
          if (spot.slug !== spots[0].slug) {
            expect(engine.evaluateMarker(spot)).toBe(false);
          }
        });
      }),
      { numRuns: 50 }
    );
  });
});

describe('Property 2: clearing the search restores the checkbox-only result set', () => {
  test('an empty search selection deactivates the dimension rather than hiding all', () => {
    fc.assert(
      fc.property(spotsArb, spotTypeSelArb, craftSelArb, function(spots, spotTypeSel, craftSel) {
        var engine = engineWith(spotTypeSel, craftSel);

        // Narrow hard, then clear.
        engine.setDimensionSelection('search', [spots[0].slug]);
        engine.setDimensionSelection('search', null);

        spots.forEach(function(spot) {
          expect(engine.evaluateMarker(spot)).toBe(
            checkboxOnlyVisible(spot, spotTypeSel, craftSel)
          );
        });
      }),
      { numRuns: 100 }
    );
  });

  test('an empty array behaves identically to null', () => {
    fc.assert(
      fc.property(spotsArb, function(spots) {
        var withEmptyArray = engineWith(SPOT_TYPES, CRAFT_TYPES);
        withEmptyArray.setDimensionSelection('search', []);
        var a = spots.map(function(s) { return withEmptyArray.evaluateMarker(s); });

        var withNull = engineWith(SPOT_TYPES, CRAFT_TYPES);
        withNull.setDimensionSelection('search', null);
        var b = spots.map(function(s) { return withNull.evaluateMarker(s); });

        expect(a).toEqual(b);
      }),
      { numRuns: 50 }
    );
  });
});

describe('Property 3: setDimensionSelection is total and replaces state', () => {
  test('accepts arrays and Sets equivalently', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 8 }),
        function(slugs) {
          var fromArray = engineWith(SPOT_TYPES, CRAFT_TYPES);
          fromArray.setDimensionSelection('search', slugs);

          var fromSet = engineWith(SPOT_TYPES, CRAFT_TYPES);
          fromSet.setDimensionSelection('search', new Set(slugs));

          expect(Array.from(fromArray.getFilterState().search).sort()).toEqual(
            Array.from(fromSet.getFilterState().search).sort()
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  test('replaces rather than merges successive selections', () => {
    var engine = engineWith(SPOT_TYPES, CRAFT_TYPES);
    engine.setDimensionSelection('search', ['a', 'b']);
    engine.setDimensionSelection('search', ['c']);
    expect(Array.from(engine.getFilterState().search)).toEqual(['c']);
  });

  test('creates state for a dimension that was never initialised', () => {
    var engine = freshFilterEngine();
    engine.init([], { fake: 'map' });
    engine.setDimensionSelection('brand-new', ['x']);
    expect(engine.getFilterState()['brand-new'].has('x')).toBe(true);
  });

  test('ignores a missing dimension key without throwing', () => {
    var engine = engineWith(SPOT_TYPES, CRAFT_TYPES);
    expect(function() {
      engine.setDimensionSelection(null, ['x']);
    }).not.toThrow();
  });

  test('ignores a non-iterable selection without throwing', () => {
    var engine = engineWith(SPOT_TYPES, CRAFT_TYPES);
    expect(function() {
      engine.setDimensionSelection('search', 42);
    }).not.toThrow();
    expect(engine.getFilterState().search.size).toBe(0);
  });
});
