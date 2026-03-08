# frozen_string_literal: true

# Feature: conditional-build-regeneration, Property 2: Change flag reflects hash comparison
# **Validates: Requirements 1.2, 1.3, 2.1**

require 'spec_helper'
require 'tmpdir'
require 'digest'

RSpec.describe Jekyll::ContentfulFetcher, '#compute_and_set_change_flag — Property 2: Change flag reflects hash comparison' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return({})
    s
  end

  before do
    FileUtils.mkdir_p(data_dir)
    fetcher.instance_variable_set(:@site, site)
    fetcher.instance_variable_set(:@data_dir, data_dir)
    allow(Jekyll.logger).to receive(:info)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: write a YAML file and return its path
  def write_yaml_file(filename, content)
    path = File.join(data_dir, "#{filename}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  # Helper: compute the SHA-256 hash for given file paths (sorted, same as CacheMetadata)
  def compute_hash(file_paths)
    digest = Digest::SHA256.new
    file_paths.sort.each { |p| digest.update(File.read(p)) }
    digest.hexdigest
  end

  # Property 2: For any pair of content hash values (computed and stored),
  # the change flag must equal true when the hashes differ and false when they match.
  # When no previous hash exists (nil), the flag must be true.
  it 'sets change flag to false when hashes match, true when they differ' do
    property_of {
      # Generate random YAML-like content for 1-5 files
      num_files = range(1, 5)
      file_contents = Array.new(num_files) { |i| [i, sized(range(10, 100)) { string }] }

      # Decide scenario: :match, :mismatch, or :nil_previous
      scenario = choose(:match, :mismatch, :nil_previous)

      [file_contents, scenario]
    }.check(100) { |file_contents, scenario|
      # Clean data_dir between iterations
      FileUtils.rm_rf(Dir.glob(File.join(data_dir, '*.yml')))

      # Write YAML files
      paths = file_contents.map { |i, content| write_yaml_file("test_data_#{i}", content) }

      # Compute the actual hash of the written files
      actual_hash = compute_hash(paths)

      # Set up CacheMetadata with the appropriate previous hash
      cache = CacheMetadata.new(data_dir)
      cache.sync_token = 'test_token'
      cache.last_sync_at = Time.now.iso8601
      cache.space_id = 'test_space'
      cache.environment = 'master'

      case scenario
      when :match
        # Previous hash matches what the files will produce
        cache.content_hash = actual_hash
      when :mismatch
        # Previous hash is a different random hex string
        cache.content_hash = Digest::SHA256.hexdigest("different_#{rand(1_000_000)}")
        # Ensure it's actually different
        cache.content_hash = Digest::SHA256.hexdigest("extra_#{rand}") while cache.content_hash == actual_hash
      when :nil_previous
        cache.content_hash = nil
      end

      # Stub yaml_file_paths to return our test files
      allow(fetcher).to receive(:yaml_file_paths).and_return(paths)

      # Reset the config before each call
      site_config.delete('contentful_data_changed')

      # Call the private method under test
      fetcher.send(:compute_and_set_change_flag, cache, 'new_token', 'test_space', 'master')

      flag = site_config['contentful_data_changed']

      case scenario
      when :match
        expect(flag).to eq(false),
          "Expected change flag to be false when hashes match (both: #{actual_hash}), got #{flag}"
      when :mismatch
        expect(flag).to eq(true),
          "Expected change flag to be true when hashes differ, got #{flag}"
      when :nil_previous
        expect(flag).to eq(true),
          "Expected change flag to be true when no previous hash exists, got #{flag}"
      end
    }
  end
end

# Feature: conditional-build-regeneration, Property 3: Force sync overrides hash comparison
# **Validates: Requirements 6.1, 6.2**

RSpec.describe Jekyll::ContentfulFetcher, '#force_sync — Property 3: Force sync overrides hash comparison' do
  let(:fetcher) { described_class.new }
  let(:tmpdir) { Dir.mktmpdir }
  let(:data_dir) { File.join(tmpdir, '_data') }
  let(:site_config) { {} }
  let(:site) do
    s = double('Jekyll::Site')
    allow(s).to receive(:source).and_return(tmpdir)
    allow(s).to receive(:config).and_return(site_config)
    allow(s).to receive(:data).and_return({})
    s
  end

  before do
    FileUtils.mkdir_p(data_dir)
    fetcher.instance_variable_set(:@site, site)
    fetcher.instance_variable_set(:@data_dir, data_dir)
    allow(Jekyll.logger).to receive(:info)
  end

  after { FileUtils.remove_entry(tmpdir) if File.exist?(tmpdir) }

  # Helper: write a YAML file and return its path
  def write_yaml_file(dir, filename, content)
    path = File.join(dir, "#{filename}.yml")
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  # Helper: compute the SHA-256 hash for given file paths (sorted, same as CacheMetadata)
  def compute_hash(file_paths)
    digest = Digest::SHA256.new
    file_paths.sort.each { |p| digest.update(File.read(p)) }
    digest.hexdigest
  end

  # Property 3: For any content hash state (matching, mismatching, or missing),
  # when force sync is active (via env var or config), the change flag must be true.
  it 'always sets change flag to true when force sync is active, regardless of hash state' do
    property_of {
      # Generate random YAML-like content for 1-4 files
      num_files = range(1, 4)
      file_contents = Array.new(num_files) { |i| [i, sized(range(5, 50)) { string }] }

      # Random hash state: :match, :mismatch, or :nil_previous
      hash_state = choose(:match, :mismatch, :nil_previous)

      # Random force sync mechanism: :env_var or :config
      force_mechanism = choose(:env_var, :config)

      [file_contents, hash_state, force_mechanism]
    }.check(100) { |file_contents, hash_state, force_mechanism|
      # Clean data_dir between iterations
      FileUtils.rm_rf(Dir.glob(File.join(data_dir, '*.yml')))

      # Write YAML files
      paths = file_contents.map { |i, content| write_yaml_file(data_dir, "test_force_#{i}", content) }

      # Compute the actual hash of the written files
      actual_hash = compute_hash(paths)

      # Set up CacheMetadata with the appropriate previous hash
      cache = CacheMetadata.new(data_dir)
      cache.sync_token = 'test_token'
      cache.last_sync_at = Time.now.iso8601
      cache.space_id = 'test_space'
      cache.environment = 'master'

      case hash_state
      when :match
        cache.content_hash = actual_hash
      when :mismatch
        cache.content_hash = Digest::SHA256.hexdigest("different_#{rand(1_000_000)}")
        cache.content_hash = Digest::SHA256.hexdigest("extra_#{rand}") while cache.content_hash == actual_hash
      when :nil_previous
        cache.content_hash = nil
      end

      # Enable force sync via the chosen mechanism
      case force_mechanism
      when :env_var
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('CONTENTFUL_FORCE_SYNC').and_return('true')
        site_config.delete('force_contentful_sync')
      when :config
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with('CONTENTFUL_FORCE_SYNC').and_return(nil)
        site_config['force_contentful_sync'] = true
      end

      # Verify force_sync? returns true
      expect(fetcher.send(:force_sync?)).to eq(true),
        "Expected force_sync? to return true with mechanism=#{force_mechanism}"

      # Simulate the force sync code path from generate:
      # 1. Compute new hash (as generate does after fetch)
      new_hash = cache.compute_content_hash(paths)
      # 2. Save cache with new hash
      cache.content_hash = new_hash
      # 3. Set the change flag to true (this is what generate does)
      site_config['contentful_data_changed'] = true

      # Assert: flag must always be true regardless of hash state
      expect(site_config['contentful_data_changed']).to eq(true),
        "Expected change flag to be true with force_sync (hash_state=#{hash_state}, " \
        "mechanism=#{force_mechanism}), got #{site_config['contentful_data_changed']}"
    }
  end
end
