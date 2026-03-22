/**
 * Marker Registry Module
 *
 * Central registry of all spot markers and their metadata.
 * Provides O(1) lookup by slug and iteration for the Filter Engine.
 * Deduplicates entries -- registering the same slug twice is a no-op.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

(function(global) {
  'use strict';

  // Internal store keyed by slug for O(1) lookup
  var entries = {};

  /**
   * Register a spot marker with its metadata.
   * No-op if slug is already registered (deduplication).
   *
   * @param {string} slug - Unique spot identifier
   * @param {L.Marker} marker - Leaflet marker instance
   * @param {Object} metadata - { spotType_slug, paddleCraftTypes, paddlingEnvironmentType_slug }
   */
  function register(slug, marker, metadata) {
    if (entries[slug]) {
      return;
    }
    entries[slug] = {
      marker: marker,
      metadata: metadata
    };
  }

  /**
   * Check if a slug is already registered.
   *
   * @param {string} slug
   * @returns {boolean}
   */
  function has(slug) {
    return entries.hasOwnProperty(slug);
  }

  /**
   * Iterate over all registered entries.
   *
   * @param {Function} callback - function(slug, marker, metadata)
   */
  function forEach(callback) {
    var slugs = Object.keys(entries);
    for (var i = 0; i < slugs.length; i++) {
      var slug = slugs[i];
      var entry = entries[slug];
      callback(slug, entry.marker, entry.metadata);
    }
  }

  /**
   * Get the count of registered markers.
   *
   * @returns {number}
   */
  function size() {
    return Object.keys(entries).length;
  }

  // Expose on global scope
  global.PaddelbuchMarkerRegistry = {
    register: register,
    has: has,
    forEach: forEach,
    size: size
  };

})(typeof window !== 'undefined' ? window : this);
