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
        all_spots = site.data['spots'] || []
        all_waterways = site.data['waterways'] || []

        # Deduplicate waterways by slug (they appear once per locale in the data)
        unique_waterways = deduplicate_by_slug(all_waterways)

        # Deduplicate spots by waterway_slug (updatedAt/location are identical across locales)
        spots_by_waterway = all_spots.group_by { |s| s['waterway_slug'] }
        unique_spots_by_waterway = deduplicate_spots_by_waterway(spots_by_waterway)

        @@cached_freshness = compute_freshness_metrics(unique_waterways, unique_spots_by_waterway, colors)
        @@cached_coverage = compute_coverage_metrics(unique_waterways, unique_spots_by_waterway)
      end

      # Localize: swap in locale-specific waterway names
      waterway_names = build_waterway_name_lookup(site.data['waterways'] || [], locale)

      site.data['dashboard_freshness_metrics'] = localize_metrics(@@cached_freshness, waterway_names)
      site.data['dashboard_coverage_metrics'] = localize_metrics(@@cached_coverage, waterway_names)
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

    # Returns a hex colour string interpolated along the freshness gradient.
    # Anchors: 0 days = green1, 1095 days = warningYellow, 1826 days = dangerRed.
    # Returns purple1 for nil days (no data).
    # Clamps negative day values to 0.
    # Requirements: 3.4, 3.5, 3.6, 3.7, 3.8
    def freshness_color(days, colors)
      return colors['purple1'] || '#69599b' if days.nil?

      days = [days, 0].max

      green   = parse_hex(colors['green1'] || '#07753f')
      yellow  = parse_hex(colors['warningYellow'] || '#ffb200')
      red     = parse_hex(colors['dangerRed'] || '#c40200')

      if days <= 1095
        t = days / 1095.0
        interpolate_rgb(green, yellow, t)
      elsif days < 1826
        t = (days - 1095).to_f / (1826 - 1095)
        interpolate_rgb(yellow, red, t)
      else
        to_hex(red)
      end
    end

    # Parses a hex colour string (e.g. '#07753f') into an [r, g, b] array.
    def parse_hex(hex)
      hex = hex.delete('#')
      [hex[0..1], hex[2..3], hex[4..5]].map { |c| c.to_i(16) }
    end

    # Linearly interpolates between two [r, g, b] arrays and returns a hex string.
    def interpolate_rgb(from, to, t)
      r = (from[0] + (to[0] - from[0]) * t).round
      g = (from[1] + (to[1] - from[1]) * t).round
      b = (from[2] + (to[2] - from[2]) * t).round
      to_hex([r.clamp(0, 255), g.clamp(0, 255), b.clamp(0, 255)])
    end

    # Converts an [r, g, b] array to a '#rrggbb' hex string.
    def to_hex(rgb)
      '#%02x%02x%02x' % rgb
    end

    # Stub — implemented in task 1.3
    def compute_coverage_metrics(_unique_waterways, _unique_spots_by_waterway)
      []
    end
  end
end
