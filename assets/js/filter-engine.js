/**
 * Filter Engine Module
 *
 * Evaluates spot visibility across multiple filter dimensions using AND-logic.
 * Accepts a configuration array of dimensions, each with a match function.
 * Toggles individual marker visibility via addTo(map) / marker.remove().
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 2.5, 3.4, 3.5, 8.1, 8.2
 */

(function(global) {
  'use strict';

  var dimensionConfigs = [];
  var map = null;
  // filterState: { dimensionKey: Set of selected slugs }
  var filterState = {};

  /**
   * Initialize with dimension configuration and map reference.
   * Sets filter state with all options selected per dimension.
   *
   * @param {Array} configs - Array of dimension config objects
   * @param {L.Map} mapInstance - Leaflet map instance
   */
  function init(configs, mapInstance) {
    dimensionConfigs = configs || [];
    map = mapInstance;
    filterState = {};

    for (var i = 0; i < dimensionConfigs.length; i++) {
      var dim = dimensionConfigs[i];
      var selected = new Set();
      var options = dim.options || [];
      for (var j = 0; j < options.length; j++) {
        selected.add(options[j].slug);
      }
      filterState[dim.key] = selected;
    }
  }

  /**
   * Get the current filter state.
   *
   * @returns {Object} - { dimensionKey: Set of selected slugs, ... }
   */
  function getFilterState() {
    return filterState;
  }

  /**
   * Update selected options for a dimension.
   *
   * @param {string} dimensionKey - e.g. 'spotType', 'paddleCraftType'
   * @param {string} optionSlug - The slug being toggled
   * @param {boolean} selected - Whether the option is now selected
   */
  function setOption(dimensionKey, optionSlug, selected) {
    if (!filterState[dimensionKey]) {
      return;
    }
    if (selected) {
      filterState[dimensionKey].add(optionSlug);
    } else {
      filterState[dimensionKey].delete(optionSlug);
    }
  }

  /**
   * Evaluate a single marker against current filter state.
   * AND-logic: returns true if marker passes every active dimension.
   * Dimensions with empty selected set are inactive/skipped.
   * Wraps each matchFn in try/catch; on error treats dimension as not matched.
   *
   * @param {Object} metadata - Spot metadata from registry
   * @returns {boolean} - true if marker should be visible
   */
  function evaluateMarker(metadata) {
    for (var i = 0; i < dimensionConfigs.length; i++) {
      var dim = dimensionConfigs[i];
      var selected = filterState[dim.key];

      // Inactive dimension — skip
      if (!selected || selected.size === 0) {
        continue;
      }

      try {
        if (!dim.matchFn(metadata, selected)) {
          return false;
        }
      } catch (e) {
        console.warn('Filter dimension "' + dim.key + '" matchFn error:', e);
        return false;
      }
    }
    return true;
  }

  /**
   * Re-evaluate visibility for all markers in the registry.
   * Calls addTo(map) or marker.remove() per marker.
   */
  function applyFilters() {
    if (!map || !global.PaddelbuchMarkerRegistry) {
      return;
    }

    global.PaddelbuchMarkerRegistry.forEach(function(slug, marker, metadata) {
      if (evaluateMarker(metadata)) {
        marker.addTo(map);
      } else {
        marker.remove();
      }
    });
  }

  // Expose on global scope
  global.PaddelbuchFilterEngine = {
    init: init,
    getFilterState: getFilterState,
    setOption: setOption,
    applyFilters: applyFilters,
    evaluateMarker: evaluateMarker
  };

})(typeof window !== 'undefined' ? window : this);
