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


# Feature: spot-tips, Property 8: API Dimension Table Output Structure
# Feature: spot-tips, Property 9: API Spot Transform Includes spotTipType

# Extend Rantly with helpers if not already defined
class Rantly
  unless method_defined?(:gen_slug)
    def gen_slug
      sized(range(3, 10)) { string(:alpha) }.downcase
    end
  end

  unless method_defined?(:gen_name)
    def gen_name
      sized(range(3, 12)) { string(:alpha) }
    end
  end
end

# ==========================================================================
# Property 8: API Dimension Table Output Structure
# **Validates: Requirements 6.2, 6.6**
# ==========================================================================
RSpec.describe 'Property 8: API Dimension Table Output Structure' do
  let(:generator) do
    gen = Jekyll::ApiGenerator.new
    gen.instance_variable_set(:@timestamp_cache, {})
    gen
  end

  def random_timestamp
    year  = rand(2020..2030)
    month = rand(1..12)
    day   = rand(1..28)
    hour  = rand(0..23)
    min   = rand(0..59)
    sec   = rand(0..59)
    format('%04d-%02d-%02dT%02d:%02d:%02dZ', year, month, day, hour, min, sec)
  end

  def random_raw_description
    text = ('a'..'z').to_a.sample(rand(5..15)).join
    "{\"nodeType\":\"document\",\"content\":[{\"nodeType\":\"paragraph\",\"content\":[{\"nodeType\":\"text\",\"value\":\"#{text}\",\"marks\":[]}]}]}"
  end

  it 'produces JSON with slug, node_locale, createdAt, updatedAt, name, and wrapped description for 100 random tip type records' do
    property_of {
      Rantly {
        slug = gen_slug
        name = gen_name
        locale = choose('de', 'en')
        has_description = choose(true, false)
        raw_desc = has_description ? nil : nil # placeholder, set below

        { slug: slug, name: name, locale: locale, has_description: has_description }
      }
    }.check(100) { |data|
      created = random_timestamp
      updated = random_timestamp
      raw_desc = data[:has_description] ? random_raw_description : nil

      # Build the dimension entry item as get_dimension_data would produce it
      item = {
        'slug' => data[:slug],
        'name' => data[:name],
        'createdAt' => created,
        'updatedAt' => updated
      }
      item['_raw_description'] = raw_desc if data[:has_description]

      result = generator.send(:transform_dimension_entry, item, data[:locale], 'spottiptypes')

      # Must contain all required keys
      expect(result).to have_key('slug'), "Missing 'slug' key"
      expect(result).to have_key('node_locale'), "Missing 'node_locale' key"
      expect(result).to have_key('createdAt'), "Missing 'createdAt' key"
      expect(result).to have_key('updatedAt'), "Missing 'updatedAt' key"
      expect(result).to have_key('name'), "Missing 'name' key"
      expect(result).to have_key('description'), "Missing 'description' key"

      # Values match input
      expect(result['slug']).to eq(data[:slug])
      expect(result['node_locale']).to eq(data[:locale])
      expect(result['name']).to eq(data[:name])

      # Description is always a wrapped raw object
      desc = result['description']
      expect(desc).to be_a(Hash), "description should be a Hash, got #{desc.class}"
      expect(desc).to have_key('raw'), "description hash should have 'raw' key"

      if data[:has_description]
        expect(desc['raw']).not_to be_empty
        expect(desc['raw']).to include('nodeType')
      else
        # When no _raw_description, wrap_raw_description returns empty document
        expect(desc['raw']).to eq('{"data":{},"content":[],"nodeType":"document"}')
      end
    }
  end
end

# ==========================================================================
# Property 9: API Spot Transform Includes spotTipType
# **Validates: Requirements 6.4, 6.5**
# ==========================================================================
RSpec.describe 'Property 9: API Spot Transform Includes spotTipType' do
  let(:generator) do
    gen = Jekyll::ApiGenerator.new
    gen.instance_variable_set(:@timestamp_cache, {})
    gen
  end

  def random_timestamp
    year  = rand(2020..2030)
    month = rand(1..12)
    day   = rand(1..28)
    hour  = rand(0..23)
    min   = rand(0..59)
    sec   = rand(0..59)
    format('%04d-%02d-%02dT%02d:%02d:%02dZ', year, month, day, hour, min, sec)
  end

  it 'produces spotTipType as array of slug objects for 100 random spot records' do
    property_of {
      Rantly {
        num_tips = range(0, 5)
        tip_slugs = Array.new(num_tips) { gen_slug }

        { tip_slugs: tip_slugs }
      }
    }.check(100) { |data|
      # Build a minimal spot item with the required fields
      item = {
        'slug' => 'test-spot',
        'locale' => 'de',
        'createdAt' => random_timestamp,
        'updatedAt' => random_timestamp,
        'name' => 'Test Spot',
        '_raw_description' => '{"nodeType":"document","content":[]}',
        'location' => nil,
        'approximateAddress' => nil,
        'country' => nil,
        'confirmed' => false,
        'rejected' => false,
        'waterway_slug' => nil,
        'spotType_slug' => nil,
        'paddlingEnvironmentType_slug' => nil,
        'paddleCraftTypes' => [],
        'eventNotices' => [],
        'obstacles' => [],
        'dataSourceType_slug' => nil,
        'dataLicenseType_slug' => nil,
        'spotTipType_slugs' => data[:tip_slugs]
      }

      result = generator.send(:transform_spot, item)

      expect(result).to have_key('spotTipType'),
        "Missing 'spotTipType' key in transform_spot output"

      tip_type_field = result['spotTipType']
      expect(tip_type_field).to be_an(Array),
        "spotTipType should be an Array, got #{tip_type_field.class}"

      if data[:tip_slugs].empty?
        # Requirement 6.5: empty array when no slugs
        expect(tip_type_field).to eq([]),
          "Expected empty array for spot with no tips, got #{tip_type_field.inspect}"
      else
        # Requirement 6.4: array of {"slug": "..."} objects
        expected = data[:tip_slugs].map { |s| { 'slug' => s } }
        expect(tip_type_field).to eq(expected),
          "Expected #{expected.inspect}, got #{tip_type_field.inspect}"
      end

      # Each element must be a hash with only 'slug' key
      tip_type_field.each_with_index do |obj, i|
        expect(obj).to be_a(Hash),
          "Element #{i} should be a Hash, got #{obj.class}"
        expect(obj.keys).to eq(['slug']),
          "Element #{i} should have only 'slug' key, got #{obj.keys.inspect}"
      end
    }
  end
end
