# frozen_string_literal: true

require 'json'

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

    # Stub — implemented in task 1.2
    def compute_freshness_metrics(_unique_waterways, _unique_spots_by_waterway, _colors)
      []
    end

    # Stub — implemented in task 1.3
    def compute_coverage_metrics(_unique_waterways, _unique_spots_by_waterway)
      []
    end
  end
end
