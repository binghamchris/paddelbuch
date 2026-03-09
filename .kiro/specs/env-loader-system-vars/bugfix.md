# Bugfix Requirements Document

## Introduction

The `env_loader.rb` Jekyll plugin fails to pick up system environment variables (e.g. those set by AWS Amplify) when no `.env` file is present in the build environment. This causes the site to fall back to default config values — most visibly, OpenStreetMap tiles are rendered instead of Mapbox tiles because `MAPBOX_URL` is never loaded from the system environment.

The root cause is that system environment variable handling only iterates over keys already loaded from `.env` files. When the environment-specific file (`.env.production`) is absent and no `.env` base file exists, the hash is empty and the system env override loop is a no-op.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN no `.env` or `.env.{JEKYLL_ENV}` file exists in the build environment AND system environment variables are set for known keys (MAPBOX_URL, CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN, CONTENTFUL_ENVIRONMENT, SITE_URL) THEN the system ignores all system environment variables and loads 0 vars into site config

1.2 WHEN only a `.env` base file exists (without the environment-specific keys) AND system environment variables are set for keys not present in that file THEN the system ignores the system environment variables for those missing keys

### Expected Behavior (Correct)

2.1 WHEN no `.env` or `.env.{JEKYLL_ENV}` file exists in the build environment AND system environment variables are set for known keys (MAPBOX_URL, CONTENTFUL_SPACE_ID, CONTENTFUL_ACCESS_TOKEN, CONTENTFUL_ENVIRONMENT, SITE_URL) THEN the system SHALL load those system environment variables into site config and map them to the corresponding site config keys

2.2 WHEN only a `.env` base file exists (without the environment-specific keys) AND system environment variables are set for keys not present in that file THEN the system SHALL load those system environment variables into site config, merging them with the file-loaded variables

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `.env` and/or `.env.{JEKYLL_ENV}` files exist and contain all known keys AND no system environment variables are set THEN the system SHALL CONTINUE TO load variables from the files and map them to site config

3.2 WHEN both `.env` files and system environment variables exist for the same keys THEN the system SHALL CONTINUE TO give system environment variables highest priority, overriding file-loaded values

3.3 WHEN `.env` files contain additional variables beyond the known keys THEN the system SHALL CONTINUE TO load and export those variables as before
