# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'json'

# Helper class to include the GeneratorCache module for testing
class CacheTestHelper
  include GeneratorCache
end

# **Validates: Requirements 5.1, 5.2, 5.3**
RSpec.describe GeneratorCache do
  let(:helper) { CacheTestHelper.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:cache_dir) { File.join(tmpdir, '.test_cache') }

  after { FileUtils.remove_entry(tmpdir) }

  # ===========================================================================
  # cache_available?
  # ===========================================================================
  describe '#cache_available?' do
    it 'returns false when directory does not exist' do
      expect(helper.cache_available?(cache_dir)).to be false
    end

    it 'returns false when directory exists but is empty' do
      FileUtils.mkdir_p(cache_dir)
      expect(helper.cache_available?(cache_dir)).to be false
    end

    it 'returns false when directory contains only non-JSON files' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'readme.txt'), 'not json')
      expect(helper.cache_available?(cache_dir)).to be false
    end

    it 'returns true when directory contains JSON files' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'data.json'), '{"key":"value"}')
      expect(helper.cache_available?(cache_dir)).to be true
    end

    it 'returns true when JSON files are in nested subdirectories' do
      nested = File.join(cache_dir, 'api', 'tiles', 'de')
      FileUtils.mkdir_p(nested)
      File.write(File.join(nested, 'index.json'), '[]')
      expect(helper.cache_available?(cache_dir)).to be true
    end
  end

  # ===========================================================================
  # write_cache_file
  # ===========================================================================
  describe '#write_cache_file' do
    it 'creates the file with the given content' do
      FileUtils.mkdir_p(cache_dir)
      helper.write_cache_file(cache_dir, 'spots-de.json', '{"spots":[]}')
      path = File.join(cache_dir, 'spots-de.json')
      expect(File.exist?(path)).to be true
      expect(File.read(path)).to eq('{"spots":[]}')
    end

    it 'creates nested directories as needed' do
      FileUtils.mkdir_p(cache_dir)
      relative = 'api/tiles/spots/de/index.json'
      content = '{"tiles":[]}'
      helper.write_cache_file(cache_dir, relative, content)
      path = File.join(cache_dir, relative)
      expect(File.exist?(path)).to be true
      expect(File.read(path)).to eq(content)
    end

    it 'overwrites existing file content' do
      FileUtils.mkdir_p(cache_dir)
      helper.write_cache_file(cache_dir, 'data.json', 'old')
      helper.write_cache_file(cache_dir, 'data.json', 'new')
      expect(File.read(File.join(cache_dir, 'data.json'))).to eq('new')
    end
  end

  # ===========================================================================
  # read_cache_files
  # ===========================================================================
  describe '#read_cache_files' do
    it 'returns an empty array when directory has no JSON files' do
      FileUtils.mkdir_p(cache_dir)
      expect(helper.read_cache_files(cache_dir)).to eq([])
    end

    it 'returns correct relative paths and content for flat files' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'spots-de.json'), '{"a":1}')
      File.write(File.join(cache_dir, 'spots-en.json'), '{"a":2}')

      results = helper.read_cache_files(cache_dir)
      results.sort_by! { |r| r[:relative_path] }

      expect(results.length).to eq(2)
      expect(results[0][:relative_path]).to eq('spots-de.json')
      expect(results[0][:content]).to eq('{"a":1}')
      expect(results[1][:relative_path]).to eq('spots-en.json')
      expect(results[1][:content]).to eq('{"a":2}')
    end

    it 'returns correct relative paths for nested files' do
      nested = File.join(cache_dir, 'api', 'tiles', 'de')
      FileUtils.mkdir_p(nested)
      File.write(File.join(nested, 'index.json'), '[]')
      File.write(File.join(nested, '3_2.json'), '[1,2]')

      results = helper.read_cache_files(cache_dir)
      paths = results.map { |r| r[:relative_path] }.sort

      expect(paths).to eq(['api/tiles/de/3_2.json', 'api/tiles/de/index.json'])
    end

    it 'ignores non-JSON files' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'data.json'), '{}')
      File.write(File.join(cache_dir, 'readme.txt'), 'text')

      results = helper.read_cache_files(cache_dir)
      expect(results.length).to eq(1)
      expect(results[0][:relative_path]).to eq('data.json')
    end
  end

  # ===========================================================================
  # clear_cache
  # ===========================================================================
  describe '#clear_cache' do
    it 'removes all existing files and recreates the directory' do
      FileUtils.mkdir_p(cache_dir)
      File.write(File.join(cache_dir, 'old.json'), 'stale')
      nested = File.join(cache_dir, 'sub')
      FileUtils.mkdir_p(nested)
      File.write(File.join(nested, 'deep.json'), 'stale')

      helper.clear_cache(cache_dir)

      expect(Dir.exist?(cache_dir)).to be true
      expect(Dir.glob(File.join(cache_dir, '**', '*'))).to be_empty
    end

    it 'creates the directory if it did not exist' do
      expect(Dir.exist?(cache_dir)).to be false
      helper.clear_cache(cache_dir)
      expect(Dir.exist?(cache_dir)).to be true
    end
  end
end
