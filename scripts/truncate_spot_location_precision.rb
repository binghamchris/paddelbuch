#!/usr/bin/env ruby
# frozen_string_literal: true

# One-off script to truncate spot location coordinates to 6 decimal places.
#
# Reads the local YAML cache to identify spots with >6dp precision,
# then batch-fetches only those entries from the CMA and updates them.
# Uses bulk publish to minimise API calls.
#
# Usage:
#   source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && \
#     ruby scripts/truncate_spot_location_precision.rb [--dry-run] [--slug SLUG]
#
# Options:
#   --dry-run      Preview changes without writing to Contentful
#   --slug SLUG    Process only the spot with the given slug

require 'dotenv'
require 'json'
require 'yaml'
require 'net/http'
require 'uri'

Dotenv.load('.env.development')

SPACE_ID    = ENV.fetch('CONTENTFUL_SPACE_ID')
ENVIRONMENT = ENV.fetch('CONTENTFUL_ENVIRONMENT', 'dev')
CMA_TOKEN   = ENV.fetch('CONTENTFUL_MANAGEMENT_TOKEN')
DRY_RUN     = ARGV.include?('--dry-run')
SLUG_INDEX  = ARGV.index('--slug')
TARGET_SLUG = SLUG_INDEX ? ARGV[SLUG_INDEX + 1] : nil
PRECISION   = 6
CMA_BATCH   = 100

if SLUG_INDEX && TARGET_SLUG.nil?
  abort 'Error: --slug requires a value, e.g. --slug pier-caslano-via-s-michele'
end

BASE_URL = "https://api.contentful.com/spaces/#{SPACE_ID}/environments/#{ENVIRONMENT}"
DATA_DIR = File.expand_path('../_data', __dir__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def decimal_places(value)
  s = value.to_s
  return 0 unless s.include?('.')
  s.split('.').last.length
end

def needs_truncation?(lat, lon)
  decimal_places(lat) > PRECISION || decimal_places(lon) > PRECISION
end

def truncate_coord(value)
  (value * 10**PRECISION).floor / (10**PRECISION).to_f
end

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

# ---------------------------------------------------------------------------
# Phase 1: Identify spots needing truncation from local cache
# ---------------------------------------------------------------------------

puts DRY_RUN ? '=== DRY RUN -- no changes will be written ===' : '=== LIVE RUN -- changes will be written to Contentful ==='
puts

spots_path = File.join(DATA_DIR, 'spots.yml')
unless File.exist?(spots_path)
  abort "Error: #{spots_path} not found. Run a Contentful sync first."
end

puts 'Phase 1: Scanning local spots.yml cache for >6dp coordinates...'
spots = YAML.safe_load(File.read(spots_path), permitted_classes: [Time])

# Deduplicate by slug (each spot appears once per locale)
slugs_needing_update = {}
spots.each do |row|
  loc = row['location']
  next unless loc
  lat = loc['lat']
  lon = loc['lon']
  next unless lat && lon
  next unless needs_truncation?(lat, lon)

  slug = row['slug']
  next if slugs_needing_update.key?(slug)
  slugs_needing_update[slug] = { lat: lat, lon: lon }
end

if TARGET_SLUG
  unless slugs_needing_update.key?(TARGET_SLUG)
    # Check if the slug exists at all
    all_slugs = spots.map { |r| r['slug'] }.uniq
    if all_slugs.include?(TARGET_SLUG)
      puts "Spot '#{TARGET_SLUG}' already has <=6dp precision. Nothing to do."
      exit 0
    else
      abort "Error: no spot found with slug '#{TARGET_SLUG}'"
    end
  end
  slugs_needing_update = slugs_needing_update.select { |k, _| k == TARGET_SLUG }
end

puts "  Found #{slugs_needing_update.size} unique spots needing truncation"

if slugs_needing_update.empty?
  puts 'All spot coordinates already have <=6 decimal places. Nothing to do.'
  exit 0
end

slugs_needing_update.each do |slug, coords|
  lat_dp = decimal_places(coords[:lat])
  lon_dp = decimal_places(coords[:lon])
  puts "  #{slug}: lat=#{coords[:lat]} (#{lat_dp}dp), lon=#{coords[:lon]} (#{lon_dp}dp)"
end

# ---------------------------------------------------------------------------
# Phase 2: Map slugs to entry IDs via sync cache
# ---------------------------------------------------------------------------

puts
puts 'Phase 2: Looking up Contentful entry IDs from sync cache...'

cache_path = File.join(DATA_DIR, '.contentful_sync_cache.yml')
unless File.exist?(cache_path)
  abort "Error: #{cache_path} not found. Run a Contentful sync first."
end

cache = YAML.safe_load(File.read(cache_path), permitted_classes: [Time])
entry_id_index = cache['entry_id_index'] || {}

# Build reverse index: slug -> entry_id (for spots only)
slug_to_entry_id = {}
entry_id_index.each do |entry_id, meta|
  next unless meta['content_type'] == 'spot'
  slug_to_entry_id[meta['slug']] = entry_id
end

entry_ids_to_update = {}
missing_slugs = []

slugs_needing_update.each do |slug, coords|
  entry_id = slug_to_entry_id[slug]
  if entry_id
    entry_ids_to_update[entry_id] = slug
  else
    missing_slugs << slug
  end
end

unless missing_slugs.empty?
  puts "  WARNING: #{missing_slugs.size} slugs not found in sync cache (may need a fresh sync):"
  missing_slugs.each { |s| puts "    - #{s}" }
end

puts "  Mapped #{entry_ids_to_update.size} spots to Contentful entry IDs (0 API calls)"

if entry_ids_to_update.empty?
  abort 'Error: no entry IDs resolved. Cannot proceed.'
end

# ---------------------------------------------------------------------------
# Phase 3: Batch fetch entries from CMA and update
# ---------------------------------------------------------------------------

puts
puts "Phase 3: Batch fetching #{entry_ids_to_update.size} entries from CMA..."

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
  puts "  Batch #{batch_idx + 1}/#{batches.size}: fetched #{data['items'].size} entries"
end

puts "  Total fetched: #{fetched_entries.size} entries in #{api_calls} API call(s)"

# ---------------------------------------------------------------------------
# Phase 4: Update each entry's location field
# ---------------------------------------------------------------------------

puts
puts 'Phase 4: Updating location coordinates...'

updated_entries = [] # collect {entry_id, new_version} for bulk publish
errors = 0

fetched_entries.each_with_index do |entry, idx|
  entry_id = entry.dig('sys', 'id')
  version = entry.dig('sys', 'version')
  fields = entry['fields'] || {}
  slug = entry_ids_to_update[entry_id] || entry_id

  location_field = fields['location']
  unless location_field
    puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug}: no location field -- skipping"
    next
  end

  # Truncate coordinates for all locales
  updated_fields = fields.dup
  updated_fields['location'] = {}
  changed = false

  location_field.each do |locale, loc_value|
    next unless loc_value.is_a?(Hash)
    lat = loc_value['lat']
    lon = loc_value['lon']
    next unless lat && lon

    new_lat = truncate_coord(lat)
    new_lon = truncate_coord(lon)

    if new_lat != lat || new_lon != lon
      changed = true
      puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug} (#{locale}): " \
           "lat #{lat} -> #{new_lat}, lon #{lon} -> #{new_lon}"
    end

    updated_fields['location'][locale] = { 'lat' => new_lat, 'lon' => new_lon }
  end

  unless changed
    puts "  [#{idx + 1}/#{fetched_entries.size}] #{slug}: already <=6dp in CMA -- skipping"
    next
  end

  if DRY_RUN
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
    puts "    ERROR updating #{slug}: #{resp.code} #{resp.body}"
    errors += 1
  end

  # Rate limiting -- CMA allows ~10 req/s
  sleep 0.15
end

puts "  Updated #{updated_entries.size} entries"

# ---------------------------------------------------------------------------
# Phase 5: Bulk publish
# ---------------------------------------------------------------------------

if updated_entries.any? && !DRY_RUN
  puts
  puts 'Phase 5: Bulk publishing updated entries...'

  entities = updated_entries.map do |e|
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
    body: { entities: { items: entities } }
  )
  api_calls += 1

  if resp.is_a?(Net::HTTPSuccess) || resp.code.to_i == 202
    puts "  Bulk publish accepted for #{updated_entries.size} entries"
  else
    puts "  WARNING: Bulk publish failed (#{resp.code}), falling back to individual publish..."
    updated_entries.each do |e|
      pub_resp = cma_request(
        :put,
        "/entries/#{e[:id]}/published",
        headers: { 'X-Contentful-Version' => e[:version].to_s }
      )
      api_calls += 1
      unless pub_resp.is_a?(Net::HTTPSuccess)
        puts "    ERROR publishing #{e[:id]}: #{pub_resp.code} #{pub_resp.body}"
        errors += 1
      end
      sleep 0.15
    end
  end
end

puts
puts '=== Summary ==='
puts "  Spots scanned (local):  #{slugs_needing_update.size}"
puts "  Entries updated:        #{updated_entries.size}"
puts "  Errors:                 #{errors}"
puts "  Total API calls:        #{api_calls}"
puts "  Mode:                   #{DRY_RUN ? 'DRY RUN' : 'LIVE'}"
