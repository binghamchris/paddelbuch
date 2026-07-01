/**
 * Marker Styles Module
 * 
 * Defines Leaflet icon configurations for each spot type and event notices.
 * Icons are created lazily on first use to avoid requiring Leaflet at load time.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 * 
 * Spot Type Slugs:
 * - 'einstieg-ausstieg' (Entry & Exit)
 * - 'nur-einstieg' (Entry Only)
 * - 'nur-ausstieg' (Exit Only)
 * - 'rasthalte' (Rest)
 * - 'notauswasserungsstelle' (Emergency Exit)
 * - Rejected spots use 'no-entry' marker
 */

(function(global) {
  'use strict';

  // Base path for marker images
  var basePath = '/assets/images/markers/';
  
  // Common icon settings
  var commonSettings = {
    shadowUrl: null,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
    shadowSize: [0, 0],
    shadowAnchor: [0, 0]
  };

  // Icon URL configs (no Leaflet dependency)
  var iconUrls = {
    spotEinstiegAusstieg: basePath + 'startingspots-entryexit.svg',
    spotNurEinstieg: basePath + 'startingspots-entry.svg',
    spotNurAusstieg: basePath + 'otherspots-exit.svg',
    spotRasthalte: basePath + 'otherspots-rest.svg',
    spotNotauswasserung: basePath + 'otherspots-emergency.svg',
    rejectedSpot: basePath + 'otherspots-noentry.svg',
    waterwayEventNotice: basePath + 'waterwayevent.svg'
  };

  // Cache for lazily created L.Icon instances
  var iconCache = {};

  /**
   * Creates a Leaflet icon with the specified image URL.
   * Requires Leaflet (L) to be available at call time.
   * @param {string} iconUrl - URL to the marker icon image
   * @returns {L.Icon} Leaflet icon instance
   */
  function createIcon(iconUrl) {
    return L.icon({
      iconUrl: iconUrl,
      iconRetinaUrl: iconUrl,
      shadowUrl: commonSettings.shadowUrl,
      iconSize: commonSettings.iconSize,
      iconAnchor: commonSettings.iconAnchor,
      popupAnchor: commonSettings.popupAnchor,
      shadowSize: commonSettings.shadowSize,
      shadowAnchor: commonSettings.shadowAnchor
    });
  }

  /**
   * Gets or creates a cached Leaflet icon for the given key.
   * @param {string} key - Icon key from iconUrls
   * @returns {L.Icon} Leaflet icon instance
   */
  function getOrCreateIcon(key) {
    if (!iconCache[key]) {
      iconCache[key] = createIcon(iconUrls[key]);
    }
    return iconCache[key];
  }

  /**
   * Lazy marker styles accessor -- creates icons on first access.
   */
  var markerStyles = {
    get spotEinstiegAusstiegIcon() { return getOrCreateIcon('spotEinstiegAusstieg'); },
    get spotNurEinstiegIcon() { return getOrCreateIcon('spotNurEinstieg'); },
    get spotNurAusstiegIcon() { return getOrCreateIcon('spotNurAusstieg'); },
    get spotRasthalteIcon() { return getOrCreateIcon('spotRasthalte'); },
    get spotNotauswasserungIcon() { return getOrCreateIcon('spotNotauswasserung'); },
    get rejectedSpotIcon() { return getOrCreateIcon('rejectedSpot'); },
    get waterwayEventNoticeIcon() { return getOrCreateIcon('waterwayEventNotice'); }
  };

  /**
   * Maps spot type slugs to their corresponding marker icons
   * 
   * Property 1: Spot Marker Icon Assignment
   * For any spot with a valid spot type, the Map_System shall assign the marker icon
   * that corresponds to that spot type.
   * 
   * @param {string} spotTypeSlug - The slug of the spot type
   * @param {boolean} isRejected - Whether the spot is rejected
   * @returns {L.Icon} The appropriate Leaflet icon for the spot type
   */
  function getSpotIcon(spotTypeSlug, isRejected) {
    // Rejected spots always use the no-entry icon (Requirement 2.6)
    if (isRejected) {
      return markerStyles.rejectedSpotIcon;
    }

    // Map spot type slugs to icons
    var iconMap = {
      'einstieg-ausstieg': markerStyles.spotEinstiegAusstiegIcon,      // Entry & Exit (Req 2.1)
      'nur-einstieg': markerStyles.spotNurEinstiegIcon,                // Entry Only (Req 2.2)
      'nur-ausstieg': markerStyles.spotNurAusstiegIcon,                // Exit Only (Req 2.3)
      'rasthalte': markerStyles.spotRasthalteIcon,                     // Rest (Req 2.4)
      'notauswasserungsstelle': markerStyles.spotNotauswasserungIcon   // Emergency (Req 2.5)
    };

    // Use hasOwnProperty to avoid inherited properties like 'toString', 'valueOf', etc.
    if (Object.prototype.hasOwnProperty.call(iconMap, spotTypeSlug)) {
      return iconMap[spotTypeSlug];
    }
    return markerStyles.spotEinstiegAusstiegIcon;
  }

  /**
   * Gets the event notice marker icon
   * @returns {L.Icon} The event notice icon
   */
  function getEventNoticeIcon() {
    return markerStyles.waterwayEventNoticeIcon;
  }

  /**
   * Modifier icon configuration -- single authoritative source for all components.
   * Maps each tip type slug to its Tip_Glyph asset and colour.
   *
   * Each entry: { glyphUrl: string, colorKey: string, colorFallback: string }
   *   - glyphUrl:      same-origin URL of the transparent-background glyph SVG (leaf / cross).
   *   - colorKey:      key into window.PaddelbuchColors (the palette single source of truth,
   *                    generated from _sass/settings/_paddelbuch_colours.scss). The colour
   *                    generator emits camelCase keys, so $green-1 -> 'green1' and
   *                    $swisscanoe-blue -> 'swisscanoeBlue'.
   *   - colorFallback: hex mirroring the palette token, used when the palette key is
   *                    unavailable so the marker still renders in the correct colour.
   *
   * Bead/Halo geometry is NOT stored per tip -- it is computed from the number and order
   * of applicable tips (see buildTipModifierSvg).
   *
   * Requirements: 6.1, 6.2, 6.3, 4.1, 4.2
   */
  var TIP_MODIFIER_CONFIG = {
    'swiss-canoe-eco-tip': {
      glyphUrl: basePath + 'tip-modifier-swiss-canoe-eco-tip.svg',
      colorKey: 'green1',
      colorFallback: '#07753f'
    },
    'swiss-canoe-tip': {
      glyphUrl: basePath + 'tip-modifier-swiss-canoe-tip.svg',
      colorKey: 'swisscanoeBlue',
      colorFallback: '#1b1e43'
    }
  };

  /**
   * Resolves a tip's colour from the palette single source of truth, falling back
   * to the config's hard-coded hex when the palette (or the key) is unavailable.
   *
   * Requirements: 4.2, 4.3
   *
   * @param {Object} cfg - A TIP_MODIFIER_CONFIG entry ({ colorKey, colorFallback, ... })
   * @returns {string} The resolved colour
   */
  function resolveTipColor(cfg) {
    if (!cfg) return '';
    var palette = (typeof window !== 'undefined' && window.PaddelbuchColors) || {};
    return palette[cfg.colorKey] || cfg.colorFallback;
  }

  /**
   * Minimal HTML/attribute escaper. Prefers the shared PaddelbuchHtmlUtils.escapeHtml
   * when it is loaded (browser), and falls back to an inline implementation so the
   * SVG builder is self-sufficient and testable outside the browser.
   *
   * @param {string} value - Value to escape
   * @returns {string} Escaped value safe for interpolation into markup
   */
  function escapeForMarkup(value) {
    if (typeof window !== 'undefined' && window.PaddelbuchHtmlUtils && window.PaddelbuchHtmlUtils.escapeHtml) {
      return window.PaddelbuchHtmlUtils.escapeHtml(value);
    }
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Composite_Icon geometry (transcribed from the approved Reference_Mockup:
  //     .kiro/specs/spot-tip-marker-redesign/reference/marker-modifier-mockups.html,
  //     symbols m-opt3b / m-opt3b-1tip). All values are in the viewBox coordinate space. ---
  var COMPOSITE_GEOMETRY = {
    viewBox: { minX: -20, minY: -24, width: 92, height: 116 },
    // Base_Marker_Icon is drawn into its native 52x84 box; pin tip sits at (26, 83).
    baseBox: { x: 0, y: 0, width: 52, height: 84 },
    pinTip: { x: 26, y: 83 },
    // Standard (no-tip) marker renders ~32px wide; keep the same on-screen pin size.
    mapPinWidth: 32,
    arc: { strokeWidth: 2.5 },
    bead: { r: 9, strokeWidth: 1.5 },
    glyph: { size: 12 },
    // Halo arc paths (open horseshoe hugging the head from shoulder to shoulder).
    arcFull: 'M10.59,50.56 A29,29 0 1 1 41.41,50.56',   // 1 tip: single-colour horseshoe
    arcLeft: 'M10.59,50.56 A29,29 0 0 1 26,-3',          // 2 tips: left half (tip[0])
    arcRight: 'M26,-3 A29,29 0 0 1 41.41,50.56',         // 2 tips: right half (tip[1])
    // Bead centres.
    beadCentre1: { cx: 26, cy: -6 },                     // 1 tip: top-centre
    beadCentres2: [{ cx: 3.5, cy: 3.5 }, { cx: 48.5, cy: 3.5 }] // 2 tips: upper-left, upper-right
  };

  /**
   * Absolute maximum number of tip Beads/glyphs the current layout supports.
   * Only two tip types exist in the data. If a spot ever carries more than two
   * applicable tips, the first two are rendered with the 2-tip layout (a documented,
   * bounded fallback). A future spec can add a 3+ layout at the single computation
   * point below without touching callers.
   */
  var MAX_TIPS = 2;

  /**
   * Builds the geometry (arc segments, bead centres, glyph boxes) for a given list of
   * applied tips. This is the single place bead/arc positions are computed -- the
   * extension point for any future 3+ tip layout.
   *
   * @param {Array<Object>} applied - Applied config entries (already filtered, capped at MAX_TIPS)
   * @param {Array<string>} colors - Resolved colour per applied tip (parallel to applied)
   * @returns {{ arcs: Array, beads: Array }} arcs: [{ d, color }], beads: [{ cx, cy, color, glyphUrl }]
   */
  function computeCompositeLayout(applied, colors) {
    var g = COMPOSITE_GEOMETRY;
    var half = g.glyph.size / 2;
    var arcs = [];
    var beads = [];

    if (applied.length === 1) {
      arcs.push({ d: g.arcFull, color: colors[0] });
      beads.push({
        cx: g.beadCentre1.cx, cy: g.beadCentre1.cy,
        color: colors[0], glyphUrl: applied[0].glyphUrl
      });
    } else if (applied.length === 2) {
      arcs.push({ d: g.arcLeft, color: colors[0] });
      arcs.push({ d: g.arcRight, color: colors[1] });
      for (var i = 0; i < 2; i++) {
        beads.push({
          cx: g.beadCentres2[i].cx, cy: g.beadCentres2[i].cy,
          color: colors[i], glyphUrl: applied[i].glyphUrl
        });
      }
    }

    // Attach the glyph placement box (centred on the bead) for convenience.
    for (var b = 0; b < beads.length; b++) {
      beads[b].glyphX = beads[b].cx - half;
      beads[b].glyphY = beads[b].cy - half;
    }

    return { arcs: arcs, beads: beads };
  }

  /**
   * Builds the Composite_Icon markup: a single inline <svg> string that draws the
   * Base_Marker_Icon, an open Halo, one Bead per applicable tip, and each Bead's
   * Tip_Glyph -- all positioned with SVG geometry/presentation attributes only
   * (no inline `style`), so it is CSP-clean.
   *
   * Slugs without a TIP_MODIFIER_CONFIG entry are skipped (Requirement 6.4). When
   * no applicable tips remain, returns an empty string so the caller can fall back
   * to the standard icon.
   *
   * Requirements: 1.1-1.6, 3.1, 3.2, 3.3, 5.1, 6.4
   *
   * @param {string} baseIconUrl - Same-origin URL of the Base_Marker_Icon SVG
   * @param {Array<string>} tipSlugs - Tip type slugs for the spot
   * @param {string} ariaLabel - Localised accessible name for the marker
   * @returns {string} The inline <svg> markup (empty string when no applicable tips)
   */
  function buildTipModifierSvg(baseIconUrl, tipSlugs, ariaLabel) {
    var g = COMPOSITE_GEOMETRY;
    var slugs = tipSlugs || [];

    // Filter to slugs that have a config entry, then cap at the supported maximum.
    var applied = [];
    for (var i = 0; i < slugs.length && applied.length < MAX_TIPS; i++) {
      var cfg = TIP_MODIFIER_CONFIG[slugs[i]];
      if (cfg) applied.push(cfg);
    }

    if (applied.length === 0) return '';

    var colors = applied.map(resolveTipColor);
    var layout = computeCompositeLayout(applied, colors);

    var vb = g.viewBox.minX + ' ' + g.viewBox.minY + ' ' + g.viewBox.width + ' ' + g.viewBox.height;
    var label = escapeForMarkup(ariaLabel || '');
    var baseHref = escapeForMarkup(baseIconUrl);

    var parts = [];
    parts.push('<svg viewBox="' + vb + '" role="img" aria-label="' + label + '"' +
      ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">');

    // Base_Marker_Icon (drawn first, underneath the halo/beads).
    parts.push('<image href="' + baseHref + '" xlink:href="' + baseHref + '"' +
      ' x="' + g.baseBox.x + '" y="' + g.baseBox.y +
      '" width="' + g.baseBox.width + '" height="' + g.baseBox.height + '" />');

    // Halo arc segment(s).
    for (var a = 0; a < layout.arcs.length; a++) {
      parts.push('<path d="' + layout.arcs[a].d + '" fill="none" stroke="' +
        escapeForMarkup(layout.arcs[a].color) + '" stroke-width="' + g.arc.strokeWidth +
        '" stroke-linecap="round" />');
    }

    // Beads (drawn after the arc so they render on top).
    for (var c = 0; c < layout.beads.length; c++) {
      parts.push('<circle cx="' + layout.beads[c].cx + '" cy="' + layout.beads[c].cy +
        '" r="' + g.bead.r + '" fill="#fff" stroke="' + escapeForMarkup(layout.beads[c].color) +
        '" stroke-width="' + g.bead.strokeWidth + '" />');
    }

    // Tip_Glyphs (centred inside each bead, drawn last).
    for (var d = 0; d < layout.beads.length; d++) {
      var glyphHref = escapeForMarkup(layout.beads[d].glyphUrl);
      parts.push('<image href="' + glyphHref + '" xlink:href="' + glyphHref + '"' +
        ' x="' + layout.beads[d].glyphX + '" y="' + layout.beads[d].glyphY +
        '" width="' + g.glyph.size + '" height="' + g.glyph.size + '" />');
    }

    parts.push('</svg>');
    return parts.join('');
  }

  /**
   * Computes the Leaflet DivIcon sizing/anchoring for the Composite_Icon so the
   * Base_Marker_Icon renders at the same on-screen size as a standard marker and
   * stays anchored at the pin tip (Requirement 1.9). Values are derived from the
   * geometry + scale rather than hard-coded.
   *
   * @returns {{ iconSize: number[], iconAnchor: number[], popupAnchor: number[] }}
   */
  function getCompositeIconSizing() {
    var g = COMPOSITE_GEOMETRY;
    var k = g.mapPinWidth / g.baseBox.width; // px per viewBox unit
    return {
      iconSize: [g.viewBox.width * k, g.viewBox.height * k],
      iconAnchor: [(g.pinTip.x - g.viewBox.minX) * k, (g.pinTip.y - g.viewBox.minY) * k],
      // Opens the popup just above the halo/bead top, matching the prior [0, -53] behaviour.
      popupAnchor: [0, -58]
    };
  }

  // Export to global scope
  global.PaddelbuchMarkerStyles = {
    markerStyles: markerStyles,
    getSpotIcon: getSpotIcon,
    getEventNoticeIcon: getEventNoticeIcon,
    createIcon: createIcon,
    TIP_MODIFIER_CONFIG: TIP_MODIFIER_CONFIG,
    resolveTipColor: resolveTipColor,
    buildTipModifierSvg: buildTipModifierSvg,
    getCompositeIconSizing: getCompositeIconSizing,
    COMPOSITE_GEOMETRY: COMPOSITE_GEOMETRY,
    MAX_TIPS: MAX_TIPS
  };

})(typeof window !== 'undefined' ? window : this);
