# Jekyll plugin to generate XML sitemap files during the build process.
#
# Produces a sitemap-index.xml referencing one or more sitemap-N.xml sub-sitemaps,
# following the sitemaps.org protocol. Collects URLs from all five collections
# (spots, waterways, obstacles, notices, static_pages) and standalone HTML pages,
# generates bilingual URLs (German at root, English under /en/), and writes valid
# XML output to the _site/ directory.
#
# Runs at :low priority to ensure CollectionGenerator (:high) has already
# populated collections before URL collection begins.

module Jekyll
  class SitemapGenerator < Generator
    safe true
    priority :low

    MAX_URLS_PER_SITEMAP = 50_000

    def generate(site)
      urls = collect_urls(site)

      sitemap_files = urls.each_slice(MAX_URLS_PER_SITEMAP).each_with_index.map do |url_chunk, index|
        write_sub_sitemap(site, url_chunk, index)
      end

      write_sitemap_index(site, sitemap_files)
    rescue => e
      Jekyll.logger.error "SitemapGenerator:", "Error generating sitemap: #{e.message}"
      Jekyll.logger.debug "SitemapGenerator:", e.backtrace.join("\n")
    end

    private

    def collect_urls(site)
      # TODO: Combine collection and standalone URLs through bilingual expansion and deduplicate
    end

    def collection_urls(site)
      # TODO: Iterate all 5 collections and return base paths
    end

    def standalone_urls(site)
      # TODO: Iterate site.pages, filter excluded pages, return base paths
    end

    def bilingual_urls(site, base_paths)
      # TODO: Produce default locale and /en/-prefixed URLs, respecting exclude_from_localizations
    end

    def exclude_page?(page)
      # TODO: Exclude 404, assets/, api/, sitemap:false, and non-HTML pages
    end

    def build_url(site, path)
      # TODO: Combine site URL with path and ensure trailing slash
    end

    def ensure_trailing_slash(path)
      # TODO: Append / when needed (skip .html/.xml paths)
    end

    def write_sitemap_index(site, sitemap_files)
      # TODO: Render index XML referencing all sub-sitemaps, write file
    end

    def write_sub_sitemap(site, urls, index)
      # TODO: Render XML, write file, return filename
    end

    def render_url_entry(url)
      # TODO: Produce <url> XML fragment with <loc>, <changefreq>, <priority>
    end

    def render_sub_sitemap_xml(url_entries)
      # TODO: Produce complete sub-sitemap XML with declaration and namespace
    end

    def render_sitemap_index_xml(site, sitemap_filenames)
      # TODO: Produce sitemap index XML
    end
  end
end
