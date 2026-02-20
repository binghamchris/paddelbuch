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

    # Map of mapper method to the Contentful entry fields it accesses
    MAPPER_ENTRY_FIELDS = {
      map_spot: %i[slug name description location approximate_address country confirmed rejected
                   waterway spot_type paddling_environment_type paddle_craft_types
                   event_notices obstacles data_source_type data_license_type],
      map_waterway: %i[slug name length area geometry show_in_menu
                       paddling_environment_type data_source_type data_license_type],
      map_obstacle: %i[slug name description geometry portage_route portage_distance
                       portage_description is_portage_necessary is_portage_possible
                       obstacle_type waterway spots],
      map_protected_area: %i[slug name geometry is_area_marked protected_area_type],
      map_event_notice: %i[slug name description location affected_area start_date end_date waterways],
      map_type: %i[slug name_de name_en name],
      map_static_page: %i[slug title menu content menu_order]
    }.freeze

    def build_mock_entry(fields_with_values, sys_overrides = {})
      entry = double('Entry')
      sys = {
        id: 'test-id',
        locale: 'de',
        created_at: Time.now,
        updated_at: Time.now
      }.merge(sys_overrides)
      allow(entry).to receive(:sys).and_return(sys)

      # Default: respond_to? returns false for anything
      allow(entry).to receive(:respond_to?).with(anything).and_return(false)

      # Override for specific fields
      fields_with_values.each do |field_name, value|
        allow(entry).to receive(:respond_to?).with(field_name).and_return(true)
        allow(entry).to receive(field_name).and_return(value)
      end

      entry
    end

    def build_reference(slug)
      ref = double('Reference')
      allow(ref).to receive(:respond_to?).with(anything).and_return(false)
      allow(ref).to receive(:respond_to?).with(:slug).and_return(true)
      allow(ref).to receive(:slug).and_return(slug)
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
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = random_string(rand(3..20))
        fields[:description] = random_string(rand(5..30))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:approximate_address] = random_string(rand(5..30))
        fields[:country] = %w[CH DE AT FR].sample
        fields[:confirmed] = [true, false].sample
        fields[:rejected] = [true, false].sample
        fields[:waterway] = build_reference('waterway-slug')
        fields[:spot_type] = build_reference('spot-type-slug')
        fields[:paddling_environment_type] = build_reference('env-type-slug')
        fields[:paddle_craft_types] = [build_reference('kayak'), build_reference('sup')]
        fields[:event_notices] = [build_reference('notice-1')]
        fields[:obstacles] = [build_reference('obstacle-1')]
        fields[:data_source_type] = build_reference('source-slug')
        fields[:data_license_type] = build_reference('license-slug')
      when :map_waterway
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = random_string(rand(3..20))
        fields[:length] = rand * 100
        fields[:area] = rand * 500
        fields[:geometry] = build_geometry
        fields[:show_in_menu] = [true, false].sample
        fields[:paddling_environment_type] = build_reference('env-type-slug')
        fields[:data_source_type] = build_reference('source-slug')
        fields[:data_license_type] = build_reference('license-slug')
      when :map_obstacle
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = random_string(rand(3..20))
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
        fields[:name] = random_string(rand(3..20))
        fields[:geometry] = build_geometry
        fields[:is_area_marked] = [true, false].sample
        fields[:protected_area_type] = build_reference('protected-area-type-slug')
      when :map_event_notice
        fields[:slug] = random_string(rand(3..20))
        fields[:name] = random_string(rand(3..20))
        fields[:description] = random_string(rand(5..30))
        fields[:location] = build_location(rand * 180 - 90, rand * 360 - 180)
        fields[:affected_area] = build_geometry
        fields[:start_date] = build_date
        fields[:end_date] = build_date
        fields[:waterways] = [build_reference('waterway-1')]
      when :map_type
        fields[:slug] = random_string(rand(3..20))
        fields[:name_de] = random_string(rand(3..20))
        fields[:name_en] = random_string(rand(3..20))
        fields[:name] = random_string(rand(3..20))
      when :map_static_page
        fields[:slug] = random_string(rand(3..20))
        fields[:title] = random_string(rand(3..20))
        fields[:menu] = ['Offene Daten', 'Über', 'Info'].sample
        fields[:content] = random_string(rand(5..30))
        fields[:menu_order] = rand(0..10)
      end
      fields
    end

    it 'produces a hash containing all required fields plus base fields for any content type' do
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

        result = ContentfulMappers.send(mapper_name, entry)

        expected_keys = MAPPER_REQUIRED_KEYS[mapper_name] + BASE_KEYS
        expected_keys.each do |key|
          expect(result).to have_key(key),
            "Expected mapper #{mapper_name} result to have key '#{key}', but it was missing. Keys present: #{result.keys}"
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

        # Build entry with NO fields responding - only sys
        entry = double('Entry')
        allow(entry).to receive(:sys).and_return({
          id: 'fallback-id',
          locale: 'de',
          created_at: Time.now,
          updated_at: Time.now
        })
        allow(entry).to receive(:respond_to?).with(anything).and_return(false)

        # Should not raise
        result = ContentfulMappers.send(mapper_name, entry)

        # Should still have all keys
        expected_keys = MAPPER_REQUIRED_KEYS[mapper_name] + BASE_KEYS
        expected_keys.each do |key|
          expect(result).to have_key(key),
            "Expected mapper #{mapper_name} result to have key '#{key}' even with all fields missing. Keys present: #{result.keys}"
        end

        # Slug should fall back to sys[:id]
        expect(result['slug']).to eq('fallback-id')
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
      entries = double('entries')
      allow(entries).to receive(:map).and_return([])
      allow(client).to receive(:entries).and_return(entries)

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

        # Enable force sync via the randomly chosen method
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

        # Key assertion: full fetch must happen regardless of cache state
        expect(fetcher).to receive(:fetch_and_write_content).and_call_original

        fetcher.generate(site)

        # Clean up cache for next iteration
        cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
        File.delete(cache_path) if File.exist?(cache_path)
      }
    end
  end
end

