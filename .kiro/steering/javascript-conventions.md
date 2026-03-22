---
inclusion: fileMatch
fileMatchPattern: "assets/js/**/*.js"
---

# JavaScript Conventions

The frontend is vanilla JavaScript with no build toolchain (no Webpack, no Babel, no framework). All code must comply with the site's strict Content Security Policy.

## Module Pattern

All modules use the IIFE-to-global pattern. No ES module imports/exports:

```javascript
/**
 * Module Name
 *
 * [Description of what this module does]
 */

(function(global) {
  'use strict';

  function myPublicFunction() {
    // ...
  }

  global.MyModule = {
    init: init,
    myPublicFunction: myPublicFunction
  };
})(window);
```

## CSP Constraints

The site enforces `script-src 'self'` and `style-src 'self'`. This means:

- No inline `<script>` blocks or `style=""` attributes
- No `eval()`, `new Function()`, or dynamic code execution
- No CDN references at runtime — all vendor assets are self-hosted
- JSON data is passed to JS via `<script type="application/json">` blocks, parsed at runtime by external `.js` files

## Vendor Assets

Third-party libraries (Bootstrap, Leaflet, Chart.js, MapLibre GL) are installed via npm but copied to `assets/js/vendor/` and `assets/css/vendor/` by build scripts. Never reference CDN URLs.

## Key Rules

- Write browser-compatible ES5/ES6 — no transpilation available
- Scripts are loaded via `<script>` tags in Jekyll layouts, not ES module imports
- Modules communicate through global functions and the DOM
- Use the colour values from CSS custom properties (`--pb-color-*`) via `color-vars.js`, not hardcoded hex values
- Reference `#[[file:docs/frontend.md]]` for the full module inventory and map initialisation flow
