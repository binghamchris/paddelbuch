/**
 * Property-Based Test: Filter option labels are localised with slug fallback
 *
 * // Feature: paddlecraft-types-change, Property 2: Filter option labels are localised with slug fallback
 * // Validates: Requirements 1.3, 1.4, 1.7
 *
 * Property: For any paddle craft type dataset and for any build locale in {de, en},
 * each generated craft option's label shall equal that new type's name for the locale
 * (`name_en` for English, `name_de` for German), except that when the locale name is
 * empty, whitespace-only, or absent the label shall equal the option's slug.
 *
 * This models the label-selection logic of `precompute_map_config_json` in
 * `_plugins/precompute_generator.rb` in JS, mirroring how the repo models Ruby/Liquid
 * behaviour in JS property tests (see craft-icon-mapping.property.test.js and
 * paddle-craft-migration-rules.property.test.js).
 *
 * Modelled Ruby logic:
 *
 *   NEW_CRAFT_TYPE_SLUGS = %w[klappbar-und-aufblasbar hardshell].freeze
 *   name_key = "name_#{locale}"                # e.g. "name_de" / "name_en"
 *   craft_by_slug = craft_types.each_with_object({}) { |ct, h| h[ct['slug']] = ct }
 *   craft_options = NEW_CRAFT_TYPE_SLUGS.map do |slug|
 *     ct        = craft_by_slug[slug]
 *     raw_label = ct && ct[name_key]
 *     label     = (raw_label.nil? || raw_label.to_s.strip.empty?) ? slug : raw_label
 *     ...
 *   end
 */

const fc = require('fast-check');

// The two new craft-type slugs, in generator order.
const NEW_CRAFT_TYPE_SLUGS = ['klappbar-und-aufblasbar', 'hardshell'];

/**
 * Mirrors Ruby `value.to_s.strip.empty?` for the values our generators produce.
 * A label is treated as blank when it is nil/undefined, an empty string, or a
 * string containing only whitespace.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isBlank(value) {
  if (value === null || value === undefined) {
    return true;
  }
  return String(value).trim() === '';
}

/**
 * Model of the generator's label-selection logic for a single build locale.
 *
 * @param {Array<Object>} craftTypes - rows like { slug, name_de, name_en, ... } in any order.
 * @param {string} locale - build locale, 'de' or 'en'.
 * @returns {Array<{slug: string, label: string}>} ordered options for the two new slugs.
 */
function buildCraftOptionLabels(craftTypes, locale) {
  const nameKey = 'name_' + locale;
  const craftBySlug = {};
  craftTypes.forEach(function (ct) {
    // Last row wins on duplicate slug, mirroring each_with_object hash assignment.
    craftBySlug[ct.slug] = ct;
  });

  return NEW_CRAFT_TYPE_SLUGS.map(function (slug) {
    const ct = craftBySlug[slug];
    const rawLabel = ct ? ct[nameKey] : undefined;
    const label = isBlank(rawLabel) ? slug : rawLabel;
    return { slug: slug, label: label };
  });
}

// --- Arbitraries ---

// A "normal", non-blank name string. Constrained to non-whitespace-only content so
// it is a genuine present-and-non-blank label.
const normalNameArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter(function (s) {
    return s.trim() !== '';
  });

// Whitespace-only names (spaces, tabs, newlines) -> should trigger slug fallback.
const whitespaceNameArb = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 5 })
  .map(function (chars) {
    return chars.join('');
  });

// A name field value: normal, empty, whitespace-only, or explicitly absent (null).
const nameFieldArb = fc.oneof(
  normalNameArb,
  fc.constant(''),
  whitespaceNameArb,
  fc.constant(null)
);

/**
 * A craft-type row for one of the new slugs. The name_de/name_en fields may each
 * independently be a normal string, empty, whitespace-only, or null. With small
 * probability the field key is omitted entirely (absent), exercising the
 * "absent name" branch.
 */
function newTypeRowArb(slug) {
  return fc.record({
    slug: fc.constant(slug),
    name_de: nameFieldArb,
    name_en: nameFieldArb,
    dropDe: fc.boolean(),
    dropEn: fc.boolean()
  }).map(function (r) {
    const row = { slug: r.slug };
    if (!r.dropDe) row.name_de = r.name_de;
    if (!r.dropEn) row.name_en = r.name_en;
    return row;
  });
}

// A row for an unrelated (legacy or arbitrary) slug that must never influence labels.
const otherRowArb = fc.record({
  slug: fc
    .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
    .filter(function (s) {
      return NEW_CRAFT_TYPE_SLUGS.indexOf(s) === -1;
    }),
  name_de: nameFieldArb,
  name_en: nameFieldArb
});

/**
 * A full dataset: optionally includes each new-type row (so "missing entirely"
 * is covered), plus a random number of unrelated rows, all shuffled into random
 * order.
 */
const datasetArb = fc
  .record({
    includeKlappbar: fc.boolean(),
    includeHardshell: fc.boolean(),
    klappbarRow: newTypeRowArb('klappbar-und-aufblasbar'),
    hardshellRow: newTypeRowArb('hardshell'),
    others: fc.array(otherRowArb, { minLength: 0, maxLength: 5 })
  })
  .chain(function (r) {
    const rows = r.others.slice();
    if (r.includeKlappbar) rows.push(r.klappbarRow);
    if (r.includeHardshell) rows.push(r.hardshellRow);
    // Shuffle to prove order-independence of the lookup.
    return fc.shuffledSubarray(rows, { minLength: rows.length, maxLength: rows.length });
  });

const localeArb = fc.constantFrom('de', 'en');

describe('Craft filter labels - Property 2: localised with slug fallback', function () {
  it('label equals the locale-specific name when present & non-blank, else the slug', function () {
    fc.assert(
      fc.property(datasetArb, localeArb, function (craftTypes, locale) {
        const nameKey = 'name_' + locale;
        const options = buildCraftOptionLabels(craftTypes, locale);

        // Always exactly the two new options, in order.
        if (options.length !== 2) return false;
        if (options[0].slug !== 'klappbar-und-aufblasbar') return false;
        if (options[1].slug !== 'hardshell') return false;

        // Build the same slug lookup to determine ground-truth expectation.
        const bySlug = {};
        craftTypes.forEach(function (ct) { bySlug[ct.slug] = ct; });

        return options.every(function (opt) {
          const ct = bySlug[opt.slug];
          const rawName = ct ? ct[nameKey] : undefined;

          if (isBlank(rawName)) {
            // Empty / whitespace-only / absent / missing row -> slug fallback (1.7).
            return opt.label === opt.slug;
          }
          // Present & non-blank -> the locale-specific name (1.3 / 1.4).
          return opt.label === rawName;
        });
      }),
      { numRuns: 100 }
    );
  });

  it('uses name_en under English and name_de under German for the same dataset', function () {
    fc.assert(
      fc.property(
        newTypeRowArb('klappbar-und-aufblasbar'),
        newTypeRowArb('hardshell'),
        function (klappbar, hardshell) {
          const dataset = [hardshell, klappbar]; // reversed order on purpose

          const en = buildCraftOptionLabels(dataset, 'en');
          const de = buildCraftOptionLabels(dataset, 'de');

          const check = function (opts, locale, row) {
            const nameKey = 'name_' + locale;
            const opt = opts.find(function (o) { return o.slug === row.slug; });
            const raw = row[nameKey];
            const expected = isBlank(raw) ? row.slug : raw;
            return opt.label === expected;
          };

          return (
            check(en, 'en', klappbar) &&
            check(en, 'en', hardshell) &&
            check(de, 'de', klappbar) &&
            check(de, 'de', hardshell)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // --- Example-based sanity checks ---

  test('present names are used verbatim per locale', function () {
    const dataset = [
      { slug: 'klappbar-und-aufblasbar', name_de: 'Klappbar und aufblasbar', name_en: 'Foldable and inflatable' },
      { slug: 'hardshell', name_de: 'Hartschale', name_en: 'Hardshell' }
    ];
    const en = buildCraftOptionLabels(dataset, 'en');
    const de = buildCraftOptionLabels(dataset, 'de');

    expect(en[0]).toEqual({ slug: 'klappbar-und-aufblasbar', label: 'Foldable and inflatable' });
    expect(en[1]).toEqual({ slug: 'hardshell', label: 'Hardshell' });
    expect(de[0]).toEqual({ slug: 'klappbar-und-aufblasbar', label: 'Klappbar und aufblasbar' });
    expect(de[1]).toEqual({ slug: 'hardshell', label: 'Hartschale' });
  });

  test('empty, whitespace-only, absent field, and missing row all fall back to slug', function () {
    const dataset = [
      // klappbar present but blank name in both locales (empty + whitespace).
      { slug: 'klappbar-und-aufblasbar', name_de: '   ', name_en: '' }
      // hardshell row missing entirely.
    ];
    const en = buildCraftOptionLabels(dataset, 'en');
    const de = buildCraftOptionLabels(dataset, 'de');

    expect(en[0].label).toBe('klappbar-und-aufblasbar'); // empty -> slug
    expect(de[0].label).toBe('klappbar-und-aufblasbar'); // whitespace -> slug
    expect(en[1].label).toBe('hardshell'); // missing row -> slug
    expect(de[1].label).toBe('hardshell'); // missing row -> slug

    // Absent field key (present row, no name_en) -> slug.
    const dataset2 = [{ slug: 'hardshell', name_de: 'Hartschale' }];
    expect(buildCraftOptionLabels(dataset2, 'en')[1].label).toBe('hardshell');
    expect(buildCraftOptionLabels(dataset2, 'de')[1].label).toBe('Hartschale');
  });
});
