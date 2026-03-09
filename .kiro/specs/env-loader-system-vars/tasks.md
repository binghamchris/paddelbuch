# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - System env vars ignored without .env files
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Use Rantly to generate random subsets of known keys (`MAPBOX_URL`, `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_ENVIRONMENT`, `SITE_URL`) with random string values as system env vars, with no `.env` files present
  - Create `spec/env_loader_spec.rb` with RSpec + Rantly property-based tests
  - Stub `File.exist?` to return `false` for all `.env` file paths so no files are loaded
  - Stub `ENV` to return generated values for the random subset of known keys
  - Create a minimal Jekyll `Site` double with a mutable `config` hash and `source` pointing to a temp dir
  - Invoke the `after_init` hook and assert that each stubbed known key appears in the site config:
    - `MAPBOX_URL` → `site.config['mapbox_url']`
    - `CONTENTFUL_SPACE_ID` → `site.config['contentful']['spaces'][0]['space']`
    - `CONTENTFUL_ACCESS_TOKEN` → `site.config['contentful']['spaces'][0]['access_token']`
    - `CONTENTFUL_ENVIRONMENT` → `site.config['contentful']['spaces'][0]['environment']`
    - `SITE_URL` → `site.config['url']`
  - Also test the partial file case: stub a `.env` file with only `CONTENTFUL_SPACE_ID`, set `MAPBOX_URL` in system env, assert `MAPBOX_URL` appears in site config (from Fault Condition: `system_known_keys.difference(file_known_keys).size > 0`)
  - Run test on UNFIXED code: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/env_loader_spec.rb`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because the override loop `env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] }` only iterates over file-loaded keys)
  - Document counterexamples found (e.g., "`env_vars` is empty after file loading, so system env vars are never checked")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - File-only and override behavior unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create preservation tests in the same `spec/env_loader_spec.rb` file
  - **Observe on UNFIXED code first**, then encode observations as properties:
  - Observe: When `.env` file contains all known keys and no system env vars are set → file values appear in site config
  - Observe: When `.env` file contains all known keys AND system env vars are set for the same keys → system env values win (override behavior)
  - Observe: When `.env` file contains extra non-known keys (e.g., `CUSTOM_VAR=foo`) → those keys are exported to `ENV` via `ENV[k] ||= v`
  - Use Rantly to generate random `.env` file contents for all 5 known keys with random string values, no system env vars → property: site config matches file values exactly
  - Use Rantly to generate random `.env` file contents AND matching system env vars for all known keys → property: site config uses system env values (priority ordering preserved)
  - Use Rantly to generate `.env` files with additional non-known keys → property: those keys are set in `ENV` after hook runs
  - Stub `File.exist?` to return `true` for `.env` path, stub `File.readlines` to return generated `.env` content
  - Run tests on UNFIXED code: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/env_loader_spec.rb`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for system env vars ignored when no .env files exist

  - [x] 3.1 Implement the fix in `_plugins/env_loader.rb`
    - Add `KNOWN_KEYS` frozen constant to the `Jekyll::EnvLoader` class: `KNOWN_KEYS = %w[MAPBOX_URL CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT SITE_URL].freeze`
    - Replace the existing override loop `env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] }` with a known-keys loop that checks system env directly:
      ```ruby
      Jekyll::EnvLoader::KNOWN_KEYS.each do |key|
        env_vars[key] = ENV[key] if ENV[key]
      end
      ```
    - After the known-keys loop, add a loop for non-known file-loaded keys to preserve system env override for custom keys:
      ```ruby
      env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] && !Jekyll::EnvLoader::KNOWN_KEYS.include?(k) }
      ```
    - Optionally update the log message to show source breakdown (e.g., file-loaded vs system-loaded count)
    - _Bug_Condition: isBugCondition(input) where system_known_keys present but not in env_file_keys_
    - _Expected_Behavior: All known keys with system env values are loaded into env_vars and mapped to site config_
    - _Preservation: File loading, priority ordering (system > .env.{JEKYLL_ENV} > .env), additional variable export unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - System env vars loaded without .env files
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (known system env vars appear in site config)
    - Run: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/env_loader_spec.rb`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - known keys are now checked against system env regardless of file presence)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - File-only and override behavior unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/env_loader_spec.rb`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - file loading, priority ordering, and additional variable export all unchanged)
    - Confirm all preservation property tests still pass after fix

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec`
  - Ensure all tests pass, ask the user if questions arise.
