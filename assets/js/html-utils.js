/**
 * HTML Utility Functions Module
 *
 * Shared utility functions for HTML escaping, stripping, and text truncation.
 * Used by spot-popup.js, obstacle-popup.js, and event-notice-popup.js.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.6
 */

(function(global) {
  'use strict';

  /**
   * Escapes HTML special characters to prevent XSS
   *
   * Property 3: HTML escaping correctness
   * For any string containing HTML special characters (<, >, &, ", '),
   * the result contains no unescaped < or > and all special characters
   * are replaced with their HTML entity equivalents.
   *
   * @param {string} text - The text to escape
   * @returns {string} The escaped text
   */
  function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Strips HTML tags from a string
   *
   * Property 4: HTML stripping completeness
   * For any string containing HTML tags, the result contains no
   * substrings matching the pattern <[^>]*>.
   *
   * @param {string} html - HTML string
   * @returns {string} Plain text with all HTML tags removed
   */
  function stripHtml(html) {
    if (html == null) return '';
    return String(html).replace(/<[^>]*>/g, '');
  }

  /**
   * Truncates text to a maximum length with ellipsis
   *
   * Property 5: Truncation length invariant
   * Output length is at most maxLength + 3 (for the '...' suffix).
   * If input length <= maxLength, output equals input exactly.
   *
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length before truncation
   * @returns {string} Truncated text with '...' suffix if truncated
   */
  function truncate(text, maxLength) {
    if (text == null) return '';
    var str = String(text);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  global.PaddelbuchHtmlUtils = {
    escapeHtml: escapeHtml,
    stripHtml: stripHtml,
    truncate: truncate
  };
})(typeof window !== 'undefined' ? window : this);
