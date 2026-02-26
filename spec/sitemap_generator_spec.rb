# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe Jekyll::SitemapGenerator do
  # --- Test helpers ---

  # Creates a minimal Jekyll site with all 5 collections and bilingual config.
  # Accepts config_overrides to customize any config value.
  def build_site(tmpdir, config_overrides = {})
    default_config = {
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'url' => 'https://www.paddelbuch.ch',
      'languages' => %w[de en],
      'default_lang' => 'de',
      'exclude_from_localizations' => %w[assets api],
      'collections' => {
        'spots' => { 'output' => true, 'permalink' => '/einstiegsorte/:slug/' },
        'waterways' => { 'output' => true, 'permalink' => '/gewaesser/:slug/' },
        'obstacles' => { 'output' => true, 'permalink' => '/hindernisse/:slug/' },
        'notices' => { 'output' => true, 'permalink' => '/gewaesserereignisse/:slug/' },
        'static_pages' => { 'output' => true, 'permalink' => '/:slug/' }
      }
    }

    merged = default_config.merge(config_overrides)
    config = Jekyll.configuration(merged)
    site = Jekyll::Site.new(config)
    FileUtils.mkdir_p(site.dest)
    site
  end

  # Adds a virtual Jekyll::Document to the given collection with the specified slug.
  # Returns the created document.
  def add_collection_doc(site, collection_name, slug)
    collection = site.collections[collection_name]
    raise "Collection '#{collection_name}' not found" unless collection

    FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))

    doc_path = File.join(site.source, collection.relative_directory, "#{slug}.md")
    FileUtils.touch(doc_path)

    doc = Jekyll::Document.new(doc_path, site: site, collection: collection)
    doc.data['slug'] = slug
    doc.data['title'] = slug
    collection.docs << doc
    doc
  end

  # Creates a mock Jekyll page with the given name, url, and front matter data.
  # Responds to .name, .url, .data, and .html? (true for .html files).
  def add_page(site, name, url, data = {})
    page = instance_double(Jekyll::Page)
    allow(page).to receive(:name).and_return(name)
    allow(page).to receive(:url).and_return(url)
    allow(page).to receive(:data).and_return(data)
    allow(page).to receive(:html?).and_return(name.end_with?('.html'))
    site.pages << page
    page
  end

  # Returns a fresh SitemapGenerator instance.
  def generator
    Jekyll::SitemapGenerator.new
  end

  # Feature: sitemap-generation, Property 1: URL entry rendering contains required metadata
  describe '#render_url_entry (PBT)' do
    # **Validates: Requirements 2.3, 2.4, 2.5**
    it 'contains <loc>, <changefreq>daily</changefreq>, and <priority>0.7</priority> for any URL' do
      property_of {
        Rantly {
          segments = range(1, 5).times.map { sized(range(1, 12)) { string(:alpha).downcase } }
          "https://www.paddelbuch.ch/#{segments.join('/')}/"
        }
      }.check(100) do |url|
        xml = generator.render_url_entry(url)
        expect(xml).to include("<loc>#{url}</loc>")
        expect(xml).to include('<changefreq>daily</changefreq>')
        expect(xml).to include('<priority>0.7</priority>')
      end
    end
  end

  # Feature: sitemap-generation, Property 2: All collection documents are included
  describe '#collection_urls (PBT)' do
    # **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    it 'includes URLs for all documents across all five collections' do
      collection_names = %w[spots waterways obstacles notices static_pages]

      property_of {
        Rantly {
          # Generate a hash mapping each collection to a list of random slugs (1-5 docs each)
          docs = {}
          collection_names.each do |name|
            count = range(1, 5)
            slugs = count.times.map { sized(range(3, 12)) { string(:alpha).downcase } }
            docs[name] = slugs
          end
          docs
        }
      }.check(100) do |docs_by_collection|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir)

          # Add random documents to each collection and track their URLs
          expected_urls = []
          docs_by_collection.each do |collection_name, slugs|
            slugs.each do |slug|
              doc = add_collection_doc(site, collection_name, slug)
              expected_urls << doc.url
            end
          end

          # Run collection_urls and verify every document URL is present
          result = generator.collection_urls(site)
          expected_urls.each do |url|
            expect(result).to include(url),
              "Expected collection_urls to include '#{url}' but it was missing. Result: #{result.inspect}"
          end
        end
      end
    end
  end
end
