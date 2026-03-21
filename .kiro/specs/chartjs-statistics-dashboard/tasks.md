# Implementation Plan: Chart.js Statistics Dashboard

## Overview

Refactor the existing Statistics Dashboard to replace hand-rolled HTML bar charts and inline-styled legends with Chart.js canvas-based rendering. This eliminates all inline `style` attributes that are blocked by the site's CSP (`style-src 'self'`). The module interface, data contract, i18n pattern, and Ruby generator remain unchanged.

## Tasks

- [x] 1. Add Chart.js vendor dependency
  - [x] 1.1 Add `chart.js@4.5.1` to `package.json` as a production dependency
    - Run `npm install chart.js@4.5.1 --save-exact` to pin the exact version
    - _Requirements: 1.1_

  - [x] 1.2 Add Chart.js copy entry to `scripts/copy-vendor-assets.js`
    - Add `{ src: 'node_modules/chart.js/dist/chart.umd.js', dest: 'assets/js/vendor/chart.umd.js' }` to `FILE_COPIES`
    - Run `npm run copy-assets` to copy the file
    - _Requirements: 1.2_

  - [x] 1.3 Add Chart.js script to `datenqualitaet.html` front matter
    - Add `/assets/js/vendor/chart.umd.js` to the `scripts` array after `/assets/js/dashboard-map.js` and before `/assets/js/statistics-dashboard.js`
    - _Requirements: 1.3, 11.1_

- [x] 2. Create the SCSS component
  - [x] 2.1 Create `_sass/components/_statistics-dashboard.scss`
    - Define `.statistics-section`, `.statistics-section-title`, `.statistics-section-body` for section layout
    - Define `.statistics-figure`, `.statistics-figure-value`, `.statistics-figure-label`, `.statistics-figures-grid` for summary figures
    - Define BEM-modifier classes for figures: `.statistics-figure--spots`, `.statistics-figure--obstacles`, `.statistics-figure--protected-areas`, `.statistics-figure--seekajak`, `.statistics-figure--kanadier`, `.statistics-figure--stand-up-paddle-board`, `.statistics-figure--swiss-canoe`, `.statistics-figure--openstreetmap`, `.statistics-figure--swiss-canoe-fako-member`, `.statistics-figure--individual-contributor`, `.statistics-figure--swiss-canoe-meldestelle`, `.statistics-figure--cc-by-sa-4`, `.statistics-figure--lizenz-odbl`
    - Define `.statistics-chart-container` and `.statistics-bar` for chart canvas wrapper with appropriate height
    - Define `.statistics-legend`, `.statistics-legend-item`, `.statistics-legend-swatch` for legend layout
    - Define BEM-modifier classes for legend swatches using SCSS colour variables: `--einstieg-ausstieg`, `--nur-einstieg`, `--nur-ausstieg`, `--rasthalte`, `--notauswasserungsstelle`, `--no-entry`, `--with-portage`, `--without-portage`, `--naturschutzgebiet`, `--fahrverbotzone`, `--schilfgebiet`, `--schwimmbereich`, `--industriegebiet`, `--schiesszone`, `--teleskizone`, `--privatbesitz`, `--wasserskizone`
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 2.2 Add import to `_sass/components/_components.scss`
    - Add `@import "statistics-dashboard";` to the manifest
    - _Requirements: 6.2_

- [x] 3. Refactor statistics-dashboard.js to use Chart.js
  - [x] 3.1 Refactor `assets/js/statistics-dashboard.js`
    - Add `var Chart = global.Chart;` reference at top of IIFE
    - Add `var chartInstances = [];` array to track Chart.js instances
    - Implement `destroyCharts()` function that iterates `chartInstances`, calls `.destroy()` on each (wrapped in try/catch), and resets the array
    - Implement `createStackedBarChart(canvas, segments)` that creates a `new Chart(canvas, config)` with `type: 'bar'`, `indexAxis: 'y'`, `stacked: true`, `responsive: true`, `maintainAspectRatio: false`, legend disabled, and stores the instance in `chartInstances`
    - Replace `renderStackedBar()` to create a `<canvas>` element inside a `.statistics-chart-container` div instead of inline-styled `<div>` segments
    - Replace `renderLegend()` to use BEM-modifier CSS classes (e.g. `statistics-legend-swatch--einstieg-ausstieg`) instead of inline `background-color` styles
    - Update `renderBarSection()` to use the new `renderStackedBar()` and `renderLegend()`
    - Add BEM-modifier classes to summary figures (e.g. `statistics-figure--spots`)
    - Call `destroyCharts()` at the start of `activate()` (defensive cleanup)
    - After rendering HTML into `contentEl`, query all `<canvas>` elements and call `createStackedBarChart()` for each
    - Call `destroyCharts()` in `deactivate()` before clearing DOM
    - Remove all `style=` string literals and `.style.` property assignments
    - Maintain existing module interface: `id: 'statistics'`, `usesMap: false`, `getName()`, `activate(context)`, `deactivate()`, registry push, global exposure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4_

- [x] 4. Verify existing tests still pass
  - [x] 4.1 Run existing RSpec tests
    - Run `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec spec/plugins/statistics_metrics_generator_spec.rb`
    - Verify Properties 1–7 pass (Ruby generator unchanged)
    - Verify Property 8 (deactivation cleanup static analysis) passes
    - Verify module interface contract tests pass
    - Verify script load order tests pass — update if needed for new `chart.umd.js` entry
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 4.2 Run existing Jest tests
    - Run `npx jest --run _tests/unit/dashboard-csp.test.js _tests/unit/dashboard-data.test.js _tests/unit/dashboard-switcher.test.js`
    - Verify CSP, data, and switcher tests still pass
    - _Requirements: 13.1_

- [x] 5. Write new tests
  - [x] 5.1 Write unit test: vendor dependency and script load order
    - Create `_tests/unit/statistics-chartjs-vendor.test.js`
    - Verify `package.json` lists `chart.js` in dependencies
    - Verify `copy-vendor-assets.js` includes the `chart.umd.js` copy entry
    - Verify `datenqualitaet.html` scripts array includes `/assets/js/vendor/chart.umd.js` after `dashboard-data.js` and before `statistics-dashboard.js`
    - _Requirements: 1.1, 1.2, 1.3, 11.1, 11.2_

  - [x] 5.2 Write unit test: no inline styles in JS source (static analysis)
    - Create `_tests/unit/statistics-chartjs-no-inline-source.test.js`
    - Read `statistics-dashboard.js` source file
    - Verify zero occurrences of `style=` in string literals
    - Verify zero occurrences of `.style.` property assignments
    - _Requirements: 5.1, 5.2_

  - [x] 5.3 Write unit test: SCSS component structure
    - Create `_tests/unit/statistics-chartjs-scss.test.js`
    - Verify `_statistics-dashboard.scss` file exists
    - Verify `_components.scss` imports `statistics-dashboard`
    - Verify SCSS defines required class names (`.statistics-section`, `.statistics-figure`, `.statistics-chart-container`, `.statistics-legend`, `.statistics-bar`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x] 5.4 Write property test: SCSS BEM-modifier coverage (Property 7)
    - **Property 7: SCSS BEM-modifier coverage for all segment slugs**
    - Create `_tests/property/statistics-chartjs-scss-coverage.property.test.js`
    - For any known segment slug (spot types, obstacle segments, PA types), verify the SCSS file contains the corresponding `.statistics-legend-swatch--{slug}` class
    - Use `fc.constantFrom()` over all known slugs, minimum 100 runs
    - _Requirements: 6.6_

  - [x] 5.5 Write property test: no inline styles in rendered output (Property 4)
    - **Property 4: No inline styles in rendered output**
    - Create `_tests/property/statistics-chartjs-no-inline-styles.property.test.js`
    - Generate random metrics using fast-check; call activate with jsdom; verify rendered HTML contains no `style=` attribute
    - Mock `window.Chart` as a constructor that records calls (no real canvas needed)
    - Minimum 100 runs
    - _Requirements: 3.1, 4.2, 5.4_

  - [x] 5.6 Write property test: canvas rendering (Property 1)
    - **Property 1: Canvas rendering for bar chart sections**
    - Create `_tests/property/statistics-chartjs-canvas.property.test.js`
    - Generate random metrics; call activate with jsdom and mocked Chart; verify 3 canvas elements in content container
    - Minimum 100 runs
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 5.7 Write property test: Chart.js dataset correctness (Property 2)
    - **Property 2: Chart.js dataset colour and label correctness**
    - Create `_tests/property/statistics-chartjs-datasets.property.test.js`
    - Generate random metrics; call activate with mocked Chart that captures config; verify each dataset's backgroundColor and label match expected values
    - Minimum 100 runs
    - _Requirements: 2.4, 2.5_

  - [x] 5.8 Write property test: Chart.js lifecycle (Property 3)
    - **Property 3: Chart.js instance lifecycle**
    - Create `_tests/property/statistics-chartjs-lifecycle.property.test.js`
    - Generate random metrics; call activate (verify 3 instances), deactivate (verify 0 instances), activate again (verify 3 fresh instances, not 6)
    - Verify `.destroy()` called on each instance during deactivate
    - Minimum 100 runs
    - _Requirements: 2.6, 2.7, 10.1, 10.2, 10.3, 10.4_

  - [x] 5.9 Write property test: legend correctness (Property 5)
    - **Property 5: Legend BEM-modifier classes and entry counts**
    - Create `_tests/property/statistics-chartjs-legends.property.test.js`
    - Generate random metrics with varying numbers of types; verify each legend has correct entry count and BEM-modifier classes
    - Minimum 100 runs
    - _Requirements: 3.3, 3.4, 3.6_

  - [x] 5.10 Write property test: figure BEM modifiers (Property 6)
    - **Property 6: Summary figure BEM-modifier classes**
    - Create `_tests/property/statistics-chartjs-figures.property.test.js`
    - Generate random metrics; verify each summary figure has the correct BEM-modifier class
    - Minimum 100 runs
    - _Requirements: 4.4_

  - [x] 5.11 Write property test: i18n German fallback (Property 8)
    - **Property 8: i18n German fallback**
    - Create `_tests/property/statistics-chartjs-i18n-fallback.property.test.js`
    - Generate random partial/missing i18n data; verify getStrings() returns complete object with German defaults for missing keys
    - Minimum 100 runs
    - _Requirements: 9.2_

- [x] 6. Final verification
  - [x] 6.1 Run all tests
    - Run `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec spec/plugins/statistics_metrics_generator_spec.rb`
    - Run `npx jest --run`
    - Verify all existing and new tests pass
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1_

## Notes

- The Ruby generator plugin (`statistics_metrics_generator.rb`) requires zero changes
- The `dashboard-data.js` module requires zero changes
- The `#statistics-data` and `#statistics-i18n` JSON blocks require zero changes
- The CSP configuration in `deploy/frontend-deploy.yaml` requires zero changes
- Chart.js property tests mock `window.Chart` since actual canvas rendering requires a real browser — the mock records constructor calls and config for assertion
- Ruby commands must use: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec`
- The `color_generator.rb` plugin requires no changes — existing SCSS colour variables are already defined
