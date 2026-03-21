/**
 * Paddelbuch Spot Freshness Dashboard Module
 *
 * Renders per-spot freshness data as a horizontal stacked bar chart and
 * shaped, colour-coded Leaflet markers. Each spot is plotted on the shared
 * map with a shape (circle / triangle / square) and colour indicating its
 * freshness category. A shared legend explains both chart and map symbols.
 *
 * All metric computation is done at Jekyll build time by
 * statistics_metrics_generator.rb — this module only renders pre-computed data.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.3, 7.2
 */

(function(global) {
  'use strict';

  /**
   * Reads localised strings from a #spot-freshness-i18n JSON block on the page,
   * falling back to sensible German defaults when the block is absent.
   */
  function getStrings() {
    var defaults = {
      name: 'Einstiegsort-Aktualität',
      description: 'Aktualität der einzelnen Einstiegsorte.',
      fresh: 'Aktuell (≤ 2 Jahre)',
      aging: 'Alternd (2–5 Jahre)',
      stale: 'Veraltet (> 5 Jahre)',
      chart_title: 'Aktualität der Einstiegsorte'
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

  var strings = getStrings();

  var module = {
    id: 'spot-freshness',

    getName: function() {
      return strings.name;
    },

    usesMap: true,

    usesBoth: true,

    activate: function(context) {
      // Refresh i18n strings on each activation (page may have changed locale)
      strings = getStrings();

      var titleEl = document.getElementById('dashboard-title');
      if (titleEl) {
        titleEl.textContent = strings.name;
      }

      var descriptionEl = document.getElementById('dashboard-description');
      if (descriptionEl) {
        descriptionEl.innerHTML = strings.description;
      }

      // Chart, markers, and legend rendering will be added in subsequent tasks
    },

    deactivate: function() {
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

      // Chart destruction and marker removal will be added in subsequent tasks
    }
  };

  // Expose globally for testing and direct access
  global.PaddelbuchSpotFreshnessDashboard = module;

  // Expose getStrings for testing
  global.PaddelbuchSpotFreshnessDashboard.getStrings = getStrings;

  // Register on the dashboard registry
  (global.PaddelbuchDashboardRegistry = global.PaddelbuchDashboardRegistry || []).push(module);

})(typeof window !== 'undefined' ? window : this);
