/**
 * Property-Based Test for the TIP_MODIFIER_CONFIG shape (halo redesign)
 *
 * Feature: spot-tip-marker-redesign
 * **Validates: Requirements 6.1, 6.2, 6.3, 7.1**
 *
 * This test replaces the obsolete "unique per-tip offset" test from the original
 * spot-tips design. The halo redesign supersedes spot-tips Requirement 4: bead/halo
 * geometry is now computed from the number and order of applicable tips, so
 * TIP_MODIFIER_CONFIG no longer carries per-tip `offset`/`size` fields.
 *
 * Property (config shape): every TIP_MODIFIER_CONFIG entry maps a tip slug to its
 * glyph asset (`glyphUrl`) and colour (`colorKey` + `colorFallback`), and carries
 * NONE of the removed disc-design fields (`offset`, `size`, `iconUrl`).
 *
 * @jest-environment jsdom
 */

/**
 * Load PaddelbuchMarkerStyles from marker-styles.js, tolerant of node/jsdom envs.
 */
function loadMarkerStyles() {
  const modulePath = require.resolve('../../assets/js/marker-styles.js');
  delete require.cache[modulePath];
  const exported = require('../../assets/js/marker-styles.js');
  return (typeof window !== 'undefined' && window.PaddelbuchMarkerStyles)
    || global.PaddelbuchMarkerStyles
    || (exported && exported.PaddelbuchMarkerStyles);
}

describe('TIP_MODIFIER_CONFIG shape - spot-tip-marker-redesign', () => {
  const markerStyles = loadMarkerStyles();
  const TIP_MODIFIER_CONFIG = markerStyles ? markerStyles.TIP_MODIFIER_CONFIG : {};
  const slugs = Object.keys(TIP_MODIFIER_CONFIG);

  test('TIP_MODIFIER_CONFIG is exported and is an object', () => {
    expect(markerStyles).toBeDefined();
    expect(TIP_MODIFIER_CONFIG).toBeDefined();
    expect(typeof TIP_MODIFIER_CONFIG).toBe('object');
    expect(TIP_MODIFIER_CONFIG).not.toBeNull();
  });

  test('the two known tip slugs are present', () => {
    expect(slugs).toEqual(
      expect.arrayContaining(['swiss-canoe-eco-tip', 'swiss-canoe-tip'])
    );
  });

  test('every entry has glyphUrl + colorKey + colorFallback (new shape)', () => {
    slugs.forEach((slug) => {
      const entry = TIP_MODIFIER_CONFIG[slug];

      expect(entry).toHaveProperty('glyphUrl');
      expect(typeof entry.glyphUrl).toBe('string');
      expect(entry.glyphUrl).toMatch(/\/assets\/images\/markers\/tip-modifier-.*\.svg$/);

      expect(entry).toHaveProperty('colorKey');
      expect(typeof entry.colorKey).toBe('string');
      expect(entry.colorKey.length).toBeGreaterThan(0);

      expect(entry).toHaveProperty('colorFallback');
      expect(typeof entry.colorFallback).toBe('string');
      expect(entry.colorFallback).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    });
  });

  test('no entry carries the removed disc-design fields (offset/size/iconUrl)', () => {
    slugs.forEach((slug) => {
      const entry = TIP_MODIFIER_CONFIG[slug];
      expect(entry).not.toHaveProperty('offset');
      expect(entry).not.toHaveProperty('size');
      expect(entry).not.toHaveProperty('iconUrl');
    });
  });

  test('colour fallbacks mirror the expected palette tokens (Req 4.4)', () => {
    expect(TIP_MODIFIER_CONFIG['swiss-canoe-eco-tip'].colorFallback).toBe('#07753f');
    expect(TIP_MODIFIER_CONFIG['swiss-canoe-tip'].colorFallback).toBe('#1b1e43');
  });

  describe('resolveTipColor - palette-then-fallback (Req 4.2, 4.3)', () => {
    afterEach(() => {
      delete window.PaddelbuchColors;
    });

    test('returns the palette value when the colorKey is present', () => {
      window.PaddelbuchColors = { green1: '#123456', swisscanoeBlue: '#654321' };
      expect(markerStyles.resolveTipColor(TIP_MODIFIER_CONFIG['swiss-canoe-eco-tip'])).toBe('#123456');
      expect(markerStyles.resolveTipColor(TIP_MODIFIER_CONFIG['swiss-canoe-tip'])).toBe('#654321');
    });

    test('falls back to colorFallback when the palette is unavailable', () => {
      delete window.PaddelbuchColors;
      expect(markerStyles.resolveTipColor(TIP_MODIFIER_CONFIG['swiss-canoe-eco-tip'])).toBe('#07753f');
      expect(markerStyles.resolveTipColor(TIP_MODIFIER_CONFIG['swiss-canoe-tip'])).toBe('#1b1e43');
    });

    test('falls back when the palette lacks the specific key', () => {
      window.PaddelbuchColors = { somethingElse: '#000000' };
      expect(markerStyles.resolveTipColor(TIP_MODIFIER_CONFIG['swiss-canoe-eco-tip'])).toBe('#07753f');
    });
  });
});
