/**
 * Integration: Marker Registry + Filter Engine + Spatial Utils
 *
 * @jest-environment jsdom
 *
 * Feature: quality-and-tooling-hardening, Task 8.6
 * Validates: Requirement 6.5
 *
 * Exercises the real interaction between three shipping modules as it happens on a live
 * map: spot markers are registered in the Marker Registry with metadata, the Filter
 * Engine evaluates them against multi-dimension AND-logic and toggles their map
 * visibility, and Spatial Utils confirms the markers' coordinates lie within Switzerland.
 * This is an end-to-end check that the modules wire together correctly (not an isolated
 * unit test of any single module).
 */

function freshModules() {
  jest.resetModules();
  delete window.PaddelbuchMarkerRegistry;
  delete window.PaddelbuchFilterEngine;
  delete window.PaddelbuchSpatialUtils;
  require('../../assets/js/marker-registry.js');
  require('../../assets/js/filter-engine.js');
  require('../../assets/js/spatial-utils.js');
  return {
    registry: window.PaddelbuchMarkerRegistry,
    engine: window.PaddelbuchFilterEngine,
    spatial: window.PaddelbuchSpatialUtils
  };
}

// Minimal Leaflet marker stub that records whether it is currently on the map.
function makeMarker() {
  return {
    onMap: false,
    addTo: function () { this.onMap = true; return this; },
    remove: function () { this.onMap = false; return this; }
  };
}

// Dimension config matching the live spotType filter: AND-logic membership test.
function spotTypeDimension(slugs) {
  return {
    key: 'spotType',
    options: slugs.map(function (s) { return { slug: s }; }),
    matchFn: function (metadata, selected) { return selected.has(metadata.spotType_slug); }
  };
}

describe('Integration: marker registry + filter engine + spatial utils', () => {
  let registry, engine, spatial, map, markers;

  beforeEach(() => {
    ({ registry, engine, spatial } = freshModules());
    map = {}; // truthy map reference is all the filter engine needs

    markers = {
      a: { marker: makeMarker(), meta: { spotType_slug: 'einstieg-ausstieg' }, lat: 47.0, lon: 8.0 },
      b: { marker: makeMarker(), meta: { spotType_slug: 'rasthalte' }, lat: 46.5, lon: 7.5 },
      c: { marker: makeMarker(), meta: { spotType_slug: 'nur-einstieg' }, lat: 46.8, lon: 9.0 }
    };
    Object.keys(markers).forEach((k) => {
      registry.register(k, markers[k].marker, markers[k].meta);
    });
  });

  test('all three markers are registered (registry deduplicates by slug)', () => {
    expect(registry.size()).toBe(3);
    // Re-registering an existing slug is a no-op.
    registry.register('a', makeMarker(), { spotType_slug: 'x' });
    expect(registry.size()).toBe(3);
  });

  test('every registered marker sits within the Switzerland bounds (spatial-utils)', () => {
    let allInBounds = true;
    registry.forEach((slug, marker, metadata) => {
      const m = markers[slug];
      if (!spatial.pointInSwitzerlandBounds(m.lat, m.lon)) {
        allInBounds = false;
      }
      expect(spatial.hasValidCoordinates(m.lat, m.lon)).toBe(true);
    });
    expect(allInBounds).toBe(true);
  });

  test('with all spot types selected, applyFilters shows every marker', () => {
    engine.init([spotTypeDimension(['einstieg-ausstieg', 'rasthalte', 'nur-einstieg'])], map);
    engine.applyFilters();
    expect(markers.a.marker.onMap).toBe(true);
    expect(markers.b.marker.onMap).toBe(true);
    expect(markers.c.marker.onMap).toBe(true);
  });

  test('deselecting a spot type hides only its markers (AND-logic via registry iteration)', () => {
    engine.init([spotTypeDimension(['einstieg-ausstieg', 'rasthalte', 'nur-einstieg'])], map);
    engine.applyFilters();

    engine.setOption('spotType', 'rasthalte', false);
    engine.applyFilters();

    expect(markers.a.marker.onMap).toBe(true);  // einstieg-ausstieg still selected
    expect(markers.b.marker.onMap).toBe(false); // rasthalte deselected -> hidden
    expect(markers.c.marker.onMap).toBe(true);  // nur-einstieg still selected
  });

  test('re-selecting a previously deselected type shows its markers again', () => {
    engine.init([spotTypeDimension(['einstieg-ausstieg', 'rasthalte', 'nur-einstieg'])], map);
    engine.setOption('spotType', 'rasthalte', false);
    engine.applyFilters();
    expect(markers.b.marker.onMap).toBe(false);

    engine.setOption('spotType', 'rasthalte', true);
    engine.applyFilters();
    expect(markers.b.marker.onMap).toBe(true);
  });

  test('evaluateMarker agrees with the registry metadata for each marker', () => {
    engine.init([spotTypeDimension(['einstieg-ausstieg'])], map);
    expect(engine.evaluateMarker(markers.a.meta)).toBe(true);
    expect(engine.evaluateMarker(markers.b.meta)).toBe(false);
    expect(engine.evaluateMarker(markers.c.meta)).toBe(false);
  });
});
