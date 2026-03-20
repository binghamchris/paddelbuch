/**
 * Paddelbuch Coverage Dashboard Module
 *
 * Renders pre-computed coverage metrics on the shared Leaflet map. Each
 * waterway's geometry is split into covered (green) and uncovered (red)
 * segments based on proximity to spots. Popups show waterway name and
 * spot count.
 *
 * All metric computation is done at Jekyll build time by
 * dashboard_metrics_generator.rb — this module only renders pre-computed data.
 *
 * Requirements: 4.1, 4.6, 4.7, 6.5, 7.1
 */

(function(global) {
  'use strict';

  var colors = global.PaddelbuchColors || {};
  var COVERED_COLOR = colors.coveredGreen || '#4ab31f';
  var UNCOVERED_COLOR = colors.uncoveredRed || '#d0021b';

  var layers = [];
  var legendEl = null;

  /**
   * Reads localised strings from a #coverage-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Gewässerabdeckung',
      description: '',
      legend_title: 'Abdeckung der Gewässer',
      covered: 'Abgedeckt (innerhalb 5 km)',
      not_covered: 'Nicht abgedeckt',
      popup_spots: 'Einstiegsorte'
    };

    var el = document.getElementById('coverage-i18n');
    if (!el) {
      return defaults;
    }
    try {
      var parsed = JSON.parse(el.textContent);
      var result = {};
      for (var key in defaults) {
        if (defaults.hasOwnProperty(key)) {
          result[key] = (parsed[key] != null && parsed[key] !== '') ? parsed[key] : defaults[key];
        }
      }
      return result;
    } catch (e) {
      return defaults;
    }
  }

  /**
   * Minimal HTML escaping for user-facing text.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Builds popup HTML for a coverage metric entry using existing popup CSS
   * classes (popup-icon-div, popup-title, popup-btn) for visual consistency.
   *
   * @param {Object} metric - Coverage metric object
   * @param {Object} strings - Localised string map
   * @returns {string} HTML string for the popup
   */
  function buildPopupHtml(metric, strings) {
    var html = '';

    // Header with spot count
    html += '<div class="popup-icon-div">';
    html += strings.popup_spots + ': ' + metric.spotCount;
    html += '</div>';

    // Title: waterway name
    html += '<span class="popup-title"><h1>' + escapeHtml(metric.name) + '</h1></span>';

    return html;
  }

  /**
   * Renders the coverage legend into the given legend element.
   *
   * @param {HTMLElement} el - The legend container element
   * @param {Object} strings - Localised string map
   */
  function renderLegend(el, strings) {
    var html = '';
    html += '<div class="dashboard-legend-items">';

    // Covered indicator
    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--covered"></span>';
    html += '<span>' + escapeHtml(strings.covered) + '</span>';
    html += '</div>';

    // Uncovered indicator
    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--uncovered"></span>';
    html += '<span>' + escapeHtml(strings.not_covered) + '</span>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
  }

  var strings = getStrings();

  var module = {
    id: 'coverage',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    activate: function(context) {
      var map = context.map;
      legendEl = context.legendEl || document.getElementById('dashboard-legend');
      var descriptionEl = document.getElementById('dashboard-description');
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.coverageMetrics) || [];

      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      if (descriptionEl) {
        descriptionEl.textContent = strings.description;
      }

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      for (var i = 0; i < metrics.length; i++) {
        var metric = metrics[i];
        var popupHtml = buildPopupHtml(metric, strings);

        // Covered segments (green) — single MultiLineString geometry
        if (metric.coveredSegments) {
          var coveredLayer = L.geoJSON(metric.coveredSegments, {
            style: {
              color: COVERED_COLOR,
              weight: 3,
              opacity: 0.8
            }
          });
          coveredLayer.bindPopup(popupHtml);
          coveredLayer.addTo(map);
          layers.push(coveredLayer);
        }

        // Uncovered segments (red) — single MultiLineString geometry
        if (metric.uncoveredSegments) {
          var uncoveredLayer = L.geoJSON(metric.uncoveredSegments, {
            style: {
              color: UNCOVERED_COLOR,
              weight: 3,
              opacity: 0.8
            }
          });
          uncoveredLayer.bindPopup(popupHtml);
          uncoveredLayer.addTo(map);
          layers.push(uncoveredLayer);
        }
      }

      if (legendEl) {
        renderLegend(legendEl, strings);
      }
    },

    deactivate: function() {
      for (var i = 0; i < layers.length; i++) {
        layers[i].remove();
      }
      layers = [];

      if (legendEl) {
        legendEl.innerHTML = '';
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.textContent = '';
      }

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = '';
      }
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchCoverageDashboard = module;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
