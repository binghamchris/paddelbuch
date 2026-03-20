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
end
