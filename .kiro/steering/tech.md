# Tech Stack & Build System

## Core Stack

| Layer | Technology |
|---|---|
| Static site generator | Jekyll 4.4 |
| CMS | Contentful (headless, Sync API) |
| Maps | Leaflet 1.9 + MapLibre GL via `@maplibre/maplibre-gl-leaflet` |
| CSS framework | Bootstrap 5.3 (SCSS, loaded from `node_modules`) |
| Charts | Chart.js 4.5 |
| Hosting | AWS Amplify (eu-central-1) |
| IaC | CloudFormation (`deploy/frontend-deploy.yaml`) |
| Ruby | 3.4.9 (managed with chruby) |
| Node.js | Used for tests and build scripts only |

## Ruby Dependencies (Gemfile)

- `jekyll ~> 4.4`
- `contentful ~> 2.19` — CMS client
- `dotenv ~> 3.2` — env file loading
- `jekyll-multiple-languages-plugin ~> 1.8` — i18n
- `jekyll-sass-converter ~> 3.1`
- `rspec ~> 3.13` + `rantly ~> 3.0` — testing (property-based)
- `bundler-audit ~> 0.9` — vulnerability scanning

## Node Dependencies (package.json)

Runtime: `bootstrap`, `chart.js`, `leaflet`, `leaflet.locatecontrol`, `maplibre-gl`, `@maplibre/maplibre-gl-leaflet`
Dev: `jest ^30`, `jest-environment-jsdom`, `fast-check ^4.6`

## Build Pipeline

Production builds use `bundle exec rake build:site` which runs a three-phase parallel pipeline:

1. **Pre-fetch** — Single Jekyll invocation triggers `ContentfulFetcher` to populate `_data/`
2. **Parallel builds** — Two concurrent Jekyll processes, one per locale (de/en), each writing to `_site_de` / `_site_en`
3. **Merge** — German output (root) + English output (`en/` subtree) combined into `_site/`

## Common Commands

All Ruby commands require chruby activation first:
```bash
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9
```

| Task | Command |
|---|---|
| Install Ruby deps | `bundle install` |
| Install Node deps | `npm install` |
| Copy vendor assets | `npm run copy-assets` |
| Download fonts | `npm run download-fonts` |
| Dev server | `bundle exec jekyll serve` |
| Production build | `JEKYLL_ENV=production bundle exec rake build:site` |
| Run Ruby tests | `bundle exec rspec` |
| Run JS tests | `npm test` |
| Run JS property tests | `npm run test:property` |
| Audit Ruby gems | `bundle exec rake audit` |
| Audit all deps | `bundle exec rake audit:all` |
| Force full CMS sync | `CONTENTFUL_FORCE_SYNC=true bundle exec jekyll build` |

## Environment Variables

Loaded automatically by `_plugins/env_loader.rb` from `.env.development` (default) or `.env.production` (when `JEKYLL_ENV=production`). System env vars take priority.

Required: `CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_ENVIRONMENT`, `MAPBOX_URL`, `SITE_URL`

## CI/CD

AWS Amplify runs `amplify.yml` on push or Contentful webhook. The build installs deps, copies vendor assets, downloads fonts, runs `rake build:site`, then `npm test`.
