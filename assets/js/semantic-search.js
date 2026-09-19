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

  /**
   * Words that syntactically require a following term.
   *
   * A query ending in one of these is mid-thought, so firing it spends a request on
   * an answer the user is not asking for yet. Two measurements against the live API
   * on 2026-08-28 show that is not merely wasteful:
   *
   *   "und"             ->   0 results   a "no matches" notice for an unfinished word
   *   "parkplatz ohne"  ->   6 results   NOT the 429 that "parkplatz" returns
   *
   * The second is a visible defect. `ohne` is a NEGATOR in the backend's lexical
   * model, not a plain stopword: it forms its own query group, which is then strictly
   * ANDed against nothing. So typing "parkplatz ohne toiletten" used to flash six
   * wrong spots before correcting itself.
   *
   * DELIBERATELY NOT the backend's STOPWORDS set, which this looks like it should
   * reuse. That set has 84 entries and includes `meter`, `sehr`, `hier`, `bitte`,
   * `beachten` -- words that carry no following term and would suppress perfectly
   * complete queries. This list is only the connectors and negators, in both
   * languages, and is intentionally short enough to read.
   *
   * Prefixes are a free bonus rather than a problem: typing "underwater" pauses at
   * "und" and defers one request, then fires normally at "unde".
   */
  var CONNECTORS = {
    // conjunctions
    'and': true, 'und': true, 'or': true, 'oder': true, 'plus': true,
    // prepositions that take an object
    'with': true, 'mit': true, 'for': true, 'fur': true, 'für': true,
    'near': true, 'nahe': true, 'next': true, 'neben': true,
    'from': true, 'von': true, 'vom': true, 'bei': true,
    // negators -- "X without" is definitionally incomplete
    'without': true, 'ohne': true, 'no': true, 'not': true, 'non': true,
    'kein': true, 'keine': true, 'keinen': true, 'keinem': true, 'nicht': true
  };

  /**
   * True when the query's last word requires a following term.
   *
   * Lower-cased before lookup so "Parkplatz UND" is treated the same as
   * "parkplatz und". The query arrives already trimmed, so a trailing space cannot
   * hide the connector from this check.
   */
  function endsWithConnector(query) {
    if (!query) {
      return false;
    }
    var words = query.split(/\s+/);
    var last = words[words.length - 1];
    return !!(last && CONNECTORS[last.toLowerCase()]);
  }

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
    fitMaxZoom: 12,
    // Measured rather than chosen. Cold-start ceiling is ~5.0s (init max 1130ms
    // plus cold invocation max 3905ms, reported separately by Lambda), so this
    // clears a cold start with about a second of margin. It must also stay
    // strictly below the Lambda's own 10s timeout: at 10s the client would never
    // give up before the server did, making the budget dead code.
    timeoutMs: 6000
  };

  // Retry and timeout policy. Deliberately constants rather than config keys:
  // they encode a policy, not a deployment choice, and exposing them would invite
  // tuning without measurement.
  //
  // Two attempts, because the realistic "unavailable" is a cold Lambda on the
  // first search of a session -- measured at up to ~5.0s server time against a
  // warm p50 of 286ms -- and one retry converts most of those into a success with
  // no user action.
  var MAX_ATTEMPTS = 2;
  var RETRY_DELAY_MS = 1000;

  // How long a query must sit unchanged before it is reported to analytics.
  //
  // NOT the search debounce. Two independent reasons it is much longer:
  //
  // Data quality -- the search debounce is 350 ms, so typing "parkplatz" with one natural
  // pause runs two searches, "park" and "parkplatz". Reporting each would record a prefix
  // nobody meant to search.
  //
  // Silent loss -- Tinylytics drops any two events sharing a debounce key within 500 ms,
  // and that key is `target.id || target.className || target.tagName`. The beacon module
  // sets className 'tinylytics-beacon' and no id, so EVERY beacon dispatch shares one key
  // and collides. Read from the deployed script, not the docs. 1500 ms keeps dispatches
  // outside that window as a consequence rather than by luck.
  var ANALYTICS_SETTLE_MS = 1500;

  // Query length cap for the analytics value. The client script performs no truncation of
  // its own -- verified by reading it -- but server-side handling is unverified, so the
  // count is appended AFTER this cap: a server that truncates eats query text before it
  // reaches the count.
  var ANALYTICS_QUERY_MAX = 100;

  // Cannot occur in a value after sanitisation, and readable in the dashboard's value list.
  // Transport-safe either way: the script encodeURIComponent()s the value, so this becomes
  // %7C rather than a URL delimiter.
  var ANALYTICS_DELIMITER = '|';

  var analyticsTimer = null;
  // Above this, a Retry-After is reported without a figure rather than telling
  // somebody to come back in an hour.
  var RETRY_AFTER_MAX_SECONDS = 300;

  // Which action the central notice offers. The label and handler depend on what
  // is being reported: clearing is right for "nothing matched", useless for a
  // backend failure, where the user wants to try again.
  var ACTION_CLEAR = 'clear';
  var ACTION_RETRY = 'retry';

  var I18N_DEFAULTS = {
    placeholder: 'Suche...',
    ariaLabel: 'Einstiegsorte durchsuchen',
    clearLabel: 'Suche loeschen',
    searching: 'Suche laeuft...',
    noResults: 'Keine Ergebnisse gefunden',
    noResultsHint: 'Kein Einstiegsort entspricht Ihrer Suche. Versuchen Sie einen anderen '
      + 'Begriff, weniger Woerter, oder loeschen Sie die Suche.',
    resultsOne: '1 Ergebnis',
    resultsMany: '{count} Ergebnisse',
    error: 'Suche momentan nicht verfuegbar',
    errorHint: 'Bitte versuchen Sie es in einem Moment erneut.',
    timeout: 'Die Suche hat zu lange gedauert',
    timeoutHint: 'Bitte versuchen Sie es erneut.',
    rateLimited: 'Zu viele Suchanfragen',
    rateLimitedHint: 'Bitte warten Sie {seconds} Sekunden und versuchen Sie es erneut.',
    rateLimitedHintGeneric: 'Bitte warten Sie einen Moment und versuchen Sie es erneut.',
    quotaExhausted: 'Tageslimit fuer Suchanfragen erreicht',
    quotaExhaustedHint: 'Die Suche ist ab {time} wieder verfuegbar. Sie koennen die Karte '
      + 'weiterhin mit den Filtern nutzen.',
    busy: 'Die Suche ist gerade sehr gefragt',
    busyHint: 'Bitte versuchen Sie es in wenigen Sekunden erneut.',
    retryLabel: 'Erneut versuchen'
  };

  var config = null;
  var strings = I18N_DEFAULTS;
  var map = null;
  var inputEl = null;
  var statusEl = null;
  var clearBtn = null;
  var noticeEl = null;
  var noticeTitleEl = null;
  var noticeHintEl = null;
  var noticeButtonEl = null;
  var noticeAction = null;
  var debounceTimer = null;
  // The in-flight request's own record. Replaces a bare AbortController because
  // the reason for an abort has to be carried explicitly: a supersede and a
  // timeout both surface as an AbortError and mean opposite things.
  var activeRequest = null;
  var pendingRetryTimer = null;
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
      fitMaxZoom: numberOr(parsed.fitMaxZoom, DEFAULTS.fitMaxZoom),
      timeoutMs: positiveNumberOr(parsed.timeoutMs, DEFAULTS.timeoutMs),
      contentVersion: parsed.contentVersion || ''
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
   * Coerce a config value to a finite POSITIVE number, falling back otherwise.
   *
   * Distinct from numberOr because a zero or negative timeout would disable the
   * very protection it configures, so a nonsense value must fall back rather than
   * be honoured.
   *
   * @param {*} value
   * @param {number} fallback
   * @returns {number}
   */
  function positiveNumberOr(value, fallback) {
    var num = numberOr(value, NaN);
    if (isNaN(num) || num <= 0) {
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
  // The backend accepts 1-500 characters after control-character stripping and answers
  // 400 beyond that, so this mirrors its contract rather than inventing a number.
  // Enforced in TWO places deliberately: maxLength on the element stops ordinary typing,
  // and buildUrl bounds every other route to a request (programmatic set, paste on an
  // older browser, a value restored from the persisted cache).
  //
  // No 413/414 branch is added. With the bound in place an over-long query cannot be
  // sent, so the branch would be dead code -- recorded here so its absence is not later
  // read as an oversight.
  var MAX_QUERY_LENGTH = 500;

  function buildUrl(query) {
    // Exported for tests, so it must hold the same unconfigured-safe contract as
    // the rest of the public API rather than relying on its callers.
    if (!config || !config.endpoint) {
      return '';
    }
    // Bound the query here as well as on the input element. maxLength constrains only
    // TYPING -- it does nothing to a value set programmatically, pasted past the limit by
    // an older browser, or restored from the persisted cache. The backend rejects anything
    // over MAX_QUERY_LENGTH with a 400, so sending it wastes a round trip and spends a
    // request against the shared daily quota for a response that cannot succeed.
    //
    // Truncating rather than refusing: a user who pastes an over-long string gets results
    // for the part that could be searched, which is more useful than an error, and the
    // input element already prevents this for ordinary typing.
    var bounded = String(query === null || query === undefined ? '' : query)
      .slice(0, MAX_QUERY_LENGTH);
    var url = config.endpoint
      + (config.endpoint.indexOf('?') === -1 ? '?' : '&')
      + 'q=' + encodeURIComponent(bounded)
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
   * Report whether a node is still in the document.
   *
   * Prefers Node.isConnected and falls back to document.contains for engines
   * that predate it.
   *
   * @param {Node} node
   * @returns {boolean}
   */
  function isAttached(node) {
    if (!node) {
      return false;
    }
    if (typeof node.isConnected === 'boolean') {
      return node.isConnected;
    }
    return !!(document.documentElement && document.documentElement.contains(node));
  }

  /**
   * Build the central map notice, once, inside the map's own container.
   *
   * Placed in the map container rather than the search control so it can sit in
   * the middle of the map: a "no results" state where the map has silently gone
   * blank is confusing, and a small line of text beside the input is easy to miss
   * when the user's attention is on the map itself.
   *
   * The overlay is a direct child of the map container, not of a Leaflet pane, so
   * it stays centred instead of being translated away when the map is panned.
   * It does not intercept pointer events except on its button, so the map remains
   * fully draggable while the notice is showing.
   *
   * @param {L.Map} mapInstance
   */
  function buildNotice(mapInstance) {
    if (!mapInstance || typeof mapInstance.getContainer !== 'function') {
      return;
    }
    // Rebuild when the existing node is no longer attached to the document, not
    // merely when it is absent. A detached node would otherwise leave the notice
    // permanently invisible if the map were ever torn down and recreated.
    if (noticeEl && isAttached(noticeEl)) {
      return;
    }
    var mapContainer = mapInstance.getContainer();
    if (!mapContainer) {
      return;
    }

    noticeEl = document.createElement('div');
    noticeEl.className = 'map-search-notice';
    noticeEl.hidden = true;

    var inner = document.createElement('div');
    inner.className = 'map-search-notice-inner';
    // The authoritative announcement for this state. The compact status line
    // beside the input is cleared while the notice shows, so screen readers get
    // one message rather than two.
    inner.setAttribute('role', 'status');
    inner.setAttribute('aria-live', 'polite');

    noticeTitleEl = document.createElement('p');
    noticeTitleEl.className = 'map-search-notice-title';

    noticeHintEl = document.createElement('p');
    noticeHintEl.className = 'map-search-notice-hint';

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'map-search-notice-clear';
    clear.textContent = strings.clearLabel;
    clear.setAttribute('data-tinylytics-event', 'search.clear-from-notice');
    // One listener for the life of the button, dispatching through the current
    // action rather than being swapped when the state changes.
    clear.addEventListener('click', runNoticeAction);
    noticeButtonEl = clear;

    inner.appendChild(noticeTitleEl);
    inner.appendChild(noticeHintEl);
    inner.appendChild(clear);
    noticeEl.appendChild(inner);
    mapContainer.appendChild(noticeEl);
  }

  /**
   * Show the central notice with a title, a next step, and an action.
   *
   * @param {string} title
   * @param {string} hint - What the user can do to carry on using the site.
   * @param {string} [action] - ACTION_CLEAR or ACTION_RETRY. Defaults to clearing.
   */
  function showNotice(title, hint, action) {
    if (!noticeEl) {
      return;
    }
    noticeTitleEl.textContent = title || '';
    noticeHintEl.textContent = hint || '';
    setNoticeAction(action || ACTION_CLEAR);
    noticeEl.hidden = false;
  }

  /**
   * Point the notice's single button at one of the two actions.
   *
   * The button keeps ONE permanently attached listener that dispatches through
   * this state, rather than having listeners swapped per state change. Swapping
   * listeners is how duplicate-handler bugs happen, and a single dispatch point
   * also keeps the button a stable focus target across state changes.
   *
   * @param {string} action
   */
  function setNoticeAction(action) {
    noticeAction = action;
    if (!noticeButtonEl) {
      return;
    }
    var isRetry = action === ACTION_RETRY;
    noticeButtonEl.textContent = isRetry ? strings.retryLabel : strings.clearLabel;
    noticeButtonEl.setAttribute(
      'data-tinylytics-event',
      isRetry ? 'search.retry-from-notice' : 'search.clear-from-notice');
  }

  /**
   * Run whichever action the notice is currently offering.
   */
  function runNoticeAction() {
    if (noticeAction === ACTION_RETRY) {
      var query = inputEl ? inputEl.value.trim() : '';
      if (query.length < config.minQueryLength) {
        // The user emptied or shortened the box while the failure was showing.
        // Re-running a query they have abandoned would be worse than doing
        // nothing, so just take the notice away.
        hideNotice();
        return;
      }
      runSearch(query);
      return;
    }

    if (inputEl) {
      inputEl.value = '';
    }
    clearSearch();
    if (inputEl) {
      inputEl.focus();
    }
  }

  /**
   * Hide the central notice.
   */
  function hideNotice() {
    if (noticeEl) {
      noticeEl.hidden = true;
    }
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
    // Guard on config, matching getDimensionConfig. Without this, calling the
    // exported clearSearch() on an unconfigured build throws on
    // config.dimensionKey -- an exported function that is unsafe in the very
    // state the module is designed to sit in.
    if (!config) {
      return;
    }
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
   * Throws when the payload is not an array. That distinction is load-bearing: a
   * non-array body used to produce zero slugs, which the caller could not tell
   * apart from a genuine empty result, so it applied the no-match sentinel and
   * hid EVERY marker -- reporting a backend fault as "no spots match your
   * search". A shape failure is a failure, and belongs on the error path.
   *
   * Individual bad entries are still tolerated rather than failing the whole
   * response: one malformed spot should not lose the other four hundred.
   *
   * @param {Array} payload
   * @returns {Object} { slugs: Array, locations: Array }
   * @throws {Error} when payload is not an array
   */
  function parseResults(payload) {
    var slugs = [];
    var locations = [];

    if (!Array.isArray(payload)) {
      throw new Error('Search API returned a non-array body');
    }

    for (var i = 0; i < payload.length; i++) {
      var item = payload[i];
      if (!item || !item.slug) {
        continue;
      }
      slugs.push(item.slug);

      var loc = item.location;
      if (loc && isFiniteNumber(loc.lat) && isFiniteNumber(loc.lon)) {
        locations.push({ lat: loc.lat, lon: loc.lon });
      }
    }

    return { slugs: slugs, locations: locations };
  }

  /**
   * Report whether a value is a usable finite number.
   *
   * NaN and Infinity are typeof 'number' but cannot be mapped, and would poison
   * the bounds passed to fitBounds.
   *
   * @param {*} value
   * @returns {boolean}
   */
  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  /**
   * ---------------------------------------------------------------------------
   * Result cache
   * ---------------------------------------------------------------------------
   *
   * Two tiers, both keyed by the full request URL. The URL already encodes every
   * input that changes the answer -- q, locale, limit, fields, minScore -- so it
   * cannot collide across locales or projections, and cannot go stale against a
   * config change without the key also changing.
   *
   * Tier 1 is in memory: parsed objects, so a repeat within one page load costs
   * nothing. Tier 2 is localStorage, because the site is multi-page with no
   * client-side router -- opening a spot's detail page and pressing back destroys
   * tier 1 entirely, which is the most common thing a paddler does after
   * searching.
   */

  // Bounded by total cached RESULTS, not entries. Entry sizes here differ by two
  // orders of magnitude -- a query matching nothing and one matching 436 spots are
  // both "one entry" -- so entry count does not predict memory. Measured at 70-80
  // bytes per result, 60000 results is about 4.5 MB.
  var MEMORY_MAX_RESULTS = 60000;
  var MEMORY_MAX_ENTRIES = 500;

  // localStorage measured at 9.88 MB in Chromium, but mobile Safari provides less,
  // so the persisted tier budgets 4 MB.
  var STORAGE_PREFIX = 'pbsearch';
  var STORAGE_SCHEMA = 'v1';
  var STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // Insertion-ordered, and re-inserted on every hit, which makes it LRU. FIFO
  // would discard the user's first query -- in a session that keeps returning to
  // one broad term, the entry most worth keeping.
  var memoryCache = null;
  var memoryResultCount = 0;
  // Set false after a storage failure, for the rest of the page.
  var persistenceAvailable = true;

  /**
   * Lazily create the in-memory cache.
   *
   * @returns {Object} A Map when available, else null
   */
  function memory() {
    if (memoryCache === null && typeof Map === 'function') {
      memoryCache = new Map();
    }
    return memoryCache;
  }

  /**
   * The persisted key for a request URL, or null when storage is unusable.
   *
   * The content version comes from the spots table's lastUpdatedAt, so a content
   * change makes every existing entry unreachable at once -- precise invalidation
   * rather than waiting out a TTL.
   *
   * @param {string} url
   * @returns {string|null}
   */
  function storageKey(url) {
    if (!config) {
      return null;
    }
    return STORAGE_PREFIX + ':' + STORAGE_SCHEMA + ':'
      + (config.contentVersion || 'none') + ':' + url;
  }

  /**
   * Return localStorage if it is usable, else null.
   *
   * Access itself can throw: Safari private browsing has historically thrown on
   * write, and a disabled-storage setting throws on the property read.
   *
   * @returns {Storage|null}
   */
  function storage() {
    if (!persistenceAvailable) {
      return null;
    }
    try {
      var s = global.localStorage;
      return s || null;
    } catch (e) {
      persistenceAvailable = false;
      return null;
    }
  }

  /**
   * Stop trying to persist, for the rest of the page.
   *
   * @param {*} err
   */
  function disablePersistence(err) {
    persistenceAvailable = false;
    console.warn('semantic-search: result persistence unavailable, continuing without it', err);
  }

  /**
   * Look a query up in both tiers.
   *
   * @param {string} query
   * @returns {Object|null} { slugs, locations } or null on a miss
   */
  function lookupResult(query) {
    var url = buildUrl(query);
    if (!url) {
      return null;
    }

    var mem = memory();
    if (mem && mem.has(url)) {
      var hit = mem.get(url);
      // Re-insert to move it to the most-recent end: this is what makes the
      // bound LRU rather than FIFO.
      mem.delete(url);
      mem.set(url, hit);
      return hit;
    }

    var store = storage();
    var key = storageKey(url);
    if (!store || !key) {
      return null;
    }

    var raw;
    try {
      raw = store.getItem(key);
    } catch (e) {
      disablePersistence(e);
      return null;
    }
    if (!raw) {
      return null;
    }

    var entry;
    try {
      entry = JSON.parse(raw);
    } catch (e) {
      // A corrupt entry is a miss, and worth removing rather than re-reading.
      removeStorageKey(store, key);
      return null;
    }

    if (!entry || !Array.isArray(entry.s) || typeof entry.t !== 'number') {
      removeStorageKey(store, key);
      return null;
    }

    if (Date.now() - entry.t > STORAGE_TTL_MS) {
      // The backstop for what the content version cannot catch: an index
      // refreshed without a site rebuild, and entries under a still-current but
      // very old version.
      removeStorageKey(store, key);
      return null;
    }

    var parsed = {
      slugs: entry.s,
      locations: Array.isArray(entry.l) ? entry.l : []
    };
    rememberInMemory(url, parsed);
    return parsed;
  }

  /**
   * Remove a key, tolerating a storage that has started refusing.
   *
   * @param {Storage} store
   * @param {string} key
   */
  function removeStorageKey(store, key) {
    try {
      store.removeItem(key);
    } catch (e) {
      disablePersistence(e);
    }
  }

  /**
   * Record a successful result in both tiers.
   *
   * Successes only, including an empty result: "nothing matches" is a real answer
   * and re-asking the backend for it wastes the same request as re-asking for a
   * hit. Failures are never cached.
   *
   * @param {string} query
   * @param {Object} parsed
   */
  function rememberResult(query, parsed) {
    var url = buildUrl(query);
    if (!url) {
      return;
    }
    rememberInMemory(url, parsed);
    persistResult(url, parsed);
  }

  /**
   * Insert into the in-memory tier and evict until both bounds hold.
   *
   * @param {string} url
   * @param {Object} parsed
   */
  function rememberInMemory(url, parsed) {
    var mem = memory();
    if (!mem) {
      return;
    }
    if (mem.has(url)) {
      memoryResultCount -= mem.get(url).slugs.length;
      mem.delete(url);
    }
    mem.set(url, parsed);
    memoryResultCount += parsed.slugs.length;

    // Both bounds bite in different regimes: at the API's 500-result limit the
    // result bound stops it first, while for narrow queries the entry bound does.
    while (mem.size > 0
      && (memoryResultCount > MEMORY_MAX_RESULTS || mem.size > MEMORY_MAX_ENTRIES)) {
      var oldest = mem.keys().next();
      if (oldest.done) {
        break;
      }
      memoryResultCount -= mem.get(oldest.value).slugs.length;
      mem.delete(oldest.value);
    }
    if (memoryResultCount < 0) {
      memoryResultCount = 0;
    }
  }

  /**
   * Write an entry to localStorage, evicting and retrying once on a full quota.
   *
   * @param {string} url
   * @param {Object} parsed
   */
  function persistResult(url, parsed) {
    var store = storage();
    var key = storageKey(url);
    if (!store || !key) {
      return;
    }

    var payload;
    try {
      // Self-contained: its own slugs AND locations. A shared spot table with
      // per-query positional indices measured 15.8x smaller and was rejected --
      // two tabs appending to it concurrently diverge, after which one tab's
      // indices resolve to the other tab's spots.
      payload = JSON.stringify({ s: parsed.slugs, l: parsed.locations, t: Date.now() });
    } catch (e) {
      return;
    }

    try {
      store.setItem(key, payload);
      return;
    } catch (e) {
      // Almost certainly a full quota. Make room and try once more.
      if (!evictPersisted(store)) {
        disablePersistence(e);
        return;
      }
    }

    try {
      store.setItem(key, payload);
    } catch (e) {
      disablePersistence(e);
    }
  }

  /**
   * Drop the least-recently-written half of our persisted entries.
   *
   * Enumeration touches every key, which is why it happens only here -- on the
   * rare quota path -- and never on a read or during initialisation.
   *
   * @param {Storage} store
   * @returns {boolean} true when something was removed
   */
  function evictPersisted(store) {
    var entries = ourKeys(store, true);
    if (!entries.length) {
      return false;
    }
    entries.sort(function(a, b) { return a.t - b.t; });
    var drop = Math.max(1, Math.ceil(entries.length / 2));
    for (var i = 0; i < drop; i++) {
      removeStorageKey(store, entries[i].key);
    }
    return true;
  }

  /**
   * Enumerate this module's storage keys.
   *
   * @param {Storage} store
   * @param {boolean} currentVersionOnly
   * @returns {Array} [{ key, t }]
   */
  function ourKeys(store, currentVersionOnly) {
    var prefix = STORAGE_PREFIX + ':';
    var currentPrefix = storageKey('');
    var found = [];
    var length;
    try {
      length = store.length;
    } catch (e) {
      disablePersistence(e);
      return found;
    }

    for (var i = 0; i < length; i++) {
      var key;
      try {
        key = store.key(i);
      } catch (e) {
        break;
      }
      if (!key || key.indexOf(prefix) !== 0) {
        continue;
      }
      if (currentVersionOnly && currentPrefix && key.indexOf(currentPrefix) !== 0) {
        continue;
      }
      var written = 0;
      try {
        var parsed = JSON.parse(store.getItem(key));
        written = (parsed && typeof parsed.t === 'number') ? parsed.t : 0;
      } catch (e) {
        written = 0;
      }
      found.push({ key: key, t: written });
    }
    return found;
  }

  /**
   * Remove entries belonging to a superseded content or schema version.
   *
   * Deferred to idle time: this is the one operation that touches every key, so
   * it must not run during initialisation.
   */
  function purgeSupersededEntries() {
    var store = storage();
    var currentPrefix = storageKey('');
    if (!store || !currentPrefix) {
      return;
    }
    var stale = ourKeys(store, false).filter(function(entry) {
      return entry.key.indexOf(currentPrefix) !== 0;
    });
    for (var i = 0; i < stale.length; i++) {
      removeStorageKey(store, stale[i].key);
    }
  }

  /**
   * Schedule the purge for when the browser is idle.
   */
  function schedulePurge() {
    var run = function() {
      try {
        purgeSupersededEntries();
      } catch (e) {
        disablePersistence(e);
      }
    };
    if (typeof global.requestIdleCallback === 'function') {
      global.requestIdleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  }

  /**
   * Cancel any in-flight request, and any retry waiting to be issued.
   *
   * Marks the record superseded BEFORE aborting, so the settling promise can tell
   * a supersede from a timeout. Both arrive as an AbortError and they mean
   * opposite things: a supersede is silent because a newer query owns the
   * outcome, while a timeout has to be reported.
   */
  function abortInFlight() {
    if (pendingRetryTimer) {
      // A retry scheduled for a query the user has moved on from must not fire.
      clearTimeout(pendingRetryTimer);
      pendingRetryTimer = null;
    }
    if (activeRequest) {
      activeRequest.superseded = true;
      clearRequestTimer(activeRequest);
      if (activeRequest.controller) {
        try {
          activeRequest.controller.abort();
        } catch (e) {
          // An already-settled controller throws on some older engines; the
          // request is finished either way, so there is nothing to recover.
        }
      }
      activeRequest = null;
    }
  }

  /**
   * Clear a request record's timeout timer, so no timer outlives its request.
   *
   * @param {Object} record
   */
  function clearRequestTimer(record) {
    if (record && record.timer) {
      clearTimeout(record.timer);
      record.timer = null;
    }
  }

  /**
   * Decide what a failed attempt means: whether to retry, and what to report.
   *
   * All of the policy lives here rather than being spread through the promise
   * chain, so the awkward cases are visible side by side.
   *
   * @param {Object} record - The attempt's own request record
   * @param {number} status - HTTP status, or 0 when no response arrived
   * @returns {Object} { retryable: boolean, kind: string }
   */
  function classifyFailure(record, status, errorCode) {
    // Checked first: a timeout is an AbortError, and so is a supersede.
    if (record.timedOut) {
      return { retryable: true, kind: 'timeout' };
    }
    // The machine code is checked BEFORE the status, because the status alone cannot
    // tell a daily quota from a one-second throttle -- both are 429. Retrying either
    // is useless, and retrying the quota is useless for up to 24 hours.
    if (errorCode === 'quota_exceeded') {
      return { retryable: false, kind: 'quotaExhausted' };
    }
    if (errorCode === 'throttled') {
      return { retryable: false, kind: 'busy' };
    }
    if (errorCode === 'rate_limited') {
      // WAF's per-IP block. Lands on the existing rateLimited path, which already
      // parses Retry-After and already falls back when it is unusable.
      return { retryable: false, kind: 'rateLimited' };
    }
    if (errorCode === 'unavailable') {
      // Saturation or a transient integration failure. This one IS worth retrying --
      // it clears in milliseconds -- and the retry is already delayed by
      // RETRY_DELAY_MS, so it does not arrive while the function is still saturated.
      return { retryable: true, kind: 'busy' };
    }
    if (status === 429) {
      // Deliberately NOT retryable. Retrying a rate limit is what caused it.
      return { retryable: false, kind: 'rateLimited' };
    }
    if (status >= 500) {
      return { retryable: true, kind: 'error' };
    }
    if (status >= 400) {
      return { retryable: false, kind: 'error' };
    }
    if (status === 0) {
      // No response at all: network failure, DNS, or a CSP/CORS block.
      return { retryable: true, kind: 'error' };
    }
    // A response arrived and was accepted, then something about its body failed:
    // unparseable JSON, or a body that is not an array. The backend answered, so
    // asking again would get the same wrong answer.
    return { retryable: false, kind: 'error' };
  }

  /**
   * Build the analytics value carrying a query and its result count.
   *
   * One event, one value: Tinylytics events have no session or request identifier, so two
   * separate events could never be joined back together and "which queries returned
   * nothing" -- the whole point of this -- would be unanswerable. The pair therefore has to
   * be atomic.
   *
   * The query is case-folded to match the backend, which folds before embedding precisely
   * so capitalisation cannot change results. Logging `Parkplatz` and `parkplatz` separately
   * would split one intent across two rows and make the top-queries list wrong.
   *
   * @param {string} query
   * @param {number} count - Results as reported to the visitor
   * @returns {string} e.g. "parkplatz|429"
   */
  function formatSearchEventValue(query, count) {
    var text = typeof query === 'string' ? query : '';
    // Strip control characters and the delimiter, so neither can corrupt the value or
    // fake a count.
    text = text.replace(/[\u0000-\u001f\u007f]/g, ' ')
      .split(ANALYTICS_DELIMITER).join(' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    if (text.length > ANALYTICS_QUERY_MAX) {
      text = text.slice(0, ANALYTICS_QUERY_MAX);
    }
    var n = (typeof count === 'number' && isFinite(count) && count >= 0)
      ? Math.floor(count)
      : 0;
    return text + ANALYTICS_DELIMITER + String(n);
  }

  /**
   * Cancel a pending analytics report.
   *
   * Called when the search is cleared or superseded, so a query the visitor abandoned or
   * replaced is never reported as though they had searched for it.
   */
  function cancelAnalytics() {
    if (analyticsTimer) {
      clearTimeout(analyticsTimer);
      analyticsTimer = null;
    }
  }

  /**
   * Report a completed search once it has settled.
   *
   * Deliberately runs AFTER the visitor's results have been applied, and cannot throw
   * outward: an absent, broken or ad-blocker-mangled beacon must never stop search working.
   *
   * @param {string} query
   * @param {number} count
   */
  function scheduleAnalytics(query, count) {
    cancelAnalytics();
    var value = formatSearchEventValue(query, count);
    analyticsTimer = setTimeout(function() {
      analyticsTimer = null;
      try {
        if (typeof PaddelbuchTinylyticsBeacon !== 'undefined'
            && PaddelbuchTinylyticsBeacon
            && typeof PaddelbuchTinylyticsBeacon.dispatch === 'function') {
          PaddelbuchTinylyticsBeacon.dispatch('search.query', value);
        }
      } catch (e) {
        // Analytics is not worth a broken search. Swallowed on purpose.
      }
    }, ANALYTICS_SETTLE_MS);
  }

  /**
   * Read the machine-readable error code out of a failed response body.
   *
   * The backend's edge rejections carry a stable code -- `quota_exceeded`,
   * `throttled`, `unavailable`, `rate_limited` -- precisely so this does not have to
   * string-match AWS's own prose, which is not a documented interface.
   *
   * @param {string} text - Raw response body
   * @returns {string|null} null when unparseable, which classifies by status as before
   */
  function parseErrorCode(text) {
    if (typeof text !== 'string' || text === '') {
      return null;
    }
    var body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return null;
    }
    if (body === null || typeof body !== 'object' || typeof body.error !== 'string') {
      return null;
    }
    return body.error;
  }

  /**
   * When the daily quota next resets, as a local wall-clock string.
   *
   * The API Gateway quota is a DAY period and resets at midnight UTC. The server does
   * not send that instant, deliberately: computing it here is unit-testable with a
   * frozen clock, whereas the alternative is arithmetic in a CloudFormation
   * gateway-response template with no test harness. A skewed client clock only skews
   * what is DISPLAYED -- it cannot grant access, because the quota is enforced
   * server-side regardless of what this believes.
   *
   * Rendered in the user's own timezone, because "available again at 02:00" is
   * something a visitor can act on where "in 8 hours" is arithmetic they must redo.
   *
   * @param {Date} [now] - Injectable for tests
   * @returns {string} Localised time of day
   */
  function quotaResetTime(now) {
    var base = now instanceof Date ? now : new Date();
    var reset = new Date(Date.UTC(
      base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1, 0, 0, 0, 0
    ));
    try {
      return reset.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      // Fall back rather than throw: this runs inside an error path, and throwing here
      // would replace the message the user needs with no message at all.
      return reset.getHours() + ':' + (reset.getMinutes() < 10 ? '0' : '')
        + reset.getMinutes();
    }
  }

  /**
   * Read a Retry-After header as a plausible number of seconds.
   *
   * Only the numeric form is honoured. An HTTP-date is legal in the header but
   * the message only needs a rough wait, and a clock-skewed date would produce a
   * nonsense one.
   *
   * @param {string|null} raw
   * @returns {number|null} seconds, or null when unusable
   */
  function parseRetryAfter(raw) {
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    var seconds = parseInt(raw, 10);
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
      return null;
    }
    if (seconds > RETRY_AFTER_MAX_SECONDS) {
      // Implausible for a per-IP search limit; report it without a figure rather
      // than telling somebody to come back in an hour.
      return null;
    }
    return seconds;
  }

  /**
   * Build the title and hint for a failure verdict.
   *
   * @param {Object} verdict - From classifyFailure
   * @param {number|null} retryAfterSeconds
   * @returns {Object} { title, hint }
   */
  function failureMessage(verdict, retryAfterSeconds, now) {
    if (verdict.kind === 'timeout') {
      return { title: strings.timeout, hint: strings.timeoutHint };
    }
    if (verdict.kind === 'rateLimited') {
      return {
        title: strings.rateLimited,
        hint: retryAfterSeconds === null
          ? strings.rateLimitedHintGeneric
          : strings.rateLimitedHint.replace('{seconds}', String(retryAfterSeconds))
      };
    }
    if (verdict.kind === 'quotaExhausted') {
      return {
        title: strings.quotaExhausted,
        hint: strings.quotaExhaustedHint.replace('{time}', quotaResetTime(now))
      };
    }
    if (verdict.kind === 'busy') {
      // Deliberately no countdown. Burst throttling clears in under a second and
      // saturation in milliseconds, so any number here would be theatre -- and a wrong
      // one teaches the user that the message cannot be trusted.
      return { title: strings.busy, hint: strings.busyHint };
    }
    return { title: strings.error, hint: strings.errorHint };
  }

  /**
   * Apply a successful result set, from the network or from a cache.
   *
   * @param {Object} parsed - { slugs, locations }
   */
  function applyParsedResult(parsed, query) {
    lastResultLocations = parsed.locations;

    // Analytics is scheduled from here rather than from the fetch handler because this is
    // the single point where a result set becomes the visitor's reality -- and it is
    // reached by the CACHE path too. Hooking the network path instead would have
    // undercounted exactly the popular queries most likely to be cached.
    //
    // Scheduled at the END of each branch, after the visitor's outcome is applied.
    if (parsed.slugs.length === 0) {
      // The query ran and matched nothing. Keep the dimension active so no
      // marker shows, and say so -- an empty selection would instead reveal
      // every spot, which reads as "search ignored".
      applyNoMatches();
      setStatus('');
      showNotice(strings.noResults, strings.noResultsHint, ACTION_CLEAR);
      // A zero-result search is the highest-value case here: a content gap, not a fault.
      scheduleAnalytics(query, 0);
      return;
    }

    hideNotice();
    applySelection(parsed.slugs);
    setStatus(formatCount(parsed.slugs.length));
    fitToResults();
    scheduleAnalytics(query, parsed.slugs.length);
  }

  /**
   * Handle a failed attempt: retry it, or report it.
   *
   * @param {Object} record
   * @param {*} err
   * @param {number} status
   * @param {string|null} retryAfterRaw
   */
  function handleFailure(record, err, status, retryAfterRaw, errorCode) {
    var verdict = classifyFailure(record, status, errorCode);

    if (verdict.retryable && record.attempt < MAX_ATTEMPTS) {
      // The status region keeps reading "searching" across the retry. Flashing a
      // failure and then a result would be worse than either outcome alone.
      //
      // The aborted request does not stop the Lambda, so the container it warmed
      // is very likely the one this retry lands on -- which is what makes a
      // timeout below the cold-start ceiling recoverable rather than fatal.
      pendingRetryTimer = setTimeout(function() {
        pendingRetryTimer = null;
        runSearch(record.query, record.attempt + 1);
      }, RETRY_DELAY_MS);
      return;
    }

    console.warn('semantic-search: request failed', err);
    lastResultLocations = [];
    // Deactivate rather than leaving a stale result set filtering the map,
    // so a failed search degrades to "no search" instead of a wrong view.
    applySelection(null);
    setStatus('');
    var message = failureMessage(verdict, parseRetryAfter(retryAfterRaw));
    showNotice(message.title, message.hint, ACTION_RETRY);
    activeRequest = null;
  }

  /**
   * Run a search and apply the outcome.
   *
   * @param {string} query
   * @param {number} [attempt] - 1 for a fresh search, 2 for the single retry
   */
  function runSearch(query, attempt) {
    abortInFlight();

    // One record per attempt, captured in the closures below so a late-settling
    // request reads its OWN state rather than whatever is current by the time it
    // finishes. A slow first request can settle after a second has started.
    var record = {
      controller: null,
      timer: null,
      timedOut: false,
      superseded: false,
      query: query,
      attempt: attempt || 1
    };
    activeRequest = record;

    var headers = { Accept: 'application/json' };
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    var options = { method: 'GET', headers: headers };
    if (typeof AbortController !== 'undefined') {
      record.controller = new AbortController();
      options.signal = record.controller.signal;
    }

    // Each attempt carries its own budget rather than sharing one across the
    // operation, because a shared budget would leave the retry with whatever the
    // first attempt did not use -- often nothing, making the retry pointless.
    record.timer = setTimeout(function() {
      record.timedOut = true;
      if (record.controller) {
        try {
          record.controller.abort();
        } catch (e) {
          // Nothing to recover; the request is finished either way.
        }
      }
    }, config.timeoutMs);

    hideNotice();
    setStatus(strings.searching);

    var status = 0;
    var retryAfterRaw = null;
    var errorCode = null;

    fetch(buildUrl(query), options)
      .then(function(response) {
        status = response.status;
        if (response.headers && typeof response.headers.get === 'function') {
          retryAfterRaw = response.headers.get('Retry-After');
        }
        if (!response.ok) {
          // Read the body before throwing: the edge rejections carry a machine code
          // that classifyFailure needs, and it is unreachable once this rejects.
          // A body that cannot be read is not a failure of its own -- classification
          // falls back to the status code, which is the old behaviour.
          return response.text().then(function(text) {
            errorCode = parseErrorCode(text);
            throw new Error('Search API returned HTTP ' + response.status);
          }, function() {
            throw new Error('Search API returned HTTP ' + response.status);
          });
        }
        return response.json();
      })
      .then(function(payload) {
        clearRequestTimer(record);
        if (record.superseded) {
          return;
        }
        var parsed = parseResults(payload);
        rememberResult(query, parsed);
        applyParsedResult(parsed, query);
        activeRequest = null;
      })
      .catch(function(err) {
        clearRequestTimer(record);
        // A supersede is not a failure: the newer request owns the outcome, and
        // reporting this one would clobber its status. It must also not retry.
        if (record.superseded) {
          return;
        }
        handleFailure(record, err, status, retryAfterRaw, errorCode);
      });
  }

  /**
   * Clear the search: deactivate the dimension and restore every marker.
   */
  function clearSearch() {
    abortInFlight();
    // A query the visitor cleared before it settled was not a search they made.
    cancelAnalytics();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastResultLocations = [];
    applySelection(null);
    hideNotice();
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
      hideNotice();
      setStatus('');
      return;
    }

    // The query ends in a connector, so the user is mid-thought. Schedule nothing.
    //
    // Note what is deliberately NOT done here. The display is left exactly as it is:
    // no abort, no cleared selection, no status change. If a result is already on
    // screen it stays, which is right -- for "parking and" the finished query returns
    // the same 429 spots, so the deferral is invisible. An in-flight request for the
    // shorter query is also still the result the user wants, so aborting would be
    // strictly worse.
    //
    // Accepted trade-off: typing straight through "parkplatz und" without ever
    // pausing on "parkplatz" cancels the pending fire and schedules nothing, so no
    // results appear until more is typed. Previously six wrong spots appeared. Showing
    // nothing briefly is the better of the two, and this is a chosen behaviour rather
    // than an accident.
    if (endsWithConnector(query)) {
      return;
    }

    debounceTimer = setTimeout(function() {
      debounceTimer = null;

      // Cache before network. A hit costs ~0.03ms against 286ms warm and up to
      // ~4.8s cold, and costs the backend nothing at all.
      var cached = lookupResult(query);
      if (cached) {
        abortInFlight();
        // The cache path reports to analytics too: the visitor searched either way, and
        // omitting it would bias the data against the most popular queries.
        applyParsedResult(cached, query);
        return;
      }

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
    inputEl.setAttribute('maxlength', String(MAX_QUERY_LENGTH));
    inputEl.setAttribute('aria-label', strings.ariaLabel);
    inputEl.setAttribute('aria-describedby', 'spot-search-status');
    inputEl.setAttribute('autocomplete', 'off');
    // search.focus, NOT search.query. Tinylytics fires on CLICK, so an attribute on a
    // text input records the visitor clicking into the box -- it cannot see what they
    // typed, and it carries no value. This was named search.query, which asserted
    // something it does not measure; any historical search.query data is a focus count.
    //
    // Kept rather than deleted: a visitor who opens the search box and never searches is
    // a funnel signal available nowhere else, and comparing it against the real
    // search.query event gives an engagement rate neither provides alone.
    inputEl.setAttribute('data-tinylytics-event', 'search.focus');

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
    buildNotice(mapInstance);
    // Deferred to idle: enumeration touches every storage key, so it never runs
    // during initialisation.
    schedulePurge();

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
    _buildNoticeForTest: buildNotice,
    _showNoticeForTest: showNotice,
    _hideNoticeForTest: hideNotice,
    _runNoticeActionForTest: runNoticeAction,
    _lookupResultForTest: lookupResult,
    _rememberResultForTest: rememberResult,
    _purgeSupersededForTest: purgeSupersededEntries,
    _resetCachesForTest: function() {
      memoryCache = null;
      memoryResultCount = 0;
      persistenceAvailable = true;
    },
    _memoryStatsForTest: function() {
      return {
        entries: memoryCache ? memoryCache.size : 0,
        results: memoryResultCount
      };
    },
    clearSearch: clearSearch,
    // Exposed for tests: pure helpers with no DOM or network dependency.
    _parseResults: parseResults,
    _formatCount: formatCount,
    _buildUrl: buildUrl,
    _endsWithConnector: endsWithConnector,
    _CONNECTORS: CONNECTORS,
    _mergeStrings: mergeStrings,
    _numberOr: numberOr,
    _parseErrorCode: parseErrorCode,
    _formatSearchEventValue: formatSearchEventValue,
    _ANALYTICS_SETTLE_MS: ANALYTICS_SETTLE_MS,
    _quotaResetTime: quotaResetTime,
    _classifyFailure: classifyFailure,
    _failureMessage: failureMessage,
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
