# Jekyll plugin to generate a shared map configuration JS file at build time.
# Produces api/map-config.js containing dimension configs, layer labels, and
# protected area type names for both "de" and "en" locales. Detail pages load
# this file via a <script> tag instead of rebuilding the same data inline via
# Liquid on every page.
#
# Uses Jekyll::PageWithoutAFile so the file is tracked by Jekyll and survives
# the cleanup phase (same pattern as ApiGenerator).

require 'json'

module Jekyll
  class MapConfigGenerator < Generator
    safe true
    priority :low

    LOCALES = %w[de en].freeze

    # Hardcoded spot type options matching the current Liquid output exactly.
    # The Liquid template uses labels that differ from the data file values
    # (e.g. "Ein-/Ausstiegsorte" vs "Ein- und Ausstieg"), so we preserve the
    # canonical labels here to maintain functional equivalence.
    SPOT_TYPE_OPTIONS = {
      'de' => [
        { 'slug' => 'einstieg-ausstieg', 'label' => 'Ein-/Ausstiegsorte' },
        { 'slug' => 'nur-einstieg',      'label' => 'Einstiegsorte' },
        { 'slug' => 'nur-ausstieg',      'label' => 'Ausstiegsorte' },
        { 'slug' => 'rasthalte',         'label' => 'Rasthalte' },
        { 'slug' => 'notauswasserungsstelle', 'label' => 'Notauswasserungsstelle' }
      ],
      'en' => [
        { 'slug' => 'einstieg-ausstieg', 'label' => 'Entry & Exit Spots' },
        { 'slug' => 'nur-einstieg',      'label' => 'Entry Only Spots' },
        { 'slug' => 'nur-ausstieg',      'label' => 'Exit Only Spots' },
        { 'slug' => 'rasthalte',         'label' => 'Rest Spots' },
        { 'slug' => 'notauswasserungsstelle', 'label' => 'Emergency Exit Spots' }
      ]
    }.freeze

    DIMENSION_LABELS = {
      'de' => { 'spotType' => 'Ortstyp', 'paddleCraftType' => 'Paddelboottyp' },
      'en' => { 'spotType' => 'Spot Type', 'paddleCraftType' => 'Paddle Craft Type' }
    }.freeze

    LAYER_LABELS = {
      'de' => {
        'noEntry'        => 'Keine Zutritt Orte',
        'eventNotices'   => 'Gewässerereignisse',
        'obstacles'      => 'Hindernisse',
        'protectedAreas' => 'Schutzgebiete'
      },
      'en' => {
        'noEntry'        => 'No Entry Spots',
        'eventNotices'   => 'Event Notices',
        'obstacles'      => 'Obstacles',
        'protectedAreas' => 'Protected Areas'
      }
    }.freeze

    def generate(site)
      # Skip duplicate runs for non-default language passes (same guard as ApiGenerator)
      default_lang = site.config['default_lang'] || 'de'
      current_lang = site.config['lang'] || default_lang
      if current_lang != default_lang
        Jekyll.logger.info 'MapConfigGenerator:', "Skipping (already generated during #{default_lang} pass)"
        return
      end

      Jekyll.logger.info 'MapConfigGenerator:', 'Generating map config JS file'

      config = {}
      LOCALES.each do |locale|
        config[locale] = build_locale_config(site, locale)
      end

      js_content = "window.paddelbuchMapConfig = #{JSON.generate(config)};"

      page = PageWithoutAFile.new(site, site.source, 'api', 'map-config.js')
      page.content = js_content
      page.data['layout'] = nil
      site.pages << page
    end

    private

    def build_locale_config(site, locale)
      {
        'dimensions' => build_dimensions(site, locale),
        'layerLabels' => LAYER_LABELS[locale],
        'protectedAreaTypeNames' => build_protected_area_type_names(site, locale)
      }
    end

    def build_dimensions(site, locale)
      [
        {
          'key'     => 'spotType',
          'label'   => DIMENSION_LABELS[locale]['spotType'],
          'options' => SPOT_TYPE_OPTIONS[locale]
        },
        {
          'key'     => 'paddleCraftType',
          'label'   => DIMENSION_LABELS[locale]['paddleCraftType'],
          'options' => build_paddle_craft_options(site, locale)
        }
      ]
    end

    def build_paddle_craft_options(site, locale)
      raw_types = site.data.dig('types', 'paddle_craft_types')
      unless raw_types.is_a?(Array) && !raw_types.empty?
        Jekyll.logger.warn 'MapConfigGenerator:', 'paddle_craft_types data is missing or empty'
        return []
      end

      build_type_options(raw_types, locale, 'paddle_craft_types')
    end

    def build_protected_area_type_names(site, locale)
      raw_types = site.data.dig('types', 'protected_area_types')
      unless raw_types.is_a?(Array) && !raw_types.empty?
        Jekyll.logger.warn 'MapConfigGenerator:', 'protected_area_types data is missing or empty'
        return {}
      end

      names = {}
      seen_slugs = {}

      raw_types.each do |entry|
        slug = entry['slug']
        unless slug.is_a?(String) && !slug.empty?
          Jekyll.logger.warn 'MapConfigGenerator:', "Skipping protected_area_types entry with missing slug: #{entry.inspect}"
          next
        end

        next if seen_slugs[slug]
        seen_slugs[slug] = true

        label = entry["name_#{locale}"]
        label = entry['name_de'] if label.nil? || label.to_s.empty?

        if label.nil? || label.to_s.empty?
          Jekyll.logger.warn 'MapConfigGenerator:', "Skipping protected_area_types entry '#{slug}' — no name_#{locale} or name_de"
          next
        end

        names[slug] = label
      end

      names
    end

    # Build an array of {slug, label} options from a type data array,
    # deduplicating by slug and falling back to name_de when name_{locale}
    # is missing.
    def build_type_options(raw_types, locale, type_name)
      seen_slugs = {}
      options = []

      raw_types.each do |entry|
        slug = entry['slug']
        unless slug.is_a?(String) && !slug.empty?
          Jekyll.logger.warn 'MapConfigGenerator:', "Skipping #{type_name} entry with missing slug: #{entry.inspect}"
          next
        end

        next if seen_slugs[slug]
        seen_slugs[slug] = true

        label = entry["name_#{locale}"]
        label = entry['name_de'] if label.nil? || label.to_s.empty?

        if label.nil? || label.to_s.empty?
          Jekyll.logger.warn 'MapConfigGenerator:', "Skipping #{type_name} entry '#{slug}' — no name_#{locale} or name_de"
          next
        end

        options << { 'slug' => slug, 'label' => label }
      end

      options
    end
  end
end
