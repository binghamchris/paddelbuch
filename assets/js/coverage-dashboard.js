/**
 * Paddelbuch Coverage Dashboard Module
 *
 * Renders pre-computed coverage metrics on the shared Leaflet map. Each
 * waterway's geometry is split into covered (green) and uncovered (red)
 * segments based on proximity to spots. Popups show waterway name and
 * spot count.
 *
 * A horizontal stacked bar chart below the legend shows the percentage of
 * total waterway length that is covered vs uncovered.
 *
 * All metric computation is done at Jekyll build time by
 * dashboard_metrics_generator.rb — this module only renders pre-computed data.
 *
 * Requirements: 4.1, 4.6, 4.7, 6.5, 7.1
 */

(function(global) {
  'use strict';

  var Chart = global.Chart;
  var colors = global.PaddelbuchColors || {};
  var COVERED_COLOR = colors.coveredGreen || '#4ab31f';
  var UNCOVERED_COLOR = colors.uncoveredRed || '#d0021b';

  var layers = [];
  var legendEl = null;
  var chartInstances = [];

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
   * Creates a horizontal stacked bar chart showing coverage percentages.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element to render into
   * @param {Array} segments - Array of { name, value, color } objects
   * @returns {Object|null} The Chart instance, or null if Chart is unavailable
   */
  function createStackedBarChart(canvas, segments) {
    if (!canvas || !Chart) return null;
    var total = 0;
    for (var i = 0; i < segments.length; i++) {
      total += segments[i].value;
    }

    // Inline plugin: draw percentage labels centred inside each bar segment
    var percentageLabelPlugin = {
      id: 'coveragePercentageLabels',
      afterDraw: function(chart) {
        var ctx = chart.ctx;
        var chartArea = chart.chartArea;
        var chartHeight = chartArea.bottom - chartArea.top;
        var fontSize = Math.floor(chartHeight * 0.5);
        var xScale = chart.scales.x;
        var centerY = chartArea.top + chartHeight / 2 + fontSize * 0.05;
        var cumulative = 0;

        for (var d = 0; d < chart.data.datasets.length; d++) {
          var pct = total > 0 ? (segments[d].value / total) * 100 : 0;
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
          ctx.fillStyle = '#fff';
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
            data: [total > 0 ? (seg.value / total) * 100 : 0],
            backgroundColor: seg.color
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
                if (!seg) return '';
                var pct = total > 0 ? (seg.value / total) * 100 : 0;
                return seg.name + ': ' + Math.round(pct) + '%';
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
   * Renders the coverage legend and stacked bar chart into the given element.
   *
   * @param {HTMLElement} el - The legend container element
   * @param {Object} strings - Localised string map
   * @param {Object} summary - Coverage summary with coveredLength and uncoveredLength
   */
  function renderLegend(el, strings, summary) {
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

    // Chart canvas below legend
    html += '<div class="statistics-chart-container">';
    html += '<canvas data-chart-section="coverage"></canvas>';
    html += '</div>';

    el.innerHTML = html;

    // Create chart from summary data
    var segments = [
      { name: strings.covered, value: summary.coveredLength || 0, color: COVERED_COLOR },
      { name: strings.not_covered, value: summary.uncoveredLength || 0, color: UNCOVERED_COLOR }
    ];
    var canvas = el.querySelector('canvas[data-chart-section="coverage"]');
    createStackedBarChart(canvas, segments);
  }

  var strings = getStrings();

  var module = {
    id: 'coverage',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    activate: function(context) {
      destroyCharts();

      var map = context.map;
      legendEl = context.legendEl || document.getElementById('dashboard-legend');
      var descriptionEl = document.getElementById('dashboard-description');
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.coverageMetrics) || [];
      var summary = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.coverageSummary) || {};

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
  global.PaddelbuchCoverageDashboard = module;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
