# frozen_string_literal: true

require 'json'

# Jekyll plugin to pre-compute site-level data that is identical across all
# pages within a locale: header navigation arrays, map config JSON strings,
# layer control config JSON, and locale prefix.
#
# Runs after CollectionGenerator (priority :high) but before Liquid rendering.
# Called once per language pass by the multi-language plugin.
#
# Requirements: 2.1, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 9.1, 9.2, 9.3

module Jekyll
  class PrecomputeGenerator < Generator
    safe true
    priority :normal

    def generate(site)
      locale = site.config['lang'] || site.config['default_lang'] || 'de'
      default_lang = site.config['default_lang'] || 'de'

      # Requirement 2: Locale prefix
      # Respect an explicit locale_prefix from per-locale config overrides
      # (needed for parallel builds where the plugin sets default_lang = languages.first).
      unless site.config.key?('locale_prefix')
        site.config['locale_prefix'] = (locale != default_lang) ? "/#{locale}" : ''
      end

      # Requirement 3: Header navigation data
      precompute_header_nav(site, locale)

      # Requirement 4: Map configuration JSON
      precompute_map_config_json(site, locale)
    end

    private

    def precompute_header_nav(site, locale)
      waterways = site.data['waterways'] || []

      # Top 10 lakes by area, then sorted alphabetically
      site.data['nav_top_lakes'] = waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'see' && w['showInMenu'] == true }
        .sort_by { |w| -(w['area'] || 0) }
        .first(10)
        .sort_by { |w| w['name'].to_s.downcase }

      # Top 10 rivers by length, then sorted alphabetically
      site.data['nav_top_rivers'] = waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' && w['showInMenu'] == true && w['navigableByPaddlers'] != false }
        .sort_by { |w| -(w['length'] || 0) }
        .first(10)
        .sort_by { |w| w['name'].to_s.downcase }

      # Static pages for menus
      static_pages = site.data['static_pages'] || []
      site.data['nav_open_data_pages'] = static_pages
        .select { |p| p['locale'] == locale && p['menu_slug'] == 'offene-daten' }
        .sort_by { |p| p['menuOrder'] || 0 }

      site.data['nav_about_pages'] = static_pages
        .select { |p| p['locale'] == locale && p['menu_slug'] == 'ueber' }
        .sort_by { |p| p['menuOrder'] || 0 }
    end

    def precompute_map_config_json(site, locale)
      default_lang = site.config['default_lang'] || 'de'
      locale_prefix = site.config['locale_prefix']
      name_key = "name_#{locale}"

      # Paddle craft types for dimension config
      craft_types = (site.data.dig('types', 'paddle_craft_types') || [])
        .select { |t| t['locale'] == locale }
      craft_options = craft_types.map { |ct| { slug: ct['slug'], label: ct[name_key] || ct['name_de'] } }

      # Spot type dimension options (hardcoded slugs, translated labels)
      spot_type_options = if locale == 'en'
        [
          { slug: 'einstieg-ausstieg', label: 'Entry & Exit Spots' },
          { slug: 'nur-einstieg', label: 'Entry Only Spots' },
          { slug: 'nur-ausstieg', label: 'Exit Only Spots' },
          { slug: 'rasthalte', label: 'Rest Spots' },
          { slug: 'notauswasserungsstelle', label: 'Emergency Exit Spots' }
        ]
      else
        [
          { slug: 'einstieg-ausstieg', label: 'Ein-/Ausstiegsorte' },
          { slug: 'nur-einstieg', label: 'Einstiegsorte' },
          { slug: 'nur-ausstieg', label: 'Ausstiegsorte' },
          { slug: 'rasthalte', label: 'Rasthalte' },
          { slug: 'notauswasserungsstelle', label: 'Notauswasserungsstelle' }
        ]
      end

      layer_labels = if locale == 'en'
        { noEntry: 'No Entry Spots', eventNotices: 'Event Notices', obstacles: 'Obstacles', protectedAreas: 'Protected Areas' }
      else
        { noEntry: 'Keine Zutritt Orte', eventNotices: 'Gewässerereignisse', obstacles: 'Hindernisse', protectedAreas: 'Schutzgebiete' }
      end

      map_data_config = {
        locale: locale,
        dimensionConfigs: [
          {
            key: 'spotType',
            label: locale == 'en' ? 'Spot Type' : 'Ortstyp',
            options: spot_type_options
          },
          {
            key: 'paddleCraftType',
            label: locale == 'en' ? 'Paddle Craft Type' : 'Paddelboottyp',
            options: craft_options
          }
        ],
        layerLabels: layer_labels
      }

      site.data['map_data_config_json'] = JSON.generate(map_data_config)

      # Layer control config
      pa_types = (site.data.dig('types', 'protected_area_types') || [])
        .select { |t| t['locale'] == locale }
      pa_names = {}
      pa_types.each { |t| pa_names[t['slug']] = t[name_key] || t['name_de'] }

      layer_control_config = {
        currentLocale: locale,
        localePrefix: locale_prefix,
        protectedAreaTypeNames: pa_names
      }

      site.data['layer_control_config_json'] = JSON.generate(layer_control_config)
    end
  end
end
