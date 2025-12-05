# Jekyll plugin to generate spatial tile files at build time
# This plugin generates:
# - Spatial tiles for viewport-based map data loading
# - Tile index files with bounds information
# - Separate tile sets for each locale and layer type
#
# Requirements: 15.1, 15.2, 15.3, 15.4, 15.5

require 'json'
require 'fileutils'

module Jekyll
  class TileGenerator < Generator
    safe true
    priority :low

    LOCALES = ['de', 'en'].freeze
    
    # Switzerland bounds from _config.yml
    SWITZERLAND_BOUNDS = {
      north: 47.8,
      south: 45.8,
      east: 10.5,
      west: 5.9
    }.freeze

    # Approximate 10km x 10km tiles
    # At Swiss latitudes (~46-48°N), 1° latitude ≈ 111km, 1° longitude ≈ 75km
    # So for ~10km tiles: lat_step ≈ 0.09, lon_step ≈ 0.133
    # Using slightly larger tiles for practical grid: 0.25° lat x 0.46° lon (~28km x 35km)
    # This gives us a manageable grid of approximately 8 rows x 10 cols
    TILE_SIZE = {
      lat: 0.25,
      lon: 0.46
    }.freeze

    # Layer configurations with data source and location extraction
    LAYERS = {
      'spots' => {
        data_key: 'spots',
        location_type: :point,
        exclude_rejected: false,  # Include all spots in tiles (rejected shown differently)
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
      
      # Calculate grid dimensions
      @grid_cols = ((SWITZERLAND_BOUNDS[:east] - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).ceil
      @grid_rows = ((SWITZERLAND_BOUNDS[:north] - SWITZERLAND_BOUNDS[:south]) / TILE_SIZE[:lat]).ceil

      Jekyll.logger.info "Tile Generator:", "Generating #{@grid_cols}x#{@grid_rows} tile grid"

      # Generate tiles for each layer and locale
      LAYERS.each do |layer_name, config|
        LOCALES.each do |locale|
          generate_layer_tiles(layer_name, config, locale)
        end
      end

      Jekyll.logger.info "Tile Generator:", "Spatial tile generation complete"
    end

    private

    def generate_layer_tiles(layer_name, config, locale)
      # Create directory structure
      tiles_dir = File.join(@site.dest, 'api', 'tiles', layer_name, locale)
      FileUtils.mkdir_p(tiles_dir)

      # Get data for this layer and locale
      data = get_data_for_locale(config[:data_key], locale)
      
      # Filter rejected spots if configured
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

      # Assign each data item to exactly one tile based on its location
      data.each do |item|
        tile_coords = get_tile_for_item(item, config[:location_type])
        next unless tile_coords

        x, y = tile_coords
        tile_key = "#{x}_#{y}"
        
        # Only add if within grid bounds
        if tiles.key?(tile_key)
          tiles[tile_key] << extract_tile_data(item, config[:fields])
        end
      end

      # Generate tile index
      tile_index = generate_tile_index(tiles, layer_name)
      write_json_file(tiles_dir, 'index.json', tile_index)
      add_static_file('api/tiles', "#{layer_name}/#{locale}/index.json")

      # Generate individual tile files (only for non-empty tiles)
      tiles.each do |tile_key, tile_data|
        next if tile_data.empty?

        x, y = tile_key.split('_').map(&:to_i)
        tile_bounds = get_tile_bounds(x, y)
        
        tile_content = {
          'tile' => { 'x' => x, 'y' => y },
          'bounds' => tile_bounds,
          'data' => tile_data.sort_by { |item| item['slug'].to_s.downcase }
        }

        filename = "#{tile_key}.json"
        write_json_file(tiles_dir, filename, tile_content)
        add_static_file('api/tiles', "#{layer_name}/#{locale}/#{filename}")
      end

      Jekyll.logger.debug "Tile Generator:", "Generated tiles for #{layer_name}/#{locale}"
    end

    def get_tile_for_item(item, location_type)
      case location_type
      when :point
        get_tile_for_point(item)
      when :geometry
        get_tile_for_geometry(item)
      end
    end

    def get_tile_for_point(item)
      location = item['location']
      return nil unless location && location['lat'] && location['lon']

      lat = location['lat'].to_f
      lon = location['lon'].to_f

      # Check if within Switzerland bounds
      return nil unless point_in_bounds?(lat, lon)

      # Calculate tile coordinates
      x = ((lon - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).floor
      y = ((SWITZERLAND_BOUNDS[:north] - lat) / TILE_SIZE[:lat]).floor

      # Clamp to grid bounds
      x = [[x, 0].max, @grid_cols - 1].min
      y = [[y, 0].max, @grid_rows - 1].min

      [x, y]
    end

    def get_tile_for_geometry(item)
      geometry = item['geometry']
      return nil unless geometry

      # Parse GeoJSON if it's a string
      geojson = geometry.is_a?(String) ? JSON.parse(geometry) : geometry
      
      # Get centroid of geometry for tile assignment
      centroid = calculate_centroid(geojson)
      return nil unless centroid

      lat, lon = centroid

      # Check if within Switzerland bounds
      return nil unless point_in_bounds?(lat, lon)

      # Calculate tile coordinates
      x = ((lon - SWITZERLAND_BOUNDS[:west]) / TILE_SIZE[:lon]).floor
      y = ((SWITZERLAND_BOUNDS[:north] - lat) / TILE_SIZE[:lat]).floor

      # Clamp to grid bounds
      x = [[x, 0].max, @grid_cols - 1].min
      y = [[y, 0].max, @grid_rows - 1].min

      [x, y]
    rescue JSON::ParserError
      nil
    end

    def calculate_centroid(geojson)
      coords = extract_coordinates(geojson)
      return nil if coords.empty?

      # Calculate average of all coordinates
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
        (geojson['coordinates'] || []).each do |ring|
          coords.concat(ring)
        end
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
        (geojson['geometries'] || []).each do |geom|
          coords.concat(extract_coordinates(geom))
        end
      when 'Feature'
        coords.concat(extract_coordinates(geojson['geometry'])) if geojson['geometry']
      when 'FeatureCollection'
        (geojson['features'] || []).each do |feature|
          coords.concat(extract_coordinates(feature))
        end
      end

      coords
    end

    def point_in_bounds?(lat, lon)
      lat >= SWITZERLAND_BOUNDS[:south] &&
        lat <= SWITZERLAND_BOUNDS[:north] &&
        lon >= SWITZERLAND_BOUNDS[:west] &&
        lon <= SWITZERLAND_BOUNDS[:east]
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
        {
          'x' => x,
          'y' => y,
          'count' => tile_data.size,
          'bounds' => get_tile_bounds(x, y)
        }
      end.select { |t| t['count'] > 0 }

      {
        'layer' => layer_name,
        'gridSize' => { 'cols' => @grid_cols, 'rows' => @grid_rows },
        'bounds' => {
          'north' => SWITZERLAND_BOUNDS[:north],
          'south' => SWITZERLAND_BOUNDS[:south],
          'east' => SWITZERLAND_BOUNDS[:east],
          'west' => SWITZERLAND_BOUNDS[:west]
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
          # Extract first paragraph as excerpt
          result['description_excerpt'] = extract_excerpt(value)
        when :paddleCraftTypes
          # Ensure it's an array
          result[field_str] = value.is_a?(Array) ? value : []
        else
          result[field_str] = value
        end
      end

      result
    end

    def extract_excerpt(description)
      return nil unless description
      
      # If it's HTML, extract first paragraph
      if description.is_a?(String)
        # Remove HTML tags and get first paragraph
        text = description.gsub(/<[^>]+>/, ' ').gsub(/\s+/, ' ').strip
        # Limit to ~200 characters
        text.length > 200 ? "#{text[0..197]}..." : text
      else
        nil
      end
    end

    def get_data_for_locale(data_key, locale)
      data = @site.data[data_key]
      return [] unless data

      if data.is_a?(Array)
        data.select { |item| item['locale'] == locale || item['node_locale'] == locale }
      elsif data.is_a?(Hash)
        data[locale] || []
      else
        []
      end
    end

    def write_json_file(dir, filename, data)
      filepath = File.join(dir, filename)
      File.write(filepath, JSON.pretty_generate(data))
    end

    def add_static_file(base_path, relative_path)
      # Create a static file entry so Jekyll includes it in the build
      dir = File.dirname(relative_path)
      name = File.basename(relative_path)
      
      @site.static_files << Jekyll::StaticFile.new(
        @site,
        @site.dest,
        "/#{base_path}/#{dir}",
        name
      )
    end
  end
end
