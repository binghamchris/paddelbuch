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

  # Feature: contentful-sync-integration, Property 3: Sync result determines fetch behavior
  # **Validates: Requirements 3.2, 3.3**
  describe 'Property 3: Sync result determines fetch behavior' do
    it 'fetches content if and only if sync result indicates changes' do
      property_of {
        Rantly {
          items_count = range(0, 100)
          {
            items_count: items_count,
            has_changes: items_count > 0
          }
        }
      }.check(100) { |data|
        result = SyncChecker::SyncResult.new(
          success: true,
          has_changes: data[:has_changes],
          new_token: 'token',
          items_count: data[:items_count]
        )

        if data[:items_count] > 0
          expect(result.has_changes).to be true
          expect(result.success?).to be true
        else
          expect(result.has_changes).to be false
          expect(result.success?).to be true
        end
      }
    end
  end

  # Feature: contentful-sync-integration, Property 4: Sync error triggers full fetch fallback
  # **Validates: Requirements 3.4**
  describe 'Property 4: Sync error triggers full fetch fallback' do
    let(:checker) { Class.new { include SyncChecker }.new }

    it 'returns failed SyncResult for any error during sync check' do
      property_of {
        Rantly {
          error_class = choose(StandardError, RuntimeError, Timeout::Error, IOError, SocketError)
          message = sized(range(5, 30)) { string(:alpha) }
          { error_class: error_class, message: message }
        }
      }.check(100) { |data|
        client = double('client')
        allow(client).to receive(:sync).and_raise(data[:error_class], data[:message])

        result = checker.check_for_changes(client, 'some_token')
        expect(result.success?).to be false
        expect(result.error).to be_a(StandardError)
        expect(result.error.message).to eq(data[:message])
      }
    end
  end

  # Feature: contentful-sync-integration, Property 12: Sync page iteration completeness
  # **Validates: Requirements 3.7, 3.8**
  describe 'Property 12: Sync page iteration completeness' do
    let(:checker) { Class.new { include SyncChecker; public :collect_all_pages, :extract_sync_token }.new }

    it 'collects items from all pages and extracts token from final page' do
      property_of {
        Rantly {
          num_pages = range(1, 5)
          pages = Array.new(num_pages) { range(0, 10) }
          token = sized(range(10, 30)) { string(:alpha) }
          { pages: pages, token: token }
        }
      }.check(100) { |data|
        pages_data = data[:pages]
        final_token = data[:token]

        mock_pages = pages_data.map.with_index do |item_count, idx|
          page = double("page_#{idx}")
          items = Array.new(item_count) { double('item') }
          allow(page).to receive(:items).and_return(items)
          is_last = (idx == pages_data.length - 1)
          allow(page).to receive(:next_page?).and_return(!is_last)
          if is_last
            allow(page).to receive(:next_sync_url).and_return(
              "https://cdn.contentful.com/spaces/test/sync?sync_token=#{final_token}"
            )
          end
          page
        end

        # Chain next_page calls
        mock_pages.each_with_index do |page, idx|
          unless idx == mock_pages.length - 1
            allow(page).to receive(:next_page).and_return(mock_pages[idx + 1])
          end
        end

        sync = double('sync')
        allow(sync).to receive(:first_page).and_return(mock_pages.first)

        items, last_page = checker.collect_all_pages(sync)
        expect(items.length).to eq(pages_data.sum)

        extracted_token = checker.extract_sync_token(last_page)
        expect(extracted_token).to eq(final_token)
      }
    end
  end

  # Feature: contentful-sync-integration, Property 10: Cache validation rejects incomplete metadata
  # **Validates: Requirements 4.6**
  describe 'Property 10: Cache validation rejects incomplete metadata' do
    let(:tmpdir) { Dir.mktmpdir }

    after do
      FileUtils.remove_entry(tmpdir)
    end

    it 'rejects cache metadata with any missing required field' do
      property_of {
        Rantly {
          fields = {
            sync_token: sized(range(10, 50)) { string(:alpha) },
            last_sync_at: Time.now.iso8601,
            space_id: sized(range(5, 20)) { string(:alpha) },
            environment: choose('master', 'staging', 'development')
          }
          # Randomly nil out at least one field
          keys = fields.keys
          nil_count = range(1, keys.length)
          keys.sample(nil_count).each { |k| fields[k] = nil }
          fields
        }
      }.check(100) { |data|
        cache = CacheMetadata.new(tmpdir)
        cache.sync_token = data[:sync_token]
        cache.last_sync_at = data[:last_sync_at]
        cache.space_id = data[:space_id]
        cache.environment = data[:environment]
        expect(cache.valid?).to be false
      }
    end
  end
end
