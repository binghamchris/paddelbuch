# frozen_string_literal: true

require 'spec_helper'

# Property-based tests for Jekyll::WaterwayFilters
# **Validates: Requirements 2.8**
#
# Tests all 5 public filter methods using Rantly-generated waterway data
# with mixed types, locales, and showInMenu values.

class WaterwayFilterHelper
  include Jekyll::WaterwayFilters
end

RSpec.describe Jekyll::WaterwayFilters do
  let(:helper) { WaterwayFilterHelper.new }

  def build_waterways(count)
    locales = %w[de en fr]
    types = %w[see fluss kanal]
    count.times.map do
      {
        'name' => ('a'..'z').to_a.sample(rand(3..10)).join.capitalize,
        'locale' => locales.sample,
        'paddlingEnvironmentType_slug' => types.sample,
        'showInMenu' => [true, false].sample,
        'area' => rand(1..10_000),
        'length' => rand(1..5000)
      }
    end
  end

  def sorted_alphabetically?(arr)
    names = arr.map { |w| w['name'].to_s.downcase }
    names == names.sort
  end

  # ── top_lakes_by_area ──────────────────────────────────────────────
  describe '#top_lakes_by_area' do
    it 'returns only matching lakes, limited and sorted alphabetically' do
      property_of {
        count = range(5, 30)
        locale = choose('de', 'en', 'fr')
        limit = range(1, 10)
        [count, locale, limit]
      }.check(40) { |count, locale, limit|
        waterways = build_waterways(count)
        result = helper.top_lakes_by_area(waterways, locale, limit)

        result.each do |w|
          expect(w['paddlingEnvironmentType_slug']).to eq('see')
          expect(w['locale']).to eq(locale)
          expect(w['showInMenu']).to eq(true)
        end

        expect(result.size).to be <= limit
        expect(sorted_alphabetically?(result)).to be(true),
          "Expected alphabetical sort, got: #{result.map { |w| w['name'] }}"
      }
    end

    it 'returns [] for nil input' do
      expect(helper.top_lakes_by_area(nil, 'de', 5)).to eq([])
    end

    it 'returns [] for empty array' do
      expect(helper.top_lakes_by_area([], 'de', 5)).to eq([])
    end

    it 'returns [] when no waterways match' do
      waterways = [
        { 'name' => 'River A', 'locale' => 'de', 'paddlingEnvironmentType_slug' => 'fluss',
          'showInMenu' => true, 'area' => 100 }
      ]
      expect(helper.top_lakes_by_area(waterways, 'de', 5)).to eq([])
    end
  end

  # ── top_rivers_by_length ───────────────────────────────────────────
  describe '#top_rivers_by_length' do
    it 'returns only matching rivers, limited and sorted alphabetically' do
      property_of {
        count = range(5, 30)
        locale = choose('de', 'en', 'fr')
        limit = range(1, 10)
        [count, locale, limit]
      }.check(40) { |count, locale, limit|
        waterways = build_waterways(count)
        result = helper.top_rivers_by_length(waterways, locale, limit)

        result.each do |w|
          expect(w['paddlingEnvironmentType_slug']).to eq('fluss')
          expect(w['locale']).to eq(locale)
          expect(w['showInMenu']).to eq(true)
        end

        expect(result.size).to be <= limit
        expect(sorted_alphabetically?(result)).to be(true),
          "Expected alphabetical sort, got: #{result.map { |w| w['name'] }}"

        # Verify result comes from top-N longest rivers
        all_matching = waterways
          .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' && w['showInMenu'] == true }
          .sort_by { |w| -(w['length'] || 0) }
          .first(limit)
        expect(result.map { |w| w['name'] }.sort).to eq(all_matching.map { |w| w['name'] }.sort)
      }
    end

    it 'returns [] for nil input' do
      expect(helper.top_rivers_by_length(nil, 'de', 5)).to eq([])
    end

    it 'returns [] for empty array' do
      expect(helper.top_rivers_by_length([], 'de', 5)).to eq([])
    end
  end

  # ── sort_waterways_alphabetically ──────────────────────────────────
  describe '#sort_waterways_alphabetically' do
    it 'sorts any waterway array case-insensitively by name' do
      property_of {
        range(2, 20)
      }.check(40) { |count|
        waterways = build_waterways(count)
        result = helper.sort_waterways_alphabetically(waterways)

        expect(result.size).to eq(waterways.size)
        expect(sorted_alphabetically?(result)).to be(true),
          "Expected alphabetical sort, got: #{result.map { |w| w['name'] }}"
      }
    end

    it 'returns [] for nil input' do
      expect(helper.sort_waterways_alphabetically(nil)).to eq([])
    end

    it 'returns [] for empty array' do
      expect(helper.sort_waterways_alphabetically([])).to eq([])
    end
  end

  # ── lakes_alphabetically ───────────────────────────────────────────
  describe '#lakes_alphabetically' do
    it 'filters for locale + see type and sorts alphabetically' do
      property_of {
        count = range(5, 25)
        locale = choose('de', 'en', 'fr')
        [count, locale]
      }.check(40) { |count, locale|
        waterways = build_waterways(count)
        result = helper.lakes_alphabetically(waterways, locale)

        result.each do |w|
          expect(w['locale']).to eq(locale)
          expect(w['paddlingEnvironmentType_slug']).to eq('see')
        end

        expect(sorted_alphabetically?(result)).to be(true),
          "Expected alphabetical sort, got: #{result.map { |w| w['name'] }}"

        expected_count = waterways.count { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'see' }
        expect(result.size).to eq(expected_count)
      }
    end

    it 'returns [] for nil input' do
      expect(helper.lakes_alphabetically(nil, 'de')).to eq([])
    end

    it 'returns [] for empty array' do
      expect(helper.lakes_alphabetically([], 'de')).to eq([])
    end
  end

  # ── rivers_alphabetically ──────────────────────────────────────────
  describe '#rivers_alphabetically' do
    it 'filters for locale + fluss type and sorts alphabetically' do
      property_of {
        count = range(5, 25)
        locale = choose('de', 'en', 'fr')
        [count, locale]
      }.check(40) { |count, locale|
        waterways = build_waterways(count)
        result = helper.rivers_alphabetically(waterways, locale)

        result.each do |w|
          expect(w['locale']).to eq(locale)
          expect(w['paddlingEnvironmentType_slug']).to eq('fluss')
        end

        expect(sorted_alphabetically?(result)).to be(true),
          "Expected alphabetical sort, got: #{result.map { |w| w['name'] }}"

        expected_count = waterways.count { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' }
        expect(result.size).to eq(expected_count)
      }
    end

    it 'returns [] for nil input' do
      expect(helper.rivers_alphabetically(nil, 'de')).to eq([])
    end

    it 'returns [] for empty array' do
      expect(helper.rivers_alphabetically([], 'de')).to eq([])
    end
  end
end
