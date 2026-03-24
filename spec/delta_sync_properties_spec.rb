# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe 'Delta Sync Properties' do
  # Feature: contentful-delta-sync, Property 4: Entry ID Index round-trip through cache persistence
  # **Validates: Requirements 7.1, 7.5**
  describe 'Property 4: Entry ID Index round-trip through cache persistence' do
    it 'saving and loading an Entry ID Index via CacheMetadata produces an identical index' do
      property_of {
        # Generate a random number of index entries (0..20)
        count = range(0, 20)
        index = {}
        count.times do
          entry_id = sized(range(5, 20)) { string(:alnum) }
          slug = sized(range(3, 15)) { string(:alpha) }.downcase
          content_type = choose('spot', 'waterway', 'obstacle', 'section', 'spotType',
                                'waterway_section', 'region', 'notice', 'partner')
          index[entry_id] = { 'slug' => slug, 'content_type' => content_type }
        end
        index
      }.check(100) { |index|
        Dir.mktmpdir do |tmpdir|
          # Save
          cache = CacheMetadata.new(tmpdir)
          cache.sync_token   = 'tok'
          cache.last_sync_at = '2025-01-01T00:00:00Z'
          cache.space_id     = 'sp'
          cache.environment  = 'master'
          cache.entry_id_index = index
          cache.save

          # Load
          loaded = CacheMetadata.new(tmpdir)
          expect(loaded.load).to be true
          expect(loaded.entry_id_index).to eq(index)
        end
      }
    end
  end
end
