/**
 * Detail Map Initialization Module
 *
 * Unified map initialization for all four detail page types:
 * spot, obstacle, waterway, and notice.
 *
 * Reads configuration from:
 * - window.paddelbuchMapConfig for tile URL, center, zoom, attribution
 * - data-* attributes on the map container element for page-specific values
 *
 * Sets: window.paddelbuchMap
 *
 * Requirements: 4.1, 4.4, 4.5, 4.10, 4.11, 4.12, 4.13, 4.14, 6.1, 6.2, 6.4, 6.5
 */

(function() {
  'use strict';

  // Hardcoded fallbacks if MapConfig is unavailable
  var FALLBACK_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var FALLBACK_CENTER = { lat: 46.801111, lon: 8.226667 };
  var FALLBACK_ZOOM = 8;
  var FALLBACK_MAX_ZOOM = 18;
  var FALLBACK_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  /**
   * Reads site-level config from window.paddelbuchMapConfig with fallbacks.
   * @returns {Object} Config object with tileUrl, center, defaultZoom, maxZoom, attribution
   */
  function getConfig() {
    var cfg = window.paddelbuchMapConfig;
    if (!cfg) {
      console.warn('[detail-map] window.paddelbuchMapConfig not available, using fallback values');
      return {
        tileUrl: FALLBACK_TILE_URL,
        center: FALLBACK_CENTER,
        defaultZoom: FALLBACK_ZOOM,
        maxZoom: FALLBACK_MAX_ZOOM,
        attribution: FALLBACK_ATTRIBUTION
      };
    }
    return {
      tileUrl: cfg.tileUrl || FALLBACK_TILE_URL,
      center: cfg.center || FALLBACK_CENTER,
      defaultZoom: cfg.defaultZoom || FALLBACK_ZOOM,
      maxZoom: cfg.maxZoom || FALLBACK_MAX_ZOOM,
      attribution: cfg.attribution || FALLBACK_ATTRIBUTION
    };
  }


  /**
   * Safely parses a JSON string from a data attribute.
   * @param {string} jsonStr - The JSON string to parse
   * @param {string} attrName - The attribute name (for logging)
   * @returns {Object|null} Parsed object or null on failure
   */
  function parseJsonAttr(jsonStr, attrName) {
    if (!jsonStr) return null;
    try {
      var data = (typeof jsonStr === 'string') ? JSON.parse(jsonStr) : jsonStr;
      return data;
    } catch (e) {
      console.warn('[detail-map] Failed to parse ' + attrName + ':', e);
      return null;
    }
  }

  /**
   * Parses geometry data — handles both string and object forms.
   * @param {*} geometryData - Raw geometry data (string or object)
   * @param {string} label - Label for warning messages
   * @returns {Object|null} Parsed GeoJSON geometry or null
   */
  function parseGeometry(geometryData, label) {
    if (!geometryData) return null;
    if (typeof geometryData === 'string') {
      try {
        return JSON.parse(geometryData);
      } catch (e) {
        console.error('[detail-map] Failed to parse ' + label + ' geometry:', e);
        return null;
      }
    }
    return geometryData;
  }

  /**
   * Creates the shared map instance with tile layer, zoom control, and locate control.
   * @param {string} containerId - The map container element ID
   * @param {number} centerLat - Initial center latitude
   * @param {number} centerLon - Initial center longitude
   * @param {number} zoom - Initial zoom level
   * @param {Object} config - Site-level config from getConfig()
   * @param {string} locale - Current locale ('de' or 'en')
   * @returns {L.Map} The Leaflet map instance
   */
  function createMap(containerId, centerLat, centerLon, zoom, config, locale) {
    var map = L.map(containerId, {
      center: [centerLat, centerLon],
      zoom: zoom,
      zoomControl: true
    });

    L.tileLayer(config.tileUrl, {
      attribution: config.attribution,
      maxZoom: config.maxZoom
    }).addTo(map);

    map.zoomControl.setPosition('bottomright');

    L.control.locate({
      position: 'bottomright',
      strings: {
        title: locale === 'de' ? 'Meinen Standort anzeigen' : 'Show my location'
      },
      locateOptions: {
        enableHighAccuracy: true,
        maxZoom: 14
      },
      flyTo: true,
      showCompass: true,
      showPopup: false,
      drawCircle: true,
      drawMarker: true,
      markerStyle: {
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.8
      },
      circleStyle: {
        weight: 1,
        clickable: false
      },
      icon: 'leaflet-control-locate-location-arrow',
      iconLoading: 'leaflet-control-locate-spinner',
      onLocationError: function(err) {
        console.warn('Location error:', err.message);
      }
    }).addTo(map);

    return map;
  }

  /**
   * Initializes the map for a spot detail page.
   * Centers on spot coordinates at zoom 15, adds marker with popup.
   */
  function initSpot(container, config, locale) {
    var lat = parseFloat(container.getAttribute('data-lat'));
    var lon = parseFloat(container.getAttribute('data-lon'));

    if (isNaN(lat) || isNaN(lon)) {
      console.warn('[detail-map] Spot page missing valid data-lat/data-lon, using default center');
      var map = createMap(container.id, config.center.lat, config.center.lon, config.defaultZoom, config, locale);
      return map;
    }

    var map = createMap(container.id, lat, lon, 15, config, locale);

    // Add spot marker
    var spotType = container.getAttribute('data-spot-type') || '';
    var isRejected = container.getAttribute('data-rejected') === 'true';

    if (window.PaddelbuchMarkerStyles) {
      var markerIcon = window.PaddelbuchMarkerStyles.getSpotIcon(spotType, isRejected);
      var marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);

      // Build popup from spot JSON data
      var spotJsonStr = container.getAttribute('data-spot-json');
      var spotData = parseJsonAttr(spotJsonStr, 'data-spot-json');

      if (spotData) {
        var popupHtml;
        if (window.PaddelbuchSpotPopup) {
          if (isRejected) {
            popupHtml = window.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spotData, locale);
          } else {
            popupHtml = window.PaddelbuchSpotPopup.generateSpotPopupContent(spotData, locale);
          }
        } else {
          popupHtml = '<strong>' + (spotData.name || '') + '</strong>';
        }
        marker.bindPopup(popupHtml, { maxWidth: 350 });
      }
    }

    return map;
  }

  /**
   * Initializes the map for an obstacle detail page.
   * Fits bounds to obstacle geometry polygon, renders with obstacle styling,
   * optionally renders portage route.
   */
  function initObstacle(container, config, locale) {
    var map = createMap(container.id, config.center.lat, config.center.lon, config.defaultZoom, config, locale);

    var geometryStr = container.getAttribute('data-geometry');
    var geometry = parseGeometry(geometryStr, 'obstacle');

    if (geometry && window.PaddelbuchLayerStyles) {
      var obstacleLayer = L.geoJSON(geometry, {
        style: window.PaddelbuchLayerStyles.getLayerStyle('obstacle')
      }).addTo(map);

      var bounds = obstacleLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    // Render portage route if present
    var portageStr = container.getAttribute('data-portage-route');
    var portageRoute = parseGeometry(portageStr, 'portage route');

    if (portageRoute && window.PaddelbuchLayerStyles) {
      L.geoJSON(portageRoute, {
        style: window.PaddelbuchLayerStyles.getLayerStyle('portageRoute')
      }).addTo(map);
    }

    return map;
  }

  /**
   * Initializes the map for a waterway detail page.
   * Fits bounds to waterway geometry without rendering the polygon.
   */
  function initWaterway(container, config, locale) {
    var map = createMap(container.id, config.center.lat, config.center.lon, config.defaultZoom, config, locale);

    var geometryStr = container.getAttribute('data-geometry');
    var geometry = parseGeometry(geometryStr, 'waterway');

    if (geometry) {
      var tempLayer = L.geoJSON(geometry);
      var bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }

    return map;
  }

  /**
   * Initializes the map for a notice detail page.
   * Fits bounds to affected area polygon with event notice styling,
   * falls back to location coordinates, then to default center.
   */
  function initNotice(container, config, locale) {
    var map = createMap(container.id, config.center.lat, config.center.lon, config.defaultZoom, config, locale);

    var geometryStr = container.getAttribute('data-geometry');
    var geometry = parseGeometry(geometryStr, 'notice affected area');

    if (geometry && window.PaddelbuchLayerStyles) {
      // Render affected area polygon
      var affectedAreaLayer = L.geoJSON(geometry, {
        style: window.PaddelbuchLayerStyles.getLayerStyle('eventNoticeArea')
      }).addTo(map);

      var bounds = affectedAreaLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      // Fallback: try location coordinates
      var locationLat = parseFloat(container.getAttribute('data-location-lat'));
      var locationLon = parseFloat(container.getAttribute('data-location-lon'));

      if (!isNaN(locationLat) && !isNaN(locationLon)) {
        map.setView([locationLat, locationLon], 14);
      }
      // else: keep default center/zoom from MapConfig
    }

    return map;
  }

  /**
   * Main initialization — runs on DOMContentLoaded.
   */
  function init() {
    var container = document.querySelector('[data-page-type]');
    if (!container) {
      console.warn('[detail-map] No element with data-page-type found, skipping map init');
      return;
    }

    var pageType = container.getAttribute('data-page-type');
    var locale = container.getAttribute('data-locale') || 'de';
    var config = getConfig();
    var map;

    switch (pageType) {
      case 'spot':
        map = initSpot(container, config, locale);
        break;
      case 'obstacle':
        map = initObstacle(container, config, locale);
        break;
      case 'waterway':
        map = initWaterway(container, config, locale);
        break;
      case 'notice':
        map = initNotice(container, config, locale);
        break;
      default:
        console.warn('[detail-map] Unknown page type: ' + pageType);
        return;
    }

    if (map) {
      window.paddelbuchMap = map;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
