# frozen_string_literal: true

require 'json'
require 'time'

# Jekyll plugin to pre-compute data quality dashboard metrics at build time.
#
# Computes freshness (median age + colour gradient) and coverage (segment
# classification) metrics for every waterway, then exposes them as
# site.data['dashboard_freshness_metrics'] and
# site.data['dashboard_coverage_metrics'].
#
# Follows the compute-once-cache-across-locales pattern from
# PrecomputeGenerator: numerical computations are locale-independent, so
# they run once on the first locale pass and are cached in class-level
# variables. On subsequent locale passes only the waterway names are
# swapped in.
#
# Requirements: 5.1, 5.2, 5.3, 5.4

module Jekyll
  class DashboardMetricsGenerator < Generator
    safe true
    priority :normal

    # Class-level cache survives across locale passes within a single build.
    # Reset to nil at the start of each fresh build (Ruby class variables
    # persist for the lifetime of the Ruby process, but Jekyll's
    # multi-language plugin runs all locale passes within one process
    # invocation).
    @@cached_freshness = nil
    @@cached_coverage = nil

    def generate(site)
      locale = site.config['lang'] || site.config['default_lang'] || 'de'
      colors = site.data['paddelbuch_colors'] || {}

      # Compute once on first locale pass, cache for reuse
      if @@cached_freshness.nil?
        Jekyll.logger.info 'DashboardMetrics:', 'Starting dashboard metrics computation...'

        all_spots = site.data['spots'] || []
        all_waterways = site.data['waterways'] || []

        # Deduplicate waterways by slug (they appear once per locale in the data)
        unique_waterways = deduplicate_by_slug(all_waterways)
        Jekyll.logger.info 'DashboardMetrics:', "Deduplicated #{all_waterways.size} waterway entries to #{unique_waterways.size} unique waterways"

        # Deduplicate spots by waterway_slug (updatedAt/location are identical across locales)
        spots_by_waterway = all_spots.group_by { |s| s['waterway_slug'] }
        unique_spots_by_waterway = deduplicate_spots_by_waterway(spots_by_waterway)
        total_unique_spots = unique_spots_by_waterway.values.sum(&:size)
        Jekyll.logger.info 'DashboardMetrics:', "Deduplicated #{all_spots.size} spot entries to #{total_unique_spots} unique spots across #{unique_spots_by_waterway.size} waterways"

        Jekyll.logger.info 'DashboardMetrics:', "Computing freshness metrics for #{unique_waterways.size} waterways..."
        @@cached_freshness = compute_freshness_metrics(unique_waterways, unique_spots_by_waterway, colors)
        Jekyll.logger.info 'DashboardMetrics:', "Freshness metrics complete: #{@@cached_freshness.size} waterways processed"

        Jekyll.logger.info 'DashboardMetrics:', "Computing coverage metrics for #{unique_waterways.size} waterways..."
        @@cached_coverage = compute_coverage_metrics(unique_waterways, unique_spots_by_waterway)
        Jekyll.logger.info 'DashboardMetrics:', "Coverage metrics complete: #{@@cached_coverage.size} waterways processed"

        Jekyll.logger.info 'DashboardMetrics:', 'Dashboard metrics computation finished (cached for subsequent locale passes)'
      else
        Jekyll.logger.info 'DashboardMetrics:', "Using cached metrics for locale '#{locale}'"
      end

      # Localize: swap in locale-specific waterway names
      waterway_names = build_waterway_name_lookup(site.data['waterways'] || [], locale)

      site.data['dashboard_freshness_metrics'] = localize_metrics(@@cached_freshness, waterway_names)
      site.data['dashboard_coverage_metrics'] = localize_metrics(@@cached_coverage, waterway_names)
      Jekyll.logger.info 'DashboardMetrics:', "Localized #{@@cached_freshness.size} freshness + #{@@cached_coverage.size} coverage metrics for locale '#{locale}'"
    end

    private

    # Returns one waterway hash per unique slug, picking the first occurrence.
    # Since geometry, length, and area are identical across locales, any
    # locale's entry suffices for computation.
    def deduplicate_by_slug(waterways)
      seen = {}
      waterways.each do |w|
        slug = w['slug']
        next if slug.nil?
        seen[slug] ||= w
      end
      seen.values
    end

    # For each waterway_slug group, deduplicates spots so that each unique
    # spot (by slug) appears once. Since updatedAt and location are identical
    # across locales, any locale's entry suffices.
    def deduplicate_spots_by_waterway(spots_by_waterway)
      result = {}
      spots_by_waterway.each do |waterway_slug, spots|
        seen = {}
        spots.each do |s|
          slug = s['slug']
          next if slug.nil?
          seen[slug] ||= s
        end
        result[waterway_slug] = seen.values
      end
      result
    end

    # Filters waterways to the given locale and returns a { slug => name }
    # hash.
    def build_waterway_name_lookup(waterways, locale)
      lookup = {}
      waterways.each do |w|
        next unless w['locale'] == locale
        slug = w['slug']
        next if slug.nil?
        lookup[slug] = w['name']
      end
      lookup
    end

    # Deep-clones the cached metric array and replaces each entry's name
    # field with the locale-specific name from the lookup. Falls back to
    # the slug string if no name is found for the current locale.
    def localize_metrics(cached_metrics, waterway_names)
      cached_metrics.map do |metric|
        cloned = Marshal.load(Marshal.dump(metric))
        slug = cloned['slug']
        cloned['name'] = waterway_names[slug] || slug
        cloned
      end
    end

    # Computes freshness metrics for each unique waterway.
    # Returns an array of metric hashes with slug, name (placeholder),
    # spotCount, medianAgeDays, color, and parsed geometry.
    # Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 9.1, 9.2, 9.3, 9.4
    def compute_freshness_metrics(unique_waterways, unique_spots_by_waterway, colors)
      now = Time.now
      metrics = []

      unique_waterways.each do |waterway|
        slug = waterway['slug']
        geometry_json = waterway['geometry']

        # Parse geometry JSON; skip waterway if malformed
        geometry = nil
        begin
          geometry = JSON.parse(geometry_json) if geometry_json && !geometry_json.empty?
        rescue JSON::ParserError => e
          Jekyll.logger.warn 'DashboardMetrics:', "Malformed geometry JSON for waterway '#{slug}': #{e.message}"
          next
        end

        next if geometry.nil?

        spots = unique_spots_by_waterway[slug] || []
        timestamps = spots.map { |s| s['updatedAt'] }.compact

        median_days = median_age(timestamps, now)
        color = freshness_color(median_days, colors)

        metrics << {
          'slug' => slug,
          'name' => 'placeholder',
          'spotCount' => spots.size,
          'medianAgeDays' => median_days,
          'color' => color,
          'geometry' => geometry
        }
      end

      metrics
    end

    # Computes the median age in days from an array of ISO 8601 timestamp
    # strings relative to the given reference time.
    # Returns nil for empty arrays.
    # Requirements: 9.1, 9.2, 9.3, 9.4
    def median_age(timestamps, now)
      return nil if timestamps.empty?

      ages = timestamps.map { |ts| (now - Time.parse(ts)) / 86_400.0 }
      ages.sort!

      n = ages.size
      if n.odd?
        ages[n / 2]
      else
        (ages[n / 2 - 1] + ages[n / 2]) / 2.0
      end
    end

    # Returns a hex colour string based on a traffic-light threshold scheme.
    # Green  = median age <= 2 years (730.5 days)
    # Yellow = median age > 2 years and <= 5 years (1826.25 days)
    # Red    = median age > 5 years
    # Purple = no data (nil days)
    # Requirements: 3.4, 3.5, 3.6, 3.7, 3.8
    def freshness_color(days, colors)
      return colors['purple1'] || '#69599b' if days.nil?

      days = [days, 0].max

      if days <= 730.5
        colors['green1'] || '#07753f'
      elsif days <= 1826.25
        colors['warningYellow'] || '#ffb200'
      else
        colors['dangerRed'] || '#c40200'
      end
    end

    # Computes the Haversine distance in metres between two geographic
    # coordinate pairs. Uses Earth radius of 6371 km.
    # Parameters are in degrees: lat1, lon1, lat2, lon2.
    # Requirements: 10.3
    def haversine_distance(lat1, lon1, lat2, lon2)
      r = 6_371_000.0 # Earth radius in metres

      dlat = (lat2 - lat1) * Math::PI / 180.0
      dlon = (lon2 - lon1) * Math::PI / 180.0

      lat1_rad = lat1 * Math::PI / 180.0
      lat2_rad = lat2 * Math::PI / 180.0

      a = Math.sin(dlat / 2.0)**2 +
          Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(dlon / 2.0)**2
      c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a))

      r * c
    end

    # Classifies each segment of a geometry as covered or uncovered based
    # on whether the segment midpoint is within `radius` metres of any spot.
    #
    # Handles LineString and Polygon (outer ring) geometries. Unknown
    # geometry types are skipped with a warning.
    #
    # GeoJSON coordinates are [lon, lat] order.
    #
    # Returns { 'covered' => [...], 'uncovered' => [...] } where each
    # value is an array of GeoJSON LineString Feature hashes (2-point segments).
    # Requirements: 4.1, 4.2, 4.3, 4.4, 10.1, 10.2
    def classify_segments(geometry, spots, radius = 5000)
      covered_lines = []
      uncovered_lines = []

      geo_type = geometry['type']
      coord_arrays = case geo_type
                     when 'LineString'
                       [geometry['coordinates']]
                     when 'Polygon'
                       # Use outer ring (first element of coordinates array)
                       [geometry['coordinates']&.first]
                     when 'MultiLineString'
                       geometry['coordinates'] || []
                     when 'MultiPolygon'
                       # Each polygon's outer ring (first element)
                       (geometry['coordinates'] || []).map { |poly| poly&.first }
                     else
                       Jekyll.logger.warn 'DashboardMetrics:', "Unknown geometry type '#{geo_type}', skipping segment classification"
                       return { 'covered' => nil, 'uncovered' => nil }
                     end

      spot_locations = spots.map { |s| s['location'] }.compact

      coord_arrays.each do |coords|
        next if coords.nil? || coords.size < 2

        (0...(coords.size - 1)).each do |i|
          c1 = coords[i]
          c2 = coords[i + 1]

          # GeoJSON: [lon, lat]
          mid_lon = (c1[0] + c2[0]) / 2.0
          mid_lat = (c1[1] + c2[1]) / 2.0

          covered = spot_locations.any? do |loc|
            haversine_distance(mid_lat, mid_lon, loc['lat'], loc['lon']) <= radius
          end

          if covered
            covered_lines << [c1, c2]
          else
            uncovered_lines << [c1, c2]
          end
        end
      end

      {
        'covered' => covered_lines.empty? ? nil : {
          'type' => 'MultiLineString',
          'coordinates' => covered_lines
        },
        'uncovered' => uncovered_lines.empty? ? nil : {
          'type' => 'MultiLineString',
          'coordinates' => uncovered_lines
        }
      }
    end

    # Computes coverage metrics for each unique waterway.
    # Returns an array of metric hashes with slug, name (placeholder),
    # spotCount, coveredSegments, and uncoveredSegments.
    # Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.1, 10.2, 10.3, 10.4
    def compute_coverage_metrics(unique_waterways, unique_spots_by_waterway)
      metrics = []

      unique_waterways.each do |waterway|
        slug = waterway['slug']
        geometry_json = waterway['geometry']

        # Parse geometry JSON; skip waterway if malformed
        geometry = nil
        begin
          geometry = JSON.parse(geometry_json) if geometry_json && !geometry_json.empty?
        rescue JSON::ParserError => e
          Jekyll.logger.warn 'DashboardMetrics:', "Malformed geometry JSON for waterway '#{slug}': #{e.message}"
          next
        end

        next if geometry.nil?

        spots = unique_spots_by_waterway[slug] || []
        segments = classify_segments(geometry, spots)

        metrics << {
          'slug' => slug,
          'name' => 'placeholder',
          'spotCount' => spots.size,
          'coveredSegments' => segments['covered'],
          'uncoveredSegments' => segments['uncovered']
        }
      end

      metrics
    end
  end
end
