# frozen_string_literal: true

# Feature: spot-tips, Property 1: spotTipType Mapper Output Structure
# Feature: spot-tips, Property 2: Spot Mapper Includes spotTipType_slugs

require 'spec_helper'
require 'json'

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

# Minimal stub for a Contentful entry used by map_type / map_spot
class FakeEntry
  attr_reader :sys

  def initialize(sys: {})
    @sys = sys
  end

  def fields_with_locales
    # Not used directly — tests pass fields hash explicitly
    {}
  end
end

RSpec.describe 'spotTipType mapper properties' do
  # ==========================================================================
  # Property 1: spotTipType Mapper Output Structure
  # **Validates: Requirements 1.1, 1.2**
  # ==========================================================================
  describe 'Property 1: spotTipType Mapper Output Structure' do
    it 'produces hash with slug, name_de, name_en, description_de, description_en, _raw_description for random inputs' do
      property_of {
        Rantly {
          slug = gen_slug
          name_de = gen_name
          name_en = gen_name
          locale = choose('de', 'en')

          # Optionally generate a rich text description
          has_description = choose(true, false)
          description_doc = if has_description
                              {
                                'nodeType' => 'document',
                                'content' => [
                                  {
                                    'nodeType' => 'paragraph',
                                    'content' => [
                                      { 'nodeType' => 'text', 'value' => gen_name, 'marks' => [] }
                                    ]
                                  }
                                ]
                              }
                            else
                              nil
                            end

          {
            slug: slug,
            name_de: name_de,
            name_en: name_en,
            locale: locale,
            has_description: has_description,
            description_doc: description_doc
          }
        }
      }.check(100) { |data|
        fields = {
          slug: { de: data[:slug], en: data[:slug] },
          name: { de: data[:name_de], en: data[:name_en] }
        }

        if data[:has_description]
          fields[:description] = { de: data[:description_doc], en: data[:description_doc] }
        else
          fields[:description] = { de: nil, en: nil }
        end

        entry = FakeEntry.new(sys: { id: data[:slug] })

        result = ContentfulMappers.map_type(entry, fields, data[:locale], 'spotTipType')

        # Must contain all required keys
        expect(result).to have_key('slug'), "Missing 'slug' key"
        expect(result).to have_key('name_de'), "Missing 'name_de' key"
        expect(result).to have_key('name_en'), "Missing 'name_en' key"
        expect(result).to have_key('description_de'), "Missing 'description_de' key"
        expect(result).to have_key('description_en'), "Missing 'description_en' key"
        expect(result).to have_key('_raw_description'), "Missing '_raw_description' key"

        # Name fields match input
        expect(result['slug']).to eq(data[:slug])
        expect(result['name_de']).to eq(data[:name_de])
        expect(result['name_en']).to eq(data[:name_en])

        if data[:has_description]
          expect(result['description_de']).to be_a(String)
          expect(result['description_de']).not_to be_empty
          expect(result['description_en']).to be_a(String)
          expect(result['description_en']).not_to be_empty
          expect(result['_raw_description']).not_to be_nil
        else
          expect(result['description_de']).to be_nil
          expect(result['description_en']).to be_nil
          expect(result['_raw_description']).to be_nil
        end
      }
    end
  end

  # ==========================================================================
  # Property 2: Spot Mapper Includes spotTipType_slugs
  # **Validates: Requirements 1.3, 1.4**
  # ==========================================================================
  describe 'Property 2: Spot Mapper Includes spotTipType_slugs' do
    # Build a fake reference object that extract_reference_slug can handle
    FakeRef = Struct.new(:slug_val, :sys_val) do
      def fields_with_locales
        { slug: { en: slug_val } }
      end

      def sys
        sys_val || { id: slug_val }
      end
    end

    it 'spotTipType_slugs is an array of strings matching referenced slugs for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          num_tips = range(0, 5)
          tip_slugs = Array.new(num_tips) { gen_slug }

          { locale: locale, tip_slugs: tip_slugs }
        }
      }.check(100) { |data|
        # Build fake reference objects for spot_tips
        refs = data[:tip_slugs].map { |s| FakeRef.new(s, { id: s }) }

        fields = {
          slug: { de: 'test-spot', en: 'test-spot' },
          name: { de: 'Test', en: 'Test' },
          description: { de: nil, en: nil },
          location: { de: nil, en: nil },
          approximate_address: { de: nil, en: nil },
          country: { de: nil, en: nil },
          confirmed: { de: false, en: false },
          rejected: { de: false, en: false },
          waterway: { de: nil, en: nil },
          spot_type: { de: nil, en: nil },
          paddling_environment_type: { de: nil, en: nil },
          paddle_craft_type: { de: [], en: [] },
          event_notices: { de: [], en: [] },
          obstacles: { de: [], en: [] },
          data_source_type: { de: nil, en: nil },
          data_license_type: { de: nil, en: nil },
          spot_tips: { de: refs, en: refs }
        }

        entry = FakeEntry.new(sys: { id: 'test-spot' })

        result = ContentfulMappers.map_spot(entry, fields, data[:locale])

        expect(result).to have_key('spotTipType_slugs'),
          "Missing 'spotTipType_slugs' key in map_spot output"

        slugs = result['spotTipType_slugs']
        expect(slugs).to be_an(Array),
          "spotTipType_slugs should be an Array, got #{slugs.class}"

        expect(slugs).to eq(data[:tip_slugs]),
          "Expected spotTipType_slugs=#{data[:tip_slugs].inspect}, got #{slugs.inspect}"

        # When no tips, must be empty array
        if data[:tip_slugs].empty?
          expect(slugs).to eq([]),
            "Expected empty array for spot with no tips, got #{slugs.inspect}"
        end
      }
    end
  end
end
