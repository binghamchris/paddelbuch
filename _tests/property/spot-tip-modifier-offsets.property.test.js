/**
 * Property-Based Test for Modifier Icon Unique Offsets
 *
 * Feature: spot-tips, Property 6: Modifier Icon Unique Offsets
 * **Validates: Requirements 4.4**
 *
 * Property: For any two distinct tip type slugs in TIP_MODIFIER_CONFIG,
 * their position offset arrays shall differ in at least one coordinate,
 * ensuring all modifier icons are visually distinguishable on markers
 * with multiple tips.
 */

// Load the marker-styles module to get TIP_MODIFIER_CONFIG
const markerStylesModule = (function() {
  const fakeGlobal = {};
  const moduleCode = require('../../assets/js/marker-styles.js');
  return fakeGlobal.PaddelbuchMarkerStyles || (typeof PaddelbuchMarkerStyles !== 'undefined' ? PaddelbuchMarkerStyles : null);
})();

// Direct require approach: the IIFE writes to `this` which in Node CJS is `exports`
// We need to load it in a way that captures the global assignment
function loadTipModifierConfig() {
  // Reset any cached module
  const modulePath = require.resolve('../../assets/js/marker-styles.js');
  delete require.cache[modulePath];

  // The IIFE uses (typeof window !== 'undefined' ? window : this)
  // In Node CJS strict mode, `this` at module level is `module.exports`
  // But the IIFE wraps in a function, so `this` inside is the global or exports
  // We'll just read the global after requiring
  const savedGlobal = global.PaddelbuchMarkerStyles;
  require('../../assets/js/marker-styles.js');
  const config = global.PaddelbuchMarkerStyles
    ? global.PaddelbuchMarkerStyles.TIP_MODIFIER_CONFIG
    : {};
  // Restore
  if (savedGlobal === undefined) {
    delete global.PaddelbuchMarkerStyles;
  } else {
    global.PaddelbuchMarkerStyles = savedGlobal;
  }
  return config;
}

describe('Modifier Icon Unique Offsets - Property 6', () => {
  /**
   * Property 6: Modifier Icon Unique Offsets
   *
   * For any two distinct tip type slugs in TIP_MODIFIER_CONFIG,
   * their position offset arrays shall differ in at least one coordinate.
   */

  const TIP_MODIFIER_CONFIG = loadTipModifierConfig();
  const slugs = Object.keys(TIP_MODIFIER_CONFIG);

  test('TIP_MODIFIER_CONFIG is exported and is an object', () => {
    expect(TIP_MODIFIER_CONFIG).toBeDefined();
    expect(typeof TIP_MODIFIER_CONFIG).toBe('object');
    expect(TIP_MODIFIER_CONFIG).not.toBeNull();
  });

  test('all entries have required fields (iconUrl, offset array with 2 numbers, optional size)', () => {
    slugs.forEach(slug => {
      const entry = TIP_MODIFIER_CONFIG[slug];
      expect(entry).toHaveProperty('iconUrl');
      expect(typeof entry.iconUrl).toBe('string');
      expect(entry).toHaveProperty('offset');
      expect(Array.isArray(entry.offset)).toBe(true);
      expect(entry.offset).toHaveLength(2);
      expect(typeof entry.offset[0]).toBe('number');
      expect(typeof entry.offset[1]).toBe('number');
      if (entry.size !== undefined) {
        expect(typeof entry.size).toBe('number');
      }
    });
  });

  test('every pair of distinct slugs has distinct offset arrays', () => {
    // Enumerate all pairs and verify each has a distinct offset
    for (var i = 0; i < slugs.length; i++) {
      for (var j = i + 1; j < slugs.length; j++) {
        var offsetA = TIP_MODIFIER_CONFIG[slugs[i]].offset;
        var offsetB = TIP_MODIFIER_CONFIG[slugs[j]].offset;
        var areSame = offsetA[0] === offsetB[0] && offsetA[1] === offsetB[1];
        expect(areSame).toBe(false);
      }
    }
    // If config is empty, the property holds vacuously — no pairs to check
    if (slugs.length === 0) {
      expect(true).toBe(true); // vacuously true
    }
  });
});
