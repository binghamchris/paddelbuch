# frozen_string_literal: true

require 'set'

# Jekyll plugin to pre-compute statistics dashboard metrics at build time.
#
# Computes counts for spots (by type), obstacles (by portage route),
# protected areas (by type), paddle craft types, data source types,
# and data license types. Exposes results as
# site.data['dashboard_statistics_metrics'].
#
# Follows the compute-once-cache-across-locales pattern from
# DashboardMetricsGenerator: numerical computations are locale-independent,
# so they run once on the first locale pass and are cached in class-level
# variables. On subsequent locale passes only the type names are swapped in.

module Jekyll
  class StatisticsMetricsGenerator < Generator
    safe true
    priority :normal

    @@cached_metrics = nil

    def generate(site)
      locale = site.config['lang'] || site.config['default_lang'] || 'de'

      if @@cached_metrics.nil?
        Jekyll.logger.info 'StatisticsMetrics:', 'Starting statistics metrics computation...'
        @@cached_metrics = compute_metrics(site)
        Jekyll.logger.info 'StatisticsMetrics:', 'Statistics metrics computation finished (cached for subsequent locale passes)'
      else
        Jekyll.logger.info 'StatisticsMetrics:', "Using cached metrics for locale '#{locale}'"
      end

      localized = localize_metrics(@@cached_metrics, locale, site)
      site.data['dashboard_statistics_metrics'] = localized
      site.data['dashboard_spot_freshness_map_data'] = localize_spot_freshness_map_data(@@cached_metrics['spotFreshnessMapData'], locale, site)
      site.data['dashboard_obstacle_portage_map_data'] = localize_obstacle_portage_map_data(@@cached_metrics['obstaclePortageMapData'], locale, site)
      Jekyll.logger.info 'StatisticsMetrics:', "Localized statistics metrics for locale '#{locale}'"
    end

    private

    # Deduplicates an array of entity hashes by slug, keeping the first
    # occurrence. Skips entries with nil slugs.
    def deduplicate_by_slug(entities)
      seen = {}
      (entities || []).each do |entity|
        slug = entity['slug']
        next if slug.nil?

        seen[slug] ||= entity
      end
      seen.values
    end

    # Computes all statistics metrics (locale-independent counts).
    def compute_metrics(site)
      spots = deduplicate_by_slug(site.data['spots'])
      obstacles = deduplicate_by_slug(site.data['obstacles'])
      protected_areas = deduplicate_by_slug(site.data['protected_areas'])
      waterways = deduplicate_by_slug(site.data['waterways'])
      notices = deduplicate_by_slug(site.data['notices'])

      Jekyll.logger.warn 'StatisticsMetrics:', 'No spot data found -- spot metrics will be empty' if spots.empty?
      Jekyll.logger.warn 'StatisticsMetrics:', 'No obstacle data found -- obstacle metrics will be empty' if obstacles.empty?

      spot_types = deduplicate_by_slug(site.data.dig('types', 'spot_types'))
      protected_area_types = deduplicate_by_slug(site.data.dig('types', 'protected_area_types'))
      paddle_craft_types = deduplicate_by_slug(site.data.dig('types', 'paddle_craft_types'))
      data_source_types = deduplicate_by_slug(site.data.dig('types', 'data_source_types'))
      data_license_types = deduplicate_by_slug(site.data.dig('types', 'data_license_types'))

      Jekyll.logger.warn 'StatisticsMetrics:', 'No spot type definitions found' if spot_types.empty?
      Jekyll.logger.warn 'StatisticsMetrics:', 'No paddle craft type definitions found' if paddle_craft_types.empty?
      Jekyll.logger.warn 'StatisticsMetrics:', 'No data source type definitions found' if data_source_types.empty?
      Jekyll.logger.warn 'StatisticsMetrics:', 'No data license type definitions found' if data_license_types.empty?

      # Exclude obstacles linked to non-navigable waterways
      non_navigable_slugs = waterways
        .select { |w| w['navigableByPaddlers'] == false }
        .map { |w| w['slug'] }
        .to_set
      pre_filter_obstacle_count = obstacles.size
      obstacles = obstacles.reject { |o| non_navigable_slugs.include?(o['waterway_slug']) }
      excluded_obstacle_count = pre_filter_obstacle_count - obstacles.size
      Jekyll.logger.info 'StatisticsMetrics:', "Excluded #{excluded_obstacle_count} obstacles on non-navigable waterways, #{obstacles.size} remaining"

      Jekyll.logger.info 'StatisticsMetrics:', "Entities: #{spots.size} spots, #{obstacles.size} obstacles, #{protected_areas.size} protected areas, #{waterways.size} waterways, #{notices.size} notices"
      Jekyll.logger.info 'StatisticsMetrics:', "Types: #{spot_types.size} spot types, #{protected_area_types.size} PA types, #{paddle_craft_types.size} craft types, #{data_source_types.size} source types, #{data_license_types.size} license types"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing spot metrics...'
      spot_metrics = compute_spot_metrics(spots, spot_types)
      Jekyll.logger.info 'StatisticsMetrics:', "Spot metrics complete: #{spot_metrics['total']} total (#{spot_metrics['byType'].size} segments)"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing obstacle metrics...'
      obstacle_metrics = compute_obstacle_metrics(obstacles)
      Jekyll.logger.info 'StatisticsMetrics:', "Obstacle metrics complete: #{obstacle_metrics['total']} total (#{obstacle_metrics['withPortageRoute']} with portage, #{obstacle_metrics['withoutPortageRoute']} without)"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing protected area metrics...'
      pa_metrics = compute_protected_area_metrics(protected_areas, protected_area_types)
      Jekyll.logger.info 'StatisticsMetrics:', "Protected area metrics complete: #{pa_metrics['total']} total (#{pa_metrics['byType'].size} segments)"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing paddle craft type metrics...'
      craft_metrics = compute_paddle_craft_metrics(spots, paddle_craft_types)
      Jekyll.logger.info 'StatisticsMetrics:', "Paddle craft metrics complete: #{craft_metrics.size} types"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing data source type metrics...'
      source_metrics = compute_data_source_metrics(spots, obstacles, protected_areas, waterways, notices, data_source_types)
      Jekyll.logger.info 'StatisticsMetrics:', "Data source metrics complete: #{source_metrics.size} types"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing data license type metrics...'
      license_metrics = compute_data_license_metrics(spots, obstacles, protected_areas, waterways, notices, data_license_types)
      Jekyll.logger.info 'StatisticsMetrics:', "Data license metrics complete: #{license_metrics.size} types"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing spot freshness metrics...'
      freshness_metrics = compute_spot_freshness_metrics(spots)
      Jekyll.logger.info 'StatisticsMetrics:', "Spot freshness metrics complete: fresh=#{freshness_metrics['fresh']}, aging=#{freshness_metrics['aging']}, stale=#{freshness_metrics['stale']}"

      spot_metrics['freshness'] = freshness_metrics

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing spot freshness map data...'
      spot_freshness_map_data = compute_spot_freshness_map_data(spots)
      Jekyll.logger.info 'StatisticsMetrics:', "Spot freshness map data complete: #{spot_freshness_map_data.size} entries"

      Jekyll.logger.info 'StatisticsMetrics:', 'Computing obstacle portage map data...'
      obstacle_portage_map_data = compute_obstacle_portage_map_data(obstacles)
      Jekyll.logger.info 'StatisticsMetrics:', "Obstacle portage map data complete: #{obstacle_portage_map_data.size} entries"

      {
        'spots' => spot_metrics,
        'obstacles' => obstacle_metrics,
        'protectedAreas' => pa_metrics,
        'paddleCraftTypes' => craft_metrics,
        'dataSourceTypes' => source_metrics,
        'dataLicenseTypes' => license_metrics,
        'spotFreshnessMapData' => spot_freshness_map_data,
        'obstaclePortageMapData' => obstacle_portage_map_data
      }
    end

    # Spots: total + breakdown by spot type, with rejected spots as "no-entry".
    def compute_spot_metrics(spots, spot_types)
      by_type = {}
      no_entry_count = 0

      spots.each do |spot|
        if spot['rejected'] == true
          no_entry_count += 1
        else
          type_slug = spot['spotType_slug']
          next if type_slug.nil?

          by_type[type_slug] ||= 0
          by_type[type_slug] += 1
        end
      end

      type_entries = spot_types.map do |st|
        slug = st['slug']
        { 'slug' => slug, 'name' => slug, 'count' => by_type[slug] || 0 }
      end

      # Append the "no-entry" pseudo-type
      type_entries << { 'slug' => 'no-entry', 'name' => 'no-entry', 'count' => no_entry_count }

      { 'total' => spots.size, 'byType' => type_entries }
    end

    # Obstacles: total + with/without portage route.
    def compute_obstacle_metrics(obstacles)
      with_portage = 0
      without_portage = 0

      obstacles.each do |obstacle|
        if obstacle['portageRoute'].nil?
          without_portage += 1
        else
          with_portage += 1
        end
      end

      {
        'total' => obstacles.size,
        'withPortageRoute' => with_portage,
        'withoutPortageRoute' => without_portage
      }
    end

    # Protected areas: total + breakdown by protected area type.
    def compute_protected_area_metrics(protected_areas, protected_area_types)
      by_type = {}

      protected_areas.each do |pa|
        type_slug = pa['protectedAreaType_slug']
        next if type_slug.nil?

        by_type[type_slug] ||= 0
        by_type[type_slug] += 1
      end

      type_entries = protected_area_types.map do |pat|
        slug = pat['slug']
        { 'slug' => slug, 'name' => slug, 'count' => by_type[slug] || 0 }
      end

      { 'total' => protected_areas.size, 'byType' => type_entries }
    end

    # Paddle craft types: count of unique non-rejected spots per craft type.
    def compute_paddle_craft_metrics(spots, paddle_craft_types)
      available_spots = spots.reject { |spot| spot['rejected'] == true }
      paddle_craft_types.map do |pct|
        slug = pct['slug']
        count = available_spots.count do |spot|
          craft_types = spot['paddleCraftTypes']
          craft_types.is_a?(Array) && craft_types.include?(slug)
        end
        { 'slug' => slug, 'name' => slug, 'count' => count }
      end
    end

    # Data source types: sum of unique entities across all five entity types.
    def compute_data_source_metrics(spots, obstacles, protected_areas, waterways, notices, data_source_types)
      all_entities = [spots, obstacles, protected_areas, waterways, notices]

      data_source_types.map do |dst|
        slug = dst['slug']
        count = all_entities.sum do |entities|
          entities.count { |e| e['dataSourceType_slug'] == slug }
        end
        { 'slug' => slug, 'name' => slug, 'count' => count }
      end
    end

    # Data license types: sum of unique entities across all five entity types.
    def compute_data_license_metrics(spots, obstacles, protected_areas, waterways, notices, data_license_types)
      all_entities = [spots, obstacles, protected_areas, waterways, notices]

      data_license_types.map do |dlt|
        slug = dlt['slug']
        count = all_entities.sum do |entities|
          entities.count { |e| e['dataLicenseType_slug'] == slug }
        end
        { 'slug' => slug, 'name' => slug, 'count' => count }
      end
    end

    # Per-spot freshness map data: returns an array of { slug, lat, lon, category }
    # for each non-rejected spot with valid location and updatedAt.
    # Used by the Spot Freshness Dashboard map.
    def compute_spot_freshness_map_data(spots)
      now = Time.now
      spots.filter_map do |spot|
        next if spot['rejected'] == true

        location = spot['location']
        next if location.nil? || location['lat'].nil? || location['lon'].nil?

        updated_at = spot['updatedAt']
        next if updated_at.nil?

        days = [(now - Time.parse(updated_at)) / 86_400.0, 0].max
        category = if days <= 730.5 then 'fresh'
                   elsif days <= 1826.25 then 'aging'
                   else 'stale'
                   end

        { 'slug' => spot['slug'], 'name' => 'placeholder', 'lat' => location['lat'], 'lon' => location['lon'], 'category' => category, 'ageDays' => days.round(1) }
      end
    end

    # Deep-clones cached spot freshness map data and replaces placeholder
    # names with locale-specific spot names.
    def localize_spot_freshness_map_data(cached_map_data, locale, site)
      spot_names = {}
      (site.data['spots'] || []).each do |s|
        next unless s['locale'] == locale && s['slug']

        spot_names[s['slug']] = s['name']
      end

      cached_map_data.map do |entry|
        cloned = entry.dup
        cloned['name'] = spot_names[cloned['slug']] || cloned['slug']
        cloned
      end
    end

    # Per-obstacle portage map data: returns an array of
    # { slug, name, lat, lon, hasPortageRoute } for each obstacle with
    # valid geometry. The lat/lon is the centroid of the geometry.
    def compute_obstacle_portage_map_data(obstacles)
      obstacles.filter_map do |obstacle|
        geometry_json = obstacle['geometry']
        next if geometry_json.nil? || geometry_json.empty?

        geometry = begin
          JSON.parse(geometry_json)
        rescue JSON::ParserError
          next
        end

        centroid = geometry_centroid(geometry)
        next if centroid.nil?

        {
          'slug' => obstacle['slug'],
          'name' => 'placeholder',
          'lat' => centroid[1],
          'lon' => centroid[0],
          'hasPortageRoute' => !obstacle['portageRoute'].nil?
        }
      end
    end

    # Deep-clones cached obstacle portage map data and replaces placeholder
    # names with locale-specific obstacle names.
    def localize_obstacle_portage_map_data(cached_map_data, locale, site)
      obstacle_names = {}
      (site.data['obstacles'] || []).each do |o|
        next unless o['locale'] == locale && o['slug']

        obstacle_names[o['slug']] = o['name']
      end

      cached_map_data.map do |entry|
        cloned = entry.dup
        cloned['name'] = obstacle_names[cloned['slug']] || cloned['slug']
        cloned
      end
    end

    # Computes the centroid of a GeoJSON geometry by averaging all
    # coordinates. Returns [lon, lat] or nil if no coordinates found.
    def geometry_centroid(geometry)
      coords = collect_coordinates(geometry)
      return nil if coords.empty?

      sum_lon = 0.0
      sum_lat = 0.0
      coords.each do |c|
        sum_lon += c[0]
        sum_lat += c[1]
      end
      [sum_lon / coords.size, sum_lat / coords.size]
    end

    # Recursively collects all [lon, lat] coordinate pairs from a GeoJSON
    # geometry object.
    def collect_coordinates(geometry)
      return [] if geometry.nil?

      case geometry['type']
      when 'Point'
        [geometry['coordinates']]
      when 'LineString', 'MultiPoint'
        geometry['coordinates'] || []
      when 'Polygon', 'MultiLineString'
        (geometry['coordinates'] || []).flatten(1)
      when 'MultiPolygon'
        (geometry['coordinates'] || []).flatten(2)
      when 'GeometryCollection'
        (geometry['geometries'] || []).flat_map { |g| collect_coordinates(g) }
      else
        []
      end
    end

    # Spot freshness: classifies non-rejected spots into freshness buckets
    # using the same thresholds as the waterway freshness dashboard.
    # Fresh: <= 730.5 days (<= 2 years)
    # Aging: > 730.5 and <= 1826.25 days (2-5 years)
    # Stale: > 1826.25 days (> 5 years)
    # No data: nil updatedAt
    def compute_spot_freshness_metrics(spots)
      now = Time.now
      fresh = 0
      aging = 0
      stale = 0

      spots.each do |spot|
        next if spot['rejected'] == true

        updated_at = spot['updatedAt']
        next if updated_at.nil?

        days = (now - Time.parse(updated_at)) / 86_400.0
        days = [days, 0].max
        if days <= 730.5
          fresh += 1
        elsif days <= 1826.25
          aging += 1
        else
          stale += 1
        end
      end

      { 'fresh' => fresh, 'aging' => aging, 'stale' => stale }
    end

    # Deep-clones cached metrics and replaces placeholder type names with
    # locale-appropriate name_de/name_en from type definition files.
    def localize_metrics(cached_metrics, locale, site)
      metrics = Marshal.load(Marshal.dump(cached_metrics))

      name_field = locale == 'en' ? 'name_en' : 'name_de'

      # Build lookup tables for type names: { slug => localized_name }
      type_lookups = {}
      %w[spot_types protected_area_types paddle_craft_types data_source_types data_license_types].each do |type_key|
        lookup = {}
        (site.data.dig('types', type_key) || []).each do |t|
          next unless t['locale'] == locale

          lookup[t['slug']] = t[name_field] if t['slug']
        end
        type_lookups[type_key] = lookup
      end

      # Localize spot type names
      if metrics['spots'] && metrics['spots']['byType']
        metrics['spots']['byType'].each do |entry|
          if entry['slug'] == 'no-entry'
            entry['name'] = locale == 'en' ? 'No Entry' : 'Kein Zutritt'
          else
            entry['name'] = type_lookups['spot_types'][entry['slug']] || entry['slug']
          end
        end
      end

      # Localize protected area type names
      if metrics['protectedAreas'] && metrics['protectedAreas']['byType']
        metrics['protectedAreas']['byType'].each do |entry|
          entry['name'] = type_lookups['protected_area_types'][entry['slug']] || entry['slug']
        end
      end

      # Localize paddle craft type names
      if metrics['paddleCraftTypes']
        metrics['paddleCraftTypes'].each do |entry|
          entry['name'] = type_lookups['paddle_craft_types'][entry['slug']] || entry['slug']
        end
      end

      # Localize data source type names
      if metrics['dataSourceTypes']
        metrics['dataSourceTypes'].each do |entry|
          entry['name'] = type_lookups['data_source_types'][entry['slug']] || entry['slug']
        end
      end

      # Localize data license type names
      if metrics['dataLicenseTypes']
        metrics['dataLicenseTypes'].each do |entry|
          entry['name'] = type_lookups['data_license_types'][entry['slug']] || entry['slug']
        end
      end

      metrics
    end
  end
end
