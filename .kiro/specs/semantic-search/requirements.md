# Requirements Document

## Introduction

Semantic Search adds a free-text search box to the home-page map. A paddler types a natural-language query in German or English and the map narrows to the spots that match the query's meaning, not its literal spelling. Search is expressed as an additional filter dimension so it combines with the existing checkbox filter panel using AND logic: a spot is shown only when it matches the search AND every filter the user has selected.

The backend already exists as a separate service in the `paddelbuch-searchengine` repository: a REST API Gateway endpoint backed by a Lambda that embeds the query with Amazon Bedrock Titan Embeddings V2 and ranks a DynamoDB vector store by cosine similarity. This feature is the frontend consumer of that endpoint.

This supersedes the earlier `semantic-search` requirements on the abandoned `feat/semantic-search` branch, which specified a build-time S3 JSON index, an HTTP API, and a result dropdown that navigated to detail pages. None of those match what was built or what is wanted: the index lives in DynamoDB, the API is a REST API with an API key, and search must filter the map rather than act as a navigation autocomplete.

## Glossary

- **Search_Box**: The text input rendered at the top of the filter panel, plus its clear button and status region.
- **Search_Module**: The frontend module `assets/js/semantic-search.js`, registered as `window.PaddelbuchSemanticSearch`.
- **Search_API**: The `GET /search` endpoint in the `paddelbuch-searchengine` service.
- **Search_Dimension**: A filter dimension whose selection set is the slugs returned by the latest search, registered with the Filter_Engine under the key `search`.
- **Filter_Engine**: The existing `window.PaddelbuchFilterEngine`, which evaluates marker visibility across dimensions using AND logic.
- **Filter_Panel**: The existing collapsible Leaflet control containing the checkbox filter dimensions.
- **Marker_Registry**: The existing `window.PaddelbuchMarkerRegistry`, keyed by spot slug.
- **Result_Object**: One entry in the Search_API response array, containing at least `slug`, `location`, and `score`.
- **Inactive_Dimension**: A dimension whose selection set is empty, which the Filter_Engine skips rather than treating as "match nothing".
- **Locale**: One of `de` or `en`.

## Requirements

### Requirement 1: Search Box Presentation

**User Story:** As a paddler, I want a search box on the home-page map, so that I can find spots by describing them.

#### Acceptance Criteria

1. THE Search_Box SHALL render as its own Leaflet control, positioned immediately to the right of the Filter_Panel's toggle button, outside the collapsible filter panel, and SHALL be visible on page load without any interaction.
7. THE Search_Box SHALL NOT alter the layout, size, styling, or behaviour of the Filter_Panel or any other existing site element. `assets/js/filter-panel.js` and `_sass/components/_filter-panel.scss` SHALL remain byte-identical to their pre-feature state.
2. THE Search_Box SHALL render a placeholder and an accessible label in the current Locale.
3. THE Search_Box SHALL render a clear button that is hidden while the input is empty.
4. THE Search_Box SHALL render a status region that announces search outcomes to assistive technology.
5. WHEN the Search_API endpoint is not configured for the build, THE Search_Module SHALL render nothing and the Filter_Panel SHALL behave exactly as it did before this feature.
6. THE Search_Box SHALL use no inline `style` attributes and no inline scripts, because the site's Content Security Policy omits `unsafe-inline` for both `script-src` and `style-src`.

### Requirement 2: AND Combination With Existing Filters

**User Story:** As a paddler, I want my search to work together with the filter checkboxes, so that I can search within a filtered view.

#### Acceptance Criteria

1. THE Search_Dimension SHALL be registered with the Filter_Engine so that search participates in the existing AND evaluation.
2. WHEN a search is active, THE Filter_Engine SHALL show a marker only if the marker's slug is in the search result set AND the marker satisfies every active checkbox dimension.
3. WHEN the search input is cleared, THE Search_Dimension SHALL become an Inactive_Dimension and every marker that satisfies the checkbox dimensions SHALL be shown again.
4. WHEN a search returns zero results, THE Search_Dimension SHALL be treated as inactive rather than hiding every marker, consistent with the Filter_Engine's existing empty-selection semantics.
5. THE Search_Dimension SHALL NOT be rendered in the Filter_Panel as a checkbox fieldset, because it carries no options.
6. THE Search_Dimension SHALL match markers on spot slug, which requires `slug` to be present in the Marker_Registry metadata.

### Requirement 3: Query Handling

**User Story:** As a paddler, I want search to feel responsive and not fire a request on every keystroke.

#### Acceptance Criteria

1. WHEN the user types, THE Search_Module SHALL wait for a configurable debounce interval before issuing a request.
2. WHEN the trimmed query is shorter than a configurable minimum length, THE Search_Module SHALL issue no request and SHALL treat the Search_Dimension as inactive.
3. WHEN a new request is issued while a previous request is in flight, THE Search_Module SHALL abort the previous request.
4. WHEN a request is aborted, THE Search_Module SHALL NOT alter the Search_Dimension or the status region, so that the newer request's outcome is not overwritten.
5. WHEN the user presses Escape in the Search_Box, THE Search_Module SHALL clear the query and deactivate the Search_Dimension.
6. THE Search_Module SHALL send the current Locale with every request.
7. THE Search_Module SHALL send a result `limit` so that the response payload is bounded.

### Requirement 4: Map Behaviour

**User Story:** As a paddler, I want the map to move to my search results, so that matches outside my current view become visible.

#### Acceptance Criteria

1. WHEN a search returns at least one Result_Object with coordinates, THE Search_Module SHALL fit the map bounds to those coordinates.
2. THE fit SHALL respect a configurable maximum zoom so a single result does not zoom to maximum detail.
3. WHEN the map moves, the existing tile loader SHALL load the spots for the new viewport, and newly created markers SHALL be evaluated against the live filter state on creation.
4. WHEN a Result_Object has no usable coordinates, THE Search_Module SHALL still include its slug in the Search_Dimension selection.

Note on why R4.1 is necessary rather than cosmetic: the Marker_Registry only contains spots whose viewport tiles have been loaded. Without moving the map, a semantically matching spot elsewhere in the country has no marker to reveal.

### Requirement 5: Failure Handling

**User Story:** As a paddler, I want a failed search to be obvious and harmless, so that I am not shown a silently wrong map.

#### Acceptance Criteria

1. IF the Search_API returns a non-success status, THEN THE Search_Module SHALL show a localised error message in the status region.
2. IF the Search_API request fails or returns a non-success status, THEN THE Search_Module SHALL deactivate the Search_Dimension, so the map degrades to "no search applied" rather than retaining a stale result set.
3. IF the search configuration element is absent or is not valid JSON, THEN THE Search_Module SHALL render nothing rather than throwing.
4. IF a localised string is missing from the configuration, THEN THE Search_Module SHALL fall back to a built-in default, because the i18n plugin renders a missing key as an empty string.

### Requirement 6: Configuration

**User Story:** As a site maintainer, I want the endpoint and key supplied per environment, so that the same code deploys to any stage.

#### Acceptance Criteria

1. THE Search_API endpoint and API key SHALL be supplied to the build as environment variables and surfaced to the Search_Module through a `<script type="application/json">` configuration element.
2. THE configuration element SHALL be rendered only when the endpoint is configured.
3. AN empty-string endpoint SHALL be treated as unset, because CloudFormation supplies an empty string for an omitted parameter.
4. THE debounce interval, minimum query length, result limit, and score threshold SHALL be configurable without code changes.
5. THE site's Content Security Policy `connect-src` directive SHALL include the Search_API origin, otherwise the browser blocks every search request.
6. THE API key SHALL be treated as a public usage-plan identifier, not a secret. It is rendered into public HTML because the site is statically generated with no server-side rendering layer. Endpoint access control rests on the Search_API's Origin allow-list and WAF.

### Requirement 7: Conventions

**User Story:** As a maintainer, I want the new module to match the existing codebase, so that it is unsurprising to work on.

#### Acceptance Criteria

1. THE Search_Module SHALL follow the established IIFE-to-global pattern and ES5 syntax used by the other modules in `assets/js/`.
2. THE Search_Module SHALL provide a Dual_Export so tests can `require()` it.
3. THE Search_Module's localised strings SHALL come from `_i18n/de.yml` and `_i18n/en.yml`, which are held at key parity by the existing RSpec check.
4. ALL source files SHALL remain ASCII-clean where the existing compliance test requires it.
