# frozen_string_literal: true

# Feature: build-time-optimization, Property 1: Generator output completeness
# **Validates: Requirements 1.1, 1.2**

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe Jekyll::MapConfigGenerator, 'Property 1: Generator output completeness' do
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

  let(:generator) { described_class.new }

  def run_generator
    generator.generate(site)
  end

  def find_map_config_page
    site.pages.find { |p| p.name == 'map-config.js' }
  end

  def parse_config_from_page(page)
    json_str = page.content.sub('window.paddelbuchMapConfig = ', '').chomp(';')
    JSON.parse(json_str)
  end

  it 'output contains both locales with complete structure for any random type data (100 iterations)' do
    property_of {
      # Generate a random slug using Rantly's built-in methods
      slug_gen = proc {
        len = range(3, 15)
        letters = ('a'..'z').to_a
        chars = letters + ['-']
        first = letters.sample
        middle = Array.new([len - 2, 0].max) { chars.sample }.join
        last = letters.sample
        "#{first}#{middle}#{last}"
      }

      # Generate a random label
      label_gen = proc {
        len = range(2, 20)
        chars = ('a'..'z').to_a + ('A'..'Z').to_a + [' ']
        result = Array.new(len) { chars.sample }.join.strip
        result.empty? ? 'Label' : result
      }

      # Generate random paddle craft types (1-8 unique entries)
      pct_count = range(1, 8)
      pct_slugs = Array.new(pct_count) { slug_gen.call }.uniq
      paddle_craft_types = pct_slugs.flat_map do |s|
        nd = label_gen.call
        ne = label_gen.call
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => s, 'name_de' => nd, 'name_en' => ne }
        end
      end

      # Generate random protected area types (1-8 unique entries)
      pat_count = range(1, 8)
      pat_slugs = Array.new(pat_count) { slug_gen.call }.uniq
      protected_area_types = pat_slugs.flat_map do |s|
        nd = label_gen.call
        ne = label_gen.call
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => s, 'name_de' => nd, 'name_en' => ne }
        end
      end

      guard pct_slugs.length >= 1 && pat_slugs.length >= 1

      [paddle_craft_types, protected_area_types]
    }.check(100) { |paddle_craft_types, protected_area_types|
      # Reset site pages for each iteration
      site.pages.clear

      site.data['types'] = {
        'spot_types' => [],
        'paddle_craft_types' => paddle_craft_types,
        'protected_area_types' => protected_area_types
      }

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil, 'Generator should produce a map-config.js page'

      config = parse_config_from_page(page)

      # Assert output contains both "de" and "en" locale keys
      expect(config).to have_key('de')
      expect(config).to have_key('en')

      %w[de en].each do |locale|
        locale_config = config[locale]

        # Assert each locale has dimensions array
        dims = locale_config['dimensions']
        expect(dims).to be_an(Array)

        # Assert dimensions contain spotType and paddleCraftType entries
        dim_keys = dims.map { |d| d['key'] }
        expect(dim_keys).to include('spotType')
        expect(dim_keys).to include('paddleCraftType')

        # Assert spotType has non-empty options (hardcoded SPOT_TYPE_OPTIONS)
        spot_dim = dims.find { |d| d['key'] == 'spotType' }
        expect(spot_dim['options']).to be_an(Array)
        expect(spot_dim['options']).not_to be_empty
        spot_dim['options'].each do |opt|
          expect(opt).to have_key('slug')
          expect(opt).to have_key('label')
        end

        # Assert paddleCraftType has non-empty options
        pct_dim = dims.find { |d| d['key'] == 'paddleCraftType' }
        expect(pct_dim['options']).to be_an(Array)
        expect(pct_dim['options']).not_to be_empty
        pct_dim['options'].each do |opt|
          expect(opt).to have_key('slug')
          expect(opt).to have_key('label')
        end

        # Assert layerLabels has all four keys
        labels = locale_config['layerLabels']
        expect(labels).to be_a(Hash)
        expect(labels).to have_key('noEntry')
        expect(labels).to have_key('eventNotices')
        expect(labels).to have_key('obstacles')
        expect(labels).to have_key('protectedAreas')

        # Assert protectedAreaTypeNames is present and non-empty
        pat_names = locale_config['protectedAreaTypeNames']
        expect(pat_names).to be_a(Hash)
        expect(pat_names).not_to be_empty
      end
    }
  end
end
