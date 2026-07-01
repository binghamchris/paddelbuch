/**
 * Property-Based Tests for the SVG Composite_Icon (halo redesign)
 *
 * Feature: spot-tip-marker-redesign
 * **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 3.1, 3.2, 5.1, 5.3, 6.4, 7.2, 7.3, 7.4**
 *
 * The redesign replaces the old stacked-<img> composite (with inline-style offsets)
 * with a single inline <svg> Composite_Icon: base marker <image> + open Halo arc(s)
 * + one Bead per applicable tip + each Bead's Tip_Glyph <image>. This test exercises
 * the real builder exported by marker-styles.js (PaddelbuchMarkerStyles.buildTipModifierSvg),
 * not a mirror of it.
 *
 * Properties covered (from design.md):
 *  - P1 CSP-clean:            markup contains no inline `style=` attribute.
 *  - P2 bead/glyph count:     exactly `applied.length` beads + glyph images; hrefs match; unknown slugs skipped.
 *  - P3 colour resolution:    stroke colours come from PaddelbuchColors, else colorFallback.
 *  - P4 halo layout:          1-tip vs 2-tip arc/bead geometry equals the design constants.
 *  - P6 accessible name:      non-empty aria-label + role="img".
 *
 * @jest-environment jsdom
 */

const fc = require('fast-check');

function loadMarkerStyles() {
  const modulePath = require.resolve('../../assets/js/marker-styles.js');
  delete require.cache[modulePath];
  const exported = require('../../assets/js/marker-styles.js');
  return (typeof window !== 'undefined' && window.PaddelbuchMarkerStyles)
    || global.PaddelbuchMarkerStyles
    || (exported && exported.PaddelbuchMarkerStyles);
}

const markerStyles = loadMarkerStyles();
const TIP_MODIFIER_CONFIG = markerStyles.TIP_MODIFIER_CONFIG;
const configSlugs = Object.keys(TIP_MODIFIER_CONFIG);
const MAX_TIPS = markerStyles.MAX_TIPS;

const build = (baseUrl, slugs, aria) => markerStyles.buildTipModifierSvg(baseUrl, slugs, aria);

const BASE_URL = '/assets/images/markers/startingspots-entryexit.svg';

// Count occurrences of a literal tag prefix (e.g. '<circle', '<path', '<image').
function countTag(html, tagPrefix) {
  const re = new RegExp(tagPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return (html.match(re) || []).length;
}

// Compute the expected applied config entries for a slug array (filter to config, cap at MAX_TIPS).
function expectedApplied(slugs) {
  const applied = [];
  for (let i = 0; i < slugs.length && applied.length < MAX_TIPS; i++) {
    if (TIP_MODIFIER_CONFIG[slugs[i]]) applied.push(slugs[i]);
  }
  return applied;
}

const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);
const tipSlugArrayArb = fc.array(
  configSlugs.length > 0 ? fc.oneof(fc.constantFrom(...configSlugs), slugArb) : slugArb,
  { minLength: 0, maxLength: 8 }
);

afterEach(() => {
  delete window.PaddelbuchColors;
});

describe('Composite_Icon SVG - spot-tip-marker-redesign', () => {
  test('exposes buildTipModifierSvg + geometry helpers', () => {
    expect(typeof markerStyles.buildTipModifierSvg).toBe('function');
    expect(typeof markerStyles.getCompositeIconSizing).toBe('function');
    expect(MAX_TIPS).toBe(2);
  });

  test('empty / all-unknown slug arrays produce no composite (caller falls back)', () => {
    expect(build(BASE_URL, [], 'x')).toBe('');
    expect(build(BASE_URL, ['nope', 'also-nope'], 'x')).toBe('');
  });

  // --- Property 1: CSP-clean (no inline style) ---
  test('P1: composite markup never contains an inline style attribute', () => {
    fc.assert(
      fc.property(tipSlugArrayArb, fc.string(), (slugs, aria) => {
        // Ensure at least one applicable tip so a composite is produced.
        const withKnown = [configSlugs[0]].concat(slugs);
        const html = build(BASE_URL, withKnown, aria);
        return html.length > 0 && !/\sstyle\s*=/.test(html);
      }),
      { numRuns: 100 }
    );
  });

  // --- Property 2: bead/glyph count matches applicable tips ---
  test('P2: bead + glyph counts equal applied.length; glyph hrefs match; unknown slugs skipped', () => {
    fc.assert(
      fc.property(tipSlugArrayArb, (slugs) => {
        const applied = expectedApplied(slugs);
        const html = build(BASE_URL, slugs, 'label');

        if (applied.length === 0) {
          return html === '';
        }

        const beadCount = countTag(html, '<circle');
        const totalImages = countTag(html, '<image');
        const glyphImages = totalImages - 1; // minus the base marker image

        if (beadCount !== applied.length) return false;
        if (glyphImages !== applied.length) return false;

        // Every applied glyphUrl must appear; the base marker url must appear once.
        if (html.indexOf('href="' + BASE_URL + '"') === -1) return false;
        for (let i = 0; i < applied.length; i++) {
          const glyphUrl = TIP_MODIFIER_CONFIG[applied[i]].glyphUrl;
          if (html.indexOf('href="' + glyphUrl + '"') === -1) return false;
        }
        return true;
      }),
      { numRuns: 200 }
    );
  });

  test('P2: more than MAX_TIPS applicable tips render only the first MAX_TIPS (bounded fallback)', () => {
    const many = ['swiss-canoe-eco-tip', 'swiss-canoe-tip', 'swiss-canoe-eco-tip'];
    const html = build(BASE_URL, many, 'label');
    expect(countTag(html, '<circle')).toBe(MAX_TIPS);
    expect(countTag(html, '<image') - 1).toBe(MAX_TIPS);
  });

  // --- Property 3: colour resolution palette-then-fallback ---
  test('P3: stroke colours use PaddelbuchColors when present', () => {
    window.PaddelbuchColors = { green1: '#aa11bb', swisscanoeBlue: '#cc22dd' };
    const html = build(BASE_URL, ['swiss-canoe-eco-tip', 'swiss-canoe-tip'], 'label');
    expect(html).toContain('stroke="#aa11bb"');
    expect(html).toContain('stroke="#cc22dd"');
    // The fallback hexes should NOT be used when the palette resolves.
    expect(html).not.toContain('stroke="#07753f"');
    expect(html).not.toContain('stroke="#1b1e43"');
  });

  test('P3: stroke colours fall back to colorFallback when the palette is unavailable', () => {
    delete window.PaddelbuchColors;
    const html = build(BASE_URL, ['swiss-canoe-eco-tip', 'swiss-canoe-tip'], 'label');
    expect(html).toContain('stroke="#07753f"');
    expect(html).toContain('stroke="#1b1e43"');
  });

  // --- Property 4: halo layout by tip count ---
  test('P4: 1-tip layout = one full-horseshoe arc + one top-centre bead + centred glyph', () => {
    delete window.PaddelbuchColors;
    const html = build(BASE_URL, ['swiss-canoe-eco-tip'], 'label');

    expect(countTag(html, '<path')).toBe(1);
    expect(countTag(html, '<circle')).toBe(1);
    expect(html).toContain('d="M7.48,54.51 A34,34 0 1 1 44.52,54.51"');
    expect(html).toContain('cx="26" cy="-16" r="16"');
    // Glyph box centred on the bead (21x21 => offset by 10.5).
    expect(html).toContain('x="15.5" y="-26.5" width="21" height="21"');
  });

  test('P4: 2-tip layout = two split arcs + upper-left/upper-right beads + centred glyphs', () => {
    delete window.PaddelbuchColors;
    const html = build(BASE_URL, ['swiss-canoe-eco-tip', 'swiss-canoe-tip'], 'label');

    expect(countTag(html, '<path')).toBe(2);
    expect(countTag(html, '<circle')).toBe(2);
    expect(html).toContain('d="M7.48,54.51 A34,34 0 0 1 26,-8"');
    expect(html).toContain('d="M26,-8 A34,34 0 0 1 44.52,54.51"');
    expect(html).toContain('cx="-4" cy="-4" r="16"');
    expect(html).toContain('cx="56" cy="-4" r="16"');
    expect(html).toContain('x="-14.5" y="-14.5" width="21" height="21"');
    expect(html).toContain('x="45.5" y="-14.5" width="21" height="21"');
  });

  test('P4: bead stroke-width, arc stroke-width and linecap match the mockup constants', () => {
    const html = build(BASE_URL, ['swiss-canoe-eco-tip'], 'label');
    expect(html).toContain('stroke-width="5"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain('fill="#fff"');
  });

  // --- Property 6: non-empty accessible name ---
  test('P6: root <svg> carries role="img" and a non-empty aria-label', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9 ,.-]{1,40}$/),
        (aria) => {
          const html = build(BASE_URL, ['swiss-canoe-eco-tip'], aria);
          if (html.indexOf('role="img"') === -1) return false;
          const m = html.match(/aria-label="([^"]*)"/);
          return !!m && m[1].length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('P6: aria-label special characters are escaped (CSP/XSS-safe interpolation)', () => {
    const html = build(BASE_URL, ['swiss-canoe-eco-tip'], 'A & B "<C>"');
    expect(html).toContain('aria-label="A &amp; B &quot;&lt;C&gt;&quot;"');
    // The raw unescaped angle brackets must not leak into the markup.
    expect(html).not.toContain('aria-label="A & B "<C>""');
  });

  test('sizing keeps the pin anchored at the tip and ~32px wide', () => {
    const sizing = markerStyles.getCompositeIconSizing();
    const g = markerStyles.COMPOSITE_GEOMETRY;
    const k = g.mapPinWidth / g.baseBox.width;
    // Pin tip (26,83) mapped through the scale, relative to the icon's top-left.
    expect(sizing.iconAnchor[0]).toBeCloseTo((g.pinTip.x - g.viewBox.minX) * k, 5);
    expect(sizing.iconAnchor[1]).toBeCloseTo((g.pinTip.y - g.viewBox.minY) * k, 5);
    // Base pin renders ~32px wide: 52 viewBox units * k = 32.
    expect(g.baseBox.width * k).toBeCloseTo(32, 5);
    expect(sizing.popupAnchor[0]).toBe(0);
    expect(sizing.popupAnchor[1]).toBeLessThan(0);
  });
});
