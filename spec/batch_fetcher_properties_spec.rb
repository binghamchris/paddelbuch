# frozen_string_literal: true

require 'spec_helper'

# Test harness: include BatchFetcher into a plain class so we can test the module directly
class BatchFetcherPropertyTestHost
  include BatchFetcher
end

RSpec.describe 'BatchFetcher Properties' do
  let(:host) { BatchFetcherPropertyTestHost.new }

  before do
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  # Helper: build a mock sync item with sys[:id] and content type
  def build_sync_item(id:)
    item = double("SyncItem-#{id}")
    allow(item).to receive(:sys).and_return({ id: id })
    item
  end

  # Helper: build a mock entry
  def build_entry(id:)
    entry = double("Entry-#{id}")
    allow(entry).to receive(:sys).and_return({ id: id })
    entry
  end

  # Helper: build a mock page response from client.entries
  def build_page(entries)
    page = double('Page')
    allow(page).to receive(:to_a).and_return(entries)
    page
  end

  CONTENT_TYPE_POOL = %w[spot waterway obstacle section spotType waterway_section region notice partner].freeze

  # Feature: batched-delta-sync, Property 1: Grouping preserves all entry IDs by content type
  # **Validates: Requirements 1.1**
  describe 'Property 1: Grouping preserves all entry IDs by content type' do
    it 'preserves all entry IDs grouped by content type with no loss or duplication' do
      property_of {
        # Generate 1..5 content types, each with 1..20 entry IDs
        num_types = range(1, 5)
        changed_entries = {}
        all_input_ids = []

        num_types.times do
          ct_id = choose(*CONTENT_TYPE_POOL)
          num_entries = range(1, 20)
          entries = []
          num_entries.times do
            entry_id = sized(range(5, 22)) { string(:alnum) }
            entries << { id: entry_id, ct: ct_id }
            all_input_ids << { id: entry_id, ct: ct_id }
          end
          changed_entries[ct_id] ||= []
          changed_entries[ct_id].concat(entries)
        end

        [changed_entries, all_input_ids]
      }.check(100) { |changed_entries_raw, all_input_ids|
        # Build the changed_entries hash with mock sync items
        changed_entries = {}
        changed_entries_raw.each do |ct_id, entries|
          changed_entries[ct_id] = entries.map { |e| build_sync_item(id: e[:id]) }
        end

        # Mock client to return entries matching the requested IDs
        mock_client = double('Contentful::Client')
        allow(mock_client).to receive(:entries) do |args|
          ids = args['sys.id[in]'].split(',')
          build_page(ids.map { |id| build_entry(id: id) })
        end

        result = host.fetch_changed_entries_batched(mock_client, changed_entries)

        # (a) Every input entry ID appears in exactly one group in the result
        result_ids_by_ct = {}
        result.each do |ct_id, entries|
          result_ids_by_ct[ct_id] = entries.map { |e| e.sys[:id] }
        end

        all_result_ids = result_ids_by_ct.values.flatten

        # (b) The group key matches the entry's content type
        result.each_key do |ct_id|
          expect(changed_entries).to have_key(ct_id),
            "Result contains content type '#{ct_id}' not present in input"
        end

        # (c) No entry IDs are lost — every input ID appears in the result
        input_ids_by_ct = {}
        all_input_ids.each do |entry|
          input_ids_by_ct[entry[:ct]] ||= []
          input_ids_by_ct[entry[:ct]] << entry[:id]
        end

        input_ids_by_ct.each do |ct_id, ids|
          expect(result_ids_by_ct).to have_key(ct_id),
            "Expected result to contain content type '#{ct_id}'"
          ids.each do |id|
            expect(result_ids_by_ct[ct_id]).to include(id),
              "Expected entry ID '#{id}' in content type '#{ct_id}' result"
          end
        end

        # No duplicates across all groups
        expect(all_result_ids.size).to eq(all_result_ids.uniq.size),
          "Expected no duplicate entry IDs across groups, but found duplicates"
      }
    end
  end

  # Feature: batched-delta-sync, Property 2: Batch call count matches expected sub-batch formula
  # **Validates: Requirements 1.2, 1.3, 2.3, 5.1, 5.2**
  describe 'Property 2: Batch call count matches ceil(group_size / ID_BATCH_SIZE) formula' do
    it 'issues exactly sum of ceil(group_size / ID_BATCH_SIZE) client.entries calls' do
      property_of {
        # Generate 1..4 content types, each with 1..1000 entry IDs
        num_types = range(1, 4)
        groups = {}
        num_types.times do
          ct_id = choose(*CONTENT_TYPE_POOL)
          group_size = range(1, 1000)
          groups[ct_id] = group_size
        end
        groups
      }.check(100) { |groups|
        # Build changed_entries with the specified group sizes
        changed_entries = {}
        groups.each do |ct_id, size|
          changed_entries[ct_id] = (1..size).map { |i| build_sync_item(id: "#{ct_id}_e#{i}") }
        end

        # Track actual client.entries call count
        actual_calls = 0
        mock_client = double('Contentful::Client')
        allow(mock_client).to receive(:entries) do |args|
          actual_calls += 1
          ids = args['sys.id[in]'].split(',')
          build_page(ids.map { |id| build_entry(id: id) })
        end

        host.fetch_changed_entries_batched(mock_client, changed_entries)

        # Expected: sum of ceil(group_size / ID_BATCH_SIZE) for each content type
        expected_calls = groups.values.sum { |size| (size.to_f / BatchFetcher::ID_BATCH_SIZE).ceil }

        expect(actual_calls).to eq(expected_calls),
          "Expected #{expected_calls} API calls for groups #{groups.inspect}, got #{actual_calls}"
      }
    end
  end

  # Feature: batched-delta-sync, Property 3: Pagination collects all entries across pages
  # **Validates: Requirements 2.1, 2.2**
  describe 'Property 3: Pagination collects all entries across pages' do
    it 'collects all T entries across multiple pages with no loss or duplication' do
      property_of {
        # Generate a total entry count between 1 and 3000 for a single content type
        total_entries = range(1, 3000)
        total_entries
      }.check(100) { |total_entries|
        ct_id = 'spot'
        # We need to sub-batch the IDs if > ID_BATCH_SIZE
        # For simplicity, generate IDs and let the code handle sub-batching
        entry_ids = (1..total_entries).map { |i| "e#{i}" }
        changed_entries = { ct_id => entry_ids.map { |id| build_sync_item(id: id) } }

        # Build all expected entries upfront
        all_expected_entries = entry_ids.map { |id| build_entry(id: id) }
        entries_by_id = all_expected_entries.each_with_object({}) { |e, h| h[e.sys[:id]] = e }

        mock_client = double('Contentful::Client')
        allow(mock_client).to receive(:entries) do |args|
          ids = args['sys.id[in]'].split(',')
          skip = args[:skip] || 0

          # Simulate: the "full result set" for this sub-batch is all entries matching the IDs
          matching = ids.map { |id| entries_by_id[id] }.compact

          # Paginate: return PAGE_SIZE entries starting at skip
          page_entries = matching[skip, BatchFetcher::PAGE_SIZE] || []
          build_page(page_entries)
        end

        result = host.fetch_changed_entries_batched(mock_client, changed_entries)

        result_ids = result[ct_id].map { |e| e.sys[:id] }

        # All entries collected, none lost
        expect(result_ids.size).to eq(total_entries),
          "Expected #{total_entries} entries, got #{result_ids.size}"

        # No duplicates
        expect(result_ids.size).to eq(result_ids.uniq.size),
          "Expected no duplicate entries"
      }
    end
  end

  # Feature: batched-delta-sync, Property 4: Every batched request includes required parameters
  # **Validates: Requirements 1.4**
  describe 'Property 4: Every batched request includes locale: \'*\' and include: 2' do
    it 'passes locale: \'*\' and include: 2 on every client.entries call' do
      property_of {
        # Generate 1..3 content types, each with 1..600 entry IDs (may trigger sub-batching)
        num_types = range(1, 3)
        groups = {}
        num_types.times do
          ct_id = choose(*CONTENT_TYPE_POOL)
          group_size = range(1, 600)
          groups[ct_id] = group_size
        end
        groups
      }.check(100) { |groups|
        changed_entries = {}
        groups.each do |ct_id, size|
          changed_entries[ct_id] = (1..size).map { |i| build_sync_item(id: "#{ct_id}_e#{i}") }
        end

        captured_args = []
        mock_client = double('Contentful::Client')
        allow(mock_client).to receive(:entries) do |args|
          captured_args << args.dup
          ids = args['sys.id[in]'].split(',')
          build_page(ids.map { |id| build_entry(id: id) })
        end

        host.fetch_changed_entries_batched(mock_client, changed_entries)

        # Every call must include locale: '*' and include: 2
        captured_args.each_with_index do |args, idx|
          expect(args[:locale]).to eq('*'),
            "Call #{idx} missing locale: '*', got #{args[:locale].inspect}"
          expect(args[:include]).to eq(2),
            "Call #{idx} missing include: 2, got #{args[:include].inspect}"
        end
      }
    end
  end

  # Feature: batched-delta-sync, Property 5: Batch failure triggers individual fallback for all IDs in the failed group
  # **Validates: Requirements 4.1, 4.2**
  describe 'Property 5: Batch failure triggers individual fallback for all IDs in the failed group' do
    it 'falls back to client.entry for every ID in the failed group and returns successful entries' do
      property_of {
        # Generate a single content type group with 1..50 entry IDs
        group_size = range(1, 50)
        # Randomly decide which individual fetches succeed (true) or fail (false)
        outcomes = Array.new(group_size) { choose(true, false) }
        [group_size, outcomes]
      }.check(100) { |group_size, outcomes|
        ct_id = 'spot'
        entry_ids = (1..group_size).map { |i| "e#{i}" }
        changed_entries = { ct_id => entry_ids.map { |id| build_sync_item(id: id) } }

        # Make batch call always fail
        mock_client = double('Contentful::Client')
        allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))

        # Track individual fallback calls
        individual_calls = []
        allow(mock_client).to receive(:entry) do |entry_id, **_opts|
          individual_calls << entry_id
          idx = entry_ids.index(entry_id)
          if outcomes[idx]
            build_entry(id: entry_id)
          else
            raise StandardError, "individual error for #{entry_id}"
          end
        end

        result = host.fetch_changed_entries_batched(mock_client, changed_entries)

        # Every ID in the group should have been attempted individually
        expect(individual_calls).to match_array(entry_ids),
          "Expected individual fallback for all #{group_size} IDs, got #{individual_calls.size} calls"

        # The result should contain only the entries that succeeded
        expected_success_count = outcomes.count(true)
        expect(result[ct_id].size).to eq(expected_success_count),
          "Expected #{expected_success_count} successful entries, got #{result[ct_id].size}"

        # Verify the returned entries have the correct IDs
        successful_ids = entry_ids.zip(outcomes).select { |_, ok| ok }.map(&:first)
        result_ids = result[ct_id].map { |e| e.sys[:id] }
        expect(result_ids).to match_array(successful_ids)
      }
    end
  end
end
