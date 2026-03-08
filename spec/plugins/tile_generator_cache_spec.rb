# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 5: Tile generator cache round-trip
# **Validates: Requirements 4.1, 4.2, 4.4**

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe Jekyll::TileGenerator, '#cache_round_trip — Property 5: Tile generator cache round-trip' do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:cache_dir) { File.join(tmpdir, '_data', '.tile_cache') }
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
    FileUtils.mkdir_p(cache_dir)
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Switzerland bounds from TileGenerator
  SWISS_NORTH = 47.8
  SWISS_SOUTH = 45.8
  SWISS_EAST  = 10.5
  SWISS_WEST  = 5.9

  # Property 5: For any valid site data with geolocated entries, generating tile
  # JSON fresh and writing to the cache, then loading from the cache on a
  # subsequent run, must produce PageWithoutAFile objects with byte-identical
  # content values and identical directory/filename paths.
  #
  # Test approach:
  # 1. Generate random tile data (arrays of hashes with slug, name, location within Switzerland bounds)
  # 2. Use add_json_page to create pages + write to cache (fresh generation)
  # 3. Record all page dir+filename and content
  # 4. Clear site.pages
  # 5. Call load_tile_from_cache to load from cache
  # 6. Compare: same dir/filename paths, same content byte-for-byte
  it 'produces byte-identical pages when loading from cache vs fresh generation' do
    property_of {
      # Generate unique layer/locale combinations, each with tile files
      num_dirs = range(1, 6)
      all_combos = %w[spots notices obstacles protected].product(%w[de en]).map { |l, loc| "api/tiles/#{l}/#{loc}" }
      # Pick num_dirs unique directories
      selected_dirs = all_combos.shuffle.first([num_dirs, all_combos.size].min)
      pages = []

      selected_dirs.each do |dir|
        # Extract layer name from dir path (e.g., "api/tiles/spots/de" -> "spots")
        layer = dir.split('/')[2]

        # Always generate an index file for this dir
        num_tiles_with_data = range(0, 3)
        # Ensure unique tile coordinates within this directory
        used_coords = {}
        tile_entries = []
        num_tiles_with_data.times do
          loop do
            x = range(0, 9)
            y = range(0, 7)
            key = "#{x}_#{y}"
            unless used_coords[key]
              used_coords[key] = true
              tile_entries << {
                'x' => x,
                'y' => y,
                'count' => range(1, 20),
                'bounds' => {
                  'north' => SWISS_NORTH - (y * 0.25),
                  'south' => SWISS_NORTH - ((y + 1) * 0.25),
                  'east'  => SWISS_WEST + ((x + 1) * 0.46),
                  'west'  => SWISS_WEST + (x * 0.46)
                }
              }
              break
            end
          end
        end

        index_data = {
          'layer' => layer,
          'gridSize' => { 'cols' => 10, 'rows' => 8 },
          'bounds' => {
            'north' => SWISS_NORTH, 'south' => SWISS_SOUTH,
            'east' => SWISS_EAST, 'west' => SWISS_WEST
          },
          'tileSize' => { 'lat' => 0.25, 'lon' => 0.46 },
          'tiles' => tile_entries.sort_by { |t| [t['x'], t['y']] }
        }
        pages << [dir, 'index.json', index_data]

        # Generate individual tile files with random geolocated data
        tile_entries.each_with_index do |entry, t|
          x = entry['x']
          y = entry['y']

          num_items = range(1, 5)
          items = Array.new(num_items) do
            # Generate random lat/lon within Switzerland bounds using integer ranges
            lat_offset = range(0, 2000) / 1000.0  # 0.0 to 2.0 (SWISS_NORTH - SWISS_SOUTH = 2.0)
            lon_offset = range(0, 4600) / 1000.0   # 0.0 to 4.6 (SWISS_EAST - SWISS_WEST = 4.6)
            lat = (SWISS_SOUTH + lat_offset).round(6)
            lon = (SWISS_WEST + lon_offset).round(6)
            {
              'slug' => sized(range(3, 15)) { string(:alpha) }.downcase,
              'name' => sized(range(3, 20)) { string(:alpha) },
              'location' => { 'lat' => lat, 'lon' => lon }
            }
          end

          tile_content = {
            'tile' => { 'x' => x, 'y' => y },
            'bounds' => entry['bounds'],
            'data' => items.sort_by { |item| item['slug'].to_s.downcase }
          }
          pages << [dir, "#{x}_#{y}.json", tile_content]
        end
      end

      pages
    }.check(100) { |pages|
      # Clean state between iterations
      FileUtils.rm_rf(cache_dir)
      FileUtils.mkdir_p(cache_dir)
      site_pages.clear

      # --- Phase 1: Fresh generation (write pages + cache) ---
      generator.instance_variable_set(:@site, site)
      generator.instance_variable_set(:@cache_dir, cache_dir)

      pages.each do |dir, filename, data|
        generator.send(:add_json_page, dir, filename, data)
      end

      generator.instance_variable_set(:@cache_dir, nil)

      # Record fresh pages: { "dir/filename" => content }
      fresh_pages = {}
      site_pages.each do |page|
        # Use @dir instance variable to avoid triggering Jekyll's URL resolution chain
        raw_dir = page.instance_variable_get(:@dir).to_s.sub(%r{^/}, '').sub(%r{/$}, '')
        key = raw_dir.empty? ? page.name : "#{raw_dir}/#{page.name}"
        fresh_pages[key] = page.content
      end

      # --- Phase 2: Load from cache ---
      site_pages.clear

      generator.send(:load_tile_from_cache, site, cache_dir)

      # Record cached pages: { "dir/filename" => content }
      cached_pages = {}
      site_pages.each do |page|
        raw_dir = page.instance_variable_get(:@dir).to_s.sub(%r{^/}, '').sub(%r{/$}, '')
        key = raw_dir.empty? ? page.name : "#{raw_dir}/#{page.name}"
        cached_pages[key] = page.content
      end

      # --- Assertions ---
      # Same set of directory/filename paths
      expect(cached_pages.keys.sort).to eq(fresh_pages.keys.sort),
        "Paths differ:\n  fresh=#{fresh_pages.keys.sort}\n  cached=#{cached_pages.keys.sort}"

      # Byte-identical content for each file
      fresh_pages.each do |path, fresh_content|
        cached_content = cached_pages[path]
        expect(cached_content).to eq(fresh_content),
          "Content mismatch for #{path}: fresh bytes=#{fresh_content.bytesize}, cached bytes=#{cached_content&.bytesize}"
      end
    }
  end
end


# Feature: conditional-build-regeneration, Property 9: Generator cache-hit logging (Tile)
# **Validates: Requirements 7.3, 7.4**

RSpec.describe Jekyll::TileGenerator, '#cache_hit_logging — Property 9: Generator cache-hit logging (Tile)' do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:cache_dir) { File.join(tmpdir, '_data', '.tile_cache') }
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

  # Helper: populate tile cache with N random JSON files in nested directories
  def populate_tile_cache(dir, files)
    FileUtils.rm_rf(dir)
    files.each do |relative_path, content|
      full_path = File.join(dir, relative_path)
      FileUtils.mkdir_p(File.dirname(full_path))
      File.write(full_path, content)
    end
  end

  # Property 9 (Tile part): For any cache-hit scenario, TileGenerator must emit an
  # info-level log message including the number of cached files loaded. For any
  # cache-miss or fresh-generation scenario, it must emit a message indicating
  # full generation.
  #
  # Scenarios tested per iteration:
  #   :fresh_generation — data_changed=true → "Generating spatial tile files"
  #   :cache_hit        — data_changed=false + cache populated → "Using cached tile files (N files loaded)"
  #   :cache_miss       — data_changed=false + empty/missing cache → "Cache empty/missing — performing full generation"
  it 'emits correct log messages for fresh generation, cache hit, and cache miss' do
    property_of {
      # Generate random tile JSON files for cache population
      layers = %w[spots notices obstacles protected]
      locales = %w[de en]
      num_files = range(1, 10)
      files = Array.new(num_files) do |i|
        layer = choose(*layers)
        locale = choose(*locales)
        filename = choose("index.json", "#{range(0, 9)}_#{range(0, 7)}.json")
        relative_path = "api/tiles/#{layer}/#{locale}/#{filename}"
        content = JSON.pretty_generate({
          'tile' => { 'x' => range(0, 9), 'y' => range(0, 7) },
          'data' => Array.new(range(0, 3)) {
            { 'slug' => sized(range(3, 10)) { string(:alpha) }.downcase,
              'name' => sized(range(3, 12)) { string(:alpha) } }
          }
        })
        [relative_path, content]
      end
      # Deduplicate by relative_path (keep last)
      files = files.reverse.uniq { |f| f[0] }.reverse

      scenario = choose(:fresh_generation, :cache_hit, :cache_miss)
      [files, scenario]
    }.check(100) { |files, scenario|
      # Clean state
      FileUtils.rm_rf(cache_dir)
      site_pages.clear
      site_data.clear

      # Reset logger mock so we can assert per-iteration
      RSpec::Mocks.space.proxy_for(Jekyll.logger).reset
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)

      case scenario
      when :fresh_generation
        # data_changed = true → full generation path
        site_config['contentful_data_changed'] = true

        # Provide empty arrays for layer data keys so generate doesn't error
        site_data['spots'] = []
        site_data['notices'] = []
        site_data['obstacles'] = []
        site_data['protected_areas'] = []

        generator.generate(site)

        expect(Jekyll.logger).to have_received(:info).with(
          'Tile Generator:', 'Generating spatial tile files'
        ), "Expected 'Generating spatial tile files' log for fresh generation scenario"

      when :cache_hit
        # data_changed = false + cache populated → cache hit path
        site_config['contentful_data_changed'] = false

        # Populate cache with the randomly generated tile files
        populate_tile_cache(cache_dir, files)

        generator.generate(site)

        expected_msg = "Using cached tile files (#{files.size} files loaded)"
        expect(Jekyll.logger).to have_received(:info).with('Tile Generator:', expected_msg),
          "Expected '#{expected_msg}' log for cache hit scenario with #{files.size} files"

      when :cache_miss
        # data_changed = false + empty/missing cache → cache miss path
        site_config['contentful_data_changed'] = false
        FileUtils.rm_rf(cache_dir)

        # Provide empty arrays for layer data keys so generate doesn't error
        site_data['spots'] = []
        site_data['notices'] = []
        site_data['obstacles'] = []
        site_data['protected_areas'] = []

        generator.generate(site)

        expect(Jekyll.logger).to have_received(:info).with(
          'Tile Generator:', 'Cache empty/missing — performing full generation'
        ), "Expected 'Cache empty/missing — performing full generation' log for cache miss scenario"
      end
    }
  end
end
