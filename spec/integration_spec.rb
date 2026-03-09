# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'yaml'
require 'json'
require 'fileutils'

# Integration tests for the full Contentful fetch pipeline:
#   ContentfulFetcher → ContentfulMappers → YAML files → site.data → ApiGenerator / TileGenerator
#
# Requirements: 1.7, 1.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7

RSpec.describe 'Integration: Contentful fetch pipeline' do
  let(:tmpdir)   { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:dest_dir) { File.join(tmpdir, '_site') }
  let(:site_data) { {} }
  let(:site_config) { {} }

  let(:site) do
    pages = []
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:dest).and_return(dest_dir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return(site_data)
    allow(s).to receive(:pages).and_return(pages)
    allow(s).to receive(:in_theme_dir) { |*args| File.join(*args) }
    allow(s).to receive(:in_source_dir) { |*args| File.join(*args) }
    allow(s).to receive(:in_dest_dir) { |*args| File.join(dest_dir, *args.drop(1)) }
    s
  end

  let(:fetcher)       { Jekyll::ContentfulFetcher.new }
  let(:api_generator) { Jekyll::ApiGenerator.new }
  let(:tile_generator) { Jekyll::TileGenerator.new }
  let(:mock_client)   { double('Contentful::Client') }

  # ── ENV management ──────────────────────────────────────────────────
  around do |example|
    saved = %w[
      CONTENTFUL_SPACE_ID CONTENTFUL_ACCESS_TOKEN
      CONTENTFUL_ENVIRONMENT CONTENTFUL_FORCE_SYNC
    ].map { |k| [k, ENV[k]] }.to_h
    example.run
  ensure
    saved.each { |k, v| ENV[k] = v }
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  before do
    FileUtils.mkdir_p(data_dir)
    FileUtils.mkdir_p(File.join(data_dir, 'types'))
    FileUtils.mkdir_p(dest_dir)

    ENV['CONTENTFUL_SPACE_ID']     = 'test_space'
    ENV['CONTENTFUL_ACCESS_TOKEN'] = 'test_token'
    ENV.delete('CONTENTFUL_ENVIRONMENT')
    ENV.delete('CONTENTFUL_FORCE_SYNC')

    allow(fetcher).to receive(:client).and_return(mock_client)
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
    allow(Jekyll.logger).to receive(:debug)

    # Stub initial_sync via client.sync(initial: true)
    sync_page = double('SyncPage',
      items: [],
      next_page?: false,
      next_sync_url: 'https://cdn.contentful.com/spaces/test_space/sync?sync_token=integration_token'
    )
    sync_obj = double('Sync', first_page: sync_page)
    allow(mock_client).to receive(:sync).with(initial: true).and_return(sync_obj)
  end

  # ── Mock Contentful entry builders (locale: '*' / fields_with_locales) ──

  def build_sys(id:, created: '2025-01-10T08:30:00Z', updated: '2025-01-10T08:30:00Z')
    {
      id: id,
      created_at: Time.parse(created),
      updated_at: Time.parse(updated)
    }
  end

  def build_location(lat:, lon:)
    loc = double('Location')
    allow(loc).to receive(:lat).and_return(lat)
    allow(loc).to receive(:lon).and_return(lon)
    loc
  end

  def build_reference(slug:)
    ref = double("Ref:#{slug}")
    allow(ref).to receive(:respond_to?).with(anything).and_return(false)
    allow(ref).to receive(:respond_to?).with(:fields_with_locales).and_return(true)
    allow(ref).to receive(:fields_with_locales).and_return({ slug: { en: slug } })
    allow(ref).to receive(:sys).and_return({ id: slug })
    ref
  end

  # Build a fields_with_locales hash. Values can be plain (stored under :en)
  # or locale hashes like { de: 'x', en: 'y' }.
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

  def build_spot_entry(slug:, name:, lat:, lon:, confirmed: true, rejected: false,
                       spot_type_slug: 'launch-point', waterway_slug: 'thunersee')
    # name should be a hash like { de: '...', en: '...' }
    name_hash = name.is_a?(Hash) ? name : { en: name }

    fields = build_fields(
      slug: slug,
      name: name_hash,
      description: nil,
      location: build_location(lat: lat, lon: lon),
      approximate_address: 'Seestrasse, 3700 Spiez',
      country: 'CH',
      confirmed: confirmed,
      rejected: rejected,
      waterway: build_reference(slug: waterway_slug),
      spot_type: build_reference(slug: spot_type_slug),
      paddling_environment_type: build_reference(slug: 'lake'),
      paddle_craft_type: [build_reference(slug: 'kayak'), build_reference(slug: 'sup')],
      event_notices: [],
      obstacles: [],
      data_source_type: build_reference(slug: 'community'),
      data_license_type: build_reference(slug: 'cc-by-sa')
    )

    entry = double("SpotEntry:#{slug}")
    allow(entry).to receive(:sys).and_return(build_sys(id: slug))
    allow(entry).to receive(:fields_with_locales).and_return(fields)
    entry
  end

  def build_waterway_entry(slug:, name:)
    name_hash = name.is_a?(Hash) ? name : { en: name }

    fields = build_fields(
      slug: slug,
      name: name_hash,
      length: 17.5,
      area: 48.4,
      geometry: nil,
      show_in_menu: true,
      paddling_environment_type: build_reference(slug: 'lake'),
      data_source_type: build_reference(slug: 'official'),
      data_license_type: build_reference(slug: 'cc-by-sa')
    )

    entry = double("WaterwayEntry:#{slug}")
    allow(entry).to receive(:sys).and_return(build_sys(id: slug))
    allow(entry).to receive(:fields_with_locales).and_return(fields)
    entry
  end

  def build_type_entry(slug:, name_de:, name_en:)
    fields = build_fields(
      slug: slug,
      name: { de: name_de, en: name_en }
    )

    entry = double("TypeEntry:#{slug}")
    allow(entry).to receive(:sys).and_return(build_sys(id: slug))
    allow(entry).to receive(:fields_with_locales).and_return(fields)
    entry
  end

  # ── Stub helpers ────────────────────────────────────────────────────

  def stub_entries_for(content_type_entries)
    allow(mock_client).to receive(:entries) do |args|
      ct = args[:content_type]
      content_type_entries[ct] || []
    end
  end

  # Write site.pages to disk (simulates Jekyll's write phase for PageWithoutAFile)
  def write_pages_to_disk(site)
    site.pages.each do |page|
      # Use the raw @dir and @name to avoid triggering url/permalink resolution
      dir = File.join(site.dest, page.instance_variable_get(:@dir))
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, page.name), page.content)
    end
  end


  # ═══════════════════════════════════════════════════════════════════
  # 1. Full fetch flow: fetch → transform → write YAML → update site.data
  # ═══════════════════════════════════════════════════════════════════

  describe 'Full fetch flow' do
    let(:spot_entry) do
      build_spot_entry(
        slug: 'thunersee-spiez',
        name: { de: 'Thunersee Spiez', en: 'Lake Thun Spiez' },
        lat: 46.6863, lon: 7.6803
      )
    end

    let(:waterway_entry) do
      build_waterway_entry(slug: 'thunersee', name: { de: 'Thunersee', en: 'Lake Thun' })
    end

    let(:spot_type_entry) do
      build_type_entry(slug: 'launch-point', name_de: 'Einstiegsort', name_en: 'Launch Point')
    end

    before do
      stub_entries_for(
        'spot'     => [spot_entry],
        'waterway' => [waterway_entry],
        'spotType' => [spot_type_entry]
      )
    end

    it 'writes YAML files to _data/ directory for each content type' do
      fetcher.generate(site)

      expect(File.exist?(File.join(data_dir, 'spots.yml'))).to be true
      expect(File.exist?(File.join(data_dir, 'waterways.yml'))).to be true
      expect(File.exist?(File.join(data_dir, 'types', 'spot_types.yml'))).to be true
    end

    it 'writes correct spot data to YAML (2 locale rows per entry)' do
      fetcher.generate(site)

      spots = YAML.safe_load(File.read(File.join(data_dir, 'spots.yml')), permitted_classes: [Time])
      expect(spots).to be_an(Array)
      expect(spots.size).to eq(2) # de + en

      de_spot = spots.find { |s| s['locale'] == 'de' }
      en_spot = spots.find { |s| s['locale'] == 'en' }

      expect(de_spot['slug']).to eq('thunersee-spiez')
      expect(de_spot['name']).to eq('Thunersee Spiez')
      expect(de_spot['location']['lat']).to eq(46.6863)
      expect(de_spot['location']['lon']).to eq(7.6803)
      expect(de_spot['confirmed']).to be true
      expect(de_spot['rejected']).to be false
      expect(de_spot['waterway_slug']).to eq('thunersee')
      expect(de_spot['spotType_slug']).to eq('launch-point')
      expect(de_spot['paddleCraftTypes']).to eq(%w[kayak sup])

      expect(en_spot['slug']).to eq('thunersee-spiez')
      expect(en_spot['name']).to eq('Lake Thun Spiez')
    end

    it 'writes correct waterway data to YAML (2 locale rows per entry)' do
      fetcher.generate(site)

      waterways = YAML.safe_load(File.read(File.join(data_dir, 'waterways.yml')), permitted_classes: [Time])
      expect(waterways).to be_an(Array)
      expect(waterways.size).to eq(2) # de + en

      de_ww = waterways.find { |w| w['locale'] == 'de' }
      expect(de_ww['slug']).to eq('thunersee')
      expect(de_ww['name']).to eq('Thunersee')
      expect(de_ww['length']).to eq(17.5)
      expect(de_ww['showInMenu']).to be true
    end

    it 'writes correct type data to YAML (2 locale rows per entry)' do
      fetcher.generate(site)

      types = YAML.safe_load(File.read(File.join(data_dir, 'types', 'spot_types.yml')), permitted_classes: [Time])
      expect(types).to be_an(Array)
      expect(types.size).to eq(2) # de + en

      de_type = types.find { |t| t['locale'] == 'de' }
      expect(de_type['slug']).to eq('launch-point')
      expect(de_type['name_de']).to eq('Einstiegsort')
      expect(de_type['name_en']).to eq('Launch Point')
    end

    it 'populates site.data with the transformed data' do
      fetcher.generate(site)

      expect(site_data['spots']).to be_an(Array)
      expect(site_data['spots'].size).to eq(2) # de + en
      expect(site_data['spots'].first['slug']).to eq('thunersee-spiez')

      expect(site_data['waterways']).to be_an(Array)
      expect(site_data['waterways'].first['slug']).to eq('thunersee')

      expect(site_data['types']).to be_a(Hash)
      expect(site_data['types']['spot_types']).to be_an(Array)
      expect(site_data['types']['spot_types'].first['slug']).to eq('launch-point')
    end

    it 'creates cache metadata file with sync token' do
      fetcher.generate(site)

      cache_path = File.join(data_dir, '.contentful_sync_cache.yml')
      expect(File.exist?(cache_path)).to be true

      cache_data = YAML.safe_load(File.read(cache_path))
      expect(cache_data['sync_token']).to eq('integration_token')
      expect(cache_data['space_id']).to eq('test_space')
      expect(cache_data['environment']).to eq('master')
      expect(cache_data['last_sync_at']).not_to be_nil
    end

    it 'writes all 13 content type files' do
      fetcher.generate(site)

      expected_files = %w[
        spots.yml waterways.yml obstacles.yml protected_areas.yml notices.yml
        static_pages.yml
      ]
      expected_type_files = %w[
        spot_types.yml obstacle_types.yml paddle_craft_types.yml
        paddling_environment_types.yml protected_area_types.yml
        data_source_types.yml data_license_types.yml
      ]

      expected_files.each do |f|
        expect(File.exist?(File.join(data_dir, f))).to be(true), "Expected #{f} to exist"
      end
      expected_type_files.each do |f|
        expect(File.exist?(File.join(data_dir, 'types', f))).to be(true), "Expected types/#{f} to exist"
      end
    end
  end


  # ═══════════════════════════════════════════════════════════════════
  # 2. ApiGenerator can consume fetcher output
  # ═══════════════════════════════════════════════════════════════════

  describe 'ApiGenerator consumes fetcher output' do
    let(:spot_entry) do
      build_spot_entry(
        slug: 'brienzersee-boenigen',
        name: { de: 'Brienzersee Bönigen', en: 'Lake Brienz Boenigen' },
        lat: 46.6930, lon: 7.9020,
        confirmed: true, rejected: false,
        spot_type_slug: 'launch-point', waterway_slug: 'brienzersee'
      )
    end

    let(:spot_type_entry) do
      build_type_entry(slug: 'launch-point', name_de: 'Einstiegsort', name_en: 'Launch Point')
    end

    before do
      stub_entries_for(
        'spot'     => [spot_entry],
        'spotType' => [spot_type_entry]
      )
    end

    it 'runs ApiGenerator without errors after ContentfulFetcher' do
      fetcher.generate(site)
      expect { api_generator.generate(site) }.not_to raise_error
    end

    it 'ApiGenerator reads site.data spots and filters by locale' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      de_file = File.join(dest_dir, 'api', 'spots-de.json')
      expect(File.exist?(de_file)).to be true

      spots_de = JSON.parse(File.read(de_file))
      expect(spots_de).to be_an(Array)
      expect(spots_de.size).to eq(1)
      expect(spots_de.first['slug']).to eq('brienzersee-boenigen')
    end

    it 'ApiGenerator reads site.data types and extracts dimension data' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      de_file = File.join(dest_dir, 'api', 'spottypes-de.json')
      expect(File.exist?(de_file)).to be true

      types_de = JSON.parse(File.read(de_file))
      expect(types_de).to be_an(Array)
      expect(types_de.size).to eq(1)
      expect(types_de.first['slug']).to eq('launch-point')
      expect(types_de.first['name']).to eq('Einstiegsort')
    end

    it 'ApiGenerator generates lastUpdateIndex.json' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      index_file = File.join(dest_dir, 'api', 'lastUpdateIndex.json')
      expect(File.exist?(index_file)).to be true

      index = JSON.parse(File.read(index_file))
      expect(index).to be_an(Array)
      tables = index.map { |e| e['table'] }
      expect(tables).to include('spots')
      expect(tables).to include('spotTypes')
    end
  end

  # ═══════════════════════════════════════════════════════════════════
  # 3. TileGenerator can consume fetcher output
  # ═══════════════════════════════════════════════════════════════════

  describe 'TileGenerator consumes fetcher output' do
    let(:spot_entry) do
      build_spot_entry(
        slug: 'thunersee-spiez',
        name: { de: 'Thunersee Spiez', en: 'Lake Thun Spiez' },
        lat: 46.6863, lon: 7.6803
      )
    end

    before do
      stub_entries_for('spot' => [spot_entry])
    end

    it 'runs TileGenerator without errors after ContentfulFetcher' do
      fetcher.generate(site)
      expect { tile_generator.generate(site) }.not_to raise_error
    end

    it 'TileGenerator reads site.data spots and extracts location data' do
      fetcher.generate(site)
      tile_generator.generate(site)
      write_pages_to_disk(site)

      index_file = File.join(dest_dir, 'api', 'tiles', 'spots', 'de', 'index.json')
      expect(File.exist?(index_file)).to be true

      index = JSON.parse(File.read(index_file))
      expect(index['layer']).to eq('spots')
      non_empty_tiles = index['tiles'].select { |t| t['count'] > 0 }
      expect(non_empty_tiles.size).to be >= 1
    end

    it 'TileGenerator creates tile file containing the spot' do
      fetcher.generate(site)
      tile_generator.generate(site)
      write_pages_to_disk(site)

      tiles_dir = File.join(dest_dir, 'api', 'tiles', 'spots', 'de')
      tile_files = Dir.glob(File.join(tiles_dir, '*.json')).reject { |f| f.end_with?('index.json') }
      expect(tile_files.size).to be >= 1

      found = tile_files.any? do |tf|
        tile_data = JSON.parse(File.read(tf))
        tile_data['data']&.any? { |d| d['slug'] == 'thunersee-spiez' }
      end
      expect(found).to be true
    end
  end


  # ═══════════════════════════════════════════════════════════════════
  # 4. End-to-end: Fetcher → ApiGenerator pipeline
  # ═══════════════════════════════════════════════════════════════════

  describe 'End-to-end: Fetcher → ApiGenerator pipeline' do
    let(:spot_entry) do
      build_spot_entry(
        slug: 'vierwaldstaettersee-luzern',
        name: { de: 'Vierwaldstättersee Luzern', en: 'Lake Lucerne' },
        lat: 47.0502, lon: 8.3093,
        confirmed: true, rejected: false
      )
    end

    let(:waterway_entry) do
      build_waterway_entry(slug: 'vierwaldstaettersee', name: { de: 'Vierwaldstättersee', en: 'Lake Lucerne' })
    end

    let(:spot_type_entry) do
      build_type_entry(slug: 'launch-point', name_de: 'Einstiegsort', name_en: 'Launch Point')
    end

    let(:obstacle_type_entry) do
      build_type_entry(slug: 'dam', name_de: 'Staudamm', name_en: 'Dam')
    end

    before do
      stub_entries_for(
        'spot'         => [spot_entry],
        'waterway'     => [waterway_entry],
        'spotType'     => [spot_type_entry],
        'obstacleType' => [obstacle_type_entry]
      )
    end

    it 'generates locale-filtered API JSON files from fetched data' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      # DE spots — one entry produces one de row
      de_spots = JSON.parse(File.read(File.join(dest_dir, 'api', 'spots-de.json')))
      expect(de_spots.size).to eq(1)
      expect(de_spots.first['slug']).to eq('vierwaldstaettersee-luzern')

      # EN spots
      en_spots = JSON.parse(File.read(File.join(dest_dir, 'api', 'spots-en.json')))
      expect(en_spots.size).to eq(1)
      expect(en_spots.first['slug']).to eq('vierwaldstaettersee-luzern')
    end

    it 'generates waterway API files from fetched data' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      de_waterways = JSON.parse(File.read(File.join(dest_dir, 'api', 'waterways-de.json')))
      expect(de_waterways.size).to eq(1)
      expect(de_waterways.first['slug']).to eq('vierwaldstaettersee')
    end

    it 'generates dimension table API files from fetched type data' do
      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      de_spot_types = JSON.parse(File.read(File.join(dest_dir, 'api', 'spottypes-de.json')))
      expect(de_spot_types.size).to eq(1)
      expect(de_spot_types.first['name']).to eq('Einstiegsort')

      en_spot_types = JSON.parse(File.read(File.join(dest_dir, 'api', 'spottypes-en.json')))
      expect(en_spot_types.first['name']).to eq('Launch Point')

      de_obstacle_types = JSON.parse(File.read(File.join(dest_dir, 'api', 'obstacletypes-de.json')))
      expect(de_obstacle_types.size).to eq(1)
      expect(de_obstacle_types.first['name']).to eq('Staudamm')
    end

    it 'rejected spots are excluded from API output' do
      rejected_spot = build_spot_entry(
        slug: 'rejected-spot',
        name: { de: 'Rejected', en: 'Rejected' },
        lat: 46.5, lon: 7.5,
        confirmed: false, rejected: true
      )

      stub_entries_for(
        'spot'     => [spot_entry, rejected_spot],
        'waterway' => [waterway_entry],
        'spotType' => [spot_type_entry],
        'obstacleType' => [obstacle_type_entry]
      )

      fetcher.generate(site)
      api_generator.generate(site)
      write_pages_to_disk(site)

      de_spots = JSON.parse(File.read(File.join(dest_dir, 'api', 'spots-de.json')))
      slugs = de_spots.map { |s| s['slug'] }
      expect(slugs).to include('vierwaldstaettersee-luzern')
      expect(slugs).not_to include('rejected-spot')
    end

    it 'runs full pipeline: Fetcher → ApiGenerator → TileGenerator without errors' do
      fetcher.generate(site)
      api_generator.generate(site)
      expect { tile_generator.generate(site) }.not_to raise_error
    end
  end
end
