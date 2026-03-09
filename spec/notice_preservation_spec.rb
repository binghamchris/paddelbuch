# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'liquid'
require 'date'
require 'time'

# Preservation Property Tests for Notice Page Fixes
#
# These tests capture the CURRENT (unfixed) behavior that must be preserved
# after the bugfix is applied. They should PASS on both unfixed and fixed code.
#
# Property 2: Preservation — Non-Notice Page and Filter Behavior
# **Validates: Requirements 3.1, 3.4, 3.5, 3.7, 3.9, 3.10, 3.11**
#
# For any non-notice page or filter usage, the output SHALL remain identical
# before and after the fix.

RSpec.describe 'Notice Page Preservation' do
  # Helper: build a minimal Jekyll site with the given locale
  def build_jekyll_site(tmpdir, lang: 'de')
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

    en_translations = {
      'labels' => {
        'summary' => 'Summary',
        'last_updated' => 'Last updated',
        'waterway' => 'Waterway'
      },
      'event_notices' => {
        'title' => 'Event Notices',
        'approx_start_date' => 'Approximate start date',
        'approx_end_date' => 'Approximate end date'
      }
    }

    File.write(File.join(i18n_dir, 'de.yml'), YAML.dump(de_translations))
    File.write(File.join(i18n_dir, 'en.yml'), YAML.dump(en_translations))

    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'lang' => lang,
      'default_lang' => 'de',
      'languages' => ['de', 'en'],
      'collections' => { 'notices' => { 'output' => true } }
    )
    site = Jekyll::Site.new(config)

    translations = { 'de' => de_translations, 'en' => en_translations }
    site.data['translations'] = translations

    site
  end

  # Helper: create a Liquid context with site and data
  def make_liquid_context(site, assigns = {})
    registers = { site: site, page: assigns }
    Liquid::Context.new([assigns], {}, registers)
  end

  # Helper: render a Liquid template string
  def render_liquid(template_str, context)
    Liquid::Template.parse(template_str).render(context)
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 1 — localized_date filter preservation (default format)
  # **Validates: Requirements 3.9**
  # ─────────────────────────────────────────────────────────────────────
  describe 'localized_date default format preservation' do
    it 'produces DD.MM.YYYY for de locale and DD/MM/YYYY for en locale for all dates' do
      Dir.mktmpdir do |tmpdir|
        site_de = build_jekyll_site(tmpdir, lang: 'de')
        site_en = build_jekyll_site(tmpdir, lang: 'en')

        property_of {
          Rantly {
            year = range(2000, 2035)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            format('%04d-%02d-%02d', year, month, day)
          }
        }.check(50) { |iso_date|
          # German locale: DD.MM.YYYY
          ctx_de = make_liquid_context(site_de, { 'date_val' => iso_date })
          rendered_de = render_liquid('{{ date_val | localized_date }}', ctx_de).strip

          parsed = Date.parse(iso_date)
          expected_de = parsed.strftime('%d.%m.%Y')
          expect(rendered_de).to eq(expected_de),
            "DE locale: '#{iso_date}' rendered as '#{rendered_de}', expected '#{expected_de}'"

          # English locale: DD/MM/YYYY
          ctx_en = make_liquid_context(site_en, { 'date_val' => iso_date })
          rendered_en = render_liquid('{{ date_val | localized_date }}', ctx_en).strip

          expected_en = parsed.strftime('%d/%m/%Y')
          expect(rendered_en).to eq(expected_en),
            "EN locale: '#{iso_date}' rendered as '#{rendered_en}', expected '#{expected_en}'"
        }
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 2 — localized_date 'long' format preservation
  # **Validates: Requirements 3.9**
  # ─────────────────────────────────────────────────────────────────────
  describe "localized_date 'long' format preservation" do
    it "produces 'DD. Month YYYY' for de locale for all dates" do
      Dir.mktmpdir do |tmpdir|
        site_de = build_jekyll_site(tmpdir, lang: 'de')

        property_of {
          Rantly {
            year = range(2000, 2035)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            format('%04d-%02d-%02d', year, month, day)
          }
        }.check(50) { |iso_date|
          ctx = make_liquid_context(site_de, { 'date_val' => iso_date })
          rendered = render_liquid("{{ date_val | localized_date: 'long' }}", ctx).strip

          # The localized_date filter uses Ruby strftime('%d. %B %Y') and then
          # localizes month names to German (e.g., "Juli" not "July")
          parsed = Date.parse(iso_date)
          expected = parsed.strftime('%d. %B %Y')
          # Apply German month name localization (same as the filter does)
          german_months = {
            'January' => 'Januar', 'February' => 'Februar', 'March' => 'März',
            'April' => 'April', 'May' => 'Mai', 'June' => 'Juni',
            'July' => 'Juli', 'August' => 'August', 'September' => 'September',
            'October' => 'Oktober', 'November' => 'November', 'December' => 'Dezember'
          }
          german_months.each { |en, de| expected = expected.gsub(en, de) }

          expect(rendered).to eq(expected),
            "DE 'long': '#{iso_date}' rendered as '#{rendered}', expected '#{expected}'"
        }
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 3 — localized_datetime default format preservation
  # **Validates: Requirements 3.9**
  # ─────────────────────────────────────────────────────────────────────
  describe 'localized_datetime default format preservation' do
    it "produces 'DD.MM.YYYY HH:MM' for de locale for all datetimes" do
      Dir.mktmpdir do |tmpdir|
        site_de = build_jekyll_site(tmpdir, lang: 'de')

        property_of {
          Rantly {
            year = range(2000, 2035)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            hour = range(0, 23)
            minute = range(0, 59)
            format('%04d-%02d-%02dT%02d:%02d:00Z', year, month, day, hour, minute)
          }
        }.check(50) { |iso_datetime|
          ctx = make_liquid_context(site_de, { 'dt_val' => iso_datetime })
          rendered = render_liquid('{{ dt_val | localized_datetime }}', ctx).strip

          parsed = Time.parse(iso_datetime)
          expected = parsed.strftime('%d.%m.%Y %H:%M')

          expect(rendered).to eq(expected),
            "DE datetime default: '#{iso_datetime}' rendered as '#{rendered}', expected '#{expected}'"
        }
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 4 — localized_datetime 'long' format preservation
  # **Validates: Requirements 3.9**
  # ─────────────────────────────────────────────────────────────────────
  describe "localized_datetime 'long' format preservation" do
    it "produces 'DD. Month YYYY, HH:MM Uhr' for de locale for all datetimes" do
      Dir.mktmpdir do |tmpdir|
        site_de = build_jekyll_site(tmpdir, lang: 'de')

        property_of {
          Rantly {
            year = range(2000, 2035)
            month = range(1, 12)
            max_day = Date.new(year, month, -1).day
            day = range(1, max_day)
            hour = range(0, 23)
            minute = range(0, 59)
            format('%04d-%02d-%02dT%02d:%02d:00Z', year, month, day, hour, minute)
          }
        }.check(50) { |iso_datetime|
          ctx = make_liquid_context(site_de, { 'dt_val' => iso_datetime })
          rendered = render_liquid("{{ dt_val | localized_datetime: 'long' }}", ctx).strip

          # The localized_datetime filter uses Ruby strftime('%-d. %B %Y um %H:%M')
          # and then localizes month names to German (e.g., "Juli" not "July")
          parsed = Time.parse(iso_datetime)
          expected = parsed.strftime('%-d. %B %Y um %H:%M')
          # Apply German month name localization (same as the filter does)
          german_months = {
            'January' => 'Januar', 'February' => 'Februar', 'March' => 'März',
            'April' => 'April', 'May' => 'Mai', 'June' => 'Juni',
            'July' => 'Juli', 'August' => 'August', 'September' => 'September',
            'October' => 'Oktober', 'November' => 'November', 'December' => 'Dezember'
          }
          german_months.each { |en, de| expected = expected.gsub(en, de) }

          expect(rendered).to eq(expected),
            "DE datetime 'long': '#{iso_datetime}' rendered as '#{rendered}', expected '#{expected}'"
        }
      end
    end
  end

  # ─────────────────────────────────────────────────────────────────────
  # Test 5 — Notice map and details panel preservation
  # **Validates: Requirements 3.10, 3.11**
  # ─────────────────────────────────────────────────────────────────────
  describe 'Notice map and details panel preservation' do
    let(:layout_path) { File.join(File.dirname(__FILE__), '..', '_layouts', 'notice.html') }
    let(:layout_content) { File.read(layout_path) }
    let(:include_path) { File.join(File.dirname(__FILE__), '..', '_includes', 'notice-detail-content.html') }
    let(:include_content) { File.read(include_path) }

    it 'notice layout includes notice-detail-content.html' do
      expect(layout_content).to include('{% include notice-detail-content.html'),
        'notice.html layout must include notice-detail-content.html'
    end

    it 'notice layout contains #notice-map div' do
      expect(layout_content).to include('id="notice-map"'),
        'notice.html layout must contain #notice-map div for the Leaflet map'
    end

    it 'notice layout contains notice title h1' do
      expect(layout_content).to match(/<h1[^>]*>.*notice\.name.*<\/h1>/m),
        'notice.html layout must contain an h1 with the notice title'
    end

    it 'notice layout contains notice title wrapper div' do
      expect(layout_content).to match(/notice-title/),
        'notice.html layout must contain the notice-title wrapper div'
    end

    it 'notice detail content includes description section' do
      expect(include_content).to include('notice.description'),
        'notice-detail-content.html must include description section'
    end

    it 'notice layout includes detail-map-layers.html' do
      expect(layout_content).to include('{% include detail-map-layers.html'),
        'notice.html layout must include detail-map-layers.html for data layers'
    end
  end
end
