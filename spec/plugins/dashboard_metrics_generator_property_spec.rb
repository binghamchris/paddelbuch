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

  # ── Property 3: Freshness colour gradient correctness ───────────────────────
  # **Validates: Requirements 3.4, 3.5, 3.6**
  #
  # For any non-negative number of days, freshness_color(days, colors) shall
  # return: a colour linearly interpolated between green-1 and warning-yellow
  # when days is in [0, 1095]; a colour linearly interpolated between
  # warning-yellow and danger-red when days is in (1095, 1826); and exactly
  # danger-red when days >= 1826. At the anchor points (0, 1095, 1826), the
  # colour shall exactly match the corresponding anchor colour.
  describe '#freshness_color — Property 3: Freshness colour gradient correctness' do
    let(:colors) do
      {
        'green1' => '#07753f',
        'warningYellow' => '#ffb200',
        'dangerRed' => '#c40200',
        'purple1' => '#69599b'
      }
    end

    # Helper: parse hex colour to [r, g, b]
    def parse_hex(hex)
      hex = hex.delete('#')
      [hex[0..1], hex[2..3], hex[4..5]].map { |c| c.to_i(16) }
    end

    # Helper: independently compute expected RGB for a given day value
    def expected_rgb(days, colors)
      green  = parse_hex(colors['green1'])
      yellow = parse_hex(colors['warningYellow'])
      red    = parse_hex(colors['dangerRed'])

      days = [days, 0].max

      if days <= 1095
        t = days / 1095.0
        green.zip(yellow).map { |from, to| (from + (to - from) * t).round.clamp(0, 255) }
      elsif days < 1826
        t = (days - 1095).to_f / (1826 - 1095)
        yellow.zip(red).map { |from, to| (from + (to - from) * t).round.clamp(0, 255) }
      else
        red
      end
    end

    it 'returns correctly interpolated colours for random day values' do
      property_of {
        range(0, 5000)
      }.check(100) { |days|
        result = generator.send(:freshness_color, days, colors)

        # Parse the result hex back to RGB
        result_rgb = parse_hex(result)

        # Compute expected RGB independently
        exp_rgb = expected_rgb(days, colors)

        # Each channel should match exactly (both use the same rounding)
        expect(result_rgb).to eq(exp_rgb),
          "Day #{days}: expected #{exp_rgb.inspect} but got #{result_rgb.inspect} (hex: #{result})"
      }
    end

    it 'exactly matches anchor colours at day 0, 1095, and 1826' do
      property_of {
        # Repeatedly test the three anchor points across iterations
        Rantly { choose(0, 1095, 1826) }
      }.check(100) { |days|
        result = generator.send(:freshness_color, days, colors)

        expected = case days
                   when 0    then colors['green1']
                   when 1095 then colors['warningYellow']
                   when 1826 then colors['dangerRed']
                   end

        expect(result).to eq(expected),
          "Anchor day #{days}: expected #{expected} but got #{result}"
      }
    end
  end
end
