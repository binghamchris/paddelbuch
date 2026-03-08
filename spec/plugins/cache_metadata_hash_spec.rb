# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 1: Content hash determinism
# **Validates: Requirements 1.1**

require 'spec_helper'
require 'tmpdir'
require 'digest'

RSpec.describe CacheMetadata, '#compute_content_hash — Property 1: Content hash determinism' do
  let(:tmpdir) { Dir.mktmpdir }
  let(:cache) { CacheMetadata.new(tmpdir) }

  after { FileUtils.remove_entry(tmpdir) }

  # Property 1: For any set of YAML file contents and file paths, computing the
  # content hash over the sorted paths should always produce the same SHA-256 digest.
  # Reordering the input file list must not change the result.
  it 'produces the same hash regardless of input file order' do
    property_of {
      # Generate between 2 and 8 files (need at least 2 to test reordering)
      num_files = range(2, 8)

      files = Array.new(num_files) do |i|
        name = "data_#{i}_#{sized(range(3, 10)) { string(:alpha) }}.yml"
        content = sized(range(1, 200)) { string }
        [name, content]
      end

      files
    }.check(100) { |files|
      # Write files to temp directory
      file_paths = files.map do |name, content|
        path = File.join(tmpdir, name)
        File.write(path, content)
        path
      end

      # Compute hash with original order
      hash_original = cache.compute_content_hash(file_paths)

      # Compute hash with shuffled order
      shuffled_paths = file_paths.shuffle
      hash_shuffled = cache.compute_content_hash(shuffled_paths)

      # Compute hash with reversed order
      hash_reversed = cache.compute_content_hash(file_paths.reverse)

      expect(hash_original).to eq(hash_shuffled),
        "Hash with original order (#{hash_original}) != hash with shuffled order (#{hash_shuffled}) for files: #{file_paths}"
      expect(hash_original).to eq(hash_reversed),
        "Hash with original order (#{hash_original}) != hash with reversed order (#{hash_reversed}) for files: #{file_paths}"

      # Clean up files for next iteration
      file_paths.each { |p| File.delete(p) if File.exist?(p) }
    }
  end
end
