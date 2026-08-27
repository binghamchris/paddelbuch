
require 'spec_helper'

# Asserts Requirement 11.7: a build with search disabled emits neither the search
# config block nor the semantic-search.js script tag.
#
# Renders the real _includes/map-init.html through Liquid rather than asserting on
# its source text. A regex over the source would pass while the behaviour was
# broken and break while the behaviour was fine, so it is not used here.
#
# The include needs two things Liquid does not provide on its own: the {% t %} tag
# from jekyll-multiple-languages-plugin, and the relative_url filter from Jekyll.
# Both are stubbed. The tag registry is snapshotted and restored so other specs in
# the same process are unaffected, and filters are added to the context rather than
# registered globally, for the same reason.
RSpec.describe 'map-init.html search gating' do
  INCLUDE_PATH = File.join(__dir__, '..', '_includes', 'map-init.html')

  # Minimal stand-in for {% t some.key %}: the assertions are about which blocks
  # render, never about translated text.
  class StubTranslateTag < Liquid::Tag
    def render(_context)
      'stub'
    end
  end

  module StubUrlFilters
    def relative_url(input)
      input.to_s
    end
  end

  around do |example|
    saved_tags = Liquid::Template.tags.dup
    Liquid::Template.register_tag('t', StubTranslateTag)
    example.run
  ensure
    # Restore rather than delete: another spec may rely on the real tag.
    Liquid::Template.instance_variable_set(:@tags, saved_tags)
  end

  def render_with(site_config)
    source = File.read(INCLUDE_PATH)
    context = Liquid::Context.new(
      [{ 'site' => site_config, 'current_locale' => 'de', 'page' => {} }],
      {},
      { site: nil, page: {} }
    )
    context.add_filters([StubUrlFilters])
    Liquid::Template.parse(source).render(context)
  end

  let(:enabled_config) do
    {
      'search_enabled' => true,
      'search_api_endpoint' => 'https://example.execute-api.eu-central-1.amazonaws.com/prod/search',
      'search_api_key' => 'abc123'
    }
  end

  describe 'when search is enabled' do
    it 'renders the search config block and the module script tag' do
      output = render_with(enabled_config)

      expect(output).to include('id="semantic-search-config"')
      expect(output).to include('semantic-search.js')
    end

    it 'renders the endpoint into the config block' do
      expect(render_with(enabled_config)).to include('/prod/search')
    end
  end

  describe 'when search is disabled by the feature flag' do
    # The endpoint is deliberately still present in config: the flag must win over
    # a configured endpoint, and must not require discarding it.
    let(:disabled_config) { enabled_config.merge('search_enabled' => false, 'search_disabled' => true) }

    it 'renders no search config block' do
      expect(render_with(disabled_config)).not_to include('semantic-search-config')
    end

    it 'renders no script tag for the search module, so it is never downloaded' do
      expect(render_with(disabled_config)).not_to include('semantic-search.js')
    end

    it 'does not leak the endpoint into the page' do
      expect(render_with(disabled_config)).not_to include('/prod/search')
    end

    it 'still renders the rest of the map, so the flag costs only search' do
      output = render_with(disabled_config)

      expect(output).to include('map-data-init.js')
      expect(output).to include('filter-engine.js')
    end
  end

  describe 'when no endpoint is configured' do
    it 'is indistinguishable from a flag-disabled build (Requirement 11.13)' do
      unconfigured = render_with('search_enabled' => false)
      flag_disabled = render_with(enabled_config.merge('search_enabled' => false))

      expect(unconfigured).not_to include('semantic-search.js')
      expect(flag_disabled).not_to include('semantic-search.js')
      expect(unconfigured).not_to include('semantic-search-config')
      expect(flag_disabled).not_to include('semantic-search-config')
    end
  end

  describe 'the gate itself' do
    it 'keys off the derived boolean, not the raw endpoint' do
      # A truthy endpoint with search_enabled false must render nothing. This is
      # what makes the flag able to override a configured endpoint at all.
      output = render_with(
        'search_enabled' => false,
        'search_api_endpoint' => 'https://example.com/prod/search'
      )

      expect(output).not_to include('semantic-search.js')
    end
  end
end
