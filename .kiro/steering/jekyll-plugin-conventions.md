---
inclusion: fileMatch
fileMatchPattern: "_plugins/**/*.rb"
---

# Jekyll Plugin Conventions

This project has 20 custom Jekyll plugins in `_plugins/`. All new plugins and modifications must follow these established patterns.

## Required File Structure

Every plugin file must start with `frozen_string_literal: true` and a comment block describing its purpose:

```ruby
# frozen_string_literal: true

# Jekyll plugin to [purpose]
# This plugin generates:
# - [output 1]
# - [output 2]

module Jekyll
  class MyGenerator < Generator
    safe true
    priority :normal

    # ...
  end
end
```

## Priority System

Plugins execute in priority order. Choose the right priority based on data dependencies:

| Priority | When to use | Examples |
|----------|-------------|---------|
| `:highest` | Fetches external data that others depend on | `ContentfulFetcher` |
| `:high` | Processes raw data into collections/structures | `CollectionGenerator`, `ColorGenerator` |
| `:normal` | Pre-computes derived data from collections | `PrecomputeGenerator`, dashboard metrics |
| `:low` | Generates output files from processed data | `ApiGenerator`, `TileGenerator`, `SitemapGenerator` |

## Caching Pattern

Generators that produce output files should use the `GeneratorCache` mixin to skip regeneration when Contentful data hasn't changed:

```ruby
require_relative 'generator_cache'

class MyGenerator < Generator
  include GeneratorCache
  # Use cache_available?, write_cache_file, read_cache_files
  # Check site.config['contentful_data_changed'] to decide whether to regenerate
end
```

## Compute-Once-Cache-Across-Locales Pattern

For generators that run once per language pass (de, en), compute numerical results on the first pass and cache them in class-level variables. Subsequent locale passes only swap in localised names. See `DashboardMetricsGenerator` and `StatisticsMetricsGenerator` for examples.

## Key Rules

- Always declare `safe true` on generators
- Use `Jekyll::PageWithoutAFile` for generated output so files survive Jekyll's cleanup phase in multi-language builds
- Access Contentful data via `site.data` (populated by `ContentfulFetcher`), never fetch directly
- Reference `#[[file:docs/plugins.md]]` for the full plugin execution order and API documentation
