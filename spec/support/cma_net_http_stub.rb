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

    File.open(path, 'a') do |f|
      f.puts(JSON.generate('method' => req.method, 'path' => req.path))
    end
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
