/**
 * Search Box Placement And Filter Panel Isolation
 *
 * @jest-environment jsdom
 *
 * **Feature: semantic-search, Regression: standalone search control beside the filter button**
 * **Validates: Requirements 1.1, 1.5, 1.7**
 *
 * The search box must be its OWN Leaflet control, positioned beside the filter
 * button, and must not touch the filter panel.
 *
 * Two earlier attempts failed and both are pinned here:
 *   1. Rendering inside `.filter-panel-content`, which is `display: none` until
 *      the funnel toggle expands it -- present in the DOM but invisible on load.
 *   2. Rendering as a direct child of `.filter-panel`, which made the panel
 *      wider and changed the filter button's appearance.
 */

var fs = require('fs');
var path = require('path');

var SemanticSearch = require(path.resolve(__dirname, '../../assets/js/semantic-search.js'));

function getFilterPanelScript() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'filter-panel.js'),
    'utf-8'
  );
}

/**
 * Leaflet stubs that reproduce corner containers, so control placement can be
 * asserted the way Leaflet actually nests it:
 *   div.leaflet-top.leaflet-left > div.leaflet-control > <control container>
 */
function setupLeafletMocks() {
  var corners = {};

  function corner(position) {
    if (corners[position]) return corners[position];
    var el = document.createElement('div');
    var vertical = position.indexOf('top') === 0 ? 'top' : 'bottom';
    var horizontal = position.indexOf('left') > -1 ? 'left' : 'right';
    el.className = 'leaflet-' + vertical + ' leaflet-' + horizontal;
    document.body.appendChild(el);
    corners[position] = el;
    return el;
  }

  window.L = {
    _corners: corners,
    Control: {
      extend: function(proto) {
        function Control() {
          this.options = Object.assign({}, proto.options || {});
          this._onAdd = proto.onAdd.bind(this);
        }
        Control.prototype.addTo = function(map) {
          var container = this._onAdd(map);
          // Real Leaflet adds the 'leaflet-control' class to the control's OWN
          // container and appends it directly to the corner -- it does not wrap
          // it in another element. Modelling that faithfully matters here,
          // because the search module reads container.parentNode to find the
          // corner it needs to mark.
          container.classList.add('leaflet-control');
          corner(this.options.position || 'topright').appendChild(container);
          this._container_el = container;
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
  return { on: function() {} };
}

var CONFIG = {
  endpoint: 'https://api.example.com/prod/search',
  apiKey: 'k',
  locale: 'de',
  limit: 40,
  minScore: 0.25,
  minQueryLength: 2,
  debounceMs: 350,
  dimensionKey: 'search',
  fitPadding: 40,
  fitMaxZoom: 12
};

describe('Standalone search control placement', () => {
  var map;

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.L;
    setupLeafletMocks();
    SemanticSearch._setConfigForTest(CONFIG);
    SemanticSearch._setStringsForTest(SemanticSearch.I18N_DEFAULTS);
    map = createMockMap();

    // Realistic order: the filter panel is added first, then the search control.
    loadFilterPanel().init(map, [], [
      {
        key: 'noEntry',
        label: 'Rejected',
        layerGroup: { addTo: function() {}, remove: function() {} },
        defaultChecked: false
      }
    ]);
    SemanticSearch.createControl(map);
  });

  test('the search box is rendered in its own .search-control container', () => {
    var control = document.querySelector('.search-control');
    expect(control).not.toBeNull();
    expect(control.querySelector('input.search-box-input')).not.toBeNull();
  });

  test('the search control is NOT inside the filter panel', () => {
    var panel = document.querySelector('.filter-panel');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('.search-control')).toBeNull();
    expect(panel.querySelector('.search-box-input')).toBeNull();
  });

  test('the search control is NOT inside the collapsible content region', () => {
    var content = document.querySelector('.filter-panel-content');
    expect(content).not.toBeNull();
    expect(content.querySelector('.search-box-input')).toBeNull();
  });

  test('the filter panel adds no search markup of its own', () => {
    // Requirement 1.7: the panel must be untouched by this feature.
    expect(document.querySelector('.filter-panel-search')).toBeNull();
  });

  test('both controls share the top-left corner as siblings', () => {
    var corner = document.querySelector('.leaflet-top.leaflet-left');
    expect(corner).not.toBeNull();
    expect(corner.querySelector('.filter-panel')).not.toBeNull();
    expect(corner.querySelector('.search-control')).not.toBeNull();
  });

  test('the search control comes after the filter panel, placing it to the right', () => {
    var corner = document.querySelector('.leaflet-top.leaflet-left');
    var children = Array.prototype.slice.call(corner.children);
    var panelIndex = children.findIndex(function(el) {
      return el.classList.contains('filter-panel');
    });
    var searchIndex = children.findIndex(function(el) {
      return el.classList.contains('search-control');
    });
    expect(panelIndex).toBeGreaterThanOrEqual(0);
    expect(searchIndex).toBeGreaterThan(panelIndex);
  });

  test('the corner is marked so only this corner is laid out as a row', () => {
    // The CSS row rule is scoped to .has-search-control, so no other corner or
    // page can be affected.
    var corner = document.querySelector('.leaflet-top.leaflet-left');
    expect(corner.classList.contains('has-search-control')).toBe(true);
  });

  test('the search box is reachable while the filter panel is collapsed', () => {
    var panel = document.querySelector('.filter-panel');
    expect(panel.classList.contains('expanded')).toBe(false);

    var input = document.querySelector('.search-box-input');
    var node = input.parentElement;
    while (node && node !== document.body) {
      expect(node.classList.contains('filter-panel-content')).toBe(false);
      expect(node.classList.contains('filter-panel')).toBe(false);
      node = node.parentElement;
    }
  });

  test('no search control is created when search is unconfigured', () => {
    document.body.innerHTML = '';
    delete window.L;
    setupLeafletMocks();
    SemanticSearch._setConfigForTest(null);
    expect(SemanticSearch.createControl(createMockMap())).toBeNull();
    expect(document.querySelector('.search-control')).toBeNull();
  });

  test('the filter panel still renders normally when search is unconfigured', () => {
    document.body.innerHTML = '';
    delete window.PaddelbuchFilterPanel;
    delete window.L;
    setupLeafletMocks();
    SemanticSearch._setConfigForTest(null);

    loadFilterPanel().init(createMockMap(), [], [
      {
        key: 'noEntry',
        label: 'Rejected',
        layerGroup: { addTo: function() {}, remove: function() {} },
        defaultChecked: false
      }
    ]);

    expect(document.querySelector('.filter-panel')).not.toBeNull();
    expect(document.querySelector('input[data-layer="noEntry"]')).not.toBeNull();
    var corner = document.querySelector('.leaflet-top.leaflet-left');
    expect(corner.classList.contains('has-search-control')).toBe(false);
  });
});

describe('Filter panel source is free of search coupling', () => {
  test('filter-panel.js contains no search or callback plumbing', () => {
    // The panel was reverted to its original form; this guards against the
    // coupling creeping back in and changing the filter button again.
    var src = getFilterPanelScript();
    expect(src).not.toMatch(/search/i);
    expect(src).not.toMatch(/onSearchHostReady/);
    expect(src).not.toMatch(/panelOptions/);
  });
});
