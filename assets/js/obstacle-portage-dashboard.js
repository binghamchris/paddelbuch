/**
 * Paddelbuch Obstacle Portage Dashboard Module
 *
 * Renders per-obstacle portage route data as a horizontal stacked bar chart
 * and shaped, colour-coded Leaflet markers. Each obstacle is plotted on the
 * shared map with a shape and colour indicating its portage status based on
 * the isPortagePossible field:
 *
 *   - isPortagePossible = true:  green circle  (same as Spot Freshness "fresh")
 *   - isPortagePossible = false: red square    (same as Spot Freshness "stale")
 *   - isPortagePossible = null:  yellow triangle (same as Spot Freshness "aging")
 *
 * All metric computation is done at Jekyll build time by
 * statistics_metrics_generator.rb - this module only renders pre-computed data.
 */

(function(global) {
  'use strict';

  var Chart = global.Chart;
  var L = global.L;
  var colors = global.PaddelbuchColors || {};
  var chartInstances = [];
  var markerLayerGroup = null;

  /**
   * Colour-to-key mapping for portage categories.
   */
  var PORTAGE_COLOR_MAP = {
    'withPortage': 'green1',
    'withoutPortage': 'dangerRed',
    'unknown': 'warningYellow'
  };

  /**
   * SVG shape templates for map markers, keyed by portage category.
   * Shapes match the Spot Freshness dashboard conventions.
   */
  var SHAPES = {
    withPortage: function(color) {
      return '<svg width="14" height="14" viewBox="0 0 14 14">' +
        '<circle cx="7" cy="7" r="6" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>';
    },
    withoutPortage: function(color) {
      return '<svg width="14" height="14" viewBox="0 0 14 14">' +
        '<rect x="1" y="1" width="12" height="12" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>';
    },
    unknown: function(color) {
      return '<svg width="14" height="14" viewBox="0 0 14 14">' +
        '<polygon points="7,1 13,13 1,13" fill="' + color + '" stroke="#fff" stroke-width="1"/></svg>';
    }
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
      id: 'obstaclePortagePercentageLabels',
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
          ctx.font = '400 ' + fontSize + 'px ' +
            (window.getComputedStyle(chart.canvas).fontFamily || 'Quicksand, Helvetica, Arial, sans-serif');
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
        layout: { padding: 0 },
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
   * Reads localised strings from a #obstacle-portage-i18n JSON block on the
   * page, falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Hindernis-Portage-Routen',
      description: 'Welche Hindernisse eine dokumentierte Portage-Route haben und welche nicht.',
      with_portage: 'Portage-Route verfügbar',
      without_portage: 'Keine Portage-Route verfügbar',
      unknown: 'Unbekannt',
      more_details: 'Weitere Details'
    };

    var el = document.getElementById('obstacle-portage-i18n');
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
   * Builds popup HTML for an obstacle marker, matching the obstacle popup
   * structure from the home page map (popup-title + popup-btn link).
   *
   * @param {Object} obstacle - Obstacle data object with name, slug
   * @param {Object} strings - Localised string map
   * @returns {string} HTML string for the popup
   */
  function buildPopupHtml(obstacle, strings) {
    var locale = document.documentElement.lang || 'de';
    var localePrefix = (locale && locale !== 'de') ? '/' + locale : '';

    var html = '<span class="popup-title"><h1>' + escapeHtml(obstacle.name) + '</h1></span>';

    if (obstacle.slug) {
      html += '<button class="popup-btn popup-btn-right obstacle-details-btn">';
      html += '<a class="popup-btn-right" hreflang="' + escapeHtml(locale) + '" href="' +
        localePrefix + '/hindernisse/' + encodeURIComponent(obstacle.slug) + '/">';
      html += escapeHtml(strings.more_details);
      html += '</a></button>';
    }

    return html;
  }

  var strings = getStrings();

  var module = {
    id: 'obstacle-portage',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    usesBoth: false,

    activate: function(context) {
      destroyCharts();

      // Refresh i18n strings on each activation
      strings = getStrings();

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.innerHTML = strings.description;
      }

      // --- Map markers ---
      var map = context.map;
      var obstacleData = (global.PaddelbuchDashboardData &&
        global.PaddelbuchDashboardData.obstaclePortageMapData) || [];

      var withCount = 0;
      var withoutCount = 0;
      var unknownCount = 0;

      if (map && L && L.layerGroup && L.marker && L.divIcon) {
        markerLayerGroup = L.layerGroup();

        for (var j = 0; j < obstacleData.length; j++) {
          var obstacle = obstacleData[j];

          if (obstacle.lat == null || obstacle.lon == null) {
            continue;
          }

          var category = obstacle.portageCategory || 'unknown';
          var colorKey = PORTAGE_COLOR_MAP[category];
          var markerColor = getColor(colorKey);
          var svgHtml = SHAPES[category](markerColor);

          if (category === 'withPortage') {
            withCount++;
          } else if (category === 'withoutPortage') {
            withoutCount++;
          } else {
            unknownCount++;
          }

          var icon = L.divIcon({
            html: svgHtml,
            className: 'obstacle-portage-marker',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });

          var zOffset = category === 'withoutPortage' ? 2000 : (category === 'unknown' ? 1000 : 0);
          var marker = L.marker([obstacle.lat, obstacle.lon], {
            icon: icon,
            zIndexOffset: zOffset
          });
          marker.bindPopup(buildPopupHtml(obstacle, strings));
          markerLayerGroup.addLayer(marker);
        }

        markerLayerGroup.addTo(map);
      } else {
        // Count without map
        for (var k = 0; k < obstacleData.length; k++) {
          var cat = obstacleData[k].portageCategory || 'unknown';
          if (cat === 'withPortage') {
            withCount++;
          } else if (cat === 'withoutPortage') {
            withoutCount++;
          } else {
            unknownCount++;
          }
        }
      }

      // --- Legend + chart (sorted by count descending, matching statistics dashboard) ---
      var segments = [
        { name: strings.without_portage, count: withoutCount, colorKey: PORTAGE_COLOR_MAP['withoutPortage'], catKey: 'withoutPortage' },
        { name: strings.unknown, count: unknownCount, colorKey: PORTAGE_COLOR_MAP['unknown'], catKey: 'unknown' },
        { name: strings.with_portage, count: withCount, colorKey: PORTAGE_COLOR_MAP['withPortage'], catKey: 'withPortage' }
      ];
      segments.sort(function(a, b) { return b.count - a.count; });

      var legendEl = document.getElementById('dashboard-legend');
      if (legendEl) {
        var legendHtml = '';
        legendHtml += '<div class="dashboard-legend-items">';

        var categories = segments.map(function(seg) {
          return { key: seg.catKey, label: seg.name };
        });

        for (var i = 0; i < categories.length; i++) {
          var legendCat = categories[i];
          var catColorKey = PORTAGE_COLOR_MAP[legendCat.key];
          var catColor = getColor(catColorKey);
          var shapeSvg = SHAPES[legendCat.key](catColor);

          legendHtml += '<div class="dashboard-legend-item">';
          legendHtml += '<span class="dashboard-legend-shape">' + shapeSvg + '</span>';
          legendHtml += '<span>' + escapeHtml(legendCat.label) + '</span>';
          legendHtml += '</div>';
        }

        legendHtml += '</div>';

        legendHtml += '<div class="statistics-chart-container">';
        legendHtml += '<canvas data-chart-section="obstacle-portage"></canvas>';
        legendHtml += '</div>';

        legendEl.innerHTML = legendHtml;

        var canvas = legendEl.querySelector('canvas[data-chart-section="obstacle-portage"]');
        createStackedBarChart(canvas, segments);
      }
    },

    deactivate: function() {
      destroyCharts();

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = '';
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.innerHTML = '';
      }

      var legendEl = document.getElementById('dashboard-legend');
      if (legendEl) {
        legendEl.innerHTML = '';
      }

      if (markerLayerGroup) {
        try {
          markerLayerGroup.remove();
        } catch (e) {
          // Layer may already have been removed
        }
        markerLayerGroup = null;
      }
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchObstaclePortageDashboard = module;

  // Expose internals for testing
  global.PaddelbuchObstaclePortageDashboard.getStrings = getStrings;
  global.PaddelbuchObstaclePortageDashboard.createStackedBarChart = createStackedBarChart;
  global.PaddelbuchObstaclePortageDashboard.destroyCharts = destroyCharts;
  global.PaddelbuchObstaclePortageDashboard.getColor = getColor;
  global.PaddelbuchObstaclePortageDashboard.PORTAGE_COLOR_MAP = PORTAGE_COLOR_MAP;
  global.PaddelbuchObstaclePortageDashboard.SHAPES = SHAPES;
  global.PaddelbuchObstaclePortageDashboard.buildPopupHtml = buildPopupHtml;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
