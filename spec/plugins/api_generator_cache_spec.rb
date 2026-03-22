# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 4: API generator cache round-trip
# **Validates: Requirements 3.1, 3.2, 3.4**

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe Jekyll::ApiGenerator, '#cache_round_trip — Property 4: API generator cache round-trip' do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:cache_dir) { File.join(tmpdir, '_data', '.api_cache') }
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
    allow(s).to receive(:frontmatter_defaults).and_return(double(all: {}))
    s
  end

  before do
    FileUtils.mkdir_p(cache_dir)
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Property 4: For any valid site data, generating API JSON fresh and writing
  # to cache, then loading from cache, must produce PageWithoutAFile objects
  # with byte-identical content values and identical filenames.
  #
  # Test approach:
  # 1. Generate random arrays of hashes (simulating API data)
  # 2. Use add_json_page to create pages + write to cache (fresh generation)
  # 3. Record all page filenames and content
  # 4. Clear site.pages
  # 5. Call load_api_from_cache to load from cache
  # 6. Compare: same filenames, same content byte-for-byte
  it 'produces byte-identical pages when loading from cache vs fresh generation' do
    property_of {
      # Generate 1-8 random "API files" with random JSON-serializable data
      num_files = range(1, 8)
      files = Array.new(num_files) do |i|
        # Each file has a unique name and random array-of-hashes data
        num_items = range(0, 5)
        items = Array.new(num_items) do
          {
            'slug' => sized(range(3, 15)) { string(:alpha) },
            'name' => sized(range(3, 20)) { string(:alpha) },
            'locale' => choose('de', 'en'),
            'updatedAt' => "20#{range(20, 25)}-#{format('%02d', range(1, 12))}-#{format('%02d', range(1, 28))}T#{format('%02d', range(0, 23))}:#{format('%02d', range(0, 59))}:#{format('%02d', range(0, 59))}Z",
            'createdAt' => "20#{range(20, 25)}-#{format('%02d', range(1, 12))}-#{format('%02d', range(1, 28))}T#{format('%02d', range(0, 23))}:#{format('%02d', range(0, 59))}:#{format('%02d', range(0, 59))}Z"
          }
        end
        filename = "test-#{i}-#{sized(range(2, 8)) { string(:alpha) }}.json"
        [filename, items]
      end

      # Optionally include a lastUpdateIndex.json to test that code path
      include_index = choose(true, false)

      [files, include_index]
    }.check(100) { |files, include_index|
      # Clean state between iterations
      FileUtils.rm_rf(cache_dir)
      FileUtils.mkdir_p(cache_dir)
      site_pages.clear
      site_data.clear

      # --- Phase 1: Fresh generation (write pages + cache) ---
      generator.instance_variable_set(:@site, site)
      generator.instance_variable_set(:@cache_dir, cache_dir)

      files.each do |filename, data|
        generator.send(:add_json_page, filename, data)
      end

      # Optionally add a lastUpdateIndex.json
      if include_index
        index_data = [{ 'table' => 'spots', 'lastUpdatedAt' => '2025-01-15T10:30:00Z' }]
        generator.send(:add_json_page, 'lastUpdateIndex.json', index_data)
      end

      generator.instance_variable_set(:@cache_dir, nil)

      # Record fresh pages: { filename => content }
      fresh_pages = {}
      site_pages.each do |page|
        fresh_pages[page.name] = page.content
      end

      # --- Phase 2: Load from cache ---
      site_pages.clear
      site_data.clear

      generator.send(:load_api_from_cache, site, cache_dir)

      # Record cached pages: { filename => content }
      cached_pages = {}
      site_pages.each do |page|
        cached_pages[page.name] = page.content
      end

      # --- Assertions ---
      # Same set of filenames
      expect(cached_pages.keys.sort).to eq(fresh_pages.keys.sort),
        "Filenames differ: fresh=#{fresh_pages.keys.sort}, cached=#{cached_pages.keys.sort}"

      # Byte-identical content for each file
      fresh_pages.each do |filename, fresh_content|
        cached_content = cached_pages[filename]
        expect(cached_content).to eq(fresh_content),
          "Content mismatch for #{filename}: fresh bytes=#{fresh_content.bytesize}, cached bytes=#{cached_content&.bytesize}"
      end
    }
  end
end


# Feature: conditional-build-regeneration, Property 9: Generator cache-hit logging (API)
# **Validates: Requirements 7.1, 7.2**

RSpec.describe Jekyll::ApiGenerator, '#cache_hit_logging — Property 9: Generator cache-hit logging (API)' do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:cache_dir) { File.join(tmpdir, '_data', '.api_cache') }
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
    allow(s).to receive(:frontmatter_defaults).and_return(double(all: {}))
    s
  end

  before do
    FileUtils.mkdir_p(File.join(tmpdir, '_data'))
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: populate cache_dir with N random JSON files and return the count
  def populate_cache(dir, files)
    FileUtils.rm_rf(dir)
    FileUtils.mkdir_p(dir)
    files.each do |filename, content|
      File.write(File.join(dir, filename), content)
    end
  end

  # Property 9 (API part): For any cache-hit scenario, ApiGenerator must emit an
  # info-level log message including the number of cached files loaded. For any
  # cache-miss or fresh-generation scenario, it must emit a message indicating
  # full generation.
  #
  # Scenarios tested per iteration:
  #   :fresh_generation — data_changed=true → "Generating JSON API files"
  #   :cache_hit        — data_changed=false + cache populated → "Using cached API files (N files loaded)"
  #   :cache_miss       — data_changed=false + empty/missing cache → "Cache empty/missing — performing full generation"
  it 'emits correct log messages for fresh generation, cache hit, and cache miss' do
    property_of {
      # Generate random JSON file data inside the Rantly block
      num_files = range(1, 8)
      files = Array.new(num_files) do |i|
        items = Array.new(range(0, 4)) do
          { 'slug' => sized(range(3, 10)) { string(:alpha) },
            'name' => sized(range(3, 12)) { string(:alpha) } }
        end
        filename = "test-#{i}-#{sized(range(2, 6)) { string(:alpha) }}.json"
        [filename, JSON.generate(items)]
      end
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
        FileUtils.mkdir_p(cache_dir)

        generator.generate(site)

        expect(Jekyll.logger).to have_received(:info).with('API Generator:', 'Generating JSON API files'),
          "Expected 'Generating JSON API files' log for fresh generation scenario"

      when :cache_hit
        # data_changed = false + cache populated → cache hit path
        site_config['contentful_data_changed'] = false

        # Populate cache with the randomly generated files
        populate_cache(cache_dir, files)

        generator.generate(site)

        expected_msg = "Using cached API files (#{files.size} files loaded)"
        expect(Jekyll.logger).to have_received(:info).with('API Generator:', expected_msg),
          "Expected '#{expected_msg}' log for cache hit scenario with #{files.size} files"

      when :cache_miss
        # data_changed = false + empty/missing cache → cache miss path
        site_config['contentful_data_changed'] = false
        # Ensure cache dir is empty or missing
        FileUtils.rm_rf(cache_dir)

        generator.generate(site)

        expect(Jekyll.logger).to have_received(:info).with(
          'API Generator:', 'Cache empty/missing -- performing full generation'
        ), "Expected 'Cache empty/missing -- performing full generation' log for cache miss scenario"
      end
    }
  end
end


# Unit tests for ApiGenerator caching
# Requirements: 3.1, 3.2, 3.3, 3.4, 5.1

RSpec.describe Jekyll::ApiGenerator, 'caching unit tests' do
  let(:generator) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:source_dir) { tmpdir }
  let(:cache_dir) { File.join(tmpdir, '_data', '.api_cache') }
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
    allow(s).to receive(:frontmatter_defaults).and_return(double(all: {}))
    s
  end

  before do
    FileUtils.mkdir_p(File.join(tmpdir, '_data'))
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Requirement 5.1: Cache directory is _data/.api_cache/
  describe 'cache directory path' do
    it 'uses _data/.api_cache/ as the cache directory' do
      site_config['contentful_data_changed'] = true
      generator.generate(site)

      expect(Dir.exist?(cache_dir)).to be true
    end
  end

  # Requirements 3.2, 3.4: lastUpdateIndex.json is correctly reconstructed from cache
  describe 'lastUpdateIndex.json reconstruction from cache' do
    it 'reconstructs site.data["last_updates"] from cached lastUpdateIndex.json' do
      index_data = [
        { 'table' => 'spots', 'lastUpdatedAt' => '2025-01-15T10:30:00Z' },
        { 'table' => 'obstacles', 'lastUpdatedAt' => '2025-02-20T08:00:00Z' },
        { 'table' => 'waterways', 'lastUpdatedAt' => '2025-03-10T14:45:00Z' }
      ]

      # Populate cache with lastUpdateIndex.json and a regular file
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'lastUpdateIndex.json'), JSON.generate(index_data))
      File.write(File.join(cache_dir, 'spots-de.json'), JSON.generate([{ 'slug' => 'test' }]))

      site_config['contentful_data_changed'] = false
      generator.generate(site)

      expected_updates = {
        'spots' => '2025-01-15T10:30:00Z',
        'obstacles' => '2025-02-20T08:00:00Z',
        'waterways' => '2025-03-10T14:45:00Z'
      }
      expect(site_data['last_updates']).to eq(expected_updates)
    end
  end

  # Requirement 3.3: Cache miss (empty directory) falls back to full generation
  describe 'cache miss fallback' do
    it 'falls back to full generation when cache directory is empty' do
      site_config['contentful_data_changed'] = false
      FileUtils.mkdir_p(cache_dir)
      # cache_dir exists but has no JSON files

      generator.generate(site)

      expect(Jekyll.logger).to have_received(:info).with(
        'API Generator:', 'Cache empty/missing -- performing full generation'
      )
    end

    it 'falls back to full generation when cache directory is missing' do
      site_config['contentful_data_changed'] = false
      FileUtils.rm_rf(cache_dir)

      generator.generate(site)

      expect(Jekyll.logger).to have_received(:info).with(
        'API Generator:', 'Cache empty/missing -- performing full generation'
      )
    end
  end

  # Requirements 3.3, 3.4: Corrupted cache file falls back to full generation
  describe 'corrupted cache fallback' do
    it 'falls back to full generation when lastUpdateIndex.json contains invalid JSON' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'lastUpdateIndex.json'), '{{not valid json}}')
      File.write(File.join(cache_dir, 'spots-de.json'), JSON.generate([{ 'slug' => 'ok' }]))

      site_config['contentful_data_changed'] = false
      generator.generate(site)

      expect(Jekyll.logger).to have_received(:warn).with(
        'API Generator:', a_string_matching(/Corrupted cache file.*falling back to full generation/)
      )
    end
  end

  # Requirements 3.2, 3.4: cached_last_updates is set correctly from cache
  describe 'cached_last_updates from cache' do
    it 'sets cached_last_updates from cached lastUpdateIndex.json' do
      index_data = [
        { 'table' => 'spotTypes', 'lastUpdatedAt' => '2025-06-01T12:00:00Z' },
        { 'table' => 'obstacleTypes', 'lastUpdatedAt' => '2025-06-02T09:30:00Z' }
      ]

      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'lastUpdateIndex.json'), JSON.generate(index_data))
      File.write(File.join(cache_dir, 'spottypes-de.json'), JSON.generate([]))

      site_config['contentful_data_changed'] = false
      generator.generate(site)

      cached = described_class.cached_last_updates
      expect(cached).to eq({
        'spotTypes' => '2025-06-01T12:00:00Z',
        'obstacleTypes' => '2025-06-02T09:30:00Z'
      })
    end
  end
end
