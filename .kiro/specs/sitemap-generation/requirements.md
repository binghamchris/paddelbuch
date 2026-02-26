# Requirements Document

## Introduction

The Paddelbuch Jekyll site needs an XML sitemap that replicates the structure and behavior of the original Gatsby-generated sitemap. The sitemap must include all pages across both supported languages (German as default at root, English under `/en/` prefix), covering all collections (spots, waterways, obstacles, notices, static_pages) and standalone pages. The sitemap follows the sitemap index pattern, with a top-level `sitemap-index.xml` referencing one or more sub-sitemaps.

## Glossary

- **Sitemap_Generator**: A custom Jekyll generator plugin that produces XML sitemap files during the Jekyll build process
- **Sitemap_Index**: An XML file (`sitemap-index.xml`) conforming to the sitemaps.org protocol that references one or more Sub_Sitemap files
- **Sub_Sitemap**: An XML file (`sitemap-0.xml`, `sitemap-1.xml`, etc.) conforming to the sitemaps.org protocol that contains individual URL entries
- **Collection_Page**: A page generated from one of the Jekyll collections (spots, waterways, obstacles, notices, static_pages)
- **Standalone_Page**: A page not belonging to a collection, such as `index.html`, `404.html`, or pages in subdirectories like `offene-daten/`
- **Default_Locale**: The German language (`de`), served at the site root without a path prefix
- **Alternate_Locale**: The English language (`en`), served under the `/en/` path prefix
- **URL_Entry**: A `<url>` element in a Sub_Sitemap containing `<loc>`, `<changefreq>`, and `<priority>` child elements
- **Build_Process**: The standard Jekyll site generation triggered by `jekyll build` or `jekyll serve`

## Requirements

### Requirement 1: Sitemap Index Generation

**User Story:** As a site owner, I want a sitemap index file generated at `/sitemap-index.xml`, so that search engines can discover all sub-sitemaps for the site.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL produce a `sitemap-index.xml` file in the site output root directory during the Build_Process
2. THE Sitemap_Index SHALL conform to the sitemaps.org sitemap index protocol (xmlns `http://www.sitemaps.org/schemas/sitemap/0.9`)
3. THE Sitemap_Index SHALL contain one or more `<sitemap>` entries, each with a `<loc>` element referencing a Sub_Sitemap using the full site URL (`https://www.paddelbuch.ch/sitemap-0.xml`)
4. WHEN the total number of URL entries exceeds 50,000, THE Sitemap_Generator SHALL split entries across multiple Sub_Sitemap files (`sitemap-0.xml`, `sitemap-1.xml`, etc.)

### Requirement 2: Sub-Sitemap Generation

**User Story:** As a site owner, I want sub-sitemap files containing all page URLs, so that search engines can index every page on the site.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL produce at least one Sub_Sitemap file (`sitemap-0.xml`) in the site output root directory during the Build_Process
2. THE Sub_Sitemap SHALL conform to the sitemaps.org URL set protocol (xmlns `http://www.sitemaps.org/schemas/sitemap/0.9`)
3. WHEN a Sub_Sitemap contains URL entries, each URL_Entry SHALL include a `<loc>` element with the full absolute URL (e.g., `https://www.paddelbuch.ch/gewaesser/aare/`)
4. THE Sitemap_Generator SHALL set `<changefreq>daily</changefreq>` for each URL_Entry in the Sub_Sitemap
5. THE Sitemap_Generator SHALL set `<priority>0.7</priority>` for each URL_Entry in the Sub_Sitemap

### Requirement 3: Collection Page Inclusion

**User Story:** As a site owner, I want all collection pages included in the sitemap, so that search engines can discover all waterways, spots, obstacles, notices, and static pages.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL include URL entries for all Collection_Page documents from the spots collection
2. THE Sitemap_Generator SHALL include URL entries for all Collection_Page documents from the waterways collection
3. THE Sitemap_Generator SHALL include URL entries for all Collection_Page documents from the obstacles collection
4. THE Sitemap_Generator SHALL include URL entries for all Collection_Page documents from the notices collection
5. THE Sitemap_Generator SHALL include URL entries for all Collection_Page documents from the static_pages collection

### Requirement 4: Standalone Page Inclusion

**User Story:** As a site owner, I want standalone pages (home page, about, open data, etc.) included in the sitemap, so that search engines can index all non-collection pages.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL include URL entries for all Standalone_Page files that produce HTML output
2. THE Sitemap_Generator SHALL exclude the `404.html` page from the sitemap
3. THE Sitemap_Generator SHALL exclude pages located under the `assets/` directory from the sitemap
4. THE Sitemap_Generator SHALL exclude pages located under the `api/` directory from the sitemap
5. WHEN a page has `sitemap: false` in its front matter, THE Sitemap_Generator SHALL exclude that page from the sitemap

### Requirement 5: Bilingual URL Coverage

**User Story:** As a site owner, I want both German and English versions of every page in the sitemap, so that search engines can index the full bilingual site.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL include Default_Locale URLs for all included pages at the site root (e.g., `/gewaesser/aare/`)
2. THE Sitemap_Generator SHALL include Alternate_Locale URLs for all included pages under the `/en/` prefix (e.g., `/en/gewaesser/aare/`)
3. THE Sitemap_Generator SHALL generate bilingual URLs by respecting the `languages` and `default_lang` settings from `_config.yml`
4. THE Sitemap_Generator SHALL exclude directories listed in `exclude_from_localizations` (assets, api) from Alternate_Locale URL generation

### Requirement 6: URL Correctness

**User Story:** As a site owner, I want all sitemap URLs to be correct and well-formed, so that search engines can successfully crawl every listed page.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL use the `url` value from `_config.yml` (`https://www.paddelbuch.ch`) as the base for all absolute URLs
2. THE Sitemap_Generator SHALL ensure all URLs end with a trailing slash
3. THE Sitemap_Generator SHALL produce valid XML output with proper encoding (UTF-8) and XML declaration
4. THE Sitemap_Generator SHALL not include duplicate URLs in the Sub_Sitemap files

### Requirement 7: Build Integration

**User Story:** As a developer, I want the sitemap generated automatically during the Jekyll build, so that no manual steps are needed to keep the sitemap up to date.

#### Acceptance Criteria

1. THE Sitemap_Generator SHALL execute as a Jekyll Generator plugin during the Build_Process
2. THE Sitemap_Generator SHALL run after the CollectionGenerator plugin to ensure all collection documents are available
3. THE Sitemap_Generator SHALL write output files using the Jekyll static file mechanism so they appear in the `_site/` output directory
4. IF the Build_Process encounters an error during sitemap generation, THEN THE Sitemap_Generator SHALL log the error and allow the build to continue without the sitemap files
