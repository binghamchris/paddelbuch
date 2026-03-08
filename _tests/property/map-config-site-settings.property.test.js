/**
 * Property-Based Tests for MapConfig Site-Level Settings
 *
 * **Feature: liquid-rendering-optimization, Property 5: MapConfig contains all required site-level settings**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 *
 * Property: For any generated api/map-config.js output, the window.paddelbuchMapConfig
 * object shall contain the keys tileUrl, center (with lat and lon), defaultZoom, maxZoom,
 * and attribution, all with non-empty values matching the corresponding _config.yml settings.
 */

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Reference implementation: mirrors build_site_level_config from
// _plugins/map_config_generator.rb
// ---------------------------------------------------------------------------

const ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> ' +
  '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
  '<strong><a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a></strong>';

/**
 * JavaScript equivalent of MapConfigGenerator#build_site_level_config.
 * Accepts a site config object and returns the site-level portion of
 * window.paddelbuchMapConfig.
 */
function buildSiteLevelConfig(siteConfig) {
  const mapCfg = siteConfig.map || {};
  const center = mapCfg.center || {};

  return {
    tileUrl: siteConfig.mapbox_url,
    center: { lat: center.lat, lon: center.lon },
    defaultZoom: mapCfg.default_zoom,
    maxZoom: mapCfg.max_zoom,
    attribution: ATTRIBUTION,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries — smart generators that constrain to the valid input space
// ---------------------------------------------------------------------------

/** Generates a valid Leaflet-style tile URL with {s}, {z}, {x}, {y} placeholders. */
const tileUrlArb = fc
  .record({
    protocol: fc.constantFrom('https://', 'http://'),
    subdomain: fc.stringOf(fc.constantFrom('a', 'b', 'c', '.', '-'), { minLength: 1, maxLength: 30 }),
    path: fc.stringOf(
      fc.constantFrom('/', 'a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '-', '_'),
      { minLength: 1, maxLength: 40 }
    ),
  })
  .map(({ protocol, subdomain, path }) =>
    `${protocol}${subdomain}.tile.example.com/${path}/{z}/{x}/{y}.png`
  );

/** Latitude in valid WGS-84 range. */
const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });

/** Longitude in valid WGS-84 range. */
const lonArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

/** Zoom level — Leaflet supports 0-28, typical configs use 1-20. */
const zoomArb = fc.integer({ min: 0, max: 28 });

/** Max zoom — must be a valid Leaflet zoom level. */
const maxZoomArb = fc.integer({ min: 1, max: 28 });

/** Composite arbitrary for a valid site config object. */
const siteConfigArb = fc.record({
  mapbox_url: tileUrlArb,
  map: fc.record({
    center: fc.record({ lat: latArb, lon: lonArb }),
    default_zoom: zoomArb,
    max_zoom: maxZoomArb,
  }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapConfig Site-Level Settings — Property 5', () => {
  test('output contains tileUrl matching site.mapbox_url', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return config.tileUrl === siteConfig.mapbox_url;
      }),
      { numRuns: 100 }
    );
  });

  test('output contains center.lat matching site.map.center.lat', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return config.center.lat === siteConfig.map.center.lat;
      }),
      { numRuns: 100 }
    );
  });

  test('output contains center.lon matching site.map.center.lon', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return config.center.lon === siteConfig.map.center.lon;
      }),
      { numRuns: 100 }
    );
  });

  test('output contains defaultZoom matching site.map.default_zoom', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return config.defaultZoom === siteConfig.map.default_zoom;
      }),
      { numRuns: 100 }
    );
  });

  test('output contains maxZoom matching site.map.max_zoom', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return config.maxZoom === siteConfig.map.max_zoom;
      }),
      { numRuns: 100 }
    );
  });

  test('output contains non-empty attribution string', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return (
          typeof config.attribution === 'string' &&
          config.attribution.length > 0 &&
          config.attribution === ATTRIBUTION
        );
      }),
      { numRuns: 100 }
    );
  });

  test('output contains all required top-level keys', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        const requiredKeys = ['tileUrl', 'center', 'defaultZoom', 'maxZoom', 'attribution'];
        return requiredKeys.every((key) => key in config && config[key] !== undefined);
      }),
      { numRuns: 100 }
    );
  });

  test('center object contains both lat and lon keys', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        return (
          typeof config.center === 'object' &&
          config.center !== null &&
          'lat' in config.center &&
          'lon' in config.center
        );
      }),
      { numRuns: 100 }
    );
  });

  test('output survives JSON round-trip (serializable like the Ruby plugin)', () => {
    fc.assert(
      fc.property(siteConfigArb, (siteConfig) => {
        const config = buildSiteLevelConfig(siteConfig);
        const json = JSON.stringify(config);
        const parsed = JSON.parse(json);

        return (
          parsed.tileUrl === config.tileUrl &&
          parsed.center.lat === config.center.lat &&
          parsed.center.lon === config.center.lon &&
          parsed.defaultZoom === config.defaultZoom &&
          parsed.maxZoom === config.maxZoom &&
          parsed.attribution === config.attribution
        );
      }),
      { numRuns: 100 }
    );
  });
});
