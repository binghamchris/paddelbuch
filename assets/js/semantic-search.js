/**
 * Semantic Search Module
 *
 * Free-text semantic search over spots, expressed as an additional filter
 * dimension so it AND-combines with the checkbox dimensions in the existing
 * filter engine.
 *
 * How it works:
 *   1. The user types a query into the search input in the filter panel.
 *   2. After a debounce, the query goes to the search API, which returns spot
 *      slugs ranked by semantic similarity.
 *   3. Those slugs become the selection set of the 'search' filter dimension.
 *   4. PaddelbuchFilterEngine.applyFilters() re-evaluates every marker, so a
 *      marker is visible only if it matches the search AND every active
 *      checkbox dimension.
 *   5. The map is fitted to the result coordinates so that matches outside the
 *      current viewport get their tiles loaded and become visible.
 *
 * Clearing the query empties the dimension's selection set, which the filter
 * engine treats as "dimension inactive" rather than "match nothing", so every
 * marker returns.
 *
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 5.1,
 * 5.2, 6.1, 6.2, 7.1
 */

(function(global) {
  'use strict';

  var DEFAULTS = {
    dimensionKey: 'search',
    minQueryLength: 2,
    debounceMs: 350,
    // High enough to carry every match to a broad term. "parking" matches 441 of
    // 737 spots, and truncating that was the original complaint. This is
    // affordable only because of fields=slim below.
    limit: 500,
    // No relevance floor. The API now decides membership lexically, so a
    // threshold is no longer needed for precision -- and a single cosine floor
    // actively harmed German, which scores lower for the same concept because
    // the German text uses different words. That asymmetry was the reported
    // 40-results-in-English versus 36-in-German.
    minScore: null,
    // Ask for the minimal projection. This module only reads slug and location,
    // and the full form carries rendered HTML that would be discarded. Measured
    // on the live index, slim is ~5x smaller for a 441-result response
    // (69KB versus 336KB). Data transfer is the only search cost that scales
    // with result count.
    fields: 'slim',
    fitPadding: 40,
    fitMaxZoom: 12
  };

  var I18N_DEFAULTS = {
    placeholder: 'Suche...',
    ariaLabel: 'Einstiegsorte durchsuchen',
    clearLabel: 'Suche loeschen',
    searching: 'Suche laeuft...',
    noResults: 'Keine Ergebnisse gefunden',
    resultsOne: '1 Ergebnis',
    resultsMany: '{count} Ergebnisse',
    error: 'Suche momentan nicht verfuegbar'
  };

  var config = null;
  var strings = I18N_DEFAULTS;
  var map = null;
  var inputEl = null;
  var statusEl = null;
  var clearBtn = null;
  var debounceTimer = null;
  var activeController = null;
  // Slug -> {lat, lon} for the most recent result set, used to fit map bounds.
  var lastResultLocations = [];

  /**
   * Read and normalise configuration from the JSON config element.
   *
   * @returns {Object|null} Config object, or null when search is not configured
   */
  function readConfig() {
    var el = document.getElementById('semantic-search-config');
    if (!el) {
      return null;
    }

    var parsed;
    try {
      parsed = JSON.parse(el.textContent);
    } catch (e) {
      console.warn('semantic-search: config element is not valid JSON', e);
      return null;
    }

    // Without an endpoint there is nothing to call, so the feature stays dark
    // rather than rendering an input that can only fail. This is the normal
    // state in local development when SEARCH_API_ENDPOINT is unset.
    if (!parsed.endpoint) {
      return null;
    }

    var resolved = {
      endpoint: parsed.endpoint,
      apiKey: parsed.apiKey || '',
      locale: parsed.locale || 'de',
      dimensionKey: parsed.dimensionKey || DEFAULTS.dimensionKey,
      minQueryLength: numberOr(parsed.minQueryLength, DEFAULTS.minQueryLength),
      debounceMs: numberOr(parsed.debounceMs, DEFAULTS.debounceMs),
      limit: numberOr(parsed.limit, DEFAULTS.limit),
      minScore: nullableNumber(parsed.minScore, DEFAULTS.minScore),
      fields: parsed.fields || DEFAULTS.fields,
      fitPadding: numberOr(parsed.fitPadding, DEFAULTS.fitPadding),
      fitMaxZoom: numberOr(parsed.fitMaxZoom, DEFAULTS.fitMaxZoom)
    };

    if (parsed.i18n) {
      strings = mergeStrings(I18N_DEFAULTS, parsed.i18n);
    }

    return resolved;
  }

  /**
   * Coerce a config value to a finite number, falling back when unusable.
   *
   * @param {*} value
   * @param {number} fallback
   * @returns {number}
   */
  function numberOr(value, fallback) {
    var num = typeof value === 'number' ? value : parseFloat(value);
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
      return fallback;
    }
    return num;
  }

  /**
   * Coerce a config value to a finite number, or null when it is absent.
   *
   * Distinct from numberOr because an OMITTED relevance floor is meaningful:
   * null means "send no minScore at all", which is different from sending 0.
   *
   * @param {*} value
   * @param {number|null} fallback
   * @returns {number|null}
   */
  function nullableNumber(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    var num = typeof value === 'number' ? value : parseFloat(value);
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
      return fallback;
    }
    return num;
  }

  /**
   * Merge supplied localised strings over the defaults, ignoring blanks.
   *
   * @param {Object} defaults
   * @param {Object} supplied
   * @returns {Object}
   */
  function mergeStrings(defaults, supplied) {
    var result = {};
    for (var key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        var value = supplied[key];
        result[key] = (value !== null && value !== undefined && value !== '')
          ? value
          : defaults[key];
      }
    }
    return result;
  }

  /**
   * Build the search request URL for a query.
   *
   * @param {string} query
   * @returns {string}
   */
  function buildUrl(query) {
    var url = config.endpoint
      + (config.endpoint.indexOf('?') === -1 ? '?' : '&')
      + 'q=' + encodeURIComponent(query)
      + '&locale=' + encodeURIComponent(config.locale)
      + '&limit=' + encodeURIComponent(String(config.limit));

    if (config.fields) {
      url += '&fields=' + encodeURIComponent(config.fields);
    }

    // minScore is optional. Null means "no relevance floor", which is the
    // default: the API decides membership lexically, so a cosine floor adds
    // nothing and cuts the two locales unevenly. Only a finite in-range number
    // is sent.
    if (typeof config.minScore === 'number'
        && isFinite(config.minScore)
        && config.minScore >= -1
        && config.minScore <= 1) {
      url += '&minScore=' + encodeURIComponent(String(config.minScore));
    }
    return url;
  }

  /**
   * Announce a message in the status region.
   *
   * @param {string} message
   * @param {boolean} [isEmpty] - true to mark this as a no-matches message, which
   *   is styled more prominently than a plain result count.
   */
  function setStatus(message, isEmpty) {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message || '';
    if (isEmpty) {
      statusEl.classList.add('search-box-status--empty');
    } else {
      statusEl.classList.remove('search-box-status--empty');
    }
  }

  /**
   * Format the result-count message for a number of matches.
   *
   * @param {number} count
   * @returns {string}
   */
  function formatCount(count) {
    if (count === 0) {
      return strings.noResults;
    }
    if (count === 1) {
      return strings.resultsOne;
    }
    return strings.resultsMany.replace('{count}', String(count));
  }

  /**
   * Slug that no spot can have, used to express "this search matched nothing".
   *
   * The filter engine treats an EMPTY selection set as "dimension inactive" and
   * skips it, which is correct when the search box is cleared -- every marker
   * should come back. But it is exactly wrong for a search that ran and found
   * nothing: an empty set would reveal every spot on the map, the opposite of
   * "no matches found".
   *
   * Selecting one impossible slug keeps the dimension ACTIVE while matching no
   * marker. Real slugs are lowercase alphanumerics and hyphens, so a null
   * character cannot collide with one.
   */
  var NO_MATCH_SENTINEL = '\u0000__no_match__';

  /**
   * Apply a set of matching slugs to the filter engine and refresh the map.
   *
   * @param {Array|null} slugs - Matching slugs, or null to deactivate search
   */
  function applySelection(slugs) {
    var engine = global.PaddelbuchFilterEngine;
    if (!engine || typeof engine.setDimensionSelection !== 'function') {
      return;
    }
    engine.setDimensionSelection(config.dimensionKey, slugs);
    if (typeof engine.applyFilters === 'function') {
      engine.applyFilters();
    }
  }

  /**
   * Apply the outcome of a search that returned no results.
   *
   * Distinct from clearing the box: the dimension stays active so that no marker
   * is shown, and the status region says so.
   */
  function applyNoMatches() {
    applySelection([NO_MATCH_SENTINEL]);
  }

  /**
   * Fit the map to the coordinates of the current result set.
   *
   * This is what makes matches outside the current viewport reachable: the
   * marker registry only holds spots whose tiles have been loaded, so without
   * moving the map a match in another part of the country has no marker to
   * reveal. Fitting the bounds triggers the moveend tile load, and the newly
   * created markers are evaluated against the live filter state on creation.
   */
  function fitToResults() {
    if (!map || !lastResultLocations.length || typeof L === 'undefined') {
      return;
    }

    var latLngs = [];
    for (var i = 0; i < lastResultLocations.length; i++) {
      var loc = lastResultLocations[i];
      latLngs.push([loc.lat, loc.lon]);
    }

    try {
      var bounds = L.latLngBounds(latLngs);
      if (!bounds.isValid()) {
        return;
      }
      map.fitBounds(bounds, {
        padding: [config.fitPadding, config.fitPadding],
        maxZoom: config.fitMaxZoom
      });
    } catch (e) {
      console.warn('semantic-search: could not fit map to results', e);
    }
  }

  /**
   * Extract slugs and coordinates from a search API response array.
   *
   * The API returns a bare JSON array of result objects. Entries without a
   * slug are unusable as a filter key and are skipped.
   *
   * @param {Array} payload
   * @returns {Object} { slugs: Array, locations: Array }
   */
  function parseResults(payload) {
    var slugs = [];
    var locations = [];

    if (!payload || typeof payload.length !== 'number') {
      return { slugs: slugs, locations: locations };
    }

    for (var i = 0; i < payload.length; i++) {
      var item = payload[i];
      if (!item || !item.slug) {
        continue;
      }
      slugs.push(item.slug);

      var loc = item.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
        locations.push({ lat: loc.lat, lon: loc.lon });
      }
    }

    return { slugs: slugs, locations: locations };
  }

  /**
   * Cancel any in-flight request.
   */
  function abortInFlight() {
    if (activeController) {
      try {
        activeController.abort();
      } catch (e) {
        // An already-settled controller throws on some older engines; the
        // request is finished either way, so there is nothing to recover.
      }
      activeController = null;
    }
  }

  /**
   * Run a search and apply the outcome.
   *
   * @param {string} query
   */
  function runSearch(query) {
    abortInFlight();

    var headers = { Accept: 'application/json' };
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    var options = { method: 'GET', headers: headers };
    if (typeof AbortController !== 'undefined') {
      activeController = new AbortController();
      options.signal = activeController.signal;
    }

    setStatus(strings.searching);

    fetch(buildUrl(query), options)
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Search API returned HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function(payload) {
        var parsed = parseResults(payload);
        lastResultLocations = parsed.locations;

        if (parsed.slugs.length === 0) {
          // The query ran and matched nothing. Keep the dimension active so no
          // marker shows, and say so -- an empty selection would instead reveal
          // every spot, which reads as "search ignored".
          applyNoMatches();
          setStatus(strings.noResults, true);
          activeController = null;
          return;
        }

        applySelection(parsed.slugs);
        setStatus(formatCount(parsed.slugs.length));
        fitToResults();
        activeController = null;
      })
      .catch(function(err) {
        // An abort is the expected outcome when the user keeps typing; it is
        // not a failure and must not clobber the newer request's status.
        if (err && err.name === 'AbortError') {
          return;
        }
        console.warn('semantic-search: request failed', err);
        lastResultLocations = [];
        // Deactivate rather than leaving a stale result set filtering the map,
        // so a failed search degrades to "no search" instead of a wrong view.
        applySelection(null);
        setStatus(strings.error, true);
        activeController = null;
      });
  }

  /**
   * Clear the search: deactivate the dimension and restore every marker.
   */
  function clearSearch() {
    abortInFlight();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastResultLocations = [];
    applySelection(null);
    setStatus('');
    updateClearVisibility();
  }

  /**
   * Show the clear button only when there is something to clear.
   */
  function updateClearVisibility() {
    if (!clearBtn || !inputEl) {
      return;
    }
    clearBtn.hidden = inputEl.value.length === 0;
  }

  /**
   * Handle input, debouncing the outbound request.
   */
  function onInput() {
    updateClearVisibility();

    var query = inputEl.value.trim();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (query.length < config.minQueryLength) {
      // Below the threshold the search is inactive, not empty-result.
      abortInFlight();
      lastResultLocations = [];
      applySelection(null);
      setStatus('');
      return;
    }

    debounceTimer = setTimeout(function() {
      debounceTimer = null;
      runSearch(query);
    }, config.debounceMs);
  }

  /**
   * Handle keydown: Escape clears the search.
   *
   * @param {KeyboardEvent} event
   */
  function onKeyDown(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      inputEl.value = '';
      clearSearch();
      event.stopPropagation();
    }
  }

  /**
   * Build the search box DOM inside a host element.
   *
   * Uses classes and a hidden attribute rather than inline style attributes,
   * because the site's CSP omits 'unsafe-inline' for style-src.
   *
   * @param {HTMLElement} host
   * @returns {HTMLElement} The wrapper element
   */
  function buildDom(host) {
    var wrapper = document.createElement('div');
    wrapper.className = 'search-box';

    var field = document.createElement('div');
    field.className = 'search-box-field';

    inputEl = document.createElement('input');
    inputEl.type = 'search';
    inputEl.className = 'search-box-input';
    inputEl.id = 'spot-search-input';
    inputEl.setAttribute('placeholder', strings.placeholder);
    inputEl.setAttribute('aria-label', strings.ariaLabel);
    inputEl.setAttribute('aria-describedby', 'spot-search-status');
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.setAttribute('data-tinylytics-event', 'search.query');

    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-box-clear';
    clearBtn.setAttribute('aria-label', strings.clearLabel);
    clearBtn.setAttribute('data-tinylytics-event', 'search.clear');
    clearBtn.textContent = 'x';
    clearBtn.hidden = true;

    field.appendChild(inputEl);
    field.appendChild(clearBtn);

    statusEl = document.createElement('p');
    statusEl.className = 'search-box-status';
    statusEl.id = 'spot-search-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');

    wrapper.appendChild(field);
    wrapper.appendChild(statusEl);
    host.appendChild(wrapper);

    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKeyDown);
    clearBtn.addEventListener('click', function() {
      inputEl.value = '';
      clearSearch();
      inputEl.focus();
    });

    return wrapper;
  }

  /**
   * Return the dimension config the filter engine needs for search.
   *
   * Declared with no options, so the engine initialises it to an empty
   * selection set, which means inactive until a search runs. It is registered
   * with the engine only, never with the filter panel, so no empty fieldset
   * is rendered.
   *
   * @returns {Object}
   */
  function getDimensionConfig() {
    return {
      key: (config && config.dimensionKey) || DEFAULTS.dimensionKey,
      label: '',
      options: [],
      matchFn: matchFn
    };
  }

  /**
   * Match a marker against the current search selection.
   *
   * @param {Object} meta - Marker metadata from the registry
   * @param {Set} selected - Slugs matched by the latest search
   * @returns {boolean}
   */
  function matchFn(meta, selected) {
    return !!meta && selected.has(meta.slug);
  }

  /**
   * Initialise the search box.
   *
   * @param {L.Map} mapInstance - Leaflet map instance
   * @param {HTMLElement} host - Element to render the search box into
   * @returns {boolean} true when the search box was rendered
   */
  function init(mapInstance, host) {
    if (!config) {
      config = readConfig();
    }
    if (!config || !host) {
      return false;
    }
    map = mapInstance;
    buildDom(host);
    return true;
  }

  /**
   * Add the search box to the map as its OWN Leaflet control.
   *
   * Deliberately a separate control rather than markup inside the filter panel.
   * Two reasons:
   *
   *   1. Visibility. The filter panel's content region is display:none until the
   *      funnel toggle expands it, so anything nested there is invisible on page
   *      load.
   *   2. Isolation. Living in its own control means the search box cannot change
   *      the filter panel's size, styling, or behaviour -- the panel is
   *      untouched, exactly as it ships without this feature.
   *
   * The control is registered at 'topleft', the same corner as the filter panel.
   * Leaflet stacks controls in a corner vertically, so the corner element is
   * marked with 'has-search-control' and CSS lays that ONE corner out as a row,
   * putting the search box to the right of the filter button. Only this corner is
   * affected, and on the home map the filter panel is its only other occupant
   * (zoom and locate both sit bottom-right).
   *
   * @param {L.Map} mapInstance - Leaflet map instance
   * @returns {Object|null} The control instance, or null when not applicable
   */
  function createControl(mapInstance) {
    if (!config) {
      config = readConfig();
    }
    if (!config || !mapInstance || typeof L === 'undefined') {
      return null;
    }

    map = mapInstance;

    var SearchControl = L.Control.extend({
      options: { position: 'topleft' },

      onAdd: function() {
        var container = L.DomUtil.create('div', 'search-control');
        // Keep clicks and scrolls inside the control from reaching the map, so
        // typing and text selection never pan or zoom it.
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        buildDom(container);
        return container;
      }
    });

    var instance = new SearchControl();
    instance.addTo(mapInstance);

    var el = typeof instance.getContainer === 'function' ? instance.getContainer() : null;
    var corner = el && el.parentNode;
    if (corner && corner.classList) {
      corner.classList.add('has-search-control');
    }

    return instance;
  }

  /**
   * Report whether search is configured for this build.
   *
   * @returns {boolean}
   */
  function isConfigured() {
    if (!config) {
      config = readConfig();
    }
    return !!config;
  }

  global.PaddelbuchSemanticSearch = {
    init: init,
    createControl: createControl,
    isConfigured: isConfigured,
    getDimensionConfig: getDimensionConfig,
    matchFn: matchFn,
    NO_MATCH_SENTINEL: NO_MATCH_SENTINEL,
    clearSearch: clearSearch,
    // Exposed for tests: pure helpers with no DOM or network dependency.
    _parseResults: parseResults,
    _formatCount: formatCount,
    _buildUrl: buildUrl,
    _mergeStrings: mergeStrings,
    _numberOr: numberOr,
    _setConfigForTest: function(next) { config = next; },
    _setStringsForTest: function(next) { strings = next; },
    _getStringsForTest: function() { return strings; },
    I18N_DEFAULTS: I18N_DEFAULTS,
    DEFAULTS: DEFAULTS
  };

  // Dual_Export: expose the same public API to Node/Jest via module.exports so tests
  // can require() the real module, while the browser continues to use the global above.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PaddelbuchSemanticSearch;
  }

})(typeof window !== 'undefined' ? window : this);
