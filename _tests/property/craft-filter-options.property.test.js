/**
 * Property-Based Test for Filter Option Generation (ordered allow-list)
 *
 * // Feature: paddlecraft-types-change, Property 1: Filter dimension lists exactly the two new craft options, ordered, with correct icons
 * // Validates: Requirements 1.1, 1.2, 1.5
 *
 * Property: For any paddle craft type dataset (in any order, with or without legacy
 * rows, with or without the two new rows), the generated `paddleCraftType` dimension
 * SHALL contain exactly two options whose slugs are `klappbar-und-aufblasbar` then
 * `hardshell` in that order, with no legacy slug present, and with icons
 * `/assets/images/icons/foldables-dark.svg` and `/assets/images/icons/hardshell-dark.svg`
 * respectively.
 *
 * This models the ordered allow-list `craft_options` construction in
 * `_plugins/precompute_generator.rb#precompute_map_config_json`, mirroring how the repo
 * models Ruby/Liquid behaviour in JS property tests (see craft-icon-mapping.property.test.js).
 */

const fc = require('fast-check');

// --- Model of the Ruby generator's ordered allow-list logic ---

// NEW_CRAFT_TYPE_SLUGS (ordered) from precompute_generator.rb.
const NEW_CRAFT_TYPE_SLUGS = ['klappbar-und-aufblasbar', 'hardshell'];

// NEW_CRAFT_TYPE_META from precompute_generator.rb.
const NEW_CRAFT_TYPE_META = {
  'klappbar-und-aufblasbar': { icon: '/assets/images/icons/foldables-dark.svg', iconOnly: true },
  'hardshell': { icon: '/assets/images/icons/hardshell-dark.svg', iconOnly: true }
};

const LEGACY_SLUGS = ['seekajak', 'kanadier', 'stand-up-paddle-board'];

/**
 * Models `craft_options` construction:
 *   craft_by_slug = craft_types.each_with_object({}) { |ct, h| h[ct['slug']] = ct }
 *   craft_options = NEW_CRAFT_TYPE_SLUGS.map { |slug| ... }
 *
 * @param {Array<Object>} craftTypes - Locale-filtered rows ({ slug, name_de, name_en }).
 * @param {string} locale - Build locale ('de' or 'en').
 * @returns {Array<Object>} The ordered craft_options array.
 */
function buildCraftOptions(craftTypes, locale) {
  const nameKey = 'name_' + locale;
  const craftBySlug = {};
  craftTypes.forEach(function (ct) {
    craftBySlug[ct.slug] = ct;
  });

  return NEW_CRAFT_TYPE_SLUGS.map(function (slug) {
    const ct = craftBySlug[slug];
    const rawLabel = ct ? ct[nameKey] : undefined;
    const label = (rawLabel === null || rawLabel === undefined || String(rawLabel).trim() === '')
      ? slug
      : rawLabel;
    const meta = NEW_CRAFT_TYPE_META[slug];
    return { slug: slug, label: label, icon: meta.icon, iconOnly: meta.iconOnly };
  });
}

// --- Arbitraries ---

// A craft-type data row for a given slug (names optional, may be blank/missing).
function rowArb(slug) {
  return fc.record({
    slug: fc.constant(slug),
    name_de: fc.option(fc.string(), { nil: undefined }),
    name_en: fc.option(fc.string(), { nil: undefined })
  });
}

// A row for a random extra slug (never one of the known/legacy slugs) - noise rows.
const extraRowArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter(function (s) {
    return NEW_CRAFT_TYPE_SLUGS.indexOf(s) === -1 && LEGACY_SLUGS.indexOf(s) === -1;
  })
  .chain(function (slug) { return rowArb(slug); });

/**
 * Generates a random craft dataset: independently include/omit each new-type row,
 * include a random subset of legacy rows, add arbitrary noise rows, and shuffle.
 */
const craftDatasetArb = fc
  .record({
    includeKlappbar: fc.boolean(),
    includeHardshell: fc.boolean(),
    legacyRows: fc.subarray(LEGACY_SLUGS).chain(function (slugs) {
      return fc.tuple.apply(fc, slugs.map(rowArb));
    }),
    klappbarRow: rowArb('klappbar-und-aufblasbar'),
    hardshellRow: rowArb('hardshell'),
    noiseRows: fc.array(extraRowArb, { maxLength: 4 })
  })
  .chain(function (spec) {
    const rows = [];
    if (spec.includeKlappbar) rows.push(spec.klappbarRow);
    if (spec.includeHardshell) rows.push(spec.hardshellRow);
    spec.legacyRows.forEach(function (r) { rows.push(r); });
    spec.noiseRows.forEach(function (r) { rows.push(r); });
    // Shuffle to prove option order is driven by the allow-list, not data order.
    return fc.shuffledSubarray(rows, { minLength: rows.length, maxLength: rows.length });
  });

const localeArb = fc.constantFrom('de', 'en');

describe('Filter Option Generation - Property 1', () => {
  /**
   * Property 1: Filter dimension lists exactly the two new craft options, ordered,
   * with correct icons.
   */
  test('generates exactly two ordered options with no legacy slug and correct icons', () => {
    fc.assert(
      fc.property(craftDatasetArb, localeArb, function (dataset, locale) {
        const options = buildCraftOptions(dataset, locale);

        // Exactly two options.
        if (options.length !== 2) {
          throw new Error('Expected exactly 2 options, got ' + options.length);
        }

        // Slugs are klappbar-und-aufblasbar then hardshell, in that order.
        if (options[0].slug !== 'klappbar-und-aufblasbar') {
          throw new Error('First option slug expected klappbar-und-aufblasbar, got ' + options[0].slug);
        }
        if (options[1].slug !== 'hardshell') {
          throw new Error('Second option slug expected hardshell, got ' + options[1].slug);
        }

        // No legacy slug present anywhere.
        const hasLegacy = options.some(function (o) { return LEGACY_SLUGS.indexOf(o.slug) !== -1; });
        if (hasLegacy) {
          throw new Error('A legacy slug leaked into the options: ' + JSON.stringify(options));
        }

        // Correct icons per slug.
        if (options[0].icon !== '/assets/images/icons/foldables-dark.svg') {
          throw new Error('klappbar option has wrong icon: ' + options[0].icon);
        }
        if (options[1].icon !== '/assets/images/icons/hardshell-dark.svg') {
          throw new Error('hardshell option has wrong icon: ' + options[1].icon);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  // --- Example-based sanity checks ---

  test('empty dataset still yields the two ordered options with slug fallback labels', () => {
    const options = buildCraftOptions([], 'de');
    expect(options.map(function (o) { return o.slug; })).toEqual(['klappbar-und-aufblasbar', 'hardshell']);
    expect(options[0].icon).toBe('/assets/images/icons/foldables-dark.svg');
    expect(options[1].icon).toBe('/assets/images/icons/hardshell-dark.svg');
  });

  test('legacy-only dataset produces no legacy options', () => {
    const dataset = [
      { slug: 'seekajak', name_de: 'Seekajak', name_en: 'Sea kayak' },
      { slug: 'kanadier', name_de: 'Kanadier', name_en: 'Canoe' },
      { slug: 'stand-up-paddle-board', name_de: 'SUP', name_en: 'SUP' }
    ];
    const options = buildCraftOptions(dataset, 'en');
    expect(options).toHaveLength(2);
    options.forEach(function (o) {
      expect(LEGACY_SLUGS).not.toContain(o.slug);
    });
  });

  test('data order does not affect option order', () => {
    const dataset = [
      { slug: 'hardshell', name_de: 'Hartschale', name_en: 'Hardshell' },
      { slug: 'klappbar-und-aufblasbar', name_de: 'Faltbar', name_en: 'Foldable' }
    ];
    const options = buildCraftOptions(dataset, 'en');
    expect(options[0].slug).toBe('klappbar-und-aufblasbar');
    expect(options[1].slug).toBe('hardshell');
  });
});
