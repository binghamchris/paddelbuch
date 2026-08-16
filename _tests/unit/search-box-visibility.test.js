/**
 * Search Box Visibility In The Filter Panel
 *
 * @jest-environment jsdom
 *
 * **Feature: semantic-search, Regression: search box must be visible without expanding the panel**
 * **Validates: Requirements 1.1, 1.5**
 *
 * The search box was originally rendered inside `.filter-panel-content`, which
 * carries `display: none` until the funnel toggle adds `.expanded`. The markup
 * was present and fully wired, but no search UI was visible on page load, so the
 * feature appeared to be missing entirely on the deployed site.
 *
 * These tests pin the placement: the search host must be a direct child of
 * `.filter-panel`, never a descendant of the collapsible content region.
 */

var fs = require('fs');
var path = require('path');

function getFilterPanelScript() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js'),
    'utf-8'
  );
}

/** Minimal Leaflet stubs, mirroring _tests/unit/filter-panel-toggles.test.js. */
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
      hasClass: function(el, name) { return el.classList.contains(name); },
      addClass: function(el, name) { el.classList.add(name); },
      removeClass: function(el, name) { el.classList.remove(name); }
    },
    DomEvent: {
      disableClickPropagation: function() {},
      disableScrollPropagation: function() {}
    }
  };
}

function loadFilterPanel() {
  var fn = new Function(getFilterPanelScript());
  fn();
  return window.PaddelbuchFilterPanel;
}

function createMockMap() {
  var handlers = {};
  return {
    on: function(event, handler) { handlers[event] = handler; },
    _handlers: handlers
  };
}

describe('Search box placement in the filter panel', () => {
  var panel;
  var received;

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.L;
    setupLeafletMocks();
    panel = loadFilterPanel();
    received = null;

    panel.init(createMockMap(), [], [], {
      onSearchHostReady: function(host) {
        received = host;
        var input = document.createElement('input');
        input.type = 'search';
        input.className = 'search-box-input';
        host.appendChild(input);
      }
    });
  });

  test('the search host callback receives an element', () => {
    expect(received).not.toBeNull();
    expect(received.className).toContain('filter-panel-search');
  });

  test('the search host is a DIRECT child of .filter-panel', () => {
    var host = document.querySelector('.filter-panel-search');
    expect(host).not.toBeNull();
    expect(host.parentElement.classList.contains('filter-panel')).toBe(true);
  });

  test('the search host is NOT inside the collapsible content region', () => {
    // .filter-panel-content is display:none until .expanded, so a search box
    // nested in it is invisible on page load. This is the regression guard.
    var content = document.querySelector('.filter-panel-content');
    expect(content).not.toBeNull();
    expect(content.querySelector('.filter-panel-search')).toBeNull();
    expect(content.querySelector('.search-box-input')).toBeNull();
  });

  test('the search input is reachable while the panel is collapsed', () => {
    var container = document.querySelector('.filter-panel');
    expect(container.classList.contains('expanded')).toBe(false);

    var input = document.querySelector('.search-box-input');
    expect(input).not.toBeNull();

    // Walk up from the input; it must not pass through the collapsible region.
    var node = input.parentElement;
    while (node && !node.classList.contains('filter-panel')) {
      expect(node.classList.contains('filter-panel-content')).toBe(false);
      node = node.parentElement;
    }
    expect(node).not.toBeNull();
  });

  test('the search host precedes the funnel toggle in document order', () => {
    var container = document.querySelector('.filter-panel');
    var children = Array.prototype.slice.call(container.children);
    var hostIndex = children.findIndex(function(el) {
      return el.classList.contains('filter-panel-search');
    });
    var toggleIndex = children.findIndex(function(el) {
      return el.classList.contains('filter-panel-toggle');
    });
    expect(hostIndex).toBeGreaterThanOrEqual(0);
    expect(toggleIndex).toBeGreaterThanOrEqual(0);
    expect(hostIndex).toBeLessThan(toggleIndex);
  });

  test('the panel still renders without a search callback', () => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.L;
    setupLeafletMocks();
    var p = loadFilterPanel();
    p.init(createMockMap(), [], [
      { key: 'noEntry', label: 'Rejected', layerGroup: { addTo: function() {}, remove: function() {} }, defaultChecked: false }
    ]);
    expect(document.querySelector('.filter-panel')).not.toBeNull();
    expect(document.querySelector('input[data-layer="noEntry"]')).not.toBeNull();
    // The slot exists but stays empty when no search module is configured.
    expect(document.querySelector('.filter-panel-search').children.length).toBe(0);
  });
});
