# frozen_string_literal: true

# Property-based tests for PrecomputeGenerator pre-computation methods
# Tests verify that Ruby pre-computation produces the same results as
# what the Liquid templates would produce via filter scans and conditionals.

require 'spec_helper'
require 'tmpdir'
require 'json'

# Extend Rantly with helpers for generating random slugs and names
class Rantly
  def gen_slug
    sized(range(3, 10)) { string(:alpha) }.downcase
  end

  def gen_name
    sized(range(3, 12)) { string(:alpha) }
  end
end

RSpec.describe 'PrecomputeGenerator properties' do
  # Helper: create a minimal Jekyll site with data for PrecomputeGenerator
  def build_site(tmpdir, lang: 'de', default_lang: 'de')
    config = Jekyll.configuration(
      'source' => tmpdir,
      'destination' => File.join(tmpdir, '_site'),
      'lang' => lang,
      'default_lang' => default_lang
    )
    Jekyll::Site.new(config)
  end

  # ============================================================================
  # Property 5: Locale prefix equivalence
  # **Validates: Requirements 2.1, 2.2, 2.3**
  # ============================================================================
  describe 'Property 5: Locale prefix equivalence' do
    it 'pre-computed locale_prefix matches Liquid conditional for random lang/default_lang pairs' do
      property_of {
        Rantly {
          lang = sized(2) { string(:alpha) }.downcase
          default_lang = sized(2) { string(:alpha) }.downcase
          { lang: lang, default_lang: default_lang }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:lang], default_lang: data[:default_lang])
          site.data['waterways'] = []
          site.data['static_pages'] = []
          site.data['types'] = {}

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          # Oracle: Liquid {% if site.lang != site.default_lang %}/{{ site.lang }}{% endif %}
          expected = if data[:lang] != data[:default_lang]
                       "/#{data[:lang]}"
                     else
                       ''
                     end

          expect(site.config['locale_prefix']).to eq(expected),
            "lang=#{data[:lang]}, default_lang=#{data[:default_lang]}: " \
            "expected #{expected.inspect}, got #{site.config['locale_prefix'].inspect}"
        end
      }
    end
  end

  # ============================================================================
  # Property 6: Header navigation data equivalence
  # **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  # ============================================================================
  describe 'Property 6: Header navigation data equivalence' do
    it 'pre-computed nav_top_lakes matches Liquid top-10-by-area then alphabetical sort' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          num_waterways = range(5, 20)
          waterways = Array.new(num_waterways) do
            is_lake = choose(true, false)
            {
              'locale' => choose(locale, choose('de', 'en')),
              'slug' => gen_slug,
              'name' => gen_name,
              'paddlingEnvironmentType_slug' => is_lake ? 'see' : choose('fluss', 'kanal'),
              'showInMenu' => choose(true, false),
              'area' => range(1, 10_000)
            }
          end
          { locale: locale, waterways: waterways }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:locale], default_lang: 'de')
          site.data['waterways'] = data[:waterways]
          site.data['static_pages'] = []
          site.data['types'] = {}

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          # Oracle: filter lakes for locale + see + showInMenu, sort by -area, take 10, sort alpha
          expected = data[:waterways]
            .select { |w| w['locale'] == data[:locale] && w['paddlingEnvironmentType_slug'] == 'see' && w['showInMenu'] == true }
            .sort_by { |w| -(w['area'] || 0) }
            .first(10)
            .sort_by { |w| w['name'].to_s.downcase }

          expect(site.data['nav_top_lakes']).to eq(expected),
            "locale=#{data[:locale]}: expected #{expected.size} lakes, got #{site.data['nav_top_lakes']&.size}"
        end
      }
    end

    it 'pre-computed nav_top_rivers matches Liquid top-10-by-length then alphabetical sort' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          num_waterways = range(5, 20)
          waterways = Array.new(num_waterways) do
            is_river = choose(true, false)
            {
              'locale' => choose(locale, choose('de', 'en')),
              'slug' => gen_slug,
              'name' => gen_name,
              'paddlingEnvironmentType_slug' => is_river ? 'fluss' : choose('see', 'kanal'),
              'showInMenu' => choose(true, false),
              'length' => range(1, 10_000)
            }
          end
          { locale: locale, waterways: waterways }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:locale], default_lang: 'de')
          site.data['waterways'] = data[:waterways]
          site.data['static_pages'] = []
          site.data['types'] = {}

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          # Oracle: filter rivers for locale + fluss + showInMenu, sort by -length, take 10, sort alpha
          expected = data[:waterways]
            .select { |w| w['locale'] == data[:locale] && w['paddlingEnvironmentType_slug'] == 'fluss' && w['showInMenu'] == true }
            .sort_by { |w| -(w['length'] || 0) }
            .first(10)
            .sort_by { |w| w['name'].to_s.downcase }

          expect(site.data['nav_top_rivers']).to eq(expected),
            "locale=#{data[:locale]}: expected #{expected.size} rivers, got #{site.data['nav_top_rivers']&.size}"
        end
      }
    end

    it 'pre-computed nav static pages match Liquid where/sort for random inputs' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          num_pages = range(3, 12)
          static_pages = Array.new(num_pages) do
            {
              'locale' => choose(locale, choose('de', 'en')),
              'slug' => gen_slug,
              'name' => gen_name,
              'menu_slug' => choose('offene-daten', 'ueber', gen_slug),
              'menuOrder' => range(0, 20)
            }
          end
          { locale: locale, static_pages: static_pages }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:locale], default_lang: 'de')
          site.data['waterways'] = []
          site.data['static_pages'] = data[:static_pages]
          site.data['types'] = {}

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          # Oracle: Liquid | where: "locale", locale | where: "menu_slug", slug | sort: "menuOrder"
          expected_open_data = data[:static_pages]
            .select { |p| p['locale'] == data[:locale] && p['menu_slug'] == 'offene-daten' }
            .sort_by { |p| p['menuOrder'] || 0 }

          expected_about = data[:static_pages]
            .select { |p| p['locale'] == data[:locale] && p['menu_slug'] == 'ueber' }
            .sort_by { |p| p['menuOrder'] || 0 }

          expect(site.data['nav_open_data_pages']).to eq(expected_open_data),
            "locale=#{data[:locale]}: open data pages mismatch"

          expect(site.data['nav_about_pages']).to eq(expected_about),
            "locale=#{data[:locale]}: about pages mismatch"
        end
      }
    end
  end

  # ============================================================================
  # Property 7: Map config JSON equivalence
  # **Validates: Requirements 4.1, 4.3, 4.5**
  # ============================================================================
  describe 'Property 7: Map config JSON equivalence' do
    it 'pre-computed map_data_config_json matches expected JSON structure for random craft types' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          num_types = range(1, 8)
          craft_types = Array.new(num_types) do
            {
              'locale' => choose(locale, choose('de', 'en')),
              'slug' => gen_slug,
              'name_de' => gen_name,
              'name_en' => gen_name
            }
          end
          { locale: locale, craft_types: craft_types }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:locale], default_lang: 'de')
          site.data['waterways'] = []
          site.data['static_pages'] = []
          site.data['types'] = { 'paddle_craft_types' => data[:craft_types], 'protected_area_types' => [] }

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          parsed = JSON.parse(site.data['map_data_config_json'])
          name_key = "name_#{data[:locale]}"

          # Oracle: build expected structure
          locale_craft_types = data[:craft_types].select { |t| t['locale'] == data[:locale] }
          expected_craft_options = locale_craft_types.map do |ct|
            { 'slug' => ct['slug'], 'label' => ct[name_key] || ct['name_de'] }
          end

          expected_spot_options = if data[:locale] == 'en'
            [
              { 'slug' => 'einstieg-ausstieg', 'label' => 'Entry & Exit Spots',
                'icon' => '/assets/images/icons/entryexit-light.svg', 'colorClass' => 'startingspot' },
              { 'slug' => 'nur-einstieg', 'label' => 'Entry Only Spots',
                'icon' => '/assets/images/icons/entry-light.svg', 'colorClass' => 'startingspot' },
              { 'slug' => 'nur-ausstieg', 'label' => 'Exit Only Spots',
                'icon' => '/assets/images/icons/exit-light.svg', 'colorClass' => 'otherspot' },
              { 'slug' => 'rasthalte', 'label' => 'Rest Spots',
                'icon' => '/assets/images/icons/rest-light.svg', 'colorClass' => 'otherspot' },
              { 'slug' => 'notauswasserungsstelle', 'label' => 'Emergency Exit Spots',
                'icon' => '/assets/images/icons/emergency-light.svg', 'colorClass' => 'otherspot' }
            ]
          else
            [
              { 'slug' => 'einstieg-ausstieg', 'label' => 'Ein-/Ausstiegsorte',
                'icon' => '/assets/images/icons/entryexit-light.svg', 'colorClass' => 'startingspot' },
              { 'slug' => 'nur-einstieg', 'label' => 'Einstiegsorte',
                'icon' => '/assets/images/icons/entry-light.svg', 'colorClass' => 'startingspot' },
              { 'slug' => 'nur-ausstieg', 'label' => 'Ausstiegsorte',
                'icon' => '/assets/images/icons/exit-light.svg', 'colorClass' => 'otherspot' },
              { 'slug' => 'rasthalte', 'label' => 'Rasthalte',
                'icon' => '/assets/images/icons/rest-light.svg', 'colorClass' => 'otherspot' },
              { 'slug' => 'notauswasserungsstelle', 'label' => 'Notauswasserungsstelle',
                'icon' => '/assets/images/icons/emergency-light.svg', 'colorClass' => 'otherspot' }
            ]
          end

          expected_layer_labels = if data[:locale] == 'en'
            { 'noEntry' => 'No Entry Spots', 'eventNotices' => 'Event Notices',
              'obstacles' => 'Obstacles', 'protectedAreas' => 'Protected Areas' }
          else
            { 'noEntry' => 'Keine Zutritt Orte', 'eventNotices' => 'Gewässerereignisse',
              'obstacles' => 'Hindernisse', 'protectedAreas' => 'Schutzgebiete' }
          end

          # Verify top-level structure
          expect(parsed['locale']).to eq(data[:locale])
          expect(parsed['dimensionConfigs']).to be_an(Array)
          expect(parsed['dimensionConfigs'].size).to eq(2)

          # Verify spotType dimension
          spot_dim = parsed['dimensionConfigs'][0]
          expect(spot_dim['key']).to eq('spotType')
          expect(spot_dim['label']).to eq(data[:locale] == 'en' ? 'Spot Type' : 'Ortstyp')
          expect(spot_dim['options']).to eq(expected_spot_options)

          # Verify paddleCraftType dimension
          craft_dim = parsed['dimensionConfigs'][1]
          expect(craft_dim['key']).to eq('paddleCraftType')
          expect(craft_dim['label']).to eq(data[:locale] == 'en' ? 'Paddle Craft Type' : 'Paddelboottyp')
          expect(craft_dim['options']).to eq(expected_craft_options),
            "locale=#{data[:locale]}: craft options mismatch"

          # Verify layer labels
          expect(parsed['layerLabels']).to eq(expected_layer_labels)
        end
      }
    end
  end

  # ============================================================================
  # Property 8: Layer control config JSON equivalence
  # **Validates: Requirements 4.2, 4.4**
  # ============================================================================
  describe 'Property 8: Layer control config JSON equivalence' do
    it 'pre-computed layer_control_config_json matches expected JSON structure for random PA types' do
      property_of {
        Rantly {
          locale = choose('de', 'en')
          default_lang = 'de'
          num_types = range(1, 8)
          pa_types = Array.new(num_types) do
            {
              'locale' => choose(locale, choose('de', 'en')),
              'slug' => gen_slug,
              'name_de' => gen_name,
              'name_en' => gen_name
            }
          end
          { locale: locale, default_lang: default_lang, pa_types: pa_types }
        }
      }.check(100) { |data|
        Dir.mktmpdir do |tmpdir|
          site = build_site(tmpdir, lang: data[:locale], default_lang: data[:default_lang])
          site.data['waterways'] = []
          site.data['static_pages'] = []
          site.data['types'] = { 'paddle_craft_types' => [], 'protected_area_types' => data[:pa_types] }

          generator = Jekyll::PrecomputeGenerator.new
          generator.generate(site)

          parsed = JSON.parse(site.data['layer_control_config_json'])
          name_key = "name_#{data[:locale]}"
          expected_prefix = (data[:locale] != data[:default_lang]) ? "/#{data[:locale]}" : ''

          # Oracle: build expected protectedAreaTypeNames mapping
          locale_pa_types = data[:pa_types].select { |t| t['locale'] == data[:locale] }
          expected_pa_names = {}
          locale_pa_types.each { |t| expected_pa_names[t['slug']] = t[name_key] || t['name_de'] }

          expect(parsed['currentLocale']).to eq(data[:locale])
          expect(parsed['localePrefix']).to eq(expected_prefix),
            "locale=#{data[:locale]}, default=#{data[:default_lang]}: " \
            "expected prefix #{expected_prefix.inspect}, got #{parsed['localePrefix'].inspect}"
          expect(parsed['protectedAreaTypeNames']).to eq(expected_pa_names),
            "locale=#{data[:locale]}: PA type names mismatch"
        end
      }
    end
  end
end
