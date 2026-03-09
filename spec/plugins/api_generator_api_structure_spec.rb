# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'json'

# **Validates: Requirements 1.1–1.46, 2.1–2.37**
# Property 1: Bug Condition — API JSON Structure Diverges from Gatsby Output
#
# This test encodes the EXPECTED Gatsby-compatible behavior.
# On UNFIXED code it MUST FAIL, confirming the bug exists.
# After the fix, it MUST PASS, confirming all defects are resolved.
RSpec.describe 'ApiGenerator API structure (Bug Condition Exploration)' do
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
  # Mock data — representative entries for every content type
  # ---------------------------------------------------------------------------

  let(:spot_de) do
    {
      'locale' => 'de',
      'slug' => 'test-spot',
      'name' => 'Test Spot',
      'description' => '<p>Eine Beschreibung</p>',
      'location' => { 'lat' => 47.0, 'lon' => 8.0 },
      'approximateAddress' => 'Flösserstrasse 7, 5000 Aarau',
      'country' => 'CH',
      'confirmed' => true,
      'rejected' => nil,
      'waterway_slug' => 'aare',
      'spotType_slug' => 'einstieg',
      'paddlingEnvironmentType_slug' => 'fluss',
      'paddleCraftTypes' => %w[seekajak kanadier],
      'eventNotices' => [],
      'obstacles' => [],
      'dataSourceType_slug' => 'community',
      'dataLicenseType_slug' => 'cc-by',
      'createdAt' => '2023-11-23T09:28:19Z',
      'updatedAt' => '2024-06-15T14:30:00Z'
    }
  end

  let(:spot_en) do
    spot_de.merge(
      'locale' => 'en',
      'name' => 'Test Spot EN',
      'description' => '<p>A description</p>',
      'updatedAt' => '2024-06-15T14:25:00Z'
    )
  end

  let(:obstacle_de) do
    {
      'locale' => 'de',
      'slug' => 'test-obstacle',
      'name' => 'Test Wehr',
      'description' => '<p>Gefährliches Wehr</p>',
      'geometry' => '{"type":"Point","coordinates":[8.0,47.0]}',
      'portageRoute' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.1,47.1]]}',
      'portageDistance' => 200,
      'portageDescription' => '<p>Umtragen links</p>',
      'isPortageNecessary' => true,
      'isPortagePossible' => true,
      'obstacleType_slug' => 'wehr',
      'waterway_slug' => 'aare',
      'spots' => ['test-spot'],
      'dataSourceType_slug' => 'community',
      'dataLicenseType_slug' => 'cc-by',
      'createdAt' => '2023-10-01T08:00:00Z',
      'updatedAt' => '2024-05-20T10:00:00Z'
    }
  end

  let(:obstacle_en) do
    obstacle_de.merge(
      'locale' => 'en',
      'name' => 'Test Weir',
      'description' => '<p>Dangerous weir</p>',
      'portageDescription' => '<p>Portage left</p>',
      'updatedAt' => '2024-05-20T09:00:00Z'
    )
  end

  let(:notice_de) do
    {
      'locale' => 'de',
      'slug' => 'test-notice',
      'name' => 'Sperrung Aare',
      'description' => '<p>Gesperrt wegen Hochwasser</p>',
      'location' => { 'lat' => 47.0, 'lon' => 8.0 },
      'affectedArea' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
      'startDate' => '2024-07-01T00:00:00+00:00',
      'endDate' => '2024-07-31T00:00:00+00:00',
      'waterways' => ['aare'],
      'dataSourceType_slug' => 'community',
      'dataLicenseType_slug' => 'cc-by',
      'createdAt' => '2024-06-01T12:00:00Z',
      'updatedAt' => '2024-06-28T16:00:00Z'
    }
  end

  let(:notice_en) do
    notice_de.merge(
      'locale' => 'en',
      'name' => 'Aare Closure',
      'description' => '<p>Closed due to flooding</p>',
      'updatedAt' => '2024-06-28T15:00:00Z'
    )
  end

  let(:waterway_de) do
    {
      'locale' => 'de',
      'slug' => 'aare',
      'name' => 'Aare',
      'length' => 288,
      'area' => nil,
      'geometry' => '{"type":"LineString","coordinates":[[8.0,47.0],[8.5,47.5]]}',
      'showInMenu' => true,
      'paddlingEnvironmentType_slug' => 'fluss',
      'dataSourceType_slug' => 'community',
      'dataLicenseType_slug' => 'cc-by',
      'createdAt' => '2023-01-01T00:00:00Z',
      'updatedAt' => '2024-03-10T08:00:00Z'
    }
  end

  let(:waterway_en) do
    waterway_de.merge(
      'locale' => 'en',
      'updatedAt' => '2024-03-10T07:00:00Z'
    )
  end

  let(:protected_area_de) do
    {
      'locale' => 'de',
      'slug' => 'test-schutzgebiet',
      'name' => 'Naturschutzgebiet Aarau',
      'geometry' => '{"type":"Polygon","coordinates":[[[8.0,47.0],[8.1,47.0],[8.1,47.1],[8.0,47.1],[8.0,47.0]]]}',
      'isAreaMarked' => true,
      'protectedAreaType_slug' => 'naturschutzgebiet',
      'createdAt' => '2023-05-01T10:00:00Z',
      'updatedAt' => '2024-04-01T12:00:00Z'
    }
  end

  let(:protected_area_en) do
    protected_area_de.merge(
      'locale' => 'en',
      'name' => 'Nature Reserve Aarau',
      'updatedAt' => '2024-04-01T11:00:00Z'
    )
  end

  # Dimension tables — each type has slug, name_de, name_en, createdAt, updatedAt
  let(:spot_type) do
    { 'slug' => 'einstieg', 'name_de' => 'Einstieg', 'name_en' => 'Put-in',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:obstacle_type) do
    { 'slug' => 'wehr', 'name_de' => 'Wehr', 'name_en' => 'Weir',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:paddle_craft_type) do
    { 'slug' => 'seekajak', 'name_de' => 'Seekajak', 'name_en' => 'Sea Kayak',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:paddling_env_type) do
    { 'slug' => 'fluss', 'name_de' => 'Fluss', 'name_en' => 'River',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:protected_area_type) do
    { 'slug' => 'naturschutzgebiet', 'name_de' => 'Naturschutzgebiet', 'name_en' => 'Nature Reserve',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:data_source_type) do
    { 'slug' => 'community', 'name_de' => 'Community', 'name_en' => 'Community',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end
  let(:data_license_type) do
    { 'slug' => 'cc-by', 'name_de' => 'CC BY 4.0', 'name_en' => 'CC BY 4.0',
      'createdAt' => '2023-01-01T00:00:00Z', 'updatedAt' => '2023-06-01T00:00:00Z' }
  end

  # Wire up site.data
  before do
    site.data['spots'] = [spot_de, spot_en]
    site.data['obstacles'] = [obstacle_de, obstacle_en]
    site.data['notices'] = [notice_de, notice_en]
    site.data['protected_areas'] = [protected_area_de, protected_area_en]
    site.data['waterways'] = [waterway_de, waterway_en]
    site.data['types'] = {
      'spot_types' => [spot_type],
      'obstacle_types' => [obstacle_type],
      'paddle_craft_types' => [paddle_craft_type],
      'paddling_environment_types' => [paddling_env_type],
      'protected_area_types' => [protected_area_type],
      'data_source_types' => [data_source_type],
      'data_license_types' => [data_license_type]
    }
  end

  # Run the generator and collect pages
  let(:generated_pages) do
    generator = Jekyll::ApiGenerator.new
    generator.generate(site)
    site.pages
  end

  def find_page(name)
    generated_pages.find { |p| p.name == name }
  end

  def parse_page(name)
    page = find_page(name)
    raise "Page #{name} not found. Available: #{generated_pages.map(&:name).join(', ')}" unless page
    JSON.parse(page.content)
  end

  # ===========================================================================
  # FILE NAMING ASSERTIONS
  # ===========================================================================
  describe 'file naming' do
    it 'produces waterwayevents-de.json (not notices-de.json)' do
      expect(find_page('waterwayevents-de.json')).not_to be_nil,
        "Expected waterwayevents-de.json but got: #{generated_pages.map(&:name).sort.join(', ')}"
    end

    it 'produces waterwayevents-en.json (not notices-en.json)' do
      expect(find_page('waterwayevents-en.json')).not_to be_nil
    end

    it 'produces protectedareas-de.json (not protected-areas-de.json)' do
      expect(find_page('protectedareas-de.json')).not_to be_nil,
        "Expected protectedareas-de.json but got: #{generated_pages.map(&:name).sort.join(', ')}"
    end

    it 'produces protectedareas-en.json (not protected-areas-en.json)' do
      expect(find_page('protectedareas-en.json')).not_to be_nil
    end
  end

  # ===========================================================================
  # FACT TABLE STRUCTURE — SPOTS
  # ===========================================================================
  describe 'spots fact table structure' do
    let(:spots_data) { parse_page('spots-de.json') }
    let(:spot) { spots_data.first }

    it 'has slug as the first field' do
      expect(spot.keys.first).to eq('slug'),
        "Expected first field to be 'slug', got '#{spot.keys.first}'. Field order: #{spot.keys.join(', ')}"
    end

    it 'uses node_locale not locale' do
      expect(spot).to have_key('node_locale'),
        "Expected 'node_locale' field but found keys: #{spot.keys.join(', ')}"
      expect(spot).not_to have_key('locale'),
        "Expected no 'locale' field but it was present"
    end

    it 'wraps description in {"raw": "..."} format' do
      desc = spot['description']
      expect(desc).to be_a(Hash), "Expected description to be a Hash, got #{desc.class}: #{desc.inspect}"
      expect(desc).to have_key('raw'), "Expected description to have 'raw' key, got: #{desc.inspect}"
    end

    it 'wraps approximateAddress in {"approximateAddress": "..."} nested object' do
      addr = spot['approximateAddress']
      expect(addr).to be_a(Hash), "Expected approximateAddress to be a Hash, got #{addr.class}: #{addr.inspect}"
      expect(addr).to have_key('approximateAddress'),
        "Expected nested 'approximateAddress' key, got: #{addr.inspect}"
    end

    it 'preserves null for rejected (not converted to false)' do
      expect(spot['rejected']).to be_nil,
        "Expected rejected to be nil, got: #{spot['rejected'].inspect}"
    end

    it 'has waterway as {"slug": "..."} object' do
      ww = spot['waterway']
      expect(ww).to be_a(Hash), "Expected waterway to be a Hash, got #{ww.class}: #{ww.inspect}"
      expect(ww).to eq({ 'slug' => 'aare' })
    end

    it 'has spotType as {"slug": "..."} object' do
      st = spot['spotType']
      expect(st).to be_a(Hash), "Expected spotType to be a Hash, got #{st.class}: #{st.inspect}"
      expect(st).to eq({ 'slug' => 'einstieg' })
    end

    it 'has paddlingEnvironmentType as {"slug": "..."} object' do
      pet = spot['paddlingEnvironmentType']
      expect(pet).to be_a(Hash), "Expected paddlingEnvironmentType to be a Hash, got #{pet.class}: #{pet.inspect}"
      expect(pet).to eq({ 'slug' => 'fluss' })
    end

    it 'has paddleCraftType (not paddleCraftTypes) as array of {"slug": "..."} objects' do
      expect(spot).to have_key('paddleCraftType'),
        "Expected 'paddleCraftType' field, found keys: #{spot.keys.join(', ')}"
      expect(spot).not_to have_key('paddleCraftTypes'),
        "Expected no 'paddleCraftTypes' field but it was present"
      pct = spot['paddleCraftType']
      expect(pct).to be_an(Array)
      expect(pct).to eq([{ 'slug' => 'seekajak' }, { 'slug' => 'kanadier' }])
    end

    it 'has waterway_event_notice (not eventNotices) as null when empty' do
      expect(spot).to have_key('waterway_event_notice'),
        "Expected 'waterway_event_notice' field, found keys: #{spot.keys.join(', ')}"
      expect(spot).not_to have_key('eventNotices'),
        "Expected no 'eventNotices' field but it was present"
      expect(spot['waterway_event_notice']).to be_nil,
        "Expected waterway_event_notice to be nil when empty, got: #{spot['waterway_event_notice'].inspect}"
    end

    it 'has obstacle (not obstacles) as null when empty' do
      expect(spot).to have_key('obstacle'),
        "Expected 'obstacle' field, found keys: #{spot.keys.join(', ')}"
      expect(spot).not_to have_key('obstacles'),
        "Expected no 'obstacles' field but it was present"
      expect(spot['obstacle']).to be_nil,
        "Expected obstacle to be nil when empty, got: #{spot['obstacle'].inspect}"
    end

    it 'has dataSourceType as {"slug": "..."} object' do
      dst = spot['dataSourceType']
      expect(dst).to be_a(Hash), "Expected dataSourceType to be a Hash, got #{dst.class}: #{dst.inspect}"
      expect(dst).to eq({ 'slug' => 'community' })
    end

    it 'has dataLicenseType as {"slug": "..."} object' do
      dlt = spot['dataLicenseType']
      expect(dlt).to be_a(Hash), "Expected dataLicenseType to be a Hash, got #{dlt.class}: #{dlt.inspect}"
      expect(dlt).to eq({ 'slug' => 'cc-by' })
    end
  end

  # ===========================================================================
  # FACT TABLE STRUCTURE — OBSTACLES
  # ===========================================================================
  describe 'obstacles fact table structure' do
    let(:obstacles_data) { parse_page('obstacles-de.json') }
    let(:obstacle) { obstacles_data.first }

    it 'wraps geometry in {"internal": {"content": "..."}} format' do
      geo = obstacle['geometry']
      expect(geo).to be_a(Hash), "Expected geometry to be a Hash, got #{geo.class}: #{geo.inspect}"
      expect(geo).to have_key('internal')
      expect(geo['internal']).to have_key('content')
    end

    it 'wraps portageRoute in {"internal": {"content": "..."}} format' do
      pr = obstacle['portageRoute']
      expect(pr).to be_a(Hash), "Expected portageRoute to be a Hash, got #{pr.class}: #{pr.inspect}"
      expect(pr).to have_key('internal')
      expect(pr['internal']).to have_key('content')
    end

    it 'wraps description in {"raw": "..."} format' do
      desc = obstacle['description']
      expect(desc).to be_a(Hash), "Expected description to be a Hash, got #{desc.class}: #{desc.inspect}"
      expect(desc).to have_key('raw')
    end

    it 'wraps portageDescription in {"raw": "..."} format' do
      pd = obstacle['portageDescription']
      expect(pd).to be_a(Hash), "Expected portageDescription to be a Hash, got #{pd.class}: #{pd.inspect}"
      expect(pd).to have_key('raw')
    end

    it 'does not include a spots field' do
      expect(obstacle).not_to have_key('spots'),
        "Expected no 'spots' field in obstacles, but it was present: #{obstacle['spots'].inspect}"
    end

    it 'has dataSourceType as {"slug": "..."} object' do
      dst = obstacle['dataSourceType']
      expect(dst).to be_a(Hash), "Expected dataSourceType to be a Hash, got #{dst.class}: #{dst.inspect}"
      expect(dst['slug']).to be_a(String)
    end

    it 'has dataLicenseType as {"slug": "..."} object' do
      dlt = obstacle['dataLicenseType']
      expect(dlt).to be_a(Hash), "Expected dataLicenseType to be a Hash, got #{dlt.class}: #{dlt.inspect}"
      expect(dlt['slug']).to be_a(String)
    end
  end

  # ===========================================================================
  # FACT TABLE STRUCTURE — WATERWAY EVENTS
  # ===========================================================================
  describe 'waterway events fact table structure' do
    # This test uses the Gatsby-compatible file name
    let(:events_data) do
      # Try the correct name first; fall back to the buggy name for parsing
      page = find_page('waterwayevents-de.json') || find_page('notices-de.json')
      raise "Neither waterwayevents-de.json nor notices-de.json found" unless page
      JSON.parse(page.content)
    end
    let(:event) { events_data.first }

    it 'has date-only startDate (first 10 chars)' do
      sd = event['startDate']
      expect(sd).to match(/\A\d{4}-\d{2}-\d{2}\z/),
        "Expected date-only startDate like '2024-07-01', got: #{sd.inspect}"
    end

    it 'has date-only endDate (first 10 chars)' do
      ed = event['endDate']
      expect(ed).to match(/\A\d{4}-\d{2}-\d{2}\z/),
        "Expected date-only endDate like '2024-07-31', got: #{ed.inspect}"
    end

    it 'has waterway as array of {"slug": "..."} objects' do
      ww = event['waterway']
      expect(ww).to be_an(Array), "Expected waterway to be an Array, got #{ww.class}: #{ww.inspect}"
      expect(ww.first).to be_a(Hash)
      expect(ww.first).to have_key('slug')
    end

    it 'has spot field present (null or array)' do
      expect(event).to have_key('spot'),
        "Expected 'spot' field, found keys: #{event.keys.join(', ')}"
    end

    it 'does not include a location field' do
      expect(event).not_to have_key('location'),
        "Expected no 'location' field in waterway events, but it was present"
    end

    it 'has dataSourceType as {"slug": "..."} object' do
      dst = event['dataSourceType']
      expect(dst).to be_a(Hash), "Expected dataSourceType to be a Hash, got #{dst.class}: #{dst.inspect}"
    end

    it 'has dataLicenseType as {"slug": "..."} object' do
      dlt = event['dataLicenseType']
      expect(dlt).to be_a(Hash), "Expected dataLicenseType to be a Hash, got #{dlt.class}: #{dlt.inspect}"
    end
  end

  # ===========================================================================
  # FACT TABLE STRUCTURE — WATERWAYS
  # ===========================================================================
  describe 'waterways fact table structure' do
    let(:waterways_data) { parse_page('waterways-de.json') }
    let(:waterway) { waterways_data.first }

    it 'wraps geometry in {"internal": {"content": "..."}} format' do
      geo = waterway['geometry']
      expect(geo).to be_a(Hash), "Expected geometry to be a Hash, got #{geo.class}: #{geo.inspect}"
      expect(geo).to have_key('internal')
      expect(geo['internal']).to have_key('content')
    end

    it 'does not include a showInMenu field' do
      expect(waterway).not_to have_key('showInMenu'),
        "Expected no 'showInMenu' field in waterways, but it was present"
    end

    it 'has paddlingEnvironmentType as {"slug": "..."} object' do
      pet = waterway['paddlingEnvironmentType']
      expect(pet).to be_a(Hash), "Expected paddlingEnvironmentType to be a Hash, got #{pet.class}: #{pet.inspect}"
      expect(pet).to eq({ 'slug' => 'fluss' })
    end

    it 'has dataSourceType as {"slug": "..."} object' do
      dst = waterway['dataSourceType']
      expect(dst).to be_a(Hash), "Expected dataSourceType to be a Hash, got #{dst.class}: #{dst.inspect}"
      expect(dst).to eq({ 'slug' => 'community' })
    end

    it 'has dataLicenseType as {"slug": "..."} object' do
      dlt = waterway['dataLicenseType']
      expect(dlt).to be_a(Hash), "Expected dataLicenseType to be a Hash, got #{dlt.class}: #{dlt.inspect}"
      expect(dlt).to eq({ 'slug' => 'cc-by' })
    end
  end

  # ===========================================================================
  # FACT TABLE STRUCTURE — PROTECTED AREAS
  # ===========================================================================
  describe 'protected areas fact table structure' do
    let(:pa_data) do
      page = find_page('protectedareas-de.json') || find_page('protected-areas-de.json')
      raise "Neither protectedareas-de.json nor protected-areas-de.json found" unless page
      JSON.parse(page.content)
    end
    let(:pa) { pa_data.first }

    it 'includes description field (as {"raw": "..."} or null)' do
      expect(pa).to have_key('description'),
        "Expected 'description' field in protected areas, found keys: #{pa.keys.join(', ')}"
    end

    it 'includes waterway references (array of {"slug": "..."} or null)' do
      expect(pa).to have_key('waterway'),
        "Expected 'waterway' field in protected areas, found keys: #{pa.keys.join(', ')}"
    end

    it 'has dataSourceType field' do
      expect(pa).to have_key('dataSourceType'),
        "Expected 'dataSourceType' field in protected areas, found keys: #{pa.keys.join(', ')}"
    end

    it 'has dataLicenseType field' do
      expect(pa).to have_key('dataLicenseType'),
        "Expected 'dataLicenseType' field in protected areas, found keys: #{pa.keys.join(', ')}"
    end

    it 'has protectedAreaType as {"slug": "..."} object' do
      pat = pa['protectedAreaType']
      expect(pat).to be_a(Hash), "Expected protectedAreaType to be a Hash, got #{pat.class}: #{pat.inspect}"
      expect(pat).to have_key('slug')
    end
  end

  # ===========================================================================
  # DIMENSION TABLE STRUCTURE
  # ===========================================================================
  describe 'dimension table structure' do
    let(:spot_types_data) { parse_page('spottypes-de.json') }
    let(:spot_type_entry) { spot_types_data.first }

    it 'includes node_locale field' do
      expect(spot_type_entry).to have_key('node_locale'),
        "Expected 'node_locale' in dimension table, found keys: #{spot_type_entry.keys.join(', ')}"
    end

    it 'has correct field order: slug, node_locale, createdAt, updatedAt, name, then additional' do
      keys = spot_type_entry.keys
      expect(keys[0]).to eq('slug'), "Expected first field 'slug', got '#{keys[0]}'"
      expect(keys[1]).to eq('node_locale'), "Expected second field 'node_locale', got '#{keys[1]}'"
      expect(keys[2]).to eq('createdAt'), "Expected third field 'createdAt', got '#{keys[2]}'"
      expect(keys[3]).to eq('updatedAt'), "Expected fourth field 'updatedAt', got '#{keys[3]}'"
      expect(keys[4]).to eq('name'), "Expected fifth field 'name', got '#{keys[4]}'"
    end

    it 'paddlecrafttypes has description as {"raw": "..."}' do
      pct_data = parse_page('paddlecrafttypes-de.json')
      pct = pct_data.first
      expect(pct).to have_key('description'),
        "Expected 'description' in paddlecrafttypes, found keys: #{pct.keys.join(', ')}"
      if pct['description']
        expect(pct['description']).to be_a(Hash)
        expect(pct['description']).to have_key('raw')
      end
    end

    it 'datasourcetypes has description as {"raw": "..."}' do
      dst_data = parse_page('datasourcetypes-de.json')
      dst = dst_data.first
      expect(dst).to have_key('description'),
        "Expected 'description' in datasourcetypes, found keys: #{dst.keys.join(', ')}"
      if dst['description']
        expect(dst['description']).to be_a(Hash)
        expect(dst['description']).to have_key('raw')
      end
    end

    it 'datalicensetypes has summaryUrl and fullTextUrl' do
      dlt_data = parse_page('datalicensetypes-de.json')
      dlt = dlt_data.first
      expect(dlt).to have_key('summaryUrl'),
        "Expected 'summaryUrl' in datalicensetypes, found keys: #{dlt.keys.join(', ')}"
      expect(dlt).to have_key('fullTextUrl'),
        "Expected 'fullTextUrl' in datalicensetypes, found keys: #{dlt.keys.join(', ')}"
    end
  end

  # ===========================================================================
  # TIMESTAMP FORMAT
  # ===========================================================================
  describe 'timestamp format' do
    let(:spots_data) { parse_page('spots-de.json') }

    it 'all createdAt/updatedAt match ISO 8601 with Z suffix' do
      ts_regex = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\z/

      # Check spots
      spots_data.each do |item|
        expect(item['createdAt']).to match(ts_regex),
          "Spot createdAt '#{item['createdAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
        expect(item['updatedAt']).to match(ts_regex),
          "Spot updatedAt '#{item['updatedAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
      end

      # Check obstacles
      obstacles_data = parse_page('obstacles-de.json')
      obstacles_data.each do |item|
        expect(item['createdAt']).to match(ts_regex),
          "Obstacle createdAt '#{item['createdAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
        expect(item['updatedAt']).to match(ts_regex),
          "Obstacle updatedAt '#{item['updatedAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
      end

      # Check dimension tables
      st_data = parse_page('spottypes-de.json')
      st_data.each do |item|
        expect(item['createdAt']).to match(ts_regex),
          "SpotType createdAt '#{item['createdAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
        expect(item['updatedAt']).to match(ts_regex),
          "SpotType updatedAt '#{item['updatedAt']}' does not match YYYY-MM-DDTHH:MM:SSZ"
      end
    end
  end

  # ===========================================================================
  # JSON FORMATTING
  # ===========================================================================
  describe 'JSON formatting' do
    it 'all output is compact single-line JSON (no newlines within content)' do
      generated_pages.each do |page|
        next unless page.name.end_with?('.json')
        content = page.content
        # Compact JSON should be a single line (no embedded newlines)
        lines = content.strip.split("\n")
        expect(lines.size).to eq(1),
          "Expected #{page.name} to be compact single-line JSON, but got #{lines.size} lines. " \
          "First 100 chars: #{content[0..100].inspect}"
      end
    end
  end

  # ===========================================================================
  # LAST UPDATE INDEX
  # ===========================================================================
  describe 'last update index' do
    let(:index_data) { parse_page('lastUpdateIndex.json') }

    let(:expected_table_names) do
      %w[
        dataLicenseTypes dataSourceTypes obstacles obstacleTypes
        paddleCraftTypes paddlingEnvironmentTypes protectedAreaTypes
        protectedAreas spots spotTypes waterwayEventNotices waterways
      ].sort
    end

    it 'has exactly 12 entries' do
      expect(index_data.size).to eq(12),
        "Expected 12 last update entries, got #{index_data.size}: #{index_data.map { |e| e['table'] }.join(', ')}"
    end

    it 'uses camelCase names with s suffix' do
      table_names = index_data.map { |e| e['table'] }.sort
      expect(table_names).to eq(expected_table_names),
        "Expected table names #{expected_table_names.inspect}, got #{table_names.inspect}"
    end

    it 'has single max timestamp per content type across locales' do
      # Each table name should appear exactly once
      table_names = index_data.map { |e| e['table'] }
      expect(table_names.uniq.size).to eq(table_names.size),
        "Expected unique table names, but found duplicates: #{table_names.inspect}"
    end
  end
end
