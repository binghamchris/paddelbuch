/**
 * Map Data Initialization Module
 *
 * Consolidated data bootstrap logic shared by both the home page (map-init.html)
 * and detail pages (detail-map-layers.html). Reads locale-dependent dimension
 * configs and layer labels from a <script type="application/json" id="map-data-config">
 * element, attaches matchFn functions programmatically, and bootstraps the full
 * data loading pipeline (filter engine, filter panel, tile loading, moveend
 * handler, zoom layer manager).
 *
 * Requirements: 1.6, 1.7, 2.5, 2.6, 3.2, 3.3, 3.5
 */
(function() {
  'use strict';

  // Slug-based deduplication sets to prevent duplicate markers/layers
  var loadedSlugs = {
    spots: new Set(),
    notices: new Set(),
    obstacles: new Set(),
    protected: new Set()
  };

  /**
   * Populate layer groups with data from the data loader response.
   * Skips items whose slug has already been added (deduplication).
   *
   * @param {Object} data - Data object with spots, notices, obstacles, protected arrays
   */
  function populateLayers(data) {
    if (data.spots) {
      data.spots.forEach(function(spot) {
        if (spot.slug && loadedSlugs.spots.has(spot.slug)) return;
        if (spot.slug) loadedSlugs.spots.add(spot.slug);
        window.paddelbuchAddSpotMarker(spot);
      });
    }

    if (data.notices) {
      data.notices.forEach(function(notice) {
        if (notice.slug && loadedSlugs.notices.has(notice.slug)) return;
        if (notice.slug) loadedSlugs.notices.add(notice.slug);
        window.paddelbuchAddEventNoticeMarker(notice);
      });
    }

    if (data.obstacles) {
      data.obstacles.forEach(function(obstacle) {
        if (obstacle.slug && loadedSlugs.obstacles.has(obstacle.slug)) return;
        if (obstacle.slug) loadedSlugs.obstacles.add(obstacle.slug);
        window.paddelbuchAddObstacleLayer(obstacle);
      });
    }

    if (data.protected) {
      data.protected.forEach(function(area) {
        if (area.slug && loadedSlugs.protected.has(area.slug)) return;
        if (area.slug) loadedSlugs.protected.add(area.slug);
        window.paddelbuchAddProtectedAreaLayer(area);
      });
    }
  }

  /**
   * Match function lookup by dimension key.
   * These cannot be serialized to JSON so they are attached programmatically.
   */
  var matchFunctions = {
    spotType: function(meta, selected) {
      return selected.has(meta.spotType_slug);
    },
    paddleCraftType: function(meta, selected) {
      var types = meta.paddleCraftTypes || [];
      for (var i = 0; i < types.length; i++) {
        if (selected.has(types[i])) return true;
      }
      return false;
    },
    spotTipType: function(meta, selected) {
      var tipSlugs = meta.spotTipType_slugs || [];
      if (tipSlugs.length === 0) {
        return selected.has('__no_tips__');
      }
      for (var i = 0; i < tipSlugs.length; i++) {
        if (selected.has(tipSlugs[i])) return true;
      }
      return false;
    }
  };

  /**
   * Wait for map and layer groups to be available, then bootstrap data loading.
   */
  function initMapData() {
    var map = window.paddelbuchMap;
    var layerGroups = window.paddelbuchLayerGroups;

    if (!map || !layerGroups) {
      setTimeout(initMapData, 100);
      return;
    }

    // Read configuration from JSON data element
    var configEl = document.getElementById('map-data-config');
    if (!configEl) {
      console.warn('map-data-init: #map-data-config element not found');
      return;
    }

    var config = JSON.parse(configEl.textContent);
    var locale = config.locale || window.paddelbuchCurrentLocale || 'de';
    var dimensionConfigs = config.dimensionConfigs || [];
    var layerLabels = config.layerLabels || {};

    // Attach matchFn functions programmatically (cannot be serialized in JSON)
    dimensionConfigs.forEach(function(dim) {
      if (matchFunctions[dim.key]) {
        dim.matchFn = matchFunctions[dim.key];
      }
    });

    // Build layer toggle configuration for non-spot layers
    var layerToggles = [
      { key: 'noEntry', label: layerLabels.noEntry, layerGroup: layerGroups.noEntry, defaultChecked: false },
      { key: 'eventNotices', label: layerLabels.eventNotices, layerGroup: layerGroups.eventNotices, defaultChecked: true },
      { key: 'obstacles', label: layerLabels.obstacles, layerGroup: layerGroups.obstacles, defaultChecked: true },
      { key: 'protectedAreas', label: layerLabels.protectedAreas, layerGroup: layerGroups.protectedAreas, defaultChecked: true }
    ];

    // Initialize filter engine and panel
    PaddelbuchFilterEngine.init(dimensionConfigs, map);
    PaddelbuchFilterPanel.init(map, dimensionConfigs, layerToggles);

    // Initial data load for the current viewport
    var bounds = PaddelbuchSpatialUtils.leafletBoundsToObject(map.getBounds());
    var zoom = map.getZoom();

    PaddelbuchDataLoader.loadDataForBounds(bounds, zoom, locale)
      .then(function(data) {
        populateLayers(data);
      })
      .catch(function(err) {
        console.warn('Initial map data load failed:', err);
      });

    // Bind moveend event for subsequent viewport changes (debounced)
    map.on('moveend', function() {
      var newBounds = PaddelbuchSpatialUtils.leafletBoundsToObject(map.getBounds());
      var newZoom = map.getZoom();

      PaddelbuchDataLoader.loadDataForBoundsDebounced(newBounds, newZoom, locale, function(err, data) {
        if (err) {
          console.warn('Map data load on move failed:', err);
          return;
        }
        populateLayers(data);
      });
    });

    // Initialize zoom-based layer manager for obstacle/protected area visibility
    PaddelbuchZoomLayerManager.initZoomLayerManager(map, layerGroups, { locale: locale });
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMapData);
  } else {
    setTimeout(initMapData, 100);
  }
})();
