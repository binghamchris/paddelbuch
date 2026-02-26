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
end
