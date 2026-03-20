/**
 * Paddelbuch Freshness Dashboard Module
 *
 * Renders pre-computed freshness metrics on the shared Leaflet map. Each
 * waterway geometry is coloured by its pre-computed freshness colour (green
 * for fresh data, yellow for aging, red for stale, purple for no data).
 * Popups show waterway name, spot count, and median age.
 *
 * All metric computation is done at Jekyll build time by
 * dashboard_metrics_generator.rb — this module only renders pre-computed data.
 *
 * Requirements: 3.1, 3.9, 3.10, 6.5, 7.1
 */

(function(global) {
  'use strict';

  var layers = [];
  var legendEl = null;

  /**
   * Reads localised strings from a #freshness-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Gewässeraktualität',
      legend_title: 'Median-Alter der Einträge',
      fresh: 'Aktuell (≤ 2 Jahre)',
      aging: 'Alternd (2–5 Jahre)',
      stale: 'Veraltet (> 5 Jahre)',
      no_data: 'Keine Einstiegsorte',
      popup_spots: 'Einstiegsorte',
      popup_median_age: 'Median-Alter',
      popup_years: 'Jahre',
      popup_no_data: 'Keine Daten vorhanden'
    };

    var el = document.getElementById('freshness-i18n');
    if (!el) {
      return defaults;
    }
    try {
      var parsed = JSON.parse(el.textContent);
      // Merge parsed values over defaults so missing keys still work
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
   * Formats the median age in days as a human-readable string.
   *
   * @param {number|null} medianAgeDays - Median age in days, or null if no data
   * @param {Object} strings - Localised string map
   * @returns {string} Human-readable age string
   */
  function formatMedianAge(medianAgeDays, strings) {
    if (medianAgeDays == null) {
      return strings.popup_no_data;
    }
    var years = (medianAgeDays / 365.25).toFixed(1);
    return years + ' ' + strings.popup_years;
  }

  /**
   * Builds popup HTML for a freshness metric entry using existing popup CSS
   * classes (popup-icon-div, popup-title, popup-btn) for visual consistency.
   *
   * @param {Object} metric - Freshness metric object
   * @param {Object} strings - Localised string map
   * @returns {string} HTML string for the popup
   */
  function buildPopupHtml(metric, strings) {
    var html = '';

    // Header with colour indicator
    html += '<div class="popup-icon-div">';
    html += '<span class="dashboard-popup-icon" style="background:' + metric.color + ';"></span>';
    html += strings.popup_spots + ': ' + metric.spotCount;
    html += '</div>';

    // Title: waterway name
    html += '<span class="popup-title"><h1>' + escapeHtml(metric.name) + '</h1></span>';

    // Median age info
    html += '<div>';
    html += '<p>' + strings.popup_median_age + ': ' + formatMedianAge(metric.medianAgeDays, strings) + '</p>';
    html += '</div>';

    return html;
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
   * Renders the freshness legend into the given legend element.
   *
   * @param {HTMLElement} el - The legend container element
   * @param {Object} strings - Localised string map
   */
  function renderLegend(el, strings) {
    var html = '';
    html += '<h4>' + escapeHtml(strings.legend_title) + '</h4>';
    html += '<div class="dashboard-legend-items">';

    // Traffic light: Green / Yellow / Red
    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--fresh"></span>';
    html += '<span>' + escapeHtml(strings.fresh) + '</span>';
    html += '</div>';

    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--aging"></span>';
    html += '<span>' + escapeHtml(strings.aging) + '</span>';
    html += '</div>';

    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--stale"></span>';
    html += '<span>' + escapeHtml(strings.stale) + '</span>';
    html += '</div>';

    // No data indicator
    html += '<div class="dashboard-legend-item">';
    html += '<span class="dashboard-legend-swatch dashboard-legend-swatch--no-data"></span>';
    html += '<span>' + escapeHtml(strings.no_data) + '</span>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
  }

  var strings = getStrings();

  var module = {
    id: 'freshness',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    activate: function(context) {
      var map = context.map;
      legendEl = context.legendEl || document.getElementById('dashboard-legend');
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.freshnessMetrics) || [];

      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      for (var i = 0; i < metrics.length; i++) {
        var metric = metrics[i];
        if (!metric.geometry) {
          continue;
        }

        var layer = L.geoJSON(metric.geometry, {
          style: {
            color: metric.color,
            weight: 3,
            opacity: 1,
            fillColor: metric.color,
            fillOpacity: 0.25
          }
        });

        layer.bindPopup(buildPopupHtml(metric, strings));
        layer.addTo(map);
        layers.push(layer);
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
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchFreshnessDashboard = module;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
