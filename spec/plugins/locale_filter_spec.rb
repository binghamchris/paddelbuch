# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'liquid'
require 'date'
require 'time'

# Comprehensive tests for Jekyll::LocaleFilter
#
# Covers all 5 public methods:
#   - filter_by_locale
#   - localized_data
#   - localized_date      (Property 19: Date Locale Formatting)
#   - localized_datetime   (Property 19: Date Locale Formatting)
#   - matches_locale

class LocaleFilterHelper
  include Jekyll::LocaleFilter
  attr_accessor :context
end

RSpec.describe Jekyll::LocaleFilter do
  let(:helper) { LocaleFilterHelper.new }

  GERMAN_MONTHS_ABBR = {
    'Jan' => 'Jan', 'Feb' => 'Feb', 'Mar' => 'Mär',
    'Apr' => 'Apr', 'May' => 'Mai', 'Jun' => 'Jun',
    'Jul' => 'Jul', 'Aug' => 'Aug', 'Sep' => 'Sep',
    'Oct' => 'Okt', 'Nov' => 'Nov', 'Dec' => 'Dez'
  }.freeze

  # ── Helpers ────────────────────────────────────────────────────────

  def build_jekyll_site(tmpdir, lang: 'de')
    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'lang' => lang,
      'default_lang' => 'de',
      'languages' => %w[de en]
    )
    Jekyll::Site.new(config)
  end

  def make_liquid_context(site, assigns = {})
    registers = { site: site, page: assigns }
    Liquid::Context.new([assigns], {}, registers)
  end

  def with_site_context(lang: 'de')
    Dir.mktmpdir do |tmpdir|
      site = build_jekyll_site(tmpdir, lang: lang)
      helper.context = make_liquid_context(site)
      yield
    end
  end

  def germanize_abbr(str)
    result = str.dup
    GERMAN_MONTHS_ABBR.each { |en, de| result = result.gsub(en, de) }
    result
  end

  # ── #filter_by_locale ──────────────────────────────────────────────

  describe '#filter_by_locale' do
    it 'returns [] for nil input' do
      expect(helper.filter_by_locale(nil, 'de')).to eq([])
    end

    it 'returns [] for non-array input' do
      expect(helper.filter_by_locale('string', 'de')).to eq([])
      expect(helper.filter_by_locale({}, 'de')).to eq([])
    end

    it 'returns all items when locale is nil' do
      items = [{ 'locale' => 'de' }, { 'locale' => 'en' }]
      expect(helper.filter_by_locale(items, nil)).to eq(items)
    end

    it 'returns all items when locale is empty string' do
      items = [{ 'locale' => 'de' }, { 'locale' => 'en' }]
      expect(helper.filter_by_locale(items, '')).to eq(items)
    end

    it 'filters items matching the given locale' do
      items = [
        { 'name' => 'A', 'locale' => 'de' },
        { 'name' => 'B', 'locale' => 'en' },
        { 'name' => 'C', 'locale' => 'de' }
      ]
      result = helper.filter_by_locale(items, 'de')
      expect(result.map { |i| i['name'] }).to eq(%w[A C])
    end

    it 'includes items with wildcard locale' do
      items = [
        { 'name' => 'A', 'locale' => 'de' },
        { 'name' => 'B', 'locale' => '*' },
        { 'name' => 'C', 'locale' => 'en' }
      ]
      result = helper.filter_by_locale(items, 'de')
      expect(result.map { |i| i['name'] }).to eq(%w[A B])
    end

    it 'includes items with nil locale (locale-agnostic)' do
      items = [
        { 'name' => 'A', 'locale' => nil },
        { 'name' => 'B', 'locale' => 'en' }
      ]
      result = helper.filter_by_locale(items, 'de')
      expect(result.map { |i| i['name'] }).to eq(%w[A])
    end

    it 'works with symbol keys for locale' do
      items = [{ name: 'A', locale: 'de' }, { name: 'B', locale: 'en' }]
      result = helper.filter_by_locale(items, 'de')
      expect(result.size).to eq(1)
      expect(result.first[:name]).to eq('A')
    end

    it 'filters correctly for any locale and item mix (PBT)' do
      property_of {
        locale = choose('de', 'en', 'fr')
        count = range(3, 20)
        items = count.times.map do
          { 'locale' => choose('de', 'en', 'fr', '*', nil), 'name' => string(:alpha) }
        end
        [items, locale]
      }.check(50) { |items, locale|
        result = helper.filter_by_locale(items, locale)

        result.each do |item|
          item_locale = item['locale']
          expect(item_locale.nil? || item_locale == locale || item_locale == '*').to be(true),
            "Item with locale '#{item_locale}' should not appear for filter locale '#{locale}'"
        end

        # Every matching item from input must be in result
        expected = items.select { |i| l = i['locale']; l.nil? || l == locale || l == '*' }
        expect(result.size).to eq(expected.size)
      }
    end
  end

  # ── #localized_data ────────────────────────────────────────────────

  describe '#localized_data' do
    it 'returns nil for non-hash input' do
      expect(helper.localized_data(nil, 'spots', 'de')).to be_nil
      expect(helper.localized_data([], 'spots', 'de')).to be_nil
    end

    it 'returns locale-specific data when available' do
      data = { 'spots_de' => [1, 2], 'spots' => [3, 4] }
      expect(helper.localized_data(data, 'spots', 'de')).to eq([1, 2])
    end

    it 'falls back to base key when locale-specific key is missing' do
      data = { 'spots' => [3, 4] }
      expect(helper.localized_data(data, 'spots', 'fr')).to eq([3, 4])
    end

    it 'returns nil when neither locale-specific nor base key exists' do
      data = { 'other' => [1] }
      expect(helper.localized_data(data, 'spots', 'de')).to be_nil
    end

    it 'prefers locale-specific key over base key for any locale (PBT)' do
      property_of {
        locale = choose('de', 'en', 'fr')
        key = choose('spots', 'waterways', 'notices')
        [key, locale]
      }.check(30) { |key, locale|
        localized_val = "localized_#{locale}"
        base_val = 'base'
        data = { "#{key}_#{locale}" => localized_val, key => base_val }

        expect(helper.localized_data(data, key, locale)).to eq(localized_val)
      }
    end
  end

  # ── #matches_locale ────────────────────────────────────────────────

  describe '#matches_locale' do
    it 'returns true when locale is nil' do
      expect(helper.matches_locale({ 'locale' => 'de' }, nil)).to be(true)
    end

    it 'returns true when locale is empty' do
      expect(helper.matches_locale({ 'locale' => 'de' }, '')).to be(true)
    end

    it 'returns true when item locale matches' do
      expect(helper.matches_locale({ 'locale' => 'de' }, 'de')).to be(true)
    end

    it 'returns false when item locale does not match' do
      expect(helper.matches_locale({ 'locale' => 'en' }, 'de')).to be(false)
    end

    it 'returns true for wildcard locale' do
      expect(helper.matches_locale({ 'locale' => '*' }, 'de')).to be(true)
    end

    it 'returns true when item has no locale key' do
      expect(helper.matches_locale({}, 'de')).to be(true)
    end

    it 'works with symbol keys' do
      expect(helper.matches_locale({ locale: 'de' }, 'de')).to be(true)
      expect(helper.matches_locale({ locale: 'en' }, 'de')).to be(false)
    end

    it 'is consistent with filter_by_locale for any item (PBT)' do
      property_of {
        locale = choose('de', 'en', 'fr')
        item_locale = choose('de', 'en', 'fr', '*', nil)
        [{ 'locale' => item_locale, 'name' => 'test' }, locale]
      }.check(50) { |item, locale|
        matches = helper.matches_locale(item, locale)
        filtered = helper.filter_by_locale([item], locale)

        if matches
          expect(filtered.size).to eq(1),
            "matches_locale=true but filter_by_locale excluded item (locale=#{item['locale']}, filter=#{locale})"
        else
          expect(filtered.size).to eq(0),
            "matches_locale=false but filter_by_locale included item (locale=#{item['locale']}, filter=#{locale})"
        end
      }
    end
  end

  # ── #localized_date ────────────────────────────────────────────────

  describe '#localized_date' do
    it 'returns empty string for nil date' do
      with_site_context(lang: 'de') do
        expect(helper.localized_date(nil)).to eq('')
      end
    end

    it 'returns empty string for unparseable string' do
      with_site_context(lang: 'de') do
        expect(helper.localized_date('not-a-date')).to eq('')
      end
    end

    it 'formats a Date object for de locale' do
      with_site_context(lang: 'de') do
        result = helper.localized_date(Date.new(2026, 3, 8))
        expect(result).to eq('08 Mär 2026')
      end
    end

    it 'formats a Date object for en locale' do
      with_site_context(lang: 'en') do
        result = helper.localized_date(Date.new(2026, 3, 8))
        expect(result).to eq('08 Mar 2026')
      end
    end

    it 'formats a Time object' do
      with_site_context(lang: 'de') do
        result = helper.localized_date(Time.new(2026, 10, 15, 14, 30))
        expect(result).to eq('15 Okt 2026')
      end
    end

    it 'parses an ISO date string' do
      with_site_context(lang: 'en') do
        result = helper.localized_date('2025-12-25')
        expect(result).to eq('25 Dec 2025')
      end
    end

    it 'returns ISO format when format_type is iso' do
      with_site_context(lang: 'de') do
        result = helper.localized_date(Date.new(2026, 6, 1), 'iso')
        expect(result).to eq('2026-06-01')
      end
    end

    it 'falls back to de formats for unknown locale' do
      Dir.mktmpdir do |tmpdir|
        site = build_jekyll_site(tmpdir, lang: 'fr')
        helper.context = make_liquid_context(site)
        result = helper.localized_date(Date.new(2026, 3, 8))
        # Unknown locale falls back to 'de' format table, but month names
        # are NOT germanized (localize_month_names only triggers for 'de')
        expect(result).to eq('08 Mar 2026')
      end
    end

    it 'translates all 12 abbreviated month names for de locale' do
      with_site_context(lang: 'de') do
        (1..12).each do |month|
          date = Date.new(2026, month, 15)
          result = helper.localized_date(date)
          english_abbr = date.strftime('%b')
          german_abbr = GERMAN_MONTHS_ABBR[english_abbr]
          expect(result).to include(german_abbr),
            "Month #{month}: expected '#{german_abbr}' in '#{result}'"
        end
      end
    end

    it 'does not germanize month names for en locale' do
      with_site_context(lang: 'en') do
        result = helper.localized_date(Date.new(2026, 3, 8))
        expect(result).to eq('08 Mar 2026')
        expect(result).not_to include('Mär')
      end
    end

    it 'produces correct format for any random date and locale (PBT)' do
      property_of {
        lang = choose('de', 'en')
        year = range(2000, 2035)
        month = range(1, 12)
        max_day = Date.new(year, month, -1).day
        day = range(1, max_day)
        [lang, year, month, day]
      }.check(50) { |lang, year, month, day|
        with_site_context(lang: lang) do
          date = Date.new(year, month, day)
          result = helper.localized_date(date)

          expected = date.strftime('%d %b %Y')
          expected = germanize_abbr(expected) if lang == 'de'

          expect(result).to eq(expected),
            "#{lang} locale: Date #{date} rendered '#{result}', expected '#{expected}'"
        end
      }
    end
  end

  # ── #localized_datetime ────────────────────────────────────────────

  describe '#localized_datetime' do
    it 'returns empty string for nil date' do
      with_site_context(lang: 'de') do
        expect(helper.localized_datetime(nil)).to eq('')
      end
    end

    it 'returns empty string for unparseable string' do
      with_site_context(lang: 'de') do
        expect(helper.localized_datetime('not-a-date')).to eq('')
      end
    end

    it 'formats default for de locale' do
      with_site_context(lang: 'de') do
        result = helper.localized_datetime(Time.new(2026, 3, 8, 14, 30))
        expect(result).to eq('08 Mär 2026 14:30')
      end
    end

    it 'formats default for en locale' do
      with_site_context(lang: 'en') do
        result = helper.localized_datetime(Time.new(2026, 3, 8, 14, 30))
        expect(result).to eq('08 Mar 2026 14:30')
      end
    end

    it "formats 'long' with 'um' for de locale" do
      with_site_context(lang: 'de') do
        result = helper.localized_datetime(Time.new(2026, 10, 15, 9, 5), 'long')
        expect(result).to eq('15 Okt 2026 um 09:05')
      end
    end

    it "formats 'long' with 'at' for en locale" do
      with_site_context(lang: 'en') do
        result = helper.localized_datetime(Time.new(2026, 10, 15, 9, 5), 'long')
        expect(result).to eq('15 Oct 2026 at 09:05')
      end
    end

    it "formats 'notice_updated' for de locale" do
      with_site_context(lang: 'de') do
        result = helper.localized_datetime(Time.new(2026, 6, 1, 18, 0), 'notice_updated')
        expect(result).to eq('01 Jun 2026 um 18:00')
      end
    end

    it "formats 'notice_updated' for en locale" do
      with_site_context(lang: 'en') do
        result = helper.localized_datetime(Time.new(2026, 6, 1, 18, 0), 'notice_updated')
        expect(result).to eq('01 Jun 2026 at 18:00')
      end
    end

    it 'returns ISO 8601 format when format_type is iso' do
      with_site_context(lang: 'de') do
        result = helper.localized_datetime(Time.new(2026, 3, 8, 14, 30, 45), 'iso')
        expect(result).to eq('2026-03-08T14:30:45')
      end
    end

    it 'parses an ISO datetime string' do
      with_site_context(lang: 'en') do
        result = helper.localized_datetime('2025-12-25T10:00:00Z')
        parsed = Time.parse('2025-12-25T10:00:00Z')
        expected = parsed.strftime('%d %b %Y %H:%M')
        expect(result).to eq(expected)
      end
    end

    it 'converts a Date to Time (midnight)' do
      with_site_context(lang: 'en') do
        result = helper.localized_datetime(Date.new(2026, 7, 4))
        expect(result).to eq('04 Jul 2026 00:00')
      end
    end

    it 'produces correct default format for any random datetime and locale (PBT)' do
      property_of {
        lang = choose('de', 'en')
        year = range(2000, 2035)
        month = range(1, 12)
        max_day = Date.new(year, month, -1).day
        day = range(1, max_day)
        hour = range(0, 23)
        minute = range(0, 59)
        [lang, year, month, day, hour, minute]
      }.check(50) { |lang, year, month, day, hour, minute|
        with_site_context(lang: lang) do
          time = Time.new(year, month, day, hour, minute)
          result = helper.localized_datetime(time)

          expected = time.strftime('%d %b %Y %H:%M')
          expected = germanize_abbr(expected) if lang == 'de'

          expect(result).to eq(expected),
            "#{lang} locale: Time #{time} rendered '#{result}', expected '#{expected}'"
        end
      }
    end
  end
end
