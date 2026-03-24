# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'yaml'

RSpec.describe Jekyll::ContentfulFetcher do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site) do
    site = double('Jekyll::Site')
    allow(site).to receive(:source).and_return(tmpdir)
    allow(site).to receive(:config).and_return(site_config)
    allow(site).to receive(:data).and_return(site_data)
    site
  end
  let(:site_config) { {} }
  let(:site_data) { {} }

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

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Mock Contentful client
  let(:mock_client) { double('Contentful::Client') }

  # Helper: set valid credentials
  def set_credentials(space_id: 'test_space', token: 'test_token', environment: nil)
    ENV['CONTENTFUL_SPACE_ID'] = space_id
    ENV['CONTENTFUL_ACCESS_TOKEN'] = token
    ENV['CONTENTFUL_ENVIRONMENT'] = environment
  end

  # Helper: clear credentials
  def clear_credentials
    ENV.delete('CONTENTFUL_SPACE_ID')
    ENV.delete('CONTENTFUL_ACCESS_TOKEN')
    ENV.delete('CONTENTFUL_ENVIRONMENT')
    ENV.delete('CONTENTFUL_FORCE_SYNC')
  end

  # Helper: build a mock sync page
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

  # Helper: create a valid cache file
  def write_cache(space_id: 'test_space', environment: 'master', sync_token: 'cached_token', last_sync_at: '2025-01-15T10:30:00+00:00')
    FileUtils.mkdir_p(data_dir)
    File.write(File.join(data_dir, '.contentful_sync_cache.yml'), YAML.dump({
      'sync_token'   => sync_token,
      'last_sync_at' => last_sync_at,
      'space_id'     => space_id,
      'environment'  => environment
    }))
  end

  # Helper: stub client and inject it into fetcher
  def stub_client
    allow(fetcher).to receive(:client).and_return(mock_client)
  end

  # Helper: stub initial_sync to return a successful result
  def stub_initial_sync(token: 'new_sync_token')
    page = build_mock_page(items: [], sync_url: sync_url_with_token(token))
    sync = double('Sync')
    allow(sync).to receive(:first_page).and_return(page)
    allow(mock_client).to receive(:sync).with(initial: true).and_return(sync)
  end

  # Helper: stub check_for_changes via client.sync(sync_token:)
  def stub_incremental_sync(items: [], token: 'new_token')
    page = build_mock_page(items: items, sync_url: sync_url_with_token(token))
    sync = double('Sync')
    allow(sync).to receive(:first_page).and_return(page)
    allow(mock_client).to receive(:sync).with(hash_including(:sync_token)).and_return(sync)
  end

  # Helper: stub fetch_entries to return empty arrays for all content types
  def stub_empty_fetches
    allow(mock_client).to receive(:entries).and_return([])
  end

  # ─── contentful_configured? ───────────────────────────────────────────

  describe '#contentful_configured?' do
    it 'returns true when both CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN are set' do
      set_credentials
      expect(fetcher.send(:contentful_configured?)).to be true
    end

    it 'returns false when CONTENTFUL_SPACE_ID is missing' do
      ENV.delete('CONTENTFUL_SPACE_ID')
      ENV['CONTENTFUL_ACCESS_TOKEN'] = 'token'
      expect(fetcher.send(:contentful_configured?)).to be_falsey
    end

    it 'returns false when CONTENTFUL_ACCESS_TOKEN is missing' do
      ENV['CONTENTFUL_SPACE_ID'] = 'space'
      ENV.delete('CONTENTFUL_ACCESS_TOKEN')
      expect(fetcher.send(:contentful_configured?)).to be_falsey
    end

    it 'returns false when CONTENTFUL_SPACE_ID is empty string' do
      ENV['CONTENTFUL_SPACE_ID'] = ''
      ENV['CONTENTFUL_ACCESS_TOKEN'] = 'token'
      expect(fetcher.send(:contentful_configured?)).to be_falsey
    end

    it 'returns false when CONTENTFUL_ACCESS_TOKEN is empty string' do
      ENV['CONTENTFUL_SPACE_ID'] = 'space'
      ENV['CONTENTFUL_ACCESS_TOKEN'] = ''
      expect(fetcher.send(:contentful_configured?)).to be_falsey
    end

    it 'returns false when both are missing' do
      clear_credentials
      expect(fetcher.send(:contentful_configured?)).to be_falsey
    end
  end

  # ─── force_sync? ──────────────────────────────────────────────────────

  describe '#force_sync?' do
    before do
      set_credentials
      # force_sync? reads @site, so we need to trigger generate context
      fetcher.instance_variable_set(:@site, site)
    end

    it 'returns true when ENV CONTENTFUL_FORCE_SYNC is "true"' do
      ENV['CONTENTFUL_FORCE_SYNC'] = 'true'
      expect(fetcher.send(:force_sync?)).to be true
    end

    it 'returns true when ENV CONTENTFUL_FORCE_SYNC is "TRUE" (case insensitive)' do
      ENV['CONTENTFUL_FORCE_SYNC'] = 'TRUE'
      expect(fetcher.send(:force_sync?)).to be true
    end

    it 'returns true when ENV CONTENTFUL_FORCE_SYNC is "True" (mixed case)' do
      ENV['CONTENTFUL_FORCE_SYNC'] = 'True'
      expect(fetcher.send(:force_sync?)).to be true
    end

    it 'returns true when site.config force_contentful_sync is true' do
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      site_config['force_contentful_sync'] = true
      expect(fetcher.send(:force_sync?)).to be true
    end

    it 'returns false when neither is set' do
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      expect(fetcher.send(:force_sync?)).to be false
    end

    it 'returns false when ENV CONTENTFUL_FORCE_SYNC is "false"' do
      ENV['CONTENTFUL_FORCE_SYNC'] = 'false'
      expect(fetcher.send(:force_sync?)).to be false
    end
  end

  # ─── generate: credential check ──────────────────────────────────────

  describe '#generate - credential check' do
    before { clear_credentials }

    it 'skips fetch when credentials are missing and logs warning' do
      expect(Jekyll.logger).to receive(:warn).with('Contentful:', /Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN/)
      fetcher.generate(site)
    end

    it 'does not create a Contentful client when credentials are missing' do
      allow(Jekyll.logger).to receive(:warn)
      expect(fetcher).not_to receive(:client)
      fetcher.generate(site)
    end

    it 'returns without error when credentials are missing' do
      allow(Jekyll.logger).to receive(:warn)
      expect { fetcher.generate(site) }.not_to raise_error
    end
  end

  # ─── generate: force sync flow ───────────────────────────────────────

  describe '#generate - force sync' do
    before do
      set_credentials
      stub_client
      stub_initial_sync
      stub_empty_fetches
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)
    end

    it 'performs full fetch when CONTENTFUL_FORCE_SYNC=true regardless of cache state' do
      write_cache
      ENV['CONTENTFUL_FORCE_SYNC'] = 'true'

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs force sync reason for ENV variable' do
      ENV['CONTENTFUL_FORCE_SYNC'] = 'true'
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /CONTENTFUL_FORCE_SYNC environment variable is set/)
      fetcher.generate(site)
    end

    it 'performs full fetch when force_contentful_sync config is true' do
      site_config['force_contentful_sync'] = true
      ENV.delete('CONTENTFUL_FORCE_SYNC')

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs force sync reason for config option' do
      site_config['force_contentful_sync'] = true
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /force_contentful_sync config option is enabled/)
      fetcher.generate(site)
    end
  end

  # ─── generate: cache states ──────────────────────────────────────────

  describe '#generate - cache states' do
    before do
      set_credentials
      stub_client
      stub_initial_sync
      stub_empty_fetches
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)
      ENV.delete('CONTENTFUL_FORCE_SYNC')
    end

    it 'performs full fetch when no cache file exists' do
      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs reason when no cache file exists' do
      expect(Jekyll.logger).to receive(:info).with('Contentful:', /no cache metadata found/)
      fetcher.generate(site)
    end

    it 'performs full fetch when cache is invalid (missing fields)' do
      FileUtils.mkdir_p(data_dir)
      File.write(File.join(data_dir, '.contentful_sync_cache.yml'), YAML.dump({
        'sync_token' => 'tok'
        # missing last_sync_at, space_id, environment
      }))

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs reason when cache is invalid' do
      FileUtils.mkdir_p(data_dir)
      File.write(File.join(data_dir, '.contentful_sync_cache.yml'), YAML.dump({
        'sync_token' => 'tok'
      }))

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /cache metadata is invalid/)
      fetcher.generate(site)
    end

    it 'performs full fetch when cache space_id does not match current' do
      write_cache(space_id: 'old_space', environment: 'master')

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs environment mismatch when space_id differs' do
      write_cache(space_id: 'old_space', environment: 'master')

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /environment mismatch.*old_space/)
      fetcher.generate(site)
    end

    it 'performs full fetch when cache environment does not match current' do
      write_cache(space_id: 'test_space', environment: 'staging')

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs environment mismatch when environment differs' do
      write_cache(space_id: 'test_space', environment: 'staging')

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /environment mismatch.*staging/)
      fetcher.generate(site)
    end
  end

  # ─── generate: incremental sync ────────────────────────────────────

  describe '#generate - incremental sync' do
    before do
      set_credentials
      stub_client
      stub_empty_fetches
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)
      ENV.delete('CONTENTFUL_FORCE_SYNC')
      write_cache
    end

    it 'uses cached data when sync reports no changes' do
      stub_incremental_sync(items: [], token: 'same_token')

      expect(fetcher).not_to receive(:fetch_and_write_content)
      fetcher.generate(site)
    end

    it 'logs cached content usage with last sync timestamp' do
      stub_incremental_sync(items: [], token: 'same_token')

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /Using cached content.*2025-01-15/)
      fetcher.generate(site)
    end

    it 'fetches content when sync reports changes' do
      stub_incremental_sync(items: [double('Entry')], token: 'updated_token')

      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end

    it 'logs number of changed entries' do
      stub_incremental_sync(items: [double('E1'), double('E2'), double('E3')], token: 'updated_token')

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /3 changed entries/)
      fetcher.generate(site)
    end

    it 'falls back to full fetch when sync API errors' do
      allow(mock_client).to receive(:sync).with(hash_including(:sync_token)).and_raise(StandardError.new('API error'))
      stub_initial_sync

      expect(Jekyll.logger).to receive(:warn).with('Contentful:', /Sync API error.*API error.*falling back/)
      expect(fetcher).to receive(:fetch_and_write_content).once
      fetcher.generate(site)
    end
  end

  # ─── write_yaml ─────────────────────────────────────────────────────

  describe '#write_yaml' do
    before do
      set_credentials
      fetcher.instance_variable_set(:@site, site)
      fetcher.instance_variable_set(:@data_dir, data_dir)
      FileUtils.mkdir_p(data_dir)
    end

    it 'writes YAML file to correct path' do
      fetcher.send(:write_yaml, 'spots', [{ 'slug' => 'test' }])

      filepath = File.join(data_dir, 'spots.yml')
      expect(File.exist?(filepath)).to be true
      loaded = YAML.safe_load(File.read(filepath))
      expect(loaded).to eq([{ 'slug' => 'test' }])
    end

    it 'creates subdirectories for nested paths' do
      fetcher.send(:write_yaml, 'types/spot_types', [{ 'slug' => 'launch' }])

      filepath = File.join(data_dir, 'types', 'spot_types.yml')
      expect(File.exist?(filepath)).to be true
      loaded = YAML.safe_load(File.read(filepath))
      expect(loaded).to eq([{ 'slug' => 'launch' }])
    end

    it 'updates site.data for top-level keys' do
      data = [{ 'slug' => 'spiez' }]
      fetcher.send(:write_yaml, 'spots', data)

      expect(site_data['spots']).to eq(data)
    end

    it 'updates site.data for nested keys' do
      data = [{ 'slug' => 'launch-point' }]
      fetcher.send(:write_yaml, 'types/spot_types', data)

      expect(site_data['types']).to be_a(Hash)
      expect(site_data['types']['spot_types']).to eq(data)
    end

    it 'preserves existing nested site.data entries' do
      site_data['types'] = { 'obstacle_types' => [{ 'slug' => 'dam' }] }
      fetcher.send(:write_yaml, 'types/spot_types', [{ 'slug' => 'launch' }])

      expect(site_data['types']['obstacle_types']).to eq([{ 'slug' => 'dam' }])
      expect(site_data['types']['spot_types']).to eq([{ 'slug' => 'launch' }])
    end
  end

  # ─── fetch_and_write_content ───────────────────────────────────────

  describe '#fetch_and_write_content' do
    before do
      set_credentials
      stub_client
      fetcher.instance_variable_set(:@site, site)
      fetcher.instance_variable_set(:@data_dir, data_dir)
      FileUtils.mkdir_p(data_dir)
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)
    end

    it 'iterates all 13 content types' do
      expect(Jekyll::ContentfulFetcher::CONTENT_TYPES.size).to eq(13)

      # Expect entries to be fetched for each content type
      Jekyll::ContentfulFetcher::CONTENT_TYPES.each_key do |ct|
        expect(mock_client).to receive(:entries)
          .with(hash_including(content_type: ct))
          .and_return([])
      end

      fetcher.send(:fetch_and_write_content)
    end

    it 'calls flatten_entry for each content type entry' do
      mock_entry = double('Entry')
      allow(mock_entry).to receive(:sys).and_return({ id: 'e1', created_at: Time.now, updated_at: Time.now })
      allow(mock_entry).to receive(:fields_with_locales).and_return({ slug: { en: 'test' } })

      # Stub all fetches to return one entry
      allow(mock_client).to receive(:entries).and_return([mock_entry])

      Jekyll::ContentfulFetcher::CONTENT_TYPES.each do |_ct, config|
        expect(ContentfulMappers).to receive(:flatten_entry).with(mock_entry, config[:mapper]).and_return([{ 'slug' => 'test', 'locale' => 'de' }])
      end

      fetcher.send(:fetch_and_write_content)
    end

    it 'continues fetching remaining types when one fails with Contentful::Error' do
      call_count = 0
      # Build a real Contentful::Error with properly mocked response
      raw_response = double('RawResponse', status: 500, body: 'Internal Server Error')
      response = double('Response', raw: raw_response)
      allow(response).to receive(:load_json).and_raise(StandardError)
      error = Contentful::Error.new(response)

      allow(mock_client).to receive(:entries) do |args|
        call_count += 1
        raise error if args[:content_type] == 'spot'
        []
      end

      fetcher.send(:fetch_and_write_content)

      # Should have been called for all 13 content types
      expect(call_count).to eq(13)
    end

    it 'logs entry count per content type' do
      mock_entry = double('Entry')
      allow(mock_entry).to receive(:sys).and_return({ id: 'e1', created_at: Time.now, updated_at: Time.now })
      allow(mock_entry).to receive(:fields_with_locales).and_return({ slug: { en: 'test' } })
      allow(mock_client).to receive(:entries).and_return([mock_entry, mock_entry])

      expect(Jekyll.logger).to receive(:info).with('Contentful:', /Fetched 2 spot entries/).at_least(:once)
      fetcher.send(:fetch_and_write_content)
    end
  end

  # ─── upsert_rows ────────────────────────────────────────────────────

  describe '#upsert_rows' do
    it 'replaces an existing row matching slug + locale' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez Alt' },
          { 'slug' => 'spiez', 'locale' => 'en', 'name' => 'Spiez Old' }
        ]
      }
      new_rows = [{ 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez Neu' }]

      fetcher.send(:upsert_rows, yaml_data, 'spots', new_rows)

      de_row = yaml_data['spots'].find { |r| r['slug'] == 'spiez' && r['locale'] == 'de' }
      expect(de_row['name']).to eq('Spiez Neu')
    end

    it 'appends a new row when slug + locale does not match' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez' }
        ]
      }
      new_rows = [{ 'slug' => 'thun', 'locale' => 'de', 'name' => 'Thun' }]

      fetcher.send(:upsert_rows, yaml_data, 'spots', new_rows)

      expect(yaml_data['spots'].size).to eq(2)
      expect(yaml_data['spots'].last['slug']).to eq('thun')
    end

    it 'handles upsert of both locales for the same slug' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez DE Alt' },
          { 'slug' => 'spiez', 'locale' => 'en', 'name' => 'Spiez EN Old' }
        ]
      }
      new_rows = [
        { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez DE Neu' },
        { 'slug' => 'spiez', 'locale' => 'en', 'name' => 'Spiez EN New' }
      ]

      fetcher.send(:upsert_rows, yaml_data, 'spots', new_rows)

      expect(yaml_data['spots'].size).to eq(2)
      de_row = yaml_data['spots'].find { |r| r['slug'] == 'spiez' && r['locale'] == 'de' }
      en_row = yaml_data['spots'].find { |r| r['slug'] == 'spiez' && r['locale'] == 'en' }
      expect(de_row['name']).to eq('Spiez DE Neu')
      expect(en_row['name']).to eq('Spiez EN New')
    end

    it 'leaves non-matching rows unchanged' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'thun', 'locale' => 'de', 'name' => 'Thun' },
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez Alt' }
        ]
      }
      new_rows = [{ 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez Neu' }]

      fetcher.send(:upsert_rows, yaml_data, 'spots', new_rows)

      thun_row = yaml_data['spots'].find { |r| r['slug'] == 'thun' }
      expect(thun_row['name']).to eq('Thun')
    end

    it 'initializes the filename key when it does not exist' do
      yaml_data = {}
      new_rows = [{ 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez' }]

      fetcher.send(:upsert_rows, yaml_data, 'spots', new_rows)

      expect(yaml_data['spots']).to eq(new_rows)
    end

    it 'handles empty new_rows without modifying existing data' do
      yaml_data = {
        'spots' => [{ 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez' }]
      }

      fetcher.send(:upsert_rows, yaml_data, 'spots', [])

      expect(yaml_data['spots'].size).to eq(1)
    end
  end

  # ─── remove_rows ──────────────────────────────────────────────────

  describe '#remove_rows' do
    it 'removes all rows matching the slug (both locales)' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez DE' },
          { 'slug' => 'spiez', 'locale' => 'en', 'name' => 'Spiez EN' },
          { 'slug' => 'thun', 'locale' => 'de', 'name' => 'Thun DE' }
        ]
      }

      fetcher.send(:remove_rows, yaml_data, 'spots', 'spiez')

      expect(yaml_data['spots'].size).to eq(1)
      expect(yaml_data['spots'].first['slug']).to eq('thun')
    end

    it 'leaves other slugs unchanged' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez' },
          { 'slug' => 'thun', 'locale' => 'de', 'name' => 'Thun' },
          { 'slug' => 'bern', 'locale' => 'de', 'name' => 'Bern' }
        ]
      }

      fetcher.send(:remove_rows, yaml_data, 'spots', 'thun')

      slugs = yaml_data['spots'].map { |r| r['slug'] }
      expect(slugs).to eq(%w[spiez bern])
    end

    it 'does nothing when slug is not found' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'spiez', 'locale' => 'de', 'name' => 'Spiez' }
        ]
      }

      fetcher.send(:remove_rows, yaml_data, 'spots', 'nonexistent')

      expect(yaml_data['spots'].size).to eq(1)
    end

    it 'handles missing filename key gracefully' do
      yaml_data = {}

      expect { fetcher.send(:remove_rows, yaml_data, 'spots', 'spiez') }.not_to raise_error
    end

    it 'preserves row order of remaining entries' do
      yaml_data = {
        'spots' => [
          { 'slug' => 'aare', 'locale' => 'de' },
          { 'slug' => 'spiez', 'locale' => 'de' },
          { 'slug' => 'thun', 'locale' => 'de' },
          { 'slug' => 'spiez', 'locale' => 'en' },
          { 'slug' => 'bern', 'locale' => 'de' }
        ]
      }

      fetcher.send(:remove_rows, yaml_data, 'spots', 'spiez')

      slugs = yaml_data['spots'].map { |r| r['slug'] }
      expect(slugs).to eq(%w[aare thun bern])
    end
  end

  # ─── save_cache ────────────────────────────────────────────────────

  describe '#save_cache' do
    before do
      FileUtils.mkdir_p(data_dir)
    end

    it 'saves sync_token, last_sync_at, space_id, environment to cache file' do
      cache = CacheMetadata.new(data_dir)

      fetcher.send(:save_cache, cache, 'new_token_xyz', 'space_123', 'staging')

      loaded = CacheMetadata.new(data_dir)
      expect(loaded.load).to be true
      expect(loaded.sync_token).to eq('new_token_xyz')
      expect(loaded.space_id).to eq('space_123')
      expect(loaded.environment).to eq('staging')
      expect(loaded.last_sync_at).not_to be_nil
    end

    it 'sets last_sync_at to a valid ISO 8601 timestamp' do
      cache = CacheMetadata.new(data_dir)

      fetcher.send(:save_cache, cache, 'tok', 'sp', 'master')

      loaded = CacheMetadata.new(data_dir)
      loaded.load
      expect { Time.iso8601(loaded.last_sync_at) }.not_to raise_error
    end
  end

  # ─── generate: full integration flow ───────────────────────────────

  describe '#generate - full flow integration' do
    before do
      set_credentials
      stub_client
      allow(Jekyll.logger).to receive(:info)
      allow(Jekyll.logger).to receive(:warn)
      ENV.delete('CONTENTFUL_FORCE_SYNC')
    end

    it 'saves cache after successful full fetch' do
      stub_initial_sync(token: 'fresh_token')
      stub_empty_fetches

      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      expect(cache.load).to be true
      expect(cache.sync_token).to eq('fresh_token')
      expect(cache.space_id).to eq('test_space')
      expect(cache.environment).to eq('master')
    end

    it 'saves cache after successful incremental sync with changes' do
      write_cache
      stub_incremental_sync(items: [double('Entry')], token: 'incremental_token')
      stub_empty_fetches

      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      expect(cache.load).to be true
      expect(cache.sync_token).to eq('incremental_token')
    end

    it 'does not overwrite cache when using cached content (no changes)' do
      write_cache(sync_token: 'original_token')
      stub_incremental_sync(items: [], token: 'new_token')

      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      cache.load
      expect(cache.sync_token).to eq('original_token')
    end

    it 'defaults CONTENTFUL_ENVIRONMENT to master when not set' do
      ENV.delete('CONTENTFUL_ENVIRONMENT')
      stub_initial_sync
      stub_empty_fetches

      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      cache.load
      expect(cache.environment).to eq('master')
    end

    it 'uses CONTENTFUL_ENVIRONMENT when set' do
      ENV['CONTENTFUL_ENVIRONMENT'] = 'staging'
      stub_initial_sync
      stub_empty_fetches

      fetcher.generate(site)

      cache = CacheMetadata.new(data_dir)
      cache.load
      expect(cache.environment).to eq('staging')
    end
  end
end
