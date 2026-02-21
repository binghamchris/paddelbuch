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

# ─── Property 2: Preservation ─────────────────────────────────────────
# File-only and override behavior unchanged
# **Validates: Requirements 3.1, 3.2, 3.3**

RSpec.describe 'EnvLoader preservation properties' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:site_config) { {} }
  let(:site) do
    site = double('Jekyll::Site')
    allow(site).to receive(:source).and_return(tmpdir)
    allow(site).to receive(:config).and_return(site_config)
    site
  end

  PRESERVATION_KNOWN_KEYS = %w[
    MAPBOX_URL
    CONTENTFUL_SPACE_ID
    CONTENTFUL_ACCESS_TOKEN
    CONTENTFUL_ENVIRONMENT
    SITE_URL
  ].freeze

  around do |example|
    saved = ENV.to_h.dup
    example.run
  ensure
    # Restore ENV exactly
    ENV.clear
    saved.each { |k, v| ENV[k] = v }
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  def trigger_after_init(site)
    hooks = Jekyll::Hooks.instance_variable_get(:@registry)
    after_init_hooks = hooks.dig(:site, :after_init) || []
    after_init_hooks.each { |hook| hook.call(site) }
  end

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

  before do
    allow(Jekyll.logger).to receive(:info)
    ENV['JEKYLL_ENV'] = 'development'
  end

  # ─── 2a: File-only loading preservation ─────────────────────────────
  # **Validates: Requirements 3.1**

  describe 'Preservation: file-only loading (no system env vars)' do
    it 'maps .env file values to site config for all known keys' do
      # **Validates: Requirements 3.1**
      property_of {
        # Generate random non-empty values for all 5 known keys
        values = PRESERVATION_KNOWN_KEYS.map { |k|
          [k, sized(range(3, 20)) { string(:alpha) }]
        }.to_h
        values
      }.check(50) { |values|
        site_config.clear

        # Clear all known keys from system ENV so file values are used
        PRESERVATION_KNOWN_KEYS.each { |k| ENV.delete(k) }

        # Stub .env file with generated values
        env_file_path = File.join(tmpdir, '.env')
        env_lines = values.map { |k, v| "#{k}=#{v}\n" }

        allow(File).to receive(:exist?).and_call_original
        allow(File).to receive(:exist?).with(env_file_path).and_return(true)
        allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.development')).and_return(false)
        allow(File).to receive(:readlines).with(env_file_path).and_return(env_lines)

        trigger_after_init(site)

        # Assert each known key in site config matches the file value
        PRESERVATION_KNOWN_KEYS.each do |key|
          actual = config_value_for(site, key)
          expect(actual).to eq(values[key]),
            "Expected site config for #{key} to be '#{values[key]}', got '#{actual.inspect}'"
        end
      }
    end
  end

  # ─── 2b: System override preservation ───────────────────────────────
  # **Validates: Requirements 3.2**

  describe 'Preservation: system env overrides file values' do
    it 'uses system env values over .env file values for all known keys' do
      # **Validates: Requirements 3.2**
      property_of {
        # Generate distinct random values for file and system env
        file_values = PRESERVATION_KNOWN_KEYS.map { |k|
          [k, "file_" + sized(range(3, 15)) { string(:alpha) }]
        }.to_h
        sys_values = PRESERVATION_KNOWN_KEYS.map { |k|
          [k, "sys_" + sized(range(3, 15)) { string(:alpha) }]
        }.to_h
        [file_values, sys_values]
      }.check(50) { |file_values, sys_values|
        site_config.clear

        # Set system env vars for all known keys
        PRESERVATION_KNOWN_KEYS.each { |k| ENV[k] = sys_values[k] }

        # Stub .env file with file values
        env_file_path = File.join(tmpdir, '.env')
        env_lines = file_values.map { |k, v| "#{k}=#{v}\n" }

        allow(File).to receive(:exist?).and_call_original
        allow(File).to receive(:exist?).with(env_file_path).and_return(true)
        allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.development')).and_return(false)
        allow(File).to receive(:readlines).with(env_file_path).and_return(env_lines)

        trigger_after_init(site)

        # Assert system env values win over file values
        PRESERVATION_KNOWN_KEYS.each do |key|
          actual = config_value_for(site, key)
          expect(actual).to eq(sys_values[key]),
            "Expected site config for #{key} to be system value '#{sys_values[key]}', got '#{actual.inspect}'"
        end
      }
    end
  end

  # ─── 2c: Additional variables preservation ──────────────────────────
  # **Validates: Requirements 3.3**

  describe 'Preservation: additional non-known keys exported to ENV' do
    it 'exports extra .env keys to ENV via ENV[k] ||= v' do
      # **Validates: Requirements 3.3**
      property_of {
        # Generate 2-4 extra non-known keys with random values
        count = range(2, 4)
        extra = count.times.map { |i|
          key = "CUSTOM_VAR_#{i}_" + sized(range(3, 8)) { string(:alpha).upcase }
          val = sized(range(3, 15)) { string(:alpha) }
          [key, val]
        }.to_h
        extra
      }.check(50) { |extra|
        site_config.clear

        # Clear extra keys from ENV
        extra.each { |k, _| ENV.delete(k) }
        PRESERVATION_KNOWN_KEYS.each { |k| ENV.delete(k) }

        # Stub .env file with only the extra keys (no known keys)
        env_file_path = File.join(tmpdir, '.env')
        env_lines = extra.map { |k, v| "#{k}=#{v}\n" }

        allow(File).to receive(:exist?).and_call_original
        allow(File).to receive(:exist?).with(env_file_path).and_return(true)
        allow(File).to receive(:exist?).with(File.join(tmpdir, '.env.development')).and_return(false)
        allow(File).to receive(:readlines).with(env_file_path).and_return(env_lines)

        trigger_after_init(site)

        # Assert extra keys are exported to ENV
        extra.each do |key, val|
          expect(ENV[key]).to eq(val),
            "Expected ENV['#{key}'] to be '#{val}', got '#{ENV[key].inspect}'"
        end

        # Clean up extra keys after assertion
        extra.each { |k, _| ENV.delete(k) }
      }
    end
  end
end
