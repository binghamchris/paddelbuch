/**
 * Layer Styles Module
 * 
 * Defines GeoJSON styling for map layers including lakes, protected areas,
 * obstacles, portage routes, and event notice areas.
 * 
 * Requirements: 5.1, 5.2, 6.1, 7.2
 */

(function(global) {
  'use strict';

  /**
   * Paddel Buch color palette
   * Colors are injected at build time from _sass/settings/_paddelbuch_colours.scss
   * via the color_generator.rb plugin and the color-vars.html include.
   */
  var colors = window.PaddelbuchColors || {};

  /**
   * Lake/Waterway style
   * Used for rendering waterway boundaries on the map
   */
  var lakeStyle = {
    color: colors.secondaryBlue,
    weight: 2,
    fill: false,
    opacity: 1
  };

  /**
   * Protected Area style (Requirement 6.1)
   * Yellow semi-transparent polygons with dashed borders
   */
  var protectedAreaStyle = {
    color: colors.warningYellow,
    weight: 2,
    fill: true,
    fillColor: colors.warningYellow,
    fillOpacity: 0.6,
    dashArray: '1 10',
    opacity: 1
  };

  /**
   * Obstacle style (Requirement 5.1)
   * Red-colored GeoJSON polygons
   */
  var obstacleStyle = {
    color: colors.dangerRed,
    weight: 2,
    fill: true,
    fillColor: colors.dangerRed,
    fillOpacity: 0.8,
    lineJoin: 'bevel',
    lineCap: 'butt',
    opacity: 1
  };

  /**
   * Portage Route style (Requirement 5.2)
   * Purple dashed line for portage routes around obstacles
   */
  var portageStyle = {
    color: colors.routesPurple,
    weight: 4,
    fill: false,
    dashArray: '15 9 1 9',
    lineJoin: 'arcs',
    opacity: 1
  };

  /**
   * Waterway Event Notice Area style (Requirement 7.2)
   * Yellow semi-transparent polygon for affected areas
   */
  var waterwayEventNoticeAreaStyle = {
    color: colors.warningYellow,
    weight: 2,
    fill: true,
    fillColor: colors.warningYellow,
    fillOpacity: 0.4,
    dashArray: '12 9',
    opacity: 1
  };

  /**
   * Gets the appropriate style for a GeoJSON layer based on its type
   * 
   * @param {string} layerType - The type of layer ('lake', 'protectedArea', 'obstacle', 'portage', 'eventNotice')
   * @returns {Object} The Leaflet style object for the layer type
   */
  function getLayerStyle(layerType) {
    var styleMap = {
      'lake': lakeStyle,
      'waterway': lakeStyle,
      'protectedArea': protectedAreaStyle,
      'protected': protectedAreaStyle,
      'obstacle': obstacleStyle,
      'portage': portageStyle,
      'portageRoute': portageStyle,
      'eventNotice': waterwayEventNoticeAreaStyle,
      'waterwayEvent': waterwayEventNoticeAreaStyle,
      'eventArea': waterwayEventNoticeAreaStyle,
      'eventNoticeArea': waterwayEventNoticeAreaStyle
    };

    // Use hasOwnProperty to avoid inherited properties
    if (Object.prototype.hasOwnProperty.call(styleMap, layerType)) {
      return styleMap[layerType];
    }
    
    // Default to lake style if unknown type
    return lakeStyle;
  }

  /**
   * Creates a style function for Leaflet GeoJSON layers
   * This can be used with L.geoJSON's style option
   * 
   * @param {string} layerType - The type of layer
   * @returns {Function} A function that returns the style object
   */
  function createStyleFunction(layerType) {
    var style = getLayerStyle(layerType);
    return function(feature) {
      return style;
    };
  }

  // Export to global scope
  global.PaddelbuchLayerStyles = {
    colors: colors,
    lakeStyle: lakeStyle,
    protectedAreaStyle: protectedAreaStyle,
    obstacleStyle: obstacleStyle,
    portageStyle: portageStyle,
    waterwayEventNoticeAreaStyle: waterwayEventNoticeAreaStyle,
    getLayerStyle: getLayerStyle,
    createStyleFunction: createStyleFunction
  };

})(typeof window !== 'undefined' ? window : this);
