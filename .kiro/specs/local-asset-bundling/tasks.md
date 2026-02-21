# Implementation Plan: Local Asset Bundling

## Overview

Bundle all external CDN dependencies (Bootstrap, Leaflet, Leaflet Locate Control, Google Fonts) locally within the Jekyll site. Implementation proceeds incrementally: package setup → build scripts → Jekyll config → layout updates → Amplify pipeline → CSP update, with property tests validating correctness at each stage.

## Tasks

- [x] 1. Add vendor dependencies to package.json
  - Add `bootstrap@5.3.2`, `leaflet@1.9.4`, `leaflet.locatecontrol@0.79.0` as dependencies
  - Add `copy-assets` and `download-fonts` npm scripts
  - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 2. Create vendor asset copy script
  - [x] 2.1 Implement `scripts/copy-vendor-assets.js`
    - Create destination directories (`assets/js/vendor/`, `assets/css/vendor/`, `assets/css/vendor/images/`)
    - Copy Bootstrap JS bundle from `node_modules/bootstrap/dist/js/bootstrap.bundle.min.js` to `assets/js/vendor/`
    - Copy Leaflet JS from `node_modules/leaflet/dist/leaflet.js` to `assets/js/vendor/`
    - Copy Leaflet CSS from `node_modules/leaflet/dist/leaflet.css` to `assets/css/vendor/`
    - Copy Leaflet images from `node_modules/leaflet/dist/images/*.png` to `assets/css/vendor/images/`
    - Copy Leaflet Locate Control JS from `node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.js` to `assets/js/vendor/`
    - Copy Leaflet Locate Control CSS from `node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.css` to `assets/css/vendor/`
    - Log each copied file, exit non-zero on failure
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 4.1, 4.2_

  - [x] 2.2 Write unit tests for copy script
    - Test that each file is copied to the correct destination
    - Test that missing source files cause non-zero exit
    - Test that destination directories are created
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 4.1, 4.2_

- [ ] 3. Create Google Fonts download script
  - [x] 3.1 Implement `scripts/download-google-fonts.js`
    - Download Fredoka woff2 files (weights 300, 400, 500) to `assets/fonts/`
    - Download Quicksand woff2 files (weights 400, 500, 700) to `assets/fonts/`
    - Name files descriptively: `fredoka-300.woff2`, `quicksand-400.woff2`, etc.
    - Generate `assets/css/vendor/fonts.css` with `@font-face` declarations using `../../fonts/` relative paths
    - Use Google Fonts CSS API with woff2 user-agent to get direct download URLs
    - Validate response content-type; exit with error if unexpected
    - Exit non-zero on any download failure
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 3.2 Write unit tests for font download script
    - Test that generated `fonts.css` contains 6 `@font-face` declarations (Fredoka 300/400/500, Quicksand 400/500/700)
    - Test that font file paths in CSS are valid relative paths
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [~] 4. Checkpoint - Verify build scripts
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Configure Jekyll Sass and SCSS imports
  - [~] 5.1 Update `_config.yml` Sass configuration
    - Add `load_paths: [node_modules]` to the existing `sass` config section
    - _Requirements: 7.1, 7.2, 7.3_

  - [~] 5.2 Update `assets/css/application.scss` to import Bootstrap
    - Add `@import "bootstrap/scss/bootstrap";` before existing custom imports
    - _Requirements: 1.1, 1.2_

- [ ] 6. Update layout to use local assets
  - [~] 6.1 Replace CDN references in `_layouts/default.html`
    - Remove Google Fonts preconnect and CSS `<link>` tags; add local `fonts.css` link
    - Remove Bootstrap CSS CDN link (now compiled via Sass)
    - Replace Leaflet CSS CDN link with local `assets/css/vendor/leaflet.css`
    - Replace Leaflet Locate Control CSS CDN link with local `assets/css/vendor/L.Control.Locate.min.css`
    - Replace Bootstrap JS CDN script with local `assets/js/vendor/bootstrap.bundle.min.js`
    - Replace Leaflet JS CDN script with local `assets/js/vendor/leaflet.js`
    - Replace Leaflet Locate Control JS CDN script with local `assets/js/vendor/L.Control.Locate.min.js`
    - Remove all `integrity` and `crossorigin` attributes from replaced tags
    - Use `{{ '...' | relative_url }}` for all local asset paths
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 1.3, 2.2, 3.4, 4.3, 5.4_

  - [~] 6.2 Write property test: Layout contains no external CDN references (Property 2)
    - **Property 2: Layout contains no external CDN references**
    - Parse `_layouts/default.html` and extract all `href` and `src` attribute values
    - Assert no URL contains `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`, or `fonts.gstatic.com`
    - Assert all CSS/JS/font asset references use local relative paths
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 7. Update Amplify build pipeline
  - [~] 7.1 Update BuildSpec in `deploy/frontend-deploy.yaml`
    - Add `nvm use 18` and `npm install` to preBuild commands
    - Add `npm run download-fonts` after npm install
    - Add `npm run copy-assets` after font download
    - Add `node_modules/**/*` to cache paths
    - Ensure `bundle install` and `bundle exec jekyll build` remain in correct order
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [~] 7.2 Update Content Security Policy in `deploy/frontend-deploy.yaml`
    - Remove `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com` from CSP header
    - Ensure `'self'` is the source for styles, scripts, fonts, and images
    - Keep `data:` for img-src (used by Leaflet) and `raw.githubusercontent.com` and `api.mapbox.com` if present
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 8. Add vendor CSS path validity property test
  - [~] 8.1 Write property test: Vendor CSS path validity (Property 1)
    - **Property 1: Vendor CSS path validity**
    - Parse all CSS files in `assets/css/vendor/` (leaflet.css, L.Control.Locate.min.css, fonts.css)
    - Extract all `url()` references from CSS content
    - For each URL, resolve the relative path from the CSS file's directory
    - Assert the resolved path points to an existing file
    - **Validates: Requirements 3.5, 5.5**

- [~] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Leaflet images go in `assets/css/vendor/images/` to preserve relative CSS path references
- Bootstrap CSS is compiled via Sass (not copied as pre-built CSS)
- Fonts are downloaded at build time, not committed to the repo
- Property tests use fast-check + Jest (already configured in the project)
