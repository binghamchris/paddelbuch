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
