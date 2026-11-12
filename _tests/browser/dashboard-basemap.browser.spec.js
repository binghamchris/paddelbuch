/**
 * Data quality dashboards in a real browser: the MapLibre GL 6 basemap loads
 * under the deployed Content Security Policy.
 *
 * **Feature: ruby4-node26-deps (MapLibre 6 migration)**
 *
 * MapLibre 6 is an ES module with a module worker. Unit tests pin how it is
 * wired; this checks that it actually works: the module and worker load from
 * the site's own origin under the CSP from deploy/frontend-deploy.yaml, the
 * Leaflet bridge creates the GL layer, the Positron style finishes loading,
 * every dashboard tab renders its layers, and nothing logs an error or a CSP
 * violation.
 *
 * Needs network access to tiles.openfreemap.org (the basemap style and
 * tiles); every other external request is answered empty.
 * Local only: `bundle exec rake build:site`, then `npm run test:browser`.
 */

const { test, expect } = require('@playwright/test');
const { ORIGIN, assertSiteBuilt, serveSiteWithCsp } = require('./site-from-disk');

assertSiteBuilt();

for (const [locale, prefix] of [['de', ''], ['en', '/en']]) {
  test(`dashboards (${locale}): MapLibre 6 basemap loads under the deployed CSP`, async ({ page, context }) => {
    test.setTimeout(90000);
    await serveSiteWithCsp(context, { allowHosts: ['tiles.openfreemap.org'] });

    const problems = [];
    page.on('console', m => {
      if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) problems.push(m.text());
    });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    const workerUrls = [];
    page.on('worker', w => workerUrls.push(w.url()));

    await page.goto(`${ORIGIN}${prefix}/offene-daten/datenqualitaet/`, { waitUntil: 'load' });

    // The loader module ran and the bridge registered itself.
    await expect.poll(() => page.evaluate(() => window.PaddelbuchMaplibreReady === true)).toBe(true);
    const version = await page.evaluate(() => window.maplibregl.getVersion());
    expect(Number(version.split('.')[0])).toBeGreaterThanOrEqual(6);
    expect(await page.evaluate(() => typeof window.L.maplibreGL)).toBe('function');

    // The GL basemap layer exists on the dashboard map and its style loads.
    await expect.poll(() => page.evaluate(() => {
      const map = window.PaddelbuchDashboardMap && window.PaddelbuchDashboardMap.getMap();
      let gl = null;
      map.eachLayer(l => { if (l.getMaplibreMap) gl = l.getMaplibreMap(); });
      return !!gl && gl.isStyleLoaded() && gl.loaded();
    }), { timeout: 45000 }).toBe(true);

    // MapLibre's workers come from the site's own origin (or a blob wrapping
    // a same-origin import), never from elsewhere.
    expect(workerUrls.length).toBeGreaterThan(0);
    for (const u of workerUrls) expect(u.startsWith(ORIGIN) || u.startsWith('blob:')).toBe(true);

    // Every map dashboard still draws its own layers over the basemap.
    const tabs = page.locator('.dashboard-switcher-btn');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < count; i++) {
      await tabs.nth(i).click();
      await expect(page.locator('#dashboard-map canvas').first()).toBeVisible();
      await expect.poll(() => page.locator('#dashboard-map .leaflet-overlay-pane path, #dashboard-map .leaflet-marker-pane > *').count())
        .toBeGreaterThan(0);
    }

    expect(problems).toEqual([]);
  });
}
