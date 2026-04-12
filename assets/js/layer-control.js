(function() {
  'use strict';

  // Read configuration from JSON data element
  var configEl = document.getElementById('layer-control-config');
  if (!configEl) {
    console.warn('layer-control-config element not found');
    return;
  }
  var config = JSON.parse(configEl.textContent);
  var currentLocale = config.currentLocale;
  var localePrefix = config.localePrefix;
  var protectedAreaTypeNames = config.protectedAreaTypeNames || {};

  // Wait for map to be initialized
  function initLayerControls() {
    var map = window.paddelbuchMap;
    if (!map) {
      console.warn('Map not initialized yet, retrying...');
      setTimeout(initLayerControls, 100);
      return;
    }

    // Layer groups for non-spot layers (spot markers are now managed individually via Marker Registry)
    var layerGroups = {
      noEntry: L.layerGroup(),        // Rejected/No Entry spots
      eventNotices: L.layerGroup(),   // Waterway event notices
      obstacles: L.layerGroup(),      // Obstacles
      protectedAreas: L.layerGroup()  // Protected areas
    };

    /**
     * Filters data by locale (Requirement 8.3)
     * Only returns items matching the current language locale
     * Uses the PaddelbuchLocaleFilter module if available, otherwise falls back to inline implementation.
     *
     * @param {Array} items - Array of data items to filter
     * @param {string} locale - The locale to filter by
     * @returns {Array} Filtered items matching the locale
     */
    function filterByLocale(items, locale) {
      // Use the locale filter module if available
      if (window.PaddelbuchLocaleFilter && window.PaddelbuchLocaleFilter.filterByLocale) {
        return window.PaddelbuchLocaleFilter.filterByLocale(items, locale);
      }

      // Fallback implementation
      if (!Array.isArray(items)) return [];
      if (!locale) return items;

      return items.filter(function(item) {
        var itemLocale = item.locale || item['locale'];
        // Include items with matching locale, no locale, or wildcard locale
        return itemLocale === undefined || itemLocale === null || itemLocale === locale || itemLocale === '*';
      });
    }

    /**
     * Gets the layer group for a rejected spot.
     * Only used for rejected spots -- non-rejected spots are managed via Marker Registry.
     *
     * @param {Object} spot - The spot object
     * @returns {L.LayerGroup|null} The noEntry layer group if rejected, null otherwise
     */
    function getLayerGroupForSpot(spot) {
      if (spot.rejected === true || spot.rejected === 'true') {
        return layerGroups.noEntry;
      }
      return null;
    }

    /**
     * Binds a click handler that recenters the map on the marker.
     * On the home page (where paddelbuchHomeTargetZoom is set), also zooms
     * to that level unless the map is already at or above it.
     *
     * @param {L.Marker} marker - The Leaflet marker instance
     */
    function bindMarkerRecenter(marker) {
      marker.on('click', function() {
        var latlng = marker.getLatLng();
        var homeZoom = window.paddelbuchHomeTargetZoom;
        if (typeof homeZoom === 'number' && map.getZoom() < homeZoom) {
          map.setView(latlng, homeZoom);
        } else {
          map.panTo(latlng);
        }
      });
    }

    /**
     * Creates a marker for a spot.
     * - Rejected spots: added to the noEntry LayerGroup (not registered in Marker Registry)
     * - Non-rejected spots: registered in PaddelbuchMarkerRegistry with metadata,
     *   then evaluated by PaddelbuchFilterEngine for initial visibility
     *
     * Requirements: 4.1, 6.1, 9.1, 9.2, 9.3
     *
     * @param {Object} spot - The spot data object
     */
    function addSpotMarker(spot) {
      if (!spot.location || (!spot.location.lat && !spot.location.lon)) {
        return;
      }

      var lat = spot.location.lat || spot.location.latitude;
      var lon = spot.location.lon || spot.location.lng || spot.location.longitude;

      if (!lat || !lon) return;

      var isRejected = spot.rejected === true || spot.rejected === 'true';
      var spotTypeSlug = spot.spotType_slug || spot.spotTypeSlug || spot.spot_type_slug;

      // Get the appropriate icon using the marker styles module
      var icon = window.PaddelbuchMarkerStyles
        ? window.PaddelbuchMarkerStyles.getSpotIcon(spotTypeSlug, isRejected)
        : L.Icon.Default.prototype;

      var marker = L.marker([lat, lon], { icon: icon });

      // Add popup content using the spot popup module (Requirements 3.1-3.5)
      if (spot.name) {
        var popupContent;
        if (window.PaddelbuchSpotPopup) {
          if (isRejected) {
            popupContent = window.PaddelbuchSpotPopup.generateRejectedSpotPopupContent(spot, currentLocale);
          } else {
            popupContent = window.PaddelbuchSpotPopup.generateSpotPopupContent(spot, currentLocale);
          }
        } else {
          // Fallback to simple popup if module not loaded
          var escapedSpotSlug = spot.slug ? PaddelbuchHtmlUtils.escapeHtml(spot.slug) : '';
          popupContent = '<div>';
          popupContent += '<strong>' + PaddelbuchHtmlUtils.escapeHtml(spot.name) + '</strong>';
          if (spot.description) {
            var excerpt = spot.description.replace(/<[^>]*>/g, '').substring(0, 150);
            if (spot.description.length > 150) excerpt += '...';
            popupContent += '<p>' + excerpt + '</p>';
          }
          if (spot.location && (spot.location.lat || spot.location.latitude) && (spot.location.lon || spot.location.lng || spot.location.longitude)) {
            var navLat = spot.location.lat || spot.location.latitude;
            var navLon = spot.location.lon || spot.location.lng || spot.location.longitude;
            popupContent += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + navLat + ',' + navLon + '" ' +
              'target="_blank" rel="noopener noreferrer" data-tinylytics-event="popup.navigate" data-tinylytics-event-value="' + escapedSpotSlug + '">' +
              (currentLocale === 'en' ? 'Navigate To' : 'Navigieren zu') + '</a> ';
          }
          if (spot.slug) {
            popupContent += '<a href="' + localePrefix + '/einstiegsorte/' + PaddelbuchHtmlUtils.escapeHtml(spot.slug) + '/" ' +
              'data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedSpotSlug + '">' +
              (currentLocale === 'en' ? 'More details' : 'Weitere Details') + '</a>';
          }
          popupContent += '</div>';
        }
        marker.bindPopup(popupContent, { maxWidth: 350 });
      }

      if (isRejected) {
        // Rejected spots go to the noEntry LayerGroup -- not registered in Marker Registry
        marker.addTo(layerGroups.noEntry);
      } else {
        // Register in marker registry (Requirements 4.1, 9.1, 9.3)
        var metadata = {
          spotType_slug: spotTypeSlug,
          paddleCraftTypes: spot.paddleCraftTypes || [],
          paddlingEnvironmentType_slug: spot.paddlingEnvironmentType_slug || ''
        };
        PaddelbuchMarkerRegistry.register(spot.slug, marker, metadata);

        // Evaluate against current filter state for initial visibility (Requirement 9.2)
        if (PaddelbuchFilterEngine.evaluateMarker(metadata)) {
          marker.addTo(map);
        }
      }

      // Recenter (and optionally zoom on home page) when marker is clicked
      bindMarkerRecenter(marker);

      // Dispatch marker.click beacon event when spot marker is clicked
      marker.on('click', function() {
        if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
          PaddelbuchTinylyticsBeacon.dispatch('marker.click', spot.slug || '');
        }
      });
    }

    /**
     * Adds an obstacle GeoJSON layer to the obstacles layer group (Requirement 5.1)
     * Also renders portage route if available (Requirement 5.2)
     *
     * @param {Object} obstacle - The obstacle data object
     */
    function addObstacleLayer(obstacle) {
      if (!obstacle.geometry) {
        return;
      }

      try {
        var geoJson = typeof obstacle.geometry === 'string'
          ? JSON.parse(obstacle.geometry)
          : obstacle.geometry;

        // Get obstacle style from layer styles module (Requirement 5.1)
        var obstacleStyle = window.PaddelbuchLayerStyles
          ? window.PaddelbuchLayerStyles.obstacleStyle
          : { color: '#c40200', fillColor: '#c40200', fillOpacity: 0.8, weight: 2 };

        // Create obstacle GeoJSON layer
        var obstacleLayer = L.geoJSON(geoJson, { style: obstacleStyle });

        // Generate popup content using the obstacle popup module
        var popupContent;
        if (window.PaddelbuchObstaclePopup) {
          popupContent = window.PaddelbuchObstaclePopup.generateObstaclePopupContent(obstacle, currentLocale);
        } else {
          // Fallback popup content -- matches Gatsby structure
          var escapedObstacleSlug = obstacle.slug ? PaddelbuchHtmlUtils.escapeHtml(obstacle.slug) : '';
          popupContent = '<div>';
          popupContent += '<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(obstacle.name || 'Obstacle') + '</h1></span>';

          // Portage possibility status (Requirement 5.3)
          var portageStatus;
          if (obstacle.isPortagePossible === true || obstacle.isPortagePossible === 'true') {
            portageStatus = currentLocale === 'en' ? 'Yes' : 'Ja';
          } else if (obstacle.isPortagePossible === false || obstacle.isPortagePossible === 'false') {
            portageStatus = currentLocale === 'en' ? 'No' : 'Nein';
          } else {
            portageStatus = currentLocale === 'en' ? 'Unknown' : 'Unbekannt';
          }
          popupContent += '<table><tbody><tr><th>' + (currentLocale === 'en' ? 'Portage possible' : 'Umtragen möglich') + ':</th>';
          popupContent += '<td>' + portageStatus + '</td></tr></tbody></table>';

          if (obstacle.slug) {
            popupContent += '<button class="popup-btn popup-btn-right obstacle-details-btn" data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedObstacleSlug + '">';
            popupContent += '<a class="popup-btn-right" href="' + localePrefix + '/hindernisse/' + PaddelbuchHtmlUtils.escapeHtml(obstacle.slug) + '/">' +
              (currentLocale === 'en' ? 'More details' : 'Weitere Details') + '</a></button>';
          }
          popupContent += '</div>';
        }

        obstacleLayer.bindPopup(popupContent, { maxWidth: 350 });

        // Dispatch marker.click beacon event when obstacle layer is clicked
        obstacleLayer.on('click', function() {
          if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
            PaddelbuchTinylyticsBeacon.dispatch('marker.click', obstacle.slug || '');
          }
        });

        obstacleLayer.addTo(layerGroups.obstacles);
        obstacleLayer.bringToFront();

        // Render portage route if available (Requirement 5.2)
        if (obstacle.portageRoute) {
          try {
            var portageGeoJson = typeof obstacle.portageRoute === 'string'
              ? JSON.parse(obstacle.portageRoute)
              : obstacle.portageRoute;

            // Get portage style from layer styles module
            var portageStyle = window.PaddelbuchLayerStyles
              ? window.PaddelbuchLayerStyles.portageStyle
              : { color: '#4c0561', weight: 4, dashArray: '15 9 1 9' };

            var portageLayer = L.geoJSON(portageGeoJson, { style: portageStyle });

            // Portage route shares the same popup as the obstacle
            portageLayer.bindPopup(popupContent, { maxWidth: 350 });

            // Dispatch marker.click beacon event when portage route layer is clicked
            portageLayer.on('click', function() {
              if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
                PaddelbuchTinylyticsBeacon.dispatch('marker.click', obstacle.slug || '');
              }
            });

            portageLayer.addTo(layerGroups.obstacles);
            portageLayer.bringToFront();
          } catch (e) {
            console.warn('Failed to parse obstacle portage route:', e);
          }
        }
      } catch (e) {
        console.warn('Failed to parse obstacle geometry:', e);
      }
    }

    /**
     * Adds a protected area GeoJSON layer to the protected areas layer group (Requirement 6.1)
     * Displays protected areas as yellow semi-transparent polygons with dashed borders
     *
     * @param {Object} protectedArea - The protected area data object
     */
    function addProtectedAreaLayer(protectedArea) {
      if (!protectedArea.geometry) {
        return;
      }

      try {
        var geoJson = typeof protectedArea.geometry === 'string'
          ? JSON.parse(protectedArea.geometry)
          : protectedArea.geometry;

        // Get protected area style from layer styles module (Requirement 6.1)
        var protectedAreaStyle = window.PaddelbuchLayerStyles
          ? window.PaddelbuchLayerStyles.protectedAreaStyle
          : { color: '#ffb200', fillColor: '#ffb200', fillOpacity: 0.6, weight: 2, dashArray: '1 10' };

        // Create protected area GeoJSON layer
        var protectedAreaLayer = L.geoJSON(geoJson, { style: protectedAreaStyle });

        // Generate popup content (Requirement 6.2)
        var popupContent = '<div class="protected-area-popup">';
        popupContent += '<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(protectedArea.name || (currentLocale === 'en' ? 'Protected Area' : 'Schutzgebiet')) + '</h1></span>';

        // Display protected area type if available
        // Resolve the translated type name from the slug using the lookup map
        var typeName = null;
        if (protectedArea.protectedAreaType_name) {
          typeName = protectedArea.protectedAreaType_name;
        } else if (protectedArea.protectedAreaType && protectedArea.protectedAreaType.name) {
          typeName = protectedArea.protectedAreaType.name;
        } else if (protectedArea.protectedAreaType_slug && Object.prototype.hasOwnProperty.call(protectedAreaTypeNames, protectedArea.protectedAreaType_slug)) {
          typeName = protectedAreaTypeNames[protectedArea.protectedAreaType_slug];
        } else if (protectedArea.protectedAreaType_slug) {
          // Final fallback to slug if no translation found
          typeName = protectedArea.protectedAreaType_slug;
        }

        if (typeName) {
          popupContent += '<p>' + PaddelbuchHtmlUtils.escapeHtml(typeName) + '</p>';
        }

        popupContent += '</div>';

        protectedAreaLayer.bindPopup(popupContent, { maxWidth: 350 });

        // Dispatch marker.click beacon event when protected area layer is clicked
        protectedAreaLayer.on('click', function() {
          if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
            PaddelbuchTinylyticsBeacon.dispatch('marker.click', protectedArea.slug || protectedArea.name || '');
          }
        });

        protectedAreaLayer.addTo(layerGroups.protectedAreas);
        protectedAreaLayer.bringToBack();
      } catch (e) {
        console.warn('Failed to parse protected area geometry:', e);
      }
    }

    /**
     * Creates a marker for an event notice and adds it to the event notices layer
     * Also renders the affected area polygon if available (Property 14: Event Notice Dual Rendering)
     *
     * Requirements: 7.1, 7.2, 7.3
     * Property 13: Event Notice Date Filtering
     * Property 14: Event Notice Dual Rendering
     * Property 15: Event Notice Popup Contains Required Information
     *
     * @param {Object} notice - The event notice data object
     */
    function addEventNoticeMarker(notice) {
      if (!notice.location || (!notice.location.lat && !notice.location.lon)) {
        return;
      }

      var lat = notice.location.lat || notice.location.latitude;
      var lon = notice.location.lon || notice.location.lng || notice.location.longitude;

      if (!lat || !lon) return;

      // Property 13: Event Notice Date Filtering
      // Only display notices where endDate is in the future (Requirement 7.1)
      if (window.PaddelbuchDateUtils) {
        if (!window.PaddelbuchDateUtils.isDateInFuture(notice.endDate)) {
          return; // Skip expired notices
        }
      } else {
        // Fallback date check if module not loaded
        if (notice.endDate) {
          var endDate = new Date(notice.endDate);
          var today = new Date();
          today.setHours(0, 0, 0, 0);
          if (endDate < today) {
            return; // Skip expired notices
          }
        }
      }

      var icon = window.PaddelbuchMarkerStyles
        ? window.PaddelbuchMarkerStyles.getEventNoticeIcon()
        : L.Icon.Default.prototype;

      var marker = L.marker([lat, lon], { icon: icon });

      // Property 15: Event Notice Popup Contains Required Information
      // Generate popup content using the event notice popup module (Requirement 7.3)
      var popupContent;
      if (window.PaddelbuchEventNoticePopup) {
        popupContent = window.PaddelbuchEventNoticePopup.generateEventNoticePopupContent(notice, currentLocale);
      } else {
        // Fallback popup content if module not loaded
        var escapedNoticeSlug = notice.slug ? PaddelbuchHtmlUtils.escapeHtml(notice.slug) : '';
        var localeStrs = currentLocale === 'en'
          ? { startDate: 'Approx. Start Date', endDate: 'Approx. End Date', moreDetails: 'More details' }
          : { startDate: 'Ungefähres Startdatum', endDate: 'Ungefähres Enddatum', moreDetails: 'Weitere Details' };
        popupContent = '<div>';
        popupContent += '<span class="popup-title"><h1>' + PaddelbuchHtmlUtils.escapeHtml(notice.name || '') + '</h1></span>';
        popupContent += '<table class="popup-details-table popup-eventnotice-table"><tbody>';
        if (notice.startDate) {
          popupContent += '<tr><th>' + localeStrs.startDate + ':</th><td>' + notice.startDate + '</td></tr>';
        }
        if (notice.endDate) {
          popupContent += '<tr><th>' + localeStrs.endDate + ':</th><td>' + notice.endDate + '</td></tr>';
        }
        popupContent += '</tbody></table>';
        if (notice.slug) {
          popupContent += '<button class="popup-btn popup-btn-right" data-tinylytics-event="popup.details" data-tinylytics-event-value="' + escapedNoticeSlug + '"><a class="popup-btn-right" hreflang="' + currentLocale + '" href="' + localePrefix + '/gewaesserereignisse/' + PaddelbuchHtmlUtils.escapeHtml(notice.slug) + '/">' + localeStrs.moreDetails + '</a></button>';
        }
        popupContent += '</div>';
      }

      marker.bindPopup(popupContent, { maxWidth: 350 });
      marker.addTo(layerGroups.eventNotices);

      // Dispatch marker.click beacon event when event notice marker is clicked
      marker.on('click', function() {
        if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
          PaddelbuchTinylyticsBeacon.dispatch('marker.click', notice.slug || '');
        }
      });

      // Property 14: Event Notice Dual Rendering
      // Also add affected area polygon if available (Requirement 7.2)
      // Both marker and area should show popup on click
      if (notice.affectedArea) {
        try {
          var geoJson = typeof notice.affectedArea === 'string'
            ? JSON.parse(notice.affectedArea)
            : notice.affectedArea;

          var areaStyle = window.PaddelbuchLayerStyles
            ? window.PaddelbuchLayerStyles.waterwayEventNoticeAreaStyle
            : { color: '#ffb200', fillColor: '#ffb200', fillOpacity: 0.4, weight: 2, dashArray: '12 9' };

          var areaLayer = L.geoJSON(geoJson, { style: areaStyle });
          // Both marker and area show the same popup content
          areaLayer.bindPopup(popupContent, { maxWidth: 350 });

          // Dispatch marker.click beacon event when affected area layer is clicked
          areaLayer.on('click', function() {
            if (typeof PaddelbuchTinylyticsBeacon !== 'undefined') {
              PaddelbuchTinylyticsBeacon.dispatch('marker.click', notice.slug || '');
            }
          });

          areaLayer.addTo(layerGroups.eventNotices);
        } catch (e) {
          console.warn('Failed to parse event notice affected area:', e);
        }
      }

      // Recenter (and optionally zoom on home page) when marker is clicked
      bindMarkerRecenter(marker);
    }

    // Add non-spot layers to map (spot markers are managed individually by Filter Engine)
    layerGroups.eventNotices.addTo(map);
    layerGroups.obstacles.addTo(map);
    layerGroups.protectedAreas.addTo(map);
    // Note: layerGroups.noEntry is NOT added to map by default (Requirement 2.8)

    // Store layer groups globally for other scripts to access
    window.paddelbuchLayerGroups = layerGroups;
    window.paddelbuchFilterByLocale = filterByLocale;
    window.paddelbuchAddSpotMarker = addSpotMarker;
    window.paddelbuchAddEventNoticeMarker = addEventNoticeMarker;
    window.paddelbuchAddObstacleLayer = addObstacleLayer;
    window.paddelbuchAddProtectedAreaLayer = addProtectedAreaLayer;
    window.paddelbuchCurrentLocale = currentLocale;

    console.log('Layer controls initialized for locale:', currentLocale);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayerControls);
  } else {
    // Small delay to ensure map is initialized first
    setTimeout(initLayerControls, 50);
  }
})();
