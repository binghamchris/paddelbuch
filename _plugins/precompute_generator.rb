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

    # Ordered list of the two supported (new) paddle craft type slugs.
    # The order here defines the order of the paddle craft type filter options
    # and the spot-detail craft type display (Requirements 1.1, 1.2).
    NEW_CRAFT_TYPE_SLUGS = %w[klappbar-und-aufblasbar hardshell].freeze

    # Standalone icon metadata for the two new craft types (no coloured circle).
    # Maps each supported slug to its icon path and iconOnly rendering flag
    # (Requirement 1.5).
    NEW_CRAFT_TYPE_META = {
      'klappbar-und-aufblasbar' => { icon: '/assets/images/icons/foldables-dark.svg', iconOnly: true },
      'hardshell'               => { icon: '/assets/images/icons/hardshell-dark.svg', iconOnly: true }
    }.freeze

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

      # Paddle craft types for dimension config.
      # Build a slug -> data-row lookup so the option order is driven by the
      # ordered allow-list NEW_CRAFT_TYPE_SLUGS rather than by data order. This
      # guarantees exactly two options, in a fixed order, and inherently excludes
      # the legacy slugs (Requirements 1.1, 1.2).
      craft_types = (site.data.dig('types', 'paddle_craft_types') || [])
        .select { |t| t['locale'] == locale }
      craft_by_slug = craft_types.each_with_object({}) { |ct, h| h[ct['slug']] = ct }

      craft_options = NEW_CRAFT_TYPE_SLUGS.map do |slug|
        ct = craft_by_slug[slug]
        # Localised label for the build locale (Requirements 1.3/1.4). When the
        # resolved label is nil, absent, or whitespace-only, fall back to the
        # option's slug (Requirement 1.7).
        raw_label = ct && ct[name_key]
        label = (raw_label.nil? || raw_label.to_s.strip.empty?) ? slug : raw_label
        meta = NEW_CRAFT_TYPE_META[slug]
        { slug: slug, label: label, icon: meta[:icon], iconOnly: meta[:iconOnly] }
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
            label: locale == 'en' ? 'Accessible To' : 'Zugänglich für',
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

      # Pre-compute the ordered craft type display list for the Spot detail
      # Craft_Type_Display (Requirements 4.2, 4.3). Mirrors the
      # spot_tip_types_for_locale pattern above, emitting exactly the two new
      # types in order. Uses the same localised-name selection with slug
      # fallback as the filter labels (Requirements 4.4, 4.5).
      site.data['craft_type_display_for_locale'] = NEW_CRAFT_TYPE_SLUGS.map do |slug|
        ct = craft_by_slug[slug]
        raw = ct && ct[name_key]
        name = (raw.nil? || raw.to_s.strip.empty?) ? slug : raw
        { 'slug' => slug, 'name' => name, 'icon' => NEW_CRAFT_TYPE_META[slug][:icon] }
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
