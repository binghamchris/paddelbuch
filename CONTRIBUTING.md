# Contributing to Paddel Buch

Thank you for your interest in contributing to Paddel Buch. This guide will help you get started.

## Code of Conduct

Be respectful and constructive. We're a small community project built around Swiss paddle sports, and we welcome contributors of all experience levels.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the [Development Setup](README.md#development-setup) instructions in the README
4. Create a feature branch from `main`

```bash
git checkout -b feature/your-feature-name
```

## Development Workflow

### Branch Naming

Use descriptive branch names with a prefix:

- `feature/` — new features or enhancements
- `fix/` — bug fixes
- `docs/` — documentation changes
- `refactor/` — code restructuring without behaviour changes

### Making Changes

1. Make your changes in small, focused commits
2. Run the test suite before pushing (see [Running Tests](#running-tests))
3. Ensure your changes work in both German and English locales
4. If you've changed any Jekyll plugins, run the RSpec suite
5. If you've changed any JavaScript, run the Jest suite

### Running Tests

```bash
# Ruby tests (RSpec + Rantly property-based tests)
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rspec

# JavaScript tests (Jest + fast-check property-based tests)
npm test

# Property-based tests only
npm run test:property
```

### Submitting a Pull Request

1. Push your branch to your fork
2. Open a pull request against `main`
3. Describe what your changes do and why
4. Reference any related issues
5. Ensure all CI checks pass (the Amplify preview build runs automatically)

## Working Without Contentful Access

You don't need Contentful credentials to contribute. The `_data/` directory contains YAML files that are populated during the build. For local development without Contentful access:

- The existing YAML data files in `_data/` (if present from a previous build) will be used
- You can create sample data files manually for testing layout or plugin changes
- JavaScript and SCSS changes can be tested without any CMS data

If you need Contentful access for content-related work, contact the project maintainer.

## Project Structure Overview

See [docs/architecture.md](docs/architecture.md) for a detailed architecture guide. Key areas:

- `_plugins/` — Custom Jekyll plugins (Ruby). See [docs/plugins.md](docs/plugins.md)
- `assets/js/` — Frontend JavaScript modules. See [docs/frontend.md](docs/frontend.md)
- `_layouts/` and `_includes/` — Jekyll templates (HTML + Liquid)
- `_sass/` — SCSS stylesheets
- `_i18n/` — Translation strings (German and English)
- `spec/` — Ruby tests (RSpec)
- `_tests/` — JavaScript tests (Jest)

## Coding Standards

### Ruby

- Use `frozen_string_literal: true` at the top of all Ruby files
- Follow the existing plugin patterns (see `_plugins/` for examples)
- All plugins should be `safe true` and declare an appropriate `priority`
- Write RSpec tests for new plugin logic, including property-based tests with Rantly where appropriate

### JavaScript

- No build toolchain (no Webpack, no Babel) — write browser-compatible ES5/ES6
- Modules are loaded via `<script>` tags, not ES module imports
- Write Jest tests for new logic, including property-based tests with fast-check where appropriate

### SCSS

- Follow the existing directory structure: `settings/`, `util/`, `components/`, `pages/`
- Use the colour variables defined in `_sass/settings/_paddelbuch_colours.scss`
- Bootstrap 5 is available as a dependency

### HTML / Liquid

- Use the `{% t %}` tag for all user-visible strings (translations in `_i18n/de.yml` and `_i18n/en.yml`)
- Ensure all new pages work in both German and English
- Use semantic HTML and include appropriate ARIA attributes

## Internationalisation (i18n)

Paddel Buch supports German (default) and English. When adding user-facing text:

1. Add the German string to `_i18n/de.yml`
2. Add the English string to `_i18n/en.yml`
3. Use `{% t key.path %}` in Liquid templates to reference the string

## Adding a New Content Type

If you need to add a new Contentful content type end-to-end, see [docs/content-model.md](docs/content-model.md) for the full process. In summary:

1. Define the content type in Contentful
2. Add a mapper method in `_plugins/contentful_mappers.rb`
3. Register the content type in `ContentfulFetcher::CONTENT_TYPES`
4. Add a collection configuration in `_config.yml`
5. Add collection generation logic in `_plugins/collection_generator.rb`
6. Create a layout in `_layouts/`
7. Add API generation in `_plugins/api_generator.rb` (if the type should be in the public API)
8. Add tile generation in `_plugins/tile_generator.rb` (if the type has spatial data)
9. Add translations to both `_i18n/de.yml` and `_i18n/en.yml`

## Vulnerability Scanning

Before submitting a PR that changes dependencies, run the vulnerability scanner:

```bash
# Ruby gems
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rake audit

# Both Ruby and npm
source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && bundle exec rake audit:all
```

## Questions?

Open an issue on GitHub or reach out to the project maintainer.
