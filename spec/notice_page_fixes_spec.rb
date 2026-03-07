# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'liquid'
require 'date'
require 'time'

# Bug Condition Exploration Tests for Notice Page Fixes
#
# These tests encode the EXPECTED (correct) behavior for notice pages.
# On UNFIXED code, they are EXPECTED TO FAIL — failure confirms the bugs exist.
#
# Property 1: Bug Condition - Notice Page Content Structure
# **Validates: Requirements 1.1, 1.2, 1.3**
#
# For any notice page where the bug condition holds (notices collection, notice layout),
# the rendered HTML SHALL:
# - contain at most one Kurzfassung/summary heading (no redundant h3/p elements)
# - NOT contain extraneous "Gewässerereignisse" breadcrumb/navigation text
# - format start dates as YYYY-MM-DD
# - format updated timestamps as dd. MMMM YYYY um HH:MM

RSpec.describe 'Notice Page Bug Condition Exploration' do
  # Helper: build a minimal Jekyll site with German locale and translations
  def build_jekyll_site(tmpdir)
    # Create i18n directory with German translations
    i18n_dir = File.join(tmpdir, '_i18n')
    FileUtils.mkdir_p(i18n_dir)

    de_translations = {
      'labels' => {
        'summary' => 'Kurzfassung',
        'last_updated' => 'Zuletzt aktualisiert',
        'waterway' => 'Gewässer'
      },
      'event_notices' => {
        'title' => 'Gewässerereignisse',
        'approx_start_date' => 'Ungefähres Startdatum',
        'approx_end_date' => 'Ungefähres Enddatum'
      }
    }
    File.write(File.join(i18n_dir, 'de.yml'), YAML.dump(de_translations))

    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'lang' => 'de',
      'default_lang' => 'de',
      'languages' => ['de', 'en'],
      'collections' => { 'notices' => { 'output' => true } }
    )
    site = Jekyll::Site.new(config)

    # Load translations into site.data so the LocaleFilter#t method can find them
    site.data['translations'] = { 'de' => de_translations }

    site
  end

  # Helper: create a Liquid context with site and notice data
  def make_liquid_context(site, notice_data)
    # Build a Liquid::Context that mimics what Jekyll provides
    registers = { site: site, page: notice_data }
    context = Liquid::Context.new([notice_data], {}, registers)
    context
  end

  # Helper: render a Liquid template string with the given context
  def render_liquid(template_str, context)
    template = Liquid::Template.parse(template_str)
    template.render(context)
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 1 — Redundant Kurzfassung
  # ─────────────────────────────────────────────────────────────────────
  context 'Bug 1.1: Redundant Kurzfassung elements' do
    it 'combined layout output contains at most one Kurzfassung/summary heading' do
      Dir.mktmpdir do |tmpdir|
        site = build_jekyll_site(tmpdir)

        notice_data = {
          'name' => 'Hochwasser Warnung',
          'description' => '<p>Hochwasser erwartet im Rhein-Gebiet</p>',
          'startDate' => '2025-03-01',
          'endDate' => '2025-04-01',
          'updatedAt' => '2025-05-10T14:30:00Z',
          'collection' => 'notices',
          'layout' => 'notice'
        }

        # The notice-detail-content.html include renders an h2 "Kurzfassung" heading
        # when notice.description is present. This is the INTENDED rendering.
        include_template = <<~LIQUID
          {% if notice.description %}
          <div class="notice-full-description mt-4">
            <h2>Kurzfassung</h2>
            <div class="description-content">
              {{ notice.description }}
            </div>
          </div>
          {% endif %}
        LIQUID

        context = make_liquid_context(site, { 'notice' => notice_data })
        include_output = render_liquid(include_template, context)

        # Simulate {{ content }} from default.html:
        # The CollectionGenerator creates virtual documents. If the description
        # leaks into the document body, {{ content }} renders it as additional
        # content with its own heading structure.
        #
        # We simulate this by checking what the collection generator produces.
        notices_dir = File.join(tmpdir, '_notices')
        FileUtils.mkdir_p(notices_dir)
        collection = site.collections['notices']

        generator = Jekyll::CollectionGenerator.new
        doc = generator.send(:create_document, site, collection, notice_data, 'hochwasser-warnung')

        # The document's content is what {{ content }} in default.html would render.
        # If doc.content is non-empty, it would produce additional HTML alongside
        # the include's h2 Kurzfassung heading.
        doc_content = doc.content.to_s.strip

        # Combine: the include output + whatever {{ content }} would render
        combined_html = include_output + doc_content

        # Count Kurzfassung/summary headings (h2 or h3)
        kurzfassung_headings = combined_html.scan(/<h[23][^>]*>.*?Kurzfassung.*?<\/h[23]>/i)

        # Also count if the description text appears more than once
        description_occurrences = combined_html.scan(/Hochwasser erwartet/).length

        expect(kurzfassung_headings.length).to be <= 1,
          "Expected at most 1 Kurzfassung heading, found #{kurzfassung_headings.length}: #{kurzfassung_headings.inspect}"
        expect(description_occurrences).to be <= 1,
          "Expected description to appear at most once, found #{description_occurrences} times"
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 2 — Extraneous Gewässerereignisse
  # ─────────────────────────────────────────────────────────────────────
  context 'Bug 1.2: Extraneous Gewässerereignisse label' do
    it 'notice-icon-div does NOT contain standalone Gewässerereignisse text' do
      Dir.mktmpdir do |tmpdir|
        site = build_jekyll_site(tmpdir)

        # Read the actual notice.html layout to find the notice-icon-div
        layout_path = File.join(File.dirname(__FILE__), '..', '_layouts', 'notice.html')
        layout_content = File.read(layout_path)

        # Extract the notice-icon-div section from the layout
        icon_div_match = layout_content.match(/<div class="notice-icon-div[^"]*"[^>]*>.*?<\/div>/m)
        expect(icon_div_match).not_to be_nil, "Could not find notice-icon-div in notice.html layout"

        icon_div_html = icon_div_match[0]

        # The {% t event_notices.title %} tag resolves to "Gewässerereignisse" in German.
        # Check if the notice-icon-div contains this translation tag.
        has_translation_tag = icon_div_html.include?('{% t event_notices.title %}')

        # On unfixed code, this tag IS present and renders "Gewässerereignisse"
        # as a standalone breadcrumb-like label. The fix should remove it.
        expect(has_translation_tag).to eq(false),
          "notice-icon-div contains {% t event_notices.title %} which renders " \
          "'Gewässerereignisse' as an extraneous breadcrumb label. " \
          "Found in layout: #{icon_div_html}"
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 3 — Start Date Format (Property-Based with Rantly)
  # ─────────────────────────────────────────────────────────────────────
  context 'Bug 1.3: Start date format' do
    it 'renders startDate in YYYY-MM-DD (ISO) format' do
      Dir.mktmpdir do |tmpdir|
        site = build_jekyll_site(tmpdir)

        property_of {
          Rantly {
            year = range(2020, 2030)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            date_str = format('%04d-%02d-%02d', year, month, day)
            date_str
          }
        }.check(50) { |iso_date|
          # Render the startDate through the localized_date filter as used
          # in the fixed notice-detail-content.html: {{ notice.startDate | localized_date: 'iso' }}
          template_str = "{{ notice.startDate | localized_date: 'iso' }}"
          notice_data = { 'startDate' => iso_date }
          context = make_liquid_context(site, { 'notice' => notice_data })
          rendered = render_liquid(template_str, context).strip

          # Expected: YYYY-MM-DD (ISO format)
          # On unfixed code, localized_date produces DD.MM.YYYY
          expect(rendered).to match(/^\d{4}-\d{2}-\d{2}$/),
            "startDate '#{iso_date}' rendered as '#{rendered}', expected YYYY-MM-DD format"
        }
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 4 — Updated Timestamp Format (Property-Based with Rantly)
  # ─────────────────────────────────────────────────────────────────────
  context 'Bug 1.3: Updated timestamp format' do
    it 'renders updatedAt in "dd. MMMM YYYY um HH:MM" format' do
      Dir.mktmpdir do |tmpdir|
        site = build_jekyll_site(tmpdir)

        property_of {
          Rantly {
            year = range(2020, 2030)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            hour = range(0, 23)
            minute = range(0, 59)
            datetime_str = format('%04d-%02d-%02dT%02d:%02d:00Z', year, month, day, hour, minute)
            datetime_str
          }
        }.check(50) { |iso_datetime|
          # Render the updatedAt through the localized_datetime filter as used
          # in the fixed notice-detail-content.html: {{ notice.updatedAt | localized_datetime: 'notice_updated' }}
          template_str = "{{ notice.updatedAt | localized_datetime: 'notice_updated' }}"
          notice_data = { 'updatedAt' => iso_datetime }
          context = make_liquid_context(site, { 'notice' => notice_data })
          rendered = render_liquid(template_str, context).strip

          # Expected: "dd. MMMM YYYY um HH:MM" (e.g., "10. Mai 2025 um 14:30")
          # On unfixed code, localized_date produces "DD.MM.YYYY" without time
          expect(rendered).to match(/^\d{2}\. \w+ \d{4} um \d{2}:\d{2}$/),
            "updatedAt '#{iso_datetime}' rendered as '#{rendered}', " \
            "expected format like '10. Mai 2025 um 14:30'"
        }
      end
    end
  end
end
