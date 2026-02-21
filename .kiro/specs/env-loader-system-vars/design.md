# Env Loader System Vars Bugfix Design

## Overview

The `env_loader.rb` Jekyll plugin has a bug where system environment variables are silently ignored when no `.env` file exists in the build environment. The system env override loop (`env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] }`) only iterates over keys already loaded from files — so when no file is found, the hash is empty and the loop is a no-op. This causes builds on CI/CD platforms (e.g. AWS Amplify) to fall back to `_config.yml` defaults instead of using the system-provided values.

The fix adds an explicit check of known environment variable keys against the system environment, independent of whether any `.env` files were loaded.

## Glossary

- **Bug_Condition (C)**: System environment variables are set for known keys, but no `.env` file (or only a partial one) exists — causing those system vars to be ignored
- **Property (P)**: Known system environment variables are always loaded into site config regardless of `.env` file presence
- **Preservation**: Existing file-loading behavior, priority ordering, and additional variable export must remain unchanged
- **env_vars**: The `Hash` in `_plugins/env_loader.rb` that accumulates environment variables from files and system env before mapping to site config
- **Known Keys**: The five environment variable names the plugin maps to site config: `MAPBOX_URL`, `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_ENVIRONMENT`, `SITE_URL`
- **EnvLoader.load_env_file**: Class method in `_plugins/env_loader.rb` that parses a `.env` file into a key-value hash

## Bug Details

### Fault Condition

The bug manifests when system environment variables are set for known keys but no `.env` or `.env.{JEKYLL_ENV}` file exists (or the files don't contain all known keys). The `after_init` hook's override loop iterates only over keys already in `env_vars`, so system-only keys are never picked up.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { system_env: Hash, env_file_keys: Set }
  OUTPUT: boolean

  known_keys := ['MAPBOX_URL', 'CONTENTFUL_SPACE_ID', 'CONTENTFUL_ACCESS_TOKEN',
                  'CONTENTFUL_ENVIRONMENT', 'SITE_URL']

  system_known_keys := known_keys.select { |k| system_env[k] != nil }
  file_known_keys   := env_file_keys.intersection(known_keys)

  RETURN system_known_keys.size > 0
         AND system_known_keys.difference(file_known_keys).size > 0
END FUNCTION
```

### Examples

- **No files at all**: `MAPBOX_URL=https://tiles.example.com` is set in the system env, no `.env` or `.env.production` exists → `site.mapbox_url` is `nil` (should be `https://tiles.example.com`)
- **Partial .env file**: `.env` contains `CONTENTFUL_SPACE_ID=abc123` only, system env has `MAPBOX_URL=https://tiles.example.com` → `site.mapbox_url` is `nil` (should be `https://tiles.example.com`), `site.contentful.spaces[0].space` is `abc123` (correct)
- **All keys in file + system override**: `.env` has `MAPBOX_URL=old`, system env has `MAPBOX_URL=new` → `site.mapbox_url` is `new` (correct — this case already works)
- **No system env, no files**: No env vars set anywhere → all config keys remain at `_config.yml` defaults (correct — not a bug condition)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Loading variables from `.env` and `.env.{JEKYLL_ENV}` files must continue to work when those files exist
- System environment variables must continue to override file-loaded values for the same key
- Additional (non-known) variables in `.env` files must continue to be loaded and exported to `ENV`
- The priority order (system env > `.env.{JEKYLL_ENV}` > `.env`) must remain intact
- The mapping of env vars to site config keys (`MAPBOX_URL` → `site.mapbox_url`, etc.) must remain unchanged
- The `ENV[k] ||= v` export at the end of the hook must continue to work for all loaded vars

**Scope:**
All inputs where system environment variables are NOT set for any known key missing from files should be completely unaffected by this fix. This includes:
- Builds with complete `.env` files and no system env vars
- Builds with complete `.env` files and matching system env overrides
- Builds with `.env` files containing extra non-known keys
- Builds with no `.env` files and no system env vars

## Hypothesized Root Cause

Based on the bug description, the root cause is clear and singular:

1. **Override loop iterates only over file-loaded keys**: The line `env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] }` only checks system env for keys that already exist in `env_vars`. When no `.env` file is present, `env_vars` is empty, so the loop body never executes. This means system env vars for known keys are never loaded.

2. **No fallback mechanism for known keys**: The plugin has no explicit list of known keys to check against the system environment. It relies entirely on file-loaded keys as the "registry" of what to look up — a design that assumes files always exist.

## Correctness Properties

Property 1: Fault Condition - System env vars loaded without .env files

_For any_ input where system environment variables are set for known keys and those keys are NOT present in any loaded `.env` file (isBugCondition returns true), the fixed `after_init` hook SHALL load those system environment variables into `env_vars` and map them to the corresponding site config keys.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - File-only and override behavior unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false) — i.e., all known keys with system env vars are already present in `.env` files, or no system env vars are set — the fixed code SHALL produce the same `env_vars` hash and site config as the original code, preserving file loading, priority ordering, and additional variable export.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `_plugins/env_loader.rb`

**Function**: `Jekyll::Hooks.register :site, :after_init` block

**Specific Changes**:

1. **Add known keys constant**: Define `KNOWN_KEYS` as a frozen array of the five known environment variable names at the module or class level for clarity and reuse.

2. **Replace override loop with known-keys loop**: Replace the existing `env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] }` line with a loop over `KNOWN_KEYS` that checks the system environment for each key, regardless of whether it was loaded from a file:
   ```ruby
   KNOWN_KEYS.each do |key|
     env_vars[key] = ENV[key] if ENV[key]
   end
   ```

3. **Preserve the existing override for non-known keys**: After the known-keys loop, keep the original override pattern for any additional keys that were loaded from files but aren't in the known set:
   ```ruby
   env_vars.each { |k, v| env_vars[k] = ENV[k] if ENV[k] && !KNOWN_KEYS.include?(k) }
   ```
   This ensures that if a `.env` file contains custom keys that also happen to be set in the system env, they still get overridden.

4. **Update log message**: Optionally update the log message to distinguish between file-loaded and system-loaded vars for better debugging.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior. All tests use RSpec with Rantly for property-based testing, matching the project's existing test infrastructure.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the root cause is the override loop iterating only over file-loaded keys.

**Test Plan**: Write RSpec tests that stub `ENV` with known keys, ensure no `.env` files exist (stub `File.exist?` to return false), invoke the `after_init` hook, and assert that system env vars appear in site config. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **No files, all system vars set**: Stub all 5 known keys in ENV, no `.env` files → assert all 5 appear in site config (will fail on unfixed code)
2. **No files, single system var set**: Stub only `MAPBOX_URL` in ENV, no `.env` files → assert `site.mapbox_url` is set (will fail on unfixed code)
3. **Partial file, system var for missing key**: `.env` has `CONTENTFUL_SPACE_ID`, system has `MAPBOX_URL` → assert both appear in site config (will fail on unfixed code for `MAPBOX_URL`)

**Expected Counterexamples**:
- `env_vars` hash is empty after file loading, so the override loop never executes
- `site.mapbox_url` remains `nil` despite `MAPBOX_URL` being set in system env

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed hook produces the expected site config.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := run_after_init_hook_fixed(input.system_env, input.env_files)
  ASSERT expectedBehavior(result.site_config, input.system_env)
END FOR
```

Where `expectedBehavior` checks:
```
FUNCTION expectedBehavior(site_config, system_env)
  FOR EACH key IN known_keys DO
    IF system_env[key] != nil THEN
      ASSERT site_config maps key correctly
    END IF
  END FOR
END FUNCTION
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed hook produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT run_after_init_hook_original(input) = run_after_init_hook_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing with Rantly is recommended for preservation checking because:
- It generates many random `.env` file contents and system env configurations automatically
- It catches edge cases like empty values, special characters in values, and unusual key combinations
- It provides strong guarantees that file-loading behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for file-only scenarios, then write Rantly property tests capturing that behavior.

**Test Cases**:
1. **File-only loading preservation**: Generate random `.env` files with all known keys, no system env vars → verify site config matches file values on both original and fixed code
2. **System override preservation**: Generate random `.env` files with all known keys AND matching system env vars → verify system env wins on both original and fixed code
3. **Additional variables preservation**: Generate `.env` files with extra non-known keys → verify they are still exported to `ENV` on both original and fixed code

### Unit Tests

- Test `EnvLoader.load_env_file` with various file formats (comments, blank lines, quoted values)
- Test the `after_init` hook with no files and system env vars set
- Test the `after_init` hook with partial files and system env vars for missing keys
- Test the `after_init` hook with complete files and no system env vars
- Test the `after_init` hook with complete files and system env overrides
- Test edge cases: empty string values in system env, keys with `nil` values

### Property-Based Tests

- Generate random subsets of known keys as system env vars with random string values, no files present → verify all are loaded into site config (fix checking)
- Generate random `.env` file contents for all known keys, no system env → verify file values appear in site config unchanged (preservation)
- Generate random partitions of known keys between file and system env → verify merged result contains all keys with correct priority (fix + preservation)

### Integration Tests

- Test full Jekyll site build with system env vars only (no `.env` files) and verify `site.mapbox_url`, `site.contentful`, and `site.url` are set correctly
- Test full Jekyll site build with `.env` file and system env overrides, verify priority ordering
- Test that `ENV` export at end of hook works correctly for downstream plugins
