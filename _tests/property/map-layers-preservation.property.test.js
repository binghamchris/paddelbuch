/**
 * Property-Based Tests for Map Layers Preservation (Existing Behavior)
 *
 * **Feature: missing-map-layers / multi-dimension-spot-filter**
 * **Property 2: Preservation - Existing Map and Layer Control Behavior**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * Updated to reflect the new filter system architecture:
 * - Spot-type LayerGroups replaced by individual marker management via Marker Registry
 * - L.control.layers replaced by custom Filter Panel
 * - Non-spot LayerGroups (noEntry, eventNotices, obstacles, protectedAreas) preserved
 *
 * This test reads the raw source of _includes/map-init.html and _includes/layer-control.html
 * and verifies that existing behaviors are preserved:
 * 1. Map initialization with Switzerland center, bounds, zoom level 8
 * 2. Non-spot layer groups are created and added to map (except noEntry)
 * 3. Spot markers are registered in PaddelbuchMarkerRegistry
 * 4. Filter engine evaluates markers for initial visibility
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read raw source files once for all tests.
// After CSP extraction, inline scripts moved to external JS files.
// We combine the HTML include + its extracted JS so pattern checks still work.
const mapInitPath = path.join(__dirname, '..', '..', '_includes', 'map-init.html');
const layerControlPath = path.join(__dirname, '..', '..', '_includes', 'layer-control.html');
const mapDataInitJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'map-data-init.js');
const layerControlJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'layer-control.js');

const mapInitSource = fs.readFileSync(mapInitPath, 'utf-8') + '\n' + fs.readFileSync(mapDataInitJsPath, 'utf-8');
const layerControlSource = fs.readFileSync(layerControlPath, 'utf-8') + '\n' + fs.readFileSync(layerControlJsPath, 'utf-8');

// Switzerland center coordinates
const SWITZERLAND_CENTER = { lat: '46.801111', lon: '8.226667' };

// Default zoom level
const DEFAULT_ZOOM = '8';

// Non-spot layer group keys that must exist in layer-control.html
const NON_SPOT_LAYER_GROUP_KEYS = [
  'noEntry',
  'eventNotices',
  'obstacles',
  'protectedAreas'
];

// Layer groups that should be added to the map by default (all non-spot except noEntry)
const DEFAULT_VISIBLE_LAYERS = [
  'eventNotices',
  'obstacles',
  'protectedAreas'
];

describe('Map Layers Preservation (Existing Map and Layer Control Behavior)', () => {
  describe('Property 2: Map initialization preserves Switzerland center coordinates', () => {
    it('should contain the Switzerland center latitude and longitude as defaults', () => {
      fc.assert(
        fc.property(
          fc.constant(SWITZERLAND_CENTER),
          (center) => {
            expect(mapInitSource).toContain(center.lat);
            expect(mapInitSource).toContain(center.lon);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: Map initialization preserves default zoom level 8', () => {
    it('should set the default zoom level to 8', () => {
      fc.assert(
        fc.property(
          fc.constant(DEFAULT_ZOOM),
          (zoom) => {
            // The zoom default is assigned via Liquid: {% assign zoom = include.zoom | default: 8 %}
            const zoomAssignPattern = /assign\s+zoom\s*=\s*include\.zoom\s*\|\s*default:\s*8/;
            expect(zoomAssignPattern.test(mapInitSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: Layer control creates all non-spot layer groups', () => {
    it('should create a L.layerGroup() for every non-spot layer group key', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NON_SPOT_LAYER_GROUP_KEYS),
          (layerKey) => {
            const pattern = new RegExp(`${layerKey}:\\s*L\\.layerGroup\\(\\)`);
            expect(pattern.test(layerControlSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: Default-visible non-spot layers are added to map', () => {
    it('should call addTo(map) for eventNotices, obstacles, and protectedAreas', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...DEFAULT_VISIBLE_LAYERS),
          (layerKey) => {
            const addToPattern = new RegExp(`layerGroups\\.${layerKey}\\.addTo\\(map\\)`);
            expect(addToPattern.test(layerControlSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: noEntry layer is NOT added to the map by default', () => {
    it('should not call addTo(map) for the noEntry layer group', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const noEntryAddTo = /layerGroups\.noEntry\.addTo\(map\)/;
            expect(noEntryAddTo.test(layerControlSource)).toBe(false);
          }
        ),
        { verbose: true }
      );
    });

    it('should have a comment indicating noEntry is intentionally not added', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            const commentPattern = /noEntry.*NOT.*added.*map|NOT.*add.*noEntry/i;
            expect(commentPattern.test(layerControlSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: Spot markers use Marker Registry instead of LayerGroups', () => {
    it('should register non-rejected spots in PaddelbuchMarkerRegistry', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            expect(layerControlSource).toContain('PaddelbuchMarkerRegistry.register');
          }
        ),
        { verbose: true }
      );
    });

    it('should evaluate markers via PaddelbuchFilterEngine for initial visibility', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            expect(layerControlSource).toContain('PaddelbuchFilterEngine.evaluateMarker');
          }
        ),
        { verbose: true }
      );
    });

    it('should add rejected spots to noEntry LayerGroup, not to Marker Registry', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Rejected spots go to noEntry LayerGroup
            expect(layerControlSource).toContain('layerGroups.noEntry');
            // The addSpotMarker function should handle both paths
            expect(layerControlSource).toContain('addSpotMarker');
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: Filter system modules are included in map-init', () => {
    it('should include marker-registry.js and filter-engine.js scripts', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            expect(mapInitSource).toContain('marker-registry.js');
            expect(mapInitSource).toContain('filter-engine.js');
          }
        ),
        { verbose: true }
      );
    });

    it('should include filter-panel.html', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            expect(mapInitSource).toContain('filter-panel.html');
          }
        ),
        { verbose: true }
      );
    });

    it('should initialize PaddelbuchFilterEngine and PaddelbuchFilterPanel', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            expect(mapInitSource).toContain('PaddelbuchFilterEngine.init');
            expect(mapInitSource).toContain('PaddelbuchFilterPanel.init');
          }
        ),
        { verbose: true }
      );
    });
  });
});
