/**
 * Color Variables Module
 *
 * Reads the build-time colour palette emitted as a CSP-safe JSON block
 * (#paddelbuch-colors) and exposes it as window.PaddelbuchColors. Consumers
 * default to {} when the global is unset, so a missing or malformed block
 * degrades gracefully instead of throwing.
 */

(function (global) {
  'use strict';

  if (typeof document === 'undefined') {
    return;
  }

  var el = document.getElementById('paddelbuch-colors');
  if (!el) {
    return;
  }

  try {
    global.PaddelbuchColors = JSON.parse(el.textContent);
  } catch (e) {
    // Leave PaddelbuchColors unset on malformed input; consumers default to {}.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('color-vars: failed to parse #paddelbuch-colors JSON:', e);
    }
  }
})(typeof window !== 'undefined' ? window : this);
