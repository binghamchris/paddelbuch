/**
 * Paddelbuch Dashboard Data Module
 *
 * Parses pre-computed JSON data blocks from the dashboard page and exposes
 * them as structured arrays. All metric computation is done at Jekyll build
 * time by dashboard_metrics_generator.rb — this module only reads and exposes
 * the results.
 *
 * Expects three <script type="application/json"> elements in the page:
 *   #freshness-data  — array of freshness metric objects
 *   #coverage-data   — array of coverage metric objects
 *   #statistics-data — object of statistics metric data
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
  var coverageMetrics = parseJsonBlock('coverage-data');
  var statisticsMetrics = parseJsonObjectBlock('statistics-data');

  global.PaddelbuchDashboardData = {
    freshnessMetrics: freshnessMetrics,
    coverageMetrics: coverageMetrics,
    statisticsMetrics: statisticsMetrics
  };

})(typeof window !== 'undefined' ? window : this);
