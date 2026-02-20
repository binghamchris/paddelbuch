# frozen_string_literal: true

require 'yaml'
require 'fileutils'

class CacheMetadata
  CACHE_FILENAME = '.contentful_sync_cache.yml'

  attr_accessor :sync_token, :last_sync_at, :space_id, :environment

  def initialize(data_dir)
    @data_dir = data_dir
    @cache_path = File.join(data_dir, CACHE_FILENAME)
  end

  def load
    return false unless File.exist?(@cache_path)

    data = YAML.safe_load(File.read(@cache_path), permitted_classes: [Time])
    return false unless data.is_a?(Hash)

    @sync_token  = data['sync_token']
    @last_sync_at = data['last_sync_at']
    @space_id    = data['space_id']
    @environment = data['environment']
    true
  rescue Psych::SyntaxError
    false
  end

  def save
    FileUtils.mkdir_p(@data_dir)

    data = {
      'sync_token'   => @sync_token,
      'last_sync_at' => @last_sync_at,
      'space_id'     => @space_id,
      'environment'  => @environment
    }

    File.write(@cache_path, YAML.dump(data))
  end

  def valid?
    !sync_token.nil? && !last_sync_at.nil? && !space_id.nil? && !environment.nil?
  end

  def matches_config?(current_space_id, current_environment)
    space_id == current_space_id && environment == current_environment
  end
end
