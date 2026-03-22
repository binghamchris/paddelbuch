# frozen_string_literal: true

# Feature: best-practices-cleanup, Property 2: Timestamp normalization round trip

require 'spec_helper'
require 'time'

RSpec.describe 'Property 2: Timestamp normalization round trip' do
  # Validates: Requirements 2.2

  let(:generator) do
    gen = Jekyll::ApiGenerator.new
    gen.instance_variable_set(:@timestamp_cache, {})
    gen
  end

  # Helper to call the private method
  def normalize(gen, ts)
    gen.send(:normalize_to_contentful_timestamp, ts)
  end

  # Generate a random valid ISO 8601 timestamp string in various formats
  def random_iso8601_timestamp
    year  = rand(2000..2030)
    month = rand(1..12)
    day   = rand(1..28) # stay safe with all months
    hour  = rand(0..23)
    min   = rand(0..59)
    sec   = rand(0..59)

    base = format('%04d-%02d-%02dT%02d:%02d:%02d', year, month, day, hour, min, sec)

    # Randomly choose a format variant
    case rand(4)
    when 0
      # Already normalized: Z suffix
      "#{base}Z"
    when 1
      # With milliseconds and Z
      ms = rand(0..999)
      "#{base}.#{format('%03d', ms)}Z"
    when 2
      # With +00:00 offset
      "#{base}+00:00"
    when 3
      # With arbitrary timezone offset
      offset_h = rand(-12..12)
      offset_m = [0, 30].sample
      "#{base}#{format('%+03d:%02d', offset_h, offset_m)}"
    end
  end

  OUTPUT_PATTERN = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\z/

  it 'returns YYYY-MM-DDTHH:MM:SSZ format for 100 random ISO 8601 timestamps' do
    100.times do |i|
      ts = random_iso8601_timestamp
      result = normalize(generator, ts)

      expect(result).to match(OUTPUT_PATTERN),
        "Iteration #{i + 1}: normalize_to_contentful_timestamp(#{ts.inspect}) " \
        "returned #{result.inspect}, expected YYYY-MM-DDTHH:MM:SSZ format"
    end
  end

  it 'is idempotent for 100 random ISO 8601 timestamps' do
    100.times do |i|
      ts = random_iso8601_timestamp
      first_result  = normalize(generator, ts)
      second_result = normalize(generator, first_result)

      expect(second_result).to eq(first_result),
        "Iteration #{i + 1}: idempotence failed for #{ts.inspect}. " \
        "First call: #{first_result.inspect}, second call: #{second_result.inspect}"
    end
  end
end

# Feature: navigable-by-paddlers, Property 2: API transformer tri-state pass-through

RSpec.describe 'Property 2: API transformer tri-state pass-through' do
  # Validates: Requirements 2.1, 2.2, 2.3, 2.4

  let(:generator) do
    gen = Jekyll::ApiGenerator.new
    gen.instance_variable_set(:@timestamp_cache, {})
    gen
  end

  def random_slug
    length = rand(3..12)
    chars = ('a'..'z').to_a + ('0'..'9').to_a + ['-']
    length.times.map { chars.sample }.join
  end

  def random_waterway_hash(navigable_value)
    {
      'slug' => random_slug,
      'locale' => %w[de en].sample,
      'name' => "Waterway-#{rand(1000)}",
      'length' => rand(1..500).to_f,
      'area' => [nil, rand(1..200).to_f].sample,
      'geometry' => ['{"type":"LineString","coordinates":[[7.0,46.0],[7.1,46.1]]}', nil].sample,
      'paddlingEnvironmentType_slug' => %w[fluss see wildwasser].sample,
      'dataSourceType_slug' => %w[community official].sample,
      'dataLicenseType_slug' => %w[cc-by-sa cc-by].sample,
      'createdAt' => '2025-01-10T08:30:00Z',
      'updatedAt' => '2025-01-15T10:00:00Z',
      'navigableByPaddlers' => navigable_value
    }
  end

  it 'preserves navigableByPaddlers value through transform_waterway for 100 random waterways' do
    100.times do |i|
      navigable_value = [true, false, nil].sample
      waterway = random_waterway_hash(navigable_value)

      result = generator.send(:transform_waterway, waterway)

      expect(result).to have_key('navigableByPaddlers'),
        "Iteration #{i + 1}: transformed hash missing 'navigableByPaddlers' key"

      expect(result['navigableByPaddlers']).to eq(navigable_value),
        "Iteration #{i + 1}: expected navigableByPaddlers=#{navigable_value.inspect}, " \
        "got #{result['navigableByPaddlers'].inspect} for waterway #{waterway['slug']}"
    end
  end
end
