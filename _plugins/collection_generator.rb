# frozen_string_literal: true

require 'yaml'
require 'set'

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
      if spots_data.is_a?(Array)
        spots_data.each do |s|
          next unless s['locale'] == current_locale && s['slug']
          @locale_spots_by_slug[s['slug']] = s
        end
      end

      # Build O(1) lookup hashes once per generate call
      @type_lookup = build_type_lookup(site.data, current_locale)
      @waterway_lookup = build_waterway_lookup(site.data['waterways'], current_locale)
      @craft_type_lookup = build_craft_type_lookup(site.data, current_locale)

      # Build set of non-navigable waterway slugs for obstacle filtering
      @non_navigable_waterway_slugs = Set.new
      if @waterway_lookup
        @waterway_lookup.each do |slug, ww|
          @non_navigable_waterway_slugs.add(slug) if ww['navigableByPaddlers'] == false
        end
      end

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
          next if collection_name == 'waterways' && entry['navigableByPaddlers'] == false
          next if collection_name == 'obstacles' && @non_navigable_waterway_slugs.include?(entry['waterway_slug'])

          doc = create_document(site, collection, entry, slug, config[:page_name], current_locale)
          collection.docs << doc
        end
      end
    end

    private

    def create_document(site, collection, entry, slug, page_name, current_locale = nil)
      current_locale ||= site.config['lang'] || site.config['default_lang'] || 'de'

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

      # Pre-compute per-document fields based on collection type
      case collection.label
      when 'spots'
        precompute_spot_fields(doc, entry, current_locale)
      when 'obstacles'
        precompute_obstacle_fields(doc, entry, current_locale)

        if entry['geometry']
          center = compute_geometry_center(entry['geometry'])
          if center
            doc.data['centerLat'] = center[:lat]
            doc.data['centerLon'] = center[:lon]
          end
        end

        # Resolve exit/re-entry spots for portage table
        resolve_obstacle_spots(doc, entry, site, current_locale)
      when 'waterways'
        precompute_waterway_notices(doc, entry, site, current_locale)
      when 'notices'
        precompute_notice_waterways(doc, entry, current_locale)
      end

      doc
    end

    # Resolve exit and re-entry spots for an obstacle from its spots array.
    # Identifies exit/re-entry spots by their spotType_slug.
    # Uses pre-built @locale_spots_by_slug hash for O(1) lookups.
    def resolve_obstacle_spots(doc, entry, site, locale)
      return if @locale_spots_by_slug.nil? || @locale_spots_by_slug.empty?

      linked_slugs = entry['spots'] || []
      return if linked_slugs.empty?

      exit_spot = nil
      reentry_spot = nil

      linked_slugs.each do |spot_slug|
        spot = @locale_spots_by_slug[spot_slug]
        next unless spot
        exit_spot ||= spot if spot['spotType_slug'] == 'nur-ausstieg'
        reentry_spot ||= spot if spot['spotType_slug'] == 'nur-einstieg'
      end

      doc.data['exitSpot_slug'] = exit_spot['slug'] if exit_spot
      doc.data['exitSpot_name'] = exit_spot['name'] if exit_spot
      doc.data['reentrySpot_slug'] = reentry_spot['slug'] if reentry_spot
      doc.data['reentrySpot_name'] = reentry_spot['name'] if reentry_spot
    end

    # Pre-compute spot-specific fields: type name, craft type names, icon, waterway name
    def precompute_spot_fields(doc, entry, locale)
      slug = entry['spotType_slug'] || entry['spot_type_slug']
      is_rejected = entry['rejected']

      # Spot type name
      if is_rejected
        doc.data['spot_type_name'] = get_translation(locale, 'spot_types.no_entry')
      else
        doc.data['spot_type_name'] = @type_lookup&.dig('spot_types', slug) || slug
      end

      # Paddle craft type names and slugs (resolved arrays)
      craft_slugs = entry['paddleCraftTypes'] || []
      doc.data['paddle_craft_type_names'] = craft_slugs.map { |cs| @craft_type_lookup&.[](cs) || cs }
      doc.data['paddle_craft_type_slugs'] = craft_slugs

      # Icon name and alt text
      icon = resolve_spot_icon(slug, is_rejected, locale)
      doc.data['spot_icon_name'] = icon[:name]
      doc.data['spot_icon_alt'] = icon[:alt]

      # Waterway name
      if entry['waterway_slug'] && @waterway_lookup&.[](entry['waterway_slug'])
        doc.data['waterway_name'] = @waterway_lookup[entry['waterway_slug']]['name']
      end
    end

    # Pre-compute obstacle-specific fields: type name, waterway name
    def precompute_obstacle_fields(doc, entry, locale)
      slug = entry['obstacleType_slug']
      doc.data['obstacle_type_name'] = @type_lookup&.dig('obstacle_types', slug) || slug if slug

      if entry['waterway_slug'] && @waterway_lookup&.[](entry['waterway_slug'])
        doc.data['waterway_name'] = @waterway_lookup[entry['waterway_slug']]['name']
      end
    end

    # Pre-compute active event notices for a waterway document
    def precompute_waterway_notices(doc, entry, site, locale)
      notices = site.data['notices']
      return unless notices.is_a?(Array)

      today = Date.today.strftime('%Y-%m-%d')
      waterway_slug = entry['slug']

      active = notices.select do |n|
        n['locale'] == locale &&
          n['endDate'] && n['endDate'].to_s >= today &&
          n['waterways']&.include?(waterway_slug)
      end

      doc.data['active_notices'] = active.map do |n|
        { 'name' => n['name'], 'slug' => n['slug'], 'endDate' => n['endDate'] }
      end
    end

    # Pre-compute resolved waterway objects for a notice document
    def precompute_notice_waterways(doc, entry, locale)
      ww_slugs = entry['waterways'] || []
      doc.data['notice_waterways'] = ww_slugs.filter_map do |slug|
        ww = @waterway_lookup&.[](slug)
        { 'name' => ww['name'], 'slug' => ww['slug'] } if ww
      end
    end

    # Compute the center point of a GeoJSON geometry by averaging all coordinates
    def compute_geometry_center(geometry_str)
      geometry = geometry_str.is_a?(String) ? JSON.parse(geometry_str) : geometry_str
      coords = extract_all_coordinates(geometry)
      return nil if coords.empty?

      avg_lon = coords.sum { |c| c[0] } / coords.size.to_f
      avg_lat = coords.sum { |c| c[1] } / coords.size.to_f
      { lat: avg_lat.round(6), lon: avg_lon.round(6) }
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
