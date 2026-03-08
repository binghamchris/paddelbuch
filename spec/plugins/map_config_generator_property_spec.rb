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

# Feature: build-time-optimization, Property 2: Generator data fidelity
# **Validates: Requirements 1.4, 4.2**

RSpec.describe Jekyll::MapConfigGenerator, 'Property 2: Generator data fidelity' do
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

  it 'paddle_craft_types slugs and labels match source data for any random entries (100 iterations)' do
    property_of {
      slug_gen = proc {
        len = range(3, 15)
        letters = ('a'..'z').to_a
        chars = letters + ['-']
        first = letters.sample
        middle = Array.new([len - 2, 0].max) { chars.sample }.join
        last = letters.sample
        "#{first}#{middle}#{last}"
      }

      label_gen = proc {
        len = range(2, 20)
        chars = ('a'..'z').to_a + ('A'..'Z').to_a + [' ', 'ä', 'ö', 'ü']
        result = Array.new(len) { chars.sample }.join.strip
        result.empty? ? 'Label' : result
      }

      # Generate 1-8 unique paddle craft type entries
      count = range(1, 8)
      slugs = Array.new(count) { slug_gen.call }.uniq
      entries = slugs.map do |s|
        { 'slug' => s, 'name_de' => label_gen.call, 'name_en' => label_gen.call }
      end

      guard slugs.length >= 1
      entries
    }.check(100) { |entries|
      site.pages.clear

      # Create data entries duplicated per locale (matching existing data format)
      paddle_craft_types = entries.flat_map do |e|
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => e['slug'], 'name_de' => e['name_de'], 'name_en' => e['name_en'] }
        end
      end

      site.data['types'] = {
        'spot_types' => [],
        'paddle_craft_types' => paddle_craft_types,
        'protected_area_types' => []
      }

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil
      config = parse_config_from_page(page)

      source_slugs = entries.map { |e| e['slug'] }

      %w[de en].each do |locale|
        pct_dim = config[locale]['dimensions'].find { |d| d['key'] == 'paddleCraftType' }
        output_options = pct_dim['options']

        # Assert generated option slugs match source data slugs exactly
        output_slugs = output_options.map { |o| o['slug'] }
        expect(output_slugs).to match_array(source_slugs)

        # Assert generated labels match name_{locale} of corresponding source entries
        entries.each do |entry|
          option = output_options.find { |o| o['slug'] == entry['slug'] }
          expect(option).not_to be_nil, "Expected slug '#{entry['slug']}' in output for locale '#{locale}'"
          expect(option['label']).to eq(entry["name_#{locale}"]),
            "Expected label '#{entry["name_#{locale}"]}' for slug '#{entry['slug']}' in locale '#{locale}', got '#{option['label']}'"
        end
      end
    }
  end

  it 'protected_area_types slugs and labels match source data for any random entries (100 iterations)' do
    property_of {
      slug_gen = proc {
        len = range(3, 15)
        letters = ('a'..'z').to_a
        chars = letters + ['-']
        first = letters.sample
        middle = Array.new([len - 2, 0].max) { chars.sample }.join
        last = letters.sample
        "#{first}#{middle}#{last}"
      }

      label_gen = proc {
        len = range(2, 20)
        chars = ('a'..'z').to_a + ('A'..'Z').to_a + [' ', 'ä', 'ö', 'ü']
        result = Array.new(len) { chars.sample }.join.strip
        result.empty? ? 'Label' : result
      }

      # Generate 1-8 unique protected area type entries
      count = range(1, 8)
      slugs = Array.new(count) { slug_gen.call }.uniq
      entries = slugs.map do |s|
        { 'slug' => s, 'name_de' => label_gen.call, 'name_en' => label_gen.call }
      end

      guard slugs.length >= 1
      entries
    }.check(100) { |entries|
      site.pages.clear

      # Create data entries duplicated per locale (matching existing data format)
      protected_area_types = entries.flat_map do |e|
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => e['slug'], 'name_de' => e['name_de'], 'name_en' => e['name_en'] }
        end
      end

      site.data['types'] = {
        'spot_types' => [],
        'paddle_craft_types' => [],
        'protected_area_types' => protected_area_types
      }

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil
      config = parse_config_from_page(page)

      source_slugs = entries.map { |e| e['slug'] }

      %w[de en].each do |locale|
        pat_names = config[locale]['protectedAreaTypeNames']

        # Assert generated slugs match source data slugs exactly
        expect(pat_names.keys).to match_array(source_slugs)

        # Assert generated labels match name_{locale} of corresponding source entries
        entries.each do |entry|
          expect(pat_names).to have_key(entry['slug']),
            "Expected slug '#{entry['slug']}' in protectedAreaTypeNames for locale '#{locale}'"
          expect(pat_names[entry['slug']]).to eq(entry["name_#{locale}"]),
            "Expected name '#{entry["name_#{locale}"]}' for slug '#{entry['slug']}' in locale '#{locale}', got '#{pat_names[entry['slug']]}'"
        end
      end
    }
  end
end

# Feature: build-time-optimization, Property 3: Runtime config structure equivalence
# **Validates: Requirements 2.2, 2.5**

RSpec.describe Jekyll::MapConfigGenerator, 'Property 3: Runtime config structure equivalence' do
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

  # Simulate the runtime reading logic from detail-map-layers.html:
  # 1. Read config[locale].dimensions → map to dimensionConfigs (key, label, options)
  # 2. Read config[locale].layerLabels → build layerToggles (key, label, defaultChecked)
  # matchFn is attached at runtime in JS and cannot be tested in Ruby, so we verify
  # that the structural data (keys, labels, options) is equivalent.
  def simulate_runtime_reading(config, locale)
    locale_config = config[locale]
    return { dimension_configs: [], layer_toggles: [] } unless locale_config

    # Simulate: dimensionConfigs = (localeConfig.dimensions || []).map(...)
    dimension_configs = (locale_config['dimensions'] || []).map do |dim|
      {
        'key' => dim['key'],
        'label' => dim['label'],
        'options' => dim['options'] || []
      }
    end

    # Simulate: layerToggles built from localeConfig.layerLabels
    layer_labels = locale_config['layerLabels'] || {}
    layer_toggles = [
      { 'key' => 'noEntry',        'label' => layer_labels['noEntry'] || '',        'defaultChecked' => false },
      { 'key' => 'eventNotices',   'label' => layer_labels['eventNotices'] || '',   'defaultChecked' => true },
      { 'key' => 'obstacles',      'label' => layer_labels['obstacles'] || '',      'defaultChecked' => true },
      { 'key' => 'protectedAreas', 'label' => layer_labels['protectedAreas'] || '', 'defaultChecked' => true }
    ]

    { dimension_configs: dimension_configs, layer_toggles: layer_toggles }
  end

  # Build the expected structure that the old Liquid template would have produced,
  # using the same hardcoded values the generator uses (which match the old Liquid output).
  def build_expected_liquid_output(paddle_craft_entries, locale)
    spot_type_options = Jekyll::MapConfigGenerator::SPOT_TYPE_OPTIONS[locale]
    dimension_labels = Jekyll::MapConfigGenerator::DIMENSION_LABELS[locale]
    layer_labels = Jekyll::MapConfigGenerator::LAYER_LABELS[locale]

    # Build expected paddle craft options (deduplicated by slug, locale-aware labels)
    seen_slugs = {}
    pct_options = []
    paddle_craft_entries.each do |entry|
      slug = entry['slug']
      next if seen_slugs[slug]
      seen_slugs[slug] = true

      label = entry["name_#{locale}"]
      label = entry['name_de'] if label.nil? || label.to_s.empty?
      next if label.nil? || label.to_s.empty?

      pct_options << { 'slug' => slug, 'label' => label }
    end

    dimension_configs = [
      {
        'key' => 'spotType',
        'label' => dimension_labels['spotType'],
        'options' => spot_type_options
      },
      {
        'key' => 'paddleCraftType',
        'label' => dimension_labels['paddleCraftType'],
        'options' => pct_options
      }
    ]

    layer_toggles = [
      { 'key' => 'noEntry',        'label' => layer_labels['noEntry'],        'defaultChecked' => false },
      { 'key' => 'eventNotices',   'label' => layer_labels['eventNotices'],   'defaultChecked' => true },
      { 'key' => 'obstacles',      'label' => layer_labels['obstacles'],      'defaultChecked' => true },
      { 'key' => 'protectedAreas', 'label' => layer_labels['protectedAreas'], 'defaultChecked' => true }
    ]

    { dimension_configs: dimension_configs, layer_toggles: layer_toggles }
  end

  it 'runtime config reading produces same dimensionConfigs and layerToggles as Liquid output (100 iterations)' do
    property_of {
      slug_gen = proc {
        len = range(3, 15)
        letters = ('a'..'z').to_a
        chars = letters + ['-']
        first = letters.sample
        middle = Array.new([len - 2, 0].max) { chars.sample }.join
        last = letters.sample
        "#{first}#{middle}#{last}"
      }

      label_gen = proc {
        len = range(2, 20)
        chars = ('a'..'z').to_a + ('A'..'Z').to_a + [' ', 'ä', 'ö', 'ü']
        result = Array.new(len) { chars.sample }.join.strip
        result.empty? ? 'Label' : result
      }

      # Generate random paddle craft types (1-8 unique entries)
      pct_count = range(1, 8)
      pct_slugs = Array.new(pct_count) { slug_gen.call }.uniq
      paddle_craft_types = pct_slugs.map do |s|
        { 'slug' => s, 'name_de' => label_gen.call, 'name_en' => label_gen.call }
      end

      # Generate random protected area types (1-5 unique entries)
      pat_count = range(1, 5)
      pat_slugs = Array.new(pat_count) { slug_gen.call }.uniq
      protected_area_types = pat_slugs.map do |s|
        { 'slug' => s, 'name_de' => label_gen.call, 'name_en' => label_gen.call }
      end

      # Pick a random locale
      locale = choose('de', 'en')

      guard pct_slugs.length >= 1 && pat_slugs.length >= 1

      [paddle_craft_types, protected_area_types, locale]
    }.check(100) { |paddle_craft_types, protected_area_types, locale|
      site.pages.clear

      # Create data entries duplicated per locale (matching existing data format)
      pct_data = paddle_craft_types.flat_map do |e|
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => e['slug'], 'name_de' => e['name_de'], 'name_en' => e['name_en'] }
        end
      end

      pat_data = protected_area_types.flat_map do |e|
        %w[de en].map do |loc|
          { 'locale' => loc, 'slug' => e['slug'], 'name_de' => e['name_de'], 'name_en' => e['name_en'] }
        end
      end

      site.data['types'] = {
        'spot_types' => [],
        'paddle_craft_types' => pct_data,
        'protected_area_types' => pat_data
      }

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil, 'Generator should produce a map-config.js page'

      config = parse_config_from_page(page)

      # Simulate what the JS runtime does when reading the config
      runtime_result = simulate_runtime_reading(config, locale)

      # Build what the old Liquid template would have produced
      expected_result = build_expected_liquid_output(paddle_craft_types, locale)

      # Assert dimensionConfigs structure equivalence
      runtime_dims = runtime_result[:dimension_configs]
      expected_dims = expected_result[:dimension_configs]

      expect(runtime_dims.length).to eq(expected_dims.length),
        "Expected #{expected_dims.length} dimensions, got #{runtime_dims.length}"

      expected_dims.each_with_index do |expected_dim, i|
        runtime_dim = runtime_dims[i]

        expect(runtime_dim['key']).to eq(expected_dim['key']),
          "Dimension #{i} key mismatch: expected '#{expected_dim['key']}', got '#{runtime_dim['key']}'"

        expect(runtime_dim['label']).to eq(expected_dim['label']),
          "Dimension '#{expected_dim['key']}' label mismatch for locale '#{locale}'"

        # Compare option slugs and labels
        runtime_slugs = runtime_dim['options'].map { |o| o['slug'] }
        expected_slugs = expected_dim['options'].map { |o| o['slug'] }
        expect(runtime_slugs).to eq(expected_slugs),
          "Dimension '#{expected_dim['key']}' option slugs mismatch for locale '#{locale}'"

        runtime_dim['options'].each_with_index do |runtime_opt, j|
          expected_opt = expected_dim['options'][j]
          expect(runtime_opt['label']).to eq(expected_opt['label']),
            "Option '#{expected_opt['slug']}' label mismatch in dimension '#{expected_dim['key']}' for locale '#{locale}'"
        end
      end

      # Assert layerToggles structure equivalence
      runtime_toggles = runtime_result[:layer_toggles]
      expected_toggles = expected_result[:layer_toggles]

      expect(runtime_toggles.length).to eq(expected_toggles.length),
        "Expected #{expected_toggles.length} layer toggles, got #{runtime_toggles.length}"

      expected_toggles.each_with_index do |expected_toggle, i|
        runtime_toggle = runtime_toggles[i]

        expect(runtime_toggle['key']).to eq(expected_toggle['key']),
          "Layer toggle #{i} key mismatch"

        expect(runtime_toggle['label']).to eq(expected_toggle['label']),
          "Layer toggle '#{expected_toggle['key']}' label mismatch for locale '#{locale}'"

        expect(runtime_toggle['defaultChecked']).to eq(expected_toggle['defaultChecked']),
          "Layer toggle '#{expected_toggle['key']}' defaultChecked mismatch"
      end
    }
  end
end
