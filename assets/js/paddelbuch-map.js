/**
 * Paddelbuch Map Module
 *
 * Shared map initialization for all detail layouts. Reads configuration from
 * a <script type="application/json" id="map-config"> element, creates the
 * Leaflet map, adds the tile layer, positions the zoom control, and adds the
 * locate control with locale-aware strings.
 *
 * Requirements: R1, R3
 */

(function(global) {
  'use strict';

  /**
   * Initializes a Leaflet map on the given element using configuration from
   * the #map-config JSON script tag.
   *
   * @param {string} elementId - The id of the map container element
   * @returns {L.Map} The initialized Leaflet map instance
   */
  function init(elementId) {
    var configEl = document.getElementById('map-config');
    if (!configEl) {
      throw new Error('PaddelbuchMap: #map-config element not found');
    }

    var config = JSON.parse(configEl.textContent);

    var map = L.map(elementId, {
      center: [config.center.lat, config.center.lon],
      zoom: config.zoom,
      zoomControl: true
    });

    L.tileLayer(config.mapboxUrl, {
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a></strong>',
      maxZoom: config.maxZoom || 18
    }).addTo(map);

    map.zoomControl.setPosition('bottomright');

    // Locate control with locale-aware strings (R3)
    var locale = config.locale || 'de';
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

  global.PaddelbuchMap = {
    init: init
  };

})(typeof window !== 'undefined' ? window : this);
