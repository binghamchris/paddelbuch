#!/usr/bin/env ruby
# frozen_string_literal: true

# One-off script to restore simplified geometry from fullGeometry in Contentful.
#
# For each waterway entry that has a fullGeometry field:
#   1. Reads fullGeometry (the original unclipped source of truth)
#   2. Simplifies it using Douglas-Peucker (25m tolerance) + 6dp precision
#   3. Writes the simplified result back to the geometry field
#
# This effectively undoes any clipping that was applied to the geometry field
# while preserving the simplification step.
#
# Usage:
#   source /opt/homebrew/share/chruby/chruby.sh && chruby ruby-3.4.9 && \
#     ruby scripts/restore_geometry_from_full.rb [--dry-run] [--slug SLUG]
#
# Options:
#   --dry-run      Preview changes without writing to Contentful
#   --slug SLUG    Process only the waterway with the given slug

require 'dotenv'
require 'json'
require 'net/http'
require 'uri'

Dotenv.load('.env.development')

SPACE_ID    = ENV.fetch('CONTENTFUL_SPACE_ID')
ENVIRONMENT = ENV.fetch('CONTENTFUL_ENVIRONMENT', 'dev')
CMA_TOKEN   = ENV.fetch('CONTENTFUL_MANAGEMENT_TOKEN')
DRY_RUN     = ARGV.include?('--dry-run')
SLUG_INDEX  = ARGV.index('--slug')
TARGET_SLUG = SLUG_INDEX ? ARGV[SLUG_INDEX + 1] : nil

if SLUG_INDEX && TARGET_SLUG.nil?
  abort 'Error: --slug requires a value, e.g. --slug langensee'
end

BASE_URL = "https://api.contentful.com/spaces/#{SPACE_ID}/environments/#{ENVIRONMENT}"

# Douglas-Peucker tolerance in degrees (~25m at 47°N latitude)
TOLERANCE = 25.0 / 93_000.0
PRECISION = 6

# ---------------------------------------------------------------------------
# Geometry simplification (same as simplify_waterway_geometry.rb)
# ---------------------------------------------------------------------------

def perpendicular_distance(point, line_start, line_end)
  dx = line_end[0] - line_start[0]
  dy = line_end[1] - line_start[1]
  if dx == 0 && dy == 0
    return Math.sqrt((point[0] - line_start[0])**2 + (point[1] - line_start[1])**2)
  end
  t = ((point[0] - line_start[0]) * dx + (point[1] - line_start[1]) * dy) / (dx * dx + dy * dy)
  t = [[t, 0].max, 1].min
  proj_x = line_start[0] + t * dx
  proj_y = line_start[1] + t * dy
  Math.sqrt((point[0] - proj_x)**2 + (point[1] - proj_y)**2)
end

def douglas_peucker(points, tolerance)
  return points if points.size < 3
  max_dist = 0
  max_idx = 0
  (1...(points.size - 1)).each do |i|
    d = perpendicular_distance(points[i], points[0], points[-1])
    if d > max_dist
      max_dist = d
      max_idx = i
    end
  end
  if max_dist > tolerance
    left = douglas_peucker(points[0..max_idx], tolerance)
    right = douglas_peucker(points[max_idx..], tolerance)
    left[0...-1] + right
  else
    [points[0], points[-1]]
  end
end

def simplify_geometry(geometry, tolerance)
  case geometry['type']
  when 'LineString'
    { 'type' => 'LineString', 'coordinates' => douglas_peucker(geometry['coordinates'], tolerance) }
  when 'Polygon'
    { 'type' => 'Polygon', 'coordinates' => geometry['coordinates'].map { |ring| douglas_peucker(ring, tolerance) } }
  when 'MultiLineString'
    { 'type' => 'MultiLineString', 'coordinates' => geometry['coordinates'].map { |line| douglas_peucker(line, tolerance) } }
  when 'MultiPolygon'
    { 'type' => 'MultiPolygon', 'coordinates' => geometry['coordinates'].map { |poly| poly.map { |ring| douglas_peucker(ring, tolerance) } } }
  else
    geometry
  end
end

def round_coords(obj, decimals)
  case obj
  when Array
    if obj.first.is_a?(Numeric)
      obj.map { |n| n.round(decimals) }
    else
      obj.map { |item| round_coords(item, decimals) }
    end
  when Hash
    obj.transform_values { |v| round_coords(v, decimals) }
  else
    obj
  end
end

def count_coords(obj)
  case obj
  when Array
    obj.first.is_a?(Numeric) ? 1 : obj.sum { |item| count_coords(item) }
  when Hash
    obj['coordinates'] ? count_coords(obj['coordinates']) : 0
  else
    0
  end
end

# ---------------------------------------------------------------------------
# Contentful Management API helpers
# ---------------------------------------------------------------------------

def cma_request(method, path, body: nil, headers: {})
  uri = URI("#{BASE_URL}#{path}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true

  req = case method
        when :get    then Net::HTTP::Get.new(uri)
        when :put    then Net::HTTP::Put.new(uri)
        end

  req['Authorization'] = "Bearer #{CMA_TOKEN}"
  req['Content-Type'] = 'application/vnd.contentful.management.v1+json'
  headers.each { |k, v| req[k] = v }
  req.body = JSON.generate(body) if body

  http.request(req)
end

def fetch_all_waterways
  entries = []
  skip = 0
  limit = 100

  loop do
    resp = cma_request(:get, "/entries?content_type=waterway&limit=#{limit}&skip=#{skip}")
    unless resp.is_a?(Net::HTTPSuccess)
      abort "Failed to fetch waterways (skip=#{skip}): #{resp.code} #{resp.body}"
    end
    data = JSON.parse(resp.body)
    entries.concat(data['items'])
    total = data['total']
    skip += limit
    break if skip >= total
  end

  entries
end

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

puts DRY_RUN ? '=== DRY RUN — no changes will be written ===' : '=== LIVE RUN — changes will be written to Contentful ==='
puts "=== Target: #{TARGET_SLUG ? "slug '#{TARGET_SLUG}'" : 'all waterways'} ===" if TARGET_SLUG
puts

puts 'Fetching all waterway entries from Contentful CMA...'
waterways = fetch_all_waterways
puts "Found #{waterways.size} waterway entries"

if TARGET_SLUG
  waterways = waterways.select do |e|
    fields = e['fields'] || {}
    slug_field = fields['slug']
    next false unless slug_field
    slug_field.values.any? { |v| v == TARGET_SLUG }
  end
  if waterways.empty?
    abort "Error: no waterway found with slug '#{TARGET_SLUG}'"
  end
  puts "Filtered to #{waterways.size} entry matching slug '#{TARGET_SLUG}'"
end

puts

processed = 0
skipped_no_full_geometry = 0
errors = 0

waterways.each_with_index do |entry, idx|
  entry_id = entry.dig('sys', 'id')
  version = entry.dig('sys', 'version')
  fields = entry['fields'] || {}

  full_geo_field = fields['fullGeometry']

  unless full_geo_field
    skipped_no_full_geometry += 1
    next
  end

  locale = full_geo_field.keys.first
  full_geometry_value = full_geo_field[locale]

  unless full_geometry_value
    skipped_no_full_geometry += 1
    next
  end

  slug = fields.dig('slug', locale) || fields.dig('slug', 'en') || entry_id

  # Parse fullGeometry
  full_geo = if full_geometry_value.is_a?(String)
               JSON.parse(full_geometry_value) rescue nil
             elsif full_geometry_value.is_a?(Hash)
               full_geometry_value
             end

  unless full_geo
    puts "  [#{idx + 1}/#{waterways.size}] #{slug}: could not parse fullGeometry — skipping"
    skipped_no_full_geometry += 1
    next
  end

  coords_before = count_coords(full_geo)

  # Simplify from fullGeometry
  simplified = simplify_geometry(full_geo, TOLERANCE)
  simplified = round_coords(simplified, PRECISION)
  coords_after = count_coords(simplified)

  reduction = coords_before > 0 ? ((1 - coords_after.to_f / coords_before) * 100).round(1) : 0
  puts "  [#{idx + 1}/#{waterways.size}] #{slug}: #{coords_before} -> #{coords_after} coords (#{reduction}% reduction)"

  if DRY_RUN
    processed += 1
    next
  end

  # Build update: only change geometry, leave everything else (including fullGeometry) intact
  updated_fields = fields.dup

  full_geo_field.each_key do |loc|
    loc_val = full_geo_field[loc]
    loc_geo = if loc_val.is_a?(String)
                JSON.parse(loc_val) rescue nil
              elsif loc_val.is_a?(Hash)
                loc_val
              end

    if loc_geo
      s = simplify_geometry(loc_geo, TOLERANCE)
      s = round_coords(s, PRECISION)
      updated_fields['geometry'] ||= {}
      updated_fields['geometry'][loc] = s
    end
  end

  # PUT the updated entry
  resp = cma_request(
    :put,
    "/entries/#{entry_id}",
    body: { fields: updated_fields },
    headers: { 'X-Contentful-Version' => version.to_s }
  )

  if resp.is_a?(Net::HTTPSuccess)
    new_version = JSON.parse(resp.body).dig('sys', 'version')
    pub_resp = cma_request(
      :put,
      "/entries/#{entry_id}/published",
      headers: { 'X-Contentful-Version' => new_version.to_s }
    )
    if pub_resp.is_a?(Net::HTTPSuccess)
      processed += 1
    else
      puts "    ERROR publishing #{slug}: #{pub_resp.code} #{pub_resp.body}"
      errors += 1
    end
  else
    puts "    ERROR updating #{slug}: #{resp.code} #{resp.body}"
    errors += 1
  end

  sleep 0.25
end

puts
puts '=== Summary ==='
puts "  Restored:                #{processed}"
puts "  Skipped (no fullGeo):    #{skipped_no_full_geometry}"
puts "  Errors:                  #{errors}"
puts "  Mode:                    #{DRY_RUN ? 'DRY RUN' : 'LIVE'}"
