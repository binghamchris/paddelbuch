/**
 * Details pages: the pane scrolls, not the page, on wide screens only
 *
 * **Feature: spot-details-pane-scroll**
 *
 * Resolves the compiled stylesheet against a DOM built from the real layout
 * files (see _tests/helpers/detail-page-dom.js), for every details page type
 * and generated window sizes. Because the whole stylesheet takes part in the
 * cascade, a later or more specific rule anywhere that undoes the behaviour
 * fails these properties, not just a change to the rules themselves.
 *
 * Wide (from the Bootstrap lg breakpoint, 992px):
 *   P1 map and pane sit side by side (the pane is not full width);
 *   P2 the pane is capped at exactly the map's height, which is the window
 *      minus $menu-height, and scrolls (overflow-y: auto);
 *   P3 `main` adds no bottom padding, so nothing is below the map;
 *   P4 the pane keeps a 2em bottom padding inside the scroll area;
 *   P5 every absolutely positioned element in the pane, including one added
 *      anywhere in it, has its containing block inside the pane, so the pane
 *      clips it instead of it stretching the page.
 * Narrow (below 992px), the stacked layout is unchanged:
 *   P6 the pane is full width with no height cap, no position and no
 *      overflow-y of its own, no bottom padding of its own; `main` keeps its
 *      2em bottom padding; the map is 60vh.
 */

const fc = require('fast-check');
const { parseCss, createResolver, mediaMatches } = require('../helpers/css-cascade');
const { buildDetailPage, compileApplicationCss, menuHeightPx, DETAIL_PAGES } = require('../helpers/detail-page-dom');

const rules = parseCss(compileApplicationCss());
const resolve = createResolver(rules);
const MENU = menuHeightPx();
const CAP = `calc(100svh - ${MENU}px)`;

// The lg breakpoint, read from Bootstrap's compiled .col-lg-4 rule.
const LG = (() => {
  const rule = rules.find(r => r.selectors.includes('.col-lg-4') && r.media.length === 1);
  return parseFloat(/min-width:\s*([\d.]+)px/.exec(rule.media[0])[1]);
})();

const pages = DETAIL_PAGES.map(p => {
  const { document } = buildDetailPage(p.type);
  const main = document.querySelector('main');
  const pane = document.querySelector(`body.${p.pageClass} main .row > .${p.paneClass}`);
  const map = document.querySelector(`body.${p.pageClass} main .row .map`);
  return { ...p, document, main, pane, map };
});

const pageArb = fc.constantFrom(...pages);
const heightArb = fc.integer({ min: 400, max: 1600 });
const wideArb = fc.integer({ min: LG, max: 3840 });
const narrowArb = fc.integer({ min: 280, max: LG - 1 });
const env = (width, height) => ({ width, height, reducedMotion: false });

const isStatic = v => v === undefined || v === 'static';

function containingBlock(el, root, e) {
  for (let a = el.parentElement; a; a = a.parentElement) {
    if (!isStatic(resolve(a, 'position', e))) return a;
    if (a === root.ownerDocument.body) break;
  }
  return null;
}

describe('details page structure the layout rules depend on', () => {
  test('the lg breakpoint matches the wide-screen block in each page partial', () => {
    expect(LG).toBe(992);
    pages.forEach(p => {
      const capRule = rules.find(r => r.selectors.includes(`.${p.pageClass} .${p.paneClass}`)
        && r.declarations.some(d => d.prop === 'max-height'));
      expect(capRule).toBeDefined();
      expect(capRule.media.some(m => mediaMatches(m, env(LG, 800)))).toBe(true);
      expect(capRule.media.some(m => mediaMatches(m, env(LG - 1, 800)))).toBe(false);
    });
  });

  test.each(pages.map(p => [p.type, p]))('%s: body class, pane and map are where the styles expect them', (_t, p) => {
    expect(p.document.body.classList.contains(p.pageClass)).toBe(true);
    expect(p.pane).not.toBeNull();
    expect(p.map).not.toBeNull();
    // The pane and the map column are siblings in the same Bootstrap row.
    const mapColumn = p.map.parentElement;
    expect(mapColumn.parentElement).toBe(p.pane.parentElement);
    expect(p.pane.parentElement.classList.contains('row')).toBe(true);
    expect(p.main.contains(p.pane)).toBe(true);
  });
});

describe('wide screens: the details pane scrolls, the page does not', () => {
  test('P1-P4: side by side, pane capped at the map height and scrolling, nothing below the map', () => {
    fc.assert(fc.property(pageArb, wideArb, heightArb, (p, w, h) => {
      const e = env(w, h);
      // P1
      expect(resolve(p.pane, 'width', e)).not.toBe('100%');
      expect(resolve(p.map.parentElement, 'width', e)).not.toBe('100%');
      // P2
      const mapHeight = resolve(p.map, 'height', e);
      expect(mapHeight).toBe(CAP);
      expect(resolve(p.pane, 'max-height', e)).toBe(mapHeight);
      expect(resolve(p.pane, 'overflow-y', e)).toBe('auto');
      expect(resolve(p.pane, 'height', e)).toBeUndefined();
      // P3
      expect(resolve(p.main, 'padding-bottom', e)).toBe('0');
      expect(resolve(p.main, 'margin-bottom', e) || '0').toMatch(/^0(px)?$/);
      // P4
      expect(resolve(p.pane, 'padding-bottom', e)).toBe('2em');
    }), { numRuns: 300 });
  });

  test('P5: absolutely positioned content in the pane is contained by the pane', () => {
    const absoluteCount = { seen: 0 };
    pages.forEach(p => {
      const e = env(1440, 900);
      p.pane.querySelectorAll('*').forEach(el => {
        if (resolve(el, 'position', e) === 'absolute') {
          absoluteCount.seen++;
          const cb = containingBlock(el, p.pane, e);
          expect(cb && (cb === p.pane || p.pane.contains(cb))).toBe(true);
        }
      });
    });
    // Anti-vacuity: the real layouts do contain absolutely positioned elements.
    expect(absoluteCount.seen).toBeGreaterThan(0);

    fc.assert(fc.property(pageArb, wideArb, heightArb, fc.nat(), (p, w, h, pick) => {
      const e = env(w, h);
      const hosts = [p.pane, ...p.pane.querySelectorAll('*')].filter(el => !/^(svg|path|img|br|hr|input)$/i.test(el.tagName));
      const host = hosts[pick % hosts.length];
      const label = p.document.createElement('span');
      label.className = 'visually-hidden';
      host.appendChild(label);
      try {
        expect(resolve(label, 'position', e)).toBe('absolute');
        const cb = containingBlock(label, p.pane, e);
        expect(cb && (cb === p.pane || p.pane.contains(cb))).toBe(true);
      } finally {
        label.remove();
      }
    }), { numRuns: 200 });
  });
});

describe('narrow screens: the stacked layout is unchanged', () => {
  test('P6: full-width pane with no cap, no own scrolling, main keeps its padding, map 60vh', () => {
    fc.assert(fc.property(pageArb, narrowArb, heightArb, (p, w, h) => {
      const e = env(w, h);
      expect(resolve(p.pane, 'width', e)).toBe('100%');
      expect(resolve(p.pane, 'max-height', e)).toBeUndefined();
      expect(resolve(p.pane, 'height', e)).toBeUndefined();
      expect(isStatic(resolve(p.pane, 'position', e))).toBe(true);
      expect(resolve(p.pane, 'overflow-y', e)).toBeUndefined();
      expect(resolve(p.pane, 'padding-bottom', e)).toBeUndefined();
      expect(resolve(p.main, 'padding-bottom', e)).toBe('2em');
      expect(resolve(p.map, 'height', e)).toBe('60vh');
    }), { numRuns: 300 });
  });
});
