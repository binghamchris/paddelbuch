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
  end
end
