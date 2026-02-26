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

    COLLECTION_NAMES = %w[spots waterways obstacles notices static_pages].freeze

    def generate(site)
      urls = collect_urls(site)

      sitemap_files = urls.each_slice(MAX_URLS_PER_SITEMAP).each_with_index.map do |chunk, index|
        write_sub_sitemap(site, chunk, index)
      end

      write_sitemap_index(site, sitemap_files)

      Jekyll.logger.info "SitemapGenerator:", "Generated sitemap with #{urls.size} URLs in #{sitemap_files.size} file(s)"
    rescue => e
      Jekyll.logger.error "SitemapGenerator:", "Error generating sitemap: #{e.message}"
      Jekyll.logger.debug "SitemapGenerator:", e.backtrace.join("\n")
    end

    def write_sub_sitemap(site, urls, index)
      filename = "sitemap-#{index}.xml"
      xml = render_sub_sitemap_xml(urls)
      add_page_to_site(site, filename, xml)
      filename
    end

    def write_sitemap_index(site, sitemap_files)
      xml = render_sitemap_index_xml(site, sitemap_files)
      add_page_to_site(site, "sitemap-index.xml", xml)
    end

    def add_page_to_site(site, filename, content)
      page = PageWithoutAFile.new(site, site.source, "/", filename)
      page.content = content
      page.data["layout"] = nil
      site.pages << page
    end

    def collect_urls(site)
      base_paths = collection_urls(site) + standalone_urls(site)
      bilingual_urls(site, base_paths).uniq
    end

    def bilingual_urls(site, base_paths)
      languages = site.config['languages'] || ['de']
      default_lang = site.config['default_lang'] || 'de'
      excluded_dirs = Array(site.config['exclude_from_localizations'])

      base_paths.flat_map do |path|
        urls = [build_url(site, path)]

        unless excluded_dirs.any? { |dir| path.start_with?("/#{dir}/") || path == "/#{dir}" }
          languages.each do |lang|
            next if lang == default_lang

            urls << build_url(site, "/#{lang}#{path}")
          end
        end

        urls
      end
    end

    def build_url(site, path)
      base = site.config['url'] || ''
      combined = "#{base}#{path}".gsub(%r{(?<!:)//+}, '/')
      ensure_trailing_slash(combined)
    end

    def ensure_trailing_slash(path)
      return path if path.end_with?('/')
      return path if path.end_with?('.html') || path.end_with?('.xml')

      "#{path}/"
    end

    def collection_urls(site)
      COLLECTION_NAMES.flat_map do |name|
        collection = site.collections[name]
        next [] unless collection

        collection.docs.map(&:url)
      end
    end

    def standalone_urls(site)
      site.pages.reject { |page| exclude_page?(page) }.map(&:url)
    end

    def exclude_page?(page)
      return true if page.name == '404.html'
      return true if page.url.start_with?('/assets/')
      return true if page.url.start_with?('/api/')
      return true if page.data['sitemap'] == false
      return true unless page.html?

      false
    end

    def render_url_entry(url)
      <<~XML
        <url>
          <loc>#{url}</loc>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
        </url>
      XML
    end

    def render_sub_sitemap_xml(url_entries)
      entries = url_entries.map { |url| render_url_entry(url) }.join
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{entries.chomp}
        </urlset>
      XML
    end

    def render_sitemap_index_xml(site, sitemap_filenames)
      entries = sitemap_filenames.map do |filename|
        loc = build_url(site, "/#{filename}")
        <<~ENTRY
          <sitemap>
            <loc>#{loc}</loc>
          </sitemap>
        ENTRY
      end.join
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        #{entries.chomp}
        </sitemapindex>
      XML
    end
  end
end
