# frozen_string_literal: true

# Property-based tests for CollectionGenerator pre-computation methods
# Tests verify that Ruby pre-computation produces the same results as
# what the Liquid templates would produce via | where filter scans.

require 'spec_helper'
require 'tmpdir'
require 'date'

# Extend Rantly with helpers for generating random slugs and names
class Rantly
  def gen_slug
    sized(range(3, 10)) { string(:alpha) }.downcase
  end

  def gen_name
    sized(range(3, 12)) { string(:alpha) }
  end
end

RSpec.describe 'CollectionGenerator pre-computation properties' do
  # Known spot type slugs from SPOT_ICON_MAP
  KNOWN_SPOT_TYPE_SLUGS = %w[
    einstieg-ausstieg nur-einstieg nur-ausstieg rasthalte notauswasserungsstelle
  ].freeze

  # Helper: create a minimal Jekyll site with the given collection
  def build_site_with_collection(tmpdir, collection_name)
    i18n_dir = File.join(tmpdir, '_i18n')
    FileUtils.mkdir_p(i18n_dir)
    File.write(File.join(i18n_dir, 'de.yml'), YAML.dump({
      'spot_types' => { 'no_entry' => 'Kein Zutritt Ort' }
    }))
    File.write(File.join(i18n_dir, 'en.yml'), YAML.dump({
      'spot_types' => { 'no_entry' => 'No Entry Spot' }
    }))

    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'collections' => { collection_name => { 'output' => true } }
    )
    site = Jekyll::Site.new(config)
    collection = site.collections[collection_name]
    FileUtils.mkdir_p(File.join(site.source, collection.relative_directory))
    [site, collection]
  end

  # ============================================================================
  # Property 1: Spot type name resolution equivalence
  # **Validates: Requirements 1.1, 1.4, 1.6**
  # ============================================================================
  describe 'Property 1: Spot type name resolution equivalence' do
    it 'pre-computed spot_type_name matches simulated Liquid lookup for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          name_key = locale == 'en' ? 'name_en' : 'name_de'
          is_rejected = choose(true, false)

          num_types = range(2, 5)
          spot_types = Array.new(num_types) do
            {
              'locale' => locale,
              'slug' => gen_slug,
              'name_de' => gen_name,
              'name_en' => gen_name
            }
          end

          use_known = choose(true, false)
          spot_type_slug = if use_known && spot_types.any?
                            spot_types.sample['slug']
                          else
                            gen_slug
                          end

          {
            locale: locale,
            name_key: name_key,
            is_rejected: is_rejected,
            spot_types: spot_types,
            spot_type_slug: spot_type_slug
          }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'spots')

          site.data['types'] = { 'spot_types' => data[:spot_types] }
          site.data['waterways'] = []

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          type_lookup = generator.send(:build_type_lookup, site.data, data[:locale])
          generator.instance_variable_set(:@type_lookup, type_lookup)
          generator.instance_variable_set(:@waterway_lookup, {})
          generator.instance_variable_set(:@craft_type_lookup, {})
          generator.instance_variable_set(:@spot_tip_type_lookup, {})

          entry = {
            'slug' => 'test-spot',
            'name' => 'Test Spot',
            'locale' => data[:locale],
            'spotType_slug' => data[:spot_type_slug],
            'rejected' => data[:is_rejected],
            'paddleCraftTypes' => []
          }

          doc = generator.send(:create_document, site, collection, entry, 'test-spot', 'spot-details', data[:locale])

          if data[:is_rejected]
            expected = data[:locale] == 'en' ? 'No Entry Spot' : 'Kein Zutritt Ort'
          else
            matching = data[:spot_types].find { |t| t['slug'] == data[:spot_type_slug] && t['locale'] == data[:locale] }
            expected = if matching
                         matching[data[:name_key]] || matching['name_de'] || data[:spot_type_slug]
                       else
                         data[:spot_type_slug]
                       end
          end

          expect(doc.data['spot_type_name']).to eq(expected),
            "locale=#{data[:locale]}, rejected=#{data[:is_rejected]}, slug=#{data[:spot_type_slug]}: " \
            "expected #{expected.inspect}, got #{doc.data['spot_type_name'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 2: Paddle craft type names resolution equivalence
  # **Validates: Requirements 1.2, 1.6**
  # ============================================================================
  describe 'Property 2: Paddle craft type names resolution equivalence' do
    it 'pre-computed paddle_craft_type_names matches simulated Liquid lookup for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          name_key = locale == 'en' ? 'name_en' : 'name_de'

          num_types = range(2, 5)
          craft_types = Array.new(num_types) do
            { 'locale' => locale, 'slug' => gen_slug, 'name_de' => gen_name, 'name_en' => gen_name }
          end

          num_craft_slugs = range(0, 4)
          craft_slugs = Array.new(num_craft_slugs) do
            if choose(true, false) && craft_types.any?
              craft_types.sample['slug']
            else
              gen_slug
            end
          end

          { locale: locale, name_key: name_key, craft_types: craft_types, craft_slugs: craft_slugs }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'spots')

          site.data['types'] = { 'spot_types' => [], 'paddle_craft_types' => data[:craft_types] }
          site.data['waterways'] = []

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          type_lookup = generator.send(:build_type_lookup, site.data, data[:locale])
          craft_type_lookup = generator.send(:build_craft_type_lookup, site.data, data[:locale])
          generator.instance_variable_set(:@type_lookup, type_lookup)
          generator.instance_variable_set(:@waterway_lookup, {})
          generator.instance_variable_set(:@craft_type_lookup, craft_type_lookup)
          generator.instance_variable_set(:@spot_tip_type_lookup, {})

          entry = {
            'slug' => 'test-spot', 'name' => 'Test Spot', 'locale' => data[:locale],
            'spotType_slug' => 'einstieg-ausstieg', 'rejected' => false,
            'paddleCraftTypes' => data[:craft_slugs]
          }

          doc = generator.send(:create_document, site, collection, entry, 'test-spot', 'spot-details', data[:locale])

          expected_names = data[:craft_slugs].map do |cs|
            matching = data[:craft_types].find { |t| t['slug'] == cs && t['locale'] == data[:locale] }
            matching ? (matching[data[:name_key]] || matching['name_de'] || cs) : cs
          end

          expect(doc.data['paddle_craft_type_names']).to eq(expected_names),
            "locale=#{data[:locale]}, slugs=#{data[:craft_slugs]}: " \
            "expected #{expected_names.inspect}, got #{doc.data['paddle_craft_type_names'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 3: Obstacle type name resolution equivalence
  # **Validates: Requirements 1.3, 1.7**
  # ============================================================================
  describe 'Property 3: Obstacle type name resolution equivalence' do
    it 'pre-computed obstacle_type_name matches simulated Liquid lookup for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          name_key = locale == 'en' ? 'name_en' : 'name_de'

          num_types = range(2, 5)
          obstacle_types = Array.new(num_types) do
            { 'locale' => locale, 'slug' => gen_slug, 'name_de' => gen_name, 'name_en' => gen_name }
          end

          use_known = choose(true, false)
          obstacle_type_slug = if use_known && obstacle_types.any?
                                 obstacle_types.sample['slug']
                               else
                                 gen_slug
                               end

          { locale: locale, name_key: name_key, obstacle_types: obstacle_types, obstacle_type_slug: obstacle_type_slug }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'obstacles')

          site.data['types'] = { 'obstacle_types' => data[:obstacle_types] }
          site.data['waterways'] = []
          site.data['spots'] = []

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          type_lookup = generator.send(:build_type_lookup, site.data, data[:locale])
          generator.instance_variable_set(:@type_lookup, type_lookup)
          generator.instance_variable_set(:@waterway_lookup, {})
          generator.instance_variable_set(:@craft_type_lookup, {})
          generator.instance_variable_set(:@locale_spots_by_slug, {})
          generator.instance_variable_set(:@locale_spots_list, [])

          entry = {
            'slug' => 'test-obstacle', 'name' => 'Test Obstacle', 'locale' => data[:locale],
            'obstacleType_slug' => data[:obstacle_type_slug]
          }

          doc = generator.send(:create_document, site, collection, entry, 'test-obstacle', 'obstacle-details', data[:locale])

          matching = data[:obstacle_types].find { |t| t['slug'] == data[:obstacle_type_slug] && t['locale'] == data[:locale] }
          expected = matching ? (matching[data[:name_key]] || matching['name_de'] || data[:obstacle_type_slug]) : data[:obstacle_type_slug]

          expect(doc.data['obstacle_type_name']).to eq(expected),
            "locale=#{data[:locale]}, slug=#{data[:obstacle_type_slug]}: " \
            "expected #{expected.inspect}, got #{doc.data['obstacle_type_name'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 4: Spot icon resolution equivalence
  # **Validates: Requirements 1.5, 1.6**
  # ============================================================================
  describe 'Property 4: Spot icon resolution equivalence' do
    # Exhaustive test: all known type slugs × rejected × locale
    it 'resolves correct icon for all known spot type slug × rejected × locale combinations' do
      generator = Jekyll::CollectionGenerator.new

      expected_icons = {
        'einstieg-ausstieg' => { name: 'entryexit', alt_de: 'Ein-/Ausstiegsorte Symbol', alt_en: 'Entry and exit spot icon' },
        'nur-einstieg'      => { name: 'entry',     alt_de: 'Einstiegsorte Symbol',       alt_en: 'Entry spot icon' },
        'nur-ausstieg'      => { name: 'exit',      alt_de: 'Ausstiegsorte Symbol',       alt_en: 'Exit spot icon' },
        'rasthalte'         => { name: 'rest',       alt_de: 'Rasthalte Symbol',           alt_en: 'Rest spot icon' },
        'notauswasserungsstelle' => { name: 'emergency', alt_de: 'Notauswasserungsstelle Symbol', alt_en: 'Emergency exit spot icon' }
      }

      KNOWN_SPOT_TYPE_SLUGS.each do |slug|
        [true, false].each do |is_rejected|
          %w[de en].each do |locale|
            result = generator.send(:resolve_spot_icon, slug, is_rejected, locale)

            if is_rejected
              expect(result[:name]).to eq('noentry'),
                "slug=#{slug}, rejected=true, locale=#{locale}: expected name='noentry', got '#{result[:name]}'"
              expected_alt = locale == 'en' ? 'No entry spot icon' : 'Kein Zutritt Symbol'
              expect(result[:alt]).to eq(expected_alt),
                "slug=#{slug}, rejected=true, locale=#{locale}: expected alt=#{expected_alt.inspect}, got #{result[:alt].inspect}"
            else
              expected_entry = expected_icons[slug]
              expect(result[:name]).to eq(expected_entry[:name]),
                "slug=#{slug}, rejected=false, locale=#{locale}: expected name=#{expected_entry[:name].inspect}, got #{result[:name].inspect}"
              expected_alt = locale == 'en' ? expected_entry[:alt_en] : expected_entry[:alt_de]
              expect(result[:alt]).to eq(expected_alt),
                "slug=#{slug}, rejected=false, locale=#{locale}: expected alt=#{expected_alt.inspect}, got #{result[:alt].inspect}"
            end
          end
        end
      end
    end

    # Random test: unknown slugs should fall back to einstieg-ausstieg icon
    it 'falls back to einstieg-ausstieg icon for unknown slugs (random)' do
      generator = Jekyll::CollectionGenerator.new

      property_of {
        Rantly {
          locale = choose('de', 'en')
          slug = "unknown-#{gen_slug}"
          is_rejected = choose(true, false)

          { locale: locale, slug: slug, is_rejected: is_rejected }
        }
      }.check(100) { |data|
        result = generator.send(:resolve_spot_icon, data[:slug], data[:is_rejected], data[:locale])

        if data[:is_rejected]
          expect(result[:name]).to eq('noentry')
          expected_alt = data[:locale] == 'en' ? 'No entry spot icon' : 'Kein Zutritt Symbol'
          expect(result[:alt]).to eq(expected_alt)
        else
          # Unknown slugs fall back to einstieg-ausstieg
          expect(result[:name]).to eq('entryexit'),
            "Unknown slug=#{data[:slug]}, locale=#{data[:locale]}: expected fallback name='entryexit', got '#{result[:name]}'"
          expected_alt = data[:locale] == 'en' ? 'Entry and exit spot icon' : 'Ein-/Ausstiegsorte Symbol'
          expect(result[:alt]).to eq(expected_alt),
            "Unknown slug=#{data[:slug]}, locale=#{data[:locale]}: expected fallback alt=#{expected_alt.inspect}, got #{result[:alt].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 9: Waterway event notice filtering equivalence
  # **Validates: Requirements 5.1, 5.2**
  # ============================================================================
  describe 'Property 9: Waterway event notice filtering equivalence' do
    it 'pre-computed active_notices matches simulated Liquid filtering for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          waterway_slug = gen_slug

          num_notices = range(2, 6)
          notices = Array.new(num_notices) do
            year = choose(2024, 2025, 2026)
            month = range(1, 12)
            day = range(1, 28)
            end_date = format('%04d-%02d-%02d', year, month, day)

            includes_waterway = choose(true, false)
            other_slug = gen_slug
            waterways_arr = includes_waterway ? [waterway_slug, other_slug] : [other_slug]

            notice_locale = choose(locale, choose('de', 'en'))

            {
              'slug' => gen_slug, 'name' => gen_name, 'locale' => notice_locale,
              'endDate' => end_date, 'waterways' => waterways_arr
            }
          end

          { locale: locale, waterway_slug: waterway_slug, notices: notices }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'waterways')

          site.data['notices'] = data[:notices]
          site.data['types'] = {}
          site.data['waterways'] = [
            { 'slug' => data[:waterway_slug], 'name' => 'Test Waterway', 'locale' => data[:locale] }
          ]

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)
          generator.instance_variable_set(:@type_lookup, {})
          generator.instance_variable_set(:@waterway_lookup,
            generator.send(:build_waterway_lookup, site.data['waterways'], data[:locale]))
          generator.instance_variable_set(:@craft_type_lookup, {})

          entry = { 'slug' => data[:waterway_slug], 'name' => 'Test Waterway', 'locale' => data[:locale] }

          doc = generator.send(:create_document, site, collection, entry, data[:waterway_slug], 'waterway-details', data[:locale])

          # Oracle: simulate the Liquid filtering from event-list.html
          today = Date.today.strftime('%Y-%m-%d')
          expected_active = data[:notices].select do |n|
            n['locale'] == data[:locale] &&
              n['endDate'] && n['endDate'].to_s >= today &&
              n['waterways']&.include?(data[:waterway_slug])
          end.map do |n|
            { 'name' => n['name'], 'slug' => n['slug'], 'endDate' => n['endDate'] }
          end

          expect(doc.data['active_notices']).to eq(expected_active),
            "locale=#{data[:locale]}, waterway=#{data[:waterway_slug]}: " \
            "expected #{expected_active.size} active notices, got #{doc.data['active_notices']&.size}"
        end
      }
    end
  end

  # ============================================================================
  # Property 10: Waterway name resolution equivalence
  # **Validates: Requirements 6.1, 6.2, 6.3**
  # ============================================================================
  describe 'Property 10: Waterway name resolution equivalence' do
    it 'pre-computed waterway_name matches simulated Liquid lookup for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')

          num_waterways = range(2, 5)
          waterways = Array.new(num_waterways) do
            { 'slug' => gen_slug, 'name' => gen_name, 'locale' => locale }
          end

          use_known = choose(true, false)
          waterway_slug = if use_known && waterways.any?
                            waterways.sample['slug']
                          else
                            gen_slug
                          end

          collection_type = choose('spots', 'obstacles')

          { locale: locale, waterways: waterways, waterway_slug: waterway_slug, collection_type: collection_type }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, data[:collection_type])

          site.data['types'] = { 'spot_types' => [], 'obstacle_types' => [] }
          site.data['waterways'] = data[:waterways]
          site.data['spots'] = []

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          type_lookup = generator.send(:build_type_lookup, site.data, data[:locale])
          waterway_lookup = generator.send(:build_waterway_lookup, data[:waterways], data[:locale])
          craft_type_lookup = generator.send(:build_craft_type_lookup, site.data, data[:locale])
          generator.instance_variable_set(:@type_lookup, type_lookup)
          generator.instance_variable_set(:@waterway_lookup, waterway_lookup)
          generator.instance_variable_set(:@craft_type_lookup, craft_type_lookup)
          generator.instance_variable_set(:@spot_tip_type_lookup, {})
          generator.instance_variable_set(:@locale_spots_by_slug, {})
          generator.instance_variable_set(:@locale_spots_list, [])

          entry = if data[:collection_type] == 'spots'
                    {
                      'slug' => 'test-entry', 'name' => 'Test Entry', 'locale' => data[:locale],
                      'spotType_slug' => 'einstieg-ausstieg', 'rejected' => false,
                      'paddleCraftTypes' => [], 'waterway_slug' => data[:waterway_slug]
                    }
                  else
                    {
                      'slug' => 'test-entry', 'name' => 'Test Entry', 'locale' => data[:locale],
                      'obstacleType_slug' => 'stauwehr', 'waterway_slug' => data[:waterway_slug]
                    }
                  end

          page_name = data[:collection_type] == 'spots' ? 'spot-details' : 'obstacle-details'
          doc = generator.send(:create_document, site, collection, entry, 'test-entry', page_name, data[:locale])

          # Oracle: Liquid | where: "slug" | where: "locale" | first
          matching_ww = data[:waterways].find { |w| w['slug'] == data[:waterway_slug] && w['locale'] == data[:locale] }
          expected_name = matching_ww ? matching_ww['name'] : nil

          expect(doc.data['waterway_name']).to eq(expected_name),
            "collection=#{data[:collection_type]}, locale=#{data[:locale]}, waterway_slug=#{data[:waterway_slug]}: " \
            "expected #{expected_name.inspect}, got #{doc.data['waterway_name'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Feature: spot-tips, Property 10: CollectionGenerator Spot Tip Type Resolution
  # **Validates: Requirements 1.1, 3.1, 8.1**
  # ============================================================================
  describe 'Feature: spot-tips, Property 10: CollectionGenerator Spot Tip Type Resolution' do
    it 'pre-computed spot_tip_types contains one hash per resolved slug with correct localised name and description' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          name_key = locale == 'en' ? 'name_en' : 'name_de'
          desc_key = "description_#{locale}"

          # Generate random spot tip types for the locale
          num_tip_types = range(1, 5)
          tip_types = Array.new(num_tip_types) do
            slug = gen_slug
            {
              'locale' => locale,
              'slug' => slug,
              'name_de' => gen_name,
              'name_en' => gen_name,
              'description_de' => choose(nil, "<p>#{gen_name}</p>"),
              'description_en' => choose(nil, "<p>#{gen_name}</p>")
            }
          end

          # Generate tip slugs for the spot: mix of known and unknown slugs
          num_tip_slugs = range(0, 4)
          tip_slugs = Array.new(num_tip_slugs) do
            if choose(true, false) && tip_types.any?
              tip_types.sample['slug']
            else
              gen_slug # unknown slug — should be excluded
            end
          end

          {
            locale: locale,
            name_key: name_key,
            desc_key: desc_key,
            tip_types: tip_types,
            tip_slugs: tip_slugs
          }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'spots')

          site.data['types'] = { 'spot_types' => [], 'spot_tip_types' => data[:tip_types] }
          site.data['waterways'] = []

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          type_lookup = generator.send(:build_type_lookup, site.data, data[:locale])
          spot_tip_type_lookup = generator.send(:build_spot_tip_type_lookup, site.data, data[:locale])
          generator.instance_variable_set(:@type_lookup, type_lookup)
          generator.instance_variable_set(:@waterway_lookup, {})
          generator.instance_variable_set(:@craft_type_lookup, {})
          generator.instance_variable_set(:@spot_tip_type_lookup, spot_tip_type_lookup)

          entry = {
            'slug' => 'test-spot', 'name' => 'Test Spot', 'locale' => data[:locale],
            'spotType_slug' => 'einstieg-ausstieg', 'rejected' => false,
            'paddleCraftTypes' => [],
            'spotTipType_slugs' => data[:tip_slugs]
          }

          doc = generator.send(:create_document, site, collection, entry, 'test-spot', 'spot-details', data[:locale])

          # Oracle: for each tip slug, look up in the tip types filtered by locale
          expected = data[:tip_slugs].filter_map do |slug|
            matching = data[:tip_types].find { |t| t['slug'] == slug && t['locale'] == data[:locale] }
            next unless matching
            {
              'slug' => matching['slug'],
              'name' => matching[data[:name_key]] || matching['name_de'] || matching['slug'],
              'description' => matching[data[:desc_key]]
            }
          end

          expect(doc.data['spot_tip_types']).to eq(expected),
            "locale=#{data[:locale]}, tip_slugs=#{data[:tip_slugs]}: " \
            "expected #{expected.inspect}, got #{doc.data['spot_tip_types'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 11: Notice waterway resolution equivalence
  # **Validates: Requirements 7.1, 7.2**
  # ============================================================================
  describe 'Property 11: Notice waterway resolution equivalence' do
    it 'pre-computed notice_waterways matches simulated Liquid lookup for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')

          num_waterways = range(3, 6)
          waterways = Array.new(num_waterways) do
            { 'slug' => gen_slug, 'name' => gen_name, 'locale' => locale }
          end

          num_ww_slugs = range(0, 4)
          notice_waterway_slugs = Array.new(num_ww_slugs) do
            if choose(true, false) && waterways.any?
              waterways.sample['slug']
            else
              gen_slug
            end
          end

          { locale: locale, waterways: waterways, notice_waterway_slugs: notice_waterway_slugs }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site, collection = build_site_with_collection(tmpdir, 'notices')

          site.data['types'] = {}
          site.data['waterways'] = data[:waterways]

          generator = Jekyll::CollectionGenerator.new
          generator.instance_variable_set(:@site, site)

          waterway_lookup = generator.send(:build_waterway_lookup, data[:waterways], data[:locale])
          generator.instance_variable_set(:@type_lookup, {})
          generator.instance_variable_set(:@waterway_lookup, waterway_lookup)
          generator.instance_variable_set(:@craft_type_lookup, {})

          entry = {
            'slug' => 'test-notice', 'name' => 'Test Notice', 'locale' => data[:locale],
            'waterways' => data[:notice_waterway_slugs], 'endDate' => '2026-12-31'
          }

          doc = generator.send(:create_document, site, collection, entry, 'test-notice', 'notice-details', data[:locale])

          # Oracle: Liquid loop that looks up each waterway slug
          expected_waterways = data[:notice_waterway_slugs].filter_map do |slug|
            ww = data[:waterways].find { |w| w['slug'] == slug && w['locale'] == data[:locale] }
            { 'name' => ww['name'], 'slug' => ww['slug'] } if ww
          end

          expect(doc.data['notice_waterways']).to eq(expected_waterways),
            "locale=#{data[:locale]}, slugs=#{data[:notice_waterway_slugs]}: " \
            "expected #{expected_waterways.inspect}, got #{doc.data['notice_waterways'].inspect}"
        end
      }
    end
  end
end
