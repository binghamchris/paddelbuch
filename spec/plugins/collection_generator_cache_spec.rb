# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 7: CollectionGenerator independence
# **Validates: Requirements 9.1**

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe Jekyll::CollectionGenerator, '#independence — Property 7: CollectionGenerator independence' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }

  before do
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Build a minimal site double with the given config and data.
  # Each collection gets a fresh docs array so we can compare across runs.
  def build_site(source, config, data)
    collections = {}
    Jekyll::CollectionGenerator::COLLECTIONS.each_key do |name|
      col = double("collection_#{name}")
      allow(col).to receive(:label).and_return(name)
      allow(col).to receive(:relative_directory).and_return("_#{name}")
      allow(col).to receive(:docs).and_return([])
      collections[name] = col
    end

    frontmatter_defaults = double('FrontmatterDefaults')
    allow(frontmatter_defaults).to receive(:find).and_return(nil)
    allow(frontmatter_defaults).to receive(:all).and_return({})

    site = double('Jekyll::Site')
    allow(site).to receive(:source).and_return(source)
    allow(site).to receive(:config).and_return(config)
    allow(site).to receive(:data).and_return(data)
    allow(site).to receive(:collections).and_return(collections)
    allow(site).to receive(:collections_path).and_return(source)
    allow(site).to receive(:frontmatter_defaults).and_return(frontmatter_defaults)

    [site, collections]
  end

  # Extract a comparable snapshot of documents from collections.
  # Returns { collection_name => [ { slug:, data: } , ... ] } sorted by slug.
  def snapshot_docs(collections)
    result = {}
    collections.each do |name, col|
      docs = col.docs.map do |doc|
        { slug: doc.data['slug'], data: doc.data.reject { |k, _| k == 'draft' }.dup }
      end
      result[name] = docs.sort_by { |d| d[:slug].to_s }
    end
    result
  end

  # Property 7: For any value of the change flag (true, false, or nil), the
  # CollectionGenerator must execute and produce the same set of Jekyll Document
  # objects. The CollectionGenerator does NOT reference the change flag at all.
  #
  # Test approach:
  # 1. Generate random site data (spots, waterways, obstacles, notices, static_pages)
  # 2. Pick two different random flag values from [true, false, nil]
  # 3. Run CollectionGenerator with flag_a, snapshot the documents
  # 4. Run CollectionGenerator with flag_b, snapshot the documents
  # 5. Assert identical document sets (same slugs, same data, same collections)
  it 'produces identical documents regardless of the change flag value' do
    property_of {
      locale = 'de'

      # Generate random spots (0-5 entries)
      num_spots = range(0, 5)
      spots = Array.new(num_spots) do |i|
        {
          'slug' => "spot-#{i}-#{sized(range(2, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 15)) { string(:alpha) },
          'locale' => locale,
          'spotType_slug' => choose('nur-einstieg', 'nur-ausstieg', 'einstieg-ausstieg', 'rastplatz'),
          'location' => { 'lat' => 45.8 + range(0, 2000) / 1000.0, 'lon' => 5.9 + range(0, 4600) / 1000.0 }
        }
      end

      # Generate random waterways (0-3 entries)
      num_waterways = range(0, 3)
      waterways = Array.new(num_waterways) do |i|
        {
          'slug' => "waterway-#{i}-#{sized(range(2, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 15)) { string(:alpha) },
          'locale' => locale
        }
      end

      # Generate random obstacles (0-3 entries)
      num_obstacles = range(0, 3)
      obstacles = Array.new(num_obstacles) do |i|
        slug = "obstacle-#{i}-#{sized(range(2, 6)) { string(:alpha) }.downcase}"
        obs = {
          'slug' => slug,
          'name' => sized(range(3, 15)) { string(:alpha) },
          'locale' => locale,
          'spots' => []
        }
        # Optionally add geometry
        if choose(true, false)
          lon = 5.9 + range(0, 4600) / 1000.0
          lat = 45.8 + range(0, 2000) / 1000.0
          obs['geometry'] = JSON.generate({
            'type' => 'Point',
            'coordinates' => [lon, lat]
          })
        end
        obs
      end

      # Generate random notices (0-3 entries)
      num_notices = range(0, 3)
      notices = Array.new(num_notices) do |i|
        {
          'slug' => "notice-#{i}-#{sized(range(2, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 15)) { string(:alpha) },
          'locale' => locale
        }
      end

      # Generate random static_pages (0-2 entries)
      num_static = range(0, 2)
      static_pages = Array.new(num_static) do |i|
        {
          'slug' => "page-#{i}-#{sized(range(2, 8)) { string(:alpha) }.downcase}",
          'title' => sized(range(3, 15)) { string(:alpha) },
          'locale' => locale,
          'menu_slug' => sized(range(2, 6)) { string(:alpha) }.downcase
        }
      end

      # Pick two different flag values
      all_flags = [true, false, nil]
      flag_a = choose(*all_flags)
      flag_b = choose(*(all_flags - [flag_a]))

      [spots, waterways, obstacles, notices, static_pages, flag_a, flag_b]
    }.check(100) { |spots, waterways, obstacles, notices, static_pages, flag_a, flag_b|
      # Deep-dup helper for data arrays
      deep_dup = ->(arr) { arr.map { |h| h.transform_values { |v| v.is_a?(Hash) ? v.dup : v.is_a?(Array) ? v.dup : v } } }

      # --- Run 1: with flag_a ---
      data_a = {
        'spots' => deep_dup.call(spots),
        'waterways' => deep_dup.call(waterways),
        'obstacles' => deep_dup.call(obstacles),
        'notices' => deep_dup.call(notices),
        'static_pages' => deep_dup.call(static_pages)
      }
      config_a = { 'lang' => 'de', 'default_lang' => 'de', 'contentful_data_changed' => flag_a }
      site_a, collections_a = build_site(source_dir, config_a, data_a)

      described_class.new.generate(site_a)
      snap_a = snapshot_docs(collections_a)

      # --- Run 2: with flag_b ---
      data_b = {
        'spots' => deep_dup.call(spots),
        'waterways' => deep_dup.call(waterways),
        'obstacles' => deep_dup.call(obstacles),
        'notices' => deep_dup.call(notices),
        'static_pages' => deep_dup.call(static_pages)
      }
      config_b = { 'lang' => 'de', 'default_lang' => 'de', 'contentful_data_changed' => flag_b }
      site_b, collections_b = build_site(source_dir, config_b, data_b)

      described_class.new.generate(site_b)
      snap_b = snapshot_docs(collections_b)

      # --- Assertions ---
      # Same collection names
      expect(snap_a.keys.sort).to eq(snap_b.keys.sort),
        "Collection names differ: flag=#{flag_a} has #{snap_a.keys.sort}, flag=#{flag_b} has #{snap_b.keys.sort}"

      # Same documents per collection
      snap_a.each do |col_name, docs_a|
        docs_b = snap_b[col_name]
        expect(docs_a.size).to eq(docs_b.size),
          "Document count differs for '#{col_name}': flag=#{flag_a} has #{docs_a.size}, flag=#{flag_b} has #{docs_b.size}"

        slugs_a = docs_a.map { |d| d[:slug] }
        slugs_b = docs_b.map { |d| d[:slug] }
        expect(slugs_a).to eq(slugs_b),
          "Slugs differ for '#{col_name}': flag=#{flag_a} => #{slugs_a}, flag=#{flag_b} => #{slugs_b}"

        docs_a.zip(docs_b).each do |da, db|
          expect(da[:data]).to eq(db[:data]),
            "Data differs for '#{col_name}' slug='#{da[:slug]}' between flag=#{flag_a} and flag=#{flag_b}"
        end
      end
    }
  end
end
