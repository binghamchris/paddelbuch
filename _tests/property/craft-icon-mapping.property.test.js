/**
 * Property-Based Test for Craft Icon Mapping Totality
 *
 * // Feature: paddlecraft-types-change, Property 7: Craft icon mapping is total and correct
 * // Validates: Requirements 3.1, 3.2, 3.3
 *
 * Property: For any slug, the Craft_Icon_Include shall render an <img> pointing at
 * /assets/images/icons/foldables-dark.svg when the slug is `klappbar-und-aufblasbar`,
 * at /assets/images/icons/hardshell-dark.svg when the slug is `hardshell`, and shall
 * render no icon element for any other slug.
 *
 * This models the `case include.slug` logic of _includes/craft-icon.html in JS,
 * mirroring how the repo models Liquid include behaviour in JS property tests
 * (see spot-tip-banner-rendering.property.test.js).
 */

const fc = require('fast-check');

/**
 * The slug -> icon-name mapping performed by the `case include.slug` block in
 * _includes/craft-icon.html. Any slug not listed maps to nil (no icon).
 */
const CRAFT_ICON_NAMES = {
  'klappbar-und-aufblasbar': 'foldables',
  'hardshell': 'hardshell'
};

/**
 * Renders the craft icon HTML for a given slug, simulating the Liquid template
 * logic in _includes/craft-icon.html:
 *
 *   {% case include.slug %}
 *     {% when 'klappbar-und-aufblasbar' %}{% assign craft_icon = 'foldables' %}
 *     {% when 'hardshell' %}{% assign craft_icon = 'hardshell' %}
 *     {% else %}{% assign craft_icon = nil %}
 *   {% endcase %}
 *   {% if craft_icon %}
 *     <img src="/assets/images/icons/{craft_icon}-dark.svg" ... class="craft-icon" />
 *   {% endif %}
 *
 * @param {string} slug - The paddle craft type slug.
 * @param {number} [size=18] - Icon size in pixels.
 * @returns {string} The rendered HTML string (empty when the slug maps to no icon).
 */
function renderCraftIcon(slug, size) {
  const craftSize = size || 18;
  const craftIcon = Object.prototype.hasOwnProperty.call(CRAFT_ICON_NAMES, slug)
    ? CRAFT_ICON_NAMES[slug]
    : null;

  if (!craftIcon) {
    return '';
  }

  const craftIconPath = '/assets/images/icons/' + craftIcon + '-dark.svg';
  return '<img src="' + craftIconPath + '"' +
    ' alt=""' +
    ' aria-hidden="true"' +
    ' height="' + craftSize + '"' +
    ' width="' + craftSize + '"' +
    ' class="craft-icon"' +
    ' loading="lazy" />';
}

// --- Arbitraries ---

// A slug that IS one of the two known craft types.
const knownSlugArb = fc.constantFrom('klappbar-und-aufblasbar', 'hardshell');

// A random slug that is NOT one of the two known craft types.
const unknownSlugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
  .filter(function (s) {
    return !Object.prototype.hasOwnProperty.call(CRAFT_ICON_NAMES, s);
  });

describe('Craft Icon Mapping - Property 7', () => {
  /**
   * Property 7: Craft icon mapping is total and correct
   *
   * Known slugs render the correct <img> src; every other slug renders no icon element.
   */

  test('known slugs render an <img> with the correct icon src', () => {
    const expectedSrc = {
      'klappbar-und-aufblasbar': '/assets/images/icons/foldables-dark.svg',
      'hardshell': '/assets/images/icons/hardshell-dark.svg'
    };

    fc.assert(
      fc.property(knownSlugArb, (slug) => {
        const html = renderCraftIcon(slug);
        // An icon element is rendered.
        if (!html.includes('<img')) {
          throw new Error('Known slug "' + slug + '" rendered no <img> element');
        }
        // With the correct, deterministically-built src.
        if (!html.includes('src="' + expectedSrc[slug] + '"')) {
          throw new Error(
            'Known slug "' + slug + '" did not render expected src "' +
            expectedSrc[slug] + '"; got: ' + html
          );
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('unknown slugs render no icon element', () => {
    fc.assert(
      fc.property(unknownSlugArb, (slug) => {
        const html = renderCraftIcon(slug);
        if (html !== '') {
          throw new Error(
            'Unknown slug "' + slug + '" unexpectedly rendered an element: ' + html
          );
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('mapping is total: any slug either renders one correct <img> or nothing', () => {
    fc.assert(
      fc.property(fc.oneof(knownSlugArb, unknownSlugArb), (slug) => {
        const html = renderCraftIcon(slug);
        if (slug === 'klappbar-und-aufblasbar') {
          return html.includes('<img') &&
            html.includes('src="/assets/images/icons/foldables-dark.svg"');
        }
        if (slug === 'hardshell') {
          return html.includes('<img') &&
            html.includes('src="/assets/images/icons/hardshell-dark.svg"');
        }
        // Any other slug: no icon element at all.
        return html === '';
      }),
      { numRuns: 100 }
    );
  });

  // --- Example-based sanity checks ---

  test('klappbar-und-aufblasbar maps to foldables-dark.svg', () => {
    const html = renderCraftIcon('klappbar-und-aufblasbar');
    expect(html).toContain('<img');
    expect(html).toContain('src="/assets/images/icons/foldables-dark.svg"');
    expect(html).toContain('class="craft-icon"');
  });

  test('hardshell maps to hardshell-dark.svg', () => {
    const html = renderCraftIcon('hardshell');
    expect(html).toContain('<img');
    expect(html).toContain('src="/assets/images/icons/hardshell-dark.svg"');
  });

  test('legacy and unknown slugs render nothing', () => {
    expect(renderCraftIcon('seekajak')).toBe('');
    expect(renderCraftIcon('kanadier')).toBe('');
    expect(renderCraftIcon('stand-up-paddle-board')).toBe('');
    expect(renderCraftIcon('')).toBe('');
    expect(renderCraftIcon('totally-unknown')).toBe('');
  });
});
