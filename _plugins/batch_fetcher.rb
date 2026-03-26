# frozen_string_literal: true

# Jekyll plugin support module for batched Contentful CDA fetching.
# This module provides batch-optimized entry fetching using sys.id[in] filtering,
# reducing HTTP requests from O(N) per-entry to O(C) per-content-type during delta sync.
#
# Mixed into ContentfulFetcher, consistent with the SyncChecker mixin pattern.

module BatchFetcher
  ID_BATCH_SIZE = 300
  PAGE_SIZE = 1000

  # Fetches all changed entries in batches, grouped by content type.
  # Returns a Hash: { content_type_id => [Contentful::Entry, ...] }
  #
  # @param client [Contentful::Client] the CDA client
  # @param changed_entries [Hash] { content_type_id => [sync_item, ...] } from SyncResult
  # @return [Hash] { content_type_id => [Contentful::Entry, ...] }
  def fetch_changed_entries_batched(client, changed_entries)
    results = {}
    total_calls = 0
    total_entries = 0
    individual_count = changed_entries.values.flatten.size

    changed_entries.each do |content_type_id, sync_items|
      entry_ids = sync_items.map { |item| item.sys[:id] }
      fetched, calls = fetch_content_type_batch(client, content_type_id, entry_ids)
      results[content_type_id] = fetched
      total_calls += calls
      total_entries += fetched.size
    end

    Jekyll.logger.info 'Contentful:', "Batch fetch complete: #{total_entries} entries in #{total_calls} API call(s) (would have been #{individual_count} without batching)"

    results
  end

  private

  # Fetches entries for a single content type group, handling sub-batching and pagination.
  # @param client [Contentful::Client]
  # @param content_type_id [String]
  # @param entry_ids [Array<String>]
  # @return [Array(Array<Contentful::Entry>, Integer)] entries and API call count
  def fetch_content_type_batch(client, content_type_id, entry_ids)
    sub_batches = entry_ids.each_slice(ID_BATCH_SIZE).to_a
    sub_batch_count = sub_batches.size

    Jekyll.logger.info 'Contentful:', "Batch fetching #{entry_ids.size} #{content_type_id} entries in #{sub_batch_count} API call(s)"

    all_entries = []
    call_count = 0

    sub_batches.each do |id_batch|
      begin
        fetched, calls = fetch_sub_batch(client, content_type_id, id_batch)
        all_entries.concat(fetched)
        call_count += calls
      rescue StandardError => e
        Jekyll.logger.warn 'Contentful:', "Batch fetch failed for content type '#{content_type_id}': #{e.message} -- falling back to individual fetches (#{id_batch.size} entries)"
        fallback = fetch_entries_individually(client, id_batch)
        all_entries.concat(fallback)
        call_count += id_batch.size
      end
    end

    Jekyll.logger.info 'Contentful:', "Batch fetched #{all_entries.size} #{content_type_id} entries"

    [all_entries, call_count]
  end

  # Fetches a single sub-batch with pagination.
  # @param client [Contentful::Client]
  # @param content_type_id [String]
  # @param id_batch [Array<String>] up to ID_BATCH_SIZE IDs
  # @return [Array(Array<Contentful::Entry>, Integer)] entries and API call count
  def fetch_sub_batch(client, content_type_id, id_batch)
    all_entries = []
    skip = 0
    call_count = 0

    loop do
      if skip > 0
        Jekyll.logger.info 'Contentful:', "Fetching page at offset #{skip} for #{content_type_id} batch"
      end

      page = client.entries(
        content_type: content_type_id,
        'sys.id[in]' => id_batch.join(','),
        locale: '*',
        include: 2,
        limit: PAGE_SIZE,
        skip: skip
      )

      page_items = page.to_a
      all_entries.concat(page_items)
      call_count += 1

      break if page_items.size < PAGE_SIZE

      skip += PAGE_SIZE
    end

    [all_entries, call_count]
  end

  # Falls back to individual client.entry() calls for a list of IDs.
  # @param client [Contentful::Client]
  # @param entry_ids [Array<String>]
  # @return [Array<Contentful::Entry>]
  def fetch_entries_individually(client, entry_ids)
    entries = []

    entry_ids.each do |entry_id|
      begin
        entry = client.entry(entry_id, locale: '*', include: 2)
        entries << entry
      rescue StandardError => e
        Jekyll.logger.warn 'Contentful:', "Individual fetch failed for entry '#{entry_id}': #{e.message} -- skipping"
      end
    end

    entries
  end
end
