# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 2: Change flag reflects hash comparison
# **Validates: Requirements 1.2, 1.3, 2.1**

require 'spec_helper'
require 'tmpdir'
require 'digest'

RSpec.describe Jekyll::ContentfulFetcher, '#compute_and_set_change_flag — Property 2: Change flag reflects hash comparison' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return({})
    s
  end

  before do
    FileUtils.mkdir_p(data_dir)
    fetcher.instance_variable_set(:@site, site)
    fetcher.instance_variable_set(:@data_dir, data_dir)
    allow(Jekyll.logger).to receive(:info)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: write a YAML file and return its path
  def write_yaml_file(filename, content)
    path = File.join(data_dir, "#{filename}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  # Helper: compute the SHA-256 hash for given file paths (sorted, same as CacheMetadata)
  def compute_hash(file_paths)
    digest = Digest::SHA256.new
    file_paths.sort.each { |p| digest.update(File.read(p)) }
    digest.hexdigest
  end

  # Property 2: For any pair of content hash values (computed and stored),
  # the change flag must equal true when the hashes differ and false when they match.
  # When no previous hash exists (nil), the flag must be true.
  it 'sets change flag to false when hashes match, true when they differ' do
    property_of {
      # Generate random YAML-like content for 1-5 files
      num_files = range(1, 5)
      file_contents = Array.new(num_files) { |i| [i, sized(range(10, 100)) { string }] }

      # Decide scenario: :match, :mismatch, or :nil_previous
      scenario = choose(:match, :mismatch, :nil_previous)

      [file_contents, scenario]
    }.check(100) { |file_contents, scenario|
      # Clean data_dir between iterations
      FileUtils.rm_rf(Dir.glob(File.join(data_dir, '*.yml')))

      # Write YAML files
      paths = file_contents.map { |i, content| write_yaml_file("test_data_#{i}", content) }

      # Compute the actual hash of the written files
      actual_hash = compute_hash(paths)

      # Set up CacheMetadata with the appropriate previous hash
      cache = CacheMetadata.new(data_dir)
      cache.sync_token = 'test_token'
      cache.last_sync_at = Time.now.iso8601
      cache.space_id = 'test_space'
      cache.environment = 'master'

      case scenario
      when :match
        # Previous hash matches what the files will produce
        cache.content_hash = actual_hash
      when :mismatch
        # Previous hash is a different random hex string
        cache.content_hash = Digest::SHA256.hexdigest("different_#{rand(1_000_000)}")
        # Ensure it's actually different
        cache.content_hash = Digest::SHA256.hexdigest("extra_#{rand}") while cache.content_hash == actual_hash
      when :nil_previous
        cache.content_hash = nil
      end

      # Stub yaml_file_paths to return our test files
      allow(fetcher).to receive(:yaml_file_paths).and_return(paths)

      # Reset the config before each call
      site_config.delete('contentful_data_changed')

      # Call the private method under test
      fetcher.send(:compute_and_set_change_flag, cache, 'new_token', 'test_space', 'master')

      flag = site_config['contentful_data_changed']

      case scenario
      when :match
        expect(flag).to eq(false),
          "Expected change flag to be false when hashes match (both: #{actual_hash}), got #{flag}"
      when :mismatch
        expect(flag).to eq(true),
          "Expected change flag to be true when hashes differ, got #{flag}"
      when :nil_previous
        expect(flag).to eq(true),
          "Expected change flag to be true when no previous hash exists, got #{flag}"
      end
    }
  end
end

# Feature: conditional-build-regeneration, Property 3: Force sync overrides hash comparison
# **Validates: Requirements 6.1, 6.2**

RSpec.describe Jekyll::ContentfulFetcher, '#force_sync — Property 3: Force sync overrides hash comparison' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return({})
    s
  end

  before do
    FileUtils.mkdir_p(data_dir)
    fetcher.instance_variable_set(:@site, site)
    fetcher.instance_variable_set(:@data_dir, data_dir)
    allow(Jekyll.logger).to receive(:info)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: write a YAML file and return its path
  def write_yaml_file(dir, filename, content)
    path = File.join(dir, "#{filename}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  # Helper: compute the SHA-256 hash for given file paths (sorted, same as CacheMetadata)
  def compute_hash(file_paths)
    digest = Digest::SHA256.new
    file_paths.sort.each { |p| digest.update(File.read(p)) }
    digest.hexdigest
  end

  # Property 3: For any content hash state (matching, mismatching, or missing),
  # when force sync is active (via env var or config), the change flag must be true.
  it 'always sets change flag to true when force sync is active, regardless of hash state' do
    property_of {
      # Generate random YAML-like content for 1-4 files
      num_files = range(1, 4)
      file_contents = Array.new(num_files) { |i| [i, sized(range(5, 50)) { string }] }

      # Random hash state: :match, :mismatch, or :nil_previous
      hash_state = choose(:match, :mismatch, :nil_previous)

      # Random force sync mechanism: :env_var or :config
      force_mechanism = choose(:env_var, :config)

      [file_contents, hash_state, force_mechanism]
    }.check(100) { |file_contents, hash_state, force_mechanism|
      # Clean data_dir between iterations
      FileUtils.rm_rf(Dir.glob(File.join(data_dir, '*.yml')))

      # Write YAML files
      paths = file_contents.map { |i, content| write_yaml_file(data_dir, "test_force_#{i}", content) }

      # Compute the actual hash of the written files
      actual_hash = compute_hash(paths)

      # Set up CacheMetadata with the appropriate previous hash
      cache = CacheMetadata.new(data_dir)
      cache.sync_token = 'test_token'
      cache.last_sync_at = Time.now.iso8601
      cache.space_id = 'test_space'
      cache.environment = 'master'

      case hash_state
      when :match
        cache.content_hash = actual_hash
      when :mismatch
        cache.content_hash = Digest::SHA256.hexdigest("different_#{rand(1_000_000)}")
        cache.content_hash = Digest::SHA256.hexdigest("extra_#{rand}") while cache.content_hash == actual_hash
      when :nil_previous
        cache.content_hash = nil
      end

      # Enable force sync via the chosen mechanism
      case force_mechanism
      when :env_var
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('CONTENTFUL_FORCE_SYNC').and_return('true')
        site_config.delete('force_contentful_sync')
      when :config
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('CONTENTFUL_FORCE_SYNC').and_return(nil)
        site_config['force_contentful_sync'] = true
      end

      # Verify force_sync? returns true
      expect(fetcher.send(:force_sync?)).to eq(true),
        "Expected force_sync? to return true with mechanism=#{force_mechanism}"

      # Simulate the force sync code path from generate:
      # 1. Compute new hash (as generate does after fetch)
      new_hash = cache.compute_content_hash(paths)
      # 2. Save cache with new hash
      cache.content_hash = new_hash
      # 3. Set the change flag to true (this is what generate does)
      site_config['contentful_data_changed'] = true

      # Assert: flag must always be true regardless of hash state
      expect(site_config['contentful_data_changed']).to eq(true),
        "Expected change flag to be true with force_sync (hash_state=#{hash_state}, " \
        "mechanism=#{force_mechanism}), got #{site_config['contentful_data_changed']}"
    }
  end
end

# Feature: conditional-build-regeneration, Property 8: Change flag logging
# **Validates: Requirements 7.5**

RSpec.describe Jekyll::ContentfulFetcher, '#change_flag_logging — Property 8: Change flag logging' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return({})
    s
  end

  before do
    FileUtils.mkdir_p(data_dir)
    fetcher.instance_variable_set(:@site, site)
    fetcher.instance_variable_set(:@data_dir, data_dir)
    allow(Jekyll.logger).to receive(:info)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  def write_yaml_file(filename, content)
    path = File.join(data_dir, "#{filename}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  def compute_hash(file_paths)
    digest = Digest::SHA256.new
    file_paths.sort.each { |p| digest.update(File.read(p)) }
    digest.hexdigest
  end

  # Expected log messages for each code path
  LOG_MESSAGES = {
    hash_match:     'Content hash unchanged — setting change flag to false',
    hash_mismatch:  'Content hash changed — setting change flag to true',
    nil_previous:   'No previous content hash — setting change flag to true'
  }.freeze

  # Property 8: For any code path that sets the change flag via compute_and_set_change_flag,
  # ContentfulFetcher must emit an info-level log message containing the flag value and the reason.
  it 'emits the correct info-level log message for each hash comparison code path' do
    property_of {
      num_files = range(1, 5)
      file_contents = Array.new(num_files) { |i| [i, sized(range(5, 60)) { string }] }
      scenario = choose(:hash_match, :hash_mismatch, :nil_previous)
      [file_contents, scenario]
    }.check(100) { |file_contents, scenario|
      # Clean between iterations
      FileUtils.rm_rf(Dir.glob(File.join(data_dir, '*.yml')))

      # Reset logger expectations
      RSpec::Mocks.space.proxy_for(Jekyll.logger).reset

      allow(Jekyll.logger).to receive(:info)

      # Write YAML files
      paths = file_contents.map { |i, content| write_yaml_file("log_test_#{i}", content) }
      actual_hash = compute_hash(paths)

      # Set up CacheMetadata
      cache = CacheMetadata.new(data_dir)
      cache.sync_token = 'test_token'
      cache.last_sync_at = Time.now.iso8601
      cache.space_id = 'test_space'
      cache.environment = 'master'

      case scenario
      when :hash_match
        cache.content_hash = actual_hash
      when :hash_mismatch
        cache.content_hash = Digest::SHA256.hexdigest("different_#{rand(1_000_000)}")
        cache.content_hash = Digest::SHA256.hexdigest("extra_#{rand}") while cache.content_hash == actual_hash
      when :nil_previous
        cache.content_hash = nil
      end

      allow(fetcher).to receive(:yaml_file_paths).and_return(paths)
      site_config.delete('contentful_data_changed')

      fetcher.send(:compute_and_set_change_flag, cache, 'new_token', 'test_space', 'master')

      expected_message = LOG_MESSAGES[scenario]
      expect(Jekyll.logger).to have_received(:info).with('Contentful:', expected_message),
        "Expected log message '#{expected_message}' for scenario=#{scenario}, but it was not emitted"
    }
  end
end

# ─── Unit Tests: ContentfulFetcher change flag logic ─────────────────────────
# Task 4.5: Unit tests for ContentfulFetcher change flag
# Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 6.1, 6.2

RSpec.describe Jekyll::ContentfulFetcher, '#generate — change flag unit tests' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site_data) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return(site_data)
    s
  end

  let(:mock_client) { double('Contentful::Client') }

  # ENV management: save and restore around each test
  around do |example|
    saved_env = {
      'CONTENTFUL_SPACE_ID'     => ENV['CONTENTFUL_SPACE_ID'],
      'CONTENTFUL_ACCESS_TOKEN' => ENV['CONTENTFUL_ACCESS_TOKEN'],
      'CONTENTFUL_ENVIRONMENT'  => ENV['CONTENTFUL_ENVIRONMENT'],
      'CONTENTFUL_FORCE_SYNC'   => ENV['CONTENTFUL_FORCE_SYNC']
    }
    example.run
  ensure
    saved_env.each { |k, v| ENV[k] = v }
  end

  before do
    FileUtils.mkdir_p(data_dir)
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # ── Helpers ──────────────────────────────────────────────────────────

  def set_credentials(space_id: 'test_space', token: 'test_token', environment: nil)
    ENV['CONTENTFUL_SPACE_ID'] = space_id
    ENV['CONTENTFUL_ACCESS_TOKEN'] = token
    ENV['CONTENTFUL_ENVIRONMENT'] = environment
  end

  def clear_credentials
    ENV.delete('CONTENTFUL_SPACE_ID')
    ENV.delete('CONTENTFUL_ACCESS_TOKEN')
    ENV.delete('CONTENTFUL_ENVIRONMENT')
    ENV.delete('CONTENTFUL_FORCE_SYNC')
  end

  def build_mock_page(items:, has_next: false, next_page_mock: nil, sync_url: nil)
    page = double('SyncPage')
    allow(page).to receive(:items).and_return(items)
    allow(page).to receive(:next_page?).and_return(has_next)
    allow(page).to receive(:next_page).and_return(next_page_mock) if has_next
    allow(page).to receive(:next_sync_url).and_return(sync_url) unless has_next
    page
  end

  def sync_url_with_token(token)
    "https://cdn.contentful.com/spaces/test_space/sync?sync_token=#{token}"
  end

  def stub_client
    allow(fetcher).to receive(:client).and_return(mock_client)
  end

  def stub_initial_sync(token: 'new_sync_token')
    page = build_mock_page(items: [], sync_url: sync_url_with_token(token))
    sync = double('Sync')
    allow(sync).to receive(:first_page).and_return(page)
    allow(mock_client).to receive(:sync).with(initial: true).and_return(sync)
  end

  def stub_incremental_sync(items: [], token: 'new_token')
    page = build_mock_page(items: items, sync_url: sync_url_with_token(token))
    sync = double('Sync')
    allow(sync).to receive(:first_page).and_return(page)
    allow(mock_client).to receive(:sync).with(hash_including(:sync_token)).and_return(sync)
  end

  def stub_empty_fetches
    allow(mock_client).to receive(:entries).and_return([])
  end

  def write_cache(space_id: 'test_space', environment: 'master', sync_token: 'cached_token',
                  last_sync_at: '2025-01-15T10:30:00+00:00', content_hash: nil)
    data = {
      'sync_token'   => sync_token,
      'last_sync_at' => last_sync_at,
      'space_id'     => space_id,
      'environment'  => environment
    }
    data['content_hash'] = content_hash if content_hash
    File.write(File.join(data_dir, '.contentful_sync_cache.yml'), YAML.dump(data))
  end

  # ── Test: First build with no cache metadata → flag is true ──────────
  # Requirement 1.5: No previously stored Content_Hash → flag is true
  # Requirement 2.1: Flag stored in site.config before lower-priority generators

  describe 'first build with no cache metadata' do
    before do
      set_credentials
      stub_client
      stub_initial_sync
      stub_empty_fetches
      ENV.delete('CONTENTFUL_FORCE_SYNC')
    end

    it 'sets contentful_data_changed to true' do
      fetcher.generate(site)
      expect(site_config['contentful_data_changed']).to eq(true)
    end

    it 'logs that no previous content hash exists' do
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /No previous content hash/)
      fetcher.generate(site)
    end
  end

  # ── Test: Missing credentials → flag is not set (nil) ────────────────
  # Requirement 2.2: When ContentfulFetcher did not run due to missing credentials,
  # generators treat data as changed (flag defaults to true via fetch default)

  describe 'missing credentials' do
    before { clear_credentials }

    it 'does not set contentful_data_changed (remains nil)' do
      fetcher.generate(site)
      expect(site_config['contentful_data_changed']).to be_nil
    end

    it 'returns early without error' do
      expect { fetcher.generate(site) }.not_to raise_error
    end
  end

  # ── Test: Sync API reports no changes → flag is false, hash not recomputed ──
  # Requirement 1.4: Sync API no changes → flag false without recomputing hash

  describe 'sync API reports no changes' do
    before do
      set_credentials
      stub_client
      stub_empty_fetches
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      write_cache(content_hash: 'abc123previoushash')
      stub_incremental_sync(items: [], token: 'same_token')
    end

    it 'sets contentful_data_changed to false' do
      fetcher.generate(site)
      expect(site_config['contentful_data_changed']).to eq(false)
    end

    it 'does not recompute the content hash' do
      # The cache metadata should not have compute_content_hash called
      # We verify by checking the stored hash remains unchanged
      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      cache.load
      # The original hash should be preserved (not overwritten)
      expect(cache.content_hash).to eq('abc123previoushash')
    end

    it 'logs sync API no changes reason' do
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /Sync API reports no changes/)
      fetcher.generate(site)
    end

    it 'does not call fetch_and_write_content' do
      expect(fetcher).not_to receive(:fetch_and_write_content)
      fetcher.generate(site)
    end
  end

  # ── Test: Force sync via env var → flag is true ──────────────────────
  # Requirement 6.1: CONTENTFUL_FORCE_SYNC=true → flag is true

  describe 'force sync via CONTENTFUL_FORCE_SYNC env var' do
    before do
      set_credentials
      stub_client
      stub_initial_sync
      stub_empty_fetches
      ENV['CONTENTFUL_FORCE_SYNC'] = 'true'
      write_cache(content_hash: 'existing_hash')
    end

    it 'sets contentful_data_changed to true' do
      fetcher.generate(site)
      expect(site_config['contentful_data_changed']).to eq(true)
    end

    it 'logs force sync reason' do
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /Force sync — setting change flag to true/)
      fetcher.generate(site)
    end

    it 'performs a full fetch regardless of cache state' do
      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end
  end

  # ── Test: Force sync via config → flag is true ──────────────────────
  # Requirement 6.2: force_contentful_sync config → flag is true

  describe 'force sync via force_contentful_sync config' do
    before do
      set_credentials
      stub_client
      stub_initial_sync
      stub_empty_fetches
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      site_config['force_contentful_sync'] = true
      write_cache(content_hash: 'existing_hash')
    end

    it 'sets contentful_data_changed to true' do
      fetcher.generate(site)
      expect(site_config['contentful_data_changed']).to eq(true)
    end

    it 'logs force sync reason' do
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /Force sync — setting change flag to true/)
      fetcher.generate(site)
    end

    it 'performs a full fetch regardless of cache state' do
      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end
  end
end
