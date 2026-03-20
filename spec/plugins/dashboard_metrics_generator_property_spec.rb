# frozen_string_literal: true

# Property-based tests for Jekyll::DashboardMetricsGenerator
# Uses RSpec + rantly for property-based testing.

require 'spec_helper'

RSpec.describe Jekyll::DashboardMetricsGenerator, 'property tests' do
  let(:generator) { described_class.new }

  # ── Property 1: Median age computation correctness ──────────────────────────
  # **Validates: Requirements 9.1, 9.2, 9.3**
  #
  # For any non-empty array of valid ISO 8601 timestamps and any reference
  # time, median_age returns the correct median of the individual ages (in
  # days). Odd-length arrays yield the middle value after sorting; even-length
  # arrays yield the average of the two middle values.
  describe '#median_age — Property 1: Median age computation correctness' do
    it 'computes the correct median for randomly generated timestamp arrays' do
      property_of {
        # Generate a random array size between 1 and 20
        size = range(1, 20)

        # Fixed reference time to keep ages deterministic
        now = Time.utc(2025, 6, 1)

        # Generate random ages in days (0 to 3650 ≈ 10 years), then derive timestamps
        ages_in_days = Array.new(size) { range(0, 3650) }
        timestamps = ages_in_days.map { |d| (now - d * 86_400).iso8601 }

        [timestamps, now]
      }.check(100) { |timestamps, now|
        result = generator.send(:median_age, timestamps, now)

        # Compute expected median independently
        ages = timestamps.map { |ts| (now - Time.parse(ts)) / 86_400.0 }
        ages.sort!
        n = ages.size

        expected = if n.odd?
                     ages[n / 2]
                   else
                     (ages[n / 2 - 1] + ages[n / 2]) / 2.0
                   end

        expect(result).to be_within(0.001).of(expected)
      }
    end
  end

  # ── Property 2: Median age bounded by min and max ───────────────────────────
  # **Validates: Requirements 9.5**
  #
  # For any non-empty array of valid timestamps and any reference time, the
  # computed median age shall be greater than or equal to the minimum age and
  # less than or equal to the maximum age in the array.
  describe '#median_age — Property 2: Median age bounded by min and max' do
    it 'returns a median that lies between the minimum and maximum ages' do
      property_of {
        # Generate a random array size between 1 and 20
        size = range(1, 20)

        # Fixed reference time to keep ages deterministic
        now = Time.utc(2025, 6, 1)

        # Generate random ages in days (0 to 3650 ≈ 10 years), then derive timestamps
        ages_in_days = Array.new(size) { range(0, 3650) }
        timestamps = ages_in_days.map { |d| (now - d * 86_400).iso8601 }

        [timestamps, now, ages_in_days]
      }.check(100) { |timestamps, now, ages_in_days|
        result = generator.send(:median_age, timestamps, now)

        # Compute actual ages from timestamps (same way the implementation does)
        ages = timestamps.map { |ts| (now - Time.parse(ts)) / 86_400.0 }

        min_age = ages.min
        max_age = ages.max

        expect(result).to be >= min_age - 0.001
        expect(result).to be <= max_age + 0.001
      }
    end
  end

  # ── Property 3: Freshness colour traffic-light correctness ───────────────────
  # **Validates: Requirements 3.4, 3.5, 3.6**
  #
  # For any non-negative number of days, freshness_color(days, colors) shall
  # return: green-1 when days <= 730.5 (2 years), warning-yellow when days
  # is in (730.5, 1826.25] (2-5 years), and danger-red when days > 1826.25
  # (> 5 years).
  describe '#freshness_color — Property 3: Freshness colour traffic-light correctness' do
    let(:colors) do
      {
        'green1' => '#07753f',
        'warningYellow' => '#ffb200',
        'dangerRed' => '#c40200',
        'purple1' => '#69599b'
      }
    end

    it 'returns the correct traffic-light colour for random day values' do
      property_of {
        range(0, 5000)
      }.check(100) { |days|
        result = generator.send(:freshness_color, days, colors)

        expected = if days <= 730.5
                     colors['green1']
                   elsif days <= 1826.25
                     colors['warningYellow']
                   else
                     colors['dangerRed']
                   end

        expect(result).to eq(expected),
          "Day #{days}: expected #{expected} but got #{result}"
      }
    end

    it 'returns the correct colour at the boundary values' do
      property_of {
        # Test values at and around the two thresholds
        Rantly { choose(0, 730, 731, 1826, 1827, 3000) }
      }.check(100) { |days|
        result = generator.send(:freshness_color, days, colors)

        expected = if days <= 730.5
                     colors['green1']
                   elsif days <= 1826.25
                     colors['warningYellow']
                   else
                     colors['dangerRed']
                   end

        expect(result).to eq(expected),
          "Boundary day #{days}: expected #{expected} but got #{result}"
      }
    end
  end

  # ── Property 4: Coverage segment classification correctness ─────────────────
  # **Validates: Requirements 10.1, 10.2, 4.2, 4.3, 4.4**
  #
  # For any waterway geometry (LineString or Polygon) and any array of spot
  # locations, every segment classified as "covered" by classify_segments shall
  # have its midpoint within 2000 metres (Haversine) of at least one spot, and
  # every segment classified as "uncovered" shall have its midpoint farther
  # than 2000 metres from all spots.
  describe '#classify_segments — Property 4: Coverage segment classification correctness' do
    # Helper: generate a random coordinate [lon, lat] within Swiss bounds
    def random_coord
      lat = Rantly { range(45_800, 47_800) } / 1000.0
      lon = Rantly { range(5_900, 10_500) } / 1000.0
      [lon, lat]
    end

    it 'classifies every segment correctly based on midpoint distance to spots' do
      property_of {
        # Choose geometry type
        geo_type = choose('LineString', 'Polygon')

        # Generate 3-10 coordinate pairs within Swiss bounds
        num_coords = range(3, 10)
        coords = Array.new(num_coords) {
          lat = range(45_800, 47_800) / 1000.0
          lon = range(5_900, 10_500) / 1000.0
          [lon, lat]
        }

        # Build geometry
        geometry = if geo_type == 'LineString'
                     { 'type' => 'LineString', 'coordinates' => coords }
                   else
                     # Close the ring for Polygon (append first coord)
                     ring = coords + [coords.first]
                     { 'type' => 'Polygon', 'coordinates' => [ring] }
                   end

        # Generate 0-5 random spot locations
        num_spots = range(0, 5)
        spots = Array.new(num_spots) {
          slat = range(45_800, 47_800) / 1000.0
          slon = range(5_900, 10_500) / 1000.0
          { 'location' => { 'lat' => slat, 'lon' => slon } }
        }

        [geometry, spots]
      }.check(100) { |geometry, spots|
        result = generator.send(:classify_segments, geometry, spots)

        # Verify every "covered" segment midpoint is within 2000m of at least one spot
        result['covered'].each do |feature|
          c1 = feature['geometry']['coordinates'][0]
          c2 = feature['geometry']['coordinates'][1]
          mid_lon = (c1[0] + c2[0]) / 2.0
          mid_lat = (c1[1] + c2[1]) / 2.0

          min_dist = spots.map { |s|
            loc = s['location']
            generator.send(:haversine_distance, mid_lat, mid_lon, loc['lat'], loc['lon'])
          }.min

          expect(min_dist).to be <= 2000,
            "Covered segment midpoint (#{mid_lat}, #{mid_lon}) is #{min_dist}m from nearest spot, expected <= 2000m"
        end

        # Verify every "uncovered" segment midpoint is farther than 2000m from all spots
        result['uncovered'].each do |feature|
          c1 = feature['geometry']['coordinates'][0]
          c2 = feature['geometry']['coordinates'][1]
          mid_lon = (c1[0] + c2[0]) / 2.0
          mid_lat = (c1[1] + c2[1]) / 2.0

          spots.each do |s|
            loc = s['location']
            dist = generator.send(:haversine_distance, mid_lat, mid_lon, loc['lat'], loc['lon'])
            expect(dist).to be > 2000,
              "Uncovered segment midpoint (#{mid_lat}, #{mid_lon}) is only #{dist}m from spot (#{loc['lat']}, #{loc['lon']}), expected > 2000m"
          end
        end
      }
    end
  end

  # ── Property 5: Haversine distance accuracy ────────────────────────────────
  # **Validates: Requirements 10.3**
  #
  # For any two geographic coordinate pairs (lat/lon within valid ranges), the
  # Haversine distance computed by haversine_distance shall be within 0.5% of
  # the expected geodesic distance for the same coordinates (validated against
  # the standard Haversine formula with Earth radius 6371 km).
  describe '#haversine_distance — Property 5: Haversine distance accuracy' do
    # Independent reference Haversine implementation (Earth radius 6371 km)
    def reference_haversine(lat1, lon1, lat2, lon2)
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

    it 'computes distances within 0.5% of the reference Haversine formula' do
      property_of {
        # Generate random lat in [-90, 90] and lon in [-180, 180]
        # Use integer ranges divided by 1000.0 for float precision
        lat1 = range(-90_000, 90_000) / 1000.0
        lon1 = range(-180_000, 180_000) / 1000.0
        lat2 = range(-90_000, 90_000) / 1000.0
        lon2 = range(-180_000, 180_000) / 1000.0

        [lat1, lon1, lat2, lon2]
      }.check(100) { |lat1, lon1, lat2, lon2|
        result = generator.send(:haversine_distance, lat1, lon1, lat2, lon2)
        expected = reference_haversine(lat1, lon1, lat2, lon2)

        # Both points identical → distance should be 0
        if lat1 == lat2 && lon1 == lon2
          expect(result).to eq(0.0),
            "Identical points (#{lat1}, #{lon1}): expected 0.0 but got #{result}"
        else
          expect(result).to be_within(expected * 0.005).of(expected),
            "Points (#{lat1}, #{lon1}) → (#{lat2}, #{lon2}): expected ~#{expected.round(2)}m but got #{result.round(2)}m"
        end
      }
    end
  end

  # ── Property 6: Single-spot coverage contiguity ─────────────────────────────
  # **Validates: Requirements 10.5**
  #
  # For any waterway geometry and a single spot location, the segments
  # classified as "covered" by classify_segments shall form a contiguous run
  # (no uncovered segments between two covered segments). The pattern of
  # segment labels should be U*C*U* — zero or more uncovered, then zero or
  # more covered, then zero or more uncovered.
  describe '#classify_segments — Property 6: Single-spot coverage contiguity' do
    it 'produces a contiguous covered run for a single spot' do
      property_of {
        # Generate a LineString with 5-15 coordinate pairs within Swiss bounds
        num_coords = range(5, 15)
        coords = Array.new(num_coords) {
          lat = range(45_800, 47_800) / 1000.0
          lon = range(5_900, 10_500) / 1000.0
          [lon, lat]
        }

        geometry = { 'type' => 'LineString', 'coordinates' => coords }

        # Generate a single spot location within Swiss bounds
        spot_lat = range(45_800, 47_800) / 1000.0
        spot_lon = range(5_900, 10_500) / 1000.0
        spots = [{ 'location' => { 'lat' => spot_lat, 'lon' => spot_lon } }]

        [geometry, spots]
      }.check(100) { |geometry, spots|
        result = generator.send(:classify_segments, geometry, spots)

        # Build an ordered list of segment classifications (C or U)
        # Walk through the original coordinate pairs in order and check
        # which bucket each segment ended up in.
        coords = geometry['coordinates']
        num_segments = coords.size - 1

        # Build a set of covered segment coordinate pairs for fast lookup
        covered_set = result['covered'].map { |f|
          f['geometry']['coordinates']
        }

        labels = (0...num_segments).map { |i|
          seg_coords = [coords[i], coords[i + 1]]
          covered_set.include?(seg_coords) ? :C : :U
        }

        # Verify contiguity: the pattern should be U*C*U*
        # Find the first and last covered index; verify no uncovered
        # segments exist between them.
        first_covered = labels.index(:C)
        last_covered = labels.rindex(:C)

        if first_covered && last_covered
          between = labels[first_covered..last_covered]
          uncovered_between = between.count(:U)

          expect(uncovered_between).to eq(0),
            "Non-contiguous coverage: labels=#{labels.inspect}, " \
            "first_covered=#{first_covered}, last_covered=#{last_covered}, " \
            "found #{uncovered_between} uncovered segment(s) between covered segments"
        end
        # If no covered segments at all, contiguity trivially holds
      }
    end
  end
end
