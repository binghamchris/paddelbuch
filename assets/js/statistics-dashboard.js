/**
 * Paddelbuch Statistics Dashboard Module
 *
 * Renders pre-computed statistics metrics as summary figures and horizontal
 * stacked bar charts using Chart.js. Displays totals and breakdowns for spots,
 * obstacles, protected areas, paddle craft types, data source types, and data
 * license types.
 *
 * All metric computation is done at Jekyll build time by
 * statistics_metrics_generator.rb - this module only renders pre-computed data.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.6, 2.7, 3.1, 3.2,
 *               3.5, 3.6, 4.1, 4.2, 4.4, 4.5, 5.1, 5.4, 6.1, 6.4, 7.1,
 *               7.4, 8.10, 9.1, 9.4, 10.1, 10.4, 10.5, 11.3
 */

(function(global) {
  'use strict';

  var Chart = global.Chart;
  var colors = global.PaddelbuchColors || {};
  var chartInstances = [];
  var pendingCharts = [];

  /**
   * Ordered gradient arrays for spot and protected-area charts.
   * Colours are assigned by sort position (index 0 = largest category = darkest).
   * Values come from PaddelbuchColors, sourced from _paddelbuch_colours.scss.
   */
  var SPOT_GRADIENT = [
    colors.chartGradientSpot1, colors.chartGradientSpot2, colors.chartGradientSpot3,
    colors.chartGradientSpot4, colors.chartGradientSpot5, colors.chartGradientSpot6
  ];
  var PA_GRADIENT = [
    colors.chartGradientPa1, colors.chartGradientPa2, colors.chartGradientPa3,
    colors.chartGradientPa4, colors.chartGradientPa5, colors.chartGradientPa6,
    colors.chartGradientPa7, colors.chartGradientPa8, colors.chartGradientPa9
  ];

  /**
   * Colour-to-slug mapping for obstacle segments.
   */
  var OBSTACLE_COLOR_MAP = {
    'with-portage': 'obstacleWithPortage',
    'without-portage': 'obstacleWithoutPortage',
    'unknown': 'obstacleUnknown'
  };

  /**
   * Slug-to-icon mapping for paddle craft type figures.
   */
  var PADDLE_CRAFT_ICONS = {
    'seekajak': '/assets/images/icons/kayak-dark.svg',
    'kanadier': '/assets/images/icons/canoe-dark.svg',
    'stand-up-paddle-board': '/assets/images/icons/sup-dark.svg'
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
   * Reads localised strings from a #statistics-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Statistiken',
      description: 'Übersicht über den Inhalt der Paddel Buch Datenbank.',
      spots_title: 'Einstiegsorte',
      obstacles_title: 'Hindernisse',
      protected_areas_title: 'Schutzgebiete',
      paddle_craft_title: 'Verfügbare Einstiegsorte nach Paddelboot-Typ',
      data_source_title: 'Einträge nach Datenquelle',
      data_license_title: 'Einträge nach Datenlizenz',
      with_portage: 'Portage-Route verfügbar',
      without_portage: 'Keine Portage-Route verfügbar',
      unknown_portage: 'Unbekannt',
      no_entry: 'Kein Zutritt'
    };

    var el = document.getElementById('statistics-i18n');
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
   * @param {Array} segments - Array of { name, count, color, slug } objects
   * @returns {Object|null} The Chart instance, or null if Chart is unavailable
   */
  function createStackedBarChart(canvas, segments) {
    if (!canvas || !Chart) return null;
    var total = 0;
    for (var i = 0; i < segments.length; i++) {
      total += segments[i].count;
    }
    var chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [''],
        datasets: segments.map(function(seg) {
          return {
            label: seg.name,
            data: [total > 0 ? (seg.count / total) * 100 : 0],
            backgroundColor: seg.color
          };
        })
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
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
      }
    });
    chartInstances.push(chart);
    return chart;
  }

  /**
   * Renders a summary figure (prominent number + label), with an optional icon
   * displayed above the value.
   *
   * @param {number} value - The numeric value to display
   * @param {string} label - The label text below the number
   * @param {string} [modifier] - Optional BEM modifier slug (e.g. 'spots')
   * @param {string} [iconSrc] - Optional icon image path to render above the value
   * @returns {string} HTML string
   */
  function renderFigure(value, label, modifier, iconSrc) {
    var cls = 'statistics-figure';
    if (modifier) {
      cls += ' statistics-figure--' + modifier;
    }
    var html = '<div class="' + cls + '">';
    if (iconSrc) {
      html += '<img class="statistics-figure-icon" src="' + escapeHtml(iconSrc) + '" alt="' + escapeHtml(label) + '" aria-hidden="true">';
    }
    html += '<div class="statistics-figure-value">' + escapeHtml(String(value)) + '</div>';
    html += '<div class="statistics-figure-label">' + escapeHtml(label) + '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Renders a horizontal stacked bar chart placeholder as a canvas element
   * inside a chart container div. Stores segment data in pendingCharts for
   * later Chart.js instantiation after innerHTML is set.
   *
   * @param {Array} segments - Array of { name, count, colorKey, slug } objects
   * @param {string} section - Section identifier (e.g. 'spots', 'obstacles')
   * @returns {string} HTML string for the chart container with canvas
   */
  function renderStackedBar(segments, section) {
    pendingCharts.push({ section: section, segments: segments });
    var html = '<div class="statistics-chart-container">';
    html += '<canvas data-chart-section="' + escapeHtml(section) + '"></canvas>';
    html += '</div>';
    return html;
  }

  /**
   * Renders a colour-coded legend for a set of segments using BEM-modifier
   * classes. Spot and PA sections use positional classes (--spot-pos-0, etc.)
   * that map to gradient colours in SCSS. Obstacle sections use slug-based
   * classes (--with-portage, --without-portage).
   *
   * @param {Array} segments - Array of { name, slug, color } objects (sorted by count desc)
   * @param {string} section - Section identifier ('spots', 'protected-areas', 'obstacles')
   * @returns {string} HTML string for the legend
   */
  function renderLegend(segments, section) {
    var html = '<div class="statistics-legend">';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var swatchClass = 'statistics-legend-swatch';
      if (section === 'spots') {
        swatchClass += ' statistics-legend-swatch--spot-pos-' + i;
      } else if (section === 'protected-areas') {
        swatchClass += ' statistics-legend-swatch--pa-pos-' + i;
      } else {
        swatchClass += ' statistics-legend-swatch--' + escapeHtml(seg.slug);
      }
      html += '<div class="statistics-legend-item">';
      html += '<span class="' + swatchClass + '"></span>';
      html += '<span>' + escapeHtml(seg.name) + '</span>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Renders a section with a summary figure, stacked bar chart, and legend.
   *
   * @param {string} title - Section heading text
   * @param {number} total - Total count for the summary figure
   * @param {Array} segments - Array of { name, count, colorKey, slug } objects
   * @param {string} section - Section identifier for BEM modifier and canvas data attribute
   * @returns {string} HTML string for the full section
   */
  /**
   * Renders a section with a summary figure, stacked bar chart, and legend.
   *
   * @param {string} title - Section heading text
   * @param {number} total - Total count for the summary figure
   * @param {Array} segments - Array of { name, count, slug } objects
   * @param {string} section - Section identifier for BEM modifier and canvas data attribute
   * @param {Object} [options] - Optional settings
   * @param {Array} [options.gradient] - Ordered colour array (dark->light) to assign by sort position
   * @returns {string} HTML string for the full section
   */
  function renderBarSection(title, total, segments, section, options) {
    var opts = options || {};
    var headingTag = opts.headingTag || 'h3';
    var sectionModifier = opts.sectionModifier || '';
    var gradient = opts.gradient || null;
    segments.sort(function(a, b) { return b.count - a.count; });
    // Assign gradient colours by sort position (index 0 = largest = darkest)
    if (gradient) {
      for (var g = 0; g < segments.length; g++) {
        segments[g].color = gradient[g] || '#999999';
      }
    }
    var sectionCls = 'statistics-section';
    if (sectionModifier) {
      sectionCls += ' statistics-section--' + sectionModifier;
    }
    var html = '<div class="' + sectionCls + '">';
    html += '<' + headingTag + ' class="statistics-section-title">' + escapeHtml(title) + '</' + headingTag + '>';
    html += '<div class="statistics-section-body">';
    var figureCls = 'statistics-figure';
    if (section) {
      figureCls += ' statistics-figure--' + section;
    }
    html += '<div class="' + figureCls + '">';
    html += '<div class="statistics-figure-value">' + escapeHtml(String(total)) + '</div>';
    html += '</div>';
    html += renderStackedBar(segments, section);
    html += '</div>';
    html += renderLegend(segments, section);
    html += '</div>';
    return html;
  }

  /**
   * Renders a section with only summary figures (no bar chart).
   *
   * @param {string} title - Section heading text
   * @param {Array} items - Array of { name, count, slug } objects
   * @param {Object} [options] - Optional settings
   * @param {Object} [options.icons] - Map of slug to icon image path
   * @returns {string} HTML string for the figures section
   */
  function renderFiguresSection(title, items, options) {
    var opts = options || {};
    var icons = opts.icons || null;
    var html = '<div class="statistics-section">';
    html += '<h3 class="statistics-section-title">' + escapeHtml(title) + '</h3>';
    html += '<div class="statistics-figures-grid">';
    for (var i = 0; i < items.length; i++) {
      var modifier = items[i].slug || undefined;
      var iconSrc = (icons && items[i].slug) ? icons[items[i].slug] : undefined;
      html += renderFigure(items[i].count, items[i].name, modifier, iconSrc);
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Builds spot type segments from metrics data.
   *
   * @param {Array} byType - Array of { slug, name, count } from metrics
   * @returns {Array} Segments with slug added (colour assigned later by sort position)
   */
  function buildSpotSegments(byType) {
    var segments = [];
    for (var i = 0; i < byType.length; i++) {
      var item = byType[i];
      segments.push({ name: item.name, count: item.count, slug: item.slug });
    }
    return segments;
  }

  /**
   * Builds obstacle segments from metrics data.
   *
   * @param {Object} obstacles - { total, withPortageRoute, withoutPortageRoute, unknownPortage }
   * @param {Object} strings - Localised string map
   * @returns {Array} Segments with colorKey and slug added
   */
  function buildObstacleSegments(obstacles, strings) {
    return [
      { name: strings.with_portage, count: obstacles.withPortageRoute || 0, color: getColor(OBSTACLE_COLOR_MAP['with-portage']), slug: 'with-portage' },
      { name: strings.without_portage, count: obstacles.withoutPortageRoute || 0, color: getColor(OBSTACLE_COLOR_MAP['without-portage']), slug: 'without-portage' },
      { name: strings.unknown_portage, count: obstacles.unknownPortage || 0, color: getColor(OBSTACLE_COLOR_MAP['unknown']), slug: 'unknown' }
    ];
  }

  /**
   * Builds protected area type segments from metrics data.
   *
   * @param {Array} byType - Array of { slug, name, count } from metrics
   * @returns {Array} Segments with slug added (colour assigned later by sort position)
   */
  function buildPASegments(byType) {
    var segments = [];
    for (var i = 0; i < byType.length; i++) {
      var item = byType[i];
      segments.push({ name: item.name, count: item.count, slug: item.slug });
    }
    return segments;
  }

  var strings = getStrings();

  var module = {
    id: 'statistics',

    getName: function() {
      return strings.name;
    },

    usesMap: false,

    activate: function(context) {
      destroyCharts();
      pendingCharts = [];

      var contentEl = context.contentEl || document.getElementById('dashboard-content');
      var descriptionEl = document.getElementById('dashboard-description');
      var titleEl = document.getElementById('dashboard-title');
      var metrics = (global.PaddelbuchDashboardData && global.PaddelbuchDashboardData.statisticsMetrics) || {};

      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      if (descriptionEl) {
        descriptionEl.innerHTML = strings.description;
      }

      var html = '';

      // --- Spots section ---
      var spots = metrics.spots || { total: 0, byType: [] };
      var spotSegments = buildSpotSegments(spots.byType || []);
      html += renderBarSection(strings.spots_title, spots.total || 0, spotSegments, 'spots', { gradient: SPOT_GRADIENT });

      // --- Obstacles section ---
      var obstacles = metrics.obstacles || { total: 0, withPortageRoute: 0, withoutPortageRoute: 0 };
      var obstacleSegments = buildObstacleSegments(obstacles, strings);
      html += renderBarSection(strings.obstacles_title, obstacles.total || 0, obstacleSegments, 'obstacles');

      // --- Protected areas section ---
      var protectedAreas = metrics.protectedAreas || { total: 0, byType: [] };
      var paSegments = buildPASegments(protectedAreas.byType || []);
      html += renderBarSection(strings.protected_areas_title, protectedAreas.total || 0, paSegments, 'protected-areas', { gradient: PA_GRADIENT });

      // --- Paddle craft types section ---
      var paddleCraftTypes = metrics.paddleCraftTypes || [];
      html += renderFiguresSection(strings.paddle_craft_title, paddleCraftTypes, { icons: PADDLE_CRAFT_ICONS });

      // --- Data source types section ---
      var dataSourceTypes = metrics.dataSourceTypes || [];
      html += renderFiguresSection(strings.data_source_title, dataSourceTypes);

      // --- Data license types section ---
      var dataLicenseTypes = metrics.dataLicenseTypes || [];
      html += renderFiguresSection(strings.data_license_title, dataLicenseTypes);

      if (contentEl) {
        contentEl.innerHTML = html;

        // Create Chart.js instances on the now-rendered canvas elements
        for (var i = 0; i < pendingCharts.length; i++) {
          var pending = pendingCharts[i];
          var canvas = contentEl.querySelector('canvas[data-chart-section="' + pending.section + '"]');
          createStackedBarChart(canvas, pending.segments);
        }
      }

      pendingCharts = [];
    },

    deactivate: function() {
      destroyCharts();

      var contentEl = document.getElementById('dashboard-content');
      if (contentEl) {
        contentEl.innerHTML = '';
      }

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
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchStatisticsDashboard = module;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
