# frozen_string_literal: true

require 'json'
require 'yaml'

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

      # Paddle craft type icon metadata (standalone icons, no colored circle)
      craft_type_meta = {
        'seekajak'              => { icon: '/assets/images/icons/kayak-dark.svg', iconOnly: true },
        'kanadier'              => { icon: '/assets/images/icons/canoe-dark.svg', iconOnly: true },
        'stand-up-paddle-board' => { icon: '/assets/images/icons/sup-dark.svg',   iconOnly: true }
      }

      craft_options.each do |opt|
        meta = craft_type_meta[opt[:slug]]
        next unless meta

        opt[:icon] = meta[:icon]
        opt[:iconOnly] = meta[:iconOnly]
      end

      # Spot tip type dimension options (dynamic from data)
      tip_types = (site.data.dig('types', 'spot_tip_types') || [])
        .select { |t| t['locale'] == locale }
      tip_type_options = tip_types.map { |tt| { slug: tt['slug'], label: tt[name_key] || tt['name_de'] } }

      # Spot tip type icon metadata: the same colour-coded glyph shown inside the
      # map marker Beads, rendered as a Bead (white disc, coloured border) in the
      # filter UI. beadClass is the CSS modifier suffix for .filter-icon-bead--<beadClass>.
      # Keep the glyph paths in sync with TIP_MODIFIER_CONFIG in marker-styles.js.
      tip_type_meta = {
        'swiss-canoe-eco-tip' => { icon: '/assets/images/markers/tip-modifier-swiss-canoe-eco-tip.svg', beadClass: 'swiss-canoe-eco-tip' },
        'swiss-canoe-tip'     => { icon: '/assets/images/markers/tip-modifier-swiss-canoe-tip.svg',     beadClass: 'swiss-canoe-tip' }
      }

      tip_type_options.each do |opt|
        meta = tip_type_meta[opt[:slug]]
        next unless meta

        opt[:icon] = meta[:icon]
        opt[:beadClass] = meta[:beadClass]
      end

      # Add "no tips" option (no icon -- represents the absence of tips)
      no_tips_label = locale == 'en' ? 'Spots without tips' : 'Einstiegsorte ohne Tipps'
      tip_type_options << { slug: '__no_tips__', label: no_tips_label }

      # Spot type dimension options (hardcoded slugs, translated labels)
      # icon: relative path to the light SVG icon in assets/images/icons/
      # colorClass: CSS modifier suffix for .filter-icon-circle--<colorClass>
      spot_type_meta = {
        'einstieg-ausstieg' => { icon: '/assets/images/icons/entryexit-light.svg', colorClass: 'startingspot' },
        'nur-einstieg'      => { icon: '/assets/images/icons/entry-light.svg',     colorClass: 'startingspot' },
        'nur-ausstieg'      => { icon: '/assets/images/icons/exit-light.svg',      colorClass: 'otherspot' },
        'rasthalte'         => { icon: '/assets/images/icons/rest-light.svg',      colorClass: 'otherspot' },
        'notauswasserungsstelle' => { icon: '/assets/images/icons/emergency-light.svg', colorClass: 'otherspot' }
      }

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

      # Merge icon and colorClass metadata into each spot type option
      spot_type_options.each do |opt|
        meta = spot_type_meta[opt[:slug]]
        next unless meta

        opt[:icon] = meta[:icon]
        opt[:colorClass] = meta[:colorClass]
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
          },
          {
            key: 'spotTipType',
            label: locale == 'en' ? 'Spot Tips' : 'Tipps',
            options: tip_type_options
          }
        ],
        layerLabels: layer_labels
      }

      site.data['map_data_config_json'] = JSON.generate(map_data_config)

      # Pre-compute spot tip types for template use (avoids per-page Liquid lookups)
      site.data['spot_tip_types_for_locale'] = tip_types.map do |tt|
        { 'slug' => tt['slug'], 'name' => tt[name_key] || tt['name_de'] }
      end

      # Layer control config
      pa_types = (site.data.dig('types', 'protected_area_types') || [])
        .select { |t| t['locale'] == locale }
      pa_names = {}
      pa_types.each { |t| pa_names[t['slug']] = t[name_key] || t['name_de'] }

      # Localised Spot_Tip_Type names for the composite marker accessible label
      # (Requirement 5.4 -- sourced from the tip type data, not hard-coded in JS).
      tip_names = {}
      tip_types.each { |tt| tip_names[tt['slug']] = tt[name_key] || tt['name_de'] }

      # Accessible-label templates, resolved from the i18n single source of truth
      # (_i18n/<locale>.yml, keys map.spot_with_tips_label / map.spot_with_tips_generic).
      map_i18n = load_map_i18n(site, locale)

      layer_control_config = {
        currentLocale: locale,
        localePrefix: locale_prefix,
        protectedAreaTypeNames: pa_names,
        spotTipTypeNames: tip_names,
        spotWithTipsLabel: map_i18n['spot_with_tips_label'],
        spotWithTipsGeneric: map_i18n['spot_with_tips_generic']
      }

      site.data['layer_control_config_json'] = JSON.generate(layer_control_config)
    end

    # Reads the `map` section of _i18n/<locale>.yml so build-time config can carry
    # localised accessible-label templates to the client. Returns {} on any failure
    # so a missing/malformed file degrades gracefully.
    def load_map_i18n(site, locale)
      path = File.join(site.source, '_i18n', "#{locale}.yml")
      return {} unless File.readable?(path)

      data = YAML.safe_load(File.read(path)) || {}
      map_section = data['map']
      map_section.is_a?(Hash) ? map_section : {}
    rescue StandardError => e
      Jekyll.logger.warn 'PrecomputeGenerator:', "Could not load _i18n/#{locale}.yml map labels: #{e.message}"
      {}
    end
  end
end
