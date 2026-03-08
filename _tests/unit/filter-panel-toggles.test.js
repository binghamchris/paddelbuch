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
 * Extract the JavaScript code from filter-panel.html's <script> tag.
 */
function getFilterPanelScript() {
  const htmlPath = path.join(__dirname, '..', '..', '_includes', 'filter-panel.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No <script> tag found in filter-panel.html');
  return scriptMatch[1];
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
  return {
    on: jest.fn(function(event, handler) {
      handlers[event] = handler;
    }),
    _handlers: handlers
  };
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

    test('popupopen sets parent container z-index to 0', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);

      // The container's parentNode is document.body in our test setup
      const container = document.querySelector('.filter-panel');
      const parentNode = container.parentNode;

      mockMap._handlers.popupopen();

      expect(parentNode.style.zIndex).toBe('0');
    });

    test('popupclose restores parent container z-index', () => {
      setupLeafletMocks();
      const panel = loadFilterPanel();
      const mockMap = createMockMap();

      panel.init(mockMap, [], []);

      const container = document.querySelector('.filter-panel');
      const parentNode = container.parentNode;

      // First collapse via popupopen
      mockMap._handlers.popupopen();
      expect(parentNode.style.zIndex).toBe('0');

      // Then restore via popupclose
      mockMap._handlers.popupclose();
      expect(parentNode.style.zIndex).toBe('');
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

      // Popup opens → panel collapses
      mockMap._handlers.popupopen();
      expect(container.classList.contains('expanded')).toBe(false);
    });
  });
});
