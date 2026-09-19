/**
 * @jest-environment jsdom
 */

/**
 * Unit Tests for Filter Panel Toggles
 *
 * Tests non-spot layer toggles (rejected spots, event notices, obstacles,
 * protected areas) and popup collapse behavior.
 *
 * Requirements: 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 5.8
 */

const fs = require('fs');
const path = require('path');

/**
 * Read the JavaScript code for the filter panel.
 * After CSP extraction, the code lives in assets/js/filter-panel.js
 * rather than inline in filter-panel.html.
 */
function getFilterPanelScript() {
  const jsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js');
  return fs.readFileSync(jsPath, 'utf-8');
}

/**
 * Set up Leaflet mocks on the global/window object.
 */
function setupLeafletMocks() {
  window.L = {
    Control: {
      extend: function(proto) {
        function Control() {
          this.options = Object.assign({}, proto.options || {});
          this._onAdd = proto.onAdd.bind(this);
        }
        Control.prototype.addTo = function(map) {
          var container = this._onAdd(map);
          this._container_el = container;
          document.body.appendChild(container);
          return this;
        };
        Control.prototype.getContainer = function() {
          return this._container_el;
        };
        return Control;
      }
    },
    DomUtil: {
      create: function(tagName, className, parentEl) {
        var el = document.createElement(tagName);
        if (className) el.className = className;
        if (parentEl) parentEl.appendChild(el);
        return el;
      },
      hasClass: function(el, name) {
        return el.classList.contains(name);
      },
      addClass: function(el, name) {
        el.classList.add(name);
      },
      removeClass: function(el, name) {
        el.classList.remove(name);
      }
    },
    DomEvent: {
      disableClickPropagation: function() {},
      disableScrollPropagation: function() {}
    }
  };
}

/**
 * Create a mock LayerGroup with addTo/remove tracking.
 */
function createMockLayerGroup() {
  return {
    addTo: jest.fn(),
    remove: jest.fn()
  };
}

/**
 * Create a mock map that captures event handlers registered via map.on().
 */
function createMockMap() {
  const handlers = {};
  const map = {
    on: jest.fn(function(event, handler) {
      handlers[event] = handler;
    }),
    // Records the last panBy so tests can assert whether, and how far, the map
    // was moved to get a popup clear of the controls.
    panBy: jest.fn(function(offset) {
      map._pannedBy = offset;
    }),
    getSize: jest.fn(function() {
      return { x: 800, y: 600 };
    }),
    _pannedBy: null,
    _handlers: handlers
  };
  return map;
}

/**
 * Load a fresh FilterPanel instance by evaluating the script.
 */
function loadFilterPanel() {
  const script = getFilterPanelScript();
  const fn = new Function(script);
  fn();
  return window.PaddelbuchFilterPanel;
}

/**
 * Expand the filter panel by clicking the toggle button.
 */
function expandPanel() {
  const toggleBtn = document.querySelector('.filter-panel-toggle');
  toggleBtn.click();
}

describe('Filter Panel Toggles', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.PaddelbuchFilterEngine;
    delete window.L;
  });

  describe('Rejected spot toggle (Req 6.2, 6.3, 6.4)', () => {
    test('rejected spot toggle is unchecked by default', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const noEntryGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'noEntry', label: 'Rejected Spots', layerGroup: noEntryGroup, defaultChecked: false }
      ]);

      const checkbox = document.querySelector('input[data-layer="noEntry"]');
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(false);
    });

    test('checking rejected spot toggle adds noEntry LayerGroup to map', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const noEntryGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'noEntry', label: 'Rejected Spots', layerGroup: noEntryGroup, defaultChecked: false }
      ]);

      const checkbox = document.querySelector('input[data-layer="noEntry"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(noEntryGroup.addTo).toHaveBeenCalledWith(mockMap);
      expect(noEntryGroup.remove).not.toHaveBeenCalled();
    });

    test('unchecking rejected spot toggle removes noEntry LayerGroup from map', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const noEntryGroup = createMockLayerGroup();

      // Start checked so we can uncheck
      panel.init(mockMap, [], [
        { key: 'noEntry', label: 'Rejected Spots', layerGroup: noEntryGroup, defaultChecked: true }
      ]);

      const checkbox = document.querySelector('input[data-layer="noEntry"]');
      expect(checkbox.checked).toBe(true);

      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(noEntryGroup.remove).toHaveBeenCalled();
      expect(noEntryGroup.addTo).not.toHaveBeenCalled();
    });

    test('rejected spot toggle operates independently of other layer toggles', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const noEntryGroup = createMockLayerGroup();
      const eventNoticesGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'noEntry', label: 'Rejected Spots', layerGroup: noEntryGroup, defaultChecked: false },
        { key: 'eventNotices', label: 'Event Notices', layerGroup: eventNoticesGroup, defaultChecked: true }
      ]);

      // Toggle rejected spots on
      const noEntryCheckbox = document.querySelector('input[data-layer="noEntry"]');
      noEntryCheckbox.checked = true;
      noEntryCheckbox.dispatchEvent(new Event('change'));

      // Only noEntry should be affected
      expect(noEntryGroup.addTo).toHaveBeenCalledWith(mockMap);
      expect(eventNoticesGroup.addTo).not.toHaveBeenCalled();
      expect(eventNoticesGroup.remove).not.toHaveBeenCalled();
    });
  });

  describe('Non-spot layer toggles (Req 7.1, 7.2, 7.3)', () => {
    test('event notices, obstacles, and protected areas toggles are checked by default', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], [
        { key: 'eventNotices', label: 'Event Notices', layerGroup: createMockLayerGroup(), defaultChecked: true },
        { key: 'obstacles', label: 'Obstacles', layerGroup: createMockLayerGroup(), defaultChecked: true },
        { key: 'protectedAreas', label: 'Protected Areas', layerGroup: createMockLayerGroup(), defaultChecked: true }
      ]);

      expect(document.querySelector('input[data-layer="eventNotices"]').checked).toBe(true);
      expect(document.querySelector('input[data-layer="obstacles"]').checked).toBe(true);
      expect(document.querySelector('input[data-layer="protectedAreas"]').checked).toBe(true);
    });

    test('unchecking event notices toggle removes its LayerGroup', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const eventNoticesGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'eventNotices', label: 'Event Notices', layerGroup: eventNoticesGroup, defaultChecked: true }
      ]);

      const checkbox = document.querySelector('input[data-layer="eventNotices"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(eventNoticesGroup.remove).toHaveBeenCalled();
      expect(eventNoticesGroup.addTo).not.toHaveBeenCalled();
    });

    test('re-checking event notices toggle adds its LayerGroup back', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const eventNoticesGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'eventNotices', label: 'Event Notices', layerGroup: eventNoticesGroup, defaultChecked: false }
      ]);

      const checkbox = document.querySelector('input[data-layer="eventNotices"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(eventNoticesGroup.addTo).toHaveBeenCalledWith(mockMap);
    });

    test('unchecking obstacles toggle removes its LayerGroup', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const obstaclesGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'obstacles', label: 'Obstacles', layerGroup: obstaclesGroup, defaultChecked: true }
      ]);

      const checkbox = document.querySelector('input[data-layer="obstacles"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(obstaclesGroup.remove).toHaveBeenCalled();
    });

    test('unchecking protected areas toggle removes its LayerGroup', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const protectedAreasGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'protectedAreas', label: 'Protected Areas', layerGroup: protectedAreasGroup, defaultChecked: true }
      ]);

      const checkbox = document.querySelector('input[data-layer="protectedAreas"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      expect(protectedAreasGroup.remove).toHaveBeenCalled();
    });

    test('each layer toggle controls only its own LayerGroup', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      const eventNoticesGroup = createMockLayerGroup();
      const obstaclesGroup = createMockLayerGroup();
      const protectedAreasGroup = createMockLayerGroup();

      panel.init(mockMap, [], [
        { key: 'eventNotices', label: 'Event Notices', layerGroup: eventNoticesGroup, defaultChecked: true },
        { key: 'obstacles', label: 'Obstacles', layerGroup: obstaclesGroup, defaultChecked: true },
        { key: 'protectedAreas', label: 'Protected Areas', layerGroup: protectedAreasGroup, defaultChecked: true }
      ]);

      // Toggle only obstacles off
      const obstaclesCheckbox = document.querySelector('input[data-layer="obstacles"]');
      obstaclesCheckbox.checked = false;
      obstaclesCheckbox.dispatchEvent(new Event('change'));

      expect(obstaclesGroup.remove).toHaveBeenCalled();
      expect(eventNoticesGroup.addTo).not.toHaveBeenCalled();
      expect(eventNoticesGroup.remove).not.toHaveBeenCalled();
      expect(protectedAreasGroup.addTo).not.toHaveBeenCalled();
      expect(protectedAreasGroup.remove).not.toHaveBeenCalled();
    });
  });

  describe('Popup collapse behavior (Req 5.8)', () => {
    test('popupopen collapses the filter panel', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);

      // Expand the panel first
      expandPanel();
      const container = document.querySelector('.filter-panel');
      expect(container.classList.contains('expanded')).toBe(true);

      // Simulate popupopen
      mockMap._handlers.popupopen();

      expect(container.classList.contains('expanded')).toBe(false);
      const toggleBtn = document.querySelector('.filter-panel-toggle');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

    // These replace two earlier tests that asserted the control corner's z-index
    // was forced to '0' on popupopen and restored on popupclose. That mechanism
    // was removed: dropping the corner to 0 put it below .leaflet-map-pane
    // (stacking context at 400), so every marker (600) painted over the filter
    // panel and the search box and swallowed clicks meant for them. The tests
    // went with the mechanism -- they pinned an implementation detail, not
    // Requirement 5.8, which only asks for the panel to collapse.
    test('popupopen leaves the control corner z-index alone', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);

      const parentNode = document.querySelector('.filter-panel').parentNode;
      const before = parentNode.style.zIndex;

      mockMap._handlers.popupopen();

      // Untouched, so the Leaflet default (1000) keeps controls above markers.
      expect(parentNode.style.zIndex).toBe(before);
      expect(parentNode.style.zIndex).not.toBe('0');
    });

    test('no popupclose handler is registered, since nothing needs restoring', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);

      expect(mockMap._handlers.popupclose).toBeUndefined();
    });

    test('popupopen still collapses the panel (Requirement 5.8)', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);
      const container = document.querySelector('.filter-panel');
      container.classList.add('expanded');

      mockMap._handlers.popupopen();

      expect(container.classList.contains('expanded')).toBe(false);
    });

    test('a popup overlapping the controls pans the map clear of them', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      panel.init(mockMap, [], []);

      const corner = document.querySelector('.filter-panel').parentNode;
      corner.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 300, bottom: 40, width: 300, height: 40
      });
      const popupEl = document.createElement('div');
      popupEl.getBoundingClientRect = () => ({
        left: 100, top: 10, right: 400, bottom: 200, width: 300, height: 190
      });

      mockMap._handlers.popupopen({ popup: { getElement: () => popupEl } });

      // 30px of vertical overlap plus the 8px gap.
      expect(mockMap._pannedBy).toEqual([0, -38]);
    });

    test('a popup nowhere near the controls does not move the map', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      panel.init(mockMap, [], []);

      const corner = document.querySelector('.filter-panel').parentNode;
      corner.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 300, bottom: 40, width: 300, height: 40
      });
      const popupEl = document.createElement('div');
      popupEl.getBoundingClientRect = () => ({
        left: 500, top: 400, right: 700, bottom: 560, width: 200, height: 160
      });

      mockMap._handlers.popupopen({ popup: { getElement: () => popupEl } });

      expect(mockMap._pannedBy).toBeNull();
    });

    test('the pan is capped so a huge popup cannot fling the marker off screen', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      panel.init(mockMap, [], []);

      const corner = document.querySelector('.filter-panel').parentNode;
      corner.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 300, bottom: 900, width: 300, height: 900
      });
      const popupEl = document.createElement('div');
      popupEl.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 300, bottom: 900, width: 300, height: 900
      });

      mockMap._handlers.popupopen({ popup: { getElement: () => popupEl } });

      // Map height is 600 in the mock, so the shift is capped at half of it.
      expect(mockMap._pannedBy).toEqual([0, -300]);
    });

    test('a popupopen without a popup is handled without throwing', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();
      panel.init(mockMap, [], []);

      expect(() => mockMap._handlers.popupopen()).not.toThrow();
      expect(() => mockMap._handlers.popupopen({})).not.toThrow();
      expect(mockMap._pannedBy).toBeNull();
    });

    test('popupopen collapses panel even when layer toggles are present', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [
        { key: 'spotType', label: 'Spot Type', options: [{ slug: 'test', label: 'Test' }], matchFn: function() { return true; } }
      ], [
        { key: 'noEntry', label: 'Rejected', layerGroup: createMockLayerGroup(), defaultChecked: false }
      ]);

      // Expand
      expandPanel();
      const container = document.querySelector('.filter-panel');
      expect(container.classList.contains('expanded')).toBe(true);

      // Popup opens -> panel collapses
      mockMap._handlers.popupopen();
      expect(container.classList.contains('expanded')).toBe(false);
    });
  });
});
