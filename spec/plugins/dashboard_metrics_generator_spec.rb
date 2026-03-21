# frozen_string_literal: true

# Unit tests for Jekyll::DashboardMetricsGenerator
# Validates: Requirements 9.1, 9.2, 9.3, 9.4, 10.4, 3.4, 3.5, 3.6, 3.7, 3.8

require 'spec_helper'

RSpec.describe Jekyll::DashboardMetricsGenerator do
  let(:generator) { described_class.new }

  let(:colors) do
    {
      'green1' => '#07753f',
      'warningYellow' => '#ffb200',
      'dangerRed' => '#c40200',
      'purple1' => '#69599b'
    }
  end

  let(:line_geometry_json) { '{"type":"LineString","coordinates":[[8.5,47.3],[8.6,47.4]]}' }

  # -- median_age --------------------------------------------------------------

  describe '#median_age' do
    let(:now) { Time.utc(2025, 1, 1) }

    it 'returns nil for an empty array (Requirement 9.4)' do
      result = generator.send(:median_age, [], now)
      expect(result).to be_nil
    end

    it 'returns the middle value for an odd-count array (Requirement 9.2)' do
      # 3 timestamps: 10, 20, 30 days before now -> median = 20
      timestamps = [
        (now - 10 * 86_400).iso8601,
        (now - 30 * 86_400).iso8601,
        (now - 20 * 86_400).iso8601
      ]
      result = generator.send(:median_age, timestamps, now)
      expect(result).to be_within(0.01).of(20.0)
    end

    it 'returns the average of two middle values for an even-count array (Requirement 9.3)' do
      # 4 timestamps: 10, 20, 30, 40 days before now -> median = (20+30)/2 = 25
      timestamps = [
        (now - 40 * 86_400).iso8601,
        (now - 10 * 86_400).iso8601,
        (now - 30 * 86_400).iso8601,
        (now - 20 * 86_400).iso8601
      ]
      result = generator.send(:median_age, timestamps, now)
      expect(result).to be_within(0.01).of(25.0)
    end
  end

  # -- freshness_color ---------------------------------------------------------

  describe '#freshness_color' do
    it 'returns green-1 at 0 days (Requirement 3.4)' do
      result = generator.send(:freshness_color, 0, colors)
      expect(result).to eq('#07753f')
    end

    it 'returns green-1 at 730 days (within 2-year threshold) (Requirement 3.4)' do
      result = generator.send(:freshness_color, 730, colors)
      expect(result).to eq('#07753f')
    end

    it 'returns warning-yellow at 731 days (above 2-year threshold) (Requirement 3.5)' do
      result = generator.send(:freshness_color, 731, colors)
      expect(result).to eq('#ffb200')
    end

    it 'returns warning-yellow at 1826 days (within 5-year threshold) (Requirement 3.5)' do
      result = generator.send(:freshness_color, 1826, colors)
      expect(result).to eq('#ffb200')
    end

    it 'returns danger-red at 1827 days (above 5-year threshold) (Requirement 3.6)' do
      result = generator.send(:freshness_color, 1827, colors)
      expect(result).to eq('#c40200')
    end

    it 'returns danger-red for values well above 5 years (Requirement 3.7)' do
      result = generator.send(:freshness_color, 3000, colors)
      expect(result).to eq('#c40200')
    end

    it 'returns purple-1 for nil days (no data) (Requirement 3.8)' do
      result = generator.send(:freshness_color, nil, colors)
      expect(result).to eq('#69599b')
    end
  end

  # -- classify_segments -------------------------------------------------------

  describe '#classify_segments' do
    let(:geometry) { JSON.parse(line_geometry_json) }

    it 'classifies entire geometry as uncovered when spots array is empty (Requirement 10.4)' do
      result = generator.send(:classify_segments, geometry, [])
      expect(result['covered']).to be_nil
      expect(result['uncovered']).not_to be_nil
      expect(result['uncovered']['type']).to eq('MultiLineString')
      expect(result['uncovered']['coordinates'].size).to eq(1) # single segment from 2-point LineString
    end

    it 'classifies nearby segments as covered when a spot is within range' do
      # Midpoint of [[8.5,47.3],[8.6,47.4]] is [8.55, 47.35]
      # Place a spot right at the midpoint
      spots = [{ 'location' => { 'lat' => 47.35, 'lon' => 8.55 } }]
      result = generator.send(:classify_segments, geometry, spots)
      expect(result['covered']).not_to be_nil
      expect(result['covered']['type']).to eq('MultiLineString')
      expect(result['covered']['coordinates'].size).to eq(1)
      expect(result['uncovered']).to be_nil
    end

    it 'classifies segments as uncovered when spot is far away' do
      # Place a spot very far from the geometry
      spots = [{ 'location' => { 'lat' => 40.0, 'lon' => 2.0 } }]
      result = generator.send(:classify_segments, geometry, spots)
      expect(result['covered']).to be_nil
      expect(result['uncovered']).not_to be_nil
      expect(result['uncovered']['type']).to eq('MultiLineString')
      expect(result['uncovered']['coordinates'].size).to eq(1)
    end
  end

  # -- malformed geometry ------------------------------------------------------

  describe 'malformed geometry handling' do
    it 'skips waterways with malformed geometry JSON gracefully' do
      waterways = [{ 'slug' => 'bad-river', 'geometry' => '{not valid json}', 'paddlingEnvironmentType_slug' => 'fluss', 'length' => 10 }]
      spots_by_waterway = {}

      result = generator.send(:compute_freshness_metrics, waterways, spots_by_waterway, colors)
      expect(result).to be_empty
    end

    it 'skips waterways with nil geometry' do
      waterways = [{ 'slug' => 'nil-river', 'geometry' => nil, 'paddlingEnvironmentType_slug' => 'fluss', 'length' => 10 }]
      spots_by_waterway = {}

      result = generator.send(:compute_freshness_metrics, waterways, spots_by_waterway, colors)
      expect(result).to be_empty
    end
  end

  # -- deduplicate_by_slug -----------------------------------------------------

  describe '#deduplicate_by_slug' do
    it 'returns one entry per unique slug' do
      waterways = [
        { 'slug' => 'aare', 'name' => 'Aare (de)', 'locale' => 'de' },
        { 'slug' => 'aare', 'name' => 'Aare (en)', 'locale' => 'en' },
        { 'slug' => 'rhein', 'name' => 'Rhein', 'locale' => 'de' }
      ]
      result = generator.send(:deduplicate_by_slug, waterways)
      slugs = result.map { |w| w['slug'] }
      expect(slugs).to match_array(%w[aare rhein])
    end

    it 'skips entries with nil slug' do
      waterways = [
        { 'slug' => nil, 'name' => 'No slug' },
        { 'slug' => 'aare', 'name' => 'Aare' }
      ]
      result = generator.send(:deduplicate_by_slug, waterways)
      expect(result.size).to eq(1)
      expect(result.first['slug']).to eq('aare')
    end
  end

  # -- deduplicate_spots_by_waterway -------------------------------------------

  describe '#deduplicate_spots_by_waterway' do
    it 'returns one spot per unique slug per waterway group' do
      spots_by_waterway = {
        'aare' => [
          { 'slug' => 'spot-a', 'locale' => 'de', 'updatedAt' => '2024-01-01T00:00:00Z' },
          { 'slug' => 'spot-a', 'locale' => 'en', 'updatedAt' => '2024-01-01T00:00:00Z' },
          { 'slug' => 'spot-b', 'locale' => 'de', 'updatedAt' => '2024-06-01T00:00:00Z' }
        ]
      }
      result = generator.send(:deduplicate_spots_by_waterway, spots_by_waterway)
      spot_slugs = result['aare'].map { |s| s['slug'] }
      expect(spot_slugs).to match_array(%w[spot-a spot-b])
    end

    it 'skips spots with nil slug' do
      spots_by_waterway = {
        'aare' => [
          { 'slug' => nil, 'updatedAt' => '2024-01-01T00:00:00Z' },
          { 'slug' => 'spot-a', 'updatedAt' => '2024-01-01T00:00:00Z' }
        ]
      }
      result = generator.send(:deduplicate_spots_by_waterway, spots_by_waterway)
      expect(result['aare'].size).to eq(1)
    end
  end

  # -- localize_metrics --------------------------------------------------------

  describe '#localize_metrics' do
    it 'swaps names correctly for the given locale' do
      cached = [
        { 'slug' => 'aare', 'name' => 'placeholder', 'spotCount' => 5 },
        { 'slug' => 'rhein', 'name' => 'placeholder', 'spotCount' => 3 }
      ]
      names = { 'aare' => 'Aare (de)', 'rhein' => 'Rhein (de)' }

      result = generator.send(:localize_metrics, cached, names)
      expect(result.find { |m| m['slug'] == 'aare' }['name']).to eq('Aare (de)')
      expect(result.find { |m| m['slug'] == 'rhein' }['name']).to eq('Rhein (de)')
    end

    it 'falls back to slug when name is missing for a locale' do
      cached = [
        { 'slug' => 'aare', 'name' => 'placeholder', 'spotCount' => 5 }
      ]
      names = {} # no names available

      result = generator.send(:localize_metrics, cached, names)
      expect(result.first['name']).to eq('aare')
    end

    it 'does not mutate the original cached metrics' do
      cached = [
        { 'slug' => 'aare', 'name' => 'placeholder', 'spotCount' => 5 }
      ]
      names = { 'aare' => 'Aare (de)' }

      generator.send(:localize_metrics, cached, names)
      expect(cached.first['name']).to eq('placeholder')
    end
  end

  # -- cross-locale caching ----------------------------------------------------

  describe 'cross-locale caching' do
    before do
      # Reset class-level cache before each test
      described_class.class_variable_set(:@@cached_freshness, nil)
      described_class.class_variable_set(:@@cached_coverage, nil)
    end

    let(:waterways_de) do
      [
        { 'slug' => 'aare', 'name' => 'Aare', 'locale' => 'de',
          'geometry' => line_geometry_json,
          'paddlingEnvironmentType_slug' => 'fluss', 'length' => 50 }
      ]
    end

    let(:waterways_en) do
      [
        { 'slug' => 'aare', 'name' => 'Aare River', 'locale' => 'en',
          'geometry' => line_geometry_json,
          'paddlingEnvironmentType_slug' => 'fluss', 'length' => 50 }
      ]
    end

    let(:spots) do
      [
        { 'slug' => 'spot-1', 'waterway_slug' => 'aare', 'locale' => 'de',
          'updatedAt' => '2024-06-15T10:00:00Z',
          'location' => { 'lat' => 47.35, 'lon' => 8.55 } },
        { 'slug' => 'spot-1', 'waterway_slug' => 'aare', 'locale' => 'en',
          'updatedAt' => '2024-06-15T10:00:00Z',
          'location' => { 'lat' => 47.35, 'lon' => 8.55 } }
      ]
    end

    def build_mock_site(locale, waterways)
      config = { 'lang' => locale, 'default_lang' => 'de' }
      data = {
        'paddelbuch_colors' => colors,
        'spots' => spots,
        'waterways' => waterways
      }
      Struct.new(:config, :data).new(config, data)
    end

    it 'produces identical metrics except name field regardless of locale pass order' do
      site_de = build_mock_site('de', waterways_de + waterways_en)
      site_en = build_mock_site('en', waterways_de + waterways_en)

      generator.generate(site_de)
      freshness_de = site_de.data['dashboard_freshness_metrics']
      coverage_de = site_de.data['dashboard_coverage_metrics']

      generator.generate(site_en)
      freshness_en = site_en.data['dashboard_freshness_metrics']
      coverage_en = site_en.data['dashboard_coverage_metrics']

      # Same number of entries
      expect(freshness_de.size).to eq(freshness_en.size)
      expect(coverage_de.size).to eq(coverage_en.size)

      # Freshness: all fields identical except name
      freshness_de.each_with_index do |de_metric, i|
        en_metric = freshness_en[i]
        expect(de_metric['slug']).to eq(en_metric['slug'])
        expect(de_metric['spotCount']).to eq(en_metric['spotCount'])
        expect(de_metric['medianAgeDays']).to eq(en_metric['medianAgeDays'])
        expect(de_metric['color']).to eq(en_metric['color'])
        expect(de_metric['geometry']).to eq(en_metric['geometry'])
      end

      # Coverage: all fields identical except name
      coverage_de.each_with_index do |de_metric, i|
        en_metric = coverage_en[i]
        expect(de_metric['slug']).to eq(en_metric['slug'])
        expect(de_metric['spotCount']).to eq(en_metric['spotCount'])
        expect(de_metric['coveredSegments']).to eq(en_metric['coveredSegments'])
        expect(de_metric['uncoveredSegments']).to eq(en_metric['uncoveredSegments'])
      end

      # Names differ by locale
      expect(freshness_de.first['name']).to eq('Aare')
      expect(freshness_en.first['name']).to eq('Aare River')
    end
  end
end
