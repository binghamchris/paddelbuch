/**
 * Property-Based Test for the Craft_Type_Display linked-state behaviour
 *
 * // Feature: paddlecraft-types-change, Property 8: Craft_Type_Display reflects independent linked state for both new types
 * // Validates: Requirements 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * Property: For any spot, the Craft_Type_Display shall render exactly two entries in the
 * order `klappbar-und-aufblasbar` then `hardshell`; each entry shall show that type's icon
 * and its localised name (or the slug when the localised name is empty or absent); and,
 * determined independently for each entry, an entry whose slug is contained in the spot's
 * `paddle_craft_type_slugs` shall render a non-greyed icon (is-linked) and a `$green-1` tick
 * indicator (`--linked`), while an entry whose slug is not contained shall render a greyed
 * icon (is-unlinked) and a `$danger-red` cross indicator (`--unlinked`).
 *
 * This models the Liquid logic of _includes/craft-type-display.html (and the slug fallback
 * applied by precompute_generator.rb when building craft_type_display_for_locale) in JS,
 * mirroring how the repo models Liquid include behaviour in JS property tests
 * (see craft-icon-mapping.property.test.js and spot-tip-banner-rendering.property.test.js).
 */

const fc = require('fast-check');

// The two new craft type slugs, in canonical display order.
const NEW_CRAFT_TYPE_SLUGS = ['klappbar-und-aufblasbar', 'hardshell'];

// Standalone icon metadata for the two new craft types (mirrors NEW_CRAFT_TYPE_META
// in _plugins/precompute_generator.rb / craft_type_display_for_locale).
const NEW_CRAFT_TYPE_ICONS = {
  'klappbar-und-aufblasbar': '/assets/images/icons/foldables-dark.svg',
  'hardshell': '/assets/images/icons/hardshell-dark.svg'
};

// The slug -> icon-name mapping performed by _includes/craft-icon.html.
const CRAFT_ICON_NAMES = {
  'klappbar-und-aufblasbar': 'foldables',
  'hardshell': 'hardshell'
};

/**
 * Escapes HTML special characters (mirrors Liquid's escape filter).
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Models the craft-icon.html include for a known new-type slug.
 */
function renderCraftIcon(slug) {
  const craftIcon = Object.prototype.hasOwnProperty.call(CRAFT_ICON_NAMES, slug)
    ? CRAFT_ICON_NAMES[slug]
    : null;
  if (!craftIcon) return '';
  const craftIconPath = '/assets/images/icons/' + craftIcon + '-dark.svg';
  return '<img src="' + craftIconPath + '" alt="" aria-hidden="true" class="craft-icon" />';
}

/**
 * Builds the ordered craft_type_display_for_locale list, applying the slug fallback
 * that precompute_generator.rb performs: when the localised name is nil, absent, or
 * whitespace-only, the slug is used in its place.
 *
 * @param {Object} rawNames - map of slug -> raw localised name (may be null/undefined/'' /whitespace)
 * @returns {Array} ordered list of { slug, name, icon }
 */
function buildDisplayList(rawNames) {
  return NEW_CRAFT_TYPE_SLUGS.map(function (slug) {
    const raw = rawNames ? rawNames[slug] : undefined;
    const name = (raw === null || raw === undefined || String(raw).trim() === '')
      ? slug
      : raw;
    return { slug: slug, name: name, icon: NEW_CRAFT_TYPE_ICONS[slug] };
  });
}

/**
 * Models the Liquid logic of _includes/craft-type-display.html.
 *
 *   {% assign linked_slugs = spot.paddle_craft_type_slugs %}
 *   <div class="craft-type-display">
 *     {% for ct in craft_types %}
 *       {% if linked_slugs contains ct.slug %} is-linked {% else %} is-unlinked {% endif %}
 *       name -> craft-icon -> tick(&#10003;)/cross(&#10007;) indicator
 *     {% endfor %}
 *   </div>
 *
 * @param {Array} linkedSlugs - the spot's paddle_craft_type_slugs
 * @param {Array} displayList - ordered [{ slug, name, icon }]
 * @returns {string} rendered HTML
 */
function renderCraftTypeDisplay(linkedSlugs, displayList) {
  const linked = linkedSlugs || [];
  const entries = displayList.map(function (ct) {
    const isLinked = linked.indexOf(ct.slug) !== -1;
    const stateClass = isLinked ? 'is-linked' : 'is-unlinked';
    const indicator = isLinked
      ? '<span class="craft-type-indicator craft-type-indicator--linked" aria-hidden="true">&#10003;</span>'
      : '<span class="craft-type-indicator craft-type-indicator--unlinked" aria-hidden="true">&#10007;</span>';
    return '<div class="craft-type-entry ' + stateClass + '" data-slug="' + ct.slug + '">' +
      '<span class="craft-type-entry-name">' + escapeHtml(ct.name) + '</span>' +
      renderCraftIcon(ct.slug) +
      indicator +
      '</div>';
  });
  return '<div class="craft-type-display">' + entries.join('') + '</div>';
}

/**
 * Parses the rendered display HTML into structured per-entry facts for assertions.
 * Returns an ordered array of { slug, isLinked, isUnlinked, hasTick, hasCross,
 * indicatorClass, iconSrc, nameText }.
 */
function parseEntries(html) {
  const entries = [];
  const entryRe = /<div class="craft-type-entry ([^"]+)" data-slug="([^"]+)">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = entryRe.exec(html)) !== null) {
    const classes = m[1];
    const slug = m[2];
    const inner = m[3];
    const nameMatch = inner.match(/<span class="craft-type-entry-name">([\s\S]*?)<\/span>/);
    const iconMatch = inner.match(/<img src="([^"]+)"/);
    entries.push({
      slug: slug,
      isLinked: /\bis-linked\b/.test(classes),
      isUnlinked: /\bis-unlinked\b/.test(classes),
      hasTick: inner.indexOf('&#10003;') !== -1,
      hasCross: inner.indexOf('&#10007;') !== -1,
      hasLinkedIndicator: inner.indexOf('craft-type-indicator--linked') !== -1,
      hasUnlinkedIndicator: inner.indexOf('craft-type-indicator--unlinked') !== -1,
      iconSrc: iconMatch ? iconMatch[1] : null,
      nameText: nameMatch ? nameMatch[1] : null
    });
  }
  return entries;
}

// --- Arbitraries ---

// A raw localised name: valid text, empty, whitespace-only, or absent (null).
const rawNameArb = fc.oneof(
  fc.constant(null),
  fc.constant(''),
  fc.constant('   '),
  fc.string({ minLength: 1, maxLength: 40 }).filter(function (s) { return s.trim().length > 0; })
);

const rawNamesArb = fc.record({
  'klappbar-und-aufblasbar': rawNameArb,
  'hardshell': rawNameArb
});

// An unrelated slug that is NOT one of the two new craft types.
const unrelatedSlugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,15}$/)
  .filter(function (s) { return NEW_CRAFT_TYPE_SLUGS.indexOf(s) === -1; });

// The spot's paddle_craft_type_slugs: a subset of the powerset {none, klappbar, hardshell,
// both} plus optional unrelated slugs, in arbitrary order.
const linkedSlugsArb = fc
  .record({
    includeKlappbar: fc.boolean(),
    includeHardshell: fc.boolean(),
    unrelated: fc.array(unrelatedSlugArb, { maxLength: 4 })
  })
  .map(function (cfg) {
    const slugs = [];
    if (cfg.includeKlappbar) slugs.push('klappbar-und-aufblasbar');
    if (cfg.includeHardshell) slugs.push('hardshell');
    return slugs.concat(cfg.unrelated);
  });

describe('Craft_Type_Display linked-state - Property 8', () => {
  test('renders exactly two entries in the order klappbar-und-aufblasbar then hardshell', () => {
    fc.assert(
      fc.property(linkedSlugsArb, rawNamesArb, function (linkedSlugs, rawNames) {
        const entries = parseEntries(renderCraftTypeDisplay(linkedSlugs, buildDisplayList(rawNames)));
        return entries.length === 2 &&
          entries[0].slug === 'klappbar-und-aufblasbar' &&
          entries[1].slug === 'hardshell';
      }),
      { numRuns: 100 }
    );
  });

  test('each entry shows its icon and its localised name (or slug fallback when empty/absent)', () => {
    fc.assert(
      fc.property(linkedSlugsArb, rawNamesArb, function (linkedSlugs, rawNames) {
        const entries = parseEntries(renderCraftTypeDisplay(linkedSlugs, buildDisplayList(rawNames)));
        return entries.every(function (entry) {
          const raw = rawNames[entry.slug];
          const expectedName = (raw === null || raw === undefined || String(raw).trim() === '')
            ? entry.slug
            : raw;
          const iconOk = entry.iconSrc === NEW_CRAFT_TYPE_ICONS[entry.slug];
          const nameOk = entry.nameText === escapeHtml(expectedName);
          return iconOk && nameOk;
        });
      }),
      { numRuns: 100 }
    );
  });

  test('contained slug -> is-linked + green tick; non-contained slug -> is-unlinked + red cross (independently)', () => {
    fc.assert(
      fc.property(linkedSlugsArb, rawNamesArb, function (linkedSlugs, rawNames) {
        const entries = parseEntries(renderCraftTypeDisplay(linkedSlugs, buildDisplayList(rawNames)));
        return entries.every(function (entry) {
          const contained = linkedSlugs.indexOf(entry.slug) !== -1;
          if (contained) {
            // non-greyed (is-linked) + green tick (--linked)
            return entry.isLinked && !entry.isUnlinked &&
              entry.hasTick && !entry.hasCross &&
              entry.hasLinkedIndicator && !entry.hasUnlinkedIndicator;
          }
          // greyed (is-unlinked) + red cross (--unlinked)
          return entry.isUnlinked && !entry.isLinked &&
            entry.hasCross && !entry.hasTick &&
            entry.hasUnlinkedIndicator && !entry.hasLinkedIndicator;
        });
      }),
      { numRuns: 100 }
    );
  });

  test('linked state is determined independently: one entry may be linked while the other is not', () => {
    // Only klappbar linked -> klappbar is-linked, hardshell is-unlinked.
    const onlyKlappbar = parseEntries(
      renderCraftTypeDisplay(['klappbar-und-aufblasbar'], buildDisplayList({}))
    );
    expect(onlyKlappbar[0].isLinked).toBe(true);
    expect(onlyKlappbar[0].hasTick).toBe(true);
    expect(onlyKlappbar[1].isUnlinked).toBe(true);
    expect(onlyKlappbar[1].hasCross).toBe(true);

    // Only hardshell linked -> klappbar is-unlinked, hardshell is-linked.
    const onlyHardshell = parseEntries(
      renderCraftTypeDisplay(['hardshell'], buildDisplayList({}))
    );
    expect(onlyHardshell[0].isUnlinked).toBe(true);
    expect(onlyHardshell[0].hasCross).toBe(true);
    expect(onlyHardshell[1].isLinked).toBe(true);
    expect(onlyHardshell[1].hasTick).toBe(true);
  });

  // --- Example-based sanity checks over the {none, klappbar, hardshell, both} powerset ---

  test('none linked: both entries unlinked with red cross', () => {
    const entries = parseEntries(renderCraftTypeDisplay([], buildDisplayList({})));
    expect(entries.map(function (e) { return e.isUnlinked; })).toEqual([true, true]);
    expect(entries.map(function (e) { return e.hasCross; })).toEqual([true, true]);
  });

  test('both linked: both entries linked with green tick', () => {
    const entries = parseEntries(
      renderCraftTypeDisplay(['klappbar-und-aufblasbar', 'hardshell'], buildDisplayList({}))
    );
    expect(entries.map(function (e) { return e.isLinked; })).toEqual([true, true]);
    expect(entries.map(function (e) { return e.hasTick; })).toEqual([true, true]);
  });

  test('slug fallback: empty/whitespace/absent name renders the slug', () => {
    const entries = parseEntries(
      renderCraftTypeDisplay([], buildDisplayList({
        'klappbar-und-aufblasbar': '',
        'hardshell': '   '
      }))
    );
    expect(entries[0].nameText).toBe('klappbar-und-aufblasbar');
    expect(entries[1].nameText).toBe('hardshell');
  });

  test('localised name is rendered (escaped) when present', () => {
    const entries = parseEntries(
      renderCraftTypeDisplay([], buildDisplayList({
        'klappbar-und-aufblasbar': 'Faltbar & Aufblasbar',
        'hardshell': 'Hartschale'
      }))
    );
    expect(entries[0].nameText).toBe('Faltbar &amp; Aufblasbar');
    expect(entries[1].nameText).toBe('Hartschale');
  });

  test('unrelated slugs on the spot do not link either new-type entry', () => {
    const entries = parseEntries(
      renderCraftTypeDisplay(['seekajak', 'kanadier'], buildDisplayList({}))
    );
    expect(entries[0].isUnlinked).toBe(true);
    expect(entries[1].isUnlinked).toBe(true);
  });
});
