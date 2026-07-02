# frozen_string_literal: true

# Test-only stub for the Contentful CMA HTTP layer.
#
# This file is loaded into a *child* Ruby process (via `ruby -r`) BEFORE the
# migration script `scripts/add_paddle_craft_type_references.rb` runs, so the
# script's `cma_request` helper -- which calls `Net::HTTP#request` -- never
# touches the network. The production script is NOT modified; only the child
# process's `Net::HTTP` is monkeypatched here.
#
# Behaviour is driven by two environment variables set by the rspec example:
#   * CMA_STUB_ENTRIES     -> path to a JSON file holding the `items` array
#                             returned for the batch-fetch GET /entries call.
#   * CMA_STUB_REQUEST_LOG -> path to a file to which every intercepted request
#                             is appended as one JSON object per line
#                             ({"method","path"}), so the test can assert which
#                             requests were (or were not) issued.

require 'net/http'
require 'json'

module CmaNetHttpStub
  module_function

  def request_log_path
    ENV['CMA_STUB_REQUEST_LOG']
  end

  def entries_path
    ENV['CMA_STUB_ENTRIES']
  end

  def log_request(req)
    path = request_log_path
    return unless path

    entry = { 'method' => req.method, 'path' => req.path }

    # For bulk-publish requests, record how many entities the batch carried so
    # tests can assert the publish step chunks below Contentful's 200-entity
    # limit and never drops entries.
    if req.method == 'POST' && req.path.include?('/bulk_actions/publish')
      entry['entity_count'] = bulk_publish_entity_count(req)
    end

    File.open(path, 'a') do |f|
      f.puts(JSON.generate(entry))
    end
  end

  # Parse a bulk-publish request body and return the number of entities in its
  # `entities.items` array (0 when the body is missing or unparseable).
  def bulk_publish_entity_count(req)
    body = req.body
    return 0 if body.nil? || body.empty?

    parsed = JSON.parse(body)
    items = parsed.dig('entities', 'items')
    items.is_a?(Array) ? items.length : 0
  rescue JSON::ParserError
    0
  end

  # Extract the set of entry IDs from a batch-fetch `sys.id[in]=a,b,c` query, or
  # nil when the request carries no such filter (in which case the caller
  # returns the fixture unfiltered).
  def requested_id_filter(path)
    query = path.split('?', 2)[1]
    return nil unless query

    match = query.split('&').find { |p| p.start_with?('sys.id[in]=') }
    return nil unless match

    match.sub('sys.id[in]=', '').split(',').reject(&:empty?)
  end

  # Build a real Net::HTTPResponse subclass instance with a readable body so the
  # script's `resp.is_a?(Net::HTTPSuccess)`, `resp.code`, and `resp.body` checks
  # all behave exactly as against a live response.
  def build_response(klass, code, body)
    res = klass.new('1.1', code, '')
    res.instance_variable_set(:@body, body)
    res.instance_variable_set(:@read, true)
    res.define_singleton_method(:body) { @body }
    res
  end

  def respond(req)
    method = req.method
    path = req.path

    if method == 'GET'
      items = entries_path && File.exist?(entries_path) ? JSON.parse(File.read(entries_path)) : []
      # Honour the batch-fetch `sys.id[in]=id1,id2,...` slicing so that a
      # multi-batch fetch (>CMA_BATCH ids) returns each requested slice rather
      # than the whole fixture on every call -- otherwise the accumulated
      # `fetched_entries` would contain duplicates. When no `sys.id[in]` query
      # is present the fixture is returned as-is (existing behaviour).
      requested_ids = requested_id_filter(path)
      if requested_ids
        items = items.select { |item| requested_ids.include?(item.dig('sys', 'id')) }
      end
      return build_response(Net::HTTPOK, '200', JSON.generate('items' => items))
    end

    if method == 'POST' && path.include?('/bulk_actions/publish')
      # Bulk publish accepted.
      return build_response(Net::HTTPCreated, '201', JSON.generate('sys' => { 'id' => 'bulk-action' }))
    end

    if method == 'PUT' && path.end_with?('/published')
      # Individual publish fallback.
      return build_response(Net::HTTPOK, '200', JSON.generate('sys' => { 'version' => 99 }))
    end

    if method == 'PUT'
      # Entry update -- return an incremented version.
      return build_response(Net::HTTPOK, '200', JSON.generate('sys' => { 'version' => 99 }))
    end

    # Any unexpected request surfaces as an error rather than silently passing.
    build_response(Net::HTTPBadRequest, '400', JSON.generate('error' => "unexpected #{method} #{path}"))
  end
end

# Monkeypatch only within this (child) process.
module Net
  class HTTP
    def request(req, body = nil, &_block)
      CmaNetHttpStub.log_request(req)
      CmaNetHttpStub.respond(req)
    end
  end
end
