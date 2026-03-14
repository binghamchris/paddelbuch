# frozen_string_literal: true

# Feature: best-practices-cleanup, Property 8: SCSS color parsing to JSON

require 'spec_helper'

RSpec.describe 'Property 8: SCSS color parsing to JSON' do
  # Validates: Requirements 5.3

  let(:generator) { Jekyll::ColorGenerator.new }

  # Helper to call private methods
  def parse_colors(gen, content)
    gen.send(:parse_colors, content)
  end

  def to_camel_case(gen, name)
    gen.send(:to_camel_case, name)
  end

  # Generate a random SCSS variable name: lowercase letters, digits, hyphens
  # Must start with a letter, at least 2 chars, contain at least one hyphen for interesting camelCase
  def random_scss_var_name
    # First segment: 1-5 lowercase letters
    first = Array.new(rand(1..5)) { ('a'..'z').to_a.sample }.join

    # 1-3 additional segments separated by hyphens
    segments = Array.new(rand(1..3)) do
      len = rand(1..5)
      Array.new(len) { (('a'..'z').to_a + ('0'..'9').to_a).sample }.join
    end

    ([first] + segments).join('-')
  end

  # Generate a random 3 or 6 digit hex color
  def random_hex_color
    hex_chars = ('0'..'9').to_a + ('a'..'f').to_a
    length = [3, 6].sample
    "##{Array.new(length) { hex_chars.sample }.join}"
  end

  # Convert a hyphenated name to expected camelCase
  def expected_camel_case(name)
    parts = name.split(/[-_]/)
    parts[0] + parts[1..].map(&:capitalize).join
  end

  it 'correctly parses $variable: #hex lines into camelCase keys with matching hex values for 100 random inputs' do
    100.times do |i|
      # Generate 1-8 random SCSS variable/color pairs
      num_vars = rand(1..8)
      expected = {}
      scss_lines = []

      num_vars.times do
        name = random_scss_var_name
        hex = random_hex_color
        scss_lines << "$#{name}: #{hex};"
        expected[expected_camel_case(name)] = hex
      end

      scss_content = scss_lines.join("\n")
      result = parse_colors(generator, scss_content)

      expect(result.keys.sort).to eq(expected.keys.sort),
        "Iteration #{i + 1}: keys mismatch.\n" \
        "SCSS:\n#{scss_content}\n" \
        "Expected keys: #{expected.keys.sort}\n" \
        "Got keys: #{result.keys.sort}"

      expected.each do |key, hex|
        expect(result[key]).to eq(hex),
          "Iteration #{i + 1}: value mismatch for key '#{key}'.\n" \
          "Expected: #{hex}, Got: #{result[key]}"
      end
    end
  end

  it 'excludes rgba() values from parsed output for 100 random inputs' do
    100.times do |i|
      name = random_scss_var_name
      hex = random_hex_color

      # Mix a valid hex line with an rgba line
      rgba_name = random_scss_var_name
      r = rand(0..255)
      g = rand(0..255)
      b = rand(0..255)
      a = rand(0..10) / 10.0

      scss_content = [
        "$#{name}: #{hex};",
        "$#{rgba_name}: rgba(#{r}, #{g}, #{b}, #{a});"
      ].join("\n")

      result = parse_colors(generator, scss_content)

      camel_rgba = expected_camel_case(rgba_name)
      expect(result).not_to have_key(camel_rgba),
        "Iteration #{i + 1}: rgba variable '#{rgba_name}' (key '#{camel_rgba}') " \
        "should be excluded but was present in output"

      camel_hex = expected_camel_case(name)
      expect(result).to have_key(camel_hex),
        "Iteration #{i + 1}: hex variable '#{name}' (key '#{camel_hex}') " \
        "should be present but was missing from output"
    end
  end

  it 'produces correct camelCase conversion for 100 random variable names' do
    100.times do |i|
      name = random_scss_var_name
      result = to_camel_case(generator, name)
      expected = expected_camel_case(name)

      expect(result).to eq(expected),
        "Iteration #{i + 1}: to_camel_case('#{name}') returned '#{result}', " \
        "expected '#{expected}'"
    end
  end
end
