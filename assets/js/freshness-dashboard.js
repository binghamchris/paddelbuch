/**
 * Paddelbuch Freshness Dashboard Module
 *
 * Renders pre-computed freshness metrics on the shared Leaflet map. Each
 * waterway geometry is coloured by its pre-computed freshness colour (green
 * for fresh data, yellow for aging, red for stale, purple for no data).
 * Popups show waterway name, spot count, and median age.
 *
 * All metric computation is done at Jekyll build time by
 * dashboard_metrics_generator.rb - this module only renders pre-computed data.
 *
 * Requirements: 3.1, 3.9, 3.10, 6.5, 7.1
 */

(function(global) {
  'use strict';

  var Chart = global.Chart;
  var colors = global.PaddelbuchColors || {};
  var layers = [];
  var legendEl = null;
  var chartInstances = [];

  /**
   * Colour-to-key mapping for freshness categories.
   */
  var FRESHNESS_COLOR_MAP = {
    'fresh': 'green1',
    'aging': 'warningYellow',
    'stale': 'dangerRed',
    'noData': 'purple1'
  };

  /**
   * Returns the colour hex value for a given colour key from PaddelbuchColors.
   *
   * @param {string} colorKey - The camelCase colour key
   * @returns {string} Hex colour string or a grey fallback
   */
  function getColor(colorKey) {
    return colors[colorKey] || '#999999';
  }

  /**
   * Destroys all active Chart.js instances and clears the tracking array.
   */
  function destroyCharts() {
    for (var i = 0; i < chartInstances.length; i++) {
      try {
        chartInstances[i].destroy();
      } catch (e) {
        // Continue destroying remaining instances
      }
    }
    chartInstances = [];
  }

  /**
   * Creates a horizontal stacked bar chart on a canvas element.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to render into
   * @param {Array} segments - Array of { name, count, colorKey } objects
   * @returns {Object|null} The Chart instance, or null if Chart is unavailable
   */
  function createStackedBarChart(canvas, segments) {
    if (!canvas || !Chart) return null;
    var total = 0;
    for (var i = 0; i < segments.length; i++) {
      total += segments[i].count;
    }

    var percentageLabelPlugin = {
      id: 'freshnessDashboardPercentageLabels',
      afterDraw: function(chart) {
        var ctx = chart.ctx;
        var chartArea = chart.chartArea;
        var chartHeight = chartArea.bottom - chartArea.top;
        var fontSize = Math.floor(chartHeight * 0.5);
        var xScale = chart.scales.x;
        var centerY = chartArea.top + chartHeight / 2 + fontSize * 0.05;
        var cumulative = 0;

        for (var d = 0; d < chart.data.datasets.length; d++) {
          var pct = total > 0 ? (segments[d].count / total) * 100 : 0;
          var segStart = cumulative;
          var segEnd = cumulative + pct;
          cumulative = segEnd;

          if (pct < 1) continue;

          var leftPx = xScale.getPixelForValue(segStart);
          var rightPx = xScale.getPixelForValue(segEnd);
          var segCenterX = (leftPx + rightPx) / 2;
          var segWidth = rightPx - leftPx;

          var text = Math.round(pct) + '%';
          ctx.save();
          ctx.fillStyle = segments[d].colorKey === 'warningYellow' ? '#000' : '#fff';
          ctx.font = '400 ' + fontSize + 'px ' + (window.getComputedStyle(chart.canvas).fontFamily || 'Quicksand, Helvetica, Arial, sans-serif');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          var textWidth = ctx.measureText(text).width;
          if (segWidth > textWidth + 4) {
            ctx.fillText(text, segCenterX, centerY);
          }
          ctx.restore();
        }
      }
    };

    var chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [''],
        datasets: segments.map(function(seg) {
          return {
            label: seg.name,
            data: [total > 0 ? (seg.count / total) * 100 : 0],
            backgroundColor: getColor(seg.colorKey)
          };
        })
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 0
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                var seg = segments[context.datasetIndex];
                return seg ? seg.name + ': ' + Math.round(seg.count) + ' km' : '';
              }
            }
          }
        },
        scales: {
          x: { stacked: true, display: false, min: 0, max: 100 },
          y: { stacked: true, display: false }
        }
      },
      plugins: [percentageLabelPlugin]
    });
    chartInstances.push(chart);
    return chart;
  }

  /**
   * Reads localised strings from a #freshness-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Gewässeraktualität',
      description: '',
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
   * Renders the freshness legend and chart into the given legend element.
   *
   * @param {HTMLElement} el - The legend container element
   * @param {Object} strings - Localised string map
   * @param {Object} summary - Freshness summary counts { fresh, aging, stale, noData }
   */
  function renderLegend(el, strings, summary) {
    var html = '';
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

    // Chart canvas below legend
    html += '<div class="statistics-chart-container">';
    html += '<canvas data-chart-section="waterway-freshness"></canvas>';
    html += '</div>';

    el.innerHTML = html;

    // Create chart from summary data
    if (summary) {
      var segments = [
        { name: strings.fresh, count: summary.fresh || 0, colorKey: FRESHNESS_COLOR_MAP['fresh'] },
        { name: strings.aging, count: summary.aging || 0, colorKey: FRESHNESS_COLOR_MAP['aging'] },
        { name: strings.stale, count: summary.stale || 0, colorKey: FRESHNESS_COLOR_MAP['stale'] },
        { name: strings.no_data, count: summary.noData || 0, colorKey: FRESHNESS_COLOR_MAP['noData'] }
      ];
      var canvas = el.querySelector('canvas[data-chart-section="waterway-freshness"]');
      createStackedBarChart(canvas, segments);
    }
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
      var descriptionEl = document.getElementById('dashboard-description');
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.freshnessMetrics) || [];
      var summary = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.freshnessSummary) || {};

      // Clean up any previous chart instances
      destroyCharts();

      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      if (descriptionEl) {
        descriptionEl.innerHTML = strings.description;
      }

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      for (var i = 0; i < metrics.length; i++) {
        var metric = metrics[i];
        if (!metric.geometry) {
          continue;
        }

        var isNoData = metric.spotCount === 0;
        var layer = L.geoJSON(metric.geometry, {
          style: {
            color: metric.color,
            weight: 3,
            opacity: isNoData ? 0.55 : 1,
            fillColor: metric.color,
            fillOpacity: isNoData ? 0.55 * 0.25 : 0.25
          }
        });

        layer.bindPopup(buildPopupHtml(metric, strings));
        layer.addTo(map);
        layers.push(layer);
      }

      if (legendEl) {
        renderLegend(legendEl, strings, summary);
      }
    },

    deactivate: function() {
      destroyCharts();

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
  global.PaddelbuchFreshnessDashboard = module;

  // Expose internals for testing
  global.PaddelbuchFreshnessDashboard.getStrings = getStrings;
  global.PaddelbuchFreshnessDashboard.createStackedBarChart = createStackedBarChart;
  global.PaddelbuchFreshnessDashboard.destroyCharts = destroyCharts;
  global.PaddelbuchFreshnessDashboard.getColor = getColor;
  global.PaddelbuchFreshnessDashboard.FRESHNESS_COLOR_MAP = FRESHNESS_COLOR_MAP;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
