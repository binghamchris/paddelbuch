# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'json'

RSpec.describe Jekyll::MapConfigGenerator do
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

  # Representative type data matching the YAML structure
  let(:paddle_craft_types) do
    [
      { 'locale' => 'de', 'slug' => 'seekajak', 'name_de' => 'Seekajak', 'name_en' => 'Sea Kayak' },
      { 'locale' => 'en', 'slug' => 'seekajak', 'name_de' => 'Seekajak', 'name_en' => 'Sea Kayak' },
      { 'locale' => 'de', 'slug' => 'kanadier', 'name_de' => 'Kanadier', 'name_en' => 'Canoe' },
      { 'locale' => 'en', 'slug' => 'kanadier', 'name_de' => 'Kanadier', 'name_en' => 'Canoe' }
    ]
  end

  let(:protected_area_types) do
    [
      { 'locale' => 'de', 'slug' => 'naturschutzgebiet', 'name_de' => 'Naturschutzgebiet', 'name_en' => 'Nature Reserve' },
      { 'locale' => 'en', 'slug' => 'naturschutzgebiet', 'name_de' => 'Naturschutzgebiet', 'name_en' => 'Nature Reserve' },
      { 'locale' => 'de', 'slug' => 'schilfgebiet', 'name_de' => 'Schilfgebiet', 'name_en' => 'Reedbed' },
      { 'locale' => 'en', 'slug' => 'schilfgebiet', 'name_de' => 'Schilfgebiet', 'name_en' => 'Reedbed' }
    ]
  end

  let(:spot_types) do
    [
      { 'locale' => 'de', 'slug' => 'einstieg-ausstieg', 'name_de' => 'Ein- und Ausstieg', 'name_en' => 'Entry and Exit' },
      { 'locale' => 'en', 'slug' => 'einstieg-ausstieg', 'name_de' => 'Ein- und Ausstieg', 'name_en' => 'Entry and Exit' }
    ]
  end

  before do
    site.data['types'] = {
      'spot_types' => spot_types,
      'paddle_craft_types' => paddle_craft_types,
      'protected_area_types' => protected_area_types
    }
  end

  def run_generator
    generator.generate(site)
  end

  def find_map_config_page
    site.pages.find { |p| p.name == 'map-config.js' }
  end

  def parse_config_from_page(page)
    # Extract JSON from "window.paddelbuchMapConfig = {...};"
    content = page.content
    json_str = content.sub('window.paddelbuchMapConfig = ', '').chomp(';')
    JSON.parse(json_str)
  end

  # ===========================================================================
  # JS OUTPUT FORMAT
  # ===========================================================================
  describe 'JS output format' do
    it 'produces output with window.paddelbuchMapConfig = {...}; wrapper' do
      run_generator
      page = find_map_config_page
      expect(page).not_to be_nil
      expect(page.content).to start_with('window.paddelbuchMapConfig = ')
      expect(page.content).to end_with(';')

      # Verify the JSON inside is parseable
      json_str = page.content.sub('window.paddelbuchMapConfig = ', '').chomp(';')
      expect { JSON.parse(json_str) }.not_to raise_error
    end
  end

  # ===========================================================================
  # OUTPUT FILE PATH
  # ===========================================================================
  describe 'output file path' do
    it 'places the output file at api/map-config.js' do
      run_generator
      page = find_map_config_page
      expect(page).not_to be_nil
      expect(page.dir).to eq('/api/')
      expect(page.name).to eq('map-config.js')
    end

    it 'sets layout to nil' do
      run_generator
      page = find_map_config_page
      expect(page.data['layout']).to be_nil
    end
  end

  # ===========================================================================
  # SKIP NON-DEFAULT LANGUAGE PASSES
  # ===========================================================================
  describe 'language pass handling' do
    it 'skips generation when current lang differs from default lang' do
      site.config['default_lang'] = 'de'
      site.config['lang'] = 'en'

      run_generator

      page = find_map_config_page
      expect(page).to be_nil
    end

    it 'generates when current lang matches default lang' do
      site.config['default_lang'] = 'de'
      site.config['lang'] = 'de'

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil
    end

    it 'generates when lang is not set (defaults to default_lang)' do
      site.config['default_lang'] = 'de'
      site.config.delete('lang')

      run_generator

      page = find_map_config_page
      expect(page).not_to be_nil
    end
  end

  # ===========================================================================
  # EMPTY TYPE DATA
  # ===========================================================================
  describe 'empty type data' do
    it 'produces valid but empty config when all type data is empty' do
      site.data['types'] = {
        'spot_types' => [],
        'paddle_craft_types' => [],
        'protected_area_types' => []
      }

      run_generator
      page = find_map_config_page
      expect(page).not_to be_nil

      config = parse_config_from_page(page)

      %w[de en].each do |locale|
        expect(config[locale]).to be_a(Hash)
        expect(config[locale]['dimensions']).to be_an(Array)
        expect(config[locale]['layerLabels']).to be_a(Hash)
        expect(config[locale]['protectedAreaTypeNames']).to be_a(Hash)

        # Paddle craft options should be empty
        pct_dim = config[locale]['dimensions'].find { |d| d['key'] == 'paddleCraftType' }
        expect(pct_dim['options']).to eq([])

        # Protected area type names should be empty
        expect(config[locale]['protectedAreaTypeNames']).to eq({})
      end
    end

    it 'produces valid config when type data is nil' do
      site.data['types'] = {
        'spot_types' => nil,
        'paddle_craft_types' => nil,
        'protected_area_types' => nil
      }

      run_generator
      page = find_map_config_page
      config = parse_config_from_page(page)

      %w[de en].each do |locale|
        pct_dim = config[locale]['dimensions'].find { |d| d['key'] == 'paddleCraftType' }
        expect(pct_dim['options']).to eq([])
        expect(config[locale]['protectedAreaTypeNames']).to eq({})
      end
    end
  end

  # ===========================================================================
  # NAME FALLBACK BEHAVIOR
  # ===========================================================================
  describe 'name_en fallback to name_de' do
    it 'uses name_de when name_en is missing for paddle craft types' do
      site.data['types']['paddle_craft_types'] = [
        { 'slug' => 'test-craft', 'name_de' => 'Testboot', 'name_en' => nil }
      ]

      run_generator
      page = find_map_config_page
      config = parse_config_from_page(page)

      en_pct = config['en']['dimensions'].find { |d| d['key'] == 'paddleCraftType' }
      option = en_pct['options'].find { |o| o['slug'] == 'test-craft' }
      expect(option['label']).to eq('Testboot')
    end

    it 'uses name_de when name_en is empty string for protected area types' do
      site.data['types']['protected_area_types'] = [
        { 'slug' => 'test-area', 'name_de' => 'Testgebiet', 'name_en' => '' }
      ]

      run_generator
      page = find_map_config_page
      config = parse_config_from_page(page)

      expect(config['en']['protectedAreaTypeNames']['test-area']).to eq('Testgebiet')
    end
  end

  # ===========================================================================
  # CONFIG STRUCTURE COMPLETENESS
  # ===========================================================================
  describe 'config structure' do
    before { run_generator }

    let(:config) { parse_config_from_page(find_map_config_page) }

    it 'contains both de and en locale keys plus site-level keys' do
      expect(config.keys).to include('de', 'en')
      expect(config.keys).to include('tileUrl', 'center', 'defaultZoom', 'maxZoom', 'attribution')
    end

    %w[de en].each do |locale|
      context "for #{locale} locale" do
        let(:locale_config) { config[locale] }

        it 'has dimensions array with spotType and paddleCraftType entries' do
          dims = locale_config['dimensions']
          expect(dims).to be_an(Array)
          keys = dims.map { |d| d['key'] }
          expect(keys).to contain_exactly('spotType', 'paddleCraftType')
        end

        it 'has layerLabels with all four keys' do
          labels = locale_config['layerLabels']
          expect(labels.keys).to contain_exactly('noEntry', 'eventNotices', 'obstacles', 'protectedAreas')
        end

        it 'has protectedAreaTypeNames hash' do
          expect(locale_config['protectedAreaTypeNames']).to be_a(Hash)
        end

        it 'has non-empty spot type options (from hardcoded SPOT_TYPE_OPTIONS)' do
          spot_dim = locale_config['dimensions'].find { |d| d['key'] == 'spotType' }
          expect(spot_dim['options']).not_to be_empty
          spot_dim['options'].each do |opt|
            expect(opt).to have_key('slug')
            expect(opt).to have_key('label')
          end
        end
      end
    end
  end
end
