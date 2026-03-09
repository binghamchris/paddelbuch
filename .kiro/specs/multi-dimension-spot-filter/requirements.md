# Requirements Document

## Introduction

The paddelbuch map currently filters spots only by spot type using Leaflet's built-in `L.control.layers` with separate `LayerGroup` instances per spot type. This feature replaces the existing Leaflet layer control with a new unified Filter_Panel that introduces multi-dimensional AND-based filtering so users can narrow visible spots by additional dimensions such as paddle craft type. The new Filter_Panel also absorbs the existing layer toggles for rejected spots, event notices, obstacles, and protected areas. The filtering system must be extensible to support future dimensions (e.g., paddling environment type) that share the same relational data structure. Rather than clearing and rebuilding layer groups, the implementation will show/hide existing markers in memory using Leaflet's `addTo(map)` / `remove()` API.

## Glossary

- **Filter_Engine**: The JavaScript module responsible for evaluating which spots pass all active filter dimensions and toggling marker visibility accordingly.
- **Filter_Dimension**: A named category of filter criteria (e.g., spot type, paddle craft type). Each dimension contains one or more selectable filter options.
- **Filter_State**: The data structure that tracks which options are currently selected within each Filter_Dimension.
- **Filter_Panel**: The custom UI control that replaces the existing Leaflet `L.control.layers`. It displays available Filter_Dimensions and their options for spot filtering, as well as independent toggles for non-spot layers (rejected spots, event notices, obstacles, protected areas).
- **Spot_Marker**: A Leaflet marker instance representing a single paddling spot on the map, stored in memory for the lifetime of the page.
- **Marker_Registry**: A data structure that associates each Spot_Marker with the spot's metadata (spotType_slug, paddleCraftTypes array) so the Filter_Engine can evaluate visibility without re-fetching data.
- **AND_Logic**: The filtering rule where a spot is visible only when the spot satisfies every active Filter_Dimension simultaneously.
- **Map**: The Leaflet map instance (`window.paddelbuchMap`).

## Requirements

### Requirement 1: Filter Engine Core

**User Story:** As a paddler, I want the map to filter spots across multiple dimensions simultaneously, so that I only see spots relevant to my specific needs.

#### Acceptance Criteria

1. WHEN a filter option is toggled in any Filter_Dimension, THE Filter_Engine SHALL re-evaluate visibility for every Spot_Marker in the Marker_Registry.
2. THE Filter_Engine SHALL apply AND_Logic across all active Filter_Dimensions: a Spot_Marker is visible only when the spot satisfies every Filter_Dimension that has at least one option selected.
3. WHEN a Spot_Marker passes all active Filter_Dimensions, THE Filter_Engine SHALL add the Spot_Marker to the Map using the Leaflet `addTo` method.
4. WHEN a Spot_Marker fails any active Filter_Dimension, THE Filter_Engine SHALL remove the Spot_Marker from the Map using the Leaflet `remove` method.
5. WHEN a Filter_Dimension has no options selected, THE Filter_Engine SHALL treat that dimension as inactive and exclude the dimension from the AND_Logic evaluation.
6. FOR ALL Spot_Markers in the Marker_Registry, THE Filter_Engine SHALL complete a full visibility re-evaluation within 100ms for up to 2000 markers.

### Requirement 2: Spot Type Filter Dimension

**User Story:** As a paddler, I want to filter spots by spot type on the map, so that I can focus on the types of spots I need (e.g., entry/exit points only).

#### Acceptance Criteria

1. THE Filter_Panel SHALL display a "Spot Type" Filter_Dimension with one checkbox for each spot type: einstieg-ausstieg, nur-einstieg, nur-ausstieg, rasthalte, notauswasserungsstelle.
2. THE Filter_Panel SHALL display localized descriptive labels for each spot type option using the same translation strings currently used in the existing Leaflet layer control (sourced from the site translations data, e.g., `site.data.translations.de.layers.entry_exit_spots`), matching the current site locale.
3. WHEN the page loads, THE Filter_Panel SHALL have all spot type options selected by default.
4. WHEN a spot type checkbox is toggled, THE Filter_Engine SHALL include or exclude spots of that type from the spot type dimension evaluation.
5. THE Filter_Engine SHALL match a spot against the spot type dimension by comparing the spot's `spotType_slug` field to the set of selected spot type slugs.

### Requirement 3: Paddle Craft Type Filter Dimension

**User Story:** As a paddler, I want to filter spots by paddle craft type, so that I only see spots usable by my type of watercraft.

#### Acceptance Criteria

1. THE Filter_Panel SHALL display a "Paddle Craft Type" Filter_Dimension with one checkbox for each paddle craft type: seekajak, kanadier, stand-up-paddle-board.
2. THE Filter_Panel SHALL display localized labels for each paddle craft type option using the names from the `paddle_craft_types.yml` data file, matching the current site locale.
3. WHEN the page loads, THE Filter_Panel SHALL have all paddle craft type options selected by default.
4. WHEN a paddle craft type checkbox is toggled, THE Filter_Engine SHALL include or exclude that craft type from the paddle craft type dimension evaluation.
5. THE Filter_Engine SHALL match a spot against the paddle craft type dimension by checking whether the spot's `paddleCraftTypes` array contains at least one of the selected paddle craft type slugs.

### Requirement 4: Marker Registry

**User Story:** As a developer, I want a central registry of all spot markers and their metadata, so that the filter engine can evaluate visibility without re-fetching tile data.

#### Acceptance Criteria

1. WHEN a new Spot_Marker is created from tile data, THE Marker_Registry SHALL store the Spot_Marker together with the spot's `spotType_slug` and `paddleCraftTypes` metadata.
2. THE Marker_Registry SHALL allow the Filter_Engine to iterate over all registered Spot_Markers and their associated metadata.
3. WHEN new tile data is loaded (on viewport pan or zoom), THE Marker_Registry SHALL accept additional Spot_Markers without duplicating entries for spots already registered (identified by slug).
4. THE Marker_Registry SHALL store metadata for every filterable field present in the tile JSON, including `spotType_slug`, `paddleCraftTypes`, and `paddlingEnvironmentType_slug`.

### Requirement 5: Filter Panel UI

**User Story:** As a paddler, I want a single, clear, and accessible filter panel on the map that replaces the old layer control, so that all map layer and spot filter options are in one place.

#### Acceptance Criteria

1. THE Filter_Panel SHALL replace the existing Leaflet `L.control.layers` entirely; the old layer control SHALL be removed from the Map.
2. THE Filter_Panel SHALL render as a collapsible control on the Map, positioned in the top-left corner.
3. THE Filter_Panel SHALL contain two sections: a spot filter section (with Filter_Dimension checkbox groups) and a layer toggle section (with independent toggles for non-spot layers).
4. THE Filter_Panel SHALL group spot filter checkboxes by Filter_Dimension, with each group labeled by the dimension name.
5. WHEN the user checks or unchecks a spot filter checkbox, THE Filter_Panel SHALL immediately update the Filter_State and trigger the Filter_Engine to re-evaluate marker visibility.
6. THE Filter_Panel SHALL use semantic HTML elements (fieldset, legend, label, input[type=checkbox]) for accessibility.
7. THE Filter_Panel SHALL be keyboard-navigable: each checkbox is focusable and togglable via keyboard.
8. WHEN the Map displays a popup, THE Filter_Panel SHALL collapse to avoid overlapping popup content.

### Requirement 6: Rejected Spot Handling

**User Story:** As a paddler, I want rejected spots to have their own toggle in the filter panel, so that I can choose to see or hide them independently of the spot type and craft type filters.

#### Acceptance Criteria

1. THE Filter_Engine SHALL exclude rejected spots (spots where `rejected` equals true) from multi-dimension filter evaluation.
2. THE Filter_Panel SHALL include a standalone toggle for rejected spots (noEntry layer) in the layer toggle section, using the same localized label as the previous Leaflet layer control.
3. WHEN the page loads, THE rejected spots toggle SHALL be unchecked by default, preserving the existing default behavior.
4. WHEN the user toggles the rejected spots checkbox, THE Filter_Panel SHALL add or remove the noEntry LayerGroup from the Map independently of the Filter_Engine.

### Requirement 7: Non-Spot Layer Toggles

**User Story:** As a paddler, I want event notices, obstacles, and protected areas to have their own toggles in the filter panel, so that I can control their visibility without affecting spot filtering.

#### Acceptance Criteria

1. THE Filter_Panel SHALL include standalone toggles in the layer toggle section for: event notices, obstacles, and protected areas, using the same localized labels as the previous Leaflet layer control.
2. WHEN the page loads, THE event notices, obstacles, and protected areas toggles SHALL be checked by default, preserving the existing default behavior.
3. WHEN the user toggles a non-spot layer checkbox, THE Filter_Panel SHALL add or remove the corresponding LayerGroup from the Map.
4. THE Filter_Engine SHALL NOT alter visibility of event notice markers, obstacle layers, or protected area layers; these SHALL be controlled exclusively by their standalone toggles.
5. THE existing zoom-based automatic show/hide behavior for obstacle and protected area layers (managed by the zoom layer manager) SHALL continue to function unchanged; the Filter_Panel toggles for these layers SHALL operate in conjunction with the zoom-based visibility rules.

### Requirement 8: Extensibility for Future Filter Dimensions

**User Story:** As a developer, I want to add new filter dimensions with minimal code changes, so that the filtering system scales as new metadata fields are added to spots.

#### Acceptance Criteria

1. THE Filter_Engine SHALL accept a configuration array where each entry defines a Filter_Dimension with a dimension key, a display label, the list of available options (slug and localized name), and a match function.
2. WHEN a new Filter_Dimension is added to the configuration array, THE Filter_Engine SHALL incorporate the new dimension into AND_Logic evaluation without changes to the core filtering algorithm.
3. THE Filter_Panel SHALL dynamically render checkbox groups based on the Filter_Dimension configuration array, requiring no hard-coded UI per dimension.

### Requirement 9: Integration with Existing Data Pipeline

**User Story:** As a developer, I want the filter system to integrate with the existing tile-based data loading pipeline, so that dynamically loaded spots are immediately subject to the active filters.

#### Acceptance Criteria

1. WHEN new spot data arrives from the data loader (initial load or viewport change), THE Marker_Registry SHALL register each new spot and its metadata before the spot's marker is added to the Map.
2. WHEN a new Spot_Marker is registered, THE Filter_Engine SHALL evaluate the current Filter_State against the new spot's metadata and show or hide the marker accordingly.
3. THE integration SHALL preserve the existing deduplication logic (slug-based) so that spots are not registered or rendered more than once.
