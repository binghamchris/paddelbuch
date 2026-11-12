/**
 * Details pages in a real browser: the pane scrolls, not the page, on wide
 * screens; the stacked layout below 992px is unchanged.
 *
 * **Feature: spot-details-pane-scroll**
 *
 * Covers what the jsdom cascade tests cannot, because it depends on rendered
 * sizes: the header must fit in $menu-height, the map must end at the window
 * bottom, the pane must really scroll (wheel and keyboard focus) while the
 * page and map stay put, and absolutely placed content must not stretch the
 * page. Runs against the built site for every details page type in both
 * locales, using each type's largest real page plus injected long content.
 *
 * Local only: `bundle exec rake build:site`, then `npm run test:browser`.
 */

const { test, expect } = require('@playwright/test');
const { ORIGIN, assertSiteBuilt, serveSite, largestPages, menuHeightPx } = require('./site-from-disk');

assertSiteBuilt();
const MENU = menuHeightPx();

const TYPES = [
  { type: 'spot', dir: 'einstiegsorte', pane: '.spot-description' },
  { type: 'waterway', dir: 'gewaesser', pane: '.waterway-details' },
  { type: 'obstacle', dir: 'hindernisse', pane: '.obstacle-description' },
  { type: 'notice', dir: 'gewaesserereignisse', pane: '.notice-description' }
];
const LOCALES = [['de', ''], ['en', 'en/']];
const WIDE = [[992, 700], [1280, 720], [1440, 900], [1920, 1080]];
const NARROW = [[390, 844], [768, 1024], [991, 800]];

const CASES = [];
for (const t of TYPES) {
  for (const [locale, prefix] of LOCALES) {
    const [url] = largestPages(`${prefix}${t.dir}`, 1);
    if (!url) throw new Error(`No built ${t.type} pages under _site/${prefix}${t.dir}/`);
    CASES.push({ ...t, locale, url });
  }
}

test.beforeEach(async ({ context }) => {
  await serveSite(context);
});

async function open(page, c, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(ORIGIN + c.url, { waitUntil: 'load' });
  await expect(page.locator(c.pane)).toHaveCount(1);
  await expect(page.locator('.map')).toHaveCount(1);
}

// Page, header, map and pane geometry in CSS pixels.
function geometry(page, paneSel) {
  return page.evaluate(sel => {
    const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height, width: b.width }; };
    const pane = document.querySelector(sel);
    return {
      winH: innerHeight,
      winW: document.documentElement.clientWidth,
      docH: document.scrollingElement.scrollHeight,
      scrollY,
      header: document.querySelector('main').getBoundingClientRect().top,
      map: r(document.querySelector('.map')),
      pane: r(pane),
      paneScrollTop: pane.scrollTop,
      paneMax: pane.scrollHeight - pane.clientHeight
    };
  }, paneSel);
}

// Appends long content to the pane: paragraphs, an absolutely placed
// .visually-hidden label, and a final link marked data-test-last.
function injectLongContent(page, paneSel) {
  return page.evaluate(sel => {
    const pane = document.querySelector(sel);
    const box = document.createElement('div');
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('p');
      p.textContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(6);
      box.appendChild(p);
    }
    const hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = 'hidden label';
    box.appendChild(hidden);
    const last = document.createElement('a');
    last.href = '#';
    last.textContent = 'last';
    last.setAttribute('data-test-last', '');
    box.appendChild(last);
    pane.appendChild(box);
  }, paneSel);
}

for (const c of CASES) {
  test.describe(`${c.type} (${c.locale}) ${c.url}`, () => {
    for (const [w, h] of WIDE) {
      test(`wide ${w}x${h}: pane scrolls, page and map stay put`, async ({ page }) => {
        await open(page, c, w, h);
        const g = await geometry(page, c.pane);

        // The header fits in $menu-height, so the map can end at the window bottom.
        expect(g.header).toBeLessThanOrEqual(MENU + 0.5);
        expect(g.docH).toBeLessThanOrEqual(g.winH);
        expect(Math.abs(g.map.top - g.header)).toBeLessThan(0.5);
        expect(g.map.bottom).toBeLessThanOrEqual(g.winH + 0.5);
        expect(g.map.bottom).toBeGreaterThan(g.winH - 1);
        expect(Math.abs(g.pane.top - g.map.top)).toBeLessThan(0.5);
        expect(g.pane.height).toBeLessThanOrEqual(g.map.height + 0.5);
        expect(g.pane.width).toBeLessThan(g.winW - 1); // side by side, not stacked

        await injectLongContent(page, c.pane);
        const long = await geometry(page, c.pane);
        expect(long.docH).toBeLessThanOrEqual(long.winH);
        expect(Math.abs(long.pane.height - long.map.height)).toBeLessThan(0.5);
        expect(long.paneMax).toBeGreaterThan(0);

        // Mouse wheel over the pane scrolls the pane to its end; nothing else moves.
        await page.mouse.move(long.pane.width > 0 ? w - long.pane.width / 2 : w - 10, long.pane.top + long.pane.height / 2);
        for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 500);
        await expect.poll(async () => {
          const s = await geometry(page, c.pane);
          return s.paneMax - s.paneScrollTop;
        }).toBeLessThanOrEqual(1);
        const scrolled = await geometry(page, c.pane);
        expect(scrolled.scrollY).toBe(0);
        expect(scrolled.map).toEqual(long.map);
        const last = page.locator('[data-test-last]');
        const lastBox = await last.boundingBox();
        expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(scrolled.pane.bottom + 0.5);
        expect(lastBox.y).toBeGreaterThanOrEqual(scrolled.pane.top);

        // Keyboard focus on content at the bottom scrolls the pane, not the page.
        await page.evaluate(sel => { document.querySelector(sel).scrollTop = 0; }, c.pane);
        await last.focus();
        const focused = await geometry(page, c.pane);
        expect(focused.paneScrollTop).toBeGreaterThan(0);
        expect(focused.scrollY).toBe(0);
        await expect(last).toBeInViewport();

        // Back at the top, the header controls are visible and not covered.
        await page.evaluate(sel => { document.querySelector(sel).scrollTop = 0; }, c.pane);
        const controls = ['.detail-close-btn'];
        if (c.type === 'spot') controls.push('.spot-title .navigate-btn');
        for (const sel of controls) {
          const loc = page.locator(sel).first();
          if (sel !== '.detail-close-btn' && (await loc.count()) === 0) continue; // rejected spots
          await expect(loc).toBeInViewport();
          const b = await loc.boundingBox();
          const hit = await page.evaluate(([s, x, y]) => {
            const el = document.elementFromPoint(x, y);
            return !!(el && el.closest(s));
          }, [sel, b.x + b.width / 2, b.y + b.height / 2]);
          expect(hit).toBe(true);
        }

        // A wheel over the map never scrolls the page.
        await page.mouse.move(10, long.map.top + long.map.height / 2);
        await page.mouse.wheel(0, 500);
        expect((await geometry(page, c.pane)).scrollY).toBe(0);
      });
    }

    for (const [w, h] of NARROW) {
      test(`narrow ${w}x${h}: stacked layout, the page scrolls`, async ({ page }) => {
        await open(page, c, w, h);
        const g = await geometry(page, c.pane);
        expect(Math.abs(g.map.height - 0.6 * g.winH)).toBeLessThan(1); // 60vh
        expect(g.pane.top).toBeGreaterThanOrEqual(g.map.bottom - 0.5); // below the map
        expect(g.pane.width).toBeGreaterThanOrEqual(g.winW - 1); // full width

        await injectLongContent(page, c.pane);
        const long = await geometry(page, c.pane);
        expect(long.paneMax).toBeLessThanOrEqual(1); // the pane does not scroll on its own
        expect(long.docH).toBeGreaterThan(long.winH); // the page does
        await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
        await expect(page.locator('[data-test-last]')).toBeInViewport();
      });
    }
  });
}
