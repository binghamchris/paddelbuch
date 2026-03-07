# Jekyll plugin to generate JSON API files at build time
# This plugin generates:
# - Fact tables: spots, obstacles, notices, protected-areas, waterways (per locale)
# - Dimension tables: spot types, obstacle types, etc. (per locale)
# - Last update index with timestamps for all tables
#
# Uses Jekyll::PageWithoutAFile so files are tracked by Jekyll and survive
# the cleanup phase (important for multi-language builds).

require 'json'

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
      @last_updates = {}

      generate_fact_tables
      generate_dimension_tables
      generate_last_update_index

      Jekyll.logger.info "API Generator:", "Generated JSON API files"
    end

    private

    def generate_fact_tables
      FACT_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_data_for_locale(config[:data_key], locale)
          
          if config[:exclude_rejected]
            data = data.reject { |item| item['rejected'] == true }
          end

          data = data.sort_by { |item| item['slug'].to_s.downcase }
          track_last_update("#{table_name}-#{locale}", data)
          add_json_page("#{table_name}-#{locale}.json", data)
        end
      end
    end

    def generate_dimension_tables
      DIMENSION_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_dimension_data(config[:data_key], locale)
          data = data.sort_by { |item| item['slug'].to_s.downcase }
          track_last_update("#{table_name}-#{locale}", data)
          add_json_page("#{table_name}-#{locale}.json", data)
        end
      end
    end

    def generate_last_update_index
      index_data = @last_updates.map do |table, timestamp|
        { 'table' => table, 'lastUpdatedAt' => timestamp }
      end.sort_by { |item| item['table'] }

      add_json_page('lastUpdateIndex.json', index_data)

      # Expose to Liquid so api.html can render timestamps at build time
      @site.data['last_updates'] = @last_updates.dup
    end

    def add_json_page(filename, data)
      page = PageWithoutAFile.new(@site, @site.source, 'api', filename)
      page.content = JSON.pretty_generate(data)
      page.data['layout'] = nil
      @site.pages << page
    end

    def get_data_for_locale(data_key, locale)
      data = resolve_data_key(data_key)
      return [] unless data

      if data.is_a?(Array)
        data.select { |item| item['locale'] == locale || item['node_locale'] == locale }
      elsif data.is_a?(Hash)
        data[locale] || []
      else
        []
      end
    end

    def get_dimension_data(data_key, locale)
      data = resolve_data_key(data_key)
      return [] unless data

      if data.is_a?(Array)
        seen = {}
        data.each_with_object([]) do |item, result|
          slug = item['slug']
          next if seen[slug]
          seen[slug] = true
          result << {
            'slug' => slug,
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
      latest = data.map { |item| item['updatedAt'] }.compact.max
      @last_updates[table_name] = latest if latest
    end
  end
end
