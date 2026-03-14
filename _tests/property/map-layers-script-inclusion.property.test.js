/**
 * Property-Based Tests for Map Layers Script Inclusion (Bug Condition Exploration)
 *
 * **Feature: missing-map-layers, Property 1: Fault Condition - Map Layers Populated on Page Load**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
 *
 * This test reads the raw _includes/map-init.html source and verifies that:
 * 1. Script tags exist for all 5 required JS modules
 * 2. Initialization code references PaddelbuchDataLoader.loadDataForBounds
 * 3. Initialization code references PaddelbuchZoomLayerManager.initZoomLayerManager
 * 4. A moveend event binding exists for debounced data loading
 *
 * On UNFIXED code this test should FAIL (confirming the bug condition).
 * On FIXED code this test should PASS (confirming the fix is in place).
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read the raw source of map-init.html and the extracted map-data-init.js for all tests.
// After CSP extraction, initialization logic moved from inline script in map-init.html
// to the external assets/js/map-data-init.js file.
const mapInitPath = path.join(__dirname, '..', '..', '_includes', 'map-init.html');
const mapDataInitJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'map-data-init.js');
const mapInitHtmlSource = fs.readFileSync(mapInitPath, 'utf-8');
const mapDataInitJsSource = fs.readFileSync(mapDataInitJsPath, 'utf-8');
// Combined source: the include HTML + the extracted JS (tests check for patterns in either)
const mapInitSource = mapInitHtmlSource + '\n' + mapDataInitJsSource;

// The 5 required JS modules that must be included as script tags
const REQUIRED_MODULES = [
  'marker-styles.js',
  'layer-styles.js',
  'spatial-utils.js',
  'data-loader.js',
  'zoom-layer-manager.js'
];

describe('Map Layers Script Inclusion (Bug Condition Exploration)', () => {
  describe('Property 1: All required JS modules are included as script tags', () => {
    it('should include a <script> tag for every required JS module', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...REQUIRED_MODULES),
          (moduleName) => {
            // Match both raw HTML script tags and Jekyll template script tags
            // Jekyll uses: <script src="{{ '/assets/js/module.js' | relative_url }}"></script>
            const escapedName = moduleName.replace('.', '\\.');
            const rawPattern = new RegExp(
              `<script\\s+src=["'][^"']*${escapedName}["']`, 'i'
            );
            const jekyllPattern = new RegExp(
              `<script\\s+src=["']\\{\\{[^}]*${escapedName}[^}]*\\}\\}["']`, 'i'
            );
            const found = rawPattern.test(mapInitSource) || jekyllPattern.test(mapInitSource);
            expect(found).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: Initialization code references PaddelbuchDataLoader.loadDataForBounds', () => {
    it('should contain a call to PaddelbuchDataLoader.loadDataForBounds', () => {
      fc.assert(
        fc.property(
          fc.constant('PaddelbuchDataLoader.loadDataForBounds'),
          (reference) => {
            expect(mapInitSource).toContain(reference);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: Initialization code references PaddelbuchZoomLayerManager.initZoomLayerManager', () => {
    it('should contain a call to PaddelbuchZoomLayerManager.initZoomLayerManager', () => {
      fc.assert(
        fc.property(
          fc.constant('PaddelbuchZoomLayerManager.initZoomLayerManager'),
          (reference) => {
            expect(mapInitSource).toContain(reference);
          }
        ),
        { verbose: true }
      );
    });
  });

  describe('Property 1: moveend event binding exists for debounced data loading', () => {
    it('should bind a moveend event handler that triggers debounced data loading', () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          () => {
            // Verify moveend event binding exists
            const hasMoveend = mapInitSource.includes("'moveend'") || mapInitSource.includes('"moveend"');
            expect(hasMoveend).toBe(true);

            // Verify debounced loading is referenced in the same source
            const hasDebouncedLoad = mapInitSource.includes('loadDataForBoundsDebounced');
            expect(hasDebouncedLoad).toBe(true);
          }
        ),
        { verbose: true }
      );
    });
  });
});
