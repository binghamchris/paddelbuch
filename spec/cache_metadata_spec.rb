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
end
