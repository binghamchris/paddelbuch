# frozen_string_literal: true

# Jekyll plugin to generate spatial tile files at build time
# This plugin generates:
# - Spatial tiles for viewport-based map data loading
# - Tile index files with bounds information
# - Separate tile sets for each locale and layer type
#
# Uses Jekyll::PageWithoutAFile so files are tracked by Jekyll and survive
# the cleanup phase (important for multi-language builds).
#
# Requirements: 15.1, 15.2, 15.3, 15.4, 15.5

require 'json'
require_relative 'generator_cache'

module Jekyll
  class TileGenerator < Generator
    include GeneratorCache

    safe true
    priority :low

    LOCALES = ['de', 'en'].freeze
    
    SWITZERLAND_BOUNDS = {
      north: 47.8,
      south: 45.8,
      east: 10.5,
      west: 5.9
    }.freeze

    TILE_SIZE = {
      lat: 0.25,
      lon: 0.46
    }.freeze

    LAYERS = {
      'spots' => {
        data_key: 'spots',
        location_type: :point,
        exclude_rejected: false,
        fields: [:slug, :name, :location, :spotType_slug, :description, :approximateAddress, :paddleCraftTypes, :rejected]
      },
      'notices' => {
        data_key: 'notices',
        location_type: :point,
        fields: [:slug, :name, :location, :description, :startDate, :endDate, :affectedArea]
      },
      'obstacles' => {
        data_key: 'obstacles',
        location_type: :geometry,
        fields: [:slug, :name, :geometry, :portageRoute, :isPortagePossible, :obstacleType_slug]
      },
      'protected' => {
        data_key: 'protected_areas',
        location_type: :geometry,
        fields: [:slug, :name, :geometry, :protectedAreaType_slug]
      }
    }.freeze

    def generate(site)
      @site = site

      # Skip duplicate runs -- with parallel_localization: true, Jekyll runs all
      # generators once per language. This generator already handles both locales
      # internally, so only run during the default-language pass.
      default_lang = site.config['default_lang'] || 'de'
      current_lang = site.config['lang'] || default_lang
      if current_lang != default_lang
        Jekyll.logger.info "Tile Generator:", "Skipping (already generated during #{default_lang} pass)"
        return
      end

      data_changed = site.config.fetch('contentful_data_changed', true)
      cache_dir = File.join(site.source, '_data', '.tile_cache')

      # Attempt cache hit when data hasn't changed
      cache_hit = false
      if !data_changed && cache_available?(cache_dir)
        begin
          load_tile_from_cache(site, cache_dir)
          cache_hit = true
        rescue => e
          Jekyll.logger.warn "Tile Generator:", "Corrupted cache file: #{e.message} -- falling back to full generation"
          clear_cache(cache_dir)
        end
      end

      return if cache_hit

      # Log the appropriate message for the generation path
      if !data_changed
        Jekyll.logger.info "Tile Generator:", "Cache empty/missing -- performing full generation"
      else
        Jekyll.logger.info "Tile Generator:", "Generating spatial tile files"
      end

      # Full generation with cache writing
      @cache_dir = cache_dir
      clear_cache(cache_dir)

      @grid_cols = ((SWITZERLAND_BOUNDS[:east] - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).ceil
      @grid_rows = ((SWITZERLAND_BOUNDS[:north] - SWITZERLAND_BOUNDS[:south]) / TILE_SIZE[:lat]).ceil
      @locale_cache = {}

      Jekyll.logger.info "Tile Generator:", "Generating #{@grid_cols}x#{@grid_rows} tile grid"

      LAYERS.each do |layer_name, config|
        LOCALES.each do |locale|
          generate_layer_tiles(layer_name, config, locale)
        end
      end

      Jekyll.logger.info "Tile Generator:", "Spatial tile generation complete"

      @cache_dir = nil
    end

    private

    def generate_layer_tiles(layer_name, config, locale)
      data = get_data_for_locale(@site.data, config[:data_key], locale, @locale_cache)
      
      if config[:exclude_rejected]
        data = data.reject { |item| item['rejected'] == true }
      end

      # Initialize tile buckets
      tiles = {}
      (0...@grid_cols).each do |x|
        (0...@grid_rows).each do |y|
          tiles["#{x}_#{y}"] = []
        end
      end

      # Assign each data item to its tile
      data.each do |item|
        tile_coords = get_tile_for_item(item, config[:location_type])
        next unless tile_coords
        x, y = tile_coords
        tile_key = "#{x}_#{y}"
        tiles[tile_key] << extract_tile_data(item, config[:fields]) if tiles.key?(tile_key)
      end

      # Generate tile index
      tile_index = generate_tile_index(tiles, layer_name)
      dir = "api/tiles/#{layer_name}/#{locale}"
      add_json_page(dir, 'index.json', tile_index)

      # Generate individual tile files (only non-empty)
      tiles.each do |tile_key, tile_data|
        next if tile_data.empty?
        x, y = tile_key.split('_').map(&:to_i)
        tile_content = {
          'tile' => { 'x' => x, 'y' => y },
          'bounds' => get_tile_bounds(x, y),
          'data' => tile_data.sort_by { |item| item['slug'].to_s.downcase }
        }
        add_json_page(dir, "#{tile_key}.json", tile_content)
      end
    end

    def load_tile_from_cache(site, cache_dir)
      cached_files = read_cache_files(cache_dir)
      cached_files.each do |entry|
        relative_path = entry[:relative_path]
        content = entry[:content]

        dir = File.dirname(relative_path)
        filename = File.basename(relative_path)

        page = PageWithoutAFile.new(site, site.source, dir, filename)
        page.content = content
        page.data['layout'] = nil
        site.pages << page
      end

      Jekyll.logger.info "Tile Generator:", "Using cached tile files (#{cached_files.size} files loaded)"
    end

    def add_json_page(dir, filename, data)
      page = PageWithoutAFile.new(@site, @site.source, dir, filename)
      json_content = JSON.pretty_generate(data)
      page.content = json_content
      page.data['layout'] = nil
      @site.pages << page

      # Write to cache during fresh generation
      relative_path = File.join(dir, filename)
      write_cache_file(@cache_dir, relative_path, json_content) if @cache_dir
    end

    def get_tile_for_item(item, location_type)
      case location_type
      when :point then get_tile_for_point(item)
      when :geometry then get_tile_for_geometry(item)
      end
    end

    def get_tile_for_point(item)
      location = item['location']
      return nil unless location && location['lat'] && location['lon']
      lat = location['lat'].to_f
      lon = location['lon'].to_f
      return nil unless point_in_bounds?(lat, lon)
      x = ((lon - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).floor
      y = ((SWITZERLAND_BOUNDS[:north] - lat) / TILE_SIZE[:lat]).floor
      x = [[x, 0].max, @grid_cols - 1].min
      y = [[y, 0].max, @grid_rows - 1].min
      [x, y]
    end

    def get_tile_for_geometry(item)
      geometry = item['geometry']
      return nil unless geometry
      geojson = geometry.is_a?(String) ? JSON.parse(geometry) : geometry
      centroid = calculate_centroid(geojson)
      return nil unless centroid
      lat, lon = centroid
      return nil unless point_in_bounds?(lat, lon)
      x = ((lon - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).floor
      y = ((SWITZERLAND_BOUNDS[:north] - lat) / TILE_SIZE[:lat]).floor
      x = [[x, 0].max, @grid_cols - 1].min
      y = [[y, 0].max, @grid_rows - 1].min
      [x, y]
    rescue JSON::ParserError
      nil
    end

    def calculate_centroid(geojson)
      coords = extract_coordinates(geojson)
      return nil if coords.empty?
      sum_lat = 0.0
      sum_lon = 0.0
      count = 0
      coords.each do |coord|
        sum_lon += coord[0]
        sum_lat += coord[1]
        count += 1
      end
      return nil if count == 0
      [sum_lat / count, sum_lon / count]
    end

    def extract_coordinates(geojson)
      coords = []
      case geojson['type']
      when 'Point'
        coords << geojson['coordinates'] if geojson['coordinates']
      when 'LineString', 'MultiPoint'
        coords.concat(geojson['coordinates'] || [])
      when 'Polygon'
        (geojson['coordinates'] || []).each { |ring| coords.concat(ring) }
      when 'MultiLineString', 'MultiPolygon'
        (geojson['coordinates'] || []).each do |part|
          part.each do |ring|
            if ring.is_a?(Array) && ring.first.is_a?(Array)
              coords.concat(ring)
            else
              coords << ring
            end
          end
        end
      when 'GeometryCollection'
        (geojson['geometries'] || []).each { |geom| coords.concat(extract_coordinates(geom)) }
      when 'Feature'
        coords.concat(extract_coordinates(geojson['geometry'])) if geojson['geometry']
      when 'FeatureCollection'
        (geojson['features'] || []).each { |feature| coords.concat(extract_coordinates(feature)) }
      end
      coords
    end

    def point_in_bounds?(lat, lon)
      lat >= SWITZERLAND_BOUNDS[:south] && lat <= SWITZERLAND_BOUNDS[:north] &&
        lon >= SWITZERLAND_BOUNDS[:west] && lon <= SWITZERLAND_BOUNDS[:east]
    end

    def get_tile_bounds(x, y)
      {
        'north' => SWITZERLAND_BOUNDS[:north] - (y * TILE_SIZE[:lat]),
        'south' => SWITZERLAND_BOUNDS[:north] - ((y + 1) * TILE_SIZE[:lat]),
        'east' => SWITZERLAND_BOUNDS[:west] + ((x + 1) * TILE_SIZE[:lon]),
        'west' => SWITZERLAND_BOUNDS[:west] + (x * TILE_SIZE[:lon])
      }
    end

    def generate_tile_index(tiles, layer_name)
      tile_entries = tiles.map do |tile_key, tile_data|
        x, y = tile_key.split('_').map(&:to_i)
        { 'x' => x, 'y' => y, 'count' => tile_data.size, 'bounds' => get_tile_bounds(x, y) }
      end.select { |t| t['count'] > 0 }

      {
        'layer' => layer_name,
        'gridSize' => { 'cols' => @grid_cols, 'rows' => @grid_rows },
        'bounds' => {
          'north' => SWITZERLAND_BOUNDS[:north], 'south' => SWITZERLAND_BOUNDS[:south],
          'east' => SWITZERLAND_BOUNDS[:east], 'west' => SWITZERLAND_BOUNDS[:west]
        },
        'tileSize' => { 'lat' => TILE_SIZE[:lat], 'lon' => TILE_SIZE[:lon] },
        'tiles' => tile_entries.sort_by { |t| [t['x'], t['y']] }
      }
    end

    def extract_tile_data(item, fields)
      result = {}
      fields.each do |field|
        field_str = field.to_s
        value = item[field_str]
        case field
        when :description
          result['description_excerpt'] = extract_excerpt(value)
        when :paddleCraftTypes
          result[field_str] = value.is_a?(Array) ? value : []
        else
          result[field_str] = value
        end
      end
      result
    end

    def extract_excerpt(description)
      return nil unless description.is_a?(String)
      text = description.gsub(/<[^>]+>/, ' ').gsub(/\s+/, ' ').strip
      text.length > 200 ? "#{text[0..197]}..." : text
    end


  end
end
