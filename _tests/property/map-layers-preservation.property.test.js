/**
 * Property-Based Tests for Map Layers Preservation (Existing Behavior)
 *
 * **Feature: missing-map-layers, Property 2: Preservation - Existing Map and Layer Control Behavior**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * This test reads the raw source of _includes/map-init.html and _includes/layer-control.html
 * and verifies that existing behaviors are preserved:
 * 1. Map initialization with Switzerland center (46.801111, 8.226667), bounds, zoom level 8
 * 2. Layer control panel with all 9 layer groups
 * 3. noEntry layer group is NOT added to the map by default
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read raw source files once for all tests
const mapInitPath = path.join(__dirname, '..', '..', '_includes', 'map-init.html');
const layerControlPath = path.join(__dirname, '..', '..', '_includes', 'layer-control.html');
const mapInitSource = fs.readFileSync(mapInitPath, 'utf-8');
const layerControlSource = fs.readFileSync(layerControlPath, 'utf-8');

// Switzerland center coordinates
const SWITZERLAND_CENTER = { lat: '46.801111', lon: '8.226667' };

// Switzerland bounds corners
const SWITZERLAND_BOUNDS = {
  sw: { lat: '45.8', lon: '5.9' },
  ne: { lat: '47.8', lon: '10.5' }
};

// Default zoom level
const DEFAULT_ZOOM = '8';

// All 9 layer group keys that must exist in layer-control.html
const ALL_LAYER_GROUP_KEYS = [
  'entryExit',
  'entryOnly',
  'exitOnly',
  'rest',
  'emergency',
  'noEntry',
  'eventNotices',
  'obstacles',
  'protectedAreas'
];

// Layer groups that should be added to the map by default (all except noEntry)
const DEFAULT_VISIBLE_LAYERS = [
  'entryExit',
  'entryOnly',
  'exitOnly',
  'rest',
  'emergency',
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

  describe('Property 2: Map initialization preserves Switzerland bounds', () => {
    it('should define Switzerland bounds with correct SW and NE corners', () => {
      fc.assert(
        fc.property(
          fc.constant(SWITZERLAND_BOUNDS),
          (bounds) => {
            // SW corner
            expect(mapInitSource).toContain(bounds.sw.lat);
            expect(mapInitSource).toContain(bounds.sw.lon);
            // NE corner
            expect(mapInitSource).toContain(bounds.ne.lat);
            expect(mapInitSource).toContain(bounds.ne.lon);
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

  describe('Property 2: Layer control creates all 9 layer groups', () => {
    it('should create a L.layerGroup() for every required layer group key', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_LAYER_GROUP_KEYS),
          (layerKey) => {
            // Each layer group is defined as: keyName: L.layerGroup()
            const pattern = new RegExp(`${layerKey}:\\s*L\\.layerGroup\\(\\)`);
            expect(pattern.test(layerControlSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 2: All 9 layer groups are added to the overlay layers object', () => {
    it('should add every layer group to the overlayLayers control', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_LAYER_GROUP_KEYS),
          (layerKey) => {
            // Each layer is added as: overlayLayers[layerLabels.keyName] = layerGroups.keyName
            const pattern = new RegExp(
              `overlayLayers\\[layerLabels\\.${layerKey}\\]\\s*=\\s*layerGroups\\.${layerKey}`
            );
            expect(pattern.test(layerControlSource)).toBe(true);
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
            // All default-visible layers are added with: layerGroups.<name>.addTo(map)
            // noEntry must NOT have this call
            DEFAULT_VISIBLE_LAYERS.forEach((layerKey) => {
              const addToPattern = new RegExp(`layerGroups\\.${layerKey}\\.addTo\\(map\\)`);
              expect(addToPattern.test(layerControlSource)).toBe(true);
            });

            // noEntry must NOT be added to the map
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
            // Verify there's a comment about noEntry not being added
            const commentPattern = /noEntry.*NOT.*added.*map|NOT.*add.*noEntry/i;
            expect(commentPattern.test(layerControlSource)).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });
});
