# Implementation Plan: Sitemap Generation

## Overview

Implement a Jekyll Generator plugin (`SitemapGenerator`) that produces XML sitemap files during the build process. The plugin collects URLs from all five collections and standalone pages, generates bilingual URLs (German default + English under `/en/`), and writes a `sitemap-index.xml` with one or more `sitemap-N.xml` sub-sitemaps. Implemented as a single Ruby file following existing plugin patterns, tested with RSpec and Rantly.

## Tasks

- [x] 1. Implement core SitemapGenerator plugin
  - [x] 1.1 Create `_plugins/sitemap_generator.rb` with the `Jekyll::SitemapGenerator` class skeleton
    - Define the class inheriting from `Jekyll::Generator` with `safe true` and `priority :low`
    - Add `MAX_URLS_PER_SITEMAP = 50_000` constant
    - Implement the `generate(site)` entry point with begin/rescue error handling
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 1.2 Implement URL collection methods
    - Implement `collection_urls(site)` to iterate all 5 collections (spots, waterways, obstacles, notices, static_pages) and return base paths
    - Implement `standalone_urls(site)` to iterate `site.pages`, filter excluded pages, and return base paths
    - Implement `exclude_page?(page)` to exclude 404, assets/, api/, sitemap:false, and non-HTML pages
    - Implement `collect_urls(site)` to combine collection and standalone URLs through bilingual expansion and deduplicate
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.3 Implement bilingual URL generation and URL building helpers
    - Implement `bilingual_urls(site, base_paths)` to produce default locale and `/en/`-prefixed URLs, respecting `exclude_from_localizations`
    - Implement `build_url(site, path)` to combine site URL with path and ensure trailing slash
    - Implement `ensure_trailing_slash(path)` to append `/` when needed (skip `.html`/`.xml` paths)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2_

  - [x] 1.4 Implement XML rendering methods
    - Implement `render_url_entry(url)` to produce `<url>` XML fragments with `<loc>`, `<changefreq>daily</changefreq>`, `<priority>0.7</priority>`
    - Implement `render_sub_sitemap_xml(url_entries)` to produce complete sub-sitemap XML with declaration and namespace
    - Implement `render_sitemap_index_xml(site, sitemap_filenames)` to produce sitemap index XML
    - _Requirements: 1.2, 2.2, 2.3, 2.4, 2.5, 6.3_

  - [x] 1.5 Implement file writing and sitemap splitting
    - Implement `write_sub_sitemap(site, urls, index)` to render XML, write to `_site/`, and add as `StaticFile`
    - Implement `write_sitemap_index(site, sitemap_files)` to render index XML, write to `_site/`, and add as `StaticFile`
    - Wire the `generate` method to split URLs into chunks of 50,000, write sub-sitemaps, then write the index
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 7.3_

- [x] 2. Checkpoint - Verify plugin loads and generates files
  - Ensure the plugin can be loaded by Jekyll without errors, ask the user if questions arise.

- [ ] 3. Implement unit and property tests
  - [x] 3.1 Create `spec/sitemap_generator_spec.rb` with test setup
    - Set up RSpec describe block for `Jekyll::SitemapGenerator`
    - Create helper methods for building minimal Jekyll site objects with configurable collections, pages, and config values
    - Follow patterns from `spec/collection_generator_spec.rb` using `Dir.mktmpdir`
    - _Requirements: 7.1_

  - [x] 3.2 Write property test for URL entry rendering (Property 1)
    - **Property 1: URL entry rendering contains required metadata**
    - Generate random URL strings, call `render_url_entry`, verify XML contains `<loc>`, `<changefreq>daily</changefreq>`, `<priority>0.7</priority>`
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 3.3 Write property test for collection document inclusion (Property 2)
    - **Property 2: All collection documents are included**
    - Generate random documents across collections, run `collection_urls`, verify all document URLs present
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x] 3.4 Write property test for bilingual URL generation (Property 3)
    - **Property 3: Bilingual URL generation**
    - Generate random base paths, call `bilingual_urls`, verify both default and `/en/`-prefixed URLs exist
    - **Validates: Requirements 5.1, 5.2**

  - [-] 3.5 Write property test for URL well-formedness (Property 4)
    - **Property 4: URL well-formedness**
    - Generate random paths, call `build_url`, verify starts with site URL and ends with `/`
    - **Validates: Requirements 6.1, 6.2**

  - [~] 3.6 Write property test for no duplicate URLs (Property 5)
    - **Property 5: No duplicate URLs**
    - Generate page sets with potential duplicate paths, run `collect_urls`, verify uniqueness
    - **Validates: Requirements 6.4**

  - [~] 3.7 Write property test for sitemap splitting (Property 6)
    - **Property 6: Sitemap splitting at 50,000 URLs**
    - Generate random URL counts, verify correct number of sub-sitemaps and max size per file
    - **Validates: Requirements 1.3, 1.4**

  - [~] 3.8 Write property test for sitemap:false exclusion (Property 7)
    - **Property 7: Pages with sitemap:false are excluded**
    - Generate pages with random `sitemap` front matter values, verify excluded when false
    - **Validates: Requirements 4.5**

  - [~] 3.9 Write property test for standalone HTML page inclusion (Property 8)
    - **Property 8: Standalone HTML pages are included**
    - Generate random standalone pages (HTML and non-HTML), verify HTML pages included and non-HTML excluded
    - **Validates: Requirements 4.1**

  - [~] 3.10 Write unit tests for edge cases and XML structure
    - Test that `sitemap-index.xml` is generated with correct sitemaps.org namespace
    - Test that `sitemap-0.xml` is generated with correct sitemaps.org namespace
    - Test XML declaration `<?xml version="1.0" encoding="UTF-8"?>` is present
    - Test 404 page is excluded
    - Test assets/ and api/ pages are excluded
    - Test plugin priority is `:low`
    - Test error handling doesn't crash the build (simulate error, verify no exception raised)
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.2, 4.3, 4.4, 6.3, 7.2, 7.4_

- [~] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The plugin is a single file (`_plugins/sitemap_generator.rb`) following the same pattern as `collection_generator.rb`
- Tests go in `spec/sitemap_generator_spec.rb` using RSpec + Rantly, following `spec/collection_generator_spec.rb` conventions
- Run tests with: `source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.1 && bundle exec rspec spec/sitemap_generator_spec.rb`
- Each property test uses `property_of { ... }.check(100)` for a minimum of 100 iterations
