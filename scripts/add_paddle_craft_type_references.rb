#!/usr/bin/env ruby
# frozen_string_literal: true

# One-off script to additively migrate spot paddle-craft-type references in
# Contentful: spots referencing the legacy craft types gain a reference to the
# corresponding new craft type, without any existing reference being removed.
#
# Legacy -> new mapping:
#   kanadier              -> hardshell
#   seekajak              -> hardshell
#   stand-up-paddle-board -> klappbar-und-aufblasbar
#
# This file is split into two concerns:
#   * The pure, side-effect-free migration rule (this task, 8.1), exposed via
#     the PaddleCraftTypeMigration module so it can be required and unit-tested
#     without triggering any network code.
#   * The Contentful CMA CLI phases (task 8.2), which extend this file and are
#     only executed when the file is run directly (see the guard at the bottom).
#
# Usage (added in task 8.2):
#   source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && \
#     ruby scripts/add_paddle_craft_type_references.rb [--dry-run] [--slug SLUG]

# ---------------------------------------------------------------------------
# Pure additive migration rule (no side effects, safe to require)
# ---------------------------------------------------------------------------

module PaddleCraftTypeMigration
  # Ordered mapping from each legacy craft-type slug to the new craft-type slug
  # that should be added when the legacy slug is present on a spot.
  LEGACY_TO_NEW = {
    'kanadier'              => 'hardshell',
    'seekajak'              => 'hardshell',
    'stand-up-paddle-board' => 'klappbar-und-aufblasbar'
  }.freeze

  module_function

  # Given a spot's current craft-type slugs, return the ordered list of new
  # slugs to add.
  #
  # Rules:
  #   * a mapping is triggered only when its legacy slug is present (6.2, 6.3)
  #   * a target new slug already present is skipped (no duplicate) (6.6)
  #   * a target new slug is added at most once per run (dedupe)
  #   * when no legacy slug matches, the result is empty (no-op) (6.5)
  def additions_for(existing_slugs)
    existing = existing_slugs.to_a
    LEGACY_TO_NEW.each_with_object([]) do |(legacy, new_slug), adds|
      next unless existing.include?(legacy)  # rule triggers only on legacy match
      next if existing.include?(new_slug)    # Requirement 6.6 - no duplicate
      next if adds.include?(new_slug)        # dedupe within a single run

      adds << new_slug
    end
  end

  # Return the applied result: the existing slugs plus any additions. The result
  # is always a superset of the existing references (additive - Requirement 6.4)
  # and is idempotent (Requirement 6.7), since a second application finds the
  # new slugs already present and adds nothing.
  def apply(existing_slugs)
    existing = existing_slugs.to_a
    existing + additions_for(existing)
  end
end

# ---------------------------------------------------------------------------
# CLI entry point (implemented in task 8.2). Guarded so that requiring this
# file for tests never executes any network / CMA code.
# ---------------------------------------------------------------------------

if __FILE__ == $PROGRAM_NAME
  require 'dotenv'
  require 'json'
  require 'yaml'
  require 'net/http'
  require 'uri'

  Dotenv.load('.env.development')

  SPACE_ID    = ENV.fetch('CONTENTFUL_SPACE_ID')
  ENVIRONMENT = ENV.fetch('CONTENTFUL_ENVIRONMENT', 'master')
  CMA_TOKEN   = ENV.fetch('CONTENTFUL_MANAGEMENT_TOKEN')
  DRY_RUN     = ARGV.include?('--dry-run')
  SLUG_INDEX  = ARGV.index('--slug')
  TARGET_SLUG = SLUG_INDEX ? ARGV[SLUG_INDEX + 1] : nil
  CMA_BATCH   = 100

  # Contentful field ID holding the array of paddle-craft-type reference Links on
  # a spot entry (the SDK exposes it as :paddle_craft_type; the CMA uses the raw
  # camelCase field ID). Stored per-locale as arrays of entry Links.
  CMA_FIELD = 'paddleCraftType'

  # The two new craft-type slugs whose entry IDs must be resolvable before any
  # reference Links can be constructed.
  NEW_TYPE_SLUGS = PaddleCraftTypeMigration::LEGACY_TO_NEW.values.uniq.freeze

  if SLUG_INDEX && TARGET_SLUG.nil?
    abort 'Error: --slug requires a value, e.g. --slug lido-locarno'
  end

  BASE_URL = "https://api.contentful.com/spaces/#{SPACE_ID}/environments/#{ENVIRONMENT}"
  DATA_DIR = File.expand_path('../_data', __dir__)

  # -------------------------------------------------------------------------
  # Helpers
  # -------------------------------------------------------------------------

  def cma_request(method, path, body: nil, headers: {})
    uri = URI("#{BASE_URL}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = case method
          when :get  then Net::HTTP::Get.new(uri)
          when :put  then Net::HTTP::Put.new(uri)
          when :post then Net::HTTP::Post.new(uri)
          end

    req['Authorization'] = "Bearer #{CMA_TOKEN}"
    req['Content-Type'] = 'application/vnd.contentful.management.v1+json'
    headers.each { |k, v| req[k] = v }
    req.body = JSON.generate(body) if body

    http.request(req)
  end

  # Extract the ordered list of linked entry IDs from a single locale's value of
  # the paddleCraftType field (an array of Link hashes).
  def link_ids(locale_value)
    return [] unless locale_value.is_a?(Array)

    locale_value.map { |link| link.dig('sys', 'id') }.compact
  end

  # Build a Link object referencing the given craft-type entry ID.
  def craft_type_link(entry_id)
    { 'sys' => { 'type' => 'Link', 'linkType' => 'Entry', 'id' => entry_id } }
  end

  # ---------------------------------------------------------------------------
  # Phase 1: Identify candidate spots referencing a legacy slug (local cache)
  # ---------------------------------------------------------------------------

  puts DRY_RUN ? '=== DRY RUN -- no changes will be written ===' : '=== LIVE RUN -- changes will be written to Contentful ==='
  puts

  spots_path = File.join(DATA_DIR, 'spots.yml')
  unless File.exist?(spots_path)
    abort "Error: #{spots_path} not found. Run a Contentful sync first."
  end

  cache_path = File.join(DATA_DIR, '.contentful_sync_cache.yml')
  unless File.exist?(cache_path)
    abort "Error: #{cache_path} not found. Run a Contentful sync first."
  end

  legacy_slugs = PaddleCraftTypeMigration::LEGACY_TO_NEW.keys

  puts 'Phase 1: Scanning local spots.yml cache for spots referencing legacy craft types...'
  spots = YAML.safe_load(File.read(spots_path), permitted_classes: [Time])

  # Deduplicate by slug (each spot appears once per locale). We only need the set
  # of candidate slugs here; the authoritative per-locale references come from the
  # CMA in Phase 4.
  candidate_slugs = {}
  spots.each do |row|
    craft = row['paddleCraftTypes']
    next unless craft.is_a?(Array)
    next unless craft.any? { |slug| legacy_slugs.include?(slug) }

    slug = row['slug']
    next if slug.nil? || candidate_slugs.key?(slug)

    candidate_slugs[slug] = true
  end

  if TARGET_SLUG
    all_slugs = spots.map { |r| r['slug'] }.uniq
    unless candidate_slugs.key?(TARGET_SLUG)
      if all_slugs.include?(TARGET_SLUG)
        puts "Spot '#{TARGET_SLUG}' references no legacy craft type. Nothing to do."
        exit 0
      else
        abort "Error: no spot found with slug '#{TARGET_SLUG}'"
      end
    end
    candidate_slugs = candidate_slugs.select { |k, _| k == TARGET_SLUG }
  end

  puts "  Found #{candidate_slugs.size} unique candidate spot(s) referencing a legacy craft type"

  if candidate_slugs.empty?
    puts 'No spots reference a legacy craft type. Nothing to do.'
    exit 0
  end

  # ---------------------------------------------------------------------------
  # Phase 2: Resolve entry IDs from the sync cache
  # ---------------------------------------------------------------------------

  puts
  puts 'Phase 2: Resolving Contentful entry IDs from sync cache...'

  cache = YAML.safe_load(File.read(cache_path), permitted_classes: [Time])
  entry_id_index = cache['entry_id_index'] || {}

  # spot slug -> entry_id, and craft-type maps (both directions).
  spot_slug_to_entry_id = {}
  craft_entry_id_to_slug = {}
  craft_slug_to_entry_id = {}

  entry_id_index.each do |entry_id, meta|
    case meta['content_type']
    when 'spot'
      spot_slug_to_entry_id[meta['slug']] = entry_id
    when 'paddleCraftType'
      craft_entry_id_to_slug[entry_id] = meta['slug']
      craft_slug_to_entry_id[meta['slug']] = entry_id
    end
  end

  # Map candidate spot slugs to entry IDs.
  entry_ids_to_update = {} # entry_id -> spot slug
  missing_slugs = []

  candidate_slugs.each_key do |slug|
    entry_id = spot_slug_to_entry_id[slug]
    if entry_id
      entry_ids_to_update[entry_id] = slug
    else
      missing_slugs << slug
    end
  end

  unless missing_slugs.empty?
    puts "  WARNING: #{missing_slugs.size} slug(s) not found in sync cache (may need a fresh sync):"
    missing_slugs.each { |s| puts "    - #{s}" }
  end

  # Abort BEFORE any writes if the new-type entry IDs cannot be resolved -- the
  # reference Links cannot be constructed safely without them.
  unresolved_new_types = NEW_TYPE_SLUGS.reject { |slug| craft_slug_to_entry_id.key?(slug) }
  unless unresolved_new_types.empty?
    abort "Error: could not resolve entry IDs for new craft type(s): " \
          "#{unresolved_new_types.join(', ')}. Run a fresh Contentful sync first."
  end

  puts "  Mapped #{entry_ids_to_update.size} spot(s) to entry IDs (0 API calls)"
  puts "  Resolved new craft-type entry IDs: " \
       "#{NEW_TYPE_SLUGS.map { |s| "#{s}=#{craft_slug_to_entry_id[s]}" }.join(', ')}"

  if entry_ids_to_update.empty?
    abort 'Error: no spot entry IDs resolved. Cannot proceed.'
  end

  # ---------------------------------------------------------------------------
  # Phase 3: Batch fetch candidate spot entries from the CMA
  # ---------------------------------------------------------------------------

  puts
  puts "Phase 3: Batch fetching #{entry_ids_to_update.size} entrie(s) from CMA..."

  all_ids = entry_ids_to_update.keys
  batches = all_ids.each_slice(CMA_BATCH).to_a
  fetched_entries = []
  api_calls = 0

  batches.each_with_index do |id_batch, batch_idx|
    ids_param = id_batch.join(',')
    resp = cma_request(:get, "/entries?sys.id[in]=#{ids_param}&limit=#{CMA_BATCH}")
    api_calls += 1

    unless resp.is_a?(Net::HTTPSuccess)
      abort "Failed to batch fetch entries (batch #{batch_idx + 1}): #{resp.code} #{resp.body}"
    end

    data = JSON.parse(resp.body)
    fetched_entries.concat(data['items'])
    puts "  Batch #{batch_idx + 1}/#{batches.size}: fetched #{data['items'].size} entrie(s)"
  end

  puts "  Total fetched: #{fetched_entries.size} entrie(s) in #{api_calls} API call(s)"

  # ---------------------------------------------------------------------------
  # Phase 4: Compute additive references and write updated entries
  # ---------------------------------------------------------------------------

  puts
  puts 'Phase 4: Computing additive craft-type references...'

  updated_entries = [] # collect {id:, version:} for bulk publish
  errors = 0
  conflicts = [] # slugs that hit a 409 version conflict

  fetched_entries.each_with_index do |entry, idx|
    entry_id = entry.dig('sys', 'id')
    version = entry.dig('sys', 'version')
    fields = entry['fields'] || {}
    slug = entry_ids_to_update[entry_id] || entry_id

    craft_field = fields[CMA_FIELD]
    unless craft_field.is_a?(Hash)
      puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug}: no #{CMA_FIELD} field -- skipping"
      next
    end

    # Build an updated copy of the field, computing additions per locale key.
    updated_fields = fields.dup
    new_craft_field = {}
    changed = false

    craft_field.each do |locale, locale_value|
      current_links = locale_value.is_a?(Array) ? locale_value.dup : []
      current_slugs = link_ids(locale_value).map { |id| craft_entry_id_to_slug[id] }.compact

      additions = PaddleCraftTypeMigration.additions_for(current_slugs)

      if additions.empty?
        new_craft_field[locale] = current_links
        next
      end

      addition_links = additions.map { |add_slug| craft_type_link(craft_slug_to_entry_id[add_slug]) }
      new_craft_field[locale] = current_links + addition_links # additive -- retain existing
      changed = true
      puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug} (#{locale}): " \
           "add #{additions.join(', ')} (existing: #{current_slugs.empty? ? '(none)' : current_slugs.join(', ')})"
    end

    unless changed
      puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug}: already migrated -- skipping"
      next
    end

    updated_fields[CMA_FIELD] = new_craft_field

    if DRY_RUN
      # Report only; no write.
      updated_entries << { id: entry_id }
      next
    end

    resp = cma_request(
      :put,
      "/entries/#{entry_id}",
      body: { fields: updated_fields },
      headers: { 'X-Contentful-Version' => version.to_s }
    )
    api_calls += 1

    if resp.is_a?(Net::HTTPSuccess)
      new_version = JSON.parse(resp.body).dig('sys', 'version')
      updated_entries << { id: entry_id, version: new_version }
    else
      conflicts << slug if resp.code.to_i == 409
      puts "    ERROR updating #{slug}: #{resp.code} #{resp.body}"
      errors += 1
    end

    # Rate limiting -- CMA allows ~10 req/s
    sleep 0.15
  end

  puts "  #{DRY_RUN ? 'Would update' : 'Updated'} #{updated_entries.size} entrie(s)"

  # ---------------------------------------------------------------------------
  # Phase 5: Bulk publish updated entries (with individual-publish fallback)
  # ---------------------------------------------------------------------------

  if updated_entries.any? && !DRY_RUN
    puts
    puts 'Phase 5: Bulk publishing updated entries...'

    # Contentful's Bulk Actions API rejects requests carrying more than 200
    # entities with HTTP 422, so the publish is chunked into batches of
    # CMA_BATCH (100) -- mirroring the batched fetch in Phase 3. Each slice is
    # sent as its own bulk-action request with a spec-compliant Array payload,
    # and falls back to individual publishing for just that slice on failure.
    publish_batches = updated_entries.each_slice(CMA_BATCH).to_a

    publish_batches.each_with_index do |slice, slice_idx|
      links = slice.map do |e|
        {
          sys: {
            type: 'Link',
            linkType: 'Entry',
            id: e[:id],
            version: e[:version]
          }
        }
      end

      resp = cma_request(
        :post,
        '/bulk_actions/publish',
        body: { entities: { sys: { type: 'Array' }, items: links } }
      )
      api_calls += 1

      if resp.is_a?(Net::HTTPSuccess) || resp.code.to_i == 202
        puts "  Batch #{slice_idx + 1}/#{publish_batches.size}: bulk publish accepted for #{slice.size} entrie(s)"
      else
        puts "  WARNING: Bulk publish failed (#{resp.code}): #{resp.body}"
        puts "  Batch #{slice_idx + 1}/#{publish_batches.size}: falling back to individual publish for #{slice.size} entrie(s)..."
        slice.each do |e|
          pub_resp = cma_request(
            :put,
            "/entries/#{e[:id]}/published",
            headers: { 'X-Contentful-Version' => e[:version].to_s }
          )
          api_calls += 1
          unless pub_resp.is_a?(Net::HTTPSuccess)
            conflicts << e[:id] if pub_resp.code.to_i == 409
            puts "    ERROR publishing #{e[:id]}: #{pub_resp.code} #{pub_resp.body}"
            errors += 1
          end
          sleep 0.15
        end
      end

      # Rate limiting between slice requests -- CMA allows ~10 req/s
      sleep 0.15
    end
  end

  # ---------------------------------------------------------------------------
  # Summary
  # ---------------------------------------------------------------------------

  puts
  puts '=== Summary ==='
  puts "  Candidate spots (local):  #{candidate_slugs.size}"
  puts "  Entries #{DRY_RUN ? 'to update' : 'updated'}:        #{updated_entries.size}"
  puts "  Errors:                   #{errors}"
  unless conflicts.empty?
    puts "  Version conflicts (409):  #{conflicts.size}"
    conflicts.each { |c| puts "    - #{c}" }
  end
  puts "  Total API calls:          #{api_calls}"
  puts "  Mode:                     #{DRY_RUN ? 'DRY RUN' : 'LIVE'}"
end
