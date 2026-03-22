/**
 * Paddelbuch Dashboard Switcher Module
 *
 * Reads PaddelbuchDashboardRegistry, creates styled buttons
 * inside #dashboard-switcher, and manages activation/deactivation of
 * dashboard modules. On load, activates the first registered dashboard.
 *
 * Container visibility logic:
 *   - usesMap true:  show #dashboard-map, hide #dashboard-content
 *   - usesMap false: hide #dashboard-map, show #dashboard-content
 *   - usesBoth true: show both #dashboard-map and #dashboard-content
 *   - #dashboard-legend is always visible (each dashboard manages its content)
 *
 * Requirements: 1.5, 1.6, 1.7, 7.2, 7.4, 7.5, 7.6
 */

(function(global) {
  'use strict';

  var registry = global.PaddelbuchDashboardRegistry || [];
  var switcherEl = document.getElementById('dashboard-switcher');
  var mapEl = document.getElementById('dashboard-map');
  var contentEl = document.getElementById('dashboard-content');
  var legendEl = document.getElementById('dashboard-legend');

  var activeDashboard = null;

  /**
   * Builds the activation context object passed to each dashboard's
   * activate() method.
   *
   * @returns {Object} context with map, contentEl, legendEl, data
   */
  function buildContext() {
    var map = (global.PaddelbuchDashboardMap && global.PaddelbuchDashboardMap.getMap)
      ? global.PaddelbuchDashboardMap.getMap()
      : null;

    return {
      map: map,
      contentEl: contentEl,
      legendEl: legendEl,
      data: global.PaddelbuchDashboardData || {}
    };
  }

  /**
   * Shows or hides the map and content containers based on the dashboard's
   * usesMap and usesBoth flags.
   *
   * @param {Object} dashboard - The dashboard module object
   */
  function updateContainerVisibility(dashboard) {
    var showMap = dashboard.usesMap || dashboard.usesBoth;
    var showContent = !dashboard.usesMap || dashboard.usesBoth;

    if (mapEl) {
      mapEl.style.display = showMap ? '' : 'none';
    }
    if (contentEl) {
      contentEl.style.display = showContent ? '' : 'none';
    }
  }

  /**
   * Deactivates the currently active dashboard, if any.
   */
  function deactivateCurrent() {
    if (activeDashboard && typeof activeDashboard.deactivate === 'function') {
      activeDashboard.deactivate();
    }
    activeDashboard = null;
  }

  /**
   * Activates a dashboard by id. Deactivates the current one first,
   * updates container visibility, calls activate(), and refreshes the
   * map size if needed.
   *
   * @param {string} dashboardId - The id of the dashboard to activate
   */
  function activateDashboard(dashboardId) {
    var dashboard = null;
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === dashboardId) {
        dashboard = registry[i];
        break;
      }
    }
    if (!dashboard) {
      return;
    }

    deactivateCurrent();
    updateContainerVisibility(dashboard);

    var context = buildContext();
    dashboard.activate(context);
    activeDashboard = dashboard;

    // After activating a map-based dashboard, invalidate the map size so
    // Leaflet re-measures the container (it may have been hidden).
    if ((dashboard.usesMap || dashboard.usesBoth) && context.map && typeof context.map.invalidateSize === 'function') {
      context.map.invalidateSize();
    }
  }

  /**
   * Updates the active CSS class on tab buttons.
   *
   * @param {string} dashboardId - The id of the newly active dashboard
   */
  function updateActiveTab(dashboardId) {
    if (!switcherEl) {
      return;
    }
    var buttons = switcherEl.querySelectorAll('[data-dashboard-id]');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-dashboard-id') === dashboardId) {
        buttons[i].classList.add('active');
      } else {
        buttons[i].classList.remove('active');
      }
    }
  }

  /**
   * Handles a tab button click.
   *
   * @param {string} dashboardId - The id of the clicked dashboard tab
   */
  function onTabClick(dashboardId) {
    if (activeDashboard && activeDashboard.id === dashboardId) {
      return; // Already active
    }
    updateActiveTab(dashboardId);
    activateDashboard(dashboardId);
  }

  /**
   * Builds the button-group UI from the registry and inserts it
   * into #dashboard-switcher.
   */
  function buildTabs() {
    if (!switcherEl || registry.length === 0) {
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'dashboard-switcher-buttons';

    for (var i = 0; i < registry.length; i++) {
      var dashboard = registry[i];

      var btn = document.createElement('button');
      btn.className = 'dashboard-switcher-btn';
      btn.setAttribute('data-dashboard-id', dashboard.id);
      btn.textContent = typeof dashboard.getName === 'function'
        ? dashboard.getName()
        : dashboard.id;

      // Mark the first button as active
      if (i === 0) {
        btn.classList.add('active');
      }

      // Closure to capture the dashboard id
      (function(id) {
        btn.addEventListener('click', function() {
          onTabClick(id);
        });
      })(dashboard.id);

      wrapper.appendChild(btn);
    }

    switcherEl.appendChild(wrapper);
  }

  /**
   * Initialises the switcher: builds tabs and activates the first dashboard.
   */
  function init() {
    buildTabs();

    if (registry.length > 0) {
      activateDashboard(registry[0].id);
    }
  }

  // Expose globally for testing and direct access
  global.PaddelbuchDashboardSwitcher = {
    init: init,
    activateDashboard: function(id) {
      updateActiveTab(id);
      activateDashboard(id);
    },
    getActiveDashboard: function() {
      return activeDashboard;
    }
  };

  // Auto-initialise
  init();

})(typeof window !== 'undefined' ? window : this);
