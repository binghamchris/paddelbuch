# frozen_string_literal: true

require 'spec_helper'

# Test harness: include SyncChecker in a class so we can test its methods
class SyncCheckerHost
  include SyncChecker
end

RSpec.describe SyncChecker do
  let(:host) { SyncCheckerHost.new }
  let(:client) { double('Contentful::Client') }

  # Helper to build a mock SyncPage
  def build_mock_page(items:, has_next: false, next_page_mock: nil, sync_url: nil)
    page = double('SyncPage')
    allow(page).to receive(:items).and_return(items)
    allow(page).to receive(:next_page?).and_return(has_next)
    allow(page).to receive(:next_page).and_return(next_page_mock) if has_next
    allow(page).to receive(:next_sync_url).and_return(sync_url) unless has_next
    page
  end

  def sync_url_with_token(token)
    "https://cdn.contentful.com/spaces/abc/sync?sync_token=#{token}"
  end

  # Helper to build a mock sync item with sys metadata (Contentful SDK style)
  # sys returns a hash with symbol keys: { type:, contentType: }
  # contentType is an object that also responds to sys returning { id: }
  def build_sync_item(type:, content_type_id: nil, entry_id: nil)
    item = double("SyncItem(#{type}/#{content_type_id})")
    sys_hash = { type: type }
    sys_hash[:id] = entry_id if entry_id
    if content_type_id
      ct_obj = double("ContentType(#{content_type_id})")
      allow(ct_obj).to receive(:sys).and_return({ id: content_type_id })
      sys_hash[:content_type] = ct_obj
    end
    allow(item).to receive(:sys).and_return(sys_hash)
    item
  end

  describe '#check_for_changes' do
    context 'with no changes (empty items)' do
      it 'returns success with has_changes: false' do
        page = build_mock_page(items: [], sync_url: sync_url_with_token('new_token_123'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'old_token').and_return(sync)

        result = host.check_for_changes(client, 'old_token')

        expect(result.success).to be true
        expect(result.has_changes).to be false
        expect(result.new_token).to eq('new_token_123')
        expect(result.items_count).to eq(0)
        expect(result.error).to be_nil
      end
    end

    context 'with changes (non-empty items)' do
      it 'returns success with has_changes: true' do
        items = [double('Entry1'), double('Entry2')]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('updated_token'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'old_token').and_return(sync)

        result = host.check_for_changes(client, 'old_token')

        expect(result.success).to be true
        expect(result.has_changes).to be true
        expect(result.new_token).to eq('updated_token')
        expect(result.items_count).to eq(2)
      end
    end

    context 'with a network error' do
      it 'returns success: false with the error captured' do
        error = StandardError.new('Connection refused')
        allow(client).to receive(:sync).and_raise(error)

        result = host.check_for_changes(client, 'some_token')

        expect(result.success).to be false
        expect(result.success?).to be false
        expect(result.error).to eq(error)
        expect(result.error.message).to eq('Connection refused')
      end
    end

    it 'calls client.sync with the sync_token parameter' do
      page = build_mock_page(items: [], sync_url: sync_url_with_token('t'))
      sync = double('Sync')
      allow(sync).to receive(:first_page).and_return(page)
      expect(client).to receive(:sync).with(sync_token: 'my_token').and_return(sync)

      host.check_for_changes(client, 'my_token')
    end
  end

  describe '#check_for_changes with known_content_types (delta extraction)' do
    let(:known_types) { %w[spot waterway obstacle] }

    context 'with empty delta' do
      it 'returns empty changed_entries and deleted_entries' do
        page = build_mock_page(items: [], sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.success).to be true
        expect(result.has_changes).to be false
        expect(result.changed_entries).to eq({})
        expect(result.deleted_entries).to eq({})
        expect(result.unknown_content_types).to eq([])
        expect(result.items_count).to eq(0)
      end
    end

    context 'with mixed item types' do
      it 'classifies Entry, DeletedEntry, Asset, and DeletedAsset correctly' do
        entry_spot = build_sync_item(type: 'Entry', content_type_id: 'spot')
        entry_waterway = build_sync_item(type: 'Entry', content_type_id: 'waterway')
        deleted_obstacle = build_sync_item(type: 'DeletedEntry', content_type_id: 'obstacle')
        asset_item = build_sync_item(type: 'Asset')
        deleted_asset = build_sync_item(type: 'DeletedAsset')

        items = [entry_spot, entry_waterway, deleted_obstacle, asset_item, deleted_asset]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.success).to be true
        expect(result.has_changes).to be true
        expect(result.items_count).to eq(5)

        # Entry items grouped by content type in changed_entries
        expect(result.changed_entries.keys).to contain_exactly('spot', 'waterway')
        expect(result.changed_entries['spot']).to eq([entry_spot])
        expect(result.changed_entries['waterway']).to eq([entry_waterway])

        # DeletedEntry items grouped by content type in deleted_entries
        expect(result.deleted_entries.keys).to contain_exactly('obstacle')
        expect(result.deleted_entries['obstacle']).to eq([deleted_obstacle])

        # Assets are ignored — not in changed or deleted
        all_classified = result.changed_entries.values.flatten + result.deleted_entries.values.flatten
        expect(all_classified).not_to include(asset_item)
        expect(all_classified).not_to include(deleted_asset)

        expect(result.unknown_content_types).to eq([])
      end

      it 'groups multiple entries of the same content type together' do
        spot1 = build_sync_item(type: 'Entry', content_type_id: 'spot')
        spot2 = build_sync_item(type: 'Entry', content_type_id: 'spot')
        del_spot = build_sync_item(type: 'DeletedEntry', content_type_id: 'spot')

        items = [spot1, spot2, del_spot]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.changed_entries['spot']).to eq([spot1, spot2])
        expect(result.deleted_entries['spot']).to eq([del_spot])
      end
    end

    context 'with unknown content types' do
      it 'excludes unknown types and collects them in unknown_content_types' do
        known_entry = build_sync_item(type: 'Entry', content_type_id: 'spot')
        unknown_entry = build_sync_item(type: 'Entry', content_type_id: 'blogPost')
        unknown_deleted = build_sync_item(type: 'DeletedEntry', content_type_id: 'author')

        items = [known_entry, unknown_entry, unknown_deleted]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.changed_entries.keys).to contain_exactly('spot')
        expect(result.changed_entries['spot']).to eq([known_entry])
        expect(result.deleted_entries).to eq({})
        expect(result.unknown_content_types).to contain_exactly('blogPost', 'author')
        expect(result.items_count).to eq(3)
      end

      it 'deduplicates unknown content type IDs' do
        unk1 = build_sync_item(type: 'Entry', content_type_id: 'blogPost')
        unk2 = build_sync_item(type: 'Entry', content_type_id: 'blogPost')
        unk3 = build_sync_item(type: 'DeletedEntry', content_type_id: 'blogPost')

        items = [unk1, unk2, unk3]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.unknown_content_types).to eq(['blogPost'])
      end
    end

    context 'with multi-page sync' do
      it 'collects and classifies items from all pages' do
        spot_entry = build_sync_item(type: 'Entry', content_type_id: 'spot')
        waterway_entry = build_sync_item(type: 'Entry', content_type_id: 'waterway')
        deleted_spot = build_sync_item(type: 'DeletedEntry', content_type_id: 'spot')
        asset = build_sync_item(type: 'Asset')

        page2 = build_mock_page(
          items: [deleted_spot, asset],
          sync_url: sync_url_with_token('final_tok')
        )
        page1 = build_mock_page(
          items: [spot_entry, waterway_entry],
          has_next: true,
          next_page_mock: page2
        )

        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page1)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.success).to be true
        expect(result.items_count).to eq(4)
        expect(result.new_token).to eq('final_tok')
        expect(result.changed_entries['spot']).to eq([spot_entry])
        expect(result.changed_entries['waterway']).to eq([waterway_entry])
        expect(result.deleted_entries['spot']).to eq([deleted_spot])
      end
    end

    context 'with nil contentType on sync items' do
      it 'skips Entry items that have no sys.contentType' do
        known_entry = build_sync_item(type: 'Entry', content_type_id: 'spot')
        nil_entry = build_sync_item(type: 'Entry')

        items = [known_entry, nil_entry]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types)

        expect(result.changed_entries.keys).to contain_exactly('spot')
        expect(result.deleted_entries).to eq({})
      end

      it 'resolves DeletedEntry without contentType via entry_id_index' do
        deleted_item = build_sync_item(type: 'DeletedEntry', entry_id: 'entry123')
        entry_id_index = { 'entry123' => { 'slug' => 'my-spot', 'content_type' => 'spot' } }

        items = [deleted_item]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types, entry_id_index)

        expect(result.deleted_entries.keys).to contain_exactly('spot')
        expect(result.deleted_entries['spot']).to eq([deleted_item])
      end

      it 'skips DeletedEntry when not in entry_id_index and no contentType' do
        deleted_item = build_sync_item(type: 'DeletedEntry', entry_id: 'unknown_id')

        items = [deleted_item]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types, {})

        expect(result.changed_entries).to eq({})
        expect(result.deleted_entries).to eq({})
      end

      it 'treats index-resolved unknown content type as unknown' do
        deleted_item = build_sync_item(type: 'DeletedEntry', entry_id: 'entry456')
        entry_id_index = { 'entry456' => { 'slug' => 'my-post', 'content_type' => 'blogPost' } }

        items = [deleted_item]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1', known_types, entry_id_index)

        expect(result.deleted_entries).to eq({})
        expect(result.unknown_content_types).to contain_exactly('blogPost')
      end
    end

    context 'backward compatibility' do
      it 'works without known_content_types (nil)' do
        items = [double('Entry1'), double('Entry2')]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('tok2'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(sync_token: 'tok1').and_return(sync)

        result = host.check_for_changes(client, 'tok1')

        expect(result.success).to be true
        expect(result.has_changes).to be true
        expect(result.items_count).to eq(2)
        # Without known_content_types, delta fields are nil
        expect(result.changed_entries).to be_nil
        expect(result.deleted_entries).to be_nil
        expect(result.unknown_content_types).to be_nil
      end
    end
  end

  describe '#initial_sync' do
    context 'with items returned' do
      it 'returns success with has_changes: true always' do
        items = [double('Entry')]
        page = build_mock_page(items: items, sync_url: sync_url_with_token('initial_token'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(initial: true).and_return(sync)

        result = host.initial_sync(client)

        expect(result.success).to be true
        expect(result.has_changes).to be true
        expect(result.new_token).to eq('initial_token')
        expect(result.items_count).to eq(1)
        expect(result.error).to be_nil
      end
    end

    context 'with empty items' do
      it 'still returns has_changes: true' do
        page = build_mock_page(items: [], sync_url: sync_url_with_token('empty_token'))
        sync = double('Sync')
        allow(sync).to receive(:first_page).and_return(page)
        allow(client).to receive(:sync).with(initial: true).and_return(sync)

        result = host.initial_sync(client)

        expect(result.success).to be true
        expect(result.has_changes).to be true
        expect(result.items_count).to eq(0)
      end
    end

    context 'with an error' do
      it 'returns success: false with the error captured' do
        error = RuntimeError.new('API rate limit exceeded')
        allow(client).to receive(:sync).and_raise(error)

        result = host.initial_sync(client)

        expect(result.success).to be false
        expect(result.error).to eq(error)
        expect(result.error.message).to eq('API rate limit exceeded')
      end
    end

    it 'calls client.sync with initial: true' do
      page = build_mock_page(items: [], sync_url: sync_url_with_token('t'))
      sync = double('Sync')
      allow(sync).to receive(:first_page).and_return(page)
      expect(client).to receive(:sync).with(initial: true).and_return(sync)

      host.initial_sync(client)
    end
  end

  describe 'multi-page iteration' do
    it 'collects items from all 3 pages' do
      page3 = build_mock_page(
        items: [double('E5'), double('E6')],
        sync_url: sync_url_with_token('final_token')
      )
      page2 = build_mock_page(
        items: [double('E3'), double('E4')],
        has_next: true,
        next_page_mock: page3
      )
      page1 = build_mock_page(
        items: [double('E1'), double('E2')],
        has_next: true,
        next_page_mock: page2
      )

      sync = double('Sync')
      allow(sync).to receive(:first_page).and_return(page1)
      allow(client).to receive(:sync).with(sync_token: 'tok').and_return(sync)

      result = host.check_for_changes(client, 'tok')

      expect(result.success).to be true
      expect(result.items_count).to eq(6)
      expect(result.new_token).to eq('final_token')
    end
  end

  describe 'token extraction' do
    it 'extracts sync_token from next_sync_url' do
      token = 'w5ZGw6JFwqZmVcKsE8Kow4grw45QdybCnV'
      url = "https://cdn.contentful.com/spaces/abc123/environments/master/sync?sync_token=#{token}"
      page = build_mock_page(items: [], sync_url: url)
      sync = double('Sync')
      allow(sync).to receive(:first_page).and_return(page)
      allow(client).to receive(:sync).with(sync_token: 'old').and_return(sync)

      result = host.check_for_changes(client, 'old')

      expect(result.new_token).to eq(token)
    end

    it 'handles URL-encoded sync tokens' do
      token = 'abc%2Bdef%3Dghi'
      url = "https://cdn.contentful.com/spaces/abc/sync?sync_token=#{token}"
      page = build_mock_page(items: [], sync_url: url)
      sync = double('Sync')
      allow(sync).to receive(:first_page).and_return(page)
      allow(client).to receive(:sync).with(sync_token: 'old').and_return(sync)

      result = host.check_for_changes(client, 'old')

      expect(result.new_token).to eq('abc+def=ghi')
    end
  end

  describe 'SyncResult struct' do
    it 'supports keyword initialization' do
      result = SyncChecker::SyncResult.new(
        success: true,
        has_changes: false,
        new_token: 'tok',
        items_count: 5,
        error: nil
      )

      expect(result.success).to be true
      expect(result.success?).to be true
      expect(result.has_changes).to be false
      expect(result.new_token).to eq('tok')
      expect(result.items_count).to eq(5)
      expect(result.error).to be_nil
    end

    it 'success? returns false when success is false' do
      result = SyncChecker::SyncResult.new(success: false, error: StandardError.new('fail'))

      expect(result.success?).to be false
    end

    it 'includes changed_entries, deleted_entries, and unknown_content_types fields' do
      changed = { 'spot' => [double('Entry1')] }
      deleted = { 'waterway' => [double('DeletedEntry1')] }
      unknown = ['unknownType']

      result = SyncChecker::SyncResult.new(
        success: true,
        has_changes: true,
        new_token: 'tok',
        items_count: 3,
        changed_entries: changed,
        deleted_entries: deleted,
        unknown_content_types: unknown
      )

      expect(result.changed_entries).to eq(changed)
      expect(result.deleted_entries).to eq(deleted)
      expect(result.unknown_content_types).to eq(unknown)
    end

    it 'defaults new fields to nil when not provided' do
      result = SyncChecker::SyncResult.new(
        success: true,
        has_changes: false,
        new_token: 'tok',
        items_count: 0
      )

      expect(result.changed_entries).to be_nil
      expect(result.deleted_entries).to be_nil
      expect(result.unknown_content_types).to be_nil
    end

    it 'preserves existing fields unchanged alongside new fields' do
      result = SyncChecker::SyncResult.new(
        success: true,
        has_changes: true,
        new_token: 'new_tok',
        items_count: 10,
        error: nil,
        changed_entries: {},
        deleted_entries: {},
        unknown_content_types: []
      )

      expect(result.success).to be true
      expect(result.has_changes).to be true
      expect(result.new_token).to eq('new_tok')
      expect(result.items_count).to eq(10)
      expect(result.error).to be_nil
      expect(result.changed_entries).to eq({})
      expect(result.deleted_entries).to eq({})
      expect(result.unknown_content_types).to eq([])
    end
  end
end
