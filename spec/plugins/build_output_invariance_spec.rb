# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 6: Build output invariance
# **Validates: Requirements 8.1, 8.2, 8.3**

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe 'Build output invariance — Property 6' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:api_cache_dir) { File.join(tmpdir, '_data', '.api_cache') }
  let(:tile_cache_dir) { File.join(tmpdir, '_data', '.tile_cache') }
  let(:site_pages) { [] }
  let(:site_data) { {} }
  let(:site_config) { { 'default_lang' => 'de', 'lang' => 'de' } }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(source_dir)
    allow(s).to receive(:pages).and_return(site_pages)
    allow(s).to receive(:data).and_return(site_data)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:dest).and_return(File.join(tmpdir, '_site'))
    allow(s).to receive(:layouts).and_return({})
    allow(s).to receive(:converters).and_return([])
    allow(s).to receive(:in_theme_dir) { |*args| args.compact.first }
    allow(s).to receive(:in_source_dir) { |*args| File.join(source_dir, *args.compact) }
    allow(s).to receive(:in_dest_dir) { |*args| File.join(tmpdir, '_site', *args.compact) }
    allow(s).to receive(:theme).and_return(nil)
    allow(s).to receive(:frontmatter_defaults).and_return(
      double('FrontmatterDefaults').tap do |fd|
        allow(fd).to receive(:all).and_return({})
        allow(fd).to receive(:find).and_return(nil)
      end
    )
    s
  end

  before do
    FileUtils.mkdir_p(File.join(tmpdir, '_data'))
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Switzerland bounds from TileGenerator
  SWISS_NORTH = 47.8
  SWISS_SOUTH = 45.8
  SWISS_EAST  = 10.5
  SWISS_WEST  = 5.9

  # Snapshot all pages as { "dir/filename" => content }
  def snapshot_pages(pages)
    result = {}
    pages.each do |page|
      raw_dir = page.instance_variable_get(:@dir).to_s.sub(%r{^/}, '').sub(%r{/$}, '')
      key = raw_dir.empty? ? page.name : "#{raw_dir}/#{page.name}"
      result[key] = page.content
    end
    result
  end

  # Property 6: For any valid Contentful dataset, the set of files written to
  # _site/ and their byte contents must be identical whether generators ran fresh
  # or served from cache. No files may be added, removed, renamed, or have their
  # content altered by the caching mechanism.
  #
  # Test approach:
  # 1. Generate random data for both ApiGenerator and TileGenerator
  # 2. Phase 1 (fresh): contentful_data_changed=true, run both generators, snapshot pages
  # 3. Phase 2 (cached): clear pages, contentful_data_changed=false, run both generators, snapshot pages
  # 4. Assert: identical page sets with byte-identical content
  it 'produces byte-identical pages whether generators run fresh or from cache' do
    api_gen = Jekyll::ApiGenerator.new
    tile_gen = Jekyll::TileGenerator.new

    property_of {
      locale = 'de'

      # Generate random spots (1-4 entries with location data for tiles)
      num_spots = range(1, 4)
      spots = Array.new(num_spots) do |i|
        lat = SWISS_SOUTH + range(100, 1900) / 1000.0
        lon = SWISS_WEST + range(100, 4400) / 1000.0
        {
          'slug' => "spot-#{i}-#{sized(range(3, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 12)) { string(:alpha) },
          'locale' => locale,
          'location' => { 'lat' => lat.round(6), 'lon' => lon.round(6) },
          'spotType_slug' => choose('nur-einstieg', 'nur-ausstieg', 'einstieg-ausstieg'),
          'confirmed' => choose(true, false),
          'rejected' => false,
          'country' => 'CH',
          'createdAt' => "2025-01-#{format('%02d', range(1, 28))}T10:00:00Z",
          'updatedAt' => "2025-06-#{format('%02d', range(1, 28))}T10:00:00Z"
        }
      end

      # Generate random obstacles (0-2 entries with geometry for tiles)
      num_obstacles = range(0, 2)
      obstacles = Array.new(num_obstacles) do |i|
        lat = SWISS_SOUTH + range(100, 1900) / 1000.0
        lon = SWISS_WEST + range(100, 4400) / 1000.0
        {
          'slug' => "obstacle-#{i}-#{sized(range(3, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 12)) { string(:alpha) },
          'locale' => locale,
          'geometry' => JSON.generate({ 'type' => 'Point', 'coordinates' => [lon.round(6), lat.round(6)] }),
          'createdAt' => "2025-02-#{format('%02d', range(1, 28))}T10:00:00Z",
          'updatedAt' => "2025-05-#{format('%02d', range(1, 28))}T10:00:00Z"
        }
      end

      # Generate random notices (0-2 entries with location for tiles)
      num_notices = range(0, 2)
      notices = Array.new(num_notices) do |i|
        lat = SWISS_SOUTH + range(100, 1900) / 1000.0
        lon = SWISS_WEST + range(100, 4400) / 1000.0
        {
          'slug' => "notice-#{i}-#{sized(range(3, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 12)) { string(:alpha) },
          'locale' => locale,
          'location' => { 'lat' => lat.round(6), 'lon' => lon.round(6) },
          'startDate' => '2025-01-01',
          'endDate' => '2025-12-31',
          'createdAt' => "2025-03-#{format('%02d', range(1, 28))}T10:00:00Z",
          'updatedAt' => "2025-04-#{format('%02d', range(1, 28))}T10:00:00Z"
        }
      end

      # Generate random protected_areas (0-2 entries with geometry for tiles)
      num_protected = range(0, 2)
      protected_areas = Array.new(num_protected) do |i|
        lat = SWISS_SOUTH + range(100, 1900) / 1000.0
        lon = SWISS_WEST + range(100, 4400) / 1000.0
        {
          'slug' => "protected-#{i}-#{sized(range(3, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 12)) { string(:alpha) },
          'locale' => locale,
          'geometry' => JSON.generate({ 'type' => 'Point', 'coordinates' => [lon.round(6), lat.round(6)] }),
          'createdAt' => "2025-01-#{format('%02d', range(1, 28))}T10:00:00Z",
          'updatedAt' => "2025-03-#{format('%02d', range(1, 28))}T10:00:00Z"
        }
      end

      # Generate random waterways (0-2 entries — API only, no tile location needed)
      num_waterways = range(0, 2)
      waterways = Array.new(num_waterways) do |i|
        {
          'slug' => "waterway-#{i}-#{sized(range(3, 8)) { string(:alpha) }.downcase}",
          'name' => sized(range(3, 12)) { string(:alpha) },
          'locale' => locale,
          'createdAt' => "2025-01-#{format('%02d', range(1, 28))}T10:00:00Z",
          'updatedAt' => "2025-02-#{format('%02d', range(1, 28))}T10:00:00Z"
        }
      end

      # Generate minimal dimension type data (1 entry each)
      dim_types = {}
      %w[types/spot_types types/obstacle_types types/paddle_craft_types
         types/paddling_environment_types types/protected_area_types
         types/data_source_types types/data_license_types].each do |key|
        type_name = key.split('/').last
        dim_types[type_name] = [
          {
            'slug' => "#{type_name}-#{sized(range(2, 6)) { string(:alpha) }.downcase}",
            'name' => sized(range(3, 10)) { string(:alpha) },
            'locale' => locale,
            'createdAt' => '2025-01-01T10:00:00Z',
            'updatedAt' => '2025-01-01T10:00:00Z'
          }
        ]
      end

      [spots, obstacles, notices, protected_areas, waterways, dim_types]
    }.check(100) { |spots, obstacles, notices, protected_areas, waterways, dim_types|
      # Clean state between iterations
      FileUtils.rm_rf(api_cache_dir)
      FileUtils.rm_rf(tile_cache_dir)
      FileUtils.mkdir_p(File.join(tmpdir, '_data'))
      site_pages.clear
      site_data.clear

      # Deep-dup helper
      deep_dup = ->(arr) { arr.map { |h| h.transform_values { |v| v.is_a?(Hash) ? v.dup : v.is_a?(Array) ? v.dup : v } } }

      # Build site data with dimension types nested under 'types/'
      build_data = lambda do
        d = {
          'spots' => deep_dup.call(spots),
          'obstacles' => deep_dup.call(obstacles),
          'notices' => deep_dup.call(notices),
          'protected_areas' => deep_dup.call(protected_areas),
          'waterways' => deep_dup.call(waterways),
          'types' => {}
        }
        dim_types.each do |type_name, entries|
          d['types'][type_name] = deep_dup.call(entries)
        end
        d
      end

      # --- Phase 1: Fresh generation (contentful_data_changed = true) ---
      site_data.replace(build_data.call)
      site_config['contentful_data_changed'] = true

      api_gen.generate(site)
      tile_gen.generate(site)

      fresh_snapshot = snapshot_pages(site_pages)

      # --- Phase 2: Cached generation (contentful_data_changed = false) ---
      site_pages.clear
      site_data.replace(build_data.call)
      site_config['contentful_data_changed'] = false

      api_gen.generate(site)
      tile_gen.generate(site)

      cached_snapshot = snapshot_pages(site_pages)

      # --- Assertions ---
      # Same set of page paths (no files added, removed, or renamed)
      expect(cached_snapshot.keys.sort).to eq(fresh_snapshot.keys.sort),
        "Page paths differ:\n  fresh only: #{(fresh_snapshot.keys - cached_snapshot.keys).sort}\n  cached only: #{(cached_snapshot.keys - fresh_snapshot.keys).sort}"

      # Byte-identical content for every page
      fresh_snapshot.each do |path, fresh_content|
        cached_content = cached_snapshot[path]
        expect(cached_content).to eq(fresh_content),
          "Content mismatch for #{path}:\n  fresh bytes=#{fresh_content.bytesize}\n  cached bytes=#{cached_content&.bytesize}"
      end
    }
  end
end
