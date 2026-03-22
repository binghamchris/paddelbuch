/**
 * Paddelbuch Spot Freshness Dashboard Module
 *
 * Renders per-spot freshness data as a horizontal stacked bar chart and
 * shaped, colour-coded Leaflet markers. Each spot is plotted on the shared
 * map with a shape (circle / triangle / square) and colour indicating its
 * freshness category. A shared legend explains both chart and map symbols.
 *
 * All metric computation is done at Jekyll build time by
 * statistics_metrics_generator.rb - this module only renders pre-computed data.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.2, 8.1, 8.2
 */

(function(global) {
  'use strict';

  var Chart = global.Chart;
  var L = global.L;
  var colors = global.PaddelbuchColors || {};
  var chartInstances = [];
  var pendingCharts = [];
  var markerLayerGroup = null;

  /**
   * Colour-to-key mapping for freshness categories.
   */
  var FRESHNESS_COLOR_MAP = {
    'fresh': 'green1',
    'aging': 'warningYellow',
    'stale': 'dangerRed'
  };

  /**
   * SVG shape templates for map markers, keyed by freshness category.
   * Each function accepts a fill colour and returns an SVG string.
   */
  var SHAPES = {
    fresh:  function(color) { return '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>'; },
    aging:  function(color) { return '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,13 1,13" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>'; },
    stale:  function(color) { return '<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>'; }
  };

  /**
   * Minimal HTML escaping for user-facing text.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
   * @param {Array} segments - Array of { name, count, colorKey, slug } objects
   * @returns {Object|null} The Chart instance, or null if Chart is unavailable
   */
  function createStackedBarChart(canvas, segments) {
    if (!canvas || !Chart) return null;
    var total = 0;
    for (var i = 0; i < segments.length; i++) {
      total += segments[i].count;
    }

    // Inline plugin: draw percentage labels centred inside each bar segment
    var percentageLabelPlugin = {
      id: 'spotFreshnessPercentageLabels',
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
                return seg ? seg.name + ': ' + seg.count : '';
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
   * Reads localised strings from a #spot-freshness-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Einstiegsort-Aktualität',
      description: 'Wie kürzlich jeder einzelne Einstiegsort, der Paddlern zur Verfügung steht, aktualisiert wurde.',
      fresh: 'Aktuell (<= 2 Jahre)',
      aging: 'Alternd (2-5 Jahre)',
      stale: 'Veraltet (> 5 Jahre)',
      chart_title: 'Aktualität der Einstiegsorte',
      popup_age: 'Alter',
      popup_years: 'Jahre',
      more_details: 'Weitere Details'
    };

    var el = document.getElementById('spot-freshness-i18n');
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
   * Builds popup HTML for a spot marker, following the same CSS pattern
   * used by the freshness and coverage dashboard popups.
   *
   * @param {Object} spot - Spot data object with name, category, ageDays
   * @param {Object} strings - Localised string map
   * @returns {string} HTML string for the popup
   */
  function buildPopupHtml(spot, strings) {
    var colorKey = FRESHNESS_COLOR_MAP[spot.category];
    var color = getColor(colorKey);
    var ageYears = spot.ageDays != null ? (spot.ageDays / 365.25).toFixed(1) : '-';

    var shapeFn = SHAPES[spot.category];
    var shapeSvg = shapeFn ? shapeFn(color) : '';

    var locale = document.documentElement.lang || 'de';
    var localePrefix = (locale && locale !== 'de') ? '/' + locale : '';

    var html = '';
    html += '<div class="popup-icon-div">';
    html += '<span class="dashboard-popup-icon">' + shapeSvg + '</span>';
    html += strings.popup_age + ': ' + ageYears + ' ' + strings.popup_years;
    html += '</div>';
    html += '<span class="popup-title"><h1>' + escapeHtml(spot.name) + '</h1></span>';

    if (spot.slug) {
      html += '<button class="popup-btn popup-btn-right">';
      html += '<a href="' + localePrefix + '/einstiegsorte/' + encodeURIComponent(spot.slug) + '/">';
      html += escapeHtml(strings.more_details);
      html += '</a></button>';
    }

    return html;
  }

  var strings = getStrings();

  var module = {
    id: 'spot-freshness',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    usesBoth: true,

    activate: function(context) {
      // Clean up any previous chart instances
      destroyCharts();
      pendingCharts = [];

      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      var contentEl = context.contentEl || document.getElementById('dashboard-content');
      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.innerHTML = strings.description;
      }

      // --- Spot freshness chart ---
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.statisticsMetrics) || {};
      var spots = metrics.spots || {};
      var freshness = spots.freshness || { fresh: 0, aging: 0, stale: 0 };

      var freshnessSegments = [
        { name: strings.fresh, count: freshness.fresh || 0, colorKey: FRESHNESS_COLOR_MAP['fresh'], slug: 'fresh' },
        { name: strings.aging, count: freshness.aging || 0, colorKey: FRESHNESS_COLOR_MAP['aging'], slug: 'aging' },
        { name: strings.stale, count: freshness.stale || 0, colorKey: FRESHNESS_COLOR_MAP['stale'], slug: 'stale' }
      ];

      var freshnessTotal = (freshness.fresh || 0) + (freshness.aging || 0) + (freshness.stale || 0);

      pendingCharts.push({ section: 'spot-freshness', segments: freshnessSegments });

      // --- Map markers ---
      var map = context.map;
      if (map && L && L.layerGroup && L.marker && L.divIcon) {
        var spotData = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.spotFreshnessMapData) || [];
        markerLayerGroup = L.layerGroup();

        for (var j = 0; j < spotData.length; j++) {
          var spot = spotData[j];

          // Guard: skip entries with missing lat, lon, or category
          if (spot.lat == null || spot.lon == null || !spot.category) {
            continue;
          }

          if (!SHAPES.hasOwnProperty(spot.category)) {
            continue;
          }
          var shapeFn = SHAPES[spot.category];

          var colorKey = FRESHNESS_COLOR_MAP[spot.category];
          var markerColor = getColor(colorKey);
          var svgHtml = shapeFn(markerColor);

          var icon = L.divIcon({
            html: svgHtml,
            className: 'spot-freshness-marker',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });

          var marker = L.marker([spot.lat, spot.lon], { icon: icon });
          marker.bindPopup(buildPopupHtml(spot, strings));
          markerLayerGroup.addLayer(marker);
        }

        markerLayerGroup.addTo(map);
      }

      // --- Shared legend + chart ---
      var legendEl = document.getElementById('dashboard-legend');
      if (legendEl) {
        var legendHtml = '';
        legendHtml += '<div class="dashboard-legend-items">';

        var categories = [
          { key: 'fresh', label: strings.fresh },
          { key: 'aging', label: strings.aging },
          { key: 'stale', label: strings.stale }
        ];

        for (var k = 0; k < categories.length; k++) {
          var cat = categories[k];
          var catColorKey = FRESHNESS_COLOR_MAP[cat.key];
          var catColor = getColor(catColorKey);
          var shapeSvg = SHAPES[cat.key](catColor);

          legendHtml += '<div class="dashboard-legend-item">';
          legendHtml += '<span class="dashboard-legend-shape">' + shapeSvg + '</span>';
          legendHtml += '<span>' + escapeHtml(cat.label) + '</span>';
          legendHtml += '</div>';
        }

        legendHtml += '</div>';

        // Render chart immediately after legend entries
        legendHtml += '<div class="statistics-chart-container">';
        legendHtml += '<canvas data-chart-section="spot-freshness"></canvas>';
        legendHtml += '</div>';

        legendEl.innerHTML = legendHtml;

        // Create Chart.js instances on the now-rendered canvas elements
        for (var i = 0; i < pendingCharts.length; i++) {
          var pending = pendingCharts[i];
          var canvas = legendEl.querySelector('canvas[data-chart-section="' + pending.section + '"]');
          createStackedBarChart(canvas, pending.segments);
        }
        pendingCharts = [];
      }
    },

    deactivate: function() {
      // Destroy all Chart.js instances (already wrapped in try/catch internally)
      destroyCharts();
      pendingCharts = [];

      // Clear all four DOM containers
      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = '';
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.innerHTML = '';
      }

      var contentEl = document.getElementById('dashboard-content');
      if (contentEl) {
        contentEl.innerHTML = '';
      }

      var legendEl = document.getElementById('dashboard-legend');
      if (legendEl) {
        legendEl.innerHTML = '';
      }

      // Remove marker layer group from the map (wrapped in try/catch for safety)
      if (markerLayerGroup) {
        try {
          markerLayerGroup.remove();
        } catch (e) {
          // Layer may already have been removed or map destroyed
        }
        markerLayerGroup = null;
      }
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchSpotFreshnessDashboard = module;

  // Expose internals for testing
  global.PaddelbuchSpotFreshnessDashboard.getStrings = getStrings;
  global.PaddelbuchSpotFreshnessDashboard.createStackedBarChart = createStackedBarChart;
  global.PaddelbuchSpotFreshnessDashboard.destroyCharts = destroyCharts;
  global.PaddelbuchSpotFreshnessDashboard.getColor = getColor;
  global.PaddelbuchSpotFreshnessDashboard.FRESHNESS_COLOR_MAP = FRESHNESS_COLOR_MAP;
  global.PaddelbuchSpotFreshnessDashboard.SHAPES = SHAPES;
  global.PaddelbuchSpotFreshnessDashboard.buildPopupHtml = buildPopupHtml;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
