# Paddel Buch

PaddelBuch.ch is a website which displays the data published in the public database of Swiss paddle sports information visually on a range of maps.

More information about the technological evolution of the project can be found in the [Paddel Buch blog series](https://cloudypandas.ch/series/paddel-buch/) on Cloudy Pandas.

## Documentation

- [Contributing Guide](CONTRIBUTING.md) — How to contribute to the project
- [Architecture Overview](docs/architecture.md) — Build pipeline, data flow, and system design
- [Plugin Reference](docs/plugins.md) — All 18 custom Jekyll plugins documented
- [Frontend Guide](docs/frontend.md) — JavaScript modules, SCSS structure, and vendor assets
- [Content Model](docs/content-model.md) — Contentful content types and how to add new ones
- [Testing Guide](docs/testing.md) — Test suites, property-based testing, and how to write new tests
- [Deployment](deploy/README.md) — AWS Amplify deployment and CloudFormation
- [Custom Build Image](docs/custom-amplify-build-image/README.md) — Docker build image for Amplify

## Project Origin

Paddel Buch started following a sea kayaking roundtable meeting organised by Swiss Canoe in June 2021.

## Project Goals

The main goal of this project is to provide a central, nation-wide store of information for all types of paddlers in Switzerland, to enable members of the paddle sports community to better plan their trips and explore new waterways.

## Technology Stack

- **Static Site Generator**: Jekyll 4.3
- **CMS**: Contentful (headless CMS) with Sync API for incremental updates
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **Hosting**: AWS Amplify (eu-central-1)
- **Languages**: German (default), English
- **Ruby**: 3.4.9 (managed with chruby)
- **Testing**: RSpec + Rantly (Ruby), Jest + fast-check (JavaScript)

## Project Structure

```
paddelbuch/
├── _config.yml           # Jekyll configuration
├── _config_de.yml        # German locale build override
├── _config_en.yml        # English locale build override
├── _config_prefetch.yml  # Contentful pre-fetch build override
├── _data/                # Data files (populated from Contentful)
│   ├── spots.yml         # Spot data
│   ├── waterways.yml     # Waterway data
│   ├── obstacles.yml     # Obstacle data
│   ├── notices.yml       # Event notice data
│   ├── protected_areas.yml
│   ├── static_pages.yml  # CMS-driven static pages
│   └── types/            # Dimension/lookup tables
├── _i18n/                # Internationalization files (de.yml, en.yml)
├── _includes/            # Reusable HTML partials
│   ├── header.html       # Site navigation
│   ├── footer.html       # Site footer
│   ├── map-init.html     # Leaflet map initialization
│   ├── detail-map-layers.html  # Data layers for detail pages
│   ├── layer-control.html      # Map layer toggle control
│   ├── spot-popup.html         # Spot marker popup
│   ├── obstacle-popup.html
│   ├── event-popup.html
│   ├── rejected-popup.html     # Rejected spot popup
│   └── *-detail-content.html   # Detail page content partials
├── _layouts/             # Page templates
│   ├── default.html      # Base layout
│   ├── page.html         # Static page layout (CMS content)
│   ├── spot.html         # Spot detail pages
│   ├── waterway.html     # Waterway detail pages
│   ├── obstacle.html     # Obstacle detail pages
│   └── notice.html       # Event notice detail pages
├── _plugins/             # Jekyll plugins
│   ├── api_generator.rb       # JSON API generation
│   ├── cache_metadata.rb      # Sync state persistence
│   ├── collection_generator.rb # Collection page generation
│   ├── contentful_fetcher.rb  # Contentful data fetching
│   ├── contentful_mappers.rb  # Contentful → Jekyll data mapping
│   ├── env_loader.rb          # .env file loading
│   ├── favicon_generator.rb   # Favicon and Apple Touch Icon handling
│   ├── i18n_patch.rb          # i18n compatibility patch
│   ├── locale_filter.rb       # Locale-aware filtering
│   ├── ssl_patch.rb           # SSL fix for Ruby 3.4+/OpenSSL 3.x
│   ├── sync_checker.rb        # Contentful Sync API integration
│   ├── tile_generator.rb      # Spatial tile generation
│   └── waterway_filters.rb    # Waterway-specific filters
├── _scripts/             # Build helper scripts
│   └── generate_apple_touch_icon.py  # SVG → PNG icon generation
├── _sass/                # SCSS stylesheets
├── _spots/               # Spot collection (generated)
├── _waterways/           # Waterway collection (generated)
├── _obstacles/           # Obstacle collection (generated)
├── _notices/             # Event notice collection (generated)
├── _static_pages/        # Static page collection (generated)
├── _tests/               # JavaScript test files
│   ├── unit/             # Unit tests (Jest)
│   └── property/         # Property-based tests (fast-check)
├── spec/                 # Ruby test files (RSpec + Rantly)
│   ├── *_spec.rb         # Unit and property-based tests
│   └── spec_helper.rb    # Test configuration
├── api/                  # Generated JSON API files
├── assets/               # Static assets
│   ├── css/              # Compiled CSS
│   ├── images/           # Images and icons
│   └── js/               # JavaScript modules
├── deploy/               # Deployment configuration
├── docs/                 # Project documentation
├── gewaesser/            # Waterway list pages
├── offene-daten/         # Open data/API pages
├── amplify.yml           # AWS Amplify build configuration
├── Gemfile               # Ruby dependencies
└── package.json          # Node.js dependencies (for testing)
```

## Development Setup

### Prerequisites

- Ruby 3.4.9 (managed with chruby)
- Bundler
- Node.js (for running tests)
- librsvg (`brew install librsvg`) — for regenerating the Apple Touch Icon PNG

### Environment Variables

Environment variables are loaded automatically from `.env` files by the `_plugins/env_loader.rb` plugin. The file loaded depends on `JEKYLL_ENV`:

| `JEKYLL_ENV`   | File loaded          | Default? |
|----------------|----------------------|----------|
| `development`  | `.env.development`   | Yes      |
| `production`   | `.env.production`    | No       |

Copy `.env.example` to `.env.development` and fill in your values:

```bash
cp .env.example .env.development
```

Required variables:

```bash
CONTENTFUL_SPACE_ID=your_space_id
CONTENTFUL_ACCESS_TOKEN=your_access_token
CONTENTFUL_ENVIRONMENT=master
MAPBOX_URL=your_mapbox_tile_url
SITE_URL=http://localhost:4000
```

System environment variables always take priority over `.env` file values.

### Installation

```bash
# Install Ruby dependencies
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle install

# Install Node.js dependencies (for testing)
npm install
```

### Running Locally

```bash
# Start Jekyll development server (loads .env.development)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec jekyll serve
```

The site will be available at `http://localhost:4000`

### Building for Production

```bash
# Test a production build locally (loads .env.production)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && JEKYLL_ENV=production bundle exec rake build:site
```

The `build:site` Rake task runs a parallel build pipeline that reduces build time by ~40% compared to the previous sequential approach:

1. **Pre-fetch** — A single Jekyll invocation triggers `ContentfulFetcher` to populate `_data/` with fresh Contentful content.
2. **Parallel builds** — Two Jekyll processes run concurrently, one per locale (`de` and `en`), each writing to its own temporary output directory.
3. **Merge** — The German build output (root pages, `assets/`, `api/`) and the English build output (`en/` subtree only) are combined into `_site/`.

The built site will be in the `_site/` directory.

### Running Tests

```bash
# Run all JavaScript tests (Jest + fast-check)
npm test

# Run property-based tests only
npm run test:property

# Run tests in watch mode
npm run test:watch

# Run Ruby tests (RSpec + Rantly)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec
```

### Vulnerability Scanning

Scan Ruby and Node.js dependencies for known vulnerabilities:

```bash
# Scan Ruby gems only
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rake audit

# Scan both Ruby gems and npm packages
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rake audit:all
```

## Favicon and Apple Touch Icon

The site uses an SVG favicon (`assets/images/logo-favicon.svg`) for modern browsers and a 180×180 PNG Apple Touch Icon (`assets/images/apple-touch-icon.png`) for iOS devices.

The `favicon_generator.rb` plugin handles both during the Jekyll build:
- Copies the SVG to `/favicon.ico` at the site root (prevents browser 404s)
- Copies the PNG to `/apple-touch-icon.png` at the site root (where iOS looks for it)

### Regenerating the Apple Touch Icon

The PNG is checked into the repo so production builds on AWS Amplify don't need any image conversion tools. If you update the SVG favicon, regenerate the PNG locally:

```bash
# Requires: brew install librsvg
python3 _scripts/generate_apple_touch_icon.py
```

The script uses a SHA-256 checksum to skip regeneration when the SVG hasn't changed.

## Contentful Integration

Content is managed in Contentful and synced to Jekyll data files during the build process. The sync pipeline consists of several custom plugins:

1. **ContentfulFetcher** (`contentful_fetcher.rb`) — Orchestrates the data fetch from Contentful, using the Sync API for incremental updates when possible
2. **SyncChecker** (`sync_checker.rb`) — Determines whether a full or incremental sync is needed by querying the Contentful Sync API
3. **CacheMetadata** (`cache_metadata.rb`) — Persists sync state (tokens, timestamps) between builds to enable incremental syncing
4. **ContentfulMappers** (`contentful_mappers.rb`) — Transforms Contentful entries into Jekyll-compatible YAML data, including rich text rendering with support for tables, marks (bold, italic, underline, code), and embedded entries
5. **CollectionGenerator** (`collection_generator.rb`) — Generates Jekyll collection pages from the synced data

Content types mapped from Contentful include spots, waterways, obstacles, protected areas, event notices, static pages, and various dimension/lookup types.

### Forcing a Full Sync

By default, the build uses the Contentful Sync API for incremental updates. To force a full re-fetch of all content, you can either:

1. Set the `CONTENTFUL_FORCE_SYNC` environment variable:

```bash
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && CONTENTFUL_FORCE_SYNC=true bundle exec jekyll build
```

2. Or add `force_contentful_sync: true` to `_config.yml`:

```yaml
force_contentful_sync: true
```

A full sync is also triggered automatically when no cache metadata exists, the cache is invalid, or the Contentful space/environment has changed since the last build.

## Deployment

The site is deployed to AWS Amplify using the CloudFormation template at `deploy/frontend-deploy.yaml`. The build configuration is defined in `amplify.yml`.

Once deployed, builds are triggered automatically when:

1. Code is pushed to the configured branch
2. Content is published in Contentful (via webhook)

### CloudFormation Parameters

| Parameter | Description | Required |
|---|---|---|
| `AppName` | Name for the Amplify app | Yes |
| `AppDescription` | Description for the Amplify app | Yes |
| `AppStage` | Deployment stage (`PRODUCTION`, `BETA`, `DEVELOPMENT`, `EXPERIMENTAL`, `PULL_REQUEST`) | Yes |
| `AppDomainName` | Custom domain name (e.g. `paddelbuch.ch`) | Production only |
| `GithubRepoUrl` | GitHub repository URL | Yes |
| `GithubBranchName` | Branch to deploy | Yes |
| `GithubToken` | GitHub personal access token | Yes |
| `EnvVarMapboxUrl` | MapBox tile style URL | Yes |
| `EnvVarContentfulToken` | Contentful API access token | Yes |
| `EnvVarContentfulSpace` | Contentful space ID | Yes |
| `EnvVarContentfulEnv` | Contentful environment ID | Yes |
| `EnvVarSiteUrl` | Site URL used during Jekyll build | Production only |

### Production Deployment

Production deployments configure a custom domain with both root and `www` subdomains, and set up a redirect from the naked domain to `www`.

```bash
noglob aws cloudformation deploy \
  --template-file deploy/frontend-deploy.yaml \
  --stack-name paddelbuch-prod \
  --region eu-central-1 \
  --parameter-overrides \
    AppName=paddelbuch \
    AppDescription="Paddel Buch production" \
    AppStage=PRODUCTION \
    AppDomainName=paddelbuch.ch \
    GithubRepoUrl=https://github.com/your-org/paddelbuch \
    GithubBranchName=main \
    GithubToken=ghp_xxxxxxxxxxxx \
    EnvVarMapboxUrl=your_mapbox_url \
    EnvVarContentfulToken=your_token \
    EnvVarContentfulSpace=your_space_id \
    EnvVarContentfulEnv=master \
    EnvVarSiteUrl=https://www.paddelbuch.ch
```

### Non-Production Deployment

Non-production deployments (any `AppStage` other than `PRODUCTION`) skip custom domain configuration entirely. The site is accessible only via the default Amplify-provided URL (e.g. `https://branch.xxxxxxxxxxxx.amplifyapp.com`).

`AppDomainName` and `EnvVarSiteUrl` can be omitted for non-production stacks. The `SITE_URL` environment variable is automatically set to the default Amplify URL.

```bash
noglob aws cloudformation deploy \
  --template-file deploy/frontend-deploy.yaml \
  --stack-name paddelbuch-dev \
  --region eu-central-1 \
  --parameter-overrides \
    AppName=paddelbuch-dev \
    AppDescription="Paddel Buch development" \
    AppStage=DEVELOPMENT \
    GithubRepoUrl=https://github.com/your-org/paddelbuch \
    GithubBranchName=develop \
    GithubToken=ghp_xxxxxxxxxxxx \
    EnvVarMapboxUrl=your_mapbox_url \
    EnvVarContentfulToken=your_token \
    EnvVarContentfulSpace=your_space_id \
    EnvVarContentfulEnv=development
```

## API

Paddel Buch provides a JSON API for accessing paddle sports data. Documentation is available at `/offene-daten/api`.

### Available Endpoints

**Fact Tables:**
- `/api/spots-{locale}.json` - All spots
- `/api/obstacles-{locale}.json` - All obstacles
- `/api/notices-{locale}.json` - Event notices
- `/api/protected-areas-{locale}.json` - Protected areas
- `/api/waterways-{locale}.json` - Waterways

**Dimension Tables:**
- `/api/spottypes-{locale}.json`
- `/api/obstacletypes-{locale}.json`
- `/api/paddlecrafttypes-{locale}.json`
- And more...

**Metadata:**
- `/api/lastUpdateIndex.json` - Last update timestamps

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg

Full license details can be found here: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
