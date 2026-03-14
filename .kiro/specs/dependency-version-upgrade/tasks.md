# Implementation Plan: Dependency Version Upgrade

## Overview

Incrementally upgrade all runtime and development dependencies (Ruby, Node.js, gems, npm packages) and the AWS Amplify build pipeline, verifying site output integrity and test suite health after each step. The upgrade follows the sequence: baseline capture → Ruby → Node.js → gems → npm → pipeline → final verification.

## Tasks

- [x] 1. Capture pre-upgrade baseline
  - [x] 1.1 Record pre-upgrade test counts and build the baseline site
    - Run `bundle exec rspec` and record the total example count
    - Run `npm test` and record the total test count
    - Run `bundle exec jekyll build` and copy `_site/` to `_site_baseline/`
    - Store test counts in a `baseline-counts.txt` file at the project root for later comparison
    - _Requirements: 1.5, 7.5, 7.6_

- [x] 2. Upgrade Ruby version
  - [x] 2.1 Update `.ruby-version` to the latest stable Ruby release
    - Change the version string in `.ruby-version` (e.g. `ruby-3.4.x` → latest stable)
    - _Requirements: 2.1_
  - [x] 2.2 Update `amplify.yml` Ruby version references
    - Update the `rvm install` and `rvm use` commands in `amplify.yml` to match the new `.ruby-version`
    - _Requirements: 2.3, 8.1_
  - [x] 2.3 Write property test for Pipeline Version Consistency (Property 2)
    - **Property 2: Pipeline Version Consistency**
    - Generate random valid Ruby version strings, parse `.ruby-version` and `amplify.yml`, and assert that the `rvm install` and `rvm use` version strings match the `.ruby-version` value
    - Test file: `spec/plugins/pipeline_version_consistency_spec.rb` using RSpec + Rantly
    - **Validates: Requirements 2.3, 8.1**
  - [x] 2.4 Verify Ruby upgrade: rebuild site, diff against baseline, run test suites
    - Run `bundle install` with the new Ruby
    - Run `bundle exec jekyll build` and diff `_site/` against `_site_baseline/`
    - Run `bundle exec rspec` — all tests must pass
    - Run `npm test` — all tests must pass
    - Fix any differences or failures before proceeding
    - _Requirements: 1.5, 2.4_

- [x] 3. Checkpoint — Verify Ruby upgrade
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Upgrade Node.js version
  - [x] 4.1 Update `amplify.yml` Node.js version
    - Change the `nvm install` command from `18` to the latest LTS major version (e.g. `22`)
    - _Requirements: 3.1, 8.2_
  - [x] 4.2 Verify Node.js upgrade: rebuild site, diff against baseline, run test suites
    - Run `npm ci` to reinstall packages under the new Node.js
    - Run `npm run copy-assets` and `npm run download-fonts`
    - Run `bundle exec jekyll build` and diff `_site/` against `_site_baseline/`
    - Run `bundle exec rspec` — all tests must pass
    - Run `npm test` — all tests must pass
    - Fix any differences or failures before proceeding
    - _Requirements: 1.5, 3.2, 3.3_

- [x] 5. Checkpoint — Verify Node.js upgrade
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Upgrade Ruby gem dependencies
  - [x] 6.1 Update `Gemfile` version constraints to permit latest stable releases
    - Update pessimistic version constraints (`~>`) for: jekyll, contentful, dotenv, jekyll-multiple-languages-plugin, jekyll-sass-converter, webrick, bundler-audit, rspec, rantly
    - _Requirements: 4.1_
  - [x] 6.2 Run `bundle update` to regenerate `Gemfile.lock`
    - Resolve any dependency conflicts by adjusting constraints or upgrading incrementally
    - _Requirements: 4.2_
  - [x] 6.3 Fix any plugin compatibility issues caused by gem upgrades
    - Check all 17 plugins in `_plugins/` for deprecation warnings or API breakage
    - Update plugin code if any gem introduces breaking API changes (Jekyll, Liquid, Contentful, Dotenv, Sass)
    - _Requirements: 4.5, 6.1, 6.2_
  - [x] 6.4 Verify gem upgrade: rebuild site, diff against baseline, run test suites
    - Run `bundle exec jekyll build` and diff `_site/` against `_site_baseline/`
    - Run `bundle exec rspec` — all tests must pass
    - Run `npm test` — all tests must pass
    - Fix any differences or failures before proceeding
    - _Requirements: 1.5, 4.3, 4.4_

- [x] 7. Checkpoint — Verify gem upgrades
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Upgrade npm dependencies
  - [x] 8.1 Update `package.json` dependency versions
    - Update `dependencies`: bootstrap, leaflet, leaflet.locatecontrol to latest stable
    - Update `devDependencies`: jest, jest-environment-jsdom, @types/jest, fast-check to latest stable
    - Resolve the jest (29.x) / jest-environment-jsdom (30.x) version mismatch
    - _Requirements: 5.1_
  - [x] 8.2 Run `npm install` to regenerate `package-lock.json`
    - Resolve any peer dependency conflicts
    - _Requirements: 5.2_
  - [x] 8.3 Verify `scripts/copy-vendor-assets.js` works with new package versions
    - Run `npm run copy-assets` and confirm Bootstrap/Leaflet files are copied correctly to `assets/`
    - If package directory structures changed, update the copy script paths
    - _Requirements: 5.4_
  - [x] 8.4 Update `jest.config.js` if Jest API changes require it
    - Check for any deprecated config options in the new Jest version
    - Update test environment configuration if jest-environment-jsdom API changed
    - _Requirements: 7.3, 7.4_
  - [x] 8.5 Fix any test failures caused by npm package upgrades
    - Update test files in `_tests/` if assertion syntax or framework API changed
    - Ensure all property tests in `_tests/property/` still work with new fast-check version
    - _Requirements: 5.3, 7.2, 7.3_
  - [x] 8.6 Verify npm upgrade: rebuild site, diff against baseline, run test suites
    - Run `bundle exec jekyll build` and diff `_site/` against `_site_baseline/`
    - Run `bundle exec rspec` — all tests must pass
    - Run `npm test` — all tests must pass
    - Fix any differences or failures before proceeding
    - _Requirements: 1.5, 5.3_

- [x] 9. Checkpoint — Verify npm upgrades
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Final verification and test count preservation
  - [x] 10.1 Run full build pipeline sequence locally
    - Execute the full amplify.yml sequence locally: `npm ci`, `npm run download-fonts`, `npm run copy-assets`, `bundle install`, `bundle exec jekyll build`, `npm test`
    - Confirm `_site/` matches `_site_baseline/` with no differences
    - _Requirements: 1.5, 8.3, 8.4_
  - [x] 10.2 Verify test count preservation (Property 3)
    - Run `bundle exec rspec` and compare example count against baseline count from step 1.1
    - Run `npm test` and compare test count against baseline count from step 1.1
    - Assert post-upgrade counts >= pre-upgrade counts
    - **Property 3: Test Count Preservation**
    - **Validates: Requirements 7.5, 7.6**
  - [~] 10.3 Clean up baseline artifacts
    - Remove `_site_baseline/` directory
    - Remove `baseline-counts.txt`
    - _Requirements: N/A (housekeeping)_

- [~] 11. Final checkpoint — All upgrades complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each upgrade step includes a diff-against-baseline verification to catch regressions early
- The upgrade order (Ruby → Node.js → gems → npm) ensures runtimes are upgraded before their package ecosystems
- Property 1 (Build Output Invariance) is verified by the baseline diff process at each step rather than a standalone property test
- Property 2 (Pipeline Version Consistency) has a dedicated property-based test in task 2.3
- Property 3 (Test Count Preservation) is verified by count comparison in task 10.2
- Checkpoints are placed after each major upgrade step for incremental validation
