/**
 * MapLibre GL 6 loading
 *
 * **Feature: ruby4-node26-deps (MapLibre 6 migration)**
 *
 * MapLibre GL JS 6 is published only as ES modules. The site self-hosts the
 * module and its worker under .js names (so every host serves them with a
 * JavaScript MIME type) and loads them through assets/js/maplibre-loader.js.
 * These tests pin the pieces that must line up for the dashboard basemap to
 * work under the site's CSP:
 *   - copy-vendor-assets.js copies the ESM build and its worker, not the
 *     removed UMD build;
 *   - the default layout loads the loader as a module and nothing else from
 *     MapLibre (the bridge is imported by the loader, after the global exists);
 *   - the loader imports the copied module, points the worker at the copied
 *     same-origin worker file, sets window.maplibregl BEFORE importing the
 *     bridge (whose UMD wrapper reads it once at load), and signals readiness;
 *   - it is the only ES module in the site's own JavaScript.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const loader = read('assets/js/maplibre-loader.js');
const copyScript = read('scripts/copy-vendor-assets.js');
const layout = read('_layouts/default.html');

describe('vendor copies', () => {
  test('the ESM build and its worker are copied under .js names', () => {
    expect(copyScript).toMatch(/node_modules\/maplibre-gl\/dist\/maplibre-gl\.mjs'[\s\S]*?assets\/js\/vendor\/maplibre-gl\.esm\.js'/);
    expect(copyScript).toMatch(/node_modules\/maplibre-gl\/dist\/maplibre-gl-worker\.mjs'[\s\S]*?assets\/js\/vendor\/maplibre-gl-worker\.esm\.js'/);
  });

  test('the removed UMD build is not copied', () => {
    expect(copyScript).not.toMatch(/maplibre-gl\/dist\/maplibre-gl\.js'/);
  });

  test('the installed package provides the files that are copied', () => {
    expect(fs.existsSync(path.join(ROOT, 'node_modules/maplibre-gl/dist/maplibre-gl.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'))).toBe(true);
    const pkg = JSON.parse(read('node_modules/maplibre-gl/package.json'));
    expect(Number(pkg.version.split('.')[0])).toBeGreaterThanOrEqual(6);
  });
});

describe('default layout', () => {
  test('loads the loader as an ES module', () => {
    expect(layout).toMatch(/<script type="module" src="\{\{ '\/assets\/js\/maplibre-loader\.js' \| relative_url \}\}"><\/script>/);
  });

  test('does not load MapLibre or the bridge as classic scripts', () => {
    expect(layout).not.toMatch(/vendor\/maplibre-gl\.js/);
    expect(layout).not.toMatch(/<script[^>]*leaflet-maplibre-gl\.js/);
  });

  test('loads Leaflet (which the bridge extends) as a classic script', () => {
    expect(layout).toMatch(/<script src="\{\{ '\/assets\/js\/vendor\/leaflet\.js' \| relative_url \}\}"><\/script>/);
  });
});

describe('maplibre-loader.js', () => {
  const indexOf = re => {
    const m = re.exec(loader);
    return m ? m.index : -1;
  };

  test('imports the copied ESM build', () => {
    expect(loader).toMatch(/^import \* as maplibregl from '\.\/vendor\/maplibre-gl\.esm\.js';$/m);
  });

  test('points the worker at the copied same-origin worker file', () => {
    expect(loader).toMatch(/maplibregl\.setWorkerUrl\(new URL\('\.\/vendor\/maplibre-gl-worker\.esm\.js', import\.meta\.url\)\.href\)/);
  });

  test('the worker and bridge files it names are copied by copy-vendor-assets.js', () => {
    expect(copyScript).toMatch(/assets\/js\/vendor\/maplibre-gl-worker\.esm\.js'/);
    expect(copyScript).toMatch(/assets\/js\/vendor\/leaflet-maplibre-gl\.js'/);
  });

  test('sets window.maplibregl before importing the bridge, then signals readiness', () => {
    const setGlobal = indexOf(/window\.maplibregl = maplibregl;/);
    const bridge = indexOf(/await import\('\.\/vendor\/leaflet-maplibre-gl\.js'\);/);
    const flag = indexOf(/window\.PaddelbuchMaplibreReady = true;/);
    const event = indexOf(/window\.dispatchEvent\(new Event\('paddelbuch:maplibre-ready'\)\);/);
    [setGlobal, bridge, flag, event].forEach(i => expect(i).toBeGreaterThan(-1));
    expect(setGlobal).toBeLessThan(bridge);
    expect(bridge).toBeLessThan(flag);
    expect(flag).toBeLessThan(event);
  });

  test('loads nothing from another origin', () => {
    const specifiers = [...loader.matchAll(/(?:from\s+|import\(|new URL\()\s*'([^']+)'/g)].map(m => m[1]);
    expect(specifiers.length).toBeGreaterThanOrEqual(3);
    specifiers.forEach(s => expect(s.startsWith('./vendor/')).toBe(true));
  });

  test('dashboard-map.js listens for the same event and flag', () => {
    const dashboardMap = read('assets/js/dashboard-map.js');
    expect(dashboardMap).toMatch(/'paddelbuch:maplibre-ready'/);
    expect(dashboardMap).toMatch(/PaddelbuchMaplibreReady/);
  });
});

describe('module boundary', () => {
  test('maplibre-loader.js is the only ES module in the site\'s own JavaScript', () => {
    const dir = path.join(ROOT, 'assets/js');
    const modules = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js'))
      .filter(f => /^\s*(import\s|export\s)/m.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(modules).toEqual(['maplibre-loader.js']);
  });
});
