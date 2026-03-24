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

  def check_for_changes(client, sync_token, known_content_types = nil, entry_id_index = {})
    sync = client.sync(sync_token: sync_token)
    items, last_page = collect_all_pages(sync)
    new_token = extract_sync_token(last_page)

    if known_content_types
      changed, deleted, unknown = classify_delta_items(items, known_content_types, entry_id_index)
      SyncResult.new(
        success: true,
        has_changes: !items.empty?,
        new_token: new_token,
        items_count: items.size,
        changed_entries: changed,
        deleted_entries: deleted,
        unknown_content_types: unknown
      )
    else
      SyncResult.new(
        success: true,
        has_changes: !items.empty?,
        new_token: new_token,
        items_count: items.size
      )
    end
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

  def classify_delta_items(items, known_content_types, entry_id_index = {})
    changed = {}
    deleted = {}
    unknown = []

    items.each do |item|
      type = item.sys[:type]

      case type
      when 'Entry', 'DeletedEntry'
        content_type_obj = item.sys[:content_type]
        content_type_id = content_type_obj&.sys&.dig(:id)

        # DeletedEntry items from the Sync API do not carry sys.contentType.
        # Fall back to the entry_id_index to resolve the content type.
        if content_type_id.nil? && type == 'DeletedEntry'
          entry_id = item.sys[:id]
          index_entry = entry_id_index[entry_id] if entry_id
          content_type_id = index_entry['content_type'] if index_entry
        end

        next if content_type_id.nil?

        target = type == 'Entry' ? changed : deleted

        if known_content_types.include?(content_type_id)
          (target[content_type_id] ||= []) << item
        else
          unknown << content_type_id unless unknown.include?(content_type_id)
        end
      end
      # 'Asset' and 'DeletedAsset' are ignored
    end

    [changed, deleted, unknown]
  end

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
