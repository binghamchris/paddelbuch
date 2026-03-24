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

  # Feature: contentful-delta-sync, Property 2: Upsert preserves data and updates correctly
  # **Validates: Requirements 3.3, 3.4, 7.3**
  describe 'Property 2: Upsert preserves data and updates correctly' do
    let(:fetcher) { Jekyll::ContentfulFetcher.new }

    SLUGS_POOL = %w[spiez thun bern aare limmat rhein zurich luzern brienz interlaken].freeze
    LOCALES = %w[de en].freeze

    def random_row(slug, locale, extra_key, extra_val)
      { 'slug' => slug, 'locale' => locale, extra_key => extra_val }
    end

    it 'preserves data and updates correctly after upsert' do
      property_of {
        # Generate random existing rows (0..20 rows)
        existing_count = range(0, 20)
        existing_rows = []
        existing_count.times do
          slug = choose(*SLUGS_POOL)
          locale = choose(*LOCALES)
          name = sized(range(3, 10)) { string(:alpha) }
          existing_rows << { 'slug' => slug, 'locale' => locale, 'name' => name }
        end

        # Generate random new rows to upsert (1..10 rows)
        new_count = range(1, 10)
        new_rows = []
        new_count.times do
          slug = choose(*SLUGS_POOL)
          locale = choose(*LOCALES)
          name = sized(range(3, 10)) { string(:alpha) }
          new_rows << { 'slug' => slug, 'locale' => locale, 'name' => name }
        end

        [existing_rows, new_rows]
      }.check(100) { |existing_rows, new_rows|
        filename = 'spots'
        # Deep-copy existing rows so we can compare originals later
        original_rows = existing_rows.map(&:dup)
        yaml_data = { filename => existing_rows.map(&:dup) }

        fetcher.send(:upsert_rows, yaml_data, filename, new_rows)

        result = yaml_data[filename]

        # Property A: Every new row's slug+locale is present in the result
        new_rows.each do |nr|
          match = result.find { |r| r['slug'] == nr['slug'] && r['locale'] == nr['locale'] }
          expect(match).not_to be_nil,
            "Expected slug=#{nr['slug']} locale=#{nr['locale']} to be present in result"
        end

        # Property B: Upserted slug+locale pairs match the LAST new row exactly
        # (if new_rows has duplicates for the same slug+locale, the last one wins)
        effective_new = {}
        new_rows.each do |nr|
          key = [nr['slug'], nr['locale']]
          effective_new[key] = nr
        end

        effective_new.each do |(slug, locale), expected_row|
          match = result.find { |r| r['slug'] == slug && r['locale'] == locale }
          expect(match).to eq(expected_row),
            "Expected row for slug=#{slug} locale=#{locale} to equal #{expected_row}, got #{match}"
        end

        # Property C: All rows whose slug+locale did not match any new row remain unchanged
        original_rows.each do |orig|
          key = [orig['slug'], orig['locale']]
          next if effective_new.key?(key)

          # Find the row in result at the same position or by matching slug+locale
          match = result.find { |r| r['slug'] == orig['slug'] && r['locale'] == orig['locale'] }
          # The original row should still be present (though there may be duplicates in original)
          expect(match).not_to be_nil,
            "Expected original row slug=#{orig['slug']} locale=#{orig['locale']} to still be present"
        end

        # Property D: Total count = original count + genuinely new pairs (not already present)
        original_keys = original_rows.map { |r| [r['slug'], r['locale']] }
        genuinely_new = effective_new.keys.reject { |k| original_keys.include?(k) }
        expected_count = original_rows.size + genuinely_new.size

        expect(result.size).to eq(expected_count),
          "Expected #{expected_count} rows (#{original_rows.size} original + #{genuinely_new.size} new), got #{result.size}"
      }
    end
  end

  # Feature: contentful-delta-sync, Property 3: Deletion removes exactly the target slug rows
  # **Validates: Requirements 3.6, 3.7, 7.4**
  describe 'Property 3: Deletion removes exactly the target slug rows' do
    let(:fetcher) { Jekyll::ContentfulFetcher.new }

    DELETE_SLUGS_POOL = %w[spiez thun bern aare limmat rhein zurich luzern brienz interlaken].freeze
    DELETE_LOCALES = %w[de en].freeze

    it 'removes exactly the target slug rows and preserves all others in order' do
      property_of {
        # Generate random existing rows (2..25 rows) — ensure at least one row exists
        existing_count = range(2, 25)
        existing_rows = []
        existing_count.times do
          slug = choose(*DELETE_SLUGS_POOL)
          locale = choose(*DELETE_LOCALES)
          name = sized(range(3, 10)) { string(:alpha) }
          existing_rows << { 'slug' => slug, 'locale' => locale, 'name' => name }
        end

        # Pick a slug that is guaranteed to be present in the array
        target_slug = existing_rows.sample['slug']

        [existing_rows, target_slug]
      }.check(100) { |existing_rows, target_slug|
        filename = 'spots'
        # Deep-copy so we can compare originals
        original_rows = existing_rows.map(&:dup)
        yaml_data = { filename => existing_rows.map(&:dup) }

        # Count how many rows match the target slug before deletion
        matching_count = original_rows.count { |r| r['slug'] == target_slug }
        non_matching_rows = original_rows.reject { |r| r['slug'] == target_slug }

        fetcher.send(:remove_rows, yaml_data, filename, target_slug)

        result = yaml_data[filename]

        # Property A: No rows with the deleted slug remain
        remaining_with_slug = result.select { |r| r['slug'] == target_slug }
        expect(remaining_with_slug).to be_empty,
          "Expected no rows with slug='#{target_slug}' but found #{remaining_with_slug.size}"

        # Property B: All rows with a different slug remain unchanged and in the same order
        remaining_other = result.reject { |r| r['slug'] == target_slug }
        expect(remaining_other).to eq(non_matching_rows),
          "Expected non-matching rows to be preserved in order"

        # Property C: Row count decreases by exactly the number of matching rows
        expect(result.size).to eq(original_rows.size - matching_count),
          "Expected #{original_rows.size - matching_count} rows, got #{result.size}"
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

  # Feature: contentful-delta-sync, Property 5: Entry ID Index construction covers all entries
  # **Validates: Requirements 7.2**
  describe 'Property 5: Entry ID Index construction covers all entries' do
    let(:fetcher) { Jekyll::ContentfulFetcher.new }

    INDEX_CONTENT_TYPES = %w[spot waterway obstacle section spotType waterway_section region notice partner].freeze

    def build_mock_entry(entry_id:, slug:)
      entry = double("Entry(#{entry_id})")
      allow(entry).to receive(:sys).and_return({ id: entry_id })
      allow(entry).to receive(:fields_with_locales).and_return({ slug: { en: slug } })
      entry
    end

    it 'builds an index covering every entry with correct slug and content type' do
      property_of {
        # Generate 1..20 content types, each with 0..5 entries
        num_types = range(1, 5)
        entries_by_type = {}
        all_entries = [] # track [entry_id, slug, content_type_id] for assertions

        num_types.times do
          content_type_id = choose(*INDEX_CONTENT_TYPES)
          num_entries = range(0, 5)
          entries = []
          num_entries.times do
            entry_id = sized(range(5, 20)) { string(:alnum) }
            slug = sized(range(3, 15)) { string(:alpha) }.downcase
            entries << { entry_id: entry_id, slug: slug }
            all_entries << { entry_id: entry_id, slug: slug, content_type_id: content_type_id }
          end
          # Merge entries into the same content type if it already exists
          entries_by_type[content_type_id] ||= []
          entries_by_type[content_type_id].concat(entries)
        end

        [entries_by_type, all_entries]
      }.check(100) { |entries_by_type_raw, all_entries|
        # Build mock entry objects from the raw data
        entries_by_type = {}
        entries_by_type_raw.each do |content_type_id, entry_specs|
          entries_by_type[content_type_id] = entry_specs.map do |spec|
            build_mock_entry(entry_id: spec[:entry_id], slug: spec[:slug])
          end
        end

        index = fetcher.send(:build_entry_id_index, entries_by_type)

        # Determine expected index: last entry wins for duplicate entry IDs
        expected = {}
        all_entries.each do |e|
          expected[e[:entry_id]] = { 'slug' => e[:slug], 'content_type' => e[:content_type_id] }
        end

        # Property A: Every entry's sys.id maps to the correct slug and content type
        expected.each do |entry_id, expected_value|
          expect(index).to have_key(entry_id),
            "Expected index to contain entry_id=#{entry_id}"
          expect(index[entry_id]['slug']).to eq(expected_value['slug']),
            "Expected slug='#{expected_value['slug']}' for entry_id=#{entry_id}, got '#{index[entry_id]['slug']}'"
          expect(index[entry_id]['content_type']).to eq(expected_value['content_type']),
            "Expected content_type='#{expected_value['content_type']}' for entry_id=#{entry_id}, got '#{index[entry_id]['content_type']}'"
        end

        # Property B: Index size equals the number of unique entry IDs
        expect(index.size).to eq(expected.size),
          "Expected index size=#{expected.size}, got #{index.size}"
      }
    end
  end
end
