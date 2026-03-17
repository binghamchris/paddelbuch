# frozen_string_literal: true

require 'spec_helper'

# Contract/compatibility tests verifying that ContentfulMappers output
# is compatible with downstream consumers: ApiGenerator and TileGenerator.
# **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

RSpec.describe 'Data file output compatibility' do
  # --- Test helpers (locale: '*' / fields_with_locales pattern) ---

  def build_sys(overrides = {})
    {
      id: 'test-id',
      created_at: Time.parse('2025-01-10T08:30:00Z'),
      updated_at: Time.parse('2025-01-15T10:00:00Z')
    }.merge(overrides)
  end

  # Build a fields_with_locales hash from simple key-value pairs.
  # Values can be plain (stored under :en) or locale hashes like { de: 'x', en: 'y' }
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

  def build_entry(fields_hash = {}, sys_overrides = {})
    fields = build_fields(fields_hash)
    entry = double('Entry')
    allow(entry).to receive(:sys).and_return(build_sys(sys_overrides))
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

  def build_geometry(json = '{"type":"Point","coordinates":[7.68,46.69]}')
    geo = double('Geometry')
    allow(geo).to receive(:to_json).and_return(json)
    geo
  end

  # Helper: call flatten_entry and return the first (de) locale row
  def flatten_first(entry, mapper)
    ContentfulMappers.flatten_entry(entry, mapper).first
  end

  # =========================================================================
  # 1. Spot data structure compatibility
  # =========================================================================
  describe 'Spot data structure compatibility with ApiGenerator and TileGenerator' do
    let(:spot_entry) do
      build_entry(
        slug: 'thunersee-spiez',
        name: { de: 'Thunersee Spiez', en: 'Lake Thun Spiez' },
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A spot.' }] }] },
        location: build_location(46.6863, 7.6803),
        approximate_address: 'Seestrasse, 3700 Spiez',
        country: 'CH',
        confirmed: true,
        rejected: false,
        waterway: build_reference('thunersee'),
        spot_type: build_reference('launch-point'),
        paddling_environment_type: build_reference('lake'),
        paddle_craft_type: [build_reference('kayak'), build_reference('sup')],
        event_notices: [],
        obstacles: [],
        data_source_type: build_reference('community'),
        data_license_type: build_reference('cc-by-sa')
      )
    end

    let(:spot) { flatten_first(spot_entry, :map_spot) }

    it 'has slug for ApiGenerator sorting' do
      expect(spot).to have_key('slug')
      expect(spot['slug']).to be_a(String)
    end

    it 'has locale for ApiGenerator locale filtering' do
      expect(spot).to have_key('locale')
    end

    it 'has rejected for ApiGenerator exclusion filtering' do
      expect(spot).to have_key('rejected')
    end

    it 'has createdAt and updatedAt for ApiGenerator last-update tracking' do
      expect(spot).to have_key('createdAt')
      expect(spot).to have_key('updatedAt')
    end

    it 'has location with lat/lon for TileGenerator spatial tiling' do
      expect(spot).to have_key('location')
      expect(spot['location']).to have_key('lat')
      expect(spot['location']).to have_key('lon')
    end

    it 'has spotType_slug for TileGenerator tile data extraction' do
      expect(spot).to have_key('spotType_slug')
    end

    it 'has description for TileGenerator excerpt extraction' do
      expect(spot).to have_key('description')
    end

    it 'has approximateAddress for TileGenerator tile data' do
      expect(spot).to have_key('approximateAddress')
    end

    it 'has paddleCraftTypes as array for TileGenerator' do
      expect(spot).to have_key('paddleCraftTypes')
      expect(spot['paddleCraftTypes']).to be_an(Array)
    end

    it 'has name for TileGenerator tile data' do
      expect(spot).to have_key('name')
    end

    it 'has waterway_slug' do
      expect(spot).to have_key('waterway_slug')
    end

    it 'has confirmed' do
      expect(spot).to have_key('confirmed')
    end

    it 'has country' do
      expect(spot).to have_key('country')
    end
  end

  # =========================================================================
  # 2. Waterway data structure compatibility
  # =========================================================================
  describe 'Waterway data structure compatibility' do
    let(:waterway_entry) do
      build_entry(
        slug: 'thunersee',
        name: { de: 'Thunersee', en: 'Lake Thun' },
        length: 17.5,
        area: 48.4,
        geometry: build_geometry('{"type":"Polygon","coordinates":[[7.0,46.0]]}'),
        show_in_menu: true,
        paddling_environment_type: build_reference('lake'),
        data_source_type: build_reference('official'),
        data_license_type: build_reference('cc-by-sa')
      )
    end

    let(:waterway) { flatten_first(waterway_entry, :map_waterway) }

    %w[slug name locale length area geometry showInMenu createdAt updatedAt].each do |key|
      it "has '#{key}' key" do
        expect(waterway).to have_key(key)
      end
    end
  end

  # =========================================================================
  # 3. Obstacle data structure compatibility
  # =========================================================================
  describe 'Obstacle data structure compatibility' do
    let(:obstacle_entry) do
      build_entry(
        slug: 'weir-munsingen',
        name: 'Wehr Münsingen',
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A weir.' }] }] },
        geometry: build_geometry('{"type":"Point","coordinates":[7.5,46.8]}'),
        portage_route: build_geometry('{"type":"LineString","coordinates":[[7.5,46.8],[7.51,46.81]]}'),
        is_portage_possible: true,
        is_portage_necessary: true,
        obstacle_type: build_reference('weir'),
        waterway: build_reference('aare'),
        spots: [build_reference('spot-1')]
      )
    end

    let(:obstacle) { flatten_first(obstacle_entry, :map_obstacle) }

    %w[slug name locale geometry portageRoute isPortagePossible obstacleType_slug createdAt updatedAt].each do |key|
      it "has '#{key}' key" do
        expect(obstacle).to have_key(key)
      end
    end

    it 'geometry is a JSON string' do
      expect(obstacle['geometry']).to be_a(String)
    end
  end

  # =========================================================================
  # 4. Protected area data structure compatibility
  # =========================================================================
  describe 'Protected area data structure compatibility' do
    let(:pa_entry) do
      build_entry(
        slug: 'nature-reserve',
        name: 'Naturschutzgebiet',
        geometry: build_geometry('{"type":"Polygon","coordinates":[[7.6,46.7]]}'),
        is_area_marked: true,
        protected_area_type: build_reference('nature-reserve')
      )
    end

    let(:pa) { flatten_first(pa_entry, :map_protected_area) }

    %w[slug name locale geometry protectedAreaType_slug createdAt updatedAt].each do |key|
      it "has '#{key}' key" do
        expect(pa).to have_key(key)
      end
    end

    it 'geometry is a JSON string' do
      expect(pa['geometry']).to be_a(String)
    end
  end

  # =========================================================================
  # 5. Notice (event notice) data structure compatibility
  # =========================================================================
  describe 'Notice data structure compatibility' do
    let(:notice_entry) do
      start_date = double('StartDate')
      allow(start_date).to receive(:iso8601).and_return('2025-03-01T00:00:00Z')
      end_date = double('EndDate')
      allow(end_date).to receive(:iso8601).and_return('2025-03-31T23:59:59Z')

      build_entry(
        slug: 'flood-warning',
        name: 'Hochwasserwarnung',
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Flooding.' }] }] },
        location: build_location(46.95, 7.45),
        affected_area: build_geometry('{"type":"Polygon","coordinates":[[7.4,46.9]]}'),
        start_date: start_date,
        end_date: end_date,
        waterway: [build_reference('aare')]
      )
    end

    let(:notice) { flatten_first(notice_entry, :map_event_notice) }

    %w[slug name locale location description startDate endDate affectedArea waterways createdAt updatedAt].each do |key|
      it "has '#{key}' key" do
        expect(notice).to have_key(key)
      end
    end

    it 'location has lat/lon for TileGenerator' do
      expect(notice['location']).to have_key('lat')
      expect(notice['location']).to have_key('lon')
    end
  end

  # =========================================================================
  # 6. Type data structure compatibility
  # =========================================================================
  describe 'Type data structure compatibility' do
    let(:type_entry) do
      build_entry(
        slug: 'launch-point',
        name: { de: 'Einstiegsort', en: 'Launch Point' }
      )
    end

    let(:type_data) { flatten_first(type_entry, :map_type) }

    %w[slug name_de name_en locale createdAt updatedAt].each do |key|
      it "has '#{key}' key" do
        expect(type_data).to have_key(key)
      end
    end
  end

  # =========================================================================
  # 7. CONTENT_TYPES mapping completeness (all 13 content types)
  # =========================================================================
  describe 'CONTENT_TYPES mapping completeness' do
    let(:content_types) { Jekyll::ContentfulFetcher::CONTENT_TYPES }

    it 'maps exactly 14 content types' do
      expect(content_types.size).to eq(14)
    end

    %w[
      spot waterway obstacle protectedArea waterwayEventNotice
      spotType obstacleType paddleCraftType paddlingEnvironmentType
      protectedAreaType dataSourceType dataLicenseType spotTipType staticPage
    ].each do |ct|
      it "includes '#{ct}' content type" do
        expect(content_types).to have_key(ct)
      end
    end

    it 'each content type has a filename and mapper' do
      content_types.each do |ct, config|
        expect(config).to have_key(:filename), "#{ct} missing :filename"
        expect(config).to have_key(:mapper), "#{ct} missing :mapper"
      end
    end
  end

  # =========================================================================
  # 8. File path correctness — filenames match ApiGenerator expectations
  # =========================================================================
  describe 'File path correctness' do
    let(:content_types) { Jekyll::ContentfulFetcher::CONTENT_TYPES }

    {
      'spot'                  => 'spots',
      'waterway'              => 'waterways',
      'obstacle'              => 'obstacles',
      'protectedArea'         => 'protected_areas',
      'waterwayEventNotice'   => 'notices'
    }.each do |ct, expected_filename|
      it "maps '#{ct}' to '#{expected_filename}'" do
        expect(content_types[ct][:filename]).to eq(expected_filename)
      end
    end

    {
      'spotType'                 => 'types/spot_types',
      'obstacleType'             => 'types/obstacle_types',
      'paddleCraftType'          => 'types/paddle_craft_types',
      'paddlingEnvironmentType'  => 'types/paddling_environment_types',
      'protectedAreaType'        => 'types/protected_area_types',
      'dataSourceType'           => 'types/data_source_types',
      'dataLicenseType'          => 'types/data_license_types'
    }.each do |ct, expected_filename|
      it "maps '#{ct}' to '#{expected_filename}'" do
        expect(content_types[ct][:filename]).to eq(expected_filename)
      end
    end

    it "maps 'staticPage' to 'static_pages'" do
      expect(content_types['staticPage'][:filename]).to eq('static_pages')
    end

    it 'fact table filenames match ApiGenerator FACT_TABLES data_keys' do
      api_fact_keys = Jekyll::ApiGenerator::FACT_TABLES.values.map { |c| c[:data_key] }
      fetcher_fact_filenames = %w[spot waterway obstacle protectedArea waterwayEventNotice].map { |ct| content_types[ct][:filename] }
      expect(fetcher_fact_filenames).to match_array(api_fact_keys)
    end

    it 'dimension table filenames match ApiGenerator DIMENSION_TABLES data_keys' do
      api_dim_keys = Jekyll::ApiGenerator::DIMENSION_TABLES.values.map { |c| c[:data_key] }
      fetcher_dim_filenames = %w[spotType obstacleType paddleCraftType paddlingEnvironmentType protectedAreaType dataSourceType dataLicenseType].map { |ct| content_types[ct][:filename] }
      expect(fetcher_dim_filenames).to match_array(api_dim_keys)
    end
  end

  # =========================================================================
  # 9. site.data key path correctness — write_yaml updates correct paths
  # =========================================================================
  describe 'site.data key path correctness' do
    let(:site) { instance_double(Jekyll::Site) }
    let(:data_hash) { {} }
    let(:tmpdir) { Dir.mktmpdir }

    before do
      allow(site).to receive(:source).and_return(tmpdir)
      allow(site).to receive(:data).and_return(data_hash)
      allow(site).to receive(:config).and_return({})
      FileUtils.mkdir_p(File.join(tmpdir, '_data', 'types'))
    end

    after do
      FileUtils.rm_rf(tmpdir)
    end

    let(:fetcher) do
      f = Jekyll::ContentfulFetcher.new
      f.instance_variable_set(:@site, site)
      f.instance_variable_set(:@data_dir, File.join(tmpdir, '_data'))
      f
    end

    it 'writes top-level data keys for fact tables' do
      fetcher.send(:write_yaml, 'spots', [{ 'slug' => 'test' }])
      expect(data_hash['spots']).to eq([{ 'slug' => 'test' }])
    end

    it 'writes nested data keys for type tables' do
      fetcher.send(:write_yaml, 'types/spot_types', [{ 'slug' => 'launch-point' }])
      expect(data_hash['types']).to be_a(Hash)
      expect(data_hash['types']['spot_types']).to eq([{ 'slug' => 'launch-point' }])
    end

    it 'ApiGenerator can resolve top-level data keys written by fetcher' do
      fetcher.send(:write_yaml, 'spots', [{ 'slug' => 'a', 'locale' => 'de' }])
      keys = 'spots'.split('/')
      resolved = data_hash
      keys.each { |k| resolved = resolved[k] }
      expect(resolved).to eq([{ 'slug' => 'a', 'locale' => 'de' }])
    end

    it 'ApiGenerator can resolve nested data keys written by fetcher' do
      fetcher.send(:write_yaml, 'types/spot_types', [{ 'slug' => 'x' }])
      keys = 'types/spot_types'.split('/')
      resolved = data_hash
      keys.each { |k| resolved = resolved[k] }
      expect(resolved).to eq([{ 'slug' => 'x' }])
    end

    it 'writes YAML file to disk at correct path for top-level' do
      fetcher.send(:write_yaml, 'spots', [{ 'slug' => 'test' }])
      filepath = File.join(tmpdir, '_data', 'spots.yml')
      expect(File.exist?(filepath)).to be true
    end

    it 'writes YAML file to disk at correct path for nested types' do
      fetcher.send(:write_yaml, 'types/obstacle_types', [{ 'slug' => 'weir' }])
      filepath = File.join(tmpdir, '_data', 'types', 'obstacle_types.yml')
      expect(File.exist?(filepath)).to be true
    end
  end

  # =========================================================================
  # 10. Types subdirectory — type content types use types/ prefix
  # =========================================================================
  describe 'Types subdirectory' do
    let(:content_types) { Jekyll::ContentfulFetcher::CONTENT_TYPES }

    type_content_types = %w[spotType obstacleType paddleCraftType paddlingEnvironmentType protectedAreaType dataSourceType dataLicenseType]

    type_content_types.each do |ct|
      it "'#{ct}' filename starts with 'types/'" do
        expect(content_types[ct][:filename]).to start_with('types/')
      end
    end

    non_type_content_types = %w[spot waterway obstacle protectedArea waterwayEventNotice staticPage]

    non_type_content_types.each do |ct|
      it "'#{ct}' filename does NOT start with 'types/'" do
        expect(content_types[ct][:filename]).not_to start_with('types/')
      end
    end
  end
end
