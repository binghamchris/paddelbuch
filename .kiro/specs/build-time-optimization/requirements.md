# Requirements Document

## Introduction

The Paddelbuch Jekyll site build on AWS Amplify currently takes over 13 minutes, with 95% of that time (681s) spent in Liquid template rendering across 2817 pages. Every detail page (spot, waterway, obstacle, notice) includes `detail-map-layers.html`, which nests `layer-control.html` and `filter-panel.html`. These includes contain Liquid loops that iterate over type data to build inline JavaScript configuration objects — repeated identically on every single page. This spec covers two optimizations: (1) extracting the repeated dimension config and layer label data into a shared JSON file loaded via `<script src="...">` instead of Liquid inlining, and (2) fixing a Bundler version mismatch that causes a reinstall on every build.

## Glossary

- **Build_System**: The Jekyll static site generator and its associated plugins, running within the AWS Amplify build environment
- **Detail_Page**: Any page rendered from the spot, waterway, obstacle, or notice layouts that includes the detail map layers pipeline
- **Detail_Map_Layers_Include**: The `_includes/detail-map-layers.html` file that bootstraps the map data pipeline on every Detail_Page
- **Layer_Control_Include**: The `_includes/layer-control.html` file that creates layer groups, popup functions, and marker creation functions
- **Filter_Panel_Include**: The `_includes/filter-panel.html` file that renders the Leaflet filter control UI
- **Dimension_Config**: The JavaScript array of filter dimension objects (spotType, paddleCraftType) with locale-specific labels and options, currently built inline via Liquid loops on every Detail_Page
- **Layer_Labels**: The JavaScript object containing locale-specific labels for non-spot layer toggles (noEntry, eventNotices, obstacles, protectedAreas), currently built inline via Liquid on every Detail_Page
- **Shared_Config_JSON**: A static JSON file generated once at build time containing the Dimension_Config and Layer_Labels data for both locales
- **API_Generator**: The `_plugins/api_generator.rb` Jekyll generator plugin that produces JSON API files during the build
- **Amplify_BuildSpec**: The build specification embedded in the AWS Amplify app configuration that defines preBuild, build, and postBuild commands
- **Bundler**: The Ruby dependency manager used to install gems during the preBuild phase

## Requirements

### Requirement 1: Generate Shared Map Configuration JSON File

**User Story:** As a site maintainer, I want the map dimension config and layer label data generated once into a shared JSON file at build time, so that Liquid does not re-evaluate the same loops on every detail page.

#### Acceptance Criteria

1. WHEN the Build_System runs the generation phase, THE Build_System SHALL produce a Shared_Config_JSON file containing the Dimension_Config options and Layer_Labels for both "de" and "en" locales
2. THE Shared_Config_JSON file SHALL include for each locale: spot type filter options (slug and localized label), paddle craft type filter options (slug and localized label), and layer toggle labels (noEntry, eventNotices, obstacles, protectedAreas)
3. THE Shared_Config_JSON file SHALL be written to a path under the site output that is accessible via a relative URL (e.g., `/assets/data/map-config.json` or `/api/map-config.json`)
4. WHEN the Shared_Config_JSON file is generated, THE Build_System SHALL read spot type data from `site.data.types.spot_types` and paddle craft type data from `site.data.types.paddle_craft_types` to populate the Dimension_Config options
5. THE Shared_Config_JSON file SHALL be generated exactly once per build, regardless of the number of locales or pages processed

### Requirement 2: Load Map Configuration from Shared JSON Instead of Liquid Inlining

**User Story:** As a site maintainer, I want detail pages to load the map configuration from the shared JSON file via a `<script>` tag or fetch call, so that per-page Liquid processing time is reduced.

#### Acceptance Criteria

1. THE Detail_Map_Layers_Include SHALL load the Dimension_Config and Layer_Labels from the Shared_Config_JSON file at runtime instead of building them inline via Liquid template loops
2. WHEN the Detail_Map_Layers_Include initializes, THE Detail_Map_Layers_Include SHALL select the correct locale-specific configuration from the Shared_Config_JSON based on the current page locale
3. THE Detail_Map_Layers_Include SHALL NOT contain Liquid `for` loops that iterate over `site.data.types.spot_types` or `site.data.types.paddle_craft_types` to build JavaScript objects
4. THE Detail_Map_Layers_Include SHALL NOT contain Liquid `if/else` blocks that switch on `current_locale` to produce hardcoded label strings for the Dimension_Config or Layer_Labels
5. WHEN the Shared_Config_JSON file is loaded successfully, THE Detail_Map_Layers_Include SHALL pass the loaded Dimension_Config array and Layer_Labels to `PaddelbuchFilterEngine.init()` and `PaddelbuchFilterPanel.init()` with the same data structure as the current Liquid-generated configuration

### Requirement 3: Preserve Layer Control Liquid Reduction

**User Story:** As a site maintainer, I want the layer-control include to also benefit from reduced Liquid processing where the protected area type name lookup is concerned.

#### Acceptance Criteria

1. THE Layer_Control_Include SHALL load protected area type name translations from the Shared_Config_JSON file or from a runtime-loaded data source instead of building the `protectedAreaTypeNames` JavaScript object via Liquid loops over `site.data.types.protected_area_types`
2. WHEN the Layer_Control_Include initializes, THE Layer_Control_Include SHALL have access to the same protected area type name lookup data as the current Liquid-generated implementation provides

### Requirement 4: Maintain Functional Equivalence of Built Site

**User Story:** As a site user, I want the site to look and behave identically after the optimization, so that the build speed improvement does not affect my experience.

#### Acceptance Criteria

1. THE Detail_Page map filter panel SHALL display the same spot type filter checkboxes with the same labels in both "de" and "en" locales as the current Liquid-generated implementation
2. THE Detail_Page map filter panel SHALL display the same paddle craft type filter checkboxes with the same labels in both "de" and "en" locales as the current Liquid-generated implementation
3. THE Detail_Page map layer toggles SHALL display the same labels for noEntry, eventNotices, obstacles, and protectedAreas in both "de" and "en" locales as the current Liquid-generated implementation
4. WHEN a user interacts with the filter panel checkboxes, THE filter engine SHALL filter spot markers using the same `matchFn` logic as the current implementation
5. THE Detail_Page map SHALL load and display all data layers (spots, obstacles, protected areas, event notices) with the same behavior as the current implementation
6. THE protected area popups SHALL display the same translated type names as the current Liquid-generated implementation

### Requirement 5: Fix Bundler Version Mismatch in Amplify Build

**User Story:** As a site maintainer, I want the Amplify build to install the correct Bundler version before running `bundle install`, so that the build does not waste time reinstalling Bundler on every run.

#### Acceptance Criteria

1. THE Amplify_BuildSpec preBuild phase SHALL install Bundler version 2.6.2 using `gem install bundler:2.6.2` before running `bundle install`
2. WHEN the preBuild phase runs, THE Build_System SHALL use Bundler 2.6.2 to install gems, matching the version specified in `Gemfile.lock`
3. THE Amplify_BuildSpec change SHALL be applied via the AWS CLI using the `paddelbuch-dev` profile and `eu-central-1` region, or via a CloudFormation template if infrastructure-as-code is preferred

### Requirement 6: Measurable Build Time Reduction

**User Story:** As a site maintainer, I want the combined optimizations to produce a measurable reduction in total build time, so that deployments complete faster.

#### Acceptance Criteria

1. WHEN the Build_System renders all Detail_Pages after the Liquid template simplification, THE Build_System SHALL spend less time in the render phase per page compared to the baseline of 200-300ms average per page
2. WHEN the preBuild phase runs with the correct Bundler version pre-installed, THE Build_System SHALL skip the Bundler version reinstallation step that currently occurs on every build
