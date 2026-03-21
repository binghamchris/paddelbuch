# frozen_string_literal: true

# Property-based tests for Jekyll::StatisticsMetricsGenerator
# Uses Rantly with RSpec for property-based testing.

require 'spec_helper'

RSpec.describe Jekyll::StatisticsMetricsGenerator do
  let(:generator) { described_class.new }

  # Known type slugs from the design document
  let(:spot_type_slugs) { %w[nur-ausstieg einstieg-ausstieg rasthalte notauswasserungsstelle nur-einstieg] }
  let(:paddle_craft_slugs) { %w[seekajak kanadier stand-up-paddle-board] }
  let(:data_source_slugs) { %w[swiss-canoe openstreetmap swiss-canoe-fako-member individual-contributor swiss-canoe-meldestelle-fur-absehbare-gewasserereignisse] }
  let(:data_license_slugs) { %w[cc-by-sa-4 lizenz-odbl] }

  # ── Property 1: Deduplication correctness ─────────────────────────────────
  # Feature: statistics-dashboard, Property 1: Deduplication correctness
  # **Validates: Requirements 2.1, 3.1, 4.1, 8.3, 8.4, 8.5, 8.6, 8.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**
  describe '#deduplicate_by_slug (Property 1)' do
    it 'dedup count equals unique slug count for random entity lists with duplicates across 2 locales' do
      property_of {
        num_unique = range(1, 30)
        slugs = (1..num_unique).map { |i| "entity-#{i}" }
        entities = []
        slugs.each do |slug|
          %w[de en].each do |locale|
            entities << { 'slug' => slug, 'locale' => locale, 'name' => "#{slug}-#{locale}" }
          end
        end
        # Optionally add some nil-slug entries
        nil_count = range(0, 3)
        nil_count.times { entities << { 'slug' => nil, 'locale' => 'de' } }
        [entities, slugs.uniq.size]
      }.check(100) { |(entities, expected_unique_count)|
        result = generator.send(:deduplicate_by_slug, entities)
        expect(result.size).to eq(expected_unique_count)
        # Every result slug should be unique
        result_slugs = result.map { |e| e['slug'] }
        expect(result_slugs.uniq.size).to eq(result_slugs.size)
      }
    end
  end

  # ── Property 2: Spot type partitioning ────────────────────────────────────
  # Feature: statistics-dashboard, Property 2: Spot type partitioning
  # **Validates: Requirements 2.4, 2.5**
  describe '#compute_spot_metrics (Property 2)' do
    it 'every spot is classified into exactly one segment and segment counts sum to total' do
      property_of {
        num_spots = range(1, 40)
        spots = (1..num_spots).map do |i|
          rejected = range(0, 1) == 1
          {
            'slug' => "spot-#{i}",
            'rejected' => rejected,
            'spotType_slug' => choose(*%w[nur-ausstieg einstieg-ausstieg rasthalte notauswasserungsstelle nur-einstieg])
          }
        end
        spots
      }.check(100) { |spots|
        spot_types = spot_type_slugs.map { |s| { 'slug' => s } }
        result = generator.send(:compute_spot_metrics, spots, spot_types)

        total = result['total']
        by_type = result['byType']

        # Sum of all segment counts must equal total
        segment_sum = by_type.sum { |entry| entry['count'] }
        expect(segment_sum).to eq(total)
        expect(total).to eq(spots.size)

        # Every spot type slug + no-entry must be present
        segment_slugs = by_type.map { |e| e['slug'] }
        expect(segment_slugs).to include('no-entry')
        spot_type_slugs.each { |s| expect(segment_slugs).to include(s) }

        # Verify rejected spots are counted only in no-entry
        rejected_count = spots.count { |s| s['rejected'] == true }
        no_entry_entry = by_type.find { |e| e['slug'] == 'no-entry' }
        expect(no_entry_entry['count']).to eq(rejected_count)

        # Verify non-rejected spots are counted in their type segment
        non_rejected = spots.reject { |s| s['rejected'] == true }
        spot_type_slugs.each do |type_slug|
          expected = non_rejected.count { |s| s['spotType_slug'] == type_slug }
          actual_entry = by_type.find { |e| e['slug'] == type_slug }
          expect(actual_entry['count']).to eq(expected)
        end
      }
    end
  end

  # ── Property 3: Obstacle portage partitioning ─────────────────────────────
  # Feature: statistics-dashboard, Property 3: Obstacle portage partitioning
  # **Validates: Requirements 3.3, 3.4**
  describe '#compute_obstacle_metrics (Property 3)' do
    it 'partitions obstacles into exactly two segments and counts sum to total' do
      property_of {
        num_obstacles = range(1, 40)
        obstacles = (1..num_obstacles).map do |i|
          has_portage = range(0, 1) == 1
          {
            'slug' => "obstacle-#{i}",
            'portageRoute' => has_portage ? "route-#{i}" : nil
          }
        end
        obstacles
      }.check(100) { |obstacles|
        result = generator.send(:compute_obstacle_metrics, obstacles)

        total = result['total']
        with_portage = result['withPortageRoute']
        without_portage = result['withoutPortageRoute']

        # Two segments must sum to total
        expect(with_portage + without_portage).to eq(total)
        expect(total).to eq(obstacles.size)

        # Verify individual counts
        expected_with = obstacles.count { |o| !o['portageRoute'].nil? }
        expected_without = obstacles.count { |o| o['portageRoute'].nil? }
        expect(with_portage).to eq(expected_with)
        expect(without_portage).to eq(expected_without)
      }
    end
  end

  # ── Property 4: Paddle craft type counting ──────────────────────────────────
  # Feature: statistics-dashboard, Property 4: Paddle craft type counting
  # **Validates: Requirements 5.2, 5.3**
  describe '#compute_paddle_craft_metrics (Property 4)' do
    it 'count per craft type equals number of unique spots containing that slug' do
      property_of {
        num_spots = range(1, 40)
        craft_slugs = %w[seekajak kanadier stand-up-paddle-board]
        spots = (1..num_spots).map do |i|
          # Each spot gets a random subset of craft types (possibly empty)
          num_crafts = range(0, craft_slugs.size)
          chosen = craft_slugs.sample(num_crafts)
          {
            'slug' => "spot-#{i}",
            'paddleCraftTypes' => chosen
          }
        end
        spots
      }.check(100) { |spots|
        craft_types = paddle_craft_slugs.map { |s| { 'slug' => s } }
        result = generator.send(:compute_paddle_craft_metrics, spots, craft_types)

        paddle_craft_slugs.each do |slug|
          expected = spots.count { |s| s['paddleCraftTypes'].is_a?(Array) && s['paddleCraftTypes'].include?(slug) }
          actual_entry = result.find { |e| e['slug'] == slug }
          expect(actual_entry).not_to be_nil, "Expected entry for craft type '#{slug}'"
          expect(actual_entry['count']).to eq(expected)
        end
      }
    end
  end

  # ── Property 5: Data source type counting ───────────────────────────────────
  # Feature: statistics-dashboard, Property 5: Data source type counting
  # **Validates: Requirements 6.2, 6.3**
  describe '#compute_data_source_metrics (Property 5)' do
    it 'sum across entity types for each data source type is correct' do
      property_of {
        source_slugs = %w[swiss-canoe openstreetmap swiss-canoe-fako-member individual-contributor swiss-canoe-meldestelle-fur-absehbare-gewasserereignisse]
        entity_lists = 5.times.map do
          num = range(0, 15)
          (1..num).map do |i|
            {
              'slug' => "entity-#{i}-#{range(1, 10000)}",
              'dataSourceType_slug' => choose(*source_slugs, nil)
            }
          end
        end
        entity_lists
      }.check(100) { |entity_lists|
        spots, obstacles, protected_areas, waterways, notices = entity_lists
        ds_types = data_source_slugs.map { |s| { 'slug' => s } }

        result = generator.send(:compute_data_source_metrics, spots, obstacles, protected_areas, waterways, notices, ds_types)

        data_source_slugs.each do |slug|
          expected = entity_lists.sum { |entities| entities.count { |e| e['dataSourceType_slug'] == slug } }
          actual_entry = result.find { |e| e['slug'] == slug }
          expect(actual_entry).not_to be_nil, "Expected entry for data source type '#{slug}'"
          expect(actual_entry['count']).to eq(expected)
        end
      }
    end
  end

  # ── Property 6: Data license type counting ──────────────────────────────────
  # Feature: statistics-dashboard, Property 6: Data license type counting
  # **Validates: Requirements 7.2, 7.3**
  describe '#compute_data_license_metrics (Property 6)' do
    it 'sum across entity types for each data license type is correct' do
      property_of {
        license_slugs = %w[cc-by-sa-4 lizenz-odbl]
        entity_lists = 5.times.map do
          num = range(0, 15)
          (1..num).map do |i|
            {
              'slug' => "entity-#{i}-#{range(1, 10000)}",
              'dataLicenseType_slug' => choose(*license_slugs, nil)
            }
          end
        end
        entity_lists
      }.check(100) { |entity_lists|
        spots, obstacles, protected_areas, waterways, notices = entity_lists
        dl_types = data_license_slugs.map { |s| { 'slug' => s } }

        result = generator.send(:compute_data_license_metrics, spots, obstacles, protected_areas, waterways, notices, dl_types)

        data_license_slugs.each do |slug|
          expected = entity_lists.sum { |entities| entities.count { |e| e['dataLicenseType_slug'] == slug } }
          actual_entry = result.find { |e| e['slug'] == slug }
          expect(actual_entry).not_to be_nil, "Expected entry for data license type '#{slug}'"
          expect(actual_entry['count']).to eq(expected)
        end
      }
    end
  end

  # ── Property 9: Generator produces correct per-spot freshness data ──────────
  # Feature: spot-freshness-dashboard, Property 9: Generator produces correct per-spot freshness data
  # **Validates: Requirements 6.1**
  describe '#compute_spot_freshness_map_data (Property 9)' do
    it 'output contains only valid non-rejected spots with correct freshness categories' do
      property_of {
        now = Time.now
        num_spots = range(0, 30)
        spots = (1..num_spots).map do |i|
          rejected = choose(true, false)
          has_location = choose(true, false)
          has_lat = choose(true, false)
          has_lon = choose(true, false)
          has_updated_at = choose(true, false)

          location = if has_location
                       lat = has_lat ? (range(-9000, 9000) / 100.0) : nil
                       lon = has_lon ? (range(-18000, 18000) / 100.0) : nil
                       { 'lat' => lat, 'lon' => lon }
                     end

          # Generate updatedAt as an ISO 8601 date string at a known offset from now
          updated_at = if has_updated_at
                         days_ago = range(0, 3000)
                         (now - days_ago * 86_400).utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')
                       end

          {
            'slug' => "spot-#{i}",
            'rejected' => rejected,
            'location' => location,
            'updatedAt' => updated_at
          }
        end
        spots
      }.check(100) { |spots|
        before_call = Time.now
        result = generator.send(:compute_spot_freshness_map_data, spots)
        after_call = Time.now

        # Determine which spots are valid (non-rejected, valid location with lat+lon, non-nil updatedAt)
        valid_spots = spots.select do |s|
          s['rejected'] != true &&
            !s['location'].nil? &&
            !s['location']['lat'].nil? &&
            !s['location']['lon'].nil? &&
            !s['updatedAt'].nil?
        end

        # Output count must equal valid spot count
        expect(result.size).to eq(valid_spots.size),
          "Expected #{valid_spots.size} entries but got #{result.size}"

        # Each output entry must have the correct slug, lat, lon, and category
        result.each do |entry|
          expect(entry).to have_key('slug')
          expect(entry).to have_key('lat')
          expect(entry).to have_key('lon')
          expect(entry).to have_key('category')
          expect(%w[fresh aging stale]).to include(entry['category'])

          # Find the source spot
          source = spots.find { |s| s['slug'] == entry['slug'] }
          expect(source).not_to be_nil, "Output entry slug '#{entry['slug']}' not found in input"

          # Verify lat/lon match
          expect(entry['lat']).to eq(source['location']['lat'])
          expect(entry['lon']).to eq(source['location']['lon'])

          # Verify category matches threshold rules
          # Use a tolerance window: the method called Time.now between before_call and after_call
          updated_at_time = Time.parse(source['updatedAt'])
          min_days = [(before_call - updated_at_time) / 86_400.0, 0].max
          max_days = [(after_call - updated_at_time) / 86_400.0, 0].max

          # Determine the set of possible categories given the time window
          possible_categories = []
          [min_days, max_days].each do |days|
            cat = if days <= 730.5 then 'fresh'
                  elsif days <= 1826.25 then 'aging'
                  else 'stale'
                  end
            possible_categories << cat
          end
          possible_categories.uniq!

          expect(possible_categories).to include(entry['category']),
            "Spot '#{entry['slug']}' with days in [#{min_days.round(2)}, #{max_days.round(2)}] " \
            "should be #{possible_categories.join(' or ')} but was '#{entry['category']}'"
        end

        # Verify no rejected or invalid spots appear in output
        result_slugs = result.map { |e| e['slug'] }
        spots.each do |s|
          is_invalid = s['rejected'] == true ||
                       s['location'].nil? ||
                       s['location']['lat'].nil? ||
                       s['location']['lon'].nil? ||
                       s['updatedAt'].nil?
          if is_invalid
            expect(result_slugs).not_to include(s['slug']),
              "Rejected/invalid spot '#{s['slug']}' should not appear in output"
          end
        end
      }
    end
  end

  # ── Property 7: Type name localisation ──────────────────────────────────────
  # Feature: statistics-dashboard, Property 7: Type name localisation
  # **Validates: Requirements 5.4, 6.4, 7.4, 9.3**
  describe '#localize_metrics (Property 7)' do
    it 'correct name is selected for each locale' do
      property_of {
        # Generate random type definitions with name_de and name_en
        num_types = range(1, 5)
        type_defs = (1..num_types).map do |i|
          slug = "type-#{i}"
          name_de = "DE-Name-#{range(1, 10000)}"
          name_en = "EN-Name-#{range(1, 10000)}"
          { 'slug' => slug, 'name_de' => name_de, 'name_en' => name_en }
        end
        type_defs
      }.check(100) { |type_defs|
        # Build type entries per locale (as the real data has locale-specific entries)
        type_entries_by_locale = {}
        %w[de en].each do |locale|
          type_entries_by_locale[locale] = type_defs.map do |td|
            { 'slug' => td['slug'], 'locale' => locale,
              'name_de' => td['name_de'], 'name_en' => td['name_en'] }
          end
        end

        # Build cached metrics that reference these type slugs
        # We'll test with paddle_craft_types as a representative
        cached_metrics = {
          'spots' => { 'total' => 0, 'byType' => [] },
          'obstacles' => { 'total' => 0, 'withPortageRoute' => 0, 'withoutPortageRoute' => 0 },
          'protectedAreas' => { 'total' => 0, 'byType' => [] },
          'paddleCraftTypes' => type_defs.map { |td| { 'slug' => td['slug'], 'name' => td['slug'], 'count' => 0 } },
          'dataSourceTypes' => [],
          'dataLicenseTypes' => []
        }

        %w[de en].each do |locale|
          name_field = locale == 'en' ? 'name_en' : 'name_de'

          # Build a mock site with type data
          site_data = {
            'types' => {
              'spot_types' => [],
              'protected_area_types' => [],
              'paddle_craft_types' => type_entries_by_locale[locale],
              'data_source_types' => [],
              'data_license_types' => []
            }
          }
          mock_site = Struct.new(:data).new(site_data)

          result = generator.send(:localize_metrics, cached_metrics, locale, mock_site)

          result['paddleCraftTypes'].each do |entry|
            td = type_defs.find { |t| t['slug'] == entry['slug'] }
            expect(entry['name']).to eq(td[name_field])
          end
        end
      }
    end
  end
end

# ── Property 8: Deactivation cleanup (static analysis of JS source) ──────────
# Feature: statistics-dashboard, Property 8: Deactivation cleanup
# **Validates: Requirements 1.5**
#
# Since there is no JS test runner in this project, this test performs static
# analysis on the statistics-dashboard.js source file to verify that the
# deactivate() function clears all four required DOM containers.
RSpec.describe 'statistics-dashboard.js deactivate cleanup (Property 8)' do
  let(:js_path) { File.join(File.dirname(__FILE__), '..', '..', 'assets', 'js', 'statistics-dashboard.js') }
  let(:js_source) { File.read(js_path) }

  # Extract the deactivate function body from the JS source
  let(:deactivate_body) do
    # Match the deactivate function — it starts with "deactivate: function()"
    # and ends at the next closing brace at the same indentation level
    match = js_source.match(/deactivate:\s*function\s*\(\)\s*\{(.*?)\n    \}/m)
    expect(match).not_to be_nil, 'Could not find deactivate function in statistics-dashboard.js'
    match[1]
  end

  # The four container IDs that must be cleared per the design contract
  let(:required_container_ids) do
    %w[dashboard-content dashboard-title dashboard-description dashboard-legend]
  end

  it 'references all four required container element IDs' do
    required_container_ids.each do |container_id|
      expect(deactivate_body).to include(container_id),
        "deactivate() must reference '#{container_id}' but it was not found"
    end
  end

  it 'retrieves each container via getElementById' do
    required_container_ids.each do |container_id|
      pattern = /getElementById\(\s*['"]#{Regexp.escape(container_id)}['"]\s*\)/
      expect(deactivate_body).to match(pattern),
        "deactivate() must call getElementById('#{container_id}')"
    end
  end

  it 'sets innerHTML or textContent to empty string for each container' do
    # Each container must have its content cleared — either innerHTML = '' or textContent = ''
    required_container_ids.each do |container_id|
      # Find the block for this container (getElementById call through the clearing assignment)
      id_pattern = /getElementById\(\s*['"]#{Regexp.escape(container_id)}['"]\s*\)/
      id_match = deactivate_body.match(id_pattern)
      expect(id_match).not_to be_nil, "deactivate() must reference '#{container_id}'"
    end

    # Verify there are at least 4 clearing assignments (innerHTML = '' or textContent = '')
    clearing_pattern = /\.(innerHTML|textContent)\s*=\s*['"]['"];/
    clearing_matches = deactivate_body.scan(clearing_pattern)
    expect(clearing_matches.size).to be >= required_container_ids.size,
      "deactivate() must clear all #{required_container_ids.size} containers, " \
      "but only found #{clearing_matches.size} clearing assignment(s)"
  end

  it 'uses conditional guards before clearing each container' do
    # The deactivate function should check if each element exists before clearing
    required_container_ids.each do |container_id|
      # Look for a pattern like: if (someVar) { someVar.innerHTML = ''; }
      # The variable name is derived from the getElementById call
      expect(deactivate_body).to match(/if\s*\(/),
        "deactivate() should use conditional guards when clearing '#{container_id}'"
    end
  end
end

# ── Unit Tests: Script load order and integration (Task 7.2) ──────────────────
# **Validates: Requirements 11.1, 11.2, 11.3**

RSpec.describe 'datenqualitaet.html script load order' do
  let(:html_path) { File.join(File.dirname(__FILE__), '..', '..', 'offene-daten', 'datenqualitaet.html') }
  let(:html_source) { File.read(html_path) }

  # Extract the YAML front matter scripts array
  let(:scripts) do
    # Front matter is between the first pair of '---' lines
    front_matter_match = html_source.match(/\A---\n(.*?)---/m)
    expect(front_matter_match).not_to be_nil, 'Could not find YAML front matter in datenqualitaet.html'
    yaml = YAML.safe_load(front_matter_match[1])
    yaml['scripts']
  end

  it 'includes statistics-dashboard.js in the scripts array' do
    expect(scripts).to include('/assets/js/statistics-dashboard.js')
  end

  it 'lists statistics-dashboard.js AFTER dashboard-data.js' do
    data_idx = scripts.index('/assets/js/dashboard-data.js')
    stats_idx = scripts.index('/assets/js/statistics-dashboard.js')
    expect(data_idx).not_to be_nil, 'dashboard-data.js not found in scripts array'
    expect(stats_idx).not_to be_nil, 'statistics-dashboard.js not found in scripts array'
    expect(stats_idx).to be > data_idx,
      "statistics-dashboard.js (index #{stats_idx}) must come after dashboard-data.js (index #{data_idx})"
  end

  it 'lists statistics-dashboard.js BEFORE freshness-dashboard.js' do
    stats_idx = scripts.index('/assets/js/statistics-dashboard.js')
    freshness_idx = scripts.index('/assets/js/freshness-dashboard.js')
    expect(stats_idx).not_to be_nil, 'statistics-dashboard.js not found in scripts array'
    expect(freshness_idx).not_to be_nil, 'freshness-dashboard.js not found in scripts array'
    expect(stats_idx).to be < freshness_idx,
      "statistics-dashboard.js (index #{stats_idx}) must come before freshness-dashboard.js (index #{freshness_idx})"
  end

  it 'lists statistics-dashboard.js BEFORE coverage-dashboard.js' do
    stats_idx = scripts.index('/assets/js/statistics-dashboard.js')
    coverage_idx = scripts.index('/assets/js/coverage-dashboard.js')
    expect(stats_idx).not_to be_nil, 'statistics-dashboard.js not found in scripts array'
    expect(coverage_idx).not_to be_nil, 'coverage-dashboard.js not found in scripts array'
    expect(stats_idx).to be < coverage_idx,
      "statistics-dashboard.js (index #{stats_idx}) must come before coverage-dashboard.js (index #{coverage_idx})"
  end
end

RSpec.describe 'statistics-dashboard.js module interface contract' do
  let(:js_path) { File.join(File.dirname(__FILE__), '..', '..', 'assets', 'js', 'statistics-dashboard.js') }
  let(:js_source) { File.read(js_path) }

  it "sets the module id to 'statistics'" do
    expect(js_source).to match(/id:\s*['"]statistics['"]/),
      "statistics-dashboard.js must define id: 'statistics'"
  end

  it 'sets usesMap to false' do
    expect(js_source).to match(/usesMap:\s*false/),
      'statistics-dashboard.js must define usesMap: false'
  end

  it 'defines an activate function accepting a context parameter' do
    expect(js_source).to match(/activate:\s*function\s*\(\s*context\s*\)/),
      'statistics-dashboard.js must define activate: function(context)'
  end

  it 'defines a deactivate function' do
    expect(js_source).to match(/deactivate:\s*function\s*\(\s*\)/),
      'statistics-dashboard.js must define deactivate: function()'
  end

  it 'defines a getName function' do
    expect(js_source).to match(/getName:\s*function\s*\(\s*\)/),
      'statistics-dashboard.js must define getName: function()'
  end

  it 'registers on PaddelbuchDashboardRegistry' do
    expect(js_source).to include('PaddelbuchDashboardRegistry'),
      'statistics-dashboard.js must register on PaddelbuchDashboardRegistry'
  end

  it 'exposes the module as global.PaddelbuchStatisticsDashboard' do
    expect(js_source).to include('PaddelbuchStatisticsDashboard'),
      'statistics-dashboard.js must expose global.PaddelbuchStatisticsDashboard'
  end
end
