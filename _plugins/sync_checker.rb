# frozen_string_literal: true

require 'uri'

module SyncChecker
  SyncResult = Struct.new(
    :success, :has_changes, :new_token, :items_count, :error,
    :changed_entries, :deleted_entries, :unknown_content_types,
    keyword_init: true
  ) do
    def success?
      success
    end
  end

  def check_for_changes(client, sync_token)
    sync = client.sync(sync_token: sync_token)
    items, last_page = collect_all_pages(sync)
    new_token = extract_sync_token(last_page)
    SyncResult.new(
      success: true,
      has_changes: !items.empty?,
      new_token: new_token,
      items_count: items.size
    )
  rescue StandardError => e
    SyncResult.new(success: false, error: e)
  end

  def initial_sync(client)
    sync = client.sync(initial: true)
    items, last_page = collect_all_pages(sync)
    new_token = extract_sync_token(last_page)
    SyncResult.new(
      success: true,
      has_changes: true,
      new_token: new_token,
      items_count: items.size
    )
  rescue StandardError => e
    SyncResult.new(success: false, error: e)
  end

  private

  def collect_all_pages(sync)
    page = sync.first_page
    items = page.items.to_a
    while page.next_page?
      page = page.next_page
      items.concat(page.items.to_a)
    end
    [items, page]
  end

  def extract_sync_token(page)
    uri = URI.parse(page.next_sync_url)
    params = URI.decode_www_form(uri.query)
    params.find { |k, _| k == 'sync_token' }&.last
  end
end
