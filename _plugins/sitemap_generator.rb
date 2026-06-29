# frozen_string_literal: true

require 'date'

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
      # Skip duplicate runs -- with parallel_localization: true, Jekyll runs all
      # generators once per language. This generator already produces bilingual
      # URLs internally, so only run during the default-language pass.
      default_lang = site.config['default_lang'] || 'de'
      current_lang = site.config['lang'] || default_lang
      if current_lang != default_lang
        Jekyll.logger.info "SitemapGenerator:", "Skipping (already generated during #{default_lang} pass)"
        return
      end

      entries = collect_url_entries(site)

      sitemap_files = entries.each_slice(MAX_URLS_PER_SITEMAP).each_with_index.map do |chunk, index|
        write_sub_sitemap(site, chunk, index)
      end

      write_sitemap_index(site, sitemap_files)

      Jekyll.logger.info "SitemapGenerator:", "Generated sitemap with #{entries.size} URLs in #{sitemap_files.size} file(s)"
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

    # --- Entry-based collection: adds optional <lastmod> and bilingual hreflang
    #     alternate links to each <url> entry (Requirement 8.6). Each language
    #     variant of a page becomes its own entry, and every entry lists the full
    #     set of alternates (de, en, x-default), as recommended for hreflang. ---

    def collect_url_entries(site)
      base = collection_entries(site) + standalone_entries(site)
      seen = {}
      entries = []

      base.each do |item|
        lastmod = normalize_lastmod(item[:lastmod])
        variants = language_variants(site, item[:path])
        alternates = build_alternates(site, variants)

        variants.each do |variant|
          loc = variant[:href]
          next if seen[loc]

          seen[loc] = true
          entries << { 'loc' => loc, 'lastmod' => lastmod, 'alternates' => alternates }
        end
      end

      entries
    end

    # Collection documents paired with their updatedAt timestamp (source for <lastmod>).
    def collection_entries(site)
      COLLECTION_NAMES.flat_map do |name|
        collection = site.collections[name]
        next [] unless collection

        collection.docs.map { |doc| { path: doc.url, lastmod: doc.data['updatedAt'] } }
      end
    end

    # Standalone pages paired with their updatedAt timestamp, if present.
    def standalone_entries(site)
      site.pages.reject { |page| exclude_page?(page) }.map do |page|
        { path: page.url, lastmod: page.data['updatedAt'] }
      end
    end

    # Computes the per-language URL variants for a base path, mirroring the rule used
    # by #bilingual_urls (default language at the root, others under /<lang>), unless
    # the path is locale-excluded.
    def language_variants(site, path)
      languages = site.config['languages'] || ['de']
      default_lang = site.config['default_lang'] || 'de'
      excluded_dirs = Array(site.config['exclude_from_localizations'])

      variants = [{ hreflang: default_lang, href: build_url(site, path) }]

      unless excluded_dirs.any? { |dir| path.start_with?("/#{dir}/") || path == "/#{dir}" }
        languages.each do |lang|
          next if lang == default_lang

          variants << { hreflang: lang, href: build_url(site, "/#{lang}#{path}") }
        end
      end

      variants
    end

    # Builds the hreflang alternate list for a set of language variants and appends an
    # x-default entry pointing at the default-language URL. Returns [] for single-variant
    # (locale-excluded) paths so no alternates are emitted.
    def build_alternates(site, variants)
      return [] if variants.size <= 1

      default_lang = site.config['default_lang'] || 'de'
      alternates = variants.map { |v| { 'hreflang' => v[:hreflang], 'href' => v[:href] } }

      default = variants.find { |v| v[:hreflang] == default_lang }
      alternates << { 'hreflang' => 'x-default', 'href' => default[:href] } if default

      alternates
    end

    # Normalises an updatedAt value to a W3C date (YYYY-MM-DD), which is valid for
    # <lastmod> per the sitemaps.org schema. Returns nil for missing/unparseable input.
    def normalize_lastmod(value)
      return nil if value.nil? || value.to_s.strip.empty?

      Date.parse(value.to_s).strftime('%Y-%m-%d')
    rescue ArgumentError, TypeError
      nil
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

    def render_url_entry(url, lastmod = nil, alternates = nil)
      entry = +"<url>\n"
      entry << "  <loc>#{url}</loc>\n"
      entry << "  <lastmod>#{lastmod}</lastmod>\n" if lastmod && !lastmod.to_s.empty?
      Array(alternates).each do |alt|
        entry << %(  <xhtml:link rel="alternate" hreflang="#{alt['hreflang']}" href="#{alt['href']}"/>\n)
      end
      entry << "  <changefreq>daily</changefreq>\n"
      entry << "  <priority>0.7</priority>\n"
      entry << "</url>\n"
      entry
    end

    def render_sub_sitemap_xml(url_entries)
      entries = url_entries.map do |entry|
        if entry.is_a?(Hash)
          render_url_entry(entry['loc'], entry['lastmod'], entry['alternates'])
        else
          render_url_entry(entry)
        end
      end.join
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
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
