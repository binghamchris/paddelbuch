/**
 * Unit Tests for Filter System Integration
 *
 * Tests the Marker Registry and Filter Engine working together
 * to verify multi-dimensional AND-based spot filtering.
 *
 * Requirements: 1.1, 1.2, 1.5, 2.4, 3.4, 4.3, 9.2
 */

// Spot type and craft type constants matching the real system
const SPOT_TYPES = [
  { slug: 'einstieg-ausstieg', label: 'Ein-/Ausstiegsorte' },
  { slug: 'nur-einstieg', label: 'Nur Einstieg' },
  { slug: 'nur-ausstieg', label: 'Nur Ausstieg' },
  { slug: 'rasthalte', label: 'Rasthalte' },
  { slug: 'notauswasserungsstelle', label: 'Notauswasserungsstelle' }
];

const CRAFT_TYPES = [
  { slug: 'seekajak', label: 'Seekajak' },
  { slug: 'kanadier', label: 'Kanadier' },
  { slug: 'stand-up-paddle-board', label: 'Stand Up Paddle Board' }
];

/**
 * Build the standard two-dimension config used by the real system.
 */
function buildDimensionConfigs() {
  return [
    {
      key: 'spotType',
      label: 'Spot Type',
      options: SPOT_TYPES,
      matchFn: function(metadata, selectedSet) {
        return selectedSet.has(metadata.spotType_slug);
      }
    },
    {
      key: 'paddleCraftType',
      label: 'Paddle Craft Type',
      options: CRAFT_TYPES,
      matchFn: function(metadata, selectedSet) {
        var types = metadata.paddleCraftTypes || [];
        for (var i = 0; i < types.length; i++) {
          if (selectedSet.has(types[i])) return true;
        }
        return false;
      }
    }
  ];
}

/**
 * Create a mock Leaflet marker with addTo/remove tracking.
 */
function createMockMarker() {
  const marker = {
    _onMap: false,
    addTo: jest.fn(function() { marker._onMap = true; return marker; }),
    remove: jest.fn(function() { marker._onMap = false; return marker; })
  };
  return marker;
}

/**
 * Create a mock Leaflet map.
 */
function createMockMap() {
  return { _isMap: true };
}

/**
 * Get fresh, isolated instances of both modules.
 * The IIFEs attach to `this` which in Node module scope is `module.exports`,
 * so `require()` returns an object with the exposed property.
 * For applyFilters() to find the registry, we set it on the engine module's
 * exports object (the same object the IIFE captured as its `global` param).
 */
function freshModules() {
  let registry, engine;
  jest.isolateModules(() => {
    const regMod = require('../../assets/js/marker-registry.js');
    registry = regMod.PaddelbuchMarkerRegistry;
    const engMod = require('../../assets/js/filter-engine.js');
    engine = engMod.PaddelbuchFilterEngine;
    // The engine IIFE captured module.exports as `global`. applyFilters()
    // looks up global.PaddelbuchMarkerRegistry at runtime, so we place
    // the registry on the engine module's exports object.
    engMod.PaddelbuchMarkerRegistry = registry;
  });
  return { registry, engine };
}

describe('Filter System Integration', () => {

  describe('Default filter state', () => {
    test('all spot types are selected on init', () => {
      const { engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      engine.init(configs, map);
      const state = engine.getFilterState();

      SPOT_TYPES.forEach(st => {
        expect(state.spotType.has(st.slug)).toBe(true);
      });
      expect(state.spotType.size).toBe(SPOT_TYPES.length);
    });

    test('all craft types are selected on init', () => {
      const { engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      engine.init(configs, map);
      const state = engine.getFilterState();

      CRAFT_TYPES.forEach(ct => {
        expect(state.paddleCraftType.has(ct.slug)).toBe(true);
      });
      expect(state.paddleCraftType.size).toBe(CRAFT_TYPES.length);
    });

    test('all markers are visible when all filters selected', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const marker = createMockMarker();
      registry.register('spot-a', marker, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      engine.init(configs, map);
      engine.applyFilters();

      expect(marker.addTo).toHaveBeenCalledWith(map);
      expect(marker.remove).not.toHaveBeenCalled();
    });
  });

  describe('Spot type filtering', () => {
    test('toggling a single spot type hides only spots of that type', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const markerEntry = createMockMarker();
      const markerRast = createMockMarker();

      registry.register('spot-entry', markerEntry, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak', 'kanadier'],
        paddlingEnvironmentType_slug: 'see'
      });
      registry.register('spot-rast', markerRast, {
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['seekajak', 'kanadier'],
        paddlingEnvironmentType_slug: 'see'
      });

      engine.init(configs, map);

      // Uncheck 'rasthalte'
      engine.setOption('spotType', 'rasthalte', false);
      engine.applyFilters();

      // Entry spot should be visible
      expect(markerEntry.addTo).toHaveBeenCalledWith(map);
      // Rast spot should be hidden
      expect(markerRast.remove).toHaveBeenCalled();
    });

    test('re-checking a spot type makes spots of that type visible again', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const marker = createMockMarker();
      registry.register('spot-rast', marker, {
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['kanadier'],
        paddlingEnvironmentType_slug: 'fluss'
      });

      engine.init(configs, map);

      // Uncheck then re-check
      engine.setOption('spotType', 'rasthalte', false);
      engine.applyFilters();
      expect(marker.remove).toHaveBeenCalled();

      marker.addTo.mockClear();
      engine.setOption('spotType', 'rasthalte', true);
      engine.applyFilters();
      expect(marker.addTo).toHaveBeenCalledWith(map);
    });
  });

  describe('Craft type filtering', () => {
    test('toggling a single craft type hides spots that do not support it', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const markerKajak = createMockMarker();
      const markerSup = createMockMarker();

      registry.register('spot-kajak', markerKajak, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });
      registry.register('spot-sup', markerSup, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['stand-up-paddle-board'],
        paddlingEnvironmentType_slug: 'see'
      });

      engine.init(configs, map);

      // Uncheck seekajak and kanadier, keep only SUP
      engine.setOption('paddleCraftType', 'seekajak', false);
      engine.setOption('paddleCraftType', 'kanadier', false);
      engine.applyFilters();

      // SUP spot should be visible
      expect(markerSup.addTo).toHaveBeenCalledWith(map);
      // Kajak-only spot should be hidden
      expect(markerKajak.remove).toHaveBeenCalled();
    });

    test('spot with multiple craft types stays visible if any selected craft matches', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const marker = createMockMarker();
      registry.register('spot-multi', marker, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak', 'kanadier', 'stand-up-paddle-board'],
        paddlingEnvironmentType_slug: 'see'
      });

      engine.init(configs, map);

      // Uncheck seekajak and kanadier, keep only SUP
      engine.setOption('paddleCraftType', 'seekajak', false);
      engine.setOption('paddleCraftType', 'kanadier', false);
      engine.applyFilters();

      // Still visible because SUP is selected and spot supports SUP
      expect(marker.addTo).toHaveBeenCalledWith(map);
    });
  });

  describe('AND-logic across dimensions', () => {
    test('unchecking craft type AND spot type correctly combines filters', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      // Spot A: rasthalte + seekajak only
      const markerA = createMockMarker();
      registry.register('spot-a', markerA, {
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      // Spot B: einstieg-ausstieg + seekajak only
      const markerB = createMockMarker();
      registry.register('spot-b', markerB, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      // Spot C: einstieg-ausstieg + kanadier only
      const markerC = createMockMarker();
      registry.register('spot-c', markerC, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['kanadier'],
        paddlingEnvironmentType_slug: 'fluss'
      });

      engine.init(configs, map);

      // Uncheck 'rasthalte' in spot type AND uncheck 'seekajak' in craft type
      engine.setOption('spotType', 'rasthalte', false);
      engine.setOption('paddleCraftType', 'seekajak', false);
      engine.applyFilters();

      // Spot A: fails spot type (rasthalte unchecked) → hidden
      expect(markerA.remove).toHaveBeenCalled();
      // Spot B: passes spot type (einstieg-ausstieg checked) but fails craft (seekajak unchecked) → hidden
      expect(markerB.remove).toHaveBeenCalled();
      // Spot C: passes spot type (einstieg-ausstieg checked) AND passes craft (kanadier checked) → visible
      expect(markerC.addTo).toHaveBeenCalledWith(map);
    });
  });

  describe('Empty dimension (inactive)', () => {
    test('unchecking all options in one dimension makes it inactive', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const marker = createMockMarker();
      registry.register('spot-x', marker, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      engine.init(configs, map);

      // Uncheck ALL craft types → dimension becomes inactive
      engine.setOption('paddleCraftType', 'seekajak', false);
      engine.setOption('paddleCraftType', 'kanadier', false);
      engine.setOption('paddleCraftType', 'stand-up-paddle-board', false);
      engine.applyFilters();

      // Spot should still be visible because inactive dimension is skipped
      expect(marker.addTo).toHaveBeenCalledWith(map);
    });

    test('unchecking all options in both dimensions shows all spots', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      const marker = createMockMarker();
      registry.register('spot-y', marker, {
        spotType_slug: 'notauswasserungsstelle',
        paddleCraftTypes: ['stand-up-paddle-board'],
        paddlingEnvironmentType_slug: 'kanal'
      });

      engine.init(configs, map);

      // Uncheck ALL spot types
      SPOT_TYPES.forEach(st => engine.setOption('spotType', st.slug, false));
      // Uncheck ALL craft types
      CRAFT_TYPES.forEach(ct => engine.setOption('paddleCraftType', ct.slug, false));

      engine.applyFilters();

      // Both dimensions inactive → all spots visible
      expect(marker.addTo).toHaveBeenCalledWith(map);
    });
  });

  describe('New spots filtered against current state', () => {
    test('new spots from tile loading are immediately filtered against current state', () => {
      const { registry, engine } = freshModules();
      const map = createMockMap();
      const configs = buildDimensionConfigs();

      engine.init(configs, map);

      // Set up a filter: only 'einstieg-ausstieg' spot type
      engine.setOption('spotType', 'nur-einstieg', false);
      engine.setOption('spotType', 'nur-ausstieg', false);
      engine.setOption('spotType', 'rasthalte', false);
      engine.setOption('spotType', 'notauswasserungsstelle', false);

      // Simulate new spots arriving from tile load
      const markerMatch = createMockMarker();
      const markerNoMatch = createMockMarker();

      registry.register('new-spot-match', markerMatch, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });
      registry.register('new-spot-nomatch', markerNoMatch, {
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      // evaluateMarker is called per new spot to decide initial visibility
      const matchResult = engine.evaluateMarker({
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });
      const noMatchResult = engine.evaluateMarker({
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });

      expect(matchResult).toBe(true);
      expect(noMatchResult).toBe(false);
    });
  });

  describe('Deduplication', () => {
    test('registering same slug twice does not create duplicate', () => {
      const { registry } = freshModules();

      const marker1 = createMockMarker();
      const marker2 = createMockMarker();

      registry.register('dup-spot', marker1, {
        spotType_slug: 'einstieg-ausstieg',
        paddleCraftTypes: ['seekajak'],
        paddlingEnvironmentType_slug: 'see'
      });
      registry.register('dup-spot', marker2, {
        spotType_slug: 'nur-einstieg',
        paddleCraftTypes: ['kanadier'],
        paddlingEnvironmentType_slug: 'fluss'
      });

      expect(registry.size()).toBe(1);

      // forEach visits the slug exactly once, with the first marker
      const visited = [];
      registry.forEach((slug, marker, metadata) => {
        visited.push({ slug, marker, metadata });
      });

      expect(visited).toHaveLength(1);
      expect(visited[0].slug).toBe('dup-spot');
      expect(visited[0].marker).toBe(marker1);
      expect(visited[0].metadata.spotType_slug).toBe('einstieg-ausstieg');
    });

    test('has() returns true for duplicate slug without increasing size', () => {
      const { registry } = freshModules();

      const marker = createMockMarker();
      registry.register('dup-check', marker, {
        spotType_slug: 'rasthalte',
        paddleCraftTypes: ['kanadier'],
        paddlingEnvironmentType_slug: 'see'
      });

      expect(registry.has('dup-check')).toBe(true);
      expect(registry.size()).toBe(1);

      // Register again
      registry.register('dup-check', createMockMarker(), {
        spotType_slug: 'nur-ausstieg',
        paddleCraftTypes: ['stand-up-paddle-board'],
        paddlingEnvironmentType_slug: 'fluss'
      });

      expect(registry.has('dup-check')).toBe(true);
      expect(registry.size()).toBe(1);
    });
  });
});
