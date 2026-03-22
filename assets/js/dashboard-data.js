/**
 * Paddelbuch Dashboard Data Module
 *
 * Parses pre-computed JSON data blocks from the dashboard page and exposes
 * them as structured arrays. All metric computation is done at Jekyll build
 * time by dashboard_metrics_generator.rb - this module only reads and exposes
 * the results.
 *
 * Expects six <script type="application/json"> elements in the page:
 *   #freshness-data            - array of freshness metric objects
 *   #freshness-summary-data    - object with waterway freshness category counts
 *   #coverage-data             - array of coverage metric objects
 *   #coverage-summary-data     - object with aggregate coverage lengths
 *   #statistics-data           - object of statistics metric data
 *   #spot-freshness-map-data   - array of per-spot freshness map objects
 *
 * Requirements: 5.1, 5.2, 5.3, 8.9, 8.10
 */

(function(global) {
  'use strict';

  /**
   * Safely parses a JSON script block by element id.
   * Returns an empty array if the element is missing or the JSON is invalid.
   *
   * @param {string} id - The id of the <script type="application/json"> element
   * @returns {Array} Parsed array or empty array on failure
   */
  function parseJsonBlock(id) {
    var el = document.getElementById(id);
    if (!el) {
      return [];
    }
    try {
      var data = JSON.parse(el.textContent);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Safely parses a JSON script block by element id, expecting an object.
   * Returns an empty object if the element is missing or the JSON is invalid.
   *
   * @param {string} id - The id of the <script type="application/json"> element
   * @returns {Object} Parsed object or empty object on failure
   */
  function parseJsonObjectBlock(id) {
    var el = document.getElementById(id);
    if (!el) {
      return {};
    }
    try {
      var data = JSON.parse(el.textContent);
      return (typeof data === 'object' && !Array.isArray(data)) ? data : {};
    } catch (e) {
      return {};
    }
  }

  var freshnessMetrics = parseJsonBlock('freshness-data');
  var freshnessSummary = parseJsonObjectBlock('freshness-summary-data');
  var coverageMetrics = parseJsonBlock('coverage-data');
  var coverageSummary = parseJsonObjectBlock('coverage-summary-data');
  var statisticsMetrics = parseJsonObjectBlock('statistics-data');
  var spotFreshnessMapData = parseJsonBlock('spot-freshness-map-data');
  var obstaclePortageMapData = parseJsonBlock('obstacle-portage-map-data');

  global.PaddelbuchDashboardData = {
    freshnessMetrics: freshnessMetrics,
    freshnessSummary: freshnessSummary,
    coverageMetrics: coverageMetrics,
    coverageSummary: coverageSummary,
    statisticsMetrics: statisticsMetrics,
    spotFreshnessMapData: spotFreshnessMapData,
    obstaclePortageMapData: obstaclePortageMapData
  };

})(typeof window !== 'undefined' ? window : this);
