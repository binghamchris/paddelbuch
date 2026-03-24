# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'
require 'yaml'

RSpec.describe CacheMetadata do
  let(:tmpdir) { Dir.mktmpdir }
  let(:cache) { CacheMetadata.new(tmpdir) }
  let(:cache_path) { File.join(tmpdir, '.contentful_sync_cache.yml') }

  after { FileUtils.remove_entry(tmpdir) }

  describe 'load/save round-trip' do
    it 'persists and restores all fields' do
      cache.sync_token  = 'token_abc123'
      cache.last_sync_at = '2025-01-15T10:30:00+00:00'
      cache.space_id    = 'space_xyz'
      cache.environment = 'master'
      cache.save

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.sync_token).to eq('token_abc123')
      expect(loaded.last_sync_at).to eq('2025-01-15T10:30:00+00:00')
      expect(loaded.space_id).to eq('space_xyz')
      expect(loaded.environment).to eq('master')
    end
  end

  describe '#valid?' do
    it 'returns true when all fields are set' do
      cache.sync_token   = 'tok'
      cache.last_sync_at = '2025-01-01T00:00:00Z'
      cache.space_id     = 'sp'
      cache.environment  = 'master'

      expect(cache.valid?).to be true
    end

    %i[sync_token last_sync_at space_id environment].each do |field|
      it "returns false when #{field} is nil" do
        cache.sync_token   = 'tok'
        cache.last_sync_at = '2025-01-01T00:00:00Z'
        cache.space_id     = 'sp'
        cache.environment  = 'master'
        cache.send(:"#{field}=", nil)

        expect(cache.valid?).to be false
      end
    end
  end

  describe '#matches_config?' do
    before do
      cache.space_id    = 'space_abc'
      cache.environment = 'master'
    end

    it 'returns true when space_id and environment match' do
      expect(cache.matches_config?('space_abc', 'master')).to be true
    end

    it 'returns false when space_id differs' do
      expect(cache.matches_config?('other_space', 'master')).to be false
    end

    it 'returns false when environment differs' do
      expect(cache.matches_config?('space_abc', 'staging')).to be false
    end
  end

  describe '#load' do
    it 'returns false when file does not exist' do
      expect(cache.load).to be false
    end

    it 'returns false when YAML is corrupted' do
      File.write(cache_path, "---\n: invalid: yaml: [unterminated")
      expect(cache.load).to be false
    end

    it 'returns true but valid? returns false when fields are missing' do
      File.write(cache_path, YAML.dump({ 'sync_token' => 'tok', 'space_id' => 'sp' }))

      expect(cache.load).to be true
      expect(cache.valid?).to be false
      expect(cache.last_sync_at).to be_nil
      expect(cache.environment).to be_nil
    end
  end

  describe '#save' do
    it 'creates the directory if it does not exist' do
      nested_dir = File.join(tmpdir, 'nested', 'data')
      nested_cache = CacheMetadata.new(nested_dir)
      nested_cache.sync_token  = 'tok'
      nested_cache.last_sync_at = 'now'
      nested_cache.space_id    = 'sp'
      nested_cache.environment = 'master'
      nested_cache.save

      expect(File.exist?(File.join(nested_dir, '.contentful_sync_cache.yml'))).to be true
    end
  end

  describe '#compute_content_hash' do
    it 'produces expected SHA-256 digest for known file contents' do
      file_a = File.join(tmpdir, 'a.yml')
      file_b = File.join(tmpdir, 'b.yml')
      File.write(file_a, 'content_a')
      File.write(file_b, 'content_b')

      # Manually compute expected digest: sorted paths are a.yml, b.yml
      expected = Digest::SHA256.new
      expected.update('content_a')
      expected.update('content_b')

      result = cache.compute_content_hash([file_a, file_b])
      expect(result).to eq(expected.hexdigest)
    end

    it 'only hashes existing files and skips missing ones' do
      existing = File.join(tmpdir, 'exists.yml')
      missing  = File.join(tmpdir, 'missing.yml')
      File.write(existing, 'hello')

      expected = Digest::SHA256.new
      expected.update('hello')

      result = cache.compute_content_hash([missing, existing])
      expect(result).to eq(expected.hexdigest)
    end
  end

  describe 'load/save round-trip with content_hash' do
    it 'persists and restores content_hash' do
      cache.sync_token   = 'tok'
      cache.last_sync_at = '2025-01-15T10:30:00+00:00'
      cache.space_id     = 'sp'
      cache.environment  = 'master'
      cache.content_hash = 'abc123def456'
      cache.save

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.content_hash).to eq('abc123def456')
    end
  end

  # --- Entry ID Index tests (Task 1.4) ---
  # Validates: Requirements 7.1, 7.5

  describe 'load/save round-trip with entry_id_index' do
    it 'persists and restores entry_id_index' do
      cache.sync_token   = 'tok'
      cache.last_sync_at = '2025-01-15T10:30:00+00:00'
      cache.space_id     = 'sp'
      cache.environment  = 'master'
      cache.add_to_entry_id_index('abc123', 'spiez-beach', 'spot')
      cache.add_to_entry_id_index('def456', 'aare', 'waterway')
      cache.save

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.entry_id_index).to eq(
        'abc123' => { 'slug' => 'spiez-beach', 'content_type' => 'spot' },
        'def456' => { 'slug' => 'aare', 'content_type' => 'waterway' }
      )
    end

    it 'persists an empty entry_id_index' do
      cache.sync_token   = 'tok'
      cache.last_sync_at = 'now'
      cache.space_id     = 'sp'
      cache.environment  = 'master'
      cache.save

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.entry_id_index).to eq({})
    end
  end

  describe '#add_to_entry_id_index' do
    it 'adds a new entry to the index' do
      cache.add_to_entry_id_index('entry1', 'my-slug', 'spot')

      expect(cache.entry_id_index).to eq(
        'entry1' => { 'slug' => 'my-slug', 'content_type' => 'spot' }
      )
    end

    it 'overwrites an existing entry with the same ID' do
      cache.add_to_entry_id_index('entry1', 'old-slug', 'spot')
      cache.add_to_entry_id_index('entry1', 'new-slug', 'waterway')

      expect(cache.entry_id_index['entry1']).to eq(
        'slug' => 'new-slug', 'content_type' => 'waterway'
      )
    end

    it 'supports multiple distinct entries' do
      cache.add_to_entry_id_index('e1', 'slug-a', 'spot')
      cache.add_to_entry_id_index('e2', 'slug-b', 'waterway')
      cache.add_to_entry_id_index('e3', 'slug-c', 'obstacle')

      expect(cache.entry_id_index.size).to eq(3)
    end
  end

  describe '#remove_from_entry_id_index' do
    it 'removes an existing entry from the index' do
      cache.add_to_entry_id_index('entry1', 'my-slug', 'spot')
      cache.remove_from_entry_id_index('entry1')

      expect(cache.entry_id_index).to eq({})
    end

    it 'does nothing when removing a non-existent entry' do
      cache.add_to_entry_id_index('entry1', 'my-slug', 'spot')
      cache.remove_from_entry_id_index('nonexistent')

      expect(cache.entry_id_index.size).to eq(1)
      expect(cache.entry_id_index['entry1']).not_to be_nil
    end

    it 'only removes the targeted entry, leaving others intact' do
      cache.add_to_entry_id_index('e1', 'slug-a', 'spot')
      cache.add_to_entry_id_index('e2', 'slug-b', 'waterway')
      cache.remove_from_entry_id_index('e1')

      expect(cache.entry_id_index).to eq(
        'e2' => { 'slug' => 'slug-b', 'content_type' => 'waterway' }
      )
    end
  end

  describe '#lookup_entry_id' do
    it 'returns the slug and content_type for an existing entry' do
      cache.add_to_entry_id_index('entry1', 'spiez-beach', 'spot')

      result = cache.lookup_entry_id('entry1')
      expect(result).to eq('slug' => 'spiez-beach', 'content_type' => 'spot')
    end

    it 'returns nil for a non-existent entry' do
      expect(cache.lookup_entry_id('nonexistent')).to be_nil
    end

    it 'reflects updates after add_to_entry_id_index overwrites' do
      cache.add_to_entry_id_index('entry1', 'old-slug', 'spot')
      cache.add_to_entry_id_index('entry1', 'new-slug', 'waterway')

      expect(cache.lookup_entry_id('entry1')).to eq(
        'slug' => 'new-slug', 'content_type' => 'waterway'
      )
    end

    it 'returns nil after the entry is removed' do
      cache.add_to_entry_id_index('entry1', 'my-slug', 'spot')
      cache.remove_from_entry_id_index('entry1')

      expect(cache.lookup_entry_id('entry1')).to be_nil
    end
  end

  describe 'backward compatibility: loading cache without entry_id_index' do
    it 'defaults entry_id_index to {} when key is missing from YAML' do
      data = {
        'sync_token'   => 'tok',
        'last_sync_at' => '2025-01-15T10:30:00+00:00',
        'space_id'     => 'sp',
        'environment'  => 'master',
        'content_hash' => 'hash123'
      }
      File.write(cache_path, YAML.dump(data))

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.entry_id_index).to eq({})
      expect(loaded.sync_token).to eq('tok')
    end

    it 'defaults entry_id_index to {} when key is explicitly nil in YAML' do
      data = {
        'sync_token'    => 'tok',
        'last_sync_at'  => 'now',
        'space_id'      => 'sp',
        'environment'   => 'master',
        'entry_id_index' => nil
      }
      File.write(cache_path, YAML.dump(data))

      loaded = CacheMetadata.new(tmpdir)
      expect(loaded.load).to be true
      expect(loaded.entry_id_index).to eq({})
    end
  end
end
