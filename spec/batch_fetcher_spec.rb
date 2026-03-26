# frozen_string_literal: true

require 'spec_helper'

# Test harness: include BatchFetcher into a plain class so we can test the module directly
class BatchFetcherTestHost
  include BatchFetcher
end

RSpec.describe BatchFetcher do
  let(:host) { BatchFetcherTestHost.new }
  let(:mock_client) { double('Contentful::Client') }

  before do
    allow(Jekyll.logger).to receive(:info)
    allow(Jekyll.logger).to receive(:warn)
  end

  # Helper: build a mock sync item with sys[:id]
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

  # ─── Single entry (simplest case) ─────────────────────────────────

  describe 'single entry' do
    it 'fetches one entry for one content type' do
      entry = build_entry(id: 'e1')
      page = build_page([entry])
      allow(mock_client).to receive(:entries).and_return(page)

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result).to eq({ 'spot' => [entry] })
    end

    it 'makes exactly one API call' do
      page = build_page([build_entry(id: 'e1')])
      expect(mock_client).to receive(:entries).once.and_return(page)

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end
  end

  # ─── Boundary at 300 entries (exactly ID_BATCH_SIZE) ────────────────

  describe 'boundary at 300 entries' do
    it 'fetches exactly 300 entries in a single API call' do
      entries = (1..300).map { |i| build_entry(id: "e#{i}") }
      page = build_page(entries)
      expect(mock_client).to receive(:entries).once.and_return(page)

      sync_items = (1..300).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot'].size).to eq(300)
    end

    it 'passes all 300 IDs in the sys.id[in] filter' do
      entries = (1..300).map { |i| build_entry(id: "e#{i}") }
      page = build_page(entries)

      expected_ids = (1..300).map { |i| "e#{i}" }.join(',')
      expect(mock_client).to receive(:entries).with(
        hash_including('sys.id[in]' => expected_ids)
      ).and_return(page)

      sync_items = (1..300).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      host.fetch_changed_entries_batched(mock_client, changed)
    end
  end

  # ─── Sub-batching at 301 entries ───────────────────────────────────

  describe 'sub-batching at 301 entries' do
    it 'splits 301 entries into two sub-batches (300 + 1)' do
      batch1_entries = (1..300).map { |i| build_entry(id: "e#{i}") }
      batch2_entries = [build_entry(id: 'e301')]

      call_count = 0
      allow(mock_client).to receive(:entries) do |_args|
        call_count += 1
        if call_count == 1
          build_page(batch1_entries)
        else
          build_page(batch2_entries)
        end
      end

      sync_items = (1..301).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot'].size).to eq(301)
      expect(call_count).to eq(2)
    end

    it 'sends the correct IDs in each sub-batch' do
      batch1_ids = (1..300).map { |i| "e#{i}" }
      batch2_ids = ['e301']

      calls = []
      allow(mock_client).to receive(:entries) do |args|
        calls << args['sys.id[in]']
        build_page([build_entry(id: 'dummy')])
      end

      sync_items = (1..301).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      host.fetch_changed_entries_batched(mock_client, changed)

      expect(calls[0]).to eq(batch1_ids.join(','))
      expect(calls[1]).to eq(batch2_ids.join(','))
    end
  end

  # ─── Multiple content types with mixed sizes ──────────────────────

  describe 'multiple content types with mixed sizes' do
    it 'fetches entries for each content type separately' do
      spot_entry = build_entry(id: 's1')
      waterway_entry1 = build_entry(id: 'w1')
      waterway_entry2 = build_entry(id: 'w2')

      allow(mock_client).to receive(:entries) do |args|
        case args[:content_type]
        when 'spot'
          build_page([spot_entry])
        when 'waterway'
          build_page([waterway_entry1, waterway_entry2])
        end
      end

      changed = {
        'spot' => [build_sync_item(id: 's1')],
        'waterway' => [build_sync_item(id: 'w1'), build_sync_item(id: 'w2')]
      }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot']).to eq([spot_entry])
      expect(result['waterway']).to eq([waterway_entry1, waterway_entry2])
    end

    it 'returns results keyed by content type' do
      allow(mock_client).to receive(:entries).and_return(build_page([]))

      changed = {
        'spot' => [build_sync_item(id: 's1')],
        'waterway' => [build_sync_item(id: 'w1')],
        'obstacle' => [build_sync_item(id: 'o1')]
      }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result.keys).to contain_exactly('spot', 'waterway', 'obstacle')
    end
  end

  # ─── Empty changed entries hash ─────────────────────────────────────

  describe 'empty changed entries' do
    it 'returns an empty hash' do
      result = host.fetch_changed_entries_batched(mock_client, {})
      expect(result).to eq({})
    end

    it 'makes no API calls' do
      expect(mock_client).not_to receive(:entries)
      expect(mock_client).not_to receive(:entry)

      host.fetch_changed_entries_batched(mock_client, {})
    end
  end

  # ─── Pagination ────────────────────────────────────────────────────

  describe 'pagination' do
    it 'paginates when first page returns exactly PAGE_SIZE entries' do
      page1_entries = (1..1000).map { |i| build_entry(id: "e#{i}") }
      page2_entries = (1001..1200).map { |i| build_entry(id: "e#{i}") }

      call_count = 0
      allow(mock_client).to receive(:entries) do |args|
        call_count += 1
        if args[:skip].nil? || args[:skip] == 0
          build_page(page1_entries)
        else
          build_page(page2_entries)
        end
      end

      sync_items = (1..300).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot'].size).to eq(1200)
      expect(call_count).to eq(2)
    end

    it 'stops paginating when a page returns fewer than PAGE_SIZE entries' do
      page1_entries = (1..1000).map { |i| build_entry(id: "e#{i}") }
      page2_entries = (1001..1500).map { |i| build_entry(id: "e#{i}") }

      call_count = 0
      allow(mock_client).to receive(:entries) do |args|
        call_count += 1
        if args[:skip].nil? || args[:skip] == 0
          build_page(page1_entries)
        else
          build_page(page2_entries)
        end
      end

      sync_items = (1..300).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot'].size).to eq(1500)
      expect(call_count).to eq(2)
    end

    it 'passes correct skip values for pagination' do
      skip_values = []
      allow(mock_client).to receive(:entries) do |args|
        skip_values << (args[:skip] || 0)
        # First call returns exactly 1000, second returns fewer
        if skip_values.size == 1
          build_page(Array.new(1000) { |i| build_entry(id: "e#{i}") })
        else
          build_page(Array.new(50) { |i| build_entry(id: "p#{i}") })
        end
      end

      sync_items = [build_sync_item(id: 'e1')]
      changed = { 'spot' => sync_items }
      host.fetch_changed_entries_batched(mock_client, changed)

      expect(skip_values).to eq([0, 1000])
    end
  end

  # ─── Fallback: batch error → individual success ────────────────────

  describe 'fallback: batch error then individual success' do
    it 'falls back to individual fetches when batch fails' do
      entry1 = build_entry(id: 'e1')
      entry2 = build_entry(id: 'e2')

      allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))
      allow(mock_client).to receive(:entry).with('e1', locale: '*', include: 2).and_return(entry1)
      allow(mock_client).to receive(:entry).with('e2', locale: '*', include: 2).and_return(entry2)

      changed = { 'spot' => [build_sync_item(id: 'e1'), build_sync_item(id: 'e2')] }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot']).to contain_exactly(entry1, entry2)
    end

    it 'calls client.entry for each ID in the failed batch' do
      allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))
      expect(mock_client).to receive(:entry).with('e1', locale: '*', include: 2).and_return(build_entry(id: 'e1'))
      expect(mock_client).to receive(:entry).with('e2', locale: '*', include: 2).and_return(build_entry(id: 'e2'))

      changed = { 'spot' => [build_sync_item(id: 'e1'), build_sync_item(id: 'e2')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end
  end

  # ─── Fallback: batch error → individual error → entry skipped ──────

  describe 'fallback: batch error then individual error' do
    it 'skips entries that fail individually after batch failure' do
      entry1 = build_entry(id: 'e1')

      allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))
      allow(mock_client).to receive(:entry).with('e1', locale: '*', include: 2).and_return(entry1)
      allow(mock_client).to receive(:entry).with('e2', locale: '*', include: 2).and_raise(StandardError.new('individual error'))

      changed = { 'spot' => [build_sync_item(id: 'e1'), build_sync_item(id: 'e2')] }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot']).to eq([entry1])
    end

    it 'returns empty array when all individual fetches fail' do
      allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))
      allow(mock_client).to receive(:entry).and_raise(StandardError.new('individual error'))

      changed = { 'spot' => [build_sync_item(id: 'e1'), build_sync_item(id: 'e2')] }
      result = host.fetch_changed_entries_batched(mock_client, changed)

      expect(result['spot']).to eq([])
    end
  end

  # ─── Observability log messages ──────────────────────────────────────

  describe 'observability log messages' do
    it 'logs group size and sub-batch count before fetching' do
      allow(mock_client).to receive(:entries).and_return(build_page([]))

      expect(Jekyll.logger).to receive(:info).with(
        'Contentful:', 'Batch fetching 5 spot entries in 1 API call(s)'
      )

      sync_items = (1..5).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs sub-batch count of 2 when entries exceed ID_BATCH_SIZE' do
      allow(mock_client).to receive(:entries).and_return(build_page([]))

      expect(Jekyll.logger).to receive(:info).with(
        'Contentful:', 'Batch fetching 301 spot entries in 2 API call(s)'
      )

      sync_items = (1..301).map { |i| build_sync_item(id: "e#{i}") }
      changed = { 'spot' => sync_items }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs fetch summary after each content type group' do
      allow(mock_client).to receive(:entries).and_return(build_page([build_entry(id: 'e1')]))

      expect(Jekyll.logger).to receive(:info).with(
        'Contentful:', 'Batch fetched 1 spot entries'
      )

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs overall batch fetch complete summary' do
      entry = build_entry(id: 'e1')
      allow(mock_client).to receive(:entries).and_return(build_page([entry]))

      expect(Jekyll.logger).to receive(:info).with(
        'Contentful:', 'Batch fetch complete: 1 entries in 1 API call(s) (would have been 1 without batching)'
      )

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs fallback warning when batch fetch fails' do
      allow(mock_client).to receive(:entries).and_raise(StandardError.new('timeout'))
      allow(mock_client).to receive(:entry).and_return(build_entry(id: 'e1'))

      expect(Jekyll.logger).to receive(:warn).with(
        'Contentful:', "Batch fetch failed for content type 'spot': timeout -- falling back to individual fetches (2 entries)"
      )

      changed = { 'spot' => [build_sync_item(id: 'e1'), build_sync_item(id: 'e2')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs individual fetch failure warning when fallback entry fails' do
      allow(mock_client).to receive(:entries).and_raise(StandardError.new('batch error'))
      allow(mock_client).to receive(:entry).with('e1', locale: '*', include: 2).and_raise(StandardError.new('not found'))

      expect(Jekyll.logger).to receive(:warn).with(
        'Contentful:', "Individual fetch failed for entry 'e1': not found -- skipping"
      )

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end

    it 'logs pagination offset when fetching additional pages' do
      page1 = build_page(Array.new(1000) { |i| build_entry(id: "e#{i}") })
      page2 = build_page([build_entry(id: 'last')])

      call_count = 0
      allow(mock_client).to receive(:entries) do |_args|
        call_count += 1
        call_count == 1 ? page1 : page2
      end

      expect(Jekyll.logger).to receive(:info).with(
        'Contentful:', 'Fetching page at offset 1000 for spot batch'
      )

      changed = { 'spot' => [build_sync_item(id: 'e1')] }
      host.fetch_changed_entries_batched(mock_client, changed)
    end
  end
end
