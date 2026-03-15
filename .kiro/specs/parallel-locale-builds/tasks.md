# Implementation Plan: Parallel Locale Builds

## Overview

Replace the sequential two-locale Jekyll build with parallel OS processes (one per locale), merging outputs into `_site/`. Implementation proceeds bottom-up: config files → Rakefile orchestrator → CI pipeline update → tests → documentation.

## Tasks

- [x] 1. Create per-locale config override files and update .gitignore
  - [x] 1.1 Create `_config_de.yml` with `languages: ["de"]` and `destination: _site_de`
    - Minimal YAML override for the German locale build
    - _Requirements: 1.1, 1.6_
  - [x] 1.2 Create `_config_en.yml` with `languages: ["en"]`, `destination: _site_en`, and `baseurl: "/en"`
    - Minimal YAML override for the English locale build
    - _Requirements: 1.2, 1.5, 1.6_
  - [x] 1.3 Create `_config_prefetch.yml` with `languages: ["de"]` and `destination: _site_prefetch`
    - Used only for the pre-fetch step to trigger ContentfulFetcher; output is discarded
    - _Requirements: 2.1_
  - [x] 1.4 Add `_site_de/`, `_site_en/`, and `_site_prefetch/` to `.gitignore`
    - Prevent temporary build directories from being committed
    - _Requirements: 4.5_

- [x] 2. Implement Build_Orchestrator in Rakefile
  - [x] 2.1 Implement `prefetch_and_validate!` helper method
    - Run `bundle exec jekyll build --config _config.yml,_config_prefetch.yml` synchronously
    - Verify exit status 0, abort with descriptive error on failure
    - Remove `_site_prefetch/` after successful pre-fetch
    - _Requirements: 2.1, 2.2, 2.4, 6.3_
  - [x] 2.2 Implement `run_parallel_builds!` helper method
    - Use `Process.spawn` to launch de and en builds concurrently
    - Pipe stdout/stderr with `[de]`/`[en]` locale-identifying prefixes
    - Use `Process.waitpid2` to collect exit statuses from both processes
    - Abort with descriptive error if either exits non-zero, preserving temp dirs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.1, 10.2, 10.3_
  - [x] 2.3 Implement `merge_outputs!` helper method
    - `rm_rf('_site')` then `mkdir_p('_site')`
    - `cp_r('_site_de/.', '_site')` for all de output (root pages, assets, api)
    - `cp_r('_site_en/en', '_site/en')` for only the en subtree
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 8.1_
  - [x] 2.4 Implement `cleanup_temp_dirs!` helper method
    - Remove `_site_de/`, `_site_en/`, `_site_prefetch/` only after successful merge
    - _Requirements: 4.5, 10.4_
  - [x] 2.5 Replace existing `build:site` task with the parallel build pipeline
    - Wire `prefetch_and_validate!`, `run_parallel_builds!`, `merge_outputs!`, `cleanup_temp_dirs!` in sequence
    - Report total wall-clock build time on completion
    - Preserve existing `serve` task and `audit` namespace tasks unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. Checkpoint — Verify orchestrator works locally
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update CI/CD pipeline
  - [x] 4.1 Update `amplify.yml` build phase to use `bundle exec rake build:site`
    - Replace `bundle exec jekyll build --verbose` with `bundle exec rake build:site`
    - Keep `npm test` after the build
    - Preserve preBuild phase, artifacts (`_site`), and cache paths unchanged
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 5. Add RSpec tests for the parallel build pipeline
  - [x] 5.1 Create `spec/plugins/parallel_build_spec.rb` with unit tests
    - Test config file content validation (languages, destination, baseurl keys)
    - Test merge logic with mock directory structures (de root + en/en subtree)
    - Test that excluded paths (assets/, api/) come only from de build
    - Test failure isolation: abort without modifying `_site/` when a build fails
    - Test temp directory preservation on failure and cleanup on success
    - Test that Rakefile preserves `serve` and `audit` tasks
    - Test `amplify.yml` content (build command, artifacts, cache paths, preBuild unchanged)
    - _Requirements: 1.1, 1.2, 1.5, 2.4, 3.3, 4.1–4.6, 6.3–6.5, 7.1–7.4, 8.1, 10.1–10.4_
  - [x] 5.2 Write property test: Config merge preserves non-overridden keys
    - **Property 1: Config merge preserves non-overridden keys**
    - For any key in `_config.yml` not overridden in a locale config, the merged value must equal the original
    - Use Rantly to generate arbitrary config key/value pairs and verify preservation
    - **Validates: Requirements 1.3, 1.4**
  - [x] 5.3 Write property test: Merge produces correct file set from both builds
    - **Property 2: Merge produces correct file set from both builds**
    - For any file tree in `_site_de/` and `_site_en/en/`, the merge must produce the correct union in `_site/`
    - No files from `_site_en/` outside `en/` should appear in `_site/`
    - Use Rantly to generate arbitrary file trees and verify merge correctness
    - **Validates: Requirements 4.2, 4.3, 4.4, 8.1**
  - [x] 5.4 Write property test: File permissions preserved during merge
    - **Property 4: File permissions preserved during merge**
    - For any file copied during merge, permissions in `_site/` must match the source
    - Use Rantly to generate files with random permission modes and verify preservation
    - **Validates: Requirements 4.6**
  - [x] 5.5 Write property test: Failure isolation preserves existing state
    - **Property 5: Failure isolation preserves existing state**
    - For any build step that exits non-zero, `_site/` must not be created or modified, and temp dirs must be preserved
    - Use Rantly to generate failure scenarios across different pipeline stages
    - **Validates: Requirements 3.3, 6.3, 10.1, 10.2, 10.3, 10.4**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update project documentation
  - [x] 7.1 Update README.md "Building for Production" section
    - Document `bundle exec rake build:site` as the primary production build command
    - Explain the parallel build pipeline (pre-fetch → parallel builds → merge)
    - List `_config_de.yml`, `_config_en.yml`, `_config_prefetch.yml` in the project structure
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property 3 (output equivalence) is an integration-level test requiring actual builds — validated manually or in CI, not as an automated RSpec test
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Ruby 3.4.9 via chruby; RSpec tests: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec`
