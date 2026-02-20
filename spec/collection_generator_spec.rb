# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe Jekyll::CollectionGenerator do
  # --- Test helpers ---

  # Creates a minimal Jekyll site with a static_pages collection in a temp directory
  def build_site(tmpdir)
    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'collections' => { 'static_pages' => { 'output' => true } }
    )
    Jekyll::Site.new(config)
  end

  # Returns the static_pages collection from the site, creating its directory on disk
  def build_collection(site)
    collection = site.collections['static_pages']
    FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))
    collection
  end

  # Creates a minimal Jekyll site with a given collection
  def build_site_with_collection(tmpdir, collection_name)
    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'collections' => { collection_name => { 'output' => true } }
    )
    site = Jekyll::Site.new(config)
    collection = site.collections[collection_name]
    FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))
    [site, collection]
  end

  describe '#create_document title handling' do
    it 'sets title from entry name for spots collection' do
      Dir.mktmpdir do |tmpdir|
        site, collection = build_site_with_collection(tmpdir, 'spots')

        entry = {
          'name' => 'Test Spot',
          'slug' => 'test-spot',
          'locale' => 'de'
        }

        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'test-spot')

        expect(doc.data['title']).to eq('Test Spot')
      end
    end

    it 'BUG EXPLORATION: overwrites title with slug when entry has title but no name' do
      Dir.mktmpdir do |tmpdir|
        site = build_site(tmpdir)
        collection = build_collection(site)

        entry = {
          'slug' => 'datenlizenzen',
          'title' => 'Datenlizenzen',
          'menu' => 'Offene Daten',
          'menu_slug' => 'offene-daten',
          'content' => '<p>Some content</p>',
          'menuOrder' => 1,
          'locale' => 'de'
        }

        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'datenlizenzen')

        # We expect the title to be 'Datenlizenzen' (from the entry),
        # but the bug causes it to be overwritten with the slug 'datenlizenzen'
        # because entry['name'] is nil.
        expect(doc.data['title']).to eq('Datenlizenzen')
      end
    end
  end
end
