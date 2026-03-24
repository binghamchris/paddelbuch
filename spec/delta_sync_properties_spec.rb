# frozen_string_literal: true

require 'spec_helper'
require 'tmpdir'

RSpec.describe 'Delta Sync Properties' do
  # Feature: contentful-delta-sync, Property 1: Delta item classification and grouping
  # **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2**
  describe 'Property 1: Delta item classification and grouping' do
    KNOWN_TYPES = %w[spot waterway obstacle section spotType waterway_section region notice partner].freeze
    UNKNOWN_TYPES = %w[blogPost author faq newsletter campaign].freeze
    SYS_TYPES = %w[Entry DeletedEntry Asset DeletedAsset].freeze

    # Build a mock sync item matching the Contentful SDK pattern
    def build_property_sync_item(type:, content_type_id: nil)
      item = double("SyncItem(#{type}/#{content_type_id})")
      sys_hash = { type: type }
      if content_type_id
        ct_obj = double("ContentType(#{content_type_id})")
        allow(ct_obj).to receive(:sys).and_return({ id: content_type_id })
        sys_hash[:contentType] = ct_obj
      end
      allow(item).to receive(:sys).and_return(sys_hash)
      item
    end

    def build_property_mock_page(items:, sync_url:)
      page = double('SyncPage')
      allow(page).to receive(:items).and_return(items)
      allow(page).to receive(:next_page?).and_return(false)
      allow(page).to receive(:next_sync_url).and_return(sync_url)
      page
    end

    it 'correctly classifies all sync items by type and known/unknown content type' do
      host = Class.new { include SyncChecker }.new
      known_set = KNOWN_TYPES

      property_of {
        count = range(0, 30)
        item_specs = []
        count.times do
          sys_type = choose(*SYS_TYPES)
          # Entry and DeletedEntry get a content type; Asset/DeletedAsset do not
          if %w[Entry DeletedEntry].include?(sys_type)
            ct_id = choose(*(KNOWN_TYPES + UNKNOWN_TYPES))
            item_specs << { sys_type: sys_type, content_type_id: ct_id }
          else
            item_specs << { sys_type: sys_type, content_type_id: nil }
          end
        end
        item_specs
      }.check(100) { |item_specs|
        # Build mock items from the generated specs
        mock_items = item_specs.map do |spec|
          build_property_sync_item(type: spec[:sys_type], content_type_id: spec[:content_type_id])
        end

        # Set up mock client and sync page
        sync_url = 'https://cdn.contentful.com/spaces/abc/sync?sync_token=prop_tok'
        page = build_property_mock_page(items: mock_items, sync_url: sync_url)
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        client = double('Contentful::Client')
        allow(client).to receive(:sync).with(sync_token: 'old_tok').and_return(sync)

        result = host.check_for_changes(client, 'old_tok', known_set)

        # Property: items_count equals total items in the delta
        expect(result.items_count).to eq(item_specs.size)

        # Property: has_changes is true iff delta is non-empty
        expect(result.has_changes).to eq(!item_specs.empty?)

        # Property: all Entry items with known types land in changed_entries
        expected_changed = item_specs
          .select { |s| s[:sys_type] == 'Entry' && known_set.include?(s[:content_type_id]) }
          .group_by { |s| s[:content_type_id] }
          .transform_values(&:size)

        result.changed_entries.each do |ct_id, entries|
          expect(known_set).to include(ct_id)
          expect(entries.size).to eq(expected_changed[ct_id])
        end
        expected_changed.each do |ct_id, count|
          expect(result.changed_entries).to have_key(ct_id)
          expect(result.changed_entries[ct_id].size).to eq(count)
        end

        # Property: all DeletedEntry items with known types land in deleted_entries
        expected_deleted = item_specs
          .select { |s| s[:sys_type] == 'DeletedEntry' && known_set.include?(s[:content_type_id]) }
          .group_by { |s| s[:content_type_id] }
          .transform_values(&:size)

        result.deleted_entries.each do |ct_id, entries|
          expect(known_set).to include(ct_id)
          expect(entries.size).to eq(expected_deleted[ct_id])
        end
        expected_deleted.each do |ct_id, count|
          expect(result.deleted_entries).to have_key(ct_id)
          expect(result.deleted_entries[ct_id].size).to eq(count)
        end

        # Property: unknown content types are excluded from both lists
        expected_unknown = item_specs
          .select { |s| %w[Entry DeletedEntry].include?(s[:sys_type]) && !known_set.include?(s[:content_type_id]) }
          .map { |s| s[:content_type_id] }
          .uniq

        expect(result.unknown_content_types).to match_array(expected_unknown)

        # Property: no unknown type appears in changed_entries or deleted_entries
        all_classified_types = result.changed_entries.keys + result.deleted_entries.keys
        all_classified_types.each do |ct_id|
          expect(known_set).to include(ct_id)
        end
      }
    end
  end

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
