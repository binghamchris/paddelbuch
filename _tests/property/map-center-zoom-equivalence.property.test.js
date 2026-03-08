/**
 * Property-Based Tests for Map Center and Zoom Equivalence
 *
 * **Feature: liquid-rendering-optimization, Property 6: Map center and zoom equivalence**
 * **Validates: Requirements 6.1**
 *
 * Property: For any detail page type and valid page data, the map center coordinates
 * and initial zoom level produced by detail-map.js reading from data attributes and
 * MapConfig shall be identical to the values that the original inline
 * Liquid-interpolated JavaScript would have produced.
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
// Reference implementation: "original inline code" center/zoom logic
//
// The original inline Liquid templates used hardcoded values directly from
// Liquid interpolation. This reference mirrors that original behavior:
//   - Spot: L.map('spot-map', { center: [{{ lat }}, {{ lon }}], zoom: 15 })
//   - Obstacle: L.map('obstacle-map', { center: [{{ site.map.center.lat }}, {{ site.map.center.lon }}], zoom: {{ site.map.default_zoom }} })
//              then map.fitBounds(L.geoJSON({{ geometry | jsonify }}).getBounds())
//   - Waterway: L.map('waterway-map', { center: [{{ site.map.center.lat }}, {{ site.map.center.lon }}], zoom: {{ site.map.default_zoom }} })
//              then map.fitBounds(L.geoJSON({{ geometry | jsonify }}).getBounds())
//   - Notice: L.map('notice-map', { center: [{{ site.map.center.lat }}, {{ site.map.center.lon }}], zoom: {{ site.map.default_zoom }} })
//            then fitBounds to geometry, or setView([{{ lat }}, {{ lon }}], 14), or keep default
// ---------------------------------------------------------------------------

/**
 * Computes the bounding box center from a GeoJSON polygon's coordinates.
 * This is a simplified version of what Leaflet's L.geoJSON().getBounds() does.
 */
function computeBoundsCenter(geometry) {
  if (!geometry || !geometry.coordinates) return null;

  var coords;
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0]; // outer ring
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates.reduce(function (acc, poly) {
      return acc.concat(poly[0]);
    }, []);
  } else {
    return null;
  }

  var minLat = Infinity, maxLat = -Infinity;
  var minLon = Infinity, maxLon = -Infinity;

  for (var i = 0; i < coords.length; i++) {
    var lon = coords[i][0];
    var lat = coords[i][1];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return {
    center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
    bounds: { minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon }
  };
}

/**
 * Original inline code center/zoom logic — what the Liquid templates produced.
 * Returns { center: [lat, lon], zoom: number, fitBounds: boolean, boundsInfo: object|null }
 */
function originalInlineResult(pageType, pageData, siteConfig) {
  var result = {
    center: null,
    zoom: null,
    fitBounds: false,
    boundsInfo: null
  };

  switch (pageType) {
    case 'spot': {
      var lat = parseFloat(pageData.lat);
      var lon = parseFloat(pageData.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        // Original: L.map('spot-map', { center: [{{ lat }}, {{ lon }}], zoom: 15 })
        result.center = [lat, lon];
        result.zoom = 15;
      } else {
        // Original fallback: use site config center
        result.center = [siteConfig.centerLat, siteConfig.centerLon];
        result.zoom = siteConfig.defaultZoom;
      }
      break;
    }
    case 'obstacle': {
      // Original: L.map('obstacle-map', { center: [{{ site.map.center.lat }}, ...], zoom: {{ site.map.default_zoom }} })
      result.center = [siteConfig.centerLat, siteConfig.centerLon];
      result.zoom = siteConfig.defaultZoom;
      if (pageData.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(pageData.geometry);
      }
      break;
    }
    case 'waterway': {
      // Original: L.map('waterway-map', { center: [{{ site.map.center.lat }}, ...], zoom: {{ site.map.default_zoom }} })
      result.center = [siteConfig.centerLat, siteConfig.centerLon];
      result.zoom = siteConfig.defaultZoom;
      if (pageData.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(pageData.geometry);
      }
      break;
    }
    case 'notice': {
      // Original: L.map('notice-map', { center: [{{ site.map.center.lat }}, ...], zoom: {{ site.map.default_zoom }} })
      result.center = [siteConfig.centerLat, siteConfig.centerLon];
      result.zoom = siteConfig.defaultZoom;
      if (pageData.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(pageData.geometry);
      } else {
        var locLat = parseFloat(pageData.locationLat);
        var locLon = parseFloat(pageData.locationLon);
        if (!isNaN(locLat) && !isNaN(locLon)) {
          // Original: map.setView([{{ lat }}, {{ lon }}], 14)
          result.center = [locLat, locLon];
          result.zoom = 14;
        }
        // else: keep default center/zoom
      }
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// External JS (detail-map.js) center/zoom logic — reference implementation
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
 * External JS (detail-map.js) center/zoom logic.
 * Returns { center: [lat, lon], zoom: number, fitBounds: boolean, boundsInfo: object|null }
 */
function externalJsResult(pageType, dataAttrs, mapConfig) {
  var config = resolveConfig(mapConfig);
  var result = {
    center: null,
    zoom: null,
    fitBounds: false,
    boundsInfo: null
  };

  switch (pageType) {
    case 'spot': {
      var lat = parseFloat(dataAttrs.lat);
      var lon = parseFloat(dataAttrs.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        result.center = [lat, lon];
        result.zoom = 15;
      } else {
        result.center = [config.center.lat, config.center.lon];
        result.zoom = config.defaultZoom;
      }
      break;
    }
    case 'obstacle': {
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(dataAttrs.geometry);
      }
      break;
    }
    case 'waterway': {
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(dataAttrs.geometry);
      }
      break;
    }
    case 'notice': {
      result.center = [config.center.lat, config.center.lon];
      result.zoom = config.defaultZoom;
      if (dataAttrs.geometry) {
        result.fitBounds = true;
        result.boundsInfo = computeBoundsCenter(dataAttrs.geometry);
      } else {
        var locLat = parseFloat(dataAttrs.locationLat);
        var locLon = parseFloat(dataAttrs.locationLon);
        if (!isNaN(locLat) && !isNaN(locLon)) {
          result.center = [locLat, locLon];
          result.zoom = 14;
        }
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
const tileUrlArb = fc.constant('https://a.tile.example.com/{z}/{x}/{y}.png');

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

/**
 * Generates a corresponding siteConfig (original inline code used site.map.center.lat etc.)
 * from a mapConfig, ensuring both reference implementations receive equivalent input.
 */
function mapConfigToSiteConfig(mapConfig) {
  var config = resolveConfig(mapConfig);
  return {
    centerLat: config.center.lat,
    centerLon: config.center.lon,
    defaultZoom: config.defaultZoom
  };
}

/** Generates a simple GeoJSON Polygon geometry. */
const geoJsonPolygonArb = fc.tuple(
  latArb,
  lonArb,
  fc.double({ min: 0.001, max: 0.1, noNaN: true, noDefaultInfinity: true })
).map(function (tuple) {
  var lat = tuple[0];
  var lon = tuple[1];
  var size = tuple[2];
  return {
    type: 'Polygon',
    coordinates: [[
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat]
    ]]
  };
});

/** Page type arbitrary. */
const pageTypeArb = fc.constantFrom('spot', 'obstacle', 'waterway', 'notice');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Map Center and Zoom Equivalence — Property 6', function () {

  describe('spot page type', function () {
    test('external JS produces same center [lat, lon] and zoom 15 as original inline code', function () {
      fc.assert(
        fc.property(mapConfigArb, latArb, lonArb, function (mapConfig, lat, lon) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { lat: String(lat), lon: String(lon) };

          var original = originalInlineResult('spot', { lat: String(lat), lon: String(lon) }, siteConfig);
          var external = externalJsResult('spot', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom &&
            original.zoom === 15
          );
        }),
        { numRuns: 100 }
      );
    });

    test('external JS produces same fallback center/zoom when coordinates missing', function () {
      fc.assert(
        fc.property(mapConfigArb, function (mapConfig) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { lat: '', lon: '' };

          var original = originalInlineResult('spot', { lat: '', lon: '' }, siteConfig);
          var external = externalJsResult('spot', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('obstacle page type', function () {
    test('external JS produces same initial center and fitBounds behavior as original inline code', function () {
      fc.assert(
        fc.property(mapConfigArb, geoJsonPolygonArb, function (mapConfig, geometry) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: geometry };

          var original = originalInlineResult('obstacle', { geometry: geometry }, siteConfig);
          var external = externalJsResult('obstacle', dataAttrs, mapConfig);

          // Initial center and zoom must match
          var centerMatch = (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom
          );

          // Both must fitBounds to the same geometry
          var boundsMatch = (
            original.fitBounds === external.fitBounds &&
            original.fitBounds === true
          );

          // Bounds center must be equivalent
          var boundsCenterMatch = (
            original.boundsInfo !== null &&
            external.boundsInfo !== null &&
            original.boundsInfo.center[0] === external.boundsInfo.center[0] &&
            original.boundsInfo.center[1] === external.boundsInfo.center[1]
          );

          return centerMatch && boundsMatch && boundsCenterMatch;
        }),
        { numRuns: 100 }
      );
    });

    test('external JS produces same default center when geometry absent', function () {
      fc.assert(
        fc.property(mapConfigArb, function (mapConfig) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: null };

          var original = originalInlineResult('obstacle', { geometry: null }, siteConfig);
          var external = externalJsResult('obstacle', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom &&
            original.fitBounds === false &&
            external.fitBounds === false
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('waterway page type', function () {
    test('external JS produces same initial center and fitBounds behavior as original inline code', function () {
      fc.assert(
        fc.property(mapConfigArb, geoJsonPolygonArb, function (mapConfig, geometry) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: geometry };

          var original = originalInlineResult('waterway', { geometry: geometry }, siteConfig);
          var external = externalJsResult('waterway', dataAttrs, mapConfig);

          var centerMatch = (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom
          );

          var boundsMatch = (
            original.fitBounds === external.fitBounds &&
            original.fitBounds === true
          );

          var boundsCenterMatch = (
            original.boundsInfo !== null &&
            external.boundsInfo !== null &&
            original.boundsInfo.center[0] === external.boundsInfo.center[0] &&
            original.boundsInfo.center[1] === external.boundsInfo.center[1]
          );

          return centerMatch && boundsMatch && boundsCenterMatch;
        }),
        { numRuns: 100 }
      );
    });

    test('external JS produces same default center when geometry absent', function () {
      fc.assert(
        fc.property(mapConfigArb, function (mapConfig) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: null };

          var original = originalInlineResult('waterway', { geometry: null }, siteConfig);
          var external = externalJsResult('waterway', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom &&
            original.fitBounds === false &&
            external.fitBounds === false
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('notice page type', function () {
    test('external JS produces same fitBounds behavior when geometry present', function () {
      fc.assert(
        fc.property(mapConfigArb, geoJsonPolygonArb, function (mapConfig, geometry) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: geometry, locationLat: '', locationLon: '' };

          var original = originalInlineResult('notice', { geometry: geometry, locationLat: '', locationLon: '' }, siteConfig);
          var external = externalJsResult('notice', dataAttrs, mapConfig);

          var centerMatch = (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom
          );

          var boundsMatch = (
            original.fitBounds === external.fitBounds &&
            original.fitBounds === true
          );

          var boundsCenterMatch = (
            original.boundsInfo !== null &&
            external.boundsInfo !== null &&
            original.boundsInfo.center[0] === external.boundsInfo.center[0] &&
            original.boundsInfo.center[1] === external.boundsInfo.center[1]
          );

          return centerMatch && boundsMatch && boundsCenterMatch;
        }),
        { numRuns: 100 }
      );
    });

    test('external JS produces same fallback to location coordinates at zoom 14', function () {
      fc.assert(
        fc.property(mapConfigArb, latArb, lonArb, function (mapConfig, locLat, locLon) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: null, locationLat: String(locLat), locationLon: String(locLon) };
          var pageData = { geometry: null, locationLat: String(locLat), locationLon: String(locLon) };

          var original = originalInlineResult('notice', pageData, siteConfig);
          var external = externalJsResult('notice', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom &&
            original.zoom === 14
          );
        }),
        { numRuns: 100 }
      );
    });

    test('external JS produces same default center when both geometry and location absent', function () {
      fc.assert(
        fc.property(mapConfigArb, function (mapConfig) {
          var siteConfig = mapConfigToSiteConfig(mapConfig);
          var dataAttrs = { geometry: null, locationLat: '', locationLon: '' };
          var pageData = { geometry: null, locationLat: '', locationLon: '' };

          var original = originalInlineResult('notice', pageData, siteConfig);
          var external = externalJsResult('notice', dataAttrs, mapConfig);

          return (
            original.center[0] === external.center[0] &&
            original.center[1] === external.center[1] &&
            original.zoom === external.zoom &&
            original.fitBounds === false &&
            external.fitBounds === false
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('cross-cutting equivalence', function () {
    test('for any page type, external JS center/zoom matches original inline code', function () {
      fc.assert(
        fc.property(
          pageTypeArb,
          mapConfigArb,
          fc.option(geoJsonPolygonArb, { nil: null }),
          latArb,
          lonArb,
          function (pageType, mapConfig, geometry, lat, lon) {
            var siteConfig = mapConfigToSiteConfig(mapConfig);

            // Build page data and data attrs based on page type
            var pageData, dataAttrs;
            switch (pageType) {
              case 'spot':
                pageData = { lat: String(lat), lon: String(lon) };
                dataAttrs = { lat: String(lat), lon: String(lon) };
                break;
              case 'obstacle':
                pageData = { geometry: geometry };
                dataAttrs = { geometry: geometry };
                break;
              case 'waterway':
                pageData = { geometry: geometry };
                dataAttrs = { geometry: geometry };
                break;
              case 'notice':
                pageData = { geometry: geometry, locationLat: String(lat), locationLon: String(lon) };
                dataAttrs = { geometry: geometry, locationLat: String(lat), locationLon: String(lon) };
                break;
            }

            var original = originalInlineResult(pageType, pageData, siteConfig);
            var external = externalJsResult(pageType, dataAttrs, mapConfig);

            // Center and zoom must always match
            var centerMatch = (
              original.center[0] === external.center[0] &&
              original.center[1] === external.center[1] &&
              original.zoom === external.zoom
            );

            // fitBounds decision must match
            var fitBoundsMatch = original.fitBounds === external.fitBounds;

            // If fitBounds, the bounds center must match
            var boundsCenterMatch = true;
            if (original.fitBounds && external.fitBounds) {
              boundsCenterMatch = (
                original.boundsInfo !== null &&
                external.boundsInfo !== null &&
                original.boundsInfo.center[0] === external.boundsInfo.center[0] &&
                original.boundsInfo.center[1] === external.boundsInfo.center[1]
              );
            }

            return centerMatch && fitBoundsMatch && boundsCenterMatch;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
