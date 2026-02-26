# Jekyll plugin to generate XML sitemap files during the build process.
#
# Produces a sitemap-index.xml referencing one or more sitemap-N.xml
# sub-sitemaps following the sitemaps.org protocol. Collects URLs from
# all collections and standalone pages, generates bilingual URLs
# (German at root, English under /en/), and writes valid XML output.
#
# Runs at :low priority to ensure CollectionGenerator (:high) has
# already populated collections.

module Jekyll
  class SitemapGenerator < Generator
    safe true
    priority :low

    MAX_URLS_PER_SITEMAP = 50_000

    def generate(site)
      # TODO: Collect URLs, split into sub-sitemaps, write index
    rescue => e
      Jekyll.logger.error "SitemapGenerator:", "Error generating sitemap: #{e.message}"
      Jekyll.logger.debug "SitemapGenerator:", e.backtrace.join("\n")
    end
  end
end
