# Jekyll plugin to generate JSON API files at build time
# This plugin generates:
# - Fact tables: spots, obstacles, notices, protected-areas, waterways (per locale)
# - Dimension tables: spot types, obstacle types, etc. (per locale)
# - Last update index with timestamps for all tables

require 'json'
require 'fileutils'

module Jekyll
  class ApiGenerator < Generator
    safe true
    priority :low

    LOCALES = ['de', 'en'].freeze
    
    # Fact tables configuration
    FACT_TABLES = {
      'spots' => { data_key: 'spots', exclude_rejected: true },
      'obstacles' => { data_key: 'obstacles' },
      'notices' => { data_key: 'notices' },
      'protected-areas' => { data_key: 'protected_areas' },
      'waterways' => { data_key: 'waterways' }
    }.freeze

    # Dimension tables configuration
    DIMENSION_TABLES = {
      'spottypes' => { data_key: 'types/spot_types', content_type: 'spotType' },
      'obstacletypes' => { data_key: 'types/obstacle_types', content_type: 'obstacleType' },
      'paddlecrafttypes' => { data_key: 'types/paddle_craft_types', content_type: 'paddleCraftType' },
      'paddlingenvironmenttypes' => { data_key: 'types/paddling_environment_types', content_type: 'paddlingEnvironmentType' },
      'protectedareatypes' => { data_key: 'types/protected_area_types', content_type: 'protectedAreaType' },
      'datasourcetypes' => { data_key: 'types/data_source_types', content_type: 'dataSourceType' },
      'datalicensetypes' => { data_key: 'types/data_license_types', content_type: 'dataLicenseType' }
    }.freeze

    def generate(site)
      @site = site
      
      # Create api directory if it doesn't exist
      api_dir = File.join(site.dest, 'api')
      FileUtils.mkdir_p(api_dir)

      # Track last update times for each table
      @last_updates = {}

      # Generate fact table JSON files
      generate_fact_tables(api_dir)

      # Generate dimension table JSON files
      generate_dimension_tables(api_dir)

      # Generate last update index
      generate_last_update_index(api_dir)

      Jekyll.logger.info "API Generator:", "Generated JSON API files in #{api_dir}"
    end

    private

    def generate_fact_tables(api_dir)
      FACT_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_data_for_locale(config[:data_key], locale)
          
          # Filter out rejected spots if configured
          if config[:exclude_rejected]
            data = data.reject { |item| item['rejected'] == true }
          end

          # Sort by slug ascending
          data = data.sort_by { |item| item['slug'].to_s.downcase }

          # Track last update time
          track_last_update("#{table_name}-#{locale}", data)

          # Write JSON file
          filename = "#{table_name}-#{locale}.json"
          write_json_file(api_dir, filename, data)
          
          # Add as static file so Jekyll knows about it
          add_static_file(api_dir, filename)
        end
      end
    end

    def generate_dimension_tables(api_dir)
      DIMENSION_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_dimension_data(config[:data_key], locale)
          
          # Sort by slug ascending
          data = data.sort_by { |item| item['slug'].to_s.downcase }

          # Track last update time
          track_last_update("#{table_name}-#{locale}", data)

          # Write JSON file
          filename = "#{table_name}-#{locale}.json"
          write_json_file(api_dir, filename, data)
          
          # Add as static file
          add_static_file(api_dir, filename)
        end
      end
    end

    def generate_last_update_index(api_dir)
      # Build the last update index from tracked updates
      index_data = @last_updates.map do |table, timestamp|
        {
          'table' => table,
          'lastUpdatedAt' => timestamp
        }
      end.sort_by { |item| item['table'] }

      write_json_file(api_dir, 'lastUpdateIndex.json', index_data)
      add_static_file(api_dir, 'lastUpdateIndex.json')
    end

    def get_data_for_locale(data_key, locale)
      # Try to get data from site.data
      data = resolve_data_key(data_key)
      return [] unless data

      # Filter by locale if data has locale field
      if data.is_a?(Array)
        data.select { |item| item['locale'] == locale || item['node_locale'] == locale }
      elsif data.is_a?(Hash)
        # If data is organized by locale
        data[locale] || []
      else
        []
      end
    end

    def get_dimension_data(data_key, locale)
      data = resolve_data_key(data_key)
      return [] unless data

      # For dimension tables, transform to include locale-specific name
      if data.is_a?(Array)
        data.map do |item|
          {
            'slug' => item['slug'],
            'name' => item["name_#{locale}"] || item['name'],
            'createdAt' => item['createdAt'],
            'updatedAt' => item['updatedAt']
          }
        end
      else
        []
      end
    end

    def resolve_data_key(data_key)
      # Handle nested data keys like 'types/spot_types'
      keys = data_key.split('/')
      data = @site.data
      
      keys.each do |key|
        return nil unless data.is_a?(Hash)
        data = data[key]
      end
      
      data
    end

    def track_last_update(table_name, data)
      return if data.empty?

      # Find the most recent updatedAt timestamp
      latest = data
        .map { |item| item['updatedAt'] }
        .compact
        .max

      @last_updates[table_name] = latest if latest
    end

    def write_json_file(dir, filename, data)
      filepath = File.join(dir, filename)
      File.write(filepath, JSON.pretty_generate(data))
      Jekyll.logger.debug "API Generator:", "Wrote #{filepath}"
    end

    def add_static_file(dir, filename)
      # Create a static file entry so Jekyll includes it in the build
      @site.static_files << Jekyll::StaticFile.new(
        @site,
        @site.dest,
        '/api',
        filename
      )
    end
  end
end
