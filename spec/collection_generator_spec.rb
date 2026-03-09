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
        doc = generator.send(:create_document, site, collection, entry, 'test-spot', 'spot-details')

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
        doc = generator.send(:create_document, site, collection, entry, 'datenlizenzen', 'static-page')

        # We expect the title to be 'Datenlizenzen' (from the entry),
        # but the bug causes it to be overwritten with the slug 'datenlizenzen'
        # because entry['name'] is nil.
        expect(doc.data['title']).to eq('Datenlizenzen')
      end
    end

    it 'preserves title for static page entry without name field' do
      Dir.mktmpdir do |tmpdir|
        site = build_site(tmpdir)
        collection = build_collection(site)
        entry = { 'slug' => 'projekt', 'title' => 'Das Projekt', 'menu_slug' => 'ueber', 'locale' => 'de' }
        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'projekt', 'static-page')
        expect(doc.data['title']).to eq('Das Projekt')
      end
    end

    it 'falls back to slug when entry has neither name nor title' do
      Dir.mktmpdir do |tmpdir|
        site, collection = build_site_with_collection(tmpdir, 'spots')
        entry = { 'slug' => 'unknown-spot', 'locale' => 'de' }
        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'unknown-spot', 'spot-details')
        expect(doc.data['title']).to eq('unknown-spot')
      end
    end

    it 'generates permalink from menu_slug and slug for static pages' do
      Dir.mktmpdir do |tmpdir|
        site = build_site(tmpdir)
        collection = build_collection(site)
        entry = { 'slug' => 'datenlizenzen', 'title' => 'Datenlizenzen', 'menu_slug' => 'offene-daten', 'locale' => 'de' }
        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'datenlizenzen', 'static-page')
        expect(doc.data['permalink']).to eq('/offene-daten/datenlizenzen/')
      end
    end

    it 'does not set permalink when menu_slug is missing' do
      Dir.mktmpdir do |tmpdir|
        site = build_site(tmpdir)
        collection = build_collection(site)
        entry = { 'slug' => 'orphan-page', 'title' => 'Orphan', 'locale' => 'de' }
        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, entry, 'orphan-page', 'static-page')
        expect(doc.data['permalink']).to be_nil
      end
    end
  end

  # **Validates: Requirements 2.2**
  # Property 2 — For any static page entry with a `title` field, `create_document`
  # SHALL set `data['title']` to the entry's title, not the slug.
  describe '#create_document title logic (PBT)' do
    it 'correctly resolves title for random combinations of name/title/neither across collection types' do
      property_of {
        Rantly {
          collection_type = choose('static_pages', 'spots', 'waterways', 'obstacles', 'notices')
          has_name = choose(true, false)
          has_title = choose(true, false)
          slug = sized(range(3, 15)) { string(:alpha) }.downcase
          name_val = has_name ? sized(range(3, 20)) { string(:alpha) } : nil
          title_val = has_title ? sized(range(3, 20)) { string(:alpha) } : nil

          {
            collection_type: collection_type,
            slug: slug,
            name_val: name_val,
            title_val: title_val
          }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          config = Jekyll.configuration(
            'source' => tmpdir,
            'destination' => File.join(tmpdir, '_site'),
            'collections' => { data[:collection_type] => { 'output' => true } }
          )
          site = Jekyll::Site.new(config)
          collection = site.collections[data[:collection_type]]
          FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))

          entry = { 'slug' => data[:slug], 'locale' => 'de' }
          entry['name'] = data[:name_val] if data[:name_val]
          entry['title'] = data[:title_val] if data[:title_val]
          entry['menu_slug'] = 'test-menu' if data[:collection_type] == 'static_pages'

          # Map collection type to page_name
          page_names = {
            'spots' => 'spot-details',
            'waterways' => 'waterway-details',
            'obstacles' => 'obstacle-details',
            'notices' => 'notice-details',
            'static_pages' => 'static-page'
          }
          page_name = page_names[data[:collection_type]] || 'details'

          generator = Jekyll::CollectionGenerator.new
          doc = generator.send(:create_document, site, collection, entry, data[:slug], page_name)

          # The expected title logic: name || title || slug
          expected_title = data[:name_val] || data[:title_val] || data[:slug]
          expect(doc.data['title']).to eq(expected_title),
            "For collection=#{data[:collection_type]}, name=#{data[:name_val].inspect}, title=#{data[:title_val].inspect}, slug=#{data[:slug]}: expected title=#{expected_title.inspect}, got=#{doc.data['title'].inspect}"
        end
      }
    end
  end
end

