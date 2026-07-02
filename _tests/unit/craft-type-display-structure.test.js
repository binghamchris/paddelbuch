// Feature: paddlecraft-types-change, Task 4.2: structural/example-based tests for
// Craft_Type_Display placement, legacy-row removal, and per-entry vertical order.
//
// Validates: Requirements 4.1, 4.6, 5.6
//
// These are structural / example-based unit tests (not property tests). They read the
// actual include sources from disk and model the small amount of Liquid composition in
// JS -- mirroring how the repo models Liquid include behaviour in its tests (see
// _tests/property/craft-type-display.property.test.js and the include-source parsing in
// _tests/property/map-layers-*.property.test.js). This guards the real files against
// regressions in element ordering and the removal of the former craft-type table row.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SDC_PATH = path.join(ROOT, '_includes', 'spot-detail-content.html');
const CTD_PATH = path.join(ROOT, '_includes', 'craft-type-display.html');

const sdcSource = fs.readFileSync(SDC_PATH, 'utf-8');
const ctdSource = fs.readFileSync(CTD_PATH, 'utf-8');

// --- Minimal JS model of craft-type-display.html (mirrors the real Liquid) --------------

// Ordered display list produced by precompute_generator.rb -> craft_type_display_for_locale.
const DISPLAY_LIST = [
  { slug: 'klappbar-und-aufblasbar', name: 'Faltbar und aufblasbar', icon: '/assets/images/icons/foldables-dark.svg' },
  { slug: 'hardshell', name: 'Hartschale', icon: '/assets/images/icons/hardshell-dark.svg' }
];

// slug -> icon-name mapping performed by _includes/craft-icon.html.
const CRAFT_ICON_NAMES = {
  'klappbar-und-aufblasbar': 'foldables',
  'hardshell': 'hardshell'
};

function renderCraftIcon(slug) {
  const name = CRAFT_ICON_NAMES[slug];
  if (!name) return '';
  return '<img src="/assets/images/icons/' + name + '-dark.svg" alt="" aria-hidden="true" class="craft-icon" />';
}

// Mirrors _includes/craft-type-display.html: per entry the children render in the order
// name (top) -> craft icon (middle) -> tick/cross indicator (bottom).
function renderCraftTypeDisplay(linkedSlugs) {
  const linked = linkedSlugs || [];
  const entries = DISPLAY_LIST.map(function (ct) {
    const isLinked = linked.indexOf(ct.slug) !== -1;
    const stateClass = isLinked ? 'is-linked' : 'is-unlinked';
    const indicator = isLinked
      ? '<span class="craft-type-indicator craft-type-indicator--linked" aria-hidden="true"><svg class="craft-type-indicator-icon craft-type-indicator-icon--check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M2 9 L6 13 L14 3" /></svg></span>'
      : '<span class="craft-type-indicator craft-type-indicator--unlinked" aria-hidden="true"><svg class="craft-type-indicator-icon craft-type-indicator-icon--cross" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 3 L13 13 M13 3 L3 13" /></svg></span>';
    return '<div class="craft-type-entry ' + stateClass + '">' +
      '<span class="craft-type-entry-name">' + ct.name + '</span>' +
      renderCraftIcon(ct.slug) +
      indicator +
      '</div>';
  });
  return '<div class="craft-type-display">' + entries.join('') + '</div>';
}

// Compose the rendered spot-detail-content document by substituting the real include's
// output at the include site in the actual spot-detail-content.html source. This preserves
// the real placement of the include relative to the details table.
function renderSpotDetailContent(spot) {
  return sdcSource.replace(
    /\{%\s*include\s+craft-type-display\.html[^%]*%\}/,
    renderCraftTypeDisplay(spot.paddle_craft_type_slugs)
  );
}

// A representative non-rejected spot: one new type linked, the other unlinked.
const REPRESENTATIVE_SPOT = { paddle_craft_type_slugs: ['klappbar-und-aufblasbar'] };

describe('Craft_Type_Display structure (Task 4.2)', () => {
  describe('Requirement 4.1 - placement above the details table', () => {
    test('the include is placed before the spot-details-table in the include source', () => {
      const includeIdx = sdcSource.search(/\{%\s*include\s+craft-type-display\.html/);
      const tableIdx = sdcSource.indexOf('<table class="spot-details-table"');
      expect(includeIdx).toBeGreaterThan(-1);
      expect(tableIdx).toBeGreaterThan(-1);
      expect(includeIdx).toBeLessThan(tableIdx);
    });

    test('.craft-type-display appears before .spot-details-table in rendered document order', () => {
      const html = renderSpotDetailContent(REPRESENTATIVE_SPOT);
      const displayIdx = html.indexOf('class="craft-type-display"');
      const tableIdx = html.indexOf('class="spot-details-table"');
      expect(displayIdx).toBeGreaterThan(-1);
      expect(tableIdx).toBeGreaterThan(-1);
      expect(displayIdx).toBeLessThan(tableIdx);
    });
  });

  describe('Requirement 4.6 - former craft-type row removed from the details table', () => {
    test('the spot-details-table block contains no craft-type-list or craft-type-title elements', () => {
      const tableMatch = sdcSource.match(/<table class="spot-details-table">[\s\S]*?<\/table>/);
      expect(tableMatch).not.toBeNull();
      const tableBlock = tableMatch[0];
      expect(tableBlock).not.toMatch(/craft-type-list/);
      expect(tableBlock).not.toMatch(/craft-type-title/);
    });

    test('the rendered details table likewise contains neither class', () => {
      const html = renderSpotDetailContent(REPRESENTATIVE_SPOT);
      const tableMatch = html.match(/<table class="spot-details-table">[\s\S]*?<\/table>/);
      expect(tableMatch).not.toBeNull();
      const tableBlock = tableMatch[0];
      expect(tableBlock).not.toMatch(/craft-type-list/);
      expect(tableBlock).not.toMatch(/craft-type-title/);
    });
  });

  describe('Requirement 5.6 - per-entry vertical order name -> icon -> indicator', () => {
    test('the include source orders each entry as name, then craft icon, then indicator', () => {
      const nameIdx = ctdSource.indexOf('craft-type-entry-name');
      const iconIdx = ctdSource.indexOf('craft-icon.html');
      const indicatorIdx = ctdSource.indexOf('craft-type-indicator');
      expect(nameIdx).toBeGreaterThan(-1);
      expect(iconIdx).toBeGreaterThan(-1);
      expect(indicatorIdx).toBeGreaterThan(-1);
      expect(nameIdx).toBeLessThan(iconIdx);
      expect(iconIdx).toBeLessThan(indicatorIdx);
    });

    test('each rendered .craft-type-entry orders its children name -> icon -> indicator', () => {
      const displayHtml = renderCraftTypeDisplay(REPRESENTATIVE_SPOT.paddle_craft_type_slugs);
      const entryRe = /<div class="craft-type-entry[^"]*">([\s\S]*?)<\/div>/g;
      const inners = [];
      let m;
      while ((m = entryRe.exec(displayHtml)) !== null) {
        inners.push(m[1]);
      }
      expect(inners.length).toBe(2);
      inners.forEach(function (inner) {
        const nameIdx = inner.indexOf('craft-type-entry-name');
        const iconIdx = inner.indexOf('craft-icon');
        const indicatorIdx = inner.indexOf('craft-type-indicator');
        expect(nameIdx).toBeGreaterThan(-1);
        expect(iconIdx).toBeGreaterThan(-1);
        expect(indicatorIdx).toBeGreaterThan(-1);
        expect(nameIdx).toBeLessThan(iconIdx);
        expect(iconIdx).toBeLessThan(indicatorIdx);
      });
    });
  });
});
