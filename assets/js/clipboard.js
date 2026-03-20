/**
 * Clipboard Module
 * 
 * Provides copy-to-clipboard functionality for GPS coordinates and addresses.
 * 
 * Requirements: 3.2, 3.3, 11.2
 */

(function(global) {
  'use strict';

  /**
   * Copies text to the clipboard using the modern Clipboard API
   * with fallback for older browsers.
   * 
   * @param {string} text - The text to copy to clipboard
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function copyToClipboard(text) {
    // Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function() {
          return true;
        })
        .catch(function(err) {
          console.warn('Clipboard API failed, trying fallback:', err);
          return fallbackCopyToClipboard(text);
        });
    }
    
    // Fallback for older browsers
    return Promise.resolve(fallbackCopyToClipboard(text));
  }

  /**
   * Fallback copy method using execCommand for older browsers
   * 
   * @param {string} text - The text to copy
   * @returns {boolean} True if successful
   */
  function fallbackCopyToClipboard(text) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    var successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    
    document.body.removeChild(textArea);
    return successful;
  }

  /**
   * Shows a brief visual feedback when copy is successful
   * 
   * @param {HTMLElement} button - The button element that was clicked
   * @param {boolean} success - Whether the copy was successful
   */
  function showCopyFeedback(button, success) {
    if (!button) return;
    
    var originalTitle = button.getAttribute('title');
    var originalClass = button.className;
    
    if (success) {
      button.classList.add('copy-success');
      button.setAttribute('title', '✓');
    } else {
      button.classList.add('copy-error');
      button.setAttribute('title', '✗');
    }
    
    // Reset after 1.5 seconds
    setTimeout(function() {
      button.className = originalClass;
      button.setAttribute('title', originalTitle);
    }, 1500);
  }

  /**
   * Copies GPS coordinates to clipboard (Requirement 3.2)
   * Formats coordinates as "lat, lon"
   * 
   * @param {number|string} lat - Latitude coordinate
   * @param {number|string} lon - Longitude coordinate
   * @param {HTMLElement} [button] - Optional button element for visual feedback
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function copyGPS(lat, lon, button) {
    var coordinates = lat + ', ' + lon;
    
    return copyToClipboard(coordinates)
      .then(function(success) {
        if (button) {
          showCopyFeedback(button, success);
        }
        return success;
      });
  }

  /**
   * Copies an address to clipboard (Requirement 3.3)
   * 
   * @param {string} address - The address to copy
   * @param {HTMLElement} [button] - Optional button element for visual feedback
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function copyAddress(address, button) {
    return copyToClipboard(address)
      .then(function(success) {
        if (button) {
          showCopyFeedback(button, success);
        }
        return success;
      });
  }

  /**
   * Generic copy function that can be used for any text
   * 
   * @param {string} text - The text to copy
   * @param {HTMLElement} [button] - Optional button element for visual feedback
   * @returns {Promise<boolean>} Promise resolving to true if successful
   */
  function copy(text, button) {
    return copyToClipboard(text)
      .then(function(success) {
        if (button) {
          showCopyFeedback(button, success);
        }
        return success;
      });
  }

  // Bind event listeners for CSP-compliant clipboard buttons
  function bindClipboardListeners() {
    document.querySelectorAll('[data-copy-gps]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        copyGPS(btn.dataset.lat, btn.dataset.lon, btn);
      });
    });

    document.querySelectorAll('[data-copy-address]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        copyAddress(btn.dataset.address, btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindClipboardListeners);
  } else {
    bindClipboardListeners();
  }

  // Export to global scope
  global.PaddelbuchClipboard = {
    copyToClipboard: copyToClipboard,
    copyGPS: copyGPS,
    copyAddress: copyAddress,
    copy: copy,
    showCopyFeedback: showCopyFeedback
  };

})(typeof window !== 'undefined' ? window : this);
