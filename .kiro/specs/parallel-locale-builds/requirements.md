# Requirements Document

## Introduction

The paddelbuch Jekyll site currently builds two locales (de, en) sequentially within a single process via `jekyll-multiple-languages-plugin`. The plugin's `process` method iterates `languages.each`, mutating shared `Site` state for each locale. After the liquid-precomputation optimization, the current build timings are (from the CI build log):

- Contentful fetch: ~22s (runs once)
- de read+generate: ~22s, render: ~60s, write: ~0.2s
- en read+generate: ~5s, render: ~70s, write: ~0.1s
- Total build: ~157s

The render phases run sequentially (~60s + ~70s = ~130s). This feature introduces parallel locale builds: two independent Jekyll build processes run concurrently (one per locale), and their outputs are merged into a single `_site/` directory. With parallel execution, the render wall-clock time drops to approximately `max(de, en) ≈ 70s` instead of the sequential ~130s, saving roughly 60 seconds per build.

## Glossary

- **Build_Orchestrator**: The Rake task (or shell script) that coordinates the parallel build pipeline: pre-fetch, parallel Jekyll invocations, and output merging.
- **Locale_Config**: A per-locale YAML override file (`_config_de.yml` or `_config_en.yml`) that restricts the build to a single language and sets the appropriate destination directory.
- **Merge_Step**: The process of combining the two per-locale output directories into the final `_site/` directory.
- **ContentfulFetcher**: The Jekyll generator plugin (priority `:highest`) that fetches data from Contentful and writes YAML files to `_data/`.
- **Default_Locale**: The `de` locale, which builds pages at the site root (no URL prefix).
- **Non_Default_Locale**: The `en` locale, which builds pages under the `/en/` URL prefix.
- **Excluded_Paths**: Paths listed in `exclude_from_localizations` (`assets`, `api`) that are locale-independent and only need to be produced once.

## Requirements

### Requirement 1: Per-Locale Configuration Override Files

**User Story:** As a developer, I want per-locale config override files, so that each Jekyll process builds only one locale with the correct output directory.

#### Acceptance Criteria

1. THE Build_Orchestrator SHALL provide a `_config_de.yml` file that sets `languages: ["de"]` and `destination: _site_de`.
2. THE Build_Orchestrator SHALL provide a `_config_en.yml` file that sets `languages: ["en"]` and `destination: _site_en`.
3. WHEN Jekyll is invoked with `--config _config.yml,_config_de.yml`, THE Locale_Config SHALL override the `languages` and `destination` keys from `_config.yml` while preserving all other configuration.
4. WHEN Jekyll is invoked with `--config _config.yml,_config_en.yml`, THE Locale_Config SHALL override the `languages` and `destination` keys from `_config.yml` while preserving all other configuration.
5. THE Locale_Config for the Non_Default_Locale SHALL set `baseurl: "/en"` so that the `jekyll-multiple-languages-plugin` generates pages under the `/en/` prefix within its destination directory.
6. THE Locale_Config files SHALL be committed to version control alongside `_config.yml`.

### Requirement 2: Contentful Data Pre-Fetching

**User Story:** As a developer, I want Contentful data fetched once before both locale builds start, so that the API is called only once and both builds read the same data.

#### Acceptance Criteria

1. THE Build_Orchestrator SHALL invoke a data-fetch step that triggers the ContentfulFetcher before starting any parallel locale builds.
2. WHEN the data-fetch step completes, THE Build_Orchestrator SHALL have populated `_data/` with all YAML files from Contentful.
3. WHEN the parallel locale builds start, THE ContentfulFetcher in each build process SHALL detect that cached data is current and skip re-fetching from the Contentful API.
4. IF the data-fetch step fails, THEN THE Build_Orchestrator SHALL abort the build and report the error.

### Requirement 3: Parallel Build Execution

**User Story:** As a developer, I want both locale builds to run as separate OS processes in parallel, so that total wall-clock build time is approximately the duration of the slower locale.

#### Acceptance Criteria

1. THE Build_Orchestrator SHALL start the Default_Locale build (`bundle exec jekyll build --config _config.yml,_config_de.yml`) and the Non_Default_Locale build (`bundle exec jekyll build --config _config.yml,_config_en.yml`) concurrently as separate OS processes.
2. THE Build_Orchestrator SHALL wait for both build processes to complete before proceeding to the Merge_Step.
3. IF either build process exits with a non-zero status code, THEN THE Build_Orchestrator SHALL abort the pipeline and report which locale build failed.
4. WHILE both builds run in parallel, THE Build_Orchestrator SHALL stream or capture stdout/stderr from each process with a locale-identifying prefix so that log output is attributable.

### Requirement 4: Output Directory Merging

**User Story:** As a developer, I want the two per-locale output directories merged into a single `_site/`, so that the deployment artifact matches the current sequential build output.

#### Acceptance Criteria

1. THE Merge_Step SHALL create a clean `_site/` directory before merging.
2. THE Merge_Step SHALL copy all contents of `_site_de/` into `_site/`.
3. THE Merge_Step SHALL copy the `en/` subdirectory from `_site_en/` into `_site/en/`.
4. WHEN both the Default_Locale build and the Non_Default_Locale build produce files under an Excluded_Path (e.g., `assets/`, `api/`), THE Merge_Step SHALL use the copy from the Default_Locale build only.
5. THE Merge_Step SHALL remove the temporary `_site_de/` and `_site_en/` directories after a successful merge.
6. THE Merge_Step SHALL preserve file permissions and symlinks during the copy.

### Requirement 5: HTML Output Equivalence

**User Story:** As a developer, I want the parallel build to produce HTML output identical to the current sequential build, so that no regressions are introduced.

#### Acceptance Criteria

1. FOR ALL pages produced by the sequential build, THE parallel build SHALL produce a file at the same path with identical content.
2. FOR ALL pages produced by the parallel build, THE sequential build SHALL produce a file at the same path with identical content (no extra files).
3. FOR ALL valid locale and page combinations, building sequentially then comparing against the parallel build output SHALL produce zero differences in HTML content (round-trip equivalence).

### Requirement 6: Rakefile Build Task Update

**User Story:** As a developer, I want the `build:site` Rake task to use the parallel build approach, so that local builds benefit from the speedup.

#### Acceptance Criteria

1. THE `build:site` Rake task SHALL execute the data-fetch step, parallel locale builds, and Merge_Step in sequence.
2. THE `build:site` Rake task SHALL report total wall-clock build time upon completion.
3. IF any step in the `build:site` task fails, THEN THE Rake task SHALL abort with a descriptive error message and a non-zero exit code.
4. THE Rakefile SHALL preserve the existing `serve` task unchanged.
5. THE Rakefile SHALL preserve the existing `audit` namespace tasks unchanged.

### Requirement 7: CI/CD Pipeline Update

**User Story:** As a developer, I want the `amplify.yml` pipeline to use the parallel build approach, so that CI/CD builds are faster.

#### Acceptance Criteria

1. THE `amplify.yml` build phase SHALL execute the parallel locale build pipeline instead of the single `bundle exec jekyll build` command.
2. THE `amplify.yml` build phase SHALL produce the merged `_site/` directory as the artifact.
3. THE `amplify.yml` cache paths SHALL continue to include `_data/**/*` and `.jekyll-cache/**/*`.
4. THE `amplify.yml` preBuild phase SHALL remain unchanged (Ruby, Node.js, and dependency installation).

### Requirement 8: Excluded Path Handling

**User Story:** As a developer, I want locale-independent assets (`assets/`, `api/`) processed only once, so that no duplicate work is performed and no conflicts arise during merging.

#### Acceptance Criteria

1. WHEN the Non_Default_Locale build produces files under an Excluded_Path, THE Merge_Step SHALL discard those files in favor of the Default_Locale copy.
2. THE Locale_Config for the Non_Default_Locale SHALL set `exclude_from_localizations` identically to the main config so that the plugin skips localization of those paths.

### Requirement 9: Documentation Update

**User Story:** As a developer, I want the project documentation to reflect the new parallel build process, so that contributors understand how to build the site locally and in CI.

#### Acceptance Criteria

1. THE README.md "Building for Production" section SHALL document the parallel build command (e.g., the Rake task) as the primary production build method.
2. THE README.md SHALL document the per-locale config override files (`_config_de.yml`, `_config_en.yml`) in the project structure.
3. THE README.md SHALL explain that the build runs two parallel Jekyll processes and merges the output.

### Requirement 10: Build Failure Isolation

**User Story:** As a developer, I want a failure in one locale build to not corrupt the other locale's output, so that debugging is straightforward.

#### Acceptance Criteria

1. WHEN the Default_Locale build fails, THE Build_Orchestrator SHALL report the failure without modifying `_site/`.
2. WHEN the Non_Default_Locale build fails, THE Build_Orchestrator SHALL report the failure without modifying `_site/`.
3. IF either locale build fails, THEN THE Build_Orchestrator SHALL preserve the temporary output directories (`_site_de/`, `_site_en/`) for debugging.
4. THE Build_Orchestrator SHALL clean up temporary directories only after a fully successful build.
