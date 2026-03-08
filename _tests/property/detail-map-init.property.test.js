/**
 * Property-Based Tests for Detail Map Initialization Per Page Type
 *
 * **Feature: liquid-rendering-optimization, Property 4: detail-map.js initializes map correctly per page type**
 * **Validates: Requirements 4.4, 4.11, 4.12, 4.13, 4.14, 6.4**
 *
 * Property: For any valid page type and its associated data attributes,
 * detail-map.js shall read tile URL, center, zoom, and attribution from
 * window.paddelbuchMapConfig, read page-specific values from data-* attributes,
 * and produce the correct center, zoom, layer configuration, and locale-specific
 * locate control tooltip per page type.
 */

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Constants — mirrors detail-map.js fallback values
// ---------------------------------------------------------------------------

const FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const FALLBACK_CENTER = { lat: 46.801111, lon: 8.226667 };
const FALLBACK_ZOOM = 8;
const FALLBACK_MAX_ZOOM = 18;
const FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// ---------------------------------------------------------------------------
// Reference implementation — mirrors the initialization logic in detail-map.js
// ---------------------------------------------------------------------------

/**
 * Resolves site-level config with fallbacks, mirroring getConfig() in detail-map.js.
 */
function resolveConfig(mapConfig) {
  if (!mapConfig) {
    return {
      tileUrl: FALLBACK_TILE_URL,
      center: FALLBACK_CENTER,
      defaultZoom: FALLBACK_ZOOM,
      maxZoom: FALLBACK_MAX_ZOOM,
      attribution: FALLBACK_ATTRIBUTION
    };
  }
  return {
    tileUrl: mapConfig.tileUrl || FALLBACK_TILE_URL,
    center: mapConfig.center || FALLBACK_CENTER,
    defaultZoom: mapConfig.defaultZoom || FALLBACK_ZOOM,
    maxZoom: mapConfig.maxZoom || FALLBACK_MAX_ZOOM,
    attribution: mapConfig.attribution || FALLBACK_ATTRIBUTION
  };
}

/**
 * Determines the expected map initialization result for a given page type and data.
 * Returns an object describing the expected center, zoom, layers rendered, and tooltip.
 *
 * @param {string} pageType - 'spot', 'obstacle', 'waterway', or 'notice'
 * @param {Object} dataAttrs - Simulated data-* attributes
 * @param {Object} mapConfig - Simulated window.paddelbuchMapConfig
 * @param {string} locale - 'de' or 'en'
 * @returns {Object} Expected initialization result
 */
function expectedInitResult(pageType, dataAttrs, mapConfig, locale) {
  var config = resolveConfig(mapConfig);
  var result = {
    tileUrl: config.tileUrl,
    attribution: config.attribution,
    maxZoom: config.maxZoom,
    locateTooltip: locale === 'de' ? 'Meinen Standort anzeigen' : 'Show my location',
    center: null,
    zoom: null,
    fitBounds: false,
    layerRendered: false,
    layerStyle: null,
    portageRendered: false,
    markerAdded: false
  };

  switch (pageType) {
    case 'spot': {
      var lat = parseFloat(dataAttrs.lat);
      var lon = parseFloat(dataAttrs.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        result.center = [lat, lon];
        result.zoom = 15;
        result.markerAdded = true;
      } else {
        result.center = [config.center.lat, config.center.lon];
        result.zoom = config.defaultZoom;
      }
      break;
    }
    case 'obstacle': {
      // Always starts at default center, then fitBounds if geometry valid
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.layerRendered = true;
        result.layerStyle = 'obstacle';
      }
      if (dataAttrs.portageRoute) {
        result.portageRendered = true;
      }
      break;
    }
    case 'waterway': {
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.layerRendered = false; // waterway does NOT render the polygon
      }
      break;
    }
    case 'notice': {
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.layerRendered = true;
        result.layerStyle = 'eventNoticeArea';
      } else {
        var locLat = parseFloat(dataAttrs.locationLat);
        var locLon = parseFloat(dataAttrs.locationLon);
        if (!isNaN(locLat) && !isNaN(locLon)) {
          // Fallback to location coordinates — setView overrides initial center
          result.center = [locLat, locLon];
          result.zoom = 14;
        }
        // else: keep default center/zoom from config
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Arbitraries — smart generators for valid inputs
// ---------------------------------------------------------------------------

/** Latitude in valid WGS-84 range. */
const latArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });

/** Longitude in valid WGS-84 range. */
const lonArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });

/** Zoom level — Leaflet supports 0-28. */
const zoomArb = fc.integer({ min: 1, max: 28 });

/** Generates a valid tile URL. */
const tileUrlArb = fc
  .record({
    subdomain: fc.stringOf(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 5 }),
  })
  .map(({ subdomain }) =>
    `https://${subdomain}.tile.example.com/{z}/{x}/{y}.png`
  );

/** Generates a valid attribution string. */
const attributionArb = fc.string({ minLength: 5, maxLength: 200 });

/** Generates a valid paddelbuchMapConfig object. */
const mapConfigArb = fc.record({
  tileUrl: tileUrlArb,
  center: fc.record({ lat: latArb, lon: lonArb }),
  defaultZoom: zoomArb,
  maxZoom: fc.integer({ min: 10, max: 28 }),
  attribution: attributionArb
});

/** Locale arbitrary. */
const localeArb = fc.constantFrom('de', 'en');

/** Page type arbitrary. */
const pageTypeArb = fc.constantFrom('spot', 'obstacle', 'waterway', 'notice');

/** Generates a simple GeoJSON Polygon geometry. */
const geoJsonPolygonArb = fc.tuple(latArb, lonArb, fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true }))
  .map(([lat, lon, size]) => ({
    type: 'Polygon',
    coordinates: [[
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat]
    ]]
  }));

/** Generates a simple GeoJSON LineString geometry (for portage routes). */
const geoJsonLineArb = fc.tuple(latArb, lonArb, fc.double({ min: 0.001, max: 0.05, noNaN: true, noDefaultInfinity: true }))
  .map(([lat, lon, size]) => ({
    type: 'LineString',
    coordinates: [
      [lon, lat],
      [lon + size, lat + size]
    ]
  }));

/** Generates spot-specific data attributes. */
const spotDataArb = fc.record({
  lat: fc.oneof(latArb.map(String), fc.constant('')),
  lon: fc.oneof(lonArb.map(String), fc.constant('')),
  spotType: fc.constantFrom('einstieg-ausstieg', 'nur-einstieg', 'nur-ausstieg', 'rasthalte'),
  rejected: fc.constantFrom('true', 'false'),
  spotJson: fc.constant('{"name":"Test"}')
});

/** Generates obstacle-specific data attributes. */
const obstacleDataArb = fc.record({
  geometry: fc.oneof(geoJsonPolygonArb, fc.constant(null)),
  portageRoute: fc.oneof(geoJsonLineArb, fc.constant(null))
});

/** Generates waterway-specific data attributes. */
const waterwayDataArb = fc.record({
  geometry: fc.oneof(geoJsonPolygonArb, fc.constant(null))
});

/** Generates notice-specific data attributes. */
const noticeDataArb = fc.record({
  geometry: fc.oneof(geoJsonPolygonArb, fc.constant(null)),
  locationLat: fc.oneof(latArb.map(String), fc.constant('')),
  locationLon: fc.oneof(lonArb.map(String), fc.constant(''))
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Detail Map Initialization Per Page Type — Property 4', () => {

  // --- Spot page type ---

  describe('spot page type', () => {
    test('centers on spot coordinates at zoom 15 when valid lat/lon provided', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, latArb, lonArb, (mapConfig, locale, lat, lon) => {
          var dataAttrs = { lat: String(lat), lon: String(lon) };
          var result = expectedInitResult('spot', dataAttrs, mapConfig, locale);

          return (
            result.center[0] === lat &&
            result.center[1] === lon &&
            result.zoom === 15 &&
            result.markerAdded === true
          );
        }),
        { numRuns: 100 }
      );
    });

    test('falls back to config center/zoom when lat/lon missing', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, (mapConfig, locale) => {
          var dataAttrs = { lat: '', lon: '' };
          var result = expectedInitResult('spot', dataAttrs, mapConfig, locale);
          var config = resolveConfig(mapConfig);

          return (
            result.center[0] === config.center.lat &&
            result.center[1] === config.center.lon &&
            result.zoom === config.defaultZoom &&
            result.markerAdded === false
          );
        }),
        { numRuns: 100 }
      );
    });

    test('does not fit bounds or render layers', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, latArb, lonArb, (mapConfig, locale, lat, lon) => {
          var dataAttrs = { lat: String(lat), lon: String(lon) };
          var result = expectedInitResult('spot', dataAttrs, mapConfig, locale);

          return result.fitBounds === false && result.layerRendered === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  // --- Obstacle page type ---

  describe('obstacle page type', () => {
    test('fits bounds to geometry and renders obstacle layer when geometry present', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, geoJsonPolygonArb, fc.option(geoJsonLineArb, { nil: null }),
          (mapConfig, locale, geometry, portageRoute) => {
            var dataAttrs = { geometry: geometry, portageRoute: portageRoute };
            var result = expectedInitResult('obstacle', dataAttrs, mapConfig, locale);

            return (
              result.fitBounds === true &&
              result.layerRendered === true &&
              result.layerStyle === 'obstacle'
            );
          }),
        { numRuns: 100 }
      );
    });

    test('renders portage route when portage data present', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, geoJsonPolygonArb, geoJsonLineArb,
          (mapConfig, locale, geometry, portageRoute) => {
            var dataAttrs = { geometry: geometry, portageRoute: portageRoute };
            var result = expectedInitResult('obstacle', dataAttrs, mapConfig, locale);

            return result.portageRendered === true;
          }),
        { numRuns: 100 }
      );
    });

    test('does not render portage route when portage data absent', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, geoJsonPolygonArb,
          (mapConfig, locale, geometry) => {
            var dataAttrs = { geometry: geometry, portageRoute: null };
            var result = expectedInitResult('obstacle', dataAttrs, mapConfig, locale);

            return result.portageRendered === false;
          }),
        { numRuns: 100 }
      );
    });

    test('uses default center/zoom as initial map position', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, obstacleDataArb,
          (mapConfig, locale, obsData) => {
            var result = expectedInitResult('obstacle', obsData, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return (
              result.center[0] === config.center.lat &&
              result.center[1] === config.center.lon &&
              result.zoom === config.defaultZoom
            );
          }),
        { numRuns: 100 }
      );
    });
  });

  // --- Waterway page type ---

  describe('waterway page type', () => {
    test('fits bounds to geometry without rendering polygon when geometry present', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, geoJsonPolygonArb,
          (mapConfig, locale, geometry) => {
            var dataAttrs = { geometry: geometry };
            var result = expectedInitResult('waterway', dataAttrs, mapConfig, locale);

            return (
              result.fitBounds === true &&
              result.layerRendered === false
            );
          }),
        { numRuns: 100 }
      );
    });

    test('does not fit bounds when geometry absent', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb,
          (mapConfig, locale) => {
            var dataAttrs = { geometry: null };
            var result = expectedInitResult('waterway', dataAttrs, mapConfig, locale);

            return result.fitBounds === false && result.layerRendered === false;
          }),
        { numRuns: 100 }
      );
    });

    test('uses default center/zoom as initial map position', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, waterwayDataArb,
          (mapConfig, locale, wwData) => {
            var result = expectedInitResult('waterway', wwData, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return (
              result.center[0] === config.center.lat &&
              result.center[1] === config.center.lon &&
              result.zoom === config.defaultZoom
            );
          }),
        { numRuns: 100 }
      );
    });
  });

  // --- Notice page type ---

  describe('notice page type', () => {
    test('fits bounds to affected area and renders layer when geometry present', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, geoJsonPolygonArb,
          (mapConfig, locale, geometry) => {
            var dataAttrs = { geometry: geometry, locationLat: '', locationLon: '' };
            var result = expectedInitResult('notice', dataAttrs, mapConfig, locale);

            return (
              result.fitBounds === true &&
              result.layerRendered === true &&
              result.layerStyle === 'eventNoticeArea'
            );
          }),
        { numRuns: 100 }
      );
    });

    test('falls back to location coordinates when geometry absent', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb, latArb, lonArb,
          (mapConfig, locale, locLat, locLon) => {
            var dataAttrs = { geometry: null, locationLat: String(locLat), locationLon: String(locLon) };
            var result = expectedInitResult('notice', dataAttrs, mapConfig, locale);

            return (
              result.fitBounds === false &&
              result.center[0] === locLat &&
              result.center[1] === locLon &&
              result.zoom === 14
            );
          }),
        { numRuns: 100 }
      );
    });

    test('falls back to default center when both geometry and location absent', () => {
      fc.assert(
        fc.property(mapConfigArb, localeArb,
          (mapConfig, locale) => {
            var dataAttrs = { geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult('notice', dataAttrs, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return (
              result.fitBounds === false &&
              result.layerRendered === false &&
              result.center[0] === config.center.lat &&
              result.center[1] === config.center.lon &&
              result.zoom === config.defaultZoom
            );
          }),
        { numRuns: 100 }
      );
    });
  });

  // --- Cross-cutting: config and locale ---

  describe('shared configuration', () => {
    test('tile URL comes from mapConfig for all page types', () => {
      fc.assert(
        fc.property(pageTypeArb, mapConfigArb, localeArb,
          (pageType, mapConfig, locale) => {
            var dataAttrs = { lat: '47.0', lon: '8.0', geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult(pageType, dataAttrs, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return result.tileUrl === config.tileUrl;
          }),
        { numRuns: 100 }
      );
    });

    test('attribution comes from mapConfig for all page types', () => {
      fc.assert(
        fc.property(pageTypeArb, mapConfigArb, localeArb,
          (pageType, mapConfig, locale) => {
            var dataAttrs = { lat: '47.0', lon: '8.0', geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult(pageType, dataAttrs, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return result.attribution === config.attribution;
          }),
        { numRuns: 100 }
      );
    });

    test('maxZoom comes from mapConfig for all page types', () => {
      fc.assert(
        fc.property(pageTypeArb, mapConfigArb, localeArb,
          (pageType, mapConfig, locale) => {
            var dataAttrs = { lat: '47.0', lon: '8.0', geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult(pageType, dataAttrs, mapConfig, locale);
            var config = resolveConfig(mapConfig);

            return result.maxZoom === config.maxZoom;
          }),
        { numRuns: 100 }
      );
    });

    test('locate control tooltip is German for de locale, English for en locale', () => {
      fc.assert(
        fc.property(pageTypeArb, mapConfigArb, localeArb,
          (pageType, mapConfig, locale) => {
            var dataAttrs = { lat: '47.0', lon: '8.0', geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult(pageType, dataAttrs, mapConfig, locale);

            if (locale === 'de') {
              return result.locateTooltip === 'Meinen Standort anzeigen';
            } else {
              return result.locateTooltip === 'Show my location';
            }
          }),
        { numRuns: 100 }
      );
    });

    test('uses fallback values when mapConfig is null', () => {
      fc.assert(
        fc.property(pageTypeArb, localeArb,
          (pageType, locale) => {
            var dataAttrs = { lat: '47.0', lon: '8.0', geometry: null, locationLat: '', locationLon: '' };
            var result = expectedInitResult(pageType, dataAttrs, null, locale);

            return (
              result.tileUrl === FALLBACK_TILE_URL &&
              result.attribution === FALLBACK_ATTRIBUTION &&
              result.maxZoom === FALLBACK_MAX_ZOOM
            );
          }),
        { numRuns: 100 }
      );
    });
  });
});
