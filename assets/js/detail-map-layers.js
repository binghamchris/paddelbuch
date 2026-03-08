/**
 * Detail Map Layers Module
 *
 * Loads the full data pipeline (spots, obstacles, protected areas, event notices)
 * onto a detail page map. Reuses the same layer-control, data-loader, and
 * zoom-layer-manager modules as the main map.
 *
 * Reads locale from:
 * 1. window.paddelbuchCurrentLocale (set by layer-control.js)
 * 2. data-locale attribute on the script tag
 * 3. Falls back to 'de'
 *
 * Depends on: window.paddelbuchMap, window.paddelbuchLayerGroups,
 *   PaddelbuchFilterEngine, PaddelbuchFilterPanel, PaddelbuchDataLoader,
 *   PaddelbuchSpatialUtils, PaddelbuchZoomLayerManager
 *
 * Requirements: 2.1, 2.4
 */
(function() {
  'use strict';

  var loadedSlugs = {
    spots: new Set(),
    notices: new Set(),
    obstacles: new Set(),
    protected: new Set()
  };

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
   * Match functions for each dimension key.
   * These cannot be serialized to JSON, so they are attached at runtime.
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
    }
  };

  // Read locale from the script tag's data-locale attribute for fallback
  var scriptTag = document.currentScript;
  var scriptLocale = (scriptTag && scriptTag.getAttribute('data-locale')) || null;

  function initDetailMapData() {
    var map = window.paddelbuchMap;
    var layerGroups = window.paddelbuchLayerGroups;

    if (!map || !layerGroups) {
      setTimeout(initDetailMapData, 100);
      return;
    }

    var locale = window.paddelbuchCurrentLocale || scriptLocale || 'de';

    // Read dimension configs and layer labels from shared config (generated at build time)
    var localeConfig;
    if (window.paddelbuchMapConfig && window.paddelbuchMapConfig[locale]) {
      localeConfig = window.paddelbuchMapConfig[locale];
    } else {
      console.warn('paddelbuchMapConfig not available for locale "' + locale + '", using empty config');
      localeConfig = { dimensions: [], layerLabels: {} };
    }

    // Build dimension configuration array from shared config
    var dimensionConfigs = (localeConfig.dimensions || []).map(function(dim) {
      var config = {
        key: dim.key,
        label: dim.label,
        options: dim.options || []
      };
      // Attach matchFn at runtime (functions cannot be serialized to JSON)
      if (matchFunctions[dim.key]) {
        config.matchFn = matchFunctions[dim.key];
      }
      return config;
    });

    // Read layer labels from shared config
    var layerLabels = localeConfig.layerLabels || {};

    var layerToggles = [
      { key: 'noEntry', label: layerLabels.noEntry || '', layerGroup: layerGroups.noEntry, defaultChecked: false },
      { key: 'eventNotices', label: layerLabels.eventNotices || '', layerGroup: layerGroups.eventNotices, defaultChecked: true },
      { key: 'obstacles', label: layerLabels.obstacles || '', layerGroup: layerGroups.obstacles, defaultChecked: true },
      { key: 'protectedAreas', label: layerLabels.protectedAreas || '', layerGroup: layerGroups.protectedAreas, defaultChecked: true }
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
        console.warn('Detail map data load failed:', err);
      });

    // Load more data on pan/zoom
    map.on('moveend', function() {
      var newBounds = PaddelbuchSpatialUtils.leafletBoundsToObject(map.getBounds());
      var newZoom = map.getZoom();

      PaddelbuchDataLoader.loadDataForBoundsDebounced(newBounds, newZoom, locale, function(err, data) {
        if (err) {
          console.warn('Detail map data load on move failed:', err);
          return;
        }
        populateLayers(data);
      });
    });

    // Zoom-based layer visibility for obstacles/protected areas
    PaddelbuchZoomLayerManager.initZoomLayerManager(map, layerGroups, { locale: locale });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetailMapData);
  } else {
    setTimeout(initDetailMapData, 100);
  }
})();
