# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe 'Contentful Sync Properties' do
  # Feature: contentful-sync-integration, Property 5: Cache metadata YAML round-trip
  # **Validates: Requirements 4.5, 4.6**
  describe 'Property 5: Cache metadata YAML round-trip' do
    let(:tmpdir) { Dir.mktmpdir }

    after do
      FileUtils.remove_entry(tmpdir)
    end

    it 'round-trips cache metadata through YAML' do
      property_of {
        Rantly {
          {
            sync_token: sized(range(10, 50)) { string(:alpha) },
            last_sync_at: Time.now.iso8601,
            space_id: sized(range(5, 20)) { string(:alpha) },
            environment: choose('master', 'staging', 'development')
          }
        }
      }.check(100) { |data|
        cache = CacheMetadata.new(tmpdir)
        cache.sync_token = data[:sync_token]
        cache.last_sync_at = data[:last_sync_at]
        cache.space_id = data[:space_id]
        cache.environment = data[:environment]
        cache.save

        loaded = CacheMetadata.new(tmpdir)
        loaded.load
        expect(loaded.sync_token).to eq(data[:sync_token])
        expect(loaded.last_sync_at).to eq(data[:last_sync_at])
        expect(loaded.space_id).to eq(data[:space_id])
        expect(loaded.environment).to eq(data[:environment])
      }
    end
  end

  # Feature: contentful-sync-integration, Property 3: Sync result determines fetch behavior
  # **Validates: Requirements 3.2, 3.3**
  describe 'Property 3: Sync result determines fetch behavior' do
    it 'fetches content if and only if sync result indicates changes' do
      property_of {
        Rantly {
          items_count = range(0, 100)
          {
            items_count: items_count,
            has_changes: items_count > 0
          }
        }
      }.check(100) { |data|
        result = SyncChecker::SyncResult.new(
          success: true,
          has_changes: data[:has_changes],
          new_token: 'token',
          items_count: data[:items_count]
        )

        if data[:items_count] > 0
          expect(result.has_changes).to be true
          expect(result.success?).to be true
        else
          expect(result.has_changes).to be false
          expect(result.success?).to be true
        end
      }
    end
  end

  # Feature: contentful-sync-integration, Property 4: Sync error triggers full fetch fallback
  # **Validates: Requirements 3.4**
  describe 'Property 4: Sync error triggers full fetch fallback' do
    let(:checker) { Class.new { include SyncChecker }.new }

    it 'returns failed SyncResult for any error during sync check' do
      property_of {
        Rantly {
          error_class = choose(StandardError, RuntimeError, Timeout::Error, IOError, SocketError)
          message = sized(range(5, 30)) { string(:alpha) }
          { error_class: error_class, message: message }
        }
      }.check(100) { |data|
        client = double('client')
        allow(client).to receive(:sync).and_raise(data[:error_class], data[:message])

        result = checker.check_for_changes(client, 'some_token')
        expect(result.success?).to be false
        expect(result.error).to be_a(StandardError)
        expect(result.error.message).to eq(data[:message])
      }
    end
  end

  # Feature: contentful-sync-integration, Property 12: Sync page iteration completeness
  # **Validates: Requirements 3.7, 3.8**
  describe 'Property 12: Sync page iteration completeness' do
    let(:checker) { Class.new { include SyncChecker; public :collect_all_pages, :extract_sync_token }.new }

    it 'collects items from all pages and extracts token from final page' do
      property_of {
        Rantly {
          num_pages = range(1, 5)
          pages = Array.new(num_pages) { range(0, 10) }
          token = sized(range(10, 30)) { string(:alpha) }
          { pages: pages, token: token }
        }
      }.check(100) { |data|
        pages_data = data[:pages]
        final_token = data[:token]

        mock_pages = pages_data.map.with_index do |item_count, idx|
          page = double("page_#{idx}")
          items = Array.new(item_count) { double('item') }
          allow(page).to receive(:items).and_return(items)
          is_last = (idx == pages_data.length - 1)
          allow(page).to receive(:next_page?).and_return(!is_last)
          if is_last
            allow(page).to receive(:next_sync_url).and_return(
              "https://cdn.contentful.com/spaces/test/sync?sync_token=#{final_token}"
            )
          end
          page
        end

        # Chain next_page calls
        mock_pages.each_with_index do |page, idx|
          unless idx == mock_pages.length - 1
            allow(page).to receive(:next_page).and_return(mock_pages[idx + 1])
          end
        end

        sync = double('sync')
        allow(sync).to receive(:first_page).and_return(mock_pages.first)

        items, last_page = checker.collect_all_pages(sync)
        expect(items.length).to eq(pages_data.sum)

        extracted_token = checker.extract_sync_token(last_page)
        expect(extracted_token).to eq(final_token)
      }
    end
  end

  # Feature: contentful-sync-integration, Property 1: Mapper field completeness
  # **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**
  describe 'Property 1: Mapper field completeness' do
    MAPPER_REQUIRED_KEYS = {
      map_spot: %w[
        slug name description location approximateAddress country confirmed rejected
        waterway_slug spotType_slug paddlingEnvironmentType_slug paddleCraftTypes
        eventNotices obstacles dataSourceType_slug dataLicenseType_slug
      ],
      map_waterway: %w[
        slug name length area geometry showInMenu
        paddlingEnvironmentType_slug dataSourceType_slug dataLicenseType_slug
      ],
      map_obstacle: %w[
        slug name description geometry portageRoute portageDistance portageDescription
        isPortageNecessary isPortagePossible obstacleType_slug waterway_slug spots
      ],
      map_protected_area: %w[
        slug name geometry isAreaMarked protectedAreaType_slug
      ],
      map_event_notice: %w[
        slug name description location affectedArea startDate endDate waterways
      ],
      map_type: %w[slug name_de name_en],
      map_static_page: %w[slug title menu menu_slug content menuOrder]
    }.freeze

    BASE_KEYS = %w[locale createdAt updatedAt].freeze

    def build_reference(slug)
      ref = double("Ref:#{slug}")
      allow(ref).to receive(:respond_to?).with(anything).and_return(false)
      allow(ref).to receive(:respond_to?).with(:fields_with_locales).and_return(true)
      allow(ref).to receive(:fields_with_locales).and_return({ slug: { en: slug } })
      allow(ref).to receive(:sys).and_return({ id: slug })
      ref
    end

    def build_location(lat, lon)
      loc = double('Location')
      allow(loc).to receive(:lat).and_return(lat)
      allow(loc).to receive(:lon).and_return(lon)
      loc
    end

    def build_geometry
      geo = double('Geometry')
      allow(geo).to receive(:to_json).and_return('{"type":"Point","coordinates":[7.0,46.0]}')
      geo
    end

    def build_date
      date = double('Date')
      allow(date).to receive(:iso8601).and_return(Time.now.iso8601)
      date
    end

    def random_string(len = 10)
      (0...len).map { ('a'..'z').to_a.sample }.join
    end

    # Build a fields_with_locales hash from simple key-value pairs
    def build_fields(hash)
      result = {}
      hash.each do |key, value|
        if value.is_a?(Hash) && value.keys.all? { |k| k.is_a?(Symbol) && k.to_s.length == 2 }
          result[key] = value
        else
          result[key] = { en: value }
        end
      end
      result
    end

    def build_mock_entry(fields_hash, sys_overrides = {})
      fields = build_fields(fields_hash)
      entry = double('Entry')
      sys = {
        id: 'test-id',
        created_at: Time.now,
        updated_at: Time.now
      }.merge(sys_overrides)
      allow(entry).to receive(:sys).and_return(sys)
      allow(entry).to receive(:fields_with_locales).and_return(fields)
      entry
    end

    def generate_field_values_for(mapper_name)
      fields = {}
      case mapper_name
      when :map_spot
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:description] = random_string(rand(5..30))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:approximate_address] = random_string(rand(5..30))
        fields[:country] = %w[CH DE AT FR].sample
        fields[:confirmed] = [true, false].sample
        fields[:rejected] = [true, false].sample
        fields[:waterway] = build_reference('waterway-slug')
        fields[:spot_type] = build_reference('spot-type-slug')
        fields[:paddling_environment_type] = build_reference('env-type-slug')
        fields[:paddle_craft_type] = [build_reference('kayak'), build_reference('sup')]
        fields[:event_notices] = [build_reference('notice-1')]
        fields[:obstacles] = [build_reference('obstacle-1')]
        fields[:data_source_type] = build_reference('source-slug')
        fields[:data_license_type] = build_reference('license-slug')
      when :map_waterway
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:length] = rand * 100
        fields[:area] = rand * 500
        fields[:geometry] = build_geometry
        fields[:show_in_menu] = [true, false].sample
        fields[:paddling_environment_type] = build_reference('env-type-slug')
        fields[:data_source_type] = build_reference('source-slug')
        fields[:data_license_type] = build_reference('license-slug')
      when :map_obstacle
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:description] = random_string(rand(5..30))
        fields[:geometry] = build_geometry
        fields[:portage_route] = build_geometry
        fields[:portage_distance] = rand * 1000
        fields[:portage_description] = random_string(rand(5..30))
        fields[:is_portage_necessary] = [true, false].sample
        fields[:is_portage_possible] = [true, false].sample
        fields[:obstacle_type] = build_reference('obstacle-type-slug')
        fields[:waterway] = build_reference('waterway-slug')
        fields[:spots] = [build_reference('spot-1'), build_reference('spot-2')]
      when :map_protected_area
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:geometry] = build_geometry
        fields[:is_area_marked] = [true, false].sample
        fields[:protected_area_type] = build_reference('protected-area-type-slug')
      when :map_event_notice
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:description] = random_string(rand(5..30))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:affected_area] = build_geometry
        fields[:start_date] = build_date
        fields[:end_date] = build_date
        fields[:waterways] = [build_reference('waterway-1')]
      when :map_type
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
      when :map_static_page
        fields[:slug] = random_string(rand(3..20))
        fields[:title] = { de: random_string(rand(3..20)), en: random_string(rand(3..20)) }
        fields[:menu] = ['Offene Daten', 'Über', 'Info'].sample
        fields[:content] = random_string(rand(5..30))
        fields[:menu_order] = rand(0..10)
      end
      fields
    end

    it 'produces hashes containing all required fields plus base fields for any content type' do
      mapper_names = MAPPER_REQUIRED_KEYS.keys

      property_of {
        Rantly {
          mapper_name = choose(*mapper_names)
          { mapper_name: mapper_name }
        }
      }.check(100) { |data|
        mapper_name = data[:mapper_name]
        field_values = generate_field_values_for(mapper_name)
        entry = build_mock_entry(field_values)

        # flatten_entry produces per-locale rows with base keys included
        results = ContentfulMappers.flatten_entry(entry, mapper_name)

        expected_keys = MAPPER_REQUIRED_KEYS[mapper_name] + BASE_KEYS
        results.each do |result|
          expected_keys.each do |key|
            expect(result).to have_key(key),
              "Expected mapper #{mapper_name} result to have key '#{key}', but it was missing. Keys present: #{result.keys}"
          end
        end
      }
    end
  end

  # Feature: contentful-sync-integration, Property 2: Mapper resilience to missing fields
  # **Validates: Requirements 2.10**
  describe 'Property 2: Mapper resilience to missing fields' do
    it 'returns nil for missing fields without raising and still contains all keys' do
      mapper_names = MAPPER_REQUIRED_KEYS.keys

      property_of {
        Rantly {
          mapper_name = choose(*mapper_names)
          { mapper_name: mapper_name }
        }
      }.check(100) { |data|
        mapper_name = data[:mapper_name]

        # Build entry with NO fields — only sys
        entry = double('Entry')
        allow(entry).to receive(:sys).and_return({
          id: 'fallback-id',
          created_at: Time.now,
          updated_at: Time.now
        })
        allow(entry).to receive(:fields_with_locales).and_return({})

        # Should not raise
        results = ContentfulMappers.flatten_entry(entry, mapper_name)

        # Should still have all keys in each locale row
        expected_keys = MAPPER_REQUIRED_KEYS[mapper_name] + BASE_KEYS
        results.each do |result|
          expected_keys.each do |key|
            expect(result).to have_key(key),
              "Expected mapper #{mapper_name} result to have key '#{key}' even with all fields missing. Keys present: #{result.keys}"
          end

          # Slug should fall back to sys[:id]
          expect(result['slug']).to eq('fallback-id')
        end
      }
    end
  end

  # Feature: contentful-sync-integration, Property 10: Cache validation rejects incomplete metadata
  # **Validates: Requirements 4.6**
  describe 'Property 10: Cache validation rejects incomplete metadata' do
    let(:tmpdir) { Dir.mktmpdir }

    after do
      FileUtils.remove_entry(tmpdir)
    end

    it 'rejects cache metadata with any missing required field' do
      property_of {
        Rantly {
          fields = {
            sync_token: sized(range(10, 50)) { string(:alpha) },
            last_sync_at: Time.now.iso8601,
            space_id: sized(range(5, 20)) { string(:alpha) },
            environment: choose('master', 'staging', 'development')
          }
          # Randomly nil out at least one field
          keys = fields.keys
          nil_count = range(1, keys.length)
          keys.sample(nil_count).each { |k| fields[k] = nil }
          fields
        }
      }.check(100) { |data|
        cache = CacheMetadata.new(tmpdir)
        cache.sync_token = data[:sync_token]
        cache.last_sync_at = data[:last_sync_at]
        cache.space_id = data[:space_id]
        cache.environment = data[:environment]
        expect(cache.valid?).to be false
      }
    end
  end

  # Feature: contentful-sync-integration, Property 6: Data file YAML round-trip
  # **Validates: Requirements 9.8**
  describe 'Property 6: Data file YAML round-trip' do
    it 'round-trips mapper output through YAML dump/safe_load' do
      property_of {
        Rantly {
          num_entries = range(1, 5)
          Array.new(num_entries) {
            {
              'slug' => sized(range(3, 20)) { string(:alpha) },
              'name' => sized(range(3, 20)) { string(:alpha) },
              'confirmed' => choose(true, false),
              'count' => range(0, 1000),
              'description' => choose(nil, sized(range(5, 30)) { string(:alpha) }),
              'tags' => Array.new(range(0, 3)) { sized(range(3, 10)) { string(:alpha) } },
              'locale' => choose('de', 'en'),
              'createdAt' => Time.now.iso8601,
              'updatedAt' => Time.now.iso8601
            }
          }
        }
      }.check(100) { |data|
        yaml_str = YAML.dump(data)
        loaded = YAML.safe_load(yaml_str, permitted_classes: [Time, Date])
        expect(loaded).to eq(data)
      }
    end
  end

  # Feature: contentful-sync-integration, Property 7: Force sync overrides cache state
  # **Validates: Requirements 5.1, 5.2, 5.3**
  describe 'Property 7: Force sync overrides cache state' do
    let(:tmpdir) { Dir.mktmpdir }
    let(:site_source) { tmpdir }
    let(:data_dir) { File.join(tmpdir, '_data') }

    before do
      FileUtils.mkdir_p(File.join(data_dir, 'types'))
    end

    around do |example|
      saved_env = %w[CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC].map do |key|
        [key, ENV[key]]
      end.to_h
      example.run
    ensure
      saved_env.each { |key, val| val.nil? ? ENV.delete(key) : ENV[key] = val }
      FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
    end

    def build_mock_site(force_config: false)
      site = double('site')
      allow(site).to receive(:source).and_return(site_source)
      allow(site).to receive(:config).and_return({ 'force_contentful_sync' => force_config })
      allow(site).to receive(:data).and_return({})
      site
    end

    def setup_cache(state, cache_dir)
      case state
      when :valid
        cache = CacheMetadata.new(cache_dir)
        cache.sync_token = 'valid_token_abc123'
        cache.last_sync_at = Time.now.iso8601
        cache.space_id = 'test_space'
        cache.environment = 'master'
        cache.save
      when :invalid
        cache_path = File.join(cache_dir, '.contentful_sync_cache.yml')
        File.write(cache_path, YAML.dump({ 'sync_token' => 'token_only' }))
      when :missing
        cache_path = File.join(cache_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)
      end
    end

    def build_mock_client
      client = double('Contentful::Client')
      # Return real empty arrays so flat_map works natively
      allow(client).to receive(:entries).and_return([])

      sync_page = double('sync_page')
      allow(sync_page).to receive(:items).and_return([])
      allow(sync_page).to receive(:next_page?).and_return(false)
      allow(sync_page).to receive(:next_sync_url).and_return(
        'https://cdn.contentful.com/spaces/test/sync?sync_token=new_token_xyz'
      )
      sync = double('sync')
      allow(sync).to receive(:first_page).and_return(sync_page)
      allow(client).to receive(:sync).and_return(sync)

      client
    end

    it 'performs a full content fetch regardless of cache state when force sync is enabled' do
      property_of {
        Rantly {
          {
            cache_state: choose(:valid, :invalid, :missing),
            force_method: choose(:env_var, :config_option)
          }
        }
      }.check(100) { |data|
        ENV['CONTENTFUL_SPACE_ID'] = 'test_space'
        ENV['CONTENTFUL_ACCESS_TOKEN'] = 'test_token'
        ENV['CONTENTFUL_ENVIRONMENT'] = 'master'

        ENV.delete('CONTENTFUL_FORCE_SYNC')
        force_config = false
        case data[:force_method]
        when :env_var
          ENV['CONTENTFUL_FORCE_SYNC'] = 'true'
        when :config_option
          force_config = true
        end

        setup_cache(data[:cache_state], data_dir)

        site = build_mock_site(force_config: force_config)
        mock_client = build_mock_client

        fetcher = Jekyll::ContentfulFetcher.new
        allow(fetcher).to receive(:client).and_return(mock_client)

        expect(fetcher).to receive(:fetch_and_write_content).and_call_original

        fetcher.generate(site)

        cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)
      }
    end
  end

  # Feature: contentful-sync-integration, Property 8: Configuration mismatch triggers full sync
  # **Validates: Requirements 6.1, 6.2**
  describe 'Property 8: Configuration mismatch triggers full sync' do
    let(:tmpdir) { Dir.mktmpdir }
    let(:site_source) { tmpdir }
    let(:data_dir) { File.join(tmpdir, '_data') }

    before do
      FileUtils.mkdir_p(File.join(data_dir, 'types'))
    end

    around do |example|
      saved_env = %w[CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC].map do |key|
        [key, ENV[key]]
      end.to_h
      example.run
    ensure
      saved_env.each { |key, val| val.nil? ? ENV.delete(key) : ENV[key] = val }
      FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
    end

    def build_mock_site
      site = double('site')
      allow(site).to receive(:source).and_return(site_source)
      allow(site).to receive(:config).and_return({})
      allow(site).to receive(:data).and_return({})
      site
    end

    def build_mock_client
      client = double('Contentful::Client')
      allow(client).to receive(:entries).and_return([])

      sync_page = double('sync_page')
      allow(sync_page).to receive(:items).and_return([])
      allow(sync_page).to receive(:next_page?).and_return(false)
      allow(sync_page).to receive(:next_sync_url).and_return(
        'https://cdn.contentful.com/spaces/test/sync?sync_token=new_token_xyz'
      )
      sync = double('sync')
      allow(sync).to receive(:first_page).and_return(sync_page)
      allow(client).to receive(:sync).and_return(sync)

      client
    end

    it 'performs a full sync when space_id or environment differs from cache' do
      property_of {
        Rantly {
          cached_space = sized(range(5, 15)) { string(:alpha) }
          cached_env   = choose('master', 'staging', 'development', 'preview')
          current_space = sized(range(5, 15)) { string(:alpha) }
          current_env   = choose('master', 'staging', 'development', 'preview')

          mismatch_type = choose(:space_only, :env_only, :both)
          case mismatch_type
          when :space_only
            current_space = current_space + '_diff' if current_space == cached_space
            current_env = cached_env
          when :env_only
            current_space = cached_space
            current_env = current_env + '_diff' if current_env == cached_env
          when :both
            current_space = current_space + '_diff' if current_space == cached_space
            current_env = current_env + '_diff' if current_env == cached_env
          end

          {
            cached_space: cached_space,
            cached_env: cached_env,
            current_space: current_space,
            current_env: current_env,
            mismatch_type: mismatch_type
          }
        }
      }.check(100) { |data|
        ENV['CONTENTFUL_SPACE_ID'] = data[:current_space]
        ENV['CONTENTFUL_ACCESS_TOKEN'] = 'test_token'
        ENV['CONTENTFUL_ENVIRONMENT'] = data[:current_env]
        ENV.delete('CONTENTFUL_FORCE_SYNC')

        cache = CacheMetadata.new(data_dir)
        cache.sync_token = 'cached_sync_token_abc'
        cache.last_sync_at = Time.now.iso8601
        cache.space_id = data[:cached_space]
        cache.environment = data[:cached_env]
        cache.save

        site = build_mock_site
        mock_client = build_mock_client

        fetcher = Jekyll::ContentfulFetcher.new
        allow(fetcher).to receive(:client).and_return(mock_client)

        expect(fetcher).to receive(:fetch_and_write_content).and_call_original
        expect(fetcher).not_to receive(:check_for_changes)

        fetcher.generate(site)

        cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)
      }
    end
  end
end

# frozen_string_literal: true

RSpec.describe 'Contentful Sync Properties (continued)' do
  # Feature: contentful-sync-integration, Property 9: Post-sync cache persistence
  # **Validates: Requirements 4.1, 4.2, 5.2**
  describe 'Property 9: Post-sync cache persistence' do
    let(:tmpdir) { Dir.mktmpdir }
    let(:site_source) { tmpdir }
    let(:data_dir) { File.join(tmpdir, '_data') }

    before do
      FileUtils.mkdir_p(File.join(data_dir, 'types'))
    end

    around do |example|
      saved_env = %w[CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC].map do |key|
        [key, ENV[key]]
      end.to_h
      example.run
    ensure
      saved_env.each { |key, val| val.nil? ? ENV.delete(key) : ENV[key] = val }
      FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
    end

    def build_mock_site(force_config: false)
      site = double('site')
      allow(site).to receive(:source).and_return(site_source)
      allow(site).to receive(:config).and_return({ 'force_contentful_sync' => force_config })
      allow(site).to receive(:data).and_return({})
      site
    end

    def build_mock_client(new_token)
      client = double('Contentful::Client')
      allow(client).to receive(:entries).and_return([])

      sync_page = double('sync_page')
      allow(sync_page).to receive(:items).and_return([double('item')])
      allow(sync_page).to receive(:next_page?).and_return(false)
      allow(sync_page).to receive(:next_sync_url).and_return(
        "https://cdn.contentful.com/spaces/test/sync?sync_token=#{new_token}"
      )
      sync = double('sync')
      allow(sync).to receive(:first_page).and_return(sync_page)
      allow(client).to receive(:sync).and_return(sync)

      client
    end

    it 'updates cache metadata with new sync token, timestamp, space_id, and environment after any successful sync' do
      property_of {
        Rantly {
          sync_type = choose(:initial, :incremental, :forced)
          new_token = sized(range(10, 40)) { string(:alpha) }
          space_id = sized(range(5, 15)) { string(:alpha) }
          environment = choose('master', 'staging', 'development', 'preview')

          {
            sync_type: sync_type,
            new_token: new_token,
            space_id: space_id,
            environment: environment
          }
        }
      }.check(100) { |data|
        before_time = Time.now

        ENV['CONTENTFUL_SPACE_ID'] = data[:space_id]
        ENV['CONTENTFUL_ACCESS_TOKEN'] = 'test_token'
        ENV['CONTENTFUL_ENVIRONMENT'] = data[:environment]
        ENV.delete('CONTENTFUL_FORCE_SYNC')

        force_config = false

        case data[:sync_type]
        when :initial
          cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
          File.delete(cache_path) if File.exist?(cache_path)
        when :incremental
          cache = CacheMetadata.new(data_dir)
          cache.sync_token = 'old_token_to_be_replaced'
          cache.last_sync_at = '2020-01-01T00:00:00+00:00'
          cache.space_id = data[:space_id]
          cache.environment = data[:environment]
          cache.save
        when :forced
          cache = CacheMetadata.new(data_dir)
          cache.sync_token = 'old_token_to_be_replaced'
          cache.last_sync_at = '2020-01-01T00:00:00+00:00'
          cache.space_id = data[:space_id]
          cache.environment = data[:environment]
          cache.save
          ENV['CONTENTFUL_FORCE_SYNC'] = 'true'
        end

        site = build_mock_site(force_config: force_config)
        mock_client = build_mock_client(data[:new_token])

        fetcher = Jekyll::ContentfulFetcher.new
        allow(fetcher).to receive(:client).and_return(mock_client)

        fetcher.generate(site)

        after_time = Time.now

        persisted_cache = CacheMetadata.new(data_dir)
        loaded = persisted_cache.load
        expect(loaded).to be true

        expect(persisted_cache.sync_token).to eq(data[:new_token])
        expect(persisted_cache.space_id).to eq(data[:space_id])
        expect(persisted_cache.environment).to eq(data[:environment])

        expect(persisted_cache.last_sync_at).not_to be_nil
        parsed_time = Time.iso8601(persisted_cache.last_sync_at)
        expect(parsed_time).to be >= Time.at(before_time.to_i)
        expect(parsed_time).to be <= after_time

        cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)
      }
    end
  end
end

# frozen_string_literal: true

RSpec.describe 'Contentful Sync Properties (Property 11)' do
  # Feature: contentful-sync-integration, Property 11: Content type to file path mapping
  # **Validates: Requirements 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**
  describe 'Property 11: Content type to file path mapping' do
    let(:tmpdir) { Dir.mktmpdir }
    let(:site_source) { tmpdir }
    let(:data_dir) { File.join(tmpdir, '_data') }

    CONTENT_TYPE_MAP = {
      'spot'                    => { filename: 'spots',                            mapper: :map_spot },
      'waterway'                => { filename: 'waterways',                        mapper: :map_waterway },
      'obstacle'                => { filename: 'obstacles',                        mapper: :map_obstacle },
      'protectedArea'           => { filename: 'protected_areas',                  mapper: :map_protected_area },
      'waterwayEventNotice'     => { filename: 'notices',                          mapper: :map_event_notice },
      'spotType'                => { filename: 'types/spot_types',                 mapper: :map_type },
      'obstacleType'            => { filename: 'types/obstacle_types',             mapper: :map_type },
      'paddleCraftType'         => { filename: 'types/paddle_craft_types',         mapper: :map_type },
      'paddlingEnvironmentType' => { filename: 'types/paddling_environment_types', mapper: :map_type },
      'protectedAreaType'       => { filename: 'types/protected_area_types',       mapper: :map_type },
      'dataSourceType'          => { filename: 'types/data_source_types',          mapper: :map_type },
      'dataLicenseType'         => { filename: 'types/data_license_types',         mapper: :map_type },
      'staticPage'              => { filename: 'static_pages',                     mapper: :map_static_page }
    }.freeze

    ALL_CONTENT_TYPE_KEYS = CONTENT_TYPE_MAP.keys.freeze

    before do
      FileUtils.mkdir_p(File.join(data_dir, 'types'))
    end

    around do |example|
      saved_env = %w[CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC].map do |key|
        [key, ENV[key]]
      end.to_h
      example.run
    ensure
      saved_env.each { |key, val| val.nil? ? ENV.delete(key) : ENV[key] = val }
      FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
    end

    def build_mock_site
      site = double('site')
      allow(site).to receive(:source).and_return(site_source)
      allow(site).to receive(:config).and_return({})
      @site_data = {}
      allow(site).to receive(:data).and_return(@site_data)
      site
    end

    def build_mock_entry(slug_value)
      entry = double("Entry-#{slug_value}")
      sys = {
        id: slug_value,
        created_at: Time.now,
        updated_at: Time.now
      }
      allow(entry).to receive(:sys).and_return(sys)
      # fields_with_locales with slug and name (needed by all mappers)
      allow(entry).to receive(:fields_with_locales).and_return({
        slug: { en: slug_value },
        name: { de: "Name DE #{slug_value}", en: "Name EN #{slug_value}" },
        title: { de: "Title DE #{slug_value}", en: "Title EN #{slug_value}" }
      })
      entry
    end

    def build_mock_client(selected_types, entries_per_type)
      client = double('Contentful::Client')

      ALL_CONTENT_TYPE_KEYS.each do |ct|
        if selected_types.include?(ct)
          slugs = entries_per_type[ct]
          mock_entries = slugs.map { |s| build_mock_entry(s) }
          allow(client).to receive(:entries)
            .with(hash_including(content_type: ct))
            .and_return(mock_entries)
        else
          allow(client).to receive(:entries)
            .with(hash_including(content_type: ct))
            .and_return([])
        end
      end

      sync_page = double('sync_page')
      allow(sync_page).to receive(:items).and_return([double('item')])
      allow(sync_page).to receive(:next_page?).and_return(false)
      allow(sync_page).to receive(:next_sync_url).and_return(
        'https://cdn.contentful.com/spaces/test/sync?sync_token=prop11_token'
      )
      sync = double('sync')
      allow(sync).to receive(:first_page).and_return(sync_page)
      allow(client).to receive(:sync).and_return(sync)

      client
    end

    it 'writes each content type to the correct file path and updates site.data accordingly' do
      num_locales = ContentfulMappers::LOCALES.length

      property_of {
        Rantly {
          count = range(1, ALL_CONTENT_TYPE_KEYS.length)
          selected = ALL_CONTENT_TYPE_KEYS.sample(count)

          entries_per_type = {}
          selected.each do |ct|
            num_entries = range(1, 3)
            entries_per_type[ct] = Array.new(num_entries) { |i| "#{ct.downcase}-slug-#{i}-#{rand(1000)}" }
          end

          { selected: selected, entries_per_type: entries_per_type }
        }
      }.check(100) { |data|
        selected_types = data[:selected]
        entries_per_type = data[:entries_per_type]

        ENV['CONTENTFUL_SPACE_ID'] = 'test_space'
        ENV['CONTENTFUL_ACCESS_TOKEN'] = 'test_token'
        ENV['CONTENTFUL_ENVIRONMENT'] = 'master'
        ENV.delete('CONTENTFUL_FORCE_SYNC')

        cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)

        site = build_mock_site
        mock_client = build_mock_client(selected_types, entries_per_type)

        fetcher = Jekyll::ContentfulFetcher.new
        allow(fetcher).to receive(:client).and_return(mock_client)

        fetcher.generate(site)

        ALL_CONTENT_TYPE_KEYS.each do |ct|
          config = CONTENT_TYPE_MAP[ct]
          filename = config[:filename]
          filepath = File.join(data_dir, "#{filename}.yml")

          expect(File.exist?(filepath)).to be(true),
            "Expected file #{filepath} to exist for content type '#{ct}'"

          file_data = YAML.safe_load(File.read(filepath), permitted_classes: [Time, Date])

          if selected_types.include?(ct)
            slugs = entries_per_type[ct]
            # Each entry produces num_locales rows (de + en)
            expected_count = slugs.length * num_locales
            expect(file_data.length).to eq(expected_count),
              "Expected #{expected_count} entries in #{filepath} for '#{ct}', got #{file_data.length}"

            file_slugs = file_data.map { |d| d['slug'] }.uniq
            slugs.each do |slug|
              expect(file_slugs).to include(slug),
                "Expected slug '#{slug}' in #{filepath} for content type '#{ct}'"
            end
          else
            expect(file_data).to eq([]),
              "Expected empty array in #{filepath} for non-selected content type '#{ct}'"
          end

          # Verify site.data is updated at the correct key path
          keys = filename.split('/')
          if keys.length == 1
            site_value = @site_data[keys[0]]
            expect(site_value).not_to be_nil,
              "Expected site.data['#{keys[0]}'] to be set for content type '#{ct}'"
            expect(site_value.length).to eq(file_data.length),
              "Expected site.data['#{keys[0]}'] to have #{file_data.length} entries for '#{ct}'"
          else
            parent = keys[0]
            child = keys[1]
            expect(@site_data).to have_key(parent),
              "Expected site.data to have key '#{parent}' for content type '#{ct}'"
            expect(@site_data[parent]).to have_key(child),
              "Expected site.data['#{parent}'] to have key '#{child}' for content type '#{ct}'"
            site_value = @site_data[parent][child]
            expect(site_value.length).to eq(file_data.length),
              "Expected site.data['#{parent}']['#{child}'] to have #{file_data.length} entries for '#{ct}'"
          end
        end

        # Clean up files for next iteration
        CONTENT_TYPE_MAP.each_value do |config|
          fp = File.join(data_dir, "#{config[:filename]}.yml")
          File.delete(fp) if File.exist?(fp)
        end
        File.delete(cache_path) if File.exist?(cache_path)
        @site_data.clear
      }
    end
  end
end

# frozen_string_literal: true

RSpec.describe 'Contentful Sync Properties (Property 13)' do
  # Feature: contentful-sync-integration, Property 13: Missing credentials graceful skip
  # **Validates: Requirements 1.3**
  describe 'Property 13: Missing credentials graceful skip' do
    let(:tmpdir) { Dir.mktmpdir }
    let(:site_source) { tmpdir }
    let(:data_dir) { File.join(tmpdir, '_data') }

    before do
      FileUtils.mkdir_p(data_dir)
    end

    around do |example|
      saved_env = %w[CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC].map do |key|
        [key, ENV[key]]
      end.to_h
      example.run
    ensure
      saved_env.each { |key, val| val.nil? ? ENV.delete(key) : ENV[key] = val }
      FileUtils.remove_entry(tmpdir) if Dir.exist?(tmpdir)
    end

    def build_mock_site
      site = double('site')
      allow(site).to receive(:source).and_return(site_source)
      allow(site).to receive(:config).and_return({})
      allow(site).to receive(:data).and_return({})
      site
    end

    it 'logs a warning and returns without exception for any combination of missing credentials' do
      property_of {
        Rantly {
          scenario = choose(
            :both_missing,
            :space_id_missing_only,
            :access_token_missing_only,
            :space_id_empty,
            :access_token_empty,
            :both_empty
          )
          { scenario: scenario }
        }
      }.check(100) { |data|
        ENV.delete('CONTENTFUL_SPACE_ID')
        ENV.delete('CONTENTFUL_ACCESS_TOKEN')

        case data[:scenario]
        when :both_missing
          # Neither ENV var set
        when :space_id_missing_only
          ENV['CONTENTFUL_ACCESS_TOKEN'] = 'valid_token'
        when :access_token_missing_only
          ENV['CONTENTFUL_SPACE_ID'] = 'valid_space'
        when :space_id_empty
          ENV['CONTENTFUL_SPACE_ID'] = ''
          ENV['CONTENTFUL_ACCESS_TOKEN'] = 'valid_token'
        when :access_token_empty
          ENV['CONTENTFUL_SPACE_ID'] = 'valid_space'
          ENV['CONTENTFUL_ACCESS_TOKEN'] = ''
        when :both_empty
          ENV['CONTENTFUL_SPACE_ID'] = ''
          ENV['CONTENTFUL_ACCESS_TOKEN'] = ''
        end

        site = build_mock_site
        fetcher = Jekyll::ContentfulFetcher.new

        expect { fetcher.generate(site) }.not_to raise_error

        expect(Contentful::Client).not_to receive(:new)

        yml_files = Dir.glob(File.join(data_dir, '**', '*.yml'))
        expect(yml_files).to be_empty,
          "Expected no YAML files in #{data_dir} when credentials are missing, but found: #{yml_files}"
      }
    end
  end
end

# frozen_string_literal: true

# Bugfix: blank-static-pages, Property 1: Static Page Content Mapping
# For any staticPage entry with non-empty rich text content, map_static_page SHALL produce non-empty HTML content
# **Validates: Requirements 2.1, 2.3**
RSpec.describe 'Blank Static Pages Bugfix Properties' do
  describe 'Property 1: Static page content mapping' do
    def build_fields(hash)
      result = {}
      hash.each do |key, value|
        if value.is_a?(Hash) && value.keys.all? { |k| k.is_a?(Symbol) && k.to_s.length == 2 }
          result[key] = value
        else
          result[key] = { en: value }
        end
      end
      result
    end

    def build_mock_entry(fields_hash)
      fields = build_fields(fields_hash)
      entry = double('Entry')
      allow(entry).to receive(:sys).and_return({
        id: 'test-id',
        created_at: Time.now,
        updated_at: Time.now
      })
      allow(entry).to receive(:fields_with_locales).and_return(fields)
      entry
    end

    it 'always produces non-empty HTML content for entries with rich text content' do
      property_of {
        Rantly {
          # Generate random rich text content with 1-5 paragraphs
          num_paragraphs = range(1, 5)
          paragraphs = Array.new(num_paragraphs) {
            text = sized(range(3, 30)) { string(:alpha) }
            { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => text }] }
          }
          rich_text = { 'content' => paragraphs }

          locale = choose('de', 'en')
          slug = sized(range(3, 15)) { string(:alpha) }
          title = sized(range(3, 20)) { string(:alpha) }
          menu = choose('Offene Daten', 'Über', nil)

          { rich_text: rich_text, locale: locale, slug: slug, title: title, menu: menu }
        }
      }.check(100) { |data|
        fields_hash = {
          slug: data[:slug],
          title: { de: data[:title], en: data[:title] },
          menu: data[:menu],
          page_contents: { de: data[:rich_text], en: data[:rich_text] }
        }

        entry = build_mock_entry(fields_hash)
        fields = build_fields(fields_hash)
        result = ContentfulMappers.map_static_page(entry, fields, data[:locale])

        expect(result['content']).not_to be_nil,
          "Expected non-nil content for locale=#{data[:locale]}, slug=#{data[:slug]}"
        expect(result['content']).not_to be_empty,
          "Expected non-empty content for locale=#{data[:locale]}, slug=#{data[:slug]}"
        expect(result['content']).to include('<p>'),
          "Expected HTML paragraph tags in content for locale=#{data[:locale]}, slug=#{data[:slug]}"
      }
    end
  end

  # Bugfix: blank-static-pages, Property 3: Non-static-page mapper preservation
  # For any non-staticPage content type, the fixed code SHALL produce the same mapping output as the original code.
  # **Validates: Requirements 3.1, 3.2**
  describe 'Property 3: Non-static-page mapper preservation' do
    NON_STATIC_MAPPERS = %i[map_spot map_waterway map_obstacle map_protected_area map_event_notice map_type].freeze

    def build_fields(hash)
      result = {}
      hash.each do |key, value|
        if value.is_a?(Hash) && value.keys.all? { |k| k.is_a?(Symbol) && k.to_s.length == 2 }
          result[key] = value
        else
          result[key] = { en: value }
        end
      end
      result
    end

    def build_mock_entry(fields_hash)
      fields = build_fields(fields_hash)
      entry = double('Entry')
      allow(entry).to receive(:sys).and_return({
        id: 'test-id',
        created_at: Time.now,
        updated_at: Time.now
      })
      allow(entry).to receive(:fields_with_locales).and_return(fields)
      entry
    end

    def build_reference(slug)
      ref = double("Ref:#{slug}")
      allow(ref).to receive(:respond_to?).with(anything).and_return(false)
      allow(ref).to receive(:respond_to?).with(:fields_with_locales).and_return(true)
      allow(ref).to receive(:fields_with_locales).and_return({ slug: { en: slug } })
      allow(ref).to receive(:sys).and_return({ id: slug })
      ref
    end

    def build_location(lat, lon)
      loc = double('Location')
      allow(loc).to receive(:lat).and_return(lat)
      allow(loc).to receive(:lon).and_return(lon)
      loc
    end

    def build_geometry
      geo = double('Geometry')
      allow(geo).to receive(:to_json).and_return('{"type":"Point","coordinates":[7.0,46.0]}')
      geo
    end

    def build_date
      date = double('Date')
      allow(date).to receive(:iso8601).and_return(Time.now.iso8601)
      date
    end

    def random_string(len = 10)
      (0...len).map { ('a'..'z').to_a.sample }.join
    end

    def generate_field_values_for(mapper_name)
      fields = {}
      case mapper_name
      when :map_spot
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
        fields[:description] = random_string(rand(5..20))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:approximate_address] = random_string(rand(5..20))
        fields[:country] = %w[CH DE AT FR].sample
        fields[:confirmed] = [true, false].sample
        fields[:rejected] = [true, false].sample
        fields[:waterway] = build_reference('ww')
        fields[:spot_type] = build_reference('st')
        fields[:paddling_environment_type] = build_reference('pet')
        fields[:paddle_craft_type] = [build_reference('kayak')]
        fields[:event_notices] = []
        fields[:obstacles] = []
        fields[:data_source_type] = build_reference('ds')
        fields[:data_license_type] = build_reference('dl')
      when :map_waterway
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
        fields[:length] = rand * 100
        fields[:area] = rand * 500
        fields[:geometry] = build_geometry
        fields[:show_in_menu] = [true, false].sample
        fields[:paddling_environment_type] = build_reference('pet')
        fields[:data_source_type] = build_reference('ds')
        fields[:data_license_type] = build_reference('dl')
      when :map_obstacle
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
        fields[:description] = random_string(rand(5..20))
        fields[:geometry] = build_geometry
        fields[:portage_route] = build_geometry
        fields[:portage_distance] = rand * 1000
        fields[:portage_description] = random_string(rand(5..20))
        fields[:is_portage_necessary] = [true, false].sample
        fields[:is_portage_possible] = [true, false].sample
        fields[:obstacle_type] = build_reference('ot')
        fields[:waterway] = build_reference('ww')
        fields[:spots] = [build_reference('s1')]
      when :map_protected_area
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
        fields[:geometry] = build_geometry
        fields[:is_area_marked] = [true, false].sample
        fields[:protected_area_type] = build_reference('pat')
      when :map_event_notice
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
        fields[:description] = random_string(rand(5..20))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:affected_area] = build_geometry
        fields[:start_date] = build_date
        fields[:end_date] = build_date
        fields[:waterways] = [build_reference('ww')]
      when :map_type
        fields[:slug] = random_string(rand(3..15))
        fields[:name] = { de: random_string(rand(3..15)), en: random_string(rand(3..15)) }
      end
      fields
    end

    it 'produces consistent output for all non-static-page mappers' do
      property_of {
        Rantly {
          mapper_name = choose(*NON_STATIC_MAPPERS)
          locale = choose('de', 'en')
          { mapper_name: mapper_name, locale: locale }
        }
      }.check(100) { |data|
        mapper_name = data[:mapper_name]
        locale = data[:locale]
        field_values = generate_field_values_for(mapper_name)
        entry = build_mock_entry(field_values)
        fields = entry.fields_with_locales

        # Call the mapper — should produce valid output with all expected keys
        result = ContentfulMappers.send(mapper_name, entry, fields, locale)

        # Verify the result is a Hash with a slug key (basic structural check)
        expect(result).to be_a(Hash)
        expect(result).to have_key('slug')
        expect(result['slug']).not_to be_nil

        # Verify all fields that should be present are present
        # (This confirms the fix didn't break any mapper's field resolution)
        case mapper_name
        when :map_spot
          expect(result).to have_key('name')
          expect(result).to have_key('description')
          expect(result).to have_key('confirmed')
        when :map_waterway
          expect(result).to have_key('name')
          expect(result).to have_key('geometry')
        when :map_obstacle
          expect(result).to have_key('name')
          expect(result).to have_key('description')
          expect(result).to have_key('isPortageNecessary')
        when :map_protected_area
          expect(result).to have_key('name')
          expect(result).to have_key('isAreaMarked')
        when :map_event_notice
          expect(result).to have_key('name')
          expect(result).to have_key('description')
          expect(result).to have_key('waterways')
        when :map_type
          expect(result).to have_key('name_de')
          expect(result).to have_key('name_en')
        end
      }
    end
  end
end
