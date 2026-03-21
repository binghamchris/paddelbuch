# Requirements Document

## Introduction

The Statistics Dashboard currently renders summary figures and horizontal stacked bar charts using hand-crafted HTML with inline `style` attributes. These inline styles are blocked by the site's Content Security Policy (`style-src 'self'` — no `'unsafe-inline'`), causing bar chart segments to have zero height and legend swatches to be invisible (0×20px). This refactoring replaces the hand-rolled HTML charts with Chart.js canvas-based rendering, which sidesteps CSP `style-src` restrictions entirely because `<canvas>` drawing does not use CSS inline styles. Summary figures remain as HTML but are styled exclusively via SCSS classes. All inline `style` attributes are removed from the JavaScript module.

## Glossary

- **Statistics_Dashboard**: The existing non-map Dashboard module (id: `statistics`, `usesMap: false`) in `assets/js/statistics-dashboard.js` that renders summary figures and bar charts into the `#dashboard-content` container
- **Chart_JS**: The Chart.js library (MIT licensed, zero dependencies), a single-file JavaScript charting library that renders charts to `<canvas>` elements
- **Vendor_Asset_Pipeline**: The project's mechanism for copying third-party JS/CSS files from `node_modules/` to `assets/js/vendor/` (or `assets/css/vendor/`) via `scripts/copy-vendor-assets.js`
- **CSP**: Content Security Policy, configured in `deploy/frontend-deploy.yaml` with `style-src 'self'` (no `'unsafe-inline'`), which blocks all inline `style` attributes
- **Stacked_Bar_Chart**: A single horizontal bar divided into coloured segments, each segment representing a category's count proportionally — currently rendered as hand-crafted HTML `<div>` elements with inline styles, to be replaced by Chart.js horizontal stacked bar charts on `<canvas>`
- **Summary_Figure**: A prominent numeric display showing a total count (e.g. total number of spots), rendered as HTML and styled via SCSS classes
- **Legend**: A colour-coded key identifying each segment in a bar chart — currently rendered as HTML `<span>` elements with inline `background-color` styles, to be replaced by Chart.js built-in legends or CSS-class-based legends
- **Dashboard_Page**: The existing Data Quality page at `/offene-daten/datenqualitaet/` that hosts all data quality dashboards
- **Dashboard_Switcher**: The existing UI control (`dashboard-switcher.js`) that manages activation/deactivation and container visibility for registered dashboards
- **PaddelbuchColors**: The global JavaScript object populated by `color_generator.rb` from SCSS colour variables in `_paddelbuch_colours.scss`
- **Statistics_SCSS**: The new SCSS component file (`_sass/components/_statistics-dashboard.scss`) providing layout and styling for the statistics dashboard without inline styles
- **Module_Interface**: The existing dashboard module contract: `{ id, getName, usesMap, activate(context), deactivate() }` registered on `PaddelbuchDashboardRegistry`

## Requirements

### Requirement 1: Add Chart.js as a Vendor Dependency

**User Story:** As a developer, I want Chart.js added to the project's vendor asset pipeline, so that the statistics dashboard can use canvas-based charts without a bundler.

#### Acceptance Criteria

1. THE package.json SHALL list `chart.js` as a production dependency
2. THE Vendor_Asset_Pipeline script (`scripts/copy-vendor-assets.js`) SHALL copy the Chart.js distribution file from `node_modules/chart.js/dist/chart.umd.js` to `assets/js/vendor/chart.umd.js`
3. THE Dashboard_Page front matter `scripts` array SHALL include `/assets/js/vendor/chart.umd.js` before `/assets/js/statistics-dashboard.js`
4. WHEN the Dashboard_Page loads, THE Chart_JS global (`Chart`) SHALL be available to the Statistics_Dashboard module

### Requirement 2: Replace Hand-Rolled Bar Charts with Chart.js Canvas Charts

**User Story:** As a Paddelbuch user, I want the statistics bar charts to render correctly despite the site's Content Security Policy, so that I can see the data breakdowns.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL render the spots breakdown as a Chart.js horizontal stacked bar chart on a `<canvas>` element
2. THE Statistics_Dashboard SHALL render the obstacles breakdown as a Chart.js horizontal stacked bar chart on a `<canvas>` element
3. THE Statistics_Dashboard SHALL render the protected areas breakdown as a Chart.js horizontal stacked bar chart on a `<canvas>` element
4. EACH Chart.js chart SHALL use colours from PaddelbuchColors, mapping each segment slug to its corresponding colour variable
5. EACH Chart.js chart SHALL display segment labels using the localised type names from the pre-computed metrics
6. THE Statistics_Dashboard SHALL create Chart.js chart instances during `activate(context)` and destroy them during `deactivate()`
7. WHEN the Statistics_Dashboard is deactivated and reactivated, THE Statistics_Dashboard SHALL create fresh Chart.js instances without memory leaks from previous instances

### Requirement 3: Replace Inline-Styled Legends

**User Story:** As a Paddelbuch user, I want the chart legends to be visible and styled correctly under the site's CSP, so that I can identify what each chart segment represents.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL render legends for each bar chart section without using inline `style` attributes
2. THE Statistics_Dashboard SHALL use either Chart.js built-in legend rendering (which draws on canvas) or HTML legends styled exclusively via CSS classes defined in Statistics_SCSS
3. IF HTML legends are used, EACH legend swatch SHALL receive its colour via a BEM-modifier CSS class (e.g. `.statistics-legend-swatch--einstieg-ausstieg`) defined in Statistics_SCSS, not via an inline `background-color` style
4. THE legend for the spots chart SHALL include one entry for each spot type segment and one entry for the no-entry segment
5. THE legend for the obstacles chart SHALL include entries for "with portage route" and "without portage route"
6. THE legend for the protected areas chart SHALL include one entry for each protected area type segment

### Requirement 4: Style Summary Figures via SCSS

**User Story:** As a developer, I want the summary figures styled via SCSS classes instead of inline styles, so that the dashboard complies with the site's CSP.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL render summary figures (total counts) as HTML elements with CSS classes from Statistics_SCSS
2. THE Statistics_Dashboard SHALL apply no inline `style` attributes to summary figure elements
3. THE Statistics_SCSS SHALL define layout and typography classes for `.statistics-figure`, `.statistics-figure-value`, and `.statistics-figure-label`
4. EACH summary figure element SHALL receive a unique BEM-modifier CSS class derived from its metric section (e.g. `.statistics-figure--spots`, `.statistics-figure--obstacles`, `.statistics-figure--protected-areas`, `.statistics-figure--seekajak`, `.statistics-figure--swiss-canoe`), so that individual figures can be targeted directly for custom styling if required
5. THE summary figures layout SHALL be responsive and display correctly on both desktop and mobile viewports

### Requirement 5: Remove All Inline Style Attributes

**User Story:** As a developer, I want the statistics dashboard JavaScript module to contain zero inline `style` attribute assignments, so that the module fully complies with the `style-src 'self'` CSP directive.

#### Acceptance Criteria

1. THE Statistics_Dashboard JavaScript module SHALL contain zero occurrences of `style=` in any string literal or template used for HTML generation
2. THE Statistics_Dashboard JavaScript module SHALL contain zero occurrences of `.style.` property assignments on DOM elements
3. ALL visual styling of Statistics_Dashboard elements SHALL be achieved through CSS classes defined in Statistics_SCSS or through Chart.js canvas rendering
4. WHEN the Dashboard_Page is served with the CSP header `style-src 'self'`, THE Statistics_Dashboard SHALL render all elements correctly without CSP violations

### Requirement 6: Create Statistics Dashboard SCSS Component

**User Story:** As a developer, I want a dedicated SCSS component file for the statistics dashboard, so that layout and styling are maintainable and CSP-compliant.

#### Acceptance Criteria

1. THE project SHALL include a new SCSS file at `_sass/components/_statistics-dashboard.scss`
2. THE `_sass/components/_components.scss` manifest SHALL import `statistics-dashboard`
3. THE Statistics_SCSS SHALL define classes for the dashboard layout: `.statistics-section`, `.statistics-section-title`, `.statistics-section-body`
4. THE Statistics_SCSS SHALL define classes for summary figures: `.statistics-figure`, `.statistics-figure-value`, `.statistics-figure-label`, `.statistics-figures-grid`
5. THE Statistics_SCSS SHALL define classes for chart containers: `.statistics-chart-container`
6. THE Statistics_SCSS SHALL define classes for legends: `.statistics-legend`, `.statistics-legend-item`, `.statistics-legend-swatch` with BEM-modifier classes for each colour (using the SCSS colour variables from `_paddelbuch_colours.scss`)
7. THE Statistics_SCSS SHALL define a `.statistics-bar` class for the chart wrapper with appropriate dimensions so that Chart.js canvas elements render at a visible height

### Requirement 7: Maintain Existing Module Interface

**User Story:** As a developer, I want the refactored statistics dashboard to maintain its existing module interface, so that the dashboard-switcher and existing tests continue to work without changes.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL retain `id: 'statistics'`
2. THE Statistics_Dashboard SHALL retain `usesMap: false`
3. THE Statistics_Dashboard SHALL retain `getName: function()` returning the localised dashboard name
4. THE Statistics_Dashboard SHALL retain `activate: function(context)` accepting the context object from the Dashboard_Switcher
5. THE Statistics_Dashboard SHALL retain `deactivate: function()` clearing `#dashboard-content`, `#dashboard-title`, `#dashboard-description`, and `#dashboard-legend`
6. THE Statistics_Dashboard SHALL continue to register on `PaddelbuchDashboardRegistry` and expose itself as `global.PaddelbuchStatisticsDashboard`
7. THE Statistics_Dashboard SHALL continue to read pre-computed metrics from `PaddelbuchDashboardData.statisticsMetrics`

### Requirement 8: Maintain Existing Data Contract

**User Story:** As a developer, I want the refactored dashboard to consume the same pre-computed metrics data, so that no changes are needed to the Ruby generator plugin or the data parsing module.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL read metrics from `PaddelbuchDashboardData.statisticsMetrics` without changes to the data structure
2. THE Statistics_Dashboard SHALL read localised strings from the `#statistics-i18n` JSON block without changes to the i18n block structure
3. THE `statistics_metrics_generator.rb` plugin SHALL require no modifications for this refactoring
4. THE `dashboard-data.js` module SHALL require no modifications for this refactoring
5. THE `datenqualitaet.html` template SHALL require no changes to the `#statistics-data` or `#statistics-i18n` JSON blocks

### Requirement 9: Maintain i18n Pattern

**User Story:** As a developer, I want the refactored dashboard to continue using the existing i18n pattern, so that localisation works identically in German and English.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL continue to read localised strings from the `#statistics-i18n` JSON block via the `getStrings()` function
2. THE Statistics_Dashboard SHALL continue to fall back to German default strings when the i18n block is absent or contains empty values
3. ALL user-facing text rendered by the Statistics_Dashboard — including section headings, figure labels, legend labels, and chart tooltips — SHALL use localised strings

### Requirement 10: Chart.js Instance Lifecycle Management

**User Story:** As a developer, I want Chart.js instances to be properly created and destroyed during dashboard activation/deactivation, so that there are no memory leaks or canvas reuse errors.

#### Acceptance Criteria

1. THE Statistics_Dashboard SHALL store references to all Chart.js instances created during `activate(context)`
2. WHEN `deactivate()` is called, THE Statistics_Dashboard SHALL call `.destroy()` on each stored Chart.js instance before clearing the DOM
3. WHEN `activate(context)` is called after a previous `deactivate()`, THE Statistics_Dashboard SHALL create new Chart.js instances on fresh `<canvas>` elements
4. IF `activate(context)` is called while Chart.js instances already exist, THE Statistics_Dashboard SHALL destroy existing instances before creating new ones

### Requirement 11: Script Load Order

**User Story:** As a developer, I want Chart.js to load before the statistics dashboard module, so that the `Chart` global is available when the module initialises.

#### Acceptance Criteria

1. THE Dashboard_Page front matter `scripts` array SHALL list `/assets/js/vendor/chart.umd.js` after `/assets/js/dashboard-data.js` and before `/assets/js/statistics-dashboard.js`
2. THE Dashboard_Page front matter `scripts` array SHALL continue to list `/assets/js/statistics-dashboard.js` before `/assets/js/freshness-dashboard.js` and `/assets/js/coverage-dashboard.js`
3. WHEN the Dashboard_Switcher reads the `PaddelbuchDashboardRegistry`, THE Statistics_Dashboard SHALL remain the first entry in the array

### Requirement 12: Existing Tests Compatibility

**User Story:** As a developer, I want all existing RSpec tests to continue passing after the refactoring, so that the refactoring does not break verified behaviour.

#### Acceptance Criteria

1. ALL existing property-based tests in `spec/plugins/statistics_metrics_generator_spec.rb` SHALL continue to pass without modification (Properties 1–7 test the Ruby generator, which is unchanged)
2. THE existing deactivation cleanup test (Property 8) SHALL continue to pass, verifying that `deactivate()` clears all four required DOM containers
3. THE existing module interface contract tests SHALL continue to pass, verifying `id: 'statistics'`, `usesMap: false`, `activate: function(context)`, `deactivate: function()`, `getName: function()`, `PaddelbuchDashboardRegistry`, and `PaddelbuchStatisticsDashboard`
4. THE existing script load order tests SHALL continue to pass, verifying `statistics-dashboard.js` is listed after `dashboard-data.js` and before `freshness-dashboard.js` and `coverage-dashboard.js`
5. IF any test requires updates due to new DOM structure (e.g. `<canvas>` elements instead of `<div>` bar segments), THE test SHALL be updated to verify the new structure while maintaining the same correctness property

### Requirement 13: CSP Configuration Unchanged

**User Story:** As a developer, I want the CSP configuration to remain unchanged, so that the refactoring proves the Chart.js approach works within the existing security policy.

#### Acceptance Criteria

1. THE `deploy/frontend-deploy.yaml` CSP header SHALL remain unchanged — no addition of `'unsafe-inline'` to `style-src` or `script-src`
2. THE Statistics_Dashboard SHALL render correctly under the existing CSP: `style-src 'self'; script-src 'self'`
3. WHEN the Dashboard_Page is loaded in a browser with CSP enforcement, THE browser console SHALL show zero CSP violation errors originating from the Statistics_Dashboard
