# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'json'

# **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
# Property 2: Preservation — YAML Data, HTML Rendering, and Liquid Template Data Unchanged
#
# These tests observe and lock down the CURRENT behavior of the unfixed code.
# They MUST PASS on unfixed code to establish the baseline.
# After the fix, they MUST STILL PASS to confirm no regressions.
RSpec.describe 'ApiGenerator Preservation Properties' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:site) do
    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'quiet' => true
    )
    Jekyll::Site.new(config)
  end

  after { FileUtils.remove_entry(tmpdir) }

  # ---------------------------------------------------------------------------
  # Helper: build mock site.data with representative entries
  # ---------------------------------------------------------------------------
  def build_mock_site_data(spot_name: 'Test Spot', obstacle_name: 'Test Wehr',
                           notice_name: 'Sperrung', waterway_name: 'Aare',
                           pa_name: 'Schutzgebiet')
    {
      'spots' => [
        {
          'locale' => 'de', 'slug' => 'test-spot', 'name' => spot_name,
          'description' => '<p>Beschreibung</p>',
          'location' => { 'lat' => 47.0, 'lon' => 8.0 },
          'approximateAddress' => 'Teststrasse 1, 3000 Bern',
          'country' => 'CH', 'confirmed' => true, 'rejected' => nil,
          'waterway_slug' => 'aare', 'spotType_slug' => 'einstieg',
          'paddlingEnvironmentType_slug' => 'fluss',
          'paddleCraftTypes' => %w[seekajak], 'eventNotices' => [], 'obstacles' => [],
          'dataSourceType_slug' => 'community', 'dataLicenseType_slug' => 'cc-by',
          'createdAt' => '2023-11-23T09:28:19Z', 'updatedAt' => '2024-06-15T14:30:00Z'
        },
        {
          'locale' => 'en', 'slug' => 'test-spot', 'name' => "#{spot_name} EN",
          'description' => '<p>Description</p>',
          'location' => { 'lat' => 47.0, 'lon' => 8.0 },
          'approximateAddress' => 'Teststrasse 1, 3000 Bern',
          'country' => 'CH', 'confirmed' => true, 'rejected' => nil,
          'waterway_slug' => 'aare', 'spotType_slug' => 'einstieg',
          'paddlingEnvironmentType_slug' => 'fluss',
          'paddleCraftTypes' => %w[seekajak], 'eventNotices' => [], 'obstacles' => [],
          'dataSourceType_slug' => 'community', 'dataLicenseType_slug' => 'cc-by',
          'createdAt' => '2023-11-23T09:28:19Z', 'updatedAt' => '2024-06-15T14:25:00Z'
        }
      ],
      'obstacles' => [
        {
          'locale' => 'de', 'slug' => 'test-obstacle', 'name' => obstacle_name,
          'description' => '<p>Gefährlich</p>',
          'geometry' => '{"type":"Point","coordinates":[8.0,47.0]}',
          'portageRoute' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.1,47.1]]}',
          'portageDistance' => 200, 'portageDescription' => '<p>Umtragen</p>',
          'isPortageNecessary' => true, 'isPortagePossible' => true,
          'obstacleType_slug' => 'wehr', 'waterway_slug' => 'aare',
          'spots' => ['test-spot'],
          'createdAt' => '2023-10-01T08:00:00Z', 'updatedAt' => '2024-05-20T10:00:00Z'
        },
        {
          'locale' => 'en', 'slug' => 'test-obstacle', 'name' => "#{obstacle_name} EN",
          'description' => '<p>Dangerous</p>',
          'geometry' => '{"type":"Point","coordinates":[8.0,47.0]}',
          'portageRoute' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.1,47.1]]}',
          'portageDistance' => 200, 'portageDescription' => '<p>Portage</p>',
          'isPortageNecessary' => true, 'isPortagePossible' => true,
          'obstacleType_slug' => 'wehr', 'waterway_slug' => 'aare',
          'spots' => ['test-spot'],
          'createdAt' => '2023-10-01T08:00:00Z', 'updatedAt' => '2024-05-20T09:00:00Z'
        }
      ],
      'notices' => [
        {
          'locale' => 'de', 'slug' => 'test-notice', 'name' => notice_name,
          'description' => '<p>Gesperrt</p>',
          'location' => { 'lat' => 47.0, 'lon' => 8.0 },
          'affectedArea' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
          'startDate' => '2024-07-01T00:00:00+00:00', 'endDate' => '2024-07-31T00:00:00+00:00',
          'waterways' => ['aare'],
          'createdAt' => '2024-06-01T12:00:00Z', 'updatedAt' => '2024-06-28T16:00:00Z'
        },
        {
          'locale' => 'en', 'slug' => 'test-notice', 'name' => "#{notice_name} EN",
          'description' => '<p>Closed</p>',
          'location' => { 'lat' => 47.0, 'lon' => 8.0 },
          'affectedArea' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
          'startDate' => '2024-07-01T00:00:00+00:00', 'endDate' => '2024-07-31T00:00:00+00:00',
          'waterways' => ['aare'],
          'createdAt' => '2024-06-01T12:00:00Z', 'updatedAt' => '2024-06-28T15:00:00Z'
        }
      ],
      'protected_areas' => [
        {
          'locale' => 'de', 'slug' => 'test-pa', 'name' => pa_name,
          'geometry' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
          'isAreaMarked' => true, 'protectedAreaType_slug' => 'naturschutzgebiet',
          'createdAt' => '2023-05-01T10:00:00Z', 'updatedAt' => '2024-04-01T12:00:00Z'
        },
        {
          'locale' => 'en', 'slug' => 'test-pa', 'name' => "#{pa_name} EN",
          'geometry' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
          'isAreaMarked' => true, 'protectedAreaType_slug' => 'naturschutzgebiet',
          'createdAt' => '2023-05-01T10:00:00Z', 'updatedAt' => '2024-04-01T11:00:00Z'
        }
      ],
      'waterways' => [
        {
          'locale' => 'de', 'slug' => 'aare', 'name' => waterway_name,
          'length' => 288, 'area' => nil,
          'geometry' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.5,47.5]]}',
          'showInMenu' => true,
          'paddlingEnvironmentType_slug' => 'fluss',
          'dataSourceType_slug' => 'community', 'dataLicenseType_slug' => 'cc-by',
          'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2024-03-10T08:00:00Z'
        },
        {
          'locale' => 'en', 'slug' => 'aare', 'name' => waterway_name,
          'length' => 288, 'area' => nil,
          'geometry' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.5,47.5]]}',
          'showInMenu' => true,
          'paddlingEnvironmentType_slug' => 'fluss',
          'dataSourceType_slug' => 'community', 'dataLicenseType_slug' => 'cc-by',
          'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2024-03-10T07:00:00Z'
        }
      ],
      'types' => {
        'spot_types' => [
          { 'slug' => 'einstieg', 'name_de' => 'Einstieg', 'name_en' => 'Put-in',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'obstacle_types' => [
          { 'slug' => 'wehr', 'name_de' => 'Wehr', 'name_en' => 'Weir',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'paddle_craft_types' => [
          { 'slug' => 'seekajak', 'name_de' => 'Seekajak', 'name_en' => 'Sea Kayak',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'paddling_environment_types' => [
          { 'slug' => 'fluss', 'name_de' => 'Fluss', 'name_en' => 'River',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'protected_area_types' => [
          { 'slug' => 'naturschutzgebiet', 'name_de' => 'Naturschutzgebiet', 'name_en' => 'Nature Reserve',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'data_source_types' => [
          { 'slug' => 'community', 'name_de' => 'Community', 'name_en' => 'Community',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ],
        'data_license_types' => [
          { 'slug' => 'cc-by', 'name_de' => 'CC BY 4.0', 'name_en' => 'CC BY 4.0',
            'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
        ]
      }
    }
  end


  # ---------------------------------------------------------------------------
  # Helper: create a mock Contentful entry for flatten_entry tests
  # ---------------------------------------------------------------------------
  MockSys = Struct.new(:created_at, :updated_at, :id, keyword_init: true)

  def mock_entry(fields_hash, sys_hash)
    sys = MockSys.new(
      created_at: sys_hash[:created_at],
      updated_at: sys_hash[:updated_at],
      id: sys_hash[:id] || 'mock-id'
    )
    entry = double('ContentfulEntry')
    allow(entry).to receive(:fields_with_locales).and_return(fields_hash)
    allow(entry).to receive(:sys).and_return(
      { created_at: sys.created_at, updated_at: sys.updated_at, id: sys.id }
    )
    entry
  end

  # ===========================================================================
  # Property 2.1: site.data entries (excluding last_updates) remain identical
  #               after ApiGenerator#generate
  # ===========================================================================
  # **Validates: Requirements 3.1, 3.4**
  describe 'site.data preservation after generate' do
    it 'does not mutate source data entries (spots, obstacles, notices, waterways, protected_areas, types)' do
      property_of {
        # Use Rantly to generate random name strings for variety
        spot_name = sized(range(3, 15)) { string(:alpha) }
        obstacle_name = sized(range(3, 15)) { string(:alpha) }
        [spot_name, obstacle_name]
      }.check(5) do |spot_name, obstacle_name|
        mock_data = build_mock_site_data(spot_name: spot_name, obstacle_name: obstacle_name)

        # Wire up site.data
        mock_data.each { |k, v| site.data[k] = v }

        # Deep-copy the data BEFORE generation (excluding last_updates which doesn't exist yet)
        data_keys = site.data.keys - ['last_updates']
        snapshot_before = Marshal.load(Marshal.dump(data_keys.map { |k| [k, site.data[k]] }.to_h))

        # Run the generator
        generator = Jekyll::ApiGenerator.new
        generator.generate(site)

        # Verify each data key is unchanged
        data_keys.each do |key|
          expect(site.data[key]).to eq(snapshot_before[key]),
            "site.data['#{key}'] was mutated by ApiGenerator#generate"
        end

        # Reset site for next iteration
        site.pages.clear
        site.data.delete('last_updates')
      end
    end
  end

  # ===========================================================================
  # Property 2.2: site.data['last_updates'] is a non-empty Hash after generate
  # ===========================================================================
  # **Validates: Requirements 3.2**
  describe 'site.data[last_updates] Liquid template exposure' do
    it 'is a non-empty Hash accessible after generate' do
      property_of {
        # Vary waterway and PA names
        waterway_name = sized(range(3, 12)) { string(:alpha) }
        pa_name = sized(range(3, 12)) { string(:alpha) }
        [waterway_name, pa_name]
      }.check(5) do |waterway_name, pa_name|
        mock_data = build_mock_site_data(waterway_name: waterway_name, pa_name: pa_name)
        mock_data.each { |k, v| site.data[k] = v }

        generator = Jekyll::ApiGenerator.new
        generator.generate(site)

        last_updates = site.data['last_updates']
        expect(last_updates).to be_a(Hash),
          "Expected site.data['last_updates'] to be a Hash, got #{last_updates.class}"
        expect(last_updates).not_to be_empty,
          "Expected site.data['last_updates'] to be non-empty"

        # Each value should be a timestamp string
        last_updates.each do |table, ts|
          expect(table).to be_a(String), "Expected table name to be a String, got #{table.class}"
          expect(ts).to be_a(String), "Expected timestamp to be a String, got #{ts.class}"
        end

        # Reset for next iteration
        site.pages.clear
        site.data.delete('last_updates')
      end
    end
  end

  # ===========================================================================
  # Property 2.3: ContentfulMappers.flatten_entry output format is unchanged
  # ===========================================================================
  # **Validates: Requirements 3.4**
  describe 'ContentfulMappers.flatten_entry output format' do
    it 'produces hashes with locale (not node_locale), string timestamps, and mapper-specific fields' do
      property_of {
        # Generate random field values
        name_de = sized(range(3, 15)) { string(:alpha) }
        name_en = sized(range(3, 15)) { string(:alpha) }
        slug = sized(range(3, 10)) { string(:alpha) }.downcase
        [name_de, name_en, slug]
      }.check(5) do |name_de, name_en, slug|
        now = Time.now.utc
        created = now - rand(86400..864000)
        updated = now - rand(0..86400)

        # Build a mock entry for map_type (simplest mapper)
        fields = {
          slug: { de: slug, en: slug },
          name: { de: name_de, en: name_en }
        }
        entry = mock_entry(fields, { created_at: created, updated_at: updated })

        results = ContentfulMappers.flatten_entry(entry, :map_type)

        expect(results).to be_an(Array)
        expect(results.size).to eq(2) # one per locale (de, en)

        results.each do |hash|
          # Must have 'locale', NOT 'node_locale'
          expect(hash).to have_key('locale'),
            "flatten_entry output missing 'locale' key. Keys: #{hash.keys}"
          expect(hash).not_to have_key('node_locale'),
            "flatten_entry output should NOT have 'node_locale'"

          # locale must be 'de' or 'en'
          expect(%w[de en]).to include(hash['locale'])

          # createdAt and updatedAt must be strings
          expect(hash['createdAt']).to be_a(String),
            "Expected createdAt to be a String, got #{hash['createdAt'].class}"
          expect(hash['updatedAt']).to be_a(String),
            "Expected updatedAt to be a String, got #{hash['updatedAt'].class}"

          # Mapper-specific fields for map_type: slug, name_de, name_en
          expect(hash).to have_key('slug')
          expect(hash).to have_key('name_de')
          expect(hash).to have_key('name_en')
        end
      end
    end

    it 'map_spot produces hashes with expected field set' do
      now = Time.now.utc
      fields = {
        slug: { de: 'test', en: 'test' },
        name: { de: 'Spot DE', en: 'Spot EN' },
        description: { de: nil, en: nil },
        location: { de: nil, en: nil },
        approximate_address: { de: 'Addr', en: 'Addr' },
        country: { de: 'CH', en: 'CH' },
        confirmed: { de: true, en: true },
        rejected: { de: nil, en: nil },
        waterway: { de: nil, en: nil },
        spot_type: { de: nil, en: nil },
        paddling_environment_type: { de: nil, en: nil },
        paddle_craft_type: { de: [], en: [] },
        event_notices: { de: [], en: [] },
        obstacles: { de: [], en: [] },
        data_source_type: { de: nil, en: nil },
        data_license_type: { de: nil, en: nil }
      }
      entry = mock_entry(fields, { created_at: now, updated_at: now })

      results = ContentfulMappers.flatten_entry(entry, :map_spot)
      results.each do |hash|
        expect(hash).to have_key('locale')
        expect(hash).not_to have_key('node_locale')
        expect(hash['createdAt']).to be_a(String)
        expect(hash['updatedAt']).to be_a(String)
        # Spot-specific fields
        %w[slug name description location approximateAddress country confirmed rejected
           waterway_slug spotType_slug paddlingEnvironmentType_slug paddleCraftTypes
           eventNotices obstacles dataSourceType_slug dataLicenseType_slug].each do |field|
          expect(hash).to have_key(field),
            "map_spot output missing '#{field}'. Keys: #{hash.keys}"
        end
      end
    end

    it 'map_obstacle produces hashes with expected field set' do
      now = Time.now.utc
      fields = {
        slug: { de: 'obs', en: 'obs' },
        name: { de: 'Wehr', en: 'Weir' },
        description: { de: nil, en: nil },
        geometry: { de: nil, en: nil },
        portage_route: { de: nil, en: nil },
        portage_distance: { de: 100, en: 100 },
        portage_description: { de: nil, en: nil },
        is_portage_necessary: { de: true, en: true },
        is_portage_possible: { de: true, en: true },
        obstacle_type: { de: nil, en: nil },
        waterway: { de: nil, en: nil },
        spots: { de: [], en: [] }
      }
      entry = mock_entry(fields, { created_at: now, updated_at: now })

      results = ContentfulMappers.flatten_entry(entry, :map_obstacle)
      results.each do |hash|
        expect(hash).to have_key('locale')
        expect(hash).not_to have_key('node_locale')
        expect(hash['createdAt']).to be_a(String)
        expect(hash['updatedAt']).to be_a(String)
        %w[slug name description geometry portageRoute portageDistance portageDescription
           isPortageNecessary isPortagePossible obstacleType_slug waterway_slug spots].each do |field|
          expect(hash).to have_key(field),
            "map_obstacle output missing '#{field}'. Keys: #{hash.keys}"
        end
      end
    end
  end

  # ===========================================================================
  # Property 2.4: ApiGenerator only adds pages and sets last_updates — no
  #               other side effects on site.data
  # ===========================================================================
  # **Validates: Requirements 3.3, 3.4**
  describe 'ApiGenerator side effects' do
    it 'only adds pages to site.pages and sets site.data[last_updates]' do
      property_of {
        notice_name = sized(range(3, 12)) { string(:alpha) }
        [notice_name]
      }.check(5) do |notice_name|
        mock_data = build_mock_site_data(notice_name: notice_name)
        mock_data.each { |k, v| site.data[k] = v }

        # Record data keys before generation
        keys_before = site.data.keys.sort
        pages_before_count = site.pages.size

        generator = Jekyll::ApiGenerator.new
        generator.generate(site)

        # The only new key in site.data should be 'last_updates'
        keys_after = site.data.keys.sort
        new_keys = keys_after - keys_before
        expect(new_keys).to eq(['last_updates']),
          "Expected only 'last_updates' to be added to site.data, but found: #{new_keys.inspect}"

        # Pages should have been added
        expect(site.pages.size).to be > pages_before_count,
          "Expected pages to be added to site.pages"

        # All added pages should be JSON API files
        site.pages.each do |page|
          expect(page.name).to end_with('.json'),
            "Expected all generated pages to be .json files, got: #{page.name}"
        end

        # Reset for next iteration
        site.pages.clear
        site.data.delete('last_updates')
      end
    end
  end
end
