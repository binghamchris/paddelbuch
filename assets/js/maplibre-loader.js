/**
 * MapLibre GL loader
 *
 * The one ES module in the site's own code, loaded with
 * <script type="module">. MapLibre GL JS 6 is published only as an ES module,
 * while the rest of the frontend (including the Leaflet bridge) uses globals.
 * This module connects the two:
 *
 *   1. imports MapLibre and points it at the self-hosted worker module
 *      (same origin, so CSP `worker-src 'self'` covers it);
 *   2. exposes it as `window.maplibregl`, which the bridge's UMD wrapper reads;
 *   3. loads the bridge, which adds `L.maplibreGL` to Leaflet;
 *   4. sets `window.PaddelbuchMaplibreReady` and fires
 *      `paddelbuch:maplibre-ready` on window.
 *
 * Module scripts run after the document has been parsed, so classic scripts
 * that need the bridge (dashboard-map.js) must wait for the event when
 * `window.PaddelbuchMaplibreReady` is not yet set.
 */

import * as maplibregl from './vendor/maplibre-gl.esm.js';

maplibregl.setWorkerUrl(new URL('./vendor/maplibre-gl-worker.esm.js', import.meta.url).href);
window.maplibregl = maplibregl;

await import('./vendor/leaflet-maplibre-gl.js');

window.PaddelbuchMaplibreReady = true;
window.dispatchEvent(new Event('paddelbuch:maplibre-ready'));
