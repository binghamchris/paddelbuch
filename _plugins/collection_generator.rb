# frozen_string_literal: true

require 'yaml'

# Jekyll plugin to generate collection documents from Contentful YAML data
#
# The ContentfulFetcher writes data to _data/*.yml but Jekyll collections
# require documents in their collection directories (_spots/, _waterways/, etc.)
# to generate pages. This generator bridges that gap by creating virtual
# Jekyll::Document objects from the YAML data, filtered by the current locale.
#
# Runs after ContentfulFetcher (priority :highest) but before API/Tile generators.

module Jekyll
  class CollectionGenerator < Generator
    safe true
    priority :high

    # Maps collection name to its data key in site.data and required fields
    COLLECTIONS = {
      'spots' => { data_key: 'spots', page_name: 'spot-details' },
      'waterways' => { data_key: 'waterways', page_name: 'waterway-details' },
      'obstacles' => { data_key: 'obstacles', page_name: 'obstacle-details' },
      'notices' => { data_key: 'notices', page_name: 'notice-details' },
      'static_pages' => { data_key: 'static_pages', page_name: 'static-page' }
    }.freeze

    # Icon name and alt text mappings for all spot types
    SPOT_ICON_MAP = {
      'einstieg-ausstieg' => { name: 'entryexit', alt_de: 'Ein-/Ausstiegsorte Symbol', alt_en: 'Entry and exit spot icon' },
      'nur-einstieg'      => { name: 'entry',     alt_de: 'Einstiegsorte Symbol',       alt_en: 'Entry spot icon' },
      'nur-ausstieg'      => { name: 'exit',      alt_de: 'Ausstiegsorte Symbol',       alt_en: 'Exit spot icon' },
      'rasthalte'         => { name: 'rest',       alt_de: 'Rasthalte Symbol',           alt_en: 'Rest spot icon' },
      'notauswasserungsstelle' => { name: 'emergency', alt_de: 'Notauswasserungsstelle Symbol', alt_en: 'Emergency exit spot icon' }
    }.freeze

    def generate(site)
      @site = site
      current_locale = site.config['lang'] || site.config['default_lang'] || 'de'

      # Pre-build spot lookup hash for obstacle resolution (avoids O(n²) search)
      spots_data = site.data['spots']
      @locale_spots_by_slug = {}
      @locale_spots_list = []
      if spots_data.is_a?(Array)
        @locale_spots_list = spots_data.select { |s| s['locale'] == current_locale }
        @locale_spots_list.each do |s|
          @locale_spots_by_slug[s['slug']] = s if s['slug']
        end
      end

      # Build O(1) lookup hashes once per generate call
      @type_lookup = build_type_lookup(site.data, current_locale)
      @waterway_lookup = build_waterway_lookup(site.data['waterways'], current_locale)
      @craft_type_lookup = build_craft_type_lookup(site.data, current_locale)

      COLLECTIONS.each do |collection_name, config|
        collection = site.collections[collection_name]
        next unless collection

        data = site.data[config[:data_key]]
        next unless data.is_a?(Array)

        # Filter entries for the current locale
        locale_entries = data.select { |item| item['locale'] == current_locale }

        locale_entries.each do |entry|
          slug = entry['slug']
          next unless slug && !slug.empty?

          doc = create_document(site, collection, entry, slug, config[:page_name])
          collection.docs << doc
        end
      end
    end

    private

    def create_document(site, collection, entry, slug, page_name)
      # Create a virtual document path (doesn't need to exist on disk)
      path = File.join(site.source, collection.relative_directory, "#{slug}.md")

      doc = Jekyll::Document.new(path, site: site, collection: collection)

      # Copy all entry fields into the document's data (front matter)
      entry.each do |key, value|
        doc.data[key] = value
      end

      # Ensure required fields are set
      doc.data['slug'] = slug
      doc.data['title'] = entry['name'] || entry['title'] || slug
      doc.data['pageName'] = page_name

      # Set empty body content for notice documents to prevent {{ content }}
      # in the default layout from rendering duplicate description elements.
      # The notice layout provides all content via notice-detail-content.html.
      if collection.label == 'notices'
        doc.content = ''
      end

      # For static_pages, build permalink from menu_slug + slug
      if collection.label == 'static_pages' && entry['menu_slug']
        doc.data['permalink'] = "/#{entry['menu_slug']}/#{slug}/"
      end

      # For obstacles, compute center coordinates from geometry
      # and resolve exit/re-entry spots from spots data
      if collection.label == 'obstacles'
        current_locale = site.config['lang'] || site.config['default_lang'] || 'de'

        if entry['geometry']
          center = compute_geometry_center(entry['geometry'])
          if center
            doc.data['centerLat'] = center[:lat]
            doc.data['centerLon'] = center[:lon]
          end
        end

        # Resolve exit/re-entry spots for portage table
        resolve_obstacle_spots(doc, entry, site, current_locale)
      end

      doc
    end

    # Resolve exit and re-entry spots for an obstacle.
    # First checks the obstacle's own spots array, then falls back to
    # finding spots whose slug starts with the obstacle slug.
    # Uses pre-built @locale_spots_by_slug hash for O(1) lookups.
    def resolve_obstacle_spots(doc, entry, site, locale)
      return if @locale_spots_by_slug.nil? || @locale_spots_by_slug.empty?

      obstacle_slug = entry['slug']
      linked_slugs = entry['spots'] || []

      # Try to find spots from the obstacle's spots array first
      exit_spot = nil
      reentry_spot = nil

      if linked_slugs.any?
        linked_slugs.each do |spot_slug|
          spot = @locale_spots_by_slug[spot_slug]
          next unless spot
          exit_spot ||= spot if %w[nur-ausstieg einstieg-ausstieg].include?(spot['spotType_slug'])
          reentry_spot ||= spot if %w[nur-einstieg einstieg-ausstieg].include?(spot['spotType_slug'])
        end
      end

      # Fallback: find spots whose slug starts with the obstacle slug
      unless exit_spot && reentry_spot
        prefix = "#{obstacle_slug}-"
        @locale_spots_list.each do |spot|
          next unless spot['slug']&.start_with?(prefix)
          exit_spot ||= spot if %w[nur-ausstieg einstieg-ausstieg].include?(spot['spotType_slug'])
          reentry_spot ||= spot if %w[nur-einstieg einstieg-ausstieg].include?(spot['spotType_slug'])
          break if exit_spot && reentry_spot
        end
      end

      doc.data['exitSpot_slug'] = exit_spot['slug'] if exit_spot
      doc.data['exitSpot_name'] = exit_spot['name'] if exit_spot
      doc.data['reentrySpot_slug'] = reentry_spot['slug'] if reentry_spot
      doc.data['reentrySpot_name'] = reentry_spot['name'] if reentry_spot
    end

    # Compute the center point of a GeoJSON geometry by averaging all coordinates
    def compute_geometry_center(geometry_str)
      geometry = geometry_str.is_a?(String) ? JSON.parse(geometry_str) : geometry_str
      coords = extract_all_coordinates(geometry)
      return nil if coords.empty?

      avg_lon = coords.sum { |c| c[0] } / coords.size.to_f
      avg_lat = coords.sum { |c| c[1] } / coords.size.to_f
      { lat: avg_lat, lon: avg_lon }
    rescue JSON::ParserError
      nil
    end

    # Recursively extract all [lon, lat] coordinate pairs from a GeoJSON geometry
    def extract_all_coordinates(geometry)
      return [] unless geometry.is_a?(Hash)

      type = geometry['type']
      coords = geometry['coordinates']
      return [] unless coords

      case type
      when 'Point'
        [coords]
      when 'LineString', 'MultiPoint'
        coords
      when 'Polygon', 'MultiLineString'
        coords.flatten(1)
      when 'MultiPolygon'
        coords.flatten(2)
      else
        []
      end
    end

    # Build { type_category => { slug => translated_name } } hash for spot_types, obstacle_types, paddle_craft_types
    def build_type_lookup(data, locale)
      name_key = locale == 'en' ? 'name_en' : 'name_de'
      result = {}
      %w[spot_types obstacle_types paddle_craft_types].each do |type_key|
        types = data.dig('types', type_key)
        next unless types.is_a?(Array)
        result[type_key] = {}
        types.each do |t|
          next unless t['locale'] == locale && t['slug']
          result[type_key][t['slug']] = t[name_key] || t['name_de'] || t['slug']
        end
      end
      result
    end

    # Build { slug => translated_name } hash for paddle_craft_types
    def build_craft_type_lookup(data, locale)
      name_key = locale == 'en' ? 'name_en' : 'name_de'
      types = data.dig('types', 'paddle_craft_types')
      return {} unless types.is_a?(Array)
      lookup = {}
      types.each do |t|
        next unless t['locale'] == locale && t['slug']
        lookup[t['slug']] = t[name_key] || t['name_de'] || t['slug']
      end
      lookup
    end

    # Build { slug => waterway_hash } hash for waterways filtered by locale
    def build_waterway_lookup(waterways, locale)
      return {} unless waterways.is_a?(Array)
      lookup = {}
      waterways.each do |w|
        lookup[w['slug']] = w if w['locale'] == locale
      end
      lookup
    end

    # Resolve spot icon filename and alt text based on type slug and rejected status
    def resolve_spot_icon(type_slug, is_rejected, locale)
      if is_rejected
        { name: 'noentry', alt: locale == 'en' ? 'No entry spot icon' : 'Kein Zutritt Symbol' }
      else
        entry = SPOT_ICON_MAP[type_slug] || SPOT_ICON_MAP['einstieg-ausstieg']
        { name: entry[:name], alt: locale == 'en' ? entry[:alt_en] : entry[:alt_de] }
      end
    end

    # Load translation value from _i18n/<locale>.yml by dotted key path
    def get_translation(locale, key)
      @translations ||= {}
      @translations[locale] ||= YAML.load_file(File.join(@site.source, '_i18n', "#{locale}.yml"))
      @translations[locale].dig(*key.split('.'))
    end
  end
end
