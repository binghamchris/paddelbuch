# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe 'EnvLoader after_init hook' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:site_config) { {} }
  let(:site) do
    site = double('Jekyll::Site')
    allow(site).to receive(:source).and_return(tmpdir)
    allow(site).to receive(:config).and_return(site_config)
    site
  end

  # Known keys and their site config mappings
  KNOWN_KEYS = %w[
    MAPBOX_URL
    CONTENTFUL_SPACE_ID
    CONTENTFUL_ACCESS_TOKEN
    CONTENTFUL_ENVIRONMENT
    SITE_URL
  ].freeze

  # Save and restore ENV around each test
  around do |example|
    saved = KNOWN_KEYS.map { |k| [k, ENV[k]] }.to_h
    saved['JEKYLL_ENV'] = ENV['JEKYLL_ENV']
    example.run
  ensure
    saved.each { |k, v| ENV[k] = v }
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: invoke the :after_init hook registered by env_loader.rb
  def trigger_after_init(site)
    hooks = Jekyll::Hooks.instance_variable_get(:@registry)
    after_init_hooks = hooks.dig(:site, :after_init) || []
    after_init_hooks.each { |hook| hook.call(site) }
  end

  # Helper: look up a known key's value in site config
  def config_value_for(site, key)
    case key
    when 'MAPBOX_URL'
      site.config['mapbox_url']
    when 'CONTENTFUL_SPACE_ID'
      site.config.dig('contentful', 'spaces', 0, 'space')
    when 'CONTENTFUL_ACCESS_TOKEN'
      site.config.dig('contentful', 'spaces', 0, 'access_token')
    when 'CONTENTFUL_ENVIRONMENT'
      site.config.dig('contentful', 'spaces', 0, 'environment')
    when 'SITE_URL'
      site.config['url']
    end
  end

  # ─── Property 1: Fault Condition ──────────────────────────────────────
  # System env vars ignored without .env files
  # **Validates: Requirements 1.1, 2.1**

  describe 'Property 1: Fault Condition - no .env files, system env vars set' do
    before do
      # Ensure no .env files are found
      allow(File).to receive(:exist?).and_call_original
      allow(File).to receive(:exist?).with(File.join(tmpdir, '.env')).and_return(false)
      allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.development')).and_return(false)
      allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.production')).and_return(false)
      allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.test')).and_return(false)

      # Clear all known keys from ENV
      KNOWN_KEYS.each { |k| ENV.delete(k) }
      ENV['JEKYLL_ENV'] = 'development'

      # Suppress logger output
      allow(Jekyll.logger).to receive(:info)
    end

    it 'loads system env vars into site config for a random subset of known keys' do
      # **Validates: Requirements 1.1, 2.1**
      property_of {
        # Pick a random non-empty subset of known keys
        subset_size = range(1, KNOWN_KEYS.size)
        chosen_keys = KNOWN_KEYS.sample(subset_size)
        # Generate random non-empty values
        values = chosen_keys.map { |k| [k, sized(range(3, 20)) { string(:alpha) }] }.to_h
        [chosen_keys, values]
      }.check(50) { |chosen_keys, values|
        # Reset config for each trial
        site_config.clear

        # Clear all known keys, then set the chosen subset
        KNOWN_KEYS.each { |k| ENV.delete(k) }
        values.each { |k, v| ENV[k] = v }

        trigger_after_init(site)

        # Assert each chosen key appears in site config
        chosen_keys.each do |key|
          actual = config_value_for(site, key)
          expect(actual).to eq(values[key]),
            "Expected site config for #{key} to be '#{values[key]}', got '#{actual.inspect}'"
        end
      }
    end
  end

  # ─── Partial file case ────────────────────────────────────────────────
  # **Validates: Requirements 1.2, 2.2**

  describe 'Property 1: Fault Condition - partial .env file, system env for missing key' do
    before do
      # Clear all known keys
      KNOWN_KEYS.each { |k| ENV.delete(k) }
      ENV['JEKYLL_ENV'] = 'development'
      allow(Jekyll.logger).to receive(:info)
    end

    it 'loads system env vars for keys not present in the .env file' do
      # **Validates: Requirements 1.2, 2.2**
      # .env file has CONTENTFUL_SPACE_ID only; system env has MAPBOX_URL
      env_file_path = File.join(tmpdir, '.env')

      allow(File).to receive(:exist?).and_call_original
      allow(File).to receive(:exist?).with(env_file_path).and_return(true)
      allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.development')).and_return(false)
      allow(File).to receive(:readlines).with(env_file_path).and_return(
        ["CONTENTFUL_SPACE_ID=space_from_file\n"]
      )

      ENV['MAPBOX_URL'] = 'https://tiles.example.com'

      site_config.clear
      trigger_after_init(site)

      # CONTENTFUL_SPACE_ID should come from file
      expect(config_value_for(site, 'CONTENTFUL_SPACE_ID')).to eq('space_from_file')
      # MAPBOX_URL should come from system env (this will fail on unfixed code)
      expect(config_value_for(site, 'MAPBOX_URL')).to eq('https://tiles.example.com')
    end
  end
end
