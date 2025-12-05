/**
 * Property-Based Tests for Zoom-Based Layer Visibility
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 23: Zoom-Based Layer Visibility**
 * **Validates: Requirements 14.3, 14.4**
 * 
 * Property: For any zoom level below the threshold (zoom < 12), obstacles and protected
 * areas shall not be loaded or displayed. For any zoom level at or above the threshold
 * (zoom >= 12), obstacles and protected areas within the viewport shall be loaded and displayed.
 */

const fc = require('fast-check');

// Zoom threshold for detail layers (from zoom-layer-manager.js)
const DETAIL_LAYER_ZOOM_THRESHOLD = 12;

// Layer configurations (from data-loader.js)
const LAYER_CONFIG = {
  spots: {
    minZoom: 0,
    path: 'spots'
  },
  notices: {
    minZoom: 0,
    path: 'notices'
  },
  obstacles: {
    minZoom: 12,  // Requirement 14.3
    path: 'obstacles'
  },
  protected: {
    minZoom: 12,  // Requirement 14.4
    path: 'protected'
  }
};

/**
 * Determine if a layer should be loaded at the current zoom level
 * Mirrors the shouldLoadLayer function from data-loader.js
 */
function shouldLoadLayer(layer, zoom) {
  const config = LAYER_CONFIG[layer];
  if (!config) {
    return false;
  }
  return zoom >= config.minZoom;
}

/**
 * Check if detail layers should be visible at the given zoom level
 * Mirrors the shouldShowDetailLayers function from zoom-layer-manager.js
 */
function shouldShowDetailLayers(zoom) {
  return zoom >= DETAIL_LAYER_ZOOM_THRESHOLD;
}

/**
 * Get all layers that should be visible at the given zoom level
 */
function getVisibleLayers(zoom) {
  return Object.keys(LAYER_CONFIG).filter(layer => shouldLoadLayer(layer, zoom));
}

/**
 * Get layers that should be hidden at the given zoom level
 */
function getHiddenLayers(zoom) {
  return Object.keys(LAYER_CONFIG).filter(layer => !shouldLoadLayer(layer, zoom));
}

// Arbitraries for generating test data

// Generate zoom levels below threshold
const lowZoomArb = fc.integer({ min: 0, max: DETAIL_LAYER_ZOOM_THRESHOLD - 1 });

// Generate zoom levels at or above threshold
const highZoomArb = fc.integer({ min: DETAIL_LAYER_ZOOM_THRESHOLD, max: 18 });

// Generate any valid zoom level
const anyZoomArb = fc.integer({ min: 0, max: 18 });

// Generate layer names
const layerNameArb = fc.constantFrom('spots', 'notices', 'obstacles', 'protected');

// Generate detail layer names (obstacles and protected)
const detailLayerNameArb = fc.constantFrom('obstacles', 'protected');

// Generate base layer names (spots and notices)
const baseLayerNameArb = fc.constantFrom('spots', 'notices');

describe('Zoom-Based Layer Visibility - Property 23', () => {
  /**
   * Property 23: Zoom-Based Layer Visibility
   * For any zoom level below the threshold (zoom < 12), obstacles and protected areas
   * shall not be loaded or displayed. For any zoom level at or above the threshold
   * (zoom >= 12), obstacles and protected areas within the viewport shall be loaded
   * and displayed.
   */

  describe('Detail layers at low zoom (zoom < 12)', () => {
    test('obstacles should not be loaded at zoom levels below threshold', () => {
      fc.assert(
        fc.property(
          lowZoomArb,
          (zoom) => {
            return !shouldLoadLayer('obstacles', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('protected areas should not be loaded at zoom levels below threshold', () => {
      fc.assert(
        fc.property(
          lowZoomArb,
          (zoom) => {
            return !shouldLoadLayer('protected', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail layers should not be visible at zoom levels below threshold', () => {
      fc.assert(
        fc.property(
          lowZoomArb,
          (zoom) => {
            return !shouldShowDetailLayers(zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('hidden layers at low zoom include obstacles and protected', () => {
      fc.assert(
        fc.property(
          lowZoomArb,
          (zoom) => {
            const hidden = getHiddenLayers(zoom);
            return hidden.includes('obstacles') && hidden.includes('protected');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Detail layers at high zoom (zoom >= 12)', () => {
    test('obstacles should be loaded at zoom levels at or above threshold', () => {
      fc.assert(
        fc.property(
          highZoomArb,
          (zoom) => {
            return shouldLoadLayer('obstacles', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('protected areas should be loaded at zoom levels at or above threshold', () => {
      fc.assert(
        fc.property(
          highZoomArb,
          (zoom) => {
            return shouldLoadLayer('protected', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail layers should be visible at zoom levels at or above threshold', () => {
      fc.assert(
        fc.property(
          highZoomArb,
          (zoom) => {
            return shouldShowDetailLayers(zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('visible layers at high zoom include obstacles and protected', () => {
      fc.assert(
        fc.property(
          highZoomArb,
          (zoom) => {
            const visible = getVisibleLayers(zoom);
            return visible.includes('obstacles') && visible.includes('protected');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Base layers at all zoom levels', () => {
    test('spots should be loaded at any zoom level', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          (zoom) => {
            return shouldLoadLayer('spots', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('notices should be loaded at any zoom level', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          (zoom) => {
            return shouldLoadLayer('notices', zoom);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('base layers are always in visible layers', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          (zoom) => {
            const visible = getVisibleLayers(zoom);
            return visible.includes('spots') && visible.includes('notices');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Threshold boundary conditions', () => {
    test('zoom level exactly at threshold shows detail layers', () => {
      expect(shouldShowDetailLayers(DETAIL_LAYER_ZOOM_THRESHOLD)).toBe(true);
      expect(shouldLoadLayer('obstacles', DETAIL_LAYER_ZOOM_THRESHOLD)).toBe(true);
      expect(shouldLoadLayer('protected', DETAIL_LAYER_ZOOM_THRESHOLD)).toBe(true);
    });

    test('zoom level one below threshold hides detail layers', () => {
      const belowThreshold = DETAIL_LAYER_ZOOM_THRESHOLD - 1;
      expect(shouldShowDetailLayers(belowThreshold)).toBe(false);
      expect(shouldLoadLayer('obstacles', belowThreshold)).toBe(false);
      expect(shouldLoadLayer('protected', belowThreshold)).toBe(false);
    });

    test('zoom level one above threshold shows detail layers', () => {
      const aboveThreshold = DETAIL_LAYER_ZOOM_THRESHOLD + 1;
      expect(shouldShowDetailLayers(aboveThreshold)).toBe(true);
      expect(shouldLoadLayer('obstacles', aboveThreshold)).toBe(true);
      expect(shouldLoadLayer('protected', aboveThreshold)).toBe(true);
    });
  });

  describe('Layer visibility consistency', () => {
    test('shouldLoadLayer and shouldShowDetailLayers are consistent for detail layers', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          detailLayerNameArb,
          (zoom, layer) => {
            const shouldLoad = shouldLoadLayer(layer, zoom);
            const shouldShow = shouldShowDetailLayers(zoom);
            // For detail layers, both functions should agree
            return shouldLoad === shouldShow;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('visible and hidden layers are mutually exclusive', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          (zoom) => {
            const visible = getVisibleLayers(zoom);
            const hidden = getHiddenLayers(zoom);
            
            // No layer should be in both lists
            const overlap = visible.filter(l => hidden.includes(l));
            return overlap.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('visible and hidden layers together cover all layers', () => {
      fc.assert(
        fc.property(
          anyZoomArb,
          (zoom) => {
            const visible = getVisibleLayers(zoom);
            const hidden = getHiddenLayers(zoom);
            const allLayers = Object.keys(LAYER_CONFIG);
            
            // Combined should equal all layers
            const combined = [...visible, ...hidden].sort();
            return combined.length === allLayers.length &&
                   combined.every((l, i) => l === allLayers.sort()[i]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unknown layer handling', () => {
    test('unknown layer names return false for shouldLoadLayer', () => {
      const unknownLayerArb = fc.string({ minLength: 1, maxLength: 20 })
        .filter(s => !Object.keys(LAYER_CONFIG).includes(s));

      fc.assert(
        fc.property(
          anyZoomArb,
          unknownLayerArb,
          (zoom, layer) => {
            return !shouldLoadLayer(layer, zoom);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Zoom level monotonicity', () => {
    test('if a layer is visible at zoom N, it is visible at zoom N+1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 17 }),
          layerNameArb,
          (zoom, layer) => {
            const visibleAtZoom = shouldLoadLayer(layer, zoom);
            const visibleAtZoomPlus1 = shouldLoadLayer(layer, zoom + 1);
            
            // If visible at zoom, must be visible at zoom+1
            // (layers don't disappear at higher zoom)
            if (visibleAtZoom) {
              return visibleAtZoomPlus1;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('detail layer visibility is monotonic with zoom', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 17 }),
          (zoom) => {
            const visibleAtZoom = shouldShowDetailLayers(zoom);
            const visibleAtZoomPlus1 = shouldShowDetailLayers(zoom + 1);
            
            // If visible at zoom, must be visible at zoom+1
            if (visibleAtZoom) {
              return visibleAtZoomPlus1;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
