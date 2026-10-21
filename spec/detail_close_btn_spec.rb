# frozen_string_literal: true

require 'spec_helper'

# Feature: detail-close-button
# Validates: Requirements 1.3, 1.4, 1.5, 1.9, 4.1, 4.2, 4.3, 5.1, 8.4
#
# Renders the real _includes/detail-close-btn.html through Liquid rather than
# matching its source text, following spec/map_init_search_gating_spec.rb.
#
# The include needs the {% t %} tag from jekyll-multiple-languages-plugin and
# Jekyll's relative_url filter; both are stubbed. The stubs live in this spec's
# own module so the top-level stubs of other specs are not reopened, and the tag
# registry is snapshotted and restored around every example.
module DetailCloseBtnSpec
  INCLUDE_PATH = File.join(__dir__, '..', '_includes', 'detail-close-btn.html')
  PAGE_TYPES = %w[spot waterway obstacle notice].freeze

  class StubTranslateTag < Liquid::Tag
    def render(_context)
      'Back to map'
    end
  end

  module StubUrlFilters
    def relative_url(input)
      input.to_s
    end
  end
end

RSpec.describe 'detail-close-btn.html' do
  around do |example|
    saved_tags = Liquid::Template.tags.dup
    Liquid::Template.register_tag('t', DetailCloseBtnSpec::StubTranslateTag)
    example.run
  ensure
    Liquid::Template.instance_variable_set(:@tags, saved_tags)
  end

  def render(page_type, locale_prefix: '')
    source = File.read(DetailCloseBtnSpec::INCLUDE_PATH)
    context = Liquid::Context.new(
      [{ 'include' => { 'page_type' => page_type }, 'locale_prefix' => locale_prefix }],
      {},
      { site: nil, page: {} }
    )
    context.add_filters([DetailCloseBtnSpec::StubUrlFilters])
    Liquid::Template.parse(source).render(context)
  end

  def attribute(html, name)
    match = html.match(/\s#{Regexp.escape(name)}="([^"]*)"/)
    match && match[1]
  end

  def close_link(html)
    links = html.scan(/<a\b[^>]*class="detail-close-btn"[^>]*>/m)
    expect(links.length).to eq(1), "expected exactly one close link, found #{links.length}"
    links.first
  end

  DetailCloseBtnSpec::PAGE_TYPES.each do |page_type|
    [['', '/'], ['/en', '/en/']].each do |prefix, expected_href|
      context "for page_type #{page_type} with locale_prefix #{prefix.inspect}" do
        let(:html) { render(page_type, locale_prefix: prefix) }
        let(:link) { close_link(html) }

        it "links to #{expected_href} with no query string or fragment" do
          href = attribute(link, 'href')
          expect(href).to eq(expected_href)
          expect(href).not_to include('?')
          expect(href).not_to include('#')
        end

        it 'carries the static detail.close event with the page type as its value' do
          expect(attribute(link, 'data-tinylytics-event')).to eq('detail.close')
          expect(attribute(link, 'data-tinylytics-event-value')).to eq(page_type)
        end

        it 'has an accessible name as aria-label and title' do
          expect(attribute(link, 'aria-label')).to eq('Back to map')
          expect(attribute(link, 'title')).to eq('Back to map')
        end

        it 'hides the icon from assistive technology' do
          svg = html[/<svg\b[^>]*>/]
          expect(svg).not_to be_nil
          expect(attribute(svg, 'aria-hidden')).to eq('true')
          expect(attribute(svg, 'focusable')).to eq('false')
        end

        it 'is CSP-safe: no inline style attribute and no inline script' do
          expect(html).not_to match(/\sstyle=/)
          scripts = html.scan(/<script\b[^>]*>/)
          expect(scripts).not_to be_empty
          scripts.each { |tag| expect(tag).to match(/\ssrc="[^"]+"/) }
          expect(html.scan(%r{<script\b[^>]*>\s*</script>}).length).to eq(scripts.length)
        end

        it 'loads home-view-memory.js' do
          expect(html).to include('src="/assets/js/home-view-memory.js"')
        end
      end
    end
  end

  ['', 'Spot', 'spot ', ' spot', 'spots', '46.8', 'page', 'home', nil].each do |page_type|
    it "renders nothing for page_type #{page_type.inspect}" do
      html = render(page_type)
      expect(html).not_to include('<a')
      expect(html).not_to include('<script')
      expect(html).not_to include('detail.close')
      expect(html.strip).to be_empty
    end
  end
end
