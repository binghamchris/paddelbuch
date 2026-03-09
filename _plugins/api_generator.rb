# Jekyll plugin to generate JSON API files at build time
# This plugin generates:
# - Fact tables: spots, obstacles, notices, protected-areas, waterways (per locale)
# - Dimension tables: spot types, obstacle types, etc. (per locale)
# - Last update index with timestamps for all tables
#
# Uses Jekyll::PageWithoutAFile so files are tracked by Jekyll and survive
# the cleanup phase (important for multi-language builds).

require 'json'
require_relative 'generator_cache'

module Jekyll
  class ApiGenerator < Generator
    include GeneratorCache

    safe true
    priority :low

    LOCALES = ['de', 'en'].freeze
    
    # Fact tables configuration
    FACT_TABLES = {
      'spots' => { data_key: 'spots', exclude_rejected: true },
      'obstacles' => { data_key: 'obstacles' },
      'waterwayevents' => { data_key: 'notices' },
      'protectedareas' => { data_key: 'protected_areas' },
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

    # Mapping from internal content type keys to camelCase names with 's' suffix
    # used in lastUpdateIndex.json
    CONTENT_TYPE_NAMES = {
      'spots' => 'spots',
      'obstacles' => 'obstacles',
      'waterwayevents' => 'waterwayEventNotices',
      'protectedareas' => 'protectedAreas',
      'waterways' => 'waterways',
      'datalicensetypes' => 'dataLicenseTypes',
      'datasourcetypes' => 'dataSourceTypes',
      'obstacletypes' => 'obstacleTypes',
      'paddlecrafttypes' => 'paddleCraftTypes',
      'protectedareatypes' => 'protectedAreaTypes',
      'spottypes' => 'spotTypes',
      'paddlingenvironmenttypes' => 'paddlingEnvironmentTypes'
    }.freeze

    def generate(site)
      @site = site

      # Skip duplicate runs — with parallel_localization: true, Jekyll runs all
      # generators once per language. This generator already handles both locales
      # internally, so only run during the default-language pass.
      # However, site.data['last_updates'] must be set on every pass so Liquid
      # templates can render timestamps regardless of the current language.
      default_lang = site.config['default_lang'] || 'de'
      current_lang = site.config['lang'] || default_lang
      if current_lang != default_lang
        # Re-expose cached last_updates for Liquid templates in this language pass
        site.data['last_updates'] = @@cached_last_updates.dup if defined?(@@cached_last_updates) && @@cached_last_updates
        Jekyll.logger.info "API Generator:", "Skipping (already generated during #{default_lang} pass)"
        return
      end

      data_changed = site.config.fetch('contentful_data_changed', true)
      cache_dir = File.join(site.source, '_data', '.api_cache')

      # Attempt cache hit when data hasn't changed
      cache_hit = false
      if !data_changed && cache_available?(cache_dir)
        begin
          load_api_from_cache(site, cache_dir)
          cache_hit = true
        rescue => e
          Jekyll.logger.warn "API Generator:", "Corrupted cache file: #{e.message} — falling back to full generation"
          clear_cache(cache_dir)
        end
      end

      return if cache_hit

      # Log the appropriate message for the generation path
      if !data_changed
        Jekyll.logger.info "API Generator:", "Cache empty/missing — performing full generation"
      else
        Jekyll.logger.info "API Generator:", "Generating JSON API files"
      end

      # Full generation with cache writing
      @cache_dir = cache_dir
      clear_cache(cache_dir)

      @last_updates = {}
      @timestamp_cache = {}
      @locale_cache = {}

      generate_fact_tables
      generate_dimension_tables
      generate_last_update_index

      @cache_dir = nil
    end

    private

    # Mapping from fact table keys to their transformer method names
    FACT_TABLE_TRANSFORMERS = {
      'spots' => :transform_spot,
      'obstacles' => :transform_obstacle,
      'waterwayevents' => :transform_waterway_event,
      'protectedareas' => :transform_protected_area,
      'waterways' => :transform_waterway
    }.freeze

    def generate_fact_tables
      FACT_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_data_for_locale(config[:data_key], locale)
          
          if config[:exclude_rejected]
            data = data.reject { |item| item['rejected'] == true }
          end

          data = data.sort_by { |item| item['slug'].to_s.downcase }

          # Track last update and transform in a single pass
          transformer = FACT_TABLE_TRANSFORMERS[table_name]
          latest_ts = nil
          transformed_data = data.map do |item|
            ts = item['updatedAt']
            if ts && (latest_ts.nil? || ts > latest_ts)
              latest_ts = ts
            end
            send(transformer, item)
          end

          if latest_ts
            normalized = normalize_to_contentful_timestamp(latest_ts)
            if @last_updates[table_name].nil? || normalized > @last_updates[table_name]
              @last_updates[table_name] = normalized
            end
          end

          add_json_page("#{table_name}-#{locale}.json", transformed_data)
        end
      end
    end

    def generate_dimension_tables
      DIMENSION_TABLES.each do |table_name, config|
        LOCALES.each do |locale|
          data = get_dimension_data(config[:data_key], locale)
          data = data.sort_by { |item| item['slug'].to_s.downcase }

          # Track last update and transform in a single pass
          latest_ts = nil
          transformed_data = data.map do |item|
            ts = item['updatedAt']
            if ts && (latest_ts.nil? || ts > latest_ts)
              latest_ts = ts
            end
            transform_dimension_entry(item, locale, table_name)
          end

          if latest_ts
            normalized = normalize_to_contentful_timestamp(latest_ts)
            if @last_updates[table_name].nil? || normalized > @last_updates[table_name]
              @last_updates[table_name] = normalized
            end
          end

          add_json_page("#{table_name}-#{locale}.json", transformed_data)
        end
      end
    end

    def generate_last_update_index
      # Map internal keys to camelCase content type names for the index
      camel_updates = {}
      @last_updates.each do |key, timestamp|
        camel_name = CONTENT_TYPE_NAMES[key] || key
        camel_updates[camel_name] = timestamp
      end

      index_data = camel_updates.map do |table, timestamp|
        { 'table' => table, 'lastUpdatedAt' => timestamp }
      end.sort_by { |item| item['table'] }

      add_json_page('lastUpdateIndex.json', index_data)

      # Expose to Liquid so api.html can render timestamps at build time
      @site.data['last_updates'] = camel_updates.dup

      # Cache for reuse during non-default language passes
      @@cached_last_updates = camel_updates.dup
    end

    def load_api_from_cache(site, cache_dir)
      cached_files = read_cache_files(cache_dir)
      cached_files.each do |entry|
        filename = entry[:relative_path]
        content = entry[:content]

        page = PageWithoutAFile.new(site, site.source, 'api', filename)
        page.content = content
        page.data['layout'] = nil
        site.pages << page

        # Reconstruct last_updates from the cached lastUpdateIndex.json
        if filename == 'lastUpdateIndex.json'
          index_data = JSON.parse(content)
          camel_updates = {}
          index_data.each do |entry_item|
            camel_updates[entry_item['table']] = entry_item['lastUpdatedAt']
          end
          site.data['last_updates'] = camel_updates.dup
          @@cached_last_updates = camel_updates.dup
        end
      end

      Jekyll.logger.info "API Generator:", "Using cached API files (#{cached_files.size} files loaded)"
    end

    def add_json_page(filename, data)
      page = PageWithoutAFile.new(@site, @site.source, 'api', filename)
      json_content = JSON.generate(data)
      page.content = json_content
      page.data['layout'] = nil
      @site.pages << page

      # Write to cache during fresh generation
      write_cache_file(@cache_dir, filename, json_content) if @cache_dir
    end

    def get_data_for_locale(data_key, locale)
      cache_key = "#{data_key}:#{locale}"
      return @locale_cache[cache_key] if @locale_cache.key?(cache_key)

      data = resolve_data_key(data_key)
      result = if data.is_a?(Array)
                 data.select { |item| item['locale'] == locale || item['node_locale'] == locale }
               elsif data.is_a?(Hash)
                 data[locale] || []
               else
                 []
               end

      @locale_cache[cache_key] = result
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
          entry = {
            'slug' => slug,
            'name' => item["name_#{locale}"] || item['name'],
            'createdAt' => item['createdAt'],
            'updatedAt' => item['updatedAt']
          }
          # Pass through type-specific fields when present
          entry['_raw_description'] = item['_raw_description'] if item.key?('_raw_description')
          entry['summaryUrl'] = item['summaryUrl'] if item.key?('summaryUrl')
          entry['fullTextUrl'] = item['fullTextUrl'] if item.key?('fullTextUrl')
          result << entry
        end
      else
        []
      end
    end

    def resolve_data_key(data_key)
      return @data_key_cache[data_key] if @data_key_cache&.key?(data_key)
      @data_key_cache ||= {}

      keys = data_key.split('/')
      data = @site.data
      keys.each do |key|
        return nil unless data.is_a?(Hash)
        data = data[key]
      end
      @data_key_cache[data_key] = data
    end

    # Normalize any timestamp string to ISO 8601 with Z suffix: "YYYY-MM-DDTHH:MM:SSZ"
    # Handles inputs like "2023-11-23T09:32:56+00:00" or "2023-11-23T09:32:56.000Z"
    # Results are memoized since the same timestamps appear across many items.
    def normalize_to_contentful_timestamp(ts)
      return ts if ts.nil?
      return @timestamp_cache[ts] if @timestamp_cache.key?(ts)

      result = if ts.match?(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\z/)
                 ts
               else
                 time = ts.is_a?(Time) ? ts : Time.parse(ts.to_s)
                 time.utc.strftime('%Y-%m-%dT%H:%M:%SZ')
               end
      @timestamp_cache[ts] = result
    rescue ArgumentError
      @timestamp_cache[ts] = ts.to_s
    end

    # Convert timestamps to Contentful-style ISO 8601 with milliseconds and Z suffix
    # e.g. "2025-11-23T11:39:50+00:00" => "2025-11-23T11:39:50.000Z"
    def normalize_timestamp(ts)
      return ts if ts.nil?
      time = ts.is_a?(Time) ? ts : Time.parse(ts.to_s)
      time.utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    rescue ArgumentError
      ts.to_s
    end

    # Return the timestamp with Z suffix. Prefers _raw key, falls back to regular key.
    def raw_timestamp(item, raw_key, fallback_key)
      raw = item[raw_key]
      return normalize_to_contentful_timestamp(raw) unless raw.nil? || raw.to_s.strip.empty?

      ts = item[fallback_key]
      return nil if ts.nil? || ts.to_s.strip.empty?

      normalize_to_contentful_timestamp(ts)
    end

    # -------------------------------------------------------------------------
    # Fact table transformer helpers
    # -------------------------------------------------------------------------

    EMPTY_DOCUMENT_JSON = '{"data":{},"content":[],"nodeType":"document"}'.freeze

    # Wrap a raw rich text JSON string in the Gatsby {"raw": "..."} structure.
    # Returns {"raw": empty_document_json} when the raw value is nil or empty.
    def wrap_raw_description(raw_json)
      if raw_json.nil? || raw_json.to_s.strip.empty?
        { 'raw' => EMPTY_DOCUMENT_JSON }
      else
        { 'raw' => raw_json }
      end
    end

    # Wrap a raw rich text JSON string for fields where null is acceptable
    # (e.g. protected area description). Returns nil when raw is nil.
    def wrap_raw_description_nullable(raw_json)
      return nil if raw_json.nil?
      raw_json.to_s.strip.empty? ? nil : { 'raw' => raw_json }
    end

    # Wrap a JSON string in the Gatsby {"internal": {"content": "..."}} structure.
    # Returns nil when the value is nil.
    def wrap_internal_content(json_string)
      return nil if json_string.nil?
      { 'internal' => { 'content' => json_string } }
    end

    # Wrap a single slug string in a {"slug": "..."} object. Returns nil if slug is nil.
    def wrap_slug_ref(slug)
      return nil if slug.nil?
      { 'slug' => slug }
    end

    # Convert an array of slug strings to an array of {"slug": "..."} objects.
    # Returns nil when the array is nil or empty.
    def wrap_slug_refs(slugs)
      return nil if slugs.nil? || slugs.empty?
      slugs.map { |s| { 'slug' => s } }
    end

    # -------------------------------------------------------------------------
    # Fact table transformers — convert flattened YAML hashes to Gatsby structure
    # These create NEW hashes and do NOT mutate the source item.
    # -------------------------------------------------------------------------

    def transform_spot(item)
      event_notices = item['eventNotices']
      waterway_event_notice = if event_notices.nil? || event_notices.empty?
                                nil
                              else
                                event_notices.map do |en_item|
                                  if en_item.is_a?(Hash)
                                    { 'slug' => en_item['slug'], 'startDate' => en_item['startDate'], 'endDate' => en_item['endDate'] }
                                  else
                                    { 'slug' => en_item }
                                  end
                                end
                              end

      obstacles_arr = item['obstacles']
      obstacle = if obstacles_arr.nil? || obstacles_arr.empty?
                   nil
                 else
                   obstacles_arr.map { |s| { 'slug' => s } }
                 end

      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = item['locale']
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']
      result['description'] = wrap_raw_description(item['_raw_description'])
      result['location'] = item['location']
      result['approximateAddress'] = item['approximateAddress'].nil? ? nil : { 'approximateAddress' => item['approximateAddress'] }
      result['country'] = item['country']
      result['confirmed'] = item['confirmed']
      result['rejected'] = item['rejected']
      result['waterway'] = wrap_slug_ref(item['waterway_slug'])
      result['spotType'] = wrap_slug_ref(item['spotType_slug'])
      result['paddlingEnvironmentType'] = wrap_slug_ref(item['paddlingEnvironmentType_slug'])
      result['paddleCraftType'] = wrap_slug_refs(item['paddleCraftTypes']) || []
      result['waterway_event_notice'] = waterway_event_notice
      result['obstacle'] = obstacle
      result['dataSourceType'] = wrap_slug_ref(item['dataSourceType_slug'])
      result['dataLicenseType'] = wrap_slug_ref(item['dataLicenseType_slug'])
      result
    end

    def transform_obstacle(item)
      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = item['locale']
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']
      result['description'] = wrap_raw_description(item['_raw_description'])
      result['geometry'] = wrap_internal_content(item['geometry'])
      result['portageRoute'] = wrap_internal_content(item['portageRoute'])
      result['portageDistance'] = item['portageDistance']
      result['portageDescription'] = wrap_raw_description(item['_raw_portageDescription'])
      result['isPortageNecessary'] = item['isPortageNecessary']
      result['isPortagePossible'] = item['isPortagePossible']
      result['obstacleType'] = wrap_slug_ref(item['obstacleType_slug'])
      result['waterway'] = wrap_slug_ref(item['waterway_slug'])
      result['dataSourceType'] = wrap_slug_ref(item['dataSourceType_slug'])
      result['dataLicenseType'] = wrap_slug_ref(item['dataLicenseType_slug'])
      result
    end

    def transform_waterway_event(item)
      waterways = item['waterways']
      waterway = wrap_slug_refs(waterways) || []

      spots = item['spot']
      spot = if spots.nil? || spots.empty?
               nil
             else
               spots.map { |s| { 'slug' => s } }
             end

      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = item['locale']
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']
      result['description'] = wrap_raw_description(item['_raw_description'])
      result['affectedArea'] = wrap_internal_content(item['affectedArea'])
      result['startDate'] = item['startDate']&.to_s&.slice(0, 10)
      result['endDate'] = item['endDate']&.to_s&.slice(0, 10)
      result['waterway'] = waterway
      result['spot'] = spot
      result['dataSourceType'] = wrap_slug_ref(item['dataSourceType_slug'])
      result['dataLicenseType'] = wrap_slug_ref(item['dataLicenseType_slug'])
      result
    end

    def transform_waterway(item)
      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = item['locale']
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']
      result['length'] = item['length']
      result['area'] = item['area']
      result['geometry'] = wrap_internal_content(item['geometry'])
      result['paddlingEnvironmentType'] = wrap_slug_ref(item['paddlingEnvironmentType_slug'])
      result['dataSourceType'] = wrap_slug_ref(item['dataSourceType_slug'])
      result['dataLicenseType'] = wrap_slug_ref(item['dataLicenseType_slug'])
      result
    end

    def transform_protected_area(item)
      waterway_refs = item['waterway']
      waterway = if waterway_refs.nil? || waterway_refs.empty?
                   nil
                 else
                   waterway_refs.map { |s| { 'slug' => s } }
                 end

      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = item['locale']
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']
      result['description'] = wrap_raw_description_nullable(item['_raw_description'])
      result['geometry'] = wrap_internal_content(item['geometry'])
      result['isAreaMarked'] = item['isAreaMarked']
      result['protectedAreaType'] = wrap_slug_ref(item['protectedAreaType_slug'])
      result['waterway'] = waterway
      result['dataSourceType'] = wrap_slug_ref(item['dataSourceType_slug'])
      result['dataLicenseType'] = wrap_slug_ref(item['dataLicenseType_slug'])
      result
    end

    # -------------------------------------------------------------------------
    # Dimension table transformer — converts flattened YAML dimension hash
    # into Gatsby-compatible structure. Creates a NEW hash; does NOT mutate
    # the source item.
    # -------------------------------------------------------------------------

    def transform_dimension_entry(item, locale, table_name)
      result = {}
      result['slug'] = item['slug']
      result['node_locale'] = locale
      result['createdAt'] = raw_timestamp(item, '_raw_createdAt', 'createdAt')
      result['updatedAt'] = raw_timestamp(item, '_raw_updatedAt', 'updatedAt')
      result['name'] = item['name']

      case table_name
      when 'paddlecrafttypes', 'datasourcetypes'
        result['description'] = wrap_raw_description(item['_raw_description'])
      when 'datalicensetypes'
        result['summaryUrl'] = item['summaryUrl']
        result['fullTextUrl'] = item['fullTextUrl']
      end

      result
    end
  end
end
