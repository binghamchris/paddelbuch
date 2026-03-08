# frozen_string_literal: true

require 'yaml'
require 'fileutils'
require 'contentful'

require_relative 'sync_checker'
require_relative 'cache_metadata'
require_relative 'contentful_mappers'

module Jekyll
  class ContentfulFetcher < Generator
    include SyncChecker

    safe true
    priority :highest

    CONTENT_TYPES = {
      'spot'                    => { filename: 'spots',                            mapper: :map_spot },
      'waterway'                => { filename: 'waterways',                        mapper: :map_waterway },
      'obstacle'                => { filename: 'obstacles',                        mapper: :map_obstacle },
      'protectedArea'           => { filename: 'protected_areas',                  mapper: :map_protected_area },
      'waterwayEventNotice'     => { filename: 'notices',                          mapper: :map_event_notice },
      'spotType'                => { filename: 'types/spot_types',                 mapper: :map_type },
      'obstacleType'            => { filename: 'types/obstacle_types',             mapper: :map_type },
      'paddleCraftType'         => { filename: 'types/paddle_craft_types',         mapper: :map_type },
      'paddlingEnvironmentType' => { filename: 'types/paddling_environment_types', mapper: :map_type },
      'protectedAreaType'       => { filename: 'types/protected_area_types',       mapper: :map_type },
      'dataSourceType'          => { filename: 'types/data_source_types',          mapper: :map_type },
      'dataLicenseType'         => { filename: 'types/data_license_types',         mapper: :map_type },
      'staticPage'              => { filename: 'static_pages',                     mapper: :map_static_page }
    }.freeze

    def generate(site)
      @site = site
      @data_dir = File.join(site.source, '_data')

      unless contentful_configured?
        Jekyll.logger.warn 'Contentful:', 'Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN — skipping content fetch'
        return
      end

      cache = CacheMetadata.new(@data_dir)
      cache_loaded = cache.load

      current_space_id    = ENV['CONTENTFUL_SPACE_ID']
      current_environment = ENV['CONTENTFUL_ENVIRONMENT'] || 'master'

      if force_sync?
        reason = if ENV['CONTENTFUL_FORCE_SYNC']&.downcase == 'true'
                   'CONTENTFUL_FORCE_SYNC environment variable is set'
                 else
                   'force_contentful_sync config option is enabled'
                 end
        Jekyll.logger.info 'Contentful:', "Performing full sync — #{reason}"
        perform_full_fetch(cache, current_space_id, current_environment)
        new_hash = cache.compute_content_hash(yaml_file_paths)
        save_cache(cache, cache.sync_token, current_space_id, current_environment, new_hash)
        site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'Force sync — setting change flag to true'
        return
      end

      unless cache_loaded && cache.valid?
        reason = cache_loaded ? 'cache metadata is invalid (missing fields)' : 'no cache metadata found'
        Jekyll.logger.info 'Contentful:', "Performing full sync — #{reason}"
        perform_full_fetch(cache, current_space_id, current_environment)
        new_hash = cache.compute_content_hash(yaml_file_paths)
        save_cache(cache, cache.sync_token, current_space_id, current_environment, new_hash)
        site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'No previous content hash — setting change flag to true'
        return
      end

      unless cache.matches_config?(current_space_id, current_environment)
        Jekyll.logger.info 'Contentful:', "Performing full sync — environment mismatch " \
          "(cached: #{cache.space_id}/#{cache.environment}, current: #{current_space_id}/#{current_environment})"
        perform_full_fetch(cache, current_space_id, current_environment)
        new_hash = cache.compute_content_hash(yaml_file_paths)
        save_cache(cache, cache.sync_token, current_space_id, current_environment, new_hash)
        site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'Content hash changed — setting change flag to true'
        return
      end

      # Incremental sync check
      result = check_for_changes(client, cache.sync_token)

      unless result.success?
        Jekyll.logger.warn 'Contentful:', "Sync API error: #{result.error&.message} — falling back to full fetch"
        perform_full_fetch(cache, current_space_id, current_environment)
        new_hash = cache.compute_content_hash(yaml_file_paths)
        save_cache(cache, cache.sync_token, current_space_id, current_environment, new_hash)
        site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'Content hash changed — setting change flag to true'
        return
      end

      unless result.has_changes
        Jekyll.logger.info 'Contentful:', "Using cached content (last synced: #{cache.last_sync_at})"
        site.config['contentful_data_changed'] = false
        Jekyll.logger.info 'Contentful:', 'Sync API reports no changes — setting change flag to false'
        return
      end

      Jekyll.logger.info 'Contentful:', "Sync API detected #{result.items_count} changed entries — fetching content"
      fetch_and_write_content
      compute_and_set_change_flag(cache, result.new_token, current_space_id, current_environment)
    end

    private

    def contentful_configured?
      ENV['CONTENTFUL_SPACE_ID'] && !ENV['CONTENTFUL_SPACE_ID'].empty? &&
        ENV['CONTENTFUL_ACCESS_TOKEN'] && !ENV['CONTENTFUL_ACCESS_TOKEN'].empty?
    end

    def force_sync?
      ENV['CONTENTFUL_FORCE_SYNC']&.downcase == 'true' ||
        @site.config['force_contentful_sync'] == true
    end

    def client
      @client ||= Contentful::Client.new(
        space:           ENV['CONTENTFUL_SPACE_ID'],
        access_token:    ENV['CONTENTFUL_ACCESS_TOKEN'],
        environment:     ENV['CONTENTFUL_ENVIRONMENT'] || 'master',
        dynamic_entries: :auto,
        raise_errors:    true
      )
    end

    def perform_full_fetch(cache, space_id, environment)
      sync_result = initial_sync(client)

      unless sync_result.success?
        Jekyll.logger.warn 'Contentful:', "Initial sync failed: #{sync_result.error&.message} — fetching without sync token"
      end

      fetch_and_write_content

      new_token = sync_result.success? ? sync_result.new_token : nil
      cache.sync_token = new_token
    end

    def fetch_and_write_content
      CONTENT_TYPES.each do |content_type, config|
        begin
          entries = fetch_entries(content_type)
          data = entries.flat_map { |entry| ContentfulMappers.flatten_entry(entry, config[:mapper]) }
          Jekyll.logger.info 'Contentful:', "Fetched #{entries.size} #{content_type} entries"
          write_yaml(config[:filename], data)
        rescue Contentful::Error => e
          Jekyll.logger.warn 'Contentful:', "Error fetching #{content_type}: #{e.message} — skipping"
        end
      end
    end

    def fetch_entries(content_type)
      client.entries(content_type: content_type, locale: '*', include: 2, limit: 1000)
    end

    def write_yaml(filename, data)
      filepath = File.join(@data_dir, "#{filename}.yml")
      FileUtils.mkdir_p(File.dirname(filepath))
      File.write(filepath, YAML.dump(data))

      # Update site.data so downstream generators get fresh data
      keys = filename.split('/')
      if keys.length == 1
        @site.data[keys[0]] = data
      else
        # Nested path like 'types/spot_types'
        parent = keys[0]
        child  = keys[1]
        @site.data[parent] ||= {}
        @site.data[parent][child] = data
      end
    end

    def save_cache(cache, sync_token, space_id, environment, content_hash = nil)
      cache.sync_token   = sync_token
      cache.last_sync_at = Time.now.iso8601
      cache.space_id     = space_id
      cache.environment  = environment
      cache.content_hash = content_hash unless content_hash.nil?
      cache.save
    end

    def yaml_file_paths
      CONTENT_TYPES.values.map { |c| File.join(@data_dir, "#{c[:filename]}.yml") }
                          .select { |p| File.exist?(p) }
    end

    def compute_and_set_change_flag(cache, sync_token, space_id, environment)
      new_hash = cache.compute_content_hash(yaml_file_paths)
      previous_hash = cache.content_hash

      if previous_hash.nil?
        @site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'No previous content hash — setting change flag to true'
      elsif new_hash == previous_hash
        @site.config['contentful_data_changed'] = false
        Jekyll.logger.info 'Contentful:', 'Content hash unchanged — setting change flag to false'
      else
        @site.config['contentful_data_changed'] = true
        Jekyll.logger.info 'Contentful:', 'Content hash changed — setting change flag to true'
      end

      save_cache(cache, sync_token, space_id, environment, new_hash)
    end
  end
end
