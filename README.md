# Paddel Buch

PaddelBuch.ch is a website which displays the data published in the public database of Swiss paddle sports information visually on a range of maps.

More information about the technological evolution of the project can be found in the [Paddel Buch blog series](https://cloudypandas.ch/series/paddel-buch/) on Cloudy Pandas.

## Project Origin

Paddel Buch started following a sea kayaking roundtable meeting organised by Swiss Canoe in June 2021.

## Project Goals

The main goal of this project is to provide a central, nation-wide store of information for all types of paddlers in Switzerland, to enable members of the paddle sports community to better plan their trips and explore new waterways.

## Technology Stack

- **Static Site Generator**: Jekyll
- **CMS**: Contentful (headless CMS)
- **Maps**: Leaflet.js with Mapbox tiles
- **Hosting**: AWS Amplify (eu-central-1)
- **Languages**: German (default), English

## Project Structure

```
paddelbuch/
├── _config.yml           # Jekyll configuration
├── _data/                # Data files (populated from Contentful)
├── _i18n/                # Internationalization files (de.yml, en.yml)
├── _includes/            # Reusable HTML partials
│   ├── header.html       # Site navigation
│   ├── footer.html       # Site footer
│   ├── map-init.html     # Leaflet map initialization
│   ├── spot-popup.html   # Spot marker popup
│   ├── obstacle-popup.html
│   ├── event-popup.html
│   └── ...
├── _layouts/             # Page templates
│   ├── default.html      # Base layout
│   ├── spot.html         # Spot detail pages
│   ├── waterway.html     # Waterway detail pages
│   ├── obstacle.html     # Obstacle detail pages
│   └── notice.html       # Event notice detail pages
├── _plugins/             # Jekyll plugins
│   ├── api_generator.rb  # JSON API generation
│   ├── tile_generator.rb # Spatial tile generation
│   └── ...
├── _sass/                # SCSS stylesheets
├── _spots/               # Spot collection (generated)
├── _waterways/           # Waterway collection (generated)
├── _obstacles/           # Obstacle collection (generated)
├── _notices/             # Event notice collection (generated)
├── _tests/               # Test files
│   ├── unit/             # Unit tests
│   └── property/         # Property-based tests
├── api/                  # Generated JSON API files
├── assets/               # Static assets
│   ├── css/              # Compiled CSS
│   ├── images/           # Images and icons
│   └── js/               # JavaScript modules
├── gewaesser/            # Waterway list pages
├── offene-daten/         # Open data/API pages
├── amplify.yml           # AWS Amplify build configuration
├── Gemfile               # Ruby dependencies
└── package.json          # Node.js dependencies (for testing)
```

## Development Setup

### Prerequisites

- Ruby 3.4.1 (managed with chruby)
- Bundler
- Node.js (for running tests)

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
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle install

# Install Node.js dependencies (for testing)
npm install
```

### Running Locally

```bash
# Start Jekyll development server (loads .env.development)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec jekyll serve
```

The site will be available at `http://localhost:4000`

### Building for Production

```bash
# Test a production build locally (loads .env.production)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && JEKYLL_ENV=production bundle exec jekyll build
```

The built site will be in the `_site/` directory.

### Running Tests

```bash
# Run all tests
npm test

# Run property-based tests only
npm run test:property

# Run tests in watch mode
npm run test:watch
```

## Deployment

The site is automatically deployed via AWS Amplify when:

1. Code is pushed to the `main` branch
2. Content is published in Contentful (via webhook)

### AWS Amplify Configuration

The build configuration is defined in `amplify.yml`. Required environment variables must be configured in the Amplify Console:

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ACCESS_TOKEN`
- `CONTENTFUL_ENVIRONMENT`
- `MAPBOX_URL`
- `SITE_URL`

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
