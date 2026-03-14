# frozen_string_literal: true

require 'fileutils'
require 'json'

module GeneratorCache
  def cache_available?(cache_dir)
    Dir.exist?(cache_dir) && !Dir.glob(File.join(cache_dir, '**', '*.json')).empty?
  end

  def write_cache_file(cache_dir, relative_path, content)
    path = File.join(cache_dir, relative_path)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
  end

  def read_cache_files(cache_dir)
    Dir.glob(File.join(cache_dir, '**', '*.json')).map do |path|
      relative = path.sub("#{cache_dir}/", '')
      { relative_path: relative, content: File.read(path) }
    end
  end

  def clear_cache(cache_dir)
    FileUtils.rm_rf(cache_dir)
    FileUtils.mkdir_p(cache_dir)
  end

  def get_data_for_locale(site_data, data_key, locale, cache)
    cache_key = "#{data_key}:#{locale}"
    return cache[cache_key] if cache.key?(cache_key)

    data = site_data.is_a?(Hash) ? site_data[data_key] : site_data
    result = if data.is_a?(Array)
               data.select { |item| item['locale'] == locale || item['node_locale'] == locale }
             elsif data.is_a?(Hash)
               data[locale] || []
             else
               []
             end

    cache[cache_key] = result
  end
end
