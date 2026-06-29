/**
 * Property-Based Test for Composite Marker Icon Includes Modifier Images
 *
 * Feature: spot-tips, Property 7: Composite Marker Icon Includes Modifier Images
 * **Validates: Requirements 4.1, 4.6**
 *
 * Property: For any spot with one or more tip type slugs that have entries in
 * TIP_MODIFIER_CONFIG, the composite DivIcon HTML shall contain one img element
 * per matching slug with the correct src path and position offset from the config.
 * Slugs without config entries shall be skipped.
 */

const fc = require('fast-check');

/**
 * Load TIP_MODIFIER_CONFIG from marker-styles.js
 */
function loadTipModifierConfig() {
  const modulePath = require.resolve('../../assets/js/marker-styles.js');
  delete require.cache[modulePath];
  const savedGlobal = global.PaddelbuchMarkerStyles;
  require('../../assets/js/marker-styles.js');
  const config = global.PaddelbuchMarkerStyles
    ? global.PaddelbuchMarkerStyles.TIP_MODIFIER_CONFIG
    : {};
  if (savedGlobal === undefined) {
    delete global.PaddelbuchMarkerStyles;
  } else {
    global.PaddelbuchMarkerStyles = savedGlobal;
  }
  return config;
}

/**
 * Pure implementation of createCompositeIcon HTML generation logic,
 * mirroring the function in layer-control.js for testability without DOM/Leaflet.
 *
 * @param {string} baseIconUrl - URL to the base marker SVG
 * @param {Array<string>} tipSlugs - Array of tip type slugs
 * @param {Object} config - TIP_MODIFIER_CONFIG object
 * @returns {string} The HTML string for the composite icon
 */
function createCompositeIconHtml(baseIconUrl, tipSlugs, config) {
  var html = '<img src="' + baseIconUrl + '" width="32" height="53" />';

  for (var i = 0; i < tipSlugs.length; i++) {
    var modConfig = config[tipSlugs[i]];
    if (!modConfig) continue; // Req 4.6: skip missing modifier SVGs
    html += '<img src="' + modConfig.iconUrl + '"' +
            ' style="position:absolute;left:' + modConfig.offset[0] + 'px;top:' + modConfig.offset[1] + 'px;"' +
            ' width="' + (modConfig.size || 16) + '" height="' + (modConfig.size || 16) + '" />';
  }

  return html;
}

const TIP_MODIFIER_CONFIG = loadTipModifierConfig();
const configSlugs = Object.keys(TIP_MODIFIER_CONFIG);

// Arbitrary for a slug string
const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

// Arbitrary for a base icon URL
const baseIconUrlArb = fc.constant('/assets/images/markers/startingspots-entryexit.svg');

// Arbitrary for a tip slug array: mix of known config slugs and random unknown slugs
const tipSlugArrayArb = fc.array(
  configSlugs.length > 0
    ? fc.oneof(fc.constantFrom(...configSlugs), slugArb)
    : slugArb,
  { minLength: 0, maxLength: 8 }
);

describe('Composite Marker Icon Includes Modifier Images - Property 7', () => {
  /**
   * Property 7: Composite Marker Icon Includes Modifier Images
   *
   * For any spot with tip type slugs, the composite DivIcon HTML shall contain:
   * - The base marker img as the first element
   * - One img per matching slug with correct src and offset
   * - No img for slugs without config entries
   */

  test('composite HTML always contains the base marker image', () => {
    fc.assert(
      fc.property(
        baseIconUrlArb,
        tipSlugArrayArb,
        (baseUrl, tipSlugs) => {
          var html = createCompositeIconHtml(baseUrl, tipSlugs, TIP_MODIFIER_CONFIG);
          return html.indexOf('<img src="' + baseUrl + '" width="32" height="53" />') === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('composite HTML contains one img per matching slug with correct src and offset', () => {
    fc.assert(
      fc.property(
        baseIconUrlArb,
        tipSlugArrayArb,
        (baseUrl, tipSlugs) => {
          var html = createCompositeIconHtml(baseUrl, tipSlugs, TIP_MODIFIER_CONFIG);

          for (var i = 0; i < tipSlugs.length; i++) {
            var slug = tipSlugs[i];
            var modConfig = TIP_MODIFIER_CONFIG[slug];
            if (modConfig) {
              // Should contain an img with the correct src
              var expectedSrc = 'src="' + modConfig.iconUrl + '"';
              if (html.indexOf(expectedSrc) === -1) return false;

              // Should contain the correct offset in the style
              var expectedLeft = 'left:' + modConfig.offset[0] + 'px';
              var expectedTop = 'top:' + modConfig.offset[1] + 'px';
              if (html.indexOf(expectedLeft) === -1) return false;
              if (html.indexOf(expectedTop) === -1) return false;

              // Should contain the correct size
              var expectedSize = modConfig.size || 16;
              var expectedWidth = 'width="' + expectedSize + '"';
              var expectedHeight = 'height="' + expectedSize + '"';
              if (html.indexOf(expectedWidth) === -1) return false;
              if (html.indexOf(expectedHeight) === -1) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('composite HTML skips slugs without config entries (Req 4.6)', () => {
    fc.assert(
      fc.property(
        baseIconUrlArb,
        fc.array(slugArb.filter(s => !Object.prototype.hasOwnProperty.call(TIP_MODIFIER_CONFIG, s)), { minLength: 1, maxLength: 5 }),
        (baseUrl, unknownSlugs) => {
          var html = createCompositeIconHtml(baseUrl, unknownSlugs, TIP_MODIFIER_CONFIG);
          // Should only contain the base image, no modifier images
          var imgCount = (html.match(/<img /g) || []).length;
          return imgCount === 1; // only the base marker
        }
      ),
      { numRuns: 100 }
    );
  });

  test('number of modifier imgs equals number of matching slugs', () => {
    fc.assert(
      fc.property(
        baseIconUrlArb,
        tipSlugArrayArb,
        (baseUrl, tipSlugs) => {
          var html = createCompositeIconHtml(baseUrl, tipSlugs, TIP_MODIFIER_CONFIG);
          var imgCount = (html.match(/<img /g) || []).length;

          // Count how many slugs have config entries (including duplicates)
          var matchingCount = 0;
          for (var i = 0; i < tipSlugs.length; i++) {
            if (TIP_MODIFIER_CONFIG[tipSlugs[i]]) matchingCount++;
          }

          // Total imgs = 1 (base) + matchingCount (modifiers)
          return imgCount === 1 + matchingCount;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty tip slug array produces only the base marker image', () => {
    var html = createCompositeIconHtml('/assets/images/markers/test.svg', [], TIP_MODIFIER_CONFIG);
    var imgCount = (html.match(/<img /g) || []).length;
    expect(imgCount).toBe(1);
    expect(html).toContain('src="/assets/images/markers/test.svg"');
  });
});
