
require 'spec_helper'
require 'tmpdir'

# Covers the search feature's build-time configuration: the two existing env vars
# (which had no coverage at all before this spec) and the SEARCH_DISABLED flag.
#
# The flag's polarity is deliberate and these tests pin it: absence must mean
# "search on wherever an endpoint is configured", because a positive
# SEARCH_ENABLED would make absence mean off and silently disable search on every
# existing deploy.
RSpec.describe 'EnvLoader search configuration' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:site_config) { {} }
  let(:site) do
    site = double('Jekyll::Site')
    allow(site).to receive(:source).and_return(tmpdir)
    allow(site).to receive(:config).and_return(site_config)
    site
  end

  SEARCH_ENV_KEYS = %w[SEARCH_API_ENDPOINT SEARCH_API_KEY SEARCH_DISABLED].freeze
  ENDPOINT = 'https://example.execute-api.eu-central-1.amazonaws.com/prod/search'

  around do |example|
    saved = SEARCH_ENV_KEYS.map { |k| [k, ENV[k]] }.to_h
    saved['JEKYLL_ENV'] = ENV['JEKYLL_ENV']
    SEARCH_ENV_KEYS.each { |k| ENV.delete(k) }
    ENV['JEKYLL_ENV'] = 'development'
    example.run
  ensure
    saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  def trigger_after_init(site)
    hooks = Jekyll::Hooks.instance_variable_get(:@registry)
    (hooks.dig(:site, :after_init) || []).each { |hook| hook.call(site) }
  end

  # The hook only reads system ENV when a .env file exists, matching the
  # precedence documented in the plugin.
  def build_with(env)
    File.write(File.join(tmpdir, '.env'), env.map { |k, v| "#{k}=#{v}" }.join("\n"))
    trigger_after_init(site)
    site_config
  end

  describe 'the existing endpoint and key mapping' do
    it 'maps a configured endpoint and key into site config' do
      config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_API_KEY' => 'abc123')

      expect(config['search_api_endpoint']).to eq(ENDPOINT)
      expect(config['search_api_key']).to eq('abc123')
    end

    it 'treats an empty endpoint as unset, so an unconfigured deploy degrades' do
      config = build_with('SEARCH_API_ENDPOINT' => '', 'SEARCH_API_KEY' => '')

      expect(config['search_api_endpoint']).to be_nil
      expect(config['search_api_key']).to be_nil
    end

    it 'treats a whitespace-only endpoint as unset' do
      config = build_with('SEARCH_API_ENDPOINT' => '   ')

      expect(config['search_api_endpoint']).to be_nil
    end
  end

  describe 'SEARCH_DISABLED parsing' do
    # Values that switch the feature off.
    ['true', 'TRUE', 'True', ' true ', '1', 'yes', 'YES'].each do |value|
      it "treats #{value.inspect} as disabled" do
        config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_DISABLED' => value)

        expect(config['search_disabled']).to be(true)
        expect(config['search_enabled']).to be(false)
      end
    end

    # Values that leave the feature on.
    ['false', 'FALSE', ' false ', '0', 'no', ''].each do |value|
      it "treats #{value.inspect} as not disabled" do
        config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_DISABLED' => value)

        expect(config['search_disabled']).to be(false)
        expect(config['search_enabled']).to be(true)
      end
    end

    it 'treats an absent flag as not disabled, so existing deploys are unaffected' do
      config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT)

      expect(config['search_disabled']).to be(false)
      expect(config['search_enabled']).to be(true)
    end

    # The judgement call: ambiguity resolves to OFF, because someone who typed a
    # value into a kill switch intended to use it.
    it 'treats an unrecognised value as disabled and warns, naming the value' do
      expect(Jekyll.logger).to receive(:warn).with('EnvLoader:', /ture.*disabling search/i)

      config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_DISABLED' => 'ture')

      expect(config['search_disabled']).to be(true)
      expect(config['search_enabled']).to be(false)
    end

    it 'does not treat "false" as a non-empty truthy value' do
      # Guards the rejected alternative policy, under which any non-empty value
      # would have disabled search -- making SEARCH_DISABLED=false disable it.
      config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_DISABLED' => 'false')

      expect(config['search_enabled']).to be(true)
    end
  end

  describe 'the derived search_enabled boolean' do
    it 'is false when no endpoint is configured, flag or no flag' do
      expect(build_with('SEARCH_DISABLED' => 'false')['search_enabled']).to be(false)
    end

    it 'is false when the endpoint is configured but the flag disables it' do
      config = build_with('SEARCH_API_ENDPOINT' => ENDPOINT, 'SEARCH_DISABLED' => 'true')

      expect(config['search_enabled']).to be(false)
      # The endpoint is deliberately still in config, so switching the feature
      # back on does not require recovering the URL.
      expect(config['search_api_endpoint']).to eq(ENDPOINT)
    end

    it 'is true only when an endpoint is configured and the flag is not set' do
      expect(build_with('SEARCH_API_ENDPOINT' => ENDPOINT)['search_enabled']).to be(true)
    end

    it 'is always a boolean, never nil, so Liquid cannot misread it' do
      expect(build_with({})['search_enabled']).to be(false)
    end
  end

  describe 'Jekyll::EnvLoader.search_disabled?' do
    it 'is exposed on the class rather than polluting Object' do
      expect(Jekyll::EnvLoader).to respond_to(:search_disabled?)
      expect(Object.new).not_to respond_to(:search_disabled?)
    end

    it 'handles nil without raising' do
      expect(Jekyll::EnvLoader.search_disabled?(nil)).to be(false)
    end
  end
end
