# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe 'Contentful Sync Properties' do
  # Feature: contentful-sync-integration, Property 5: Cache metadata YAML round-trip
  # **Validates: Requirements 4.5, 4.6**
  describe 'Property 5: Cache metadata YAML round-trip' do
    let(:tmpdir) { Dir.mktmpdir }

    after do
      FileUtils.remove_entry(tmpdir)
    end

    it 'round-trips cache metadata through YAML' do
      property_of {
        Rantly {
          {
            sync_token: sized(range(10, 50)) { string(:alpha) },
            last_sync_at: Time.now.iso8601,
            space_id: sized(range(5, 20)) { string(:alpha) },
            environment: choose('master', 'staging', 'development')
          }
        }
      }.check(100) { |data|
        cache = CacheMetadata.new(tmpdir)
        cache.sync_token = data[:sync_token]
        cache.last_sync_at = data[:last_sync_at]
        cache.space_id = data[:space_id]
        cache.environment = data[:environment]
        cache.save

        loaded = CacheMetadata.new(tmpdir)
        loaded.load
        expect(loaded.sync_token).to eq(data[:sync_token])
        expect(loaded.last_sync_at).to eq(data[:last_sync_at])
        expect(loaded.space_id).to eq(data[:space_id])
        expect(loaded.environment).to eq(data[:environment])
      }
    end
  end
end
