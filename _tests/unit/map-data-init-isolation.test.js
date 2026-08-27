/**
 * @jest-environment jsdom
 */

/**
 * Requirement 2: a search fault must not cost the map its markers.
 *
 * This is the first test that EXECUTES assets/js/map-data-init.js. The existing
 * coverage (map-layers-data-init.property.test.js, map-layers-preservation.
 * property.test.js) only reads its source text, which cannot answer the question
 * this requirement asks: does the initial data load still happen when a search
 * call throws?
 *
 * A regex over the source asserting the calls sit inside a try/catch was
 * deliberately rejected. It would pass while the behaviour was broken -- a catch
 * that rethrows, or a load moved above the catch -- and break while the behaviour
 * was fine.
 *
 * Executing the module means standing up every global it touches on the way to the
 * data load. That harness is the cost of the requirement, and it is paid here.
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.join(__dirname, '..', '..', 'assets', 'js', 'map-data-init.js');
const moduleSource = fs.readFileSync(MODULE_PATH, 'utf-8');

/** Minimal Leaflet stand-in: only what the module actually calls. */
function makeLeafletStub() {
  return {
    layerGroup: () => ({ addTo: jest.fn(), addLayer: jest.fn(), clearLayers: jest.fn() }),
    marker: () => ({ addTo: jest.fn(), on: jest.fn(), bindPopup: jest.fn() }),
    divIcon: () => ({}),
    latLngBounds: () => ({ isValid: () => true })
  };
}

function makeMapStub() {
  return {
    getBounds: () => ({
      getSouth: () => 45.8, getWest: () => 5.9, getNorth: () => 47.8, getEast: () => 10.5
    }),
    getZoom: () => 10,
    on: jest.fn(),
    getContainer: () => document.getElementById('map'),
    getPanes: () => ({}),
    addLayer: jest.fn(),
    removeLayer: jest.fn()
  };
}

/**
 * Install the globals map-data-init needs, and return the spies the tests assert
 * on. `search` decides how the search module misbehaves.
 */
function setupGlobals(options) {
  const opts = options || {};

  document.body.innerHTML =
    '<div id="map"></div>' +
    '<script type="application/json" id="map-data-config">' +
    JSON.stringify({
      locale: 'de',
      dimensionConfigs: [
        { key: 'spotType', label: 'Typ', options: [{ value: 'slipway', label: 'Slipway' }] }
      ],
      layerLabels: { noEntry: 'Gesperrt', eventNotices: 'Hinweise', obstacles: 'Hindernisse', protectedAreas: 'Schutzgebiete' }
    }) +
    '</script>';

  const loadDataForBounds = jest.fn(() => Promise.resolve({ spots: [] }));
  const engineInit = jest.fn();
  const panelInit = jest.fn();
  const setDimensionSelection = jest.fn();

  global.L = makeLeafletStub();
  window.L = global.L;
  window.paddelbuchMap = makeMapStub();
  window.paddelbuchLayerGroups = {
    spots: { addTo: jest.fn(), addLayer: jest.fn() },
    noEntry: { addTo: jest.fn(), addLayer: jest.fn() },
    eventNotices: { addTo: jest.fn(), addLayer: jest.fn() },
    obstacles: { addTo: jest.fn(), addLayer: jest.fn() },
    protectedAreas: { addTo: jest.fn(), addLayer: jest.fn() }
  };

  window.PaddelbuchFilterEngine = {
    init: engineInit,
    applyFilters: jest.fn(),
    setDimensionSelection,
    evaluateMarker: jest.fn(() => true)
  };
  window.PaddelbuchFilterPanel = { init: panelInit };
  window.PaddelbuchMarkerRegistry = { register: jest.fn(), get: jest.fn(), all: jest.fn(() => []) };
  window.PaddelbuchSpatialUtils = {
    leafletBoundsToObject: () => ({ south: 45.8, west: 5.9, north: 47.8, east: 10.5 })
  };
  window.PaddelbuchDataLoader = { loadDataForBounds };
  window.PaddelbuchZoomLayerManager = { initZoomLayerManager: jest.fn() };

  const getDimensionConfig = jest.fn(() => ({
    key: 'search', label: '', options: [], matchFn: () => true
  }));
  const createControl = jest.fn();

  if (opts.search === 'absent') {
    delete window.PaddelbuchSemanticSearch;
  } else {
    window.PaddelbuchSemanticSearch = {
      isConfigured: () => opts.search !== 'unconfigured',
      getDimensionConfig: opts.search === 'throwOnDimension'
        ? jest.fn(() => { throw new Error('boom: getDimensionConfig'); })
        : getDimensionConfig,
      createControl: opts.search === 'throwOnControl'
        ? jest.fn(() => { throw new Error('boom: createControl'); })
        : createControl
    };
  }

  return { loadDataForBounds, engineInit, panelInit, getDimensionConfig, createControl };
}

/** Load and run the module, then let its deferred start fire. */
function runModule() {
  // eslint-disable-next-line no-new-func
  new Function(moduleSource)();
  jest.advanceTimersByTime(250);
}

describe('map-data-init resilience to search faults', () => {
  let warn;

  beforeEach(() => {
    jest.useFakeTimers();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
    delete window.PaddelbuchSemanticSearch;
  });

  describe('the harness itself', () => {
    // If this fails, every assertion below is vacuous.
    test('the module runs and loads data when nothing is wrong', () => {
      const spies = setupGlobals({ search: 'ok' });

      runModule();

      expect(spies.engineInit).toHaveBeenCalled();
      expect(spies.panelInit).toHaveBeenCalled();
      expect(spies.loadDataForBounds).toHaveBeenCalled();
      expect(spies.createControl).toHaveBeenCalled();
    });

    test('search is registered as an extra engine dimension when healthy', () => {
      const spies = setupGlobals({ search: 'ok' });

      runModule();

      const dimensions = spies.engineInit.mock.calls[0][0];
      expect(dimensions.map((d) => d.key)).toContain('search');
    });
  });

  describe('when getDimensionConfig throws', () => {
    test('the initial data load still runs', () => {
      const spies = setupGlobals({ search: 'throwOnDimension' });

      runModule();

      expect(spies.loadDataForBounds).toHaveBeenCalled();
    });

    test('the filter engine is still initialised', () => {
      const spies = setupGlobals({ search: 'throwOnDimension' });

      runModule();

      expect(spies.engineInit).toHaveBeenCalled();
    });

    test('the engine gets the checkbox dimensions without a half-built search one', () => {
      const spies = setupGlobals({ search: 'throwOnDimension' });

      runModule();

      const dimensions = spies.engineInit.mock.calls[0][0];
      expect(dimensions.map((d) => d.key)).toEqual(['spotType']);
    });

    test('no search control is created, since search is now off', () => {
      const spies = setupGlobals({ search: 'throwOnDimension' });

      runModule();

      expect(spies.createControl).not.toHaveBeenCalled();
    });

    test('the failure is logged rather than swallowed silently', () => {
      setupGlobals({ search: 'throwOnDimension' });

      runModule();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('continuing without search'), expect.anything());
    });
  });

  describe('when createControl throws', () => {
    test('the initial data load still runs', () => {
      const spies = setupGlobals({ search: 'throwOnControl' });

      runModule();

      expect(spies.loadDataForBounds).toHaveBeenCalled();
    });

    test('the filter panel is still initialised', () => {
      const spies = setupGlobals({ search: 'throwOnControl' });

      runModule();

      expect(spies.panelInit).toHaveBeenCalled();
    });

    test('the already-registered search dimension cannot hide markers', () => {
      // The dimension is registered before createControl runs, so it stays in the
      // engine. It is declared with no options, which means an empty selection --
      // and the engine treats an empty selection as an inactive dimension it
      // skips. That is what stops a half-initialised search hiding every spot.
      const spies = setupGlobals({ search: 'throwOnControl' });

      runModule();

      const dimensions = spies.engineInit.mock.calls[0][0];
      const searchDimension = dimensions.find((d) => d.key === 'search');
      expect(searchDimension).toBeDefined();
      expect(searchDimension.options).toEqual([]);
    });

    test('the failure is logged', () => {
      setupGlobals({ search: 'throwOnControl' });

      runModule();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('continuing without search'), expect.anything());
    });
  });

  describe('when the search module is absent entirely', () => {
    // The state of a build with the feature flag on, or a 404 on the script.
    test('the map initialises and loads data with no search dimension', () => {
      const spies = setupGlobals({ search: 'absent' });

      runModule();

      expect(spies.loadDataForBounds).toHaveBeenCalled();
      expect(spies.engineInit).toHaveBeenCalled();
      const dimensions = spies.engineInit.mock.calls[0][0];
      expect(dimensions.map((d) => d.key)).toEqual(['spotType']);
    });

    test('nothing is logged, because this is a supported configuration', () => {
      setupGlobals({ search: 'absent' });

      runModule();

      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining('continuing without search'), expect.anything());
    });
  });

  describe('when search is present but not configured', () => {
    test('the map initialises with no search dimension and no control', () => {
      const spies = setupGlobals({ search: 'unconfigured' });

      runModule();

      expect(spies.loadDataForBounds).toHaveBeenCalled();
      expect(spies.getDimensionConfig).not.toHaveBeenCalled();
      expect(spies.createControl).not.toHaveBeenCalled();
    });
  });
});
