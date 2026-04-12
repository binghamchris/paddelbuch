# frozen_string_literal: true

require 'spec_helper'
require 'liquid'
require 'cgi'

RSpec.describe 'Default Layout SEO Meta Tags' do
  LAYOUT_PATH = File.expand_path('../../_layouts/default.html', __dir__)

  # Extract the SEO-relevant Liquid template section from the actual layout file.
  # This covers from the canonical link through the twitter:description meta tag.
  SEO_TEMPLATE = begin
    layout_content = File.read(LAYOUT_PATH)
    # Extract from canonical URL comment through the last twitter meta tag
    match = layout_content.match(
      /<!-- Canonical URL -->.*?<meta name="twitter:description"[^>]*>/m
    )
    raise "Could not extract SEO section from #{LAYOUT_PATH}" unless match

    match[0]
  end

  # Render the SEO template snippet with the given site and page variables.
  # Pre-sets _resolved_title and _resolved_description from page variables to
  # replicate the effect of the resolve-meta.html include, which cannot run
  # inside a bare Liquid::Template.parse context.
  def render_seo(site_vars, page_vars)
    template = Liquid::Template.parse(SEO_TEMPLATE)
    assigns = { 'site' => site_vars, 'page' => page_vars }
    assigns['_resolved_title'] = page_vars['title'] if page_vars['title']
    assigns['_resolved_description'] = page_vars['description'] if page_vars['description']
    template.render(assigns)
  end

  # --- Random generators ---

  def random_alpha(min_len = 3, max_len = 15)
    Array.new(rand(min_len..max_len)) { ('a'..'z').to_a.sample }.join
  end

  def random_url
    "https://#{random_alpha(4, 12)}.#{%w[com ch org net].sample}"
  end

  def random_path
    segments = Array.new(rand(1..4)) { random_alpha(2, 8) }
    "/#{segments.join('/')}/"
  end

  def random_path_with_index
    segments = Array.new(rand(1..4)) { random_alpha(2, 8) }
    "/#{segments.join('/')}/index.html"
  end

  def random_title
    Array.new(rand(1..5)) { random_alpha(3, 10) }.join(' ').capitalize
  end

  def random_description
    Array.new(rand(3..12)) { random_alpha(2, 10) }.join(' ')
  end

  def random_lang
    %w[de en].sample
  end

  # Feature: best-practices-cleanup, Property 9: Canonical URL correctness
  # Validates: Requirements 8.1
  describe 'Property 9: Canonical URL correctness' do
    it 'sets canonical href to site.url + page URL with index.html stripped for 100 random inputs' do
      100.times do |i|
        site_url = random_url
        # Alternate between paths with and without index.html
        page_url = i.even? ? random_path_with_index : random_path
        expected_url = site_url + page_url.sub('index.html', '')

        html = render_seo(
          { 'url' => site_url, 'title' => 'Site', 'description' => 'Desc', 'lang' => 'de' },
          { 'url' => page_url }
        )

        canonical_match = html.match(/rel="canonical"\s+href="([^"]*)"/)
        expect(canonical_match).not_to be_nil,
          "Iteration #{i + 1}: canonical link tag not found in rendered HTML"

        actual_href = canonical_match[1]
        expect(actual_href).to eq(expected_url),
          "Iteration #{i + 1}: canonical href mismatch.\n" \
          "site.url=#{site_url}, page.url=#{page_url}\n" \
          "Expected: #{expected_url}\n" \
          "Got:      #{actual_href}"
      end
    end
  end

  # Feature: best-practices-cleanup, Property 10: Open Graph tags presence
  # Validates: Requirements 8.2
  describe 'Property 10: Open Graph tags presence' do
    it 'includes og:title, og:description, og:url, og:type, og:locale for 100 random inputs' do
      required_og_properties = %w[og:title og:description og:url og:type og:locale]

      100.times do |i|
        html = render_seo(
          { 'url' => random_url, 'title' => random_title, 'description' => random_description, 'lang' => random_lang },
          { 'url' => random_path, 'title' => random_title, 'description' => random_description }
        )

        required_og_properties.each do |prop|
          pattern = /property="#{Regexp.escape(prop)}"\s+content="[^"]*"/
          expect(html).to match(pattern),
            "Iteration #{i + 1}: missing Open Graph tag '#{prop}' in rendered HTML"
        end
      end
    end
  end

  # Feature: best-practices-cleanup, Property 11: Twitter Card tags presence
  # Validates: Requirements 8.3
  describe 'Property 11: Twitter Card tags presence' do
    it 'includes twitter:card, twitter:title, twitter:description for 100 random inputs' do
      required_twitter_names = %w[twitter:card twitter:title twitter:description]

      100.times do |i|
        html = render_seo(
          { 'url' => random_url, 'title' => random_title, 'description' => random_description, 'lang' => random_lang },
          { 'url' => random_path, 'title' => random_title, 'description' => random_description }
        )

        required_twitter_names.each do |name|
          pattern = /name="#{Regexp.escape(name)}"\s+content="[^"]*"/
          expect(html).to match(pattern),
            "Iteration #{i + 1}: missing Twitter Card tag '#{name}' in rendered HTML"
        end
      end
    end
  end

  # Feature: best-practices-cleanup, Property 12: SEO tags use page-specific front matter
  # Validates: Requirements 8.4, 8.5
  describe 'Property 12: SEO tags use page-specific front matter' do
    it 'uses page title/description in meta tags when page defines them for 100 random inputs' do
      100.times do |i|
        site_title = random_title
        site_desc = random_description
        page_title = random_title
        page_desc = random_description

        # Ensure page values differ from site values so we can distinguish them
        page_title += '_page' unless page_title != site_title
        page_desc += '_page' unless page_desc != site_desc

        html = render_seo(
          { 'url' => random_url, 'title' => site_title, 'description' => site_desc, 'lang' => random_lang },
          { 'url' => random_path, 'title' => page_title, 'description' => page_desc }
        )

        escaped_page_title = CGI.escapeHTML(page_title)

        # og:title should use page title
        og_title_match = html.match(/property="og:title"\s+content="([^"]*)"/)
        expect(og_title_match).not_to be_nil,
          "Iteration #{i + 1}: og:title tag not found"
        expect(og_title_match[1]).to eq(escaped_page_title),
          "Iteration #{i + 1}: og:title should use page title.\n" \
          "Expected: #{escaped_page_title}\nGot: #{og_title_match[1]}"

        # twitter:title should use page title
        tw_title_match = html.match(/name="twitter:title"\s+content="([^"]*)"/)
        expect(tw_title_match).not_to be_nil,
          "Iteration #{i + 1}: twitter:title tag not found"
        expect(tw_title_match[1]).to eq(escaped_page_title),
          "Iteration #{i + 1}: twitter:title should use page title.\n" \
          "Expected: #{escaped_page_title}\nGot: #{tw_title_match[1]}"

        # og:description and twitter:description should use page description
        # The template applies strip_html | truncate: 160 | escape
        expected_desc = Liquid::Template.parse('{{ d | strip_html | truncate: 160 | escape }}')
                                        .render('d' => page_desc)

        og_desc_match = html.match(/property="og:description"\s+content="([^"]*)"/)
        expect(og_desc_match).not_to be_nil,
          "Iteration #{i + 1}: og:description tag not found"
        expect(og_desc_match[1]).to eq(expected_desc),
          "Iteration #{i + 1}: og:description should use page description.\n" \
          "Expected: #{expected_desc}\nGot: #{og_desc_match[1]}"

        tw_desc_match = html.match(/name="twitter:description"\s+content="([^"]*)"/)
        expect(tw_desc_match).not_to be_nil,
          "Iteration #{i + 1}: twitter:description tag not found"
        expect(tw_desc_match[1]).to eq(expected_desc),
          "Iteration #{i + 1}: twitter:description should use page description.\n" \
          "Expected: #{expected_desc}\nGot: #{tw_desc_match[1]}"
      end
    end
  end

  # Feature: best-practices-cleanup, Property 13: Open Graph locale reflects current language
  # Validates: Requirements 8.7
  describe 'Property 13: Open Graph locale reflects current language' do
    it 'maps de to de_CH and en to en_GB for 100 random inputs' do
      locale_map = { 'de' => 'de_CH', 'en' => 'en_GB' }

      100.times do |i|
        lang = random_lang
        expected_locale = locale_map[lang]

        html = render_seo(
          { 'url' => random_url, 'title' => random_title, 'description' => random_description, 'lang' => lang },
          { 'url' => random_path }
        )

        og_locale_match = html.match(/property="og:locale"\s+content="([^"]*)"/)
        expect(og_locale_match).not_to be_nil,
          "Iteration #{i + 1}: og:locale tag not found in rendered HTML"

        expect(og_locale_match[1]).to eq(expected_locale),
          "Iteration #{i + 1}: og:locale mismatch for lang='#{lang}'.\n" \
          "Expected: #{expected_locale}\nGot: #{og_locale_match[1]}"
      end
    end
  end
end
