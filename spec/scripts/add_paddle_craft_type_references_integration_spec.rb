# frozen_string_literal: true

require 'json'
require 'tmpdir'
require 'open3'

# Integration / mock-based tests for the side effects of the migration script
# `scripts/add_paddle_craft_type_references.rb`.
#
# Feature: paddlecraft-types-change
# Validates: Requirements 6.8 (publish updated entry) and 6.9 (dry-run makes no
#            writes and reports intended changes).
#
# The migration script inlines its CMA CLI under `if __FILE__ == $PROGRAM_NAME`
# and talks to Contentful through `Net::HTTP`. Rather than refactoring the
# script (and risking a behaviour change), these tests run it as a subprocess
# with `Net::HTTP` stubbed in the child process (spec/support/cma_net_http_stub.rb
# loaded via `ruby -r`). No network request is ever made. Fixture `_data` files
# are written to the repo's `_data/` directory (which is git-ignored and empty
# in a fresh checkout) and removed afterwards.
RSpec.describe 'add_paddle_craft_type_references.rb (migration side effects)' do
  repo_root = File.expand_path('../..', __dir__)
  script_path = File.join(repo_root, 'scripts', 'add_paddle_craft_type_references.rb')
  stub_path = File.join(repo_root, 'spec', 'support', 'cma_net_http_stub.rb')
  data_dir = File.join(repo_root, '_data')
  spots_path = File.join(data_dir, 'spots.yml')
  cache_path = File.join(data_dir, '.contentful_sync_cache.yml')

  # A candidate spot that references the legacy `seekajak` slug, which the
  # migration rule maps to an added `hardshell` reference.
  spots_fixture = <<~YAML
    - slug: test-spot
      locale: de
      paddleCraftTypes:
        - seekajak
  YAML

  cache_fixture = <<~YAML
    entry_id_index:
      spot-entry-1:
        content_type: spot
        slug: test-spot
      ct-seekajak:
        content_type: paddleCraftType
        slug: seekajak
      ct-hardshell:
        content_type: paddleCraftType
        slug: hardshell
      ct-klappbar:
        content_type: paddleCraftType
        slug: klappbar-und-aufblasbar
  YAML

  # The CMA batch-fetch response: the spot entry currently links only the
  # legacy `seekajak` craft type, so the migration must add `hardshell`.
  fetched_entries = [
    {
      'sys' => { 'id' => 'spot-entry-1', 'version' => 3 },
      'fields' => {
        'paddleCraftType' => {
          'de-CH' => [
            { 'sys' => { 'type' => 'Link', 'linkType' => 'Entry', 'id' => 'ct-seekajak' } }
          ]
        }
      }
    }
  ]

  around(:each) do |example|
    # Guard: never clobber real data files if they happen to exist.
    raise "refusing to overwrite existing #{spots_path}" if File.exist?(spots_path)
    raise "refusing to overwrite existing #{cache_path}" if File.exist?(cache_path)

    File.write(spots_path, spots_fixture)
    File.write(cache_path, cache_fixture)

    Dir.mktmpdir('cma-stub') do |tmp|
      @entries_file = File.join(tmp, 'entries.json')
      @request_log = File.join(tmp, 'requests.log')
      File.write(@entries_file, JSON.generate(fetched_entries))
      example.run
    end
  ensure
    File.delete(spots_path) if File.exist?(spots_path)
    File.delete(cache_path) if File.exist?(cache_path)
  end

  # Run the migration script as a subprocess with Net::HTTP stubbed.
  def run_script(extra_args, entries_file, request_log)
    env = {
      'CONTENTFUL_SPACE_ID' => 'test-space',
      'CONTENTFUL_ENVIRONMENT' => 'master',
      'CONTENTFUL_MANAGEMENT_TOKEN' => 'test-token',
      'CMA_STUB_ENTRIES' => entries_file,
      'CMA_STUB_REQUEST_LOG' => request_log
    }
    cmd = ['ruby', '-r', @stub_path_local, @script_path_local, *extra_args]
    stdout, stderr, status = Open3.capture3(env, *cmd, chdir: @repo_root_local)
    { stdout: stdout, stderr: stderr, status: status }
  end

  # Parse the intercepted-request log into an array of {method, path} hashes.
  def logged_requests(request_log)
    return [] unless File.exist?(request_log)

    File.readlines(request_log).map { |line| JSON.parse(line) }
  end

  before(:each) do
    @repo_root_local = repo_root
    @script_path_local = script_path
    @stub_path_local = stub_path
  end

  # Requirement 6.8: a live run publishes the updated entry.
  it 'issues an update and a publish request for a spot requiring an addition (6.8)' do
    result = run_script([], @entries_file, @request_log)

    expect(result[:status]).to be_success, "script failed: #{result[:stderr]}\n#{result[:stdout]}"

    requests = logged_requests(@request_log)
    puts_methods = requests.map { |r| "#{r['method']} #{r['path']}" }

    # The updated entry is written (PUT /entries/{id}) ...
    put_updates = requests.select do |r|
      r['method'] == 'PUT' && r['path'].include?('/entries/spot-entry-1') && !r['path'].end_with?('/published')
    end
    expect(put_updates).not_to be_empty, "expected an entry update PUT, got: #{puts_methods}"

    # ... and a publish request is issued for it (bulk publish, or the
    # individual-publish fallback).
    publish_requests = requests.select do |r|
      (r['method'] == 'POST' && r['path'].include?('/bulk_actions/publish')) ||
        (r['method'] == 'PUT' && r['path'].end_with?('/published'))
    end
    expect(publish_requests).not_to be_empty, "expected a publish request, got: #{puts_methods}"

    expect(result[:stdout]).to include('hardshell')
  end

  # Requirement 6.9: a dry-run makes no writes and reports the intended change.
  it 'issues zero PUT/publish requests in --dry-run and reports intended changes (6.9)' do
    result = run_script(['--dry-run'], @entries_file, @request_log)

    expect(result[:status]).to be_success, "script failed: #{result[:stderr]}\n#{result[:stdout]}"

    requests = logged_requests(@request_log)
    write_methods = requests.select { |r| %w[PUT POST].include?(r['method']) }
    expect(write_methods).to be_empty,
                             "dry-run must issue no PUT/POST requests, got: #{requests.map { |r| "#{r['method']} #{r['path']}" }}"

    # Only the read-only batch fetch may have occurred.
    expect(requests.map { |r| r['method'] }.uniq).to satisfy { |m| m.empty? || m == ['GET'] }

    # The intended change is reported to stdout.
    expect(result[:stdout]).to match(/DRY RUN/)
    expect(result[:stdout]).to include('add hardshell')
  end

  # Additional representative case: a live run where the spot already links the
  # target new type is a no-op -- no writes, no publish (side-effect view of the
  # additive/idempotent rule).
  it 'issues no publish request when the spot already links the target new type' do
    already_migrated = [
      {
        'sys' => { 'id' => 'spot-entry-1', 'version' => 3 },
        'fields' => {
          'paddleCraftType' => {
            'de-CH' => [
              { 'sys' => { 'type' => 'Link', 'linkType' => 'Entry', 'id' => 'ct-seekajak' } },
              { 'sys' => { 'type' => 'Link', 'linkType' => 'Entry', 'id' => 'ct-hardshell' } }
            ]
          }
        }
      }
    ]
    File.write(@entries_file, JSON.generate(already_migrated))

    result = run_script([], @entries_file, @request_log)

    expect(result[:status]).to be_success, "script failed: #{result[:stderr]}\n#{result[:stdout]}"

    requests = logged_requests(@request_log)
    write_methods = requests.select { |r| %w[PUT POST].include?(r['method']) }
    expect(write_methods).to be_empty,
                             "already-migrated spot must issue no writes, got: #{requests.map { |r| "#{r['method']} #{r['path']}" }}"
  end

  # Regression: Contentful's Bulk Actions API rejects a single publish request
  # carrying more than 200 entities (HTTP 422). With more than CMA_BATCH (100)
  # updated entries the publish step MUST chunk into batches of <= 100, issue
  # more than one bulk-publish request, and drop nothing -- exactly as Phase 3
  # already chunks the fetch.
  it 'chunks bulk publish into batches of <= 100 when more than 100 entries are updated' do
    batch_size = 100        # mirrors CMA_BATCH in the script
    spot_count = 150        # > batch_size, forces > 1 publish batch

    # Build a >100-spot cache + spots fixture, each spot referencing the legacy
    # `seekajak` slug (mapped to an added `hardshell` reference), plus the three
    # craft-type entries. Every spot slug resolves to a unique entry ID.
    cache_lines = ['entry_id_index:']
    spots_lines = []
    fetched = []
    (1..spot_count).each do |i|
      slug = "test-spot-#{i}"
      entry_id = "spot-entry-#{i}"
      cache_lines << "  #{entry_id}:"
      cache_lines << '    content_type: spot'
      cache_lines << "    slug: #{slug}"

      spots_lines << "- slug: #{slug}"
      spots_lines << '  locale: de'
      spots_lines << '  paddleCraftTypes:'
      spots_lines << '    - seekajak'

      fetched << {
        'sys' => { 'id' => entry_id, 'version' => 3 },
        'fields' => {
          'paddleCraftType' => {
            'de-CH' => [
              { 'sys' => { 'type' => 'Link', 'linkType' => 'Entry', 'id' => 'ct-seekajak' } }
            ]
          }
        }
      }
    end
    cache_lines << '  ct-seekajak:'
    cache_lines << '    content_type: paddleCraftType'
    cache_lines << '    slug: seekajak'
    cache_lines << '  ct-hardshell:'
    cache_lines << '    content_type: paddleCraftType'
    cache_lines << '    slug: hardshell'
    cache_lines << '  ct-klappbar:'
    cache_lines << '    content_type: paddleCraftType'
    cache_lines << '    slug: klappbar-und-aufblasbar'

    # Overwrite the small default fixtures written by the around hook; the
    # around/ensure guard still owns cleanup of these _data/ files.
    File.write(spots_path, spots_lines.join("\n") + "\n")
    File.write(cache_path, cache_lines.join("\n") + "\n")
    File.write(@entries_file, JSON.generate(fetched))

    result = run_script([], @entries_file, @request_log)

    expect(result[:status]).to be_success, "script failed: #{result[:stderr]}\n#{result[:stdout]}"

    requests = logged_requests(@request_log)

    bulk_publishes = requests.select do |r|
      r['method'] == 'POST' && r['path'].include?('/bulk_actions/publish')
    end
    individual_publishes = requests.select do |r|
      r['method'] == 'PUT' && r['path'].end_with?('/published')
    end
    entry_updates = requests.select do |r|
      r['method'] == 'PUT' && r['path'].include?('/entries/') && !r['path'].end_with?('/published')
    end

    # (a) Every bulk-publish request stays within the 200-entity API limit.
    expect(bulk_publishes).to all(satisfy { |r| r['entity_count'].to_i <= batch_size }),
                              "some bulk publish exceeded #{batch_size} entities: #{bulk_publishes.map { |r| r['entity_count'] }}"

    # (b) Chunking actually happened -- more than one bulk-publish request.
    expect(bulk_publishes.length).to be > 1,
                                     "expected chunked publish (> 1 request), got #{bulk_publishes.length}"

    # (c) No entry was dropped: the entities published across all batches equal
    #     the number of updated entries.
    total_published = bulk_publishes.sum { |r| r['entity_count'].to_i }
    expect(total_published).to eq(entry_updates.length)
    expect(total_published).to eq(spot_count)

    # (d) The bulk publish succeeded, so no individual /published fallback ran.
    expect(individual_publishes).to be_empty,
                                    "expected no individual publish fallback, got #{individual_publishes.length}"
  end
end
