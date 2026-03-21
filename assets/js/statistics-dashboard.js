/**
 * Paddelbuch Statistics Dashboard Module
 *
 * Renders pre-computed statistics metrics as summary figures and horizontal
 * stacked bar charts. Displays totals and breakdowns for spots, obstacles,
 * protected areas, paddle craft types, data source types, and data license
 * types.
 *
 * All metric computation is done at Jekyll build time by
 * statistics_metrics_generator.rb — this module only renders pre-computed data.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.6, 2.7, 3.1, 3.2,
 *               3.5, 3.6, 4.1, 4.2, 4.4, 4.5, 5.1, 5.4, 6.1, 6.4, 7.1,
 *               7.4, 8.10, 9.1, 9.4, 10.1, 10.4, 10.5, 11.3
 */

(function(global) {
  'use strict';

  var colors = global.PaddelbuchColors || {};

  /**
   * Colour-to-slug mapping for spot types.
   */
  var SPOT_COLOR_MAP = {
    'einstieg-ausstieg': 'spotTypeEntryExit',
    'nur-einstieg': 'spotTypeEntryOnly',
    'nur-ausstieg': 'spotTypeExitOnly',
    'rasthalte': 'spotTypeRest',
    'notauswasserungsstelle': 'spotTypeEmergency',
    'no-entry': 'spotTypeNoEntry'
  };

  /**
   * Colour-to-slug mapping for obstacle segments.
   */
  var OBSTACLE_COLOR_MAP = {
    'with-portage': 'obstacleWithPortage',
    'without-portage': 'obstacleWithoutPortage'
  };

  /**
   * Colour-to-slug mapping for protected area types.
   */
  var PA_COLOR_MAP = {
    'naturschutzgebiet': 'paTypeNaturschutzgebiet',
    'fahrverbotzone': 'paTypeFahrverbotzone',
    'schilfgebiet': 'paTypeSchilfgebiet',
    'schwimmbereich': 'paTypeSchwimmbereich',
    'industriegebiet': 'paTypeIndustriegebiet',
    'schiesszone': 'paTypeSchiesszone',
    'teleskizone': 'paTypeTeleskizone',
    'privatbesitz': 'paTypePrivatbesitz',
    'wasserskizone': 'paTypeWasserskizone'
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
      paddle_craft_title: 'Einstiegsorte nach Paddelboot-Typ',
      data_source_title: 'Einträge nach Datenquelle',
      data_license_title: 'Einträge nach Datenlizenz',
      with_portage: 'Mit Portage-Route',
      without_portage: 'Ohne Portage-Route',
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
   * Renders a summary figure (prominent number + label).
   *
   * @param {number} value - The numeric value to display
   * @param {string} label - The label text below the number
   * @returns {string} HTML string
   */
  function renderFigure(value, label) {
    var html = '<div class="statistics-figure">';
    html += '<div class="statistics-figure-value">' + escapeHtml(String(value)) + '</div>';
    html += '<div class="statistics-figure-label">' + escapeHtml(label) + '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Renders a horizontal stacked bar chart from an array of segments.
   *
   * @param {Array} segments - Array of { name, count, colorKey } objects
   * @param {number} total - The total count (sum of all segments)
   * @returns {string} HTML string for the bar
   */
  function renderStackedBar(segments, total) {
    var html = '<div class="statistics-bar">';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var pct = total > 0 ? (seg.count / total) * 100 : 0;
      html += '<div class="statistics-bar-segment" style="width:' + pct + '%;background-color:' + getColor(seg.colorKey) + ';">';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Renders a colour-coded legend for a set of segments.
   *
   * @param {Array} segments - Array of { name, colorKey } objects
   * @returns {string} HTML string for the legend
   */
  function renderLegend(segments) {
    var html = '<div class="statistics-legend">';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      html += '<div class="statistics-legend-item">';
      html += '<span class="statistics-legend-swatch" style="background-color:' + getColor(seg.colorKey) + ';"></span>';
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
   * @param {Array} segments - Array of { name, count, colorKey } objects
   * @returns {string} HTML string for the full section
   */
  function renderBarSection(title, total, segments) {
    var html = '<div class="statistics-section">';
    html += '<h3 class="statistics-section-title">' + escapeHtml(title) + '</h3>';
    html += '<div class="statistics-section-body">';
    html += renderFigure(total, escapeHtml(title));
    html += renderStackedBar(segments, total);
    html += '</div>';
    html += renderLegend(segments);
    html += '</div>';
    return html;
  }

  /**
   * Renders a section with only summary figures (no bar chart).
   *
   * @param {string} title - Section heading text
   * @param {Array} items - Array of { name, count } objects
   * @returns {string} HTML string for the figures section
   */
  function renderFiguresSection(title, items) {
    var html = '<div class="statistics-section">';
    html += '<h3 class="statistics-section-title">' + escapeHtml(title) + '</h3>';
    html += '<div class="statistics-figures-grid">';
    for (var i = 0; i < items.length; i++) {
      html += renderFigure(items[i].count, items[i].name);
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  /**
   * Builds spot type segments from metrics data.
   *
   * @param {Array} byType - Array of { slug, name, count } from metrics
   * @returns {Array} Segments with colorKey added
   */
  function buildSpotSegments(byType) {
    var segments = [];
    for (var i = 0; i < byType.length; i++) {
      var item = byType[i];
      var colorKey = SPOT_COLOR_MAP[item.slug] || 'spotTypeNoEntry';
      segments.push({ name: item.name, count: item.count, colorKey: colorKey });
    }
    return segments;
  }

  /**
   * Builds obstacle segments from metrics data.
   *
   * @param {Object} obstacles - { total, withPortageRoute, withoutPortageRoute }
   * @param {Object} strings - Localised string map
   * @returns {Array} Segments with colorKey added
   */
  function buildObstacleSegments(obstacles, strings) {
    return [
      { name: strings.with_portage, count: obstacles.withPortageRoute || 0, colorKey: OBSTACLE_COLOR_MAP['with-portage'] },
      { name: strings.without_portage, count: obstacles.withoutPortageRoute || 0, colorKey: OBSTACLE_COLOR_MAP['without-portage'] }
    ];
  }

  /**
   * Builds protected area type segments from metrics data.
   *
   * @param {Array} byType - Array of { slug, name, count } from metrics
   * @returns {Array} Segments with colorKey added
   */
  function buildPASegments(byType) {
    var segments = [];
    for (var i = 0; i < byType.length; i++) {
      var item = byType[i];
      var colorKey = PA_COLOR_MAP[item.slug] || 'paTypeNaturschutzgebiet';
      segments.push({ name: item.name, count: item.count, colorKey: colorKey });
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
      html += renderBarSection(strings.spots_title, spots.total || 0, spotSegments);

      // --- Obstacles section ---
      var obstacles = metrics.obstacles || { total: 0, withPortageRoute: 0, withoutPortageRoute: 0 };
      var obstacleSegments = buildObstacleSegments(obstacles, strings);
      html += renderBarSection(strings.obstacles_title, obstacles.total || 0, obstacleSegments);

      // --- Protected areas section ---
      var protectedAreas = metrics.protectedAreas || { total: 0, byType: [] };
      var paSegments = buildPASegments(protectedAreas.byType || []);
      html += renderBarSection(strings.protected_areas_title, protectedAreas.total || 0, paSegments);

      // --- Paddle craft types section ---
      var paddleCraftTypes = metrics.paddleCraftTypes || [];
      html += renderFiguresSection(strings.paddle_craft_title, paddleCraftTypes);

      // --- Data source types section ---
      var dataSourceTypes = metrics.dataSourceTypes || [];
      html += renderFiguresSection(strings.data_source_title, dataSourceTypes);

      // --- Data license types section ---
      var dataLicenseTypes = metrics.dataLicenseTypes || [];
      html += renderFiguresSection(strings.data_license_title, dataLicenseTypes);

      if (contentEl) {
        contentEl.innerHTML = html;
      }
    },

    deactivate: function() {
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
