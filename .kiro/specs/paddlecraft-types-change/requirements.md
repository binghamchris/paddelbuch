# Requirements Document

## Introduction

Paddelbuch currently models three paddle craft types — `seekajak`, `kanadier`, and
`stand-up-paddle-board` — which appear in the map filter panel and on each spot detail page,
and which spots reference through the Contentful `paddleCraftType` field. Two replacement
paddle craft types already exist in Contentful:

- `klappbar-und-aufblasbar` ("foldable and inflatable")
- `hardshell`

Each new Contentful entry carries an English name, an English description, a German name, and a
German description.

This feature replaces the three existing paddle craft types with the two new types across the
Paddelbuch frontend and performs a one-time migration of existing spot references in Contentful.
The work covers three areas:

1. **Filter UI** — the "Paddle Craft Type" filter section (`assets/js/filter-panel.js`, configured
   in `_plugins/precompute_generator.rb`, embedded via `_includes/filter-panel.html`) must list the
   two new types with their icons and localised names, behaving exactly like the current filters.
2. **Spot Details Page** — the paddle-craft-type row in the `spot-details-table`
   (`_includes/spot-detail-content.html`, `_includes/craft-icon.html`) is replaced by a new
   side-by-side icon-and-name display rendered directly above the table, indicating for each of the
   two new types whether it is linked to the spot.
3. **One-Time Contentful Update** — a run-once, automated process that adds the new type references
   to existing spots based on their current references, without removing the existing references.

The existing paddle craft type definitions are **not** deleted from Contentful by this feature; only
the frontend presentation is replaced, and the migration is additive.

## Glossary

- **Paddelbuch**: The Jekyll static site that renders the Swiss paddle map from Contentful-sourced data.
- **Paddle_Craft_Type**: A category of paddle craft, identified by a unique slug, that a Spot may be
  usable by. Referenced by Spots through the Contentful `paddleCraftType` field, surfaced in build
  data as the `paddleCraftTypes` slug array.
- **New_Craft_Type**: One of the two replacement Paddle_Craft_Types, identified by slug
  `klappbar-und-aufblasbar` or `hardshell`.
- **Legacy_Craft_Type**: One of the three existing Paddle_Craft_Types, identified by slug `seekajak`,
  `kanadier`, or `stand-up-paddle-board`.
- **Spot**: A paddle sports access point with fields including `slug`, `locale`, and a
  `paddleCraftTypes` slug array.
- **Filter_Panel**: The Leaflet map control implemented in `assets/js/filter-panel.js` that renders
  filter dimensions, including the paddle craft type dimension.
- **Filter_Engine**: The client-side module (`assets/js/filter-engine.js`) that evaluates whether a
  Spot marker is shown given the current filter selections.
- **Dimension_Config_Generator**: The build-time logic in `_plugins/precompute_generator.rb` that
  produces the paddle craft type dimension configuration (`map_data_config_json`) consumed by the
  Filter_Panel.
- **Craft_Icon_Include**: The Liquid partial `_includes/craft-icon.html` that maps a
  Paddle_Craft_Type slug to an SVG icon.
- **Spot_Detail_Content**: The Liquid partial `_includes/spot-detail-content.html` that renders a
  non-rejected Spot's detail page content.
- **Craft_Type_Display**: The new side-by-side icon-and-name element rendered directly above the
  `spot-details-table` element on the Spot detail page.
- **Contentful_Migration_Process**: The run-once automated process that adds New_Craft_Type
  references to existing Spots in Contentful.
- **Statistics_Dashboard**: The client-side dashboard module implemented in
  `assets/js/statistics-dashboard.js`, driven by build-time metrics from
  `_plugins/statistics_metrics_generator.rb`, that renders per-Paddle_Craft_Type figures. Each
  figure's icon is resolved through a hardcoded slug-to-icon map (`PADDLE_CRAFT_ICONS`).
- **Colour_File**: The Sass settings file `_sass/settings/_paddelbuch_colours.scss` defining named
  colour variables, including `$green-1` (`#07753f`) and `$danger-red` (`#c40200`).
- **Feature_Branch**: The Git branch `feat/paddlecraft-types-change`, the only branch on which this
  feature's changes are made.

## Requirements

### Requirement 1: Filter Panel Lists the Two New Craft Types

**User Story:** As a Paddelbuch map user, I want the paddle craft type filter to list the two new
craft types, so that I can filter spots by the craft types the site now supports.

#### Acceptance Criteria

1. THE Dimension_Config_Generator SHALL include exactly two options in the paddle craft type filter
   dimension, ordered with the option for slug `klappbar-und-aufblasbar` first and the option for
   slug `hardshell` second.
2. THE Dimension_Config_Generator SHALL exclude the Legacy_Craft_Type slugs `seekajak`, `kanadier`,
   and `stand-up-paddle-board` from the paddle craft type filter dimension options.
3. WHERE the build locale is English, THE Dimension_Config_Generator SHALL set each paddle craft
   type filter option label to the corresponding New_Craft_Type English name from the Contentful
   paddle craft type data.
4. WHERE the build locale is German, THE Dimension_Config_Generator SHALL set each paddle craft type
   filter option label to the corresponding New_Craft_Type German name from the Contentful paddle
   craft type data.
5. THE Dimension_Config_Generator SHALL assign the icon `/assets/images/icons/foldables-dark.svg` to
   the `klappbar-und-aufblasbar` filter option and the icon `/assets/images/icons/hardshell-dark.svg`
   to the `hardshell` filter option.
6. THE Filter_Panel SHALL render exactly one checkbox-labelled control per paddle craft type filter
   option, in the same order as the dimension options, each control displaying its option's assigned
   icon and localised label.
7. IF the corresponding New_Craft_Type name for the build locale is empty or absent in the Contentful
   paddle craft type data, THEN THE Dimension_Config_Generator SHALL set that filter option's label
   to the New_Craft_Type slug.

### Requirement 2: Filter Behaviour Matches Existing Filters

**User Story:** As a Paddelbuch map user, I want the new craft type filters to behave like the
existing filters, so that the map interaction remains consistent and predictable.

#### Acceptance Criteria

1. WHEN the Filter_Panel first renders, THE Filter_Panel SHALL display both paddle craft type filter
   options in the selected (checked) state.
2. WHILE all paddle craft type filter options are selected, THE Filter_Engine SHALL treat the
   paddle craft type dimension as imposing no restriction on which Spots are shown (the default
   state).
3. WHEN a strict subset of the paddle craft type filter options is selected, THE Filter_Engine SHALL
   treat the paddle craft type dimension as satisfied by a Spot only when the Spot's
   `paddleCraftTypes` array contains at least one of the currently selected paddle craft type slugs.
4. WHEN no paddle craft type filter options are selected, THE Filter_Engine SHALL treat the paddle
   craft type dimension as imposing no restriction on which Spots are shown (equivalent to the
   default state).
5. WHEN a user re-selects a previously unselected paddle craft type filter option, THE Filter_Engine
   SHALL treat a Spot whose `paddleCraftTypes` array contains that option's slug as satisfying the
   paddle craft type dimension.
6. THE Filter_Engine SHALL show a Spot only when the Spot satisfies the paddle craft type dimension
   and every other active filter dimension (set intersection across all filter dimensions).

### Requirement 3: Craft Icon Mapping for the New Craft Types

**User Story:** As a Paddelbuch developer, I want the craft icon include to resolve icons for the
two new craft type slugs, so that the correct SVG icon is shown wherever craft icons are rendered.

#### Acceptance Criteria

1. WHEN the Craft_Icon_Include receives slug `klappbar-und-aufblasbar`, THE Craft_Icon_Include SHALL
   render the icon at `/assets/images/icons/foldables-dark.svg`.
2. WHEN the Craft_Icon_Include receives slug `hardshell`, THE Craft_Icon_Include SHALL render the
   icon at `/assets/images/icons/hardshell-dark.svg`.
3. WHEN the Craft_Icon_Include receives a slug that maps to no known icon, THE Craft_Icon_Include
   SHALL render no icon element.

### Requirement 4: Spot Detail Craft Type Display Placement

**User Story:** As a Paddelbuch user viewing a spot, I want to see the supported craft types in a
clear side-by-side display above the details table, so that I can quickly see which craft types the
spot supports.

#### Acceptance Criteria

1. THE Spot_Detail_Content SHALL render the Craft_Type_Display directly above the `spot-details-table`
   element on a non-rejected Spot's detail page.
2. THE Craft_Type_Display SHALL present exactly two entries side by side, one for
   `klappbar-und-aufblasbar` and one for `hardshell`.
3. THE Craft_Type_Display SHALL show, for each of the two entries, that New_Craft_Type's icon and its
   localised name.
4. WHERE the page locale is English, THE Craft_Type_Display SHALL show each New_Craft_Type's English
   name; WHERE the page locale is German, THE Craft_Type_Display SHALL show each New_Craft_Type's
   German name.
5. IF the New_Craft_Type localised name for the page locale is empty or absent in the Contentful
   paddle craft type data, THEN THE Craft_Type_Display SHALL show that New_Craft_Type's slug in place
   of the name.
6. THE Spot_Detail_Content SHALL omit the former paddle-craft-type row (the `craft-type-*` cells and
   the `craft-type-list`) from the `spot-details-table` element.
7. THE Craft_Type_Display SHALL render a localised section title above the two craft type entries,
   sourced from the i18n key `labels.accessible_to` (English "Accessible to:", German "Zugänglich für:").

### Requirement 5: Spot Detail Linked and Unlinked Craft Type States

**User Story:** As a Paddelbuch user viewing a spot, I want a clear visual distinction between craft
types the spot supports and those it does not, so that I can tell at a glance which craft types are
usable at the spot.

#### Acceptance Criteria

1. WHEN a Spot's `paddleCraftTypes` array contains a New_Craft_Type's slug, THE Craft_Type_Display
   SHALL render that New_Craft_Type's icon in its original (non-greyed) colour.
2. WHEN a Spot's `paddleCraftTypes` array contains a New_Craft_Type's slug, THE Craft_Type_Display
   SHALL render a tick indicator for that New_Craft_Type in the `$green-1` colour from the Colour_File.
3. IF a Spot's `paddleCraftTypes` array does not contain a New_Craft_Type's slug, THEN THE
   Craft_Type_Display SHALL render that New_Craft_Type's icon in a greyed-out appearance.
4. IF a Spot's `paddleCraftTypes` array does not contain a New_Craft_Type's slug, THEN THE
   Craft_Type_Display SHALL render a cross indicator for that New_Craft_Type in the `$danger-red`
   colour from the Colour_File.
5. THE Craft_Type_Display SHALL determine the linked state of each New_Craft_Type independently, so
   that one New_Craft_Type may show the linked state while the other shows the unlinked state on the
   same Spot.
6. THE Craft_Type_Display SHALL arrange each entry vertically with the localised New_Craft_Type name
   at the top, the New_Craft_Type icon in the middle, and the tick or cross indicator at the bottom.

### Requirement 6: One-Time Contentful Migration of Spot References

**User Story:** As a Paddelbuch maintainer, I want a run-once process that adds the new craft type
references to existing spots, so that spots carry the new craft types without losing their existing
references.

#### Acceptance Criteria

1. THE Contentful_Migration_Process SHALL run as an automated, single-execution process that requires
   no per-spot manual editing.
2. WHEN a Spot's paddle craft type references include `kanadier` or `seekajak`, THE
   Contentful_Migration_Process SHALL add a reference to `hardshell` to that Spot.
3. WHEN a Spot's paddle craft type references include `stand-up-paddle-board`, THE
   Contentful_Migration_Process SHALL add a reference to `klappbar-und-aufblasbar` to that Spot.
4. THE Contentful_Migration_Process SHALL retain all existing paddle craft type references on every
   Spot that it updates.
5. IF a Spot has no paddle craft type reference matching any migration rule (no `kanadier`,
   `seekajak`, or `stand-up-paddle-board` reference), THEN THE Contentful_Migration_Process SHALL
   leave that Spot's paddle craft type references unchanged.
6. IF a Spot already references the New_Craft_Type that would be added, THEN THE
   Contentful_Migration_Process SHALL leave that Spot's paddle craft type references unchanged for
   that New_Craft_Type (no duplicate reference is added).
7. WHEN the Contentful_Migration_Process is executed a second time after a successful first run, THE
   Contentful_Migration_Process SHALL produce the same set of paddle craft type references on every
   Spot as after the first run (idempotent result).
8. WHEN the Contentful_Migration_Process updates a Spot, THE Contentful_Migration_Process SHALL
   publish the updated Spot entry.
9. WHERE the Contentful_Migration_Process is invoked in dry-run mode, THE Contentful_Migration_Process
   SHALL report the intended changes and SHALL make no writes to Contentful.

### Requirement 7: Feature Branch Constraint

**User Story:** As a Paddelbuch maintainer, I want all work for this feature confined to a single
branch, so that the change set is isolated and reviewable.

#### Acceptance Criteria

1. THE feature implementation SHALL make all repository changes on the Feature_Branch
   `feat/paddlecraft-types-change`.

### Requirement 8: Statistics Dashboard Displays New Craft Type Icons

**User Story:** As a Paddelbuch user viewing the statistics dashboard, I want the new paddle craft
types to display with their icons, so that the dashboard remains visually consistent after the craft
type change.

Because the one-time migration adds the New_Craft_Type slugs to Spots (and the Legacy_Craft_Type
Contentful entries are not deleted), the Statistics_Dashboard may render figures for both
New_Craft_Type slugs and any remaining Legacy_Craft_Type slugs. The Statistics_Dashboard resolves
each figure's icon through its `PADDLE_CRAFT_ICONS` slug-to-icon map, which must cover the new slugs.

#### Acceptance Criteria

1. WHEN the Statistics_Dashboard renders a per-paddle-craft-type figure for the slug
   `klappbar-und-aufblasbar`, THE Statistics_Dashboard SHALL render that figure's icon as the image
   at `/assets/images/icons/foldables-dark.svg`.
2. WHEN the Statistics_Dashboard renders a per-paddle-craft-type figure for the slug `hardshell`,
   THE Statistics_Dashboard SHALL render that figure's icon as the image at
   `/assets/images/icons/hardshell-dark.svg`.
3. WHERE a rendered paddle craft type slug has no entry in the Statistics_Dashboard's slug-to-icon
   map (`PADDLE_CRAFT_ICONS`), THE Statistics_Dashboard SHALL render that figure with no icon image
   element while still rendering the figure's count value and label.
4. IF a rendered paddle craft type slug has no entry in the Statistics_Dashboard's slug-to-icon map,
   THEN THE Statistics_Dashboard SHALL complete rendering the paddle craft type figures section
   without raising an error.
