/**
 * Tinylytics Beacon Module
 *
 * Dispatches Tinylytics events programmatically by creating a hidden beacon
 * element with the appropriate data attributes, firing a synthetic click
 * event on it, and removing it from the DOM.
 *
 * This is necessary because Tinylytics is purely attribute-based — it listens
 * for DOM click events on elements carrying `data-tinylytics-event`. When a
 * Leaflet marker or GeoJSON layer is clicked, the click lands on Leaflet's
 * internal DOM elements, never reaching popup content. This module bridges
 * that gap by dispatching a synthetic click on a correctly-annotated element.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

(function(global) {
  'use strict';

  /**
   * Dispatches a Tinylytics event by creating a hidden beacon element,
   * firing a synthetic click on it, and removing it.
   *
   * @param {string} eventName - The Tinylytics event name (e.g. 'marker.click')
   * @param {string} eventValue - The event value (e.g. entity slug)
   */
  function dispatch(eventName, eventValue) {
    if (!eventName) return;

    var beacon = document.createElement('div');
    beacon.className = 'tinylytics-beacon';
    beacon.setAttribute('data-tinylytics-event', eventName);
    beacon.setAttribute('data-tinylytics-event-value', eventValue);
    document.body.appendChild(beacon);
    beacon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.body.removeChild(beacon);
  }

  global.PaddelbuchTinylyticsBeacon = {
    dispatch: dispatch
  };

})(typeof window !== 'undefined' ? window : this);
