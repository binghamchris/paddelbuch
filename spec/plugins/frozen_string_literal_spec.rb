# frozen_string_literal: true

# Feature: best-practices-cleanup, Property 1: Frozen string literal presence and uniqueness

require 'spec_helper'

RSpec.describe 'Property 1: Frozen string literal presence and uniqueness' do
  PLUGINS_DIR = File.expand_path('../../_plugins', __dir__)
  MAGIC_COMMENT = '# frozen_string_literal: true'

  plugin_files = Dir[File.join(PLUGINS_DIR, '*.rb')]

  # Sanity check: ensure we actually found plugin files to test
  it 'finds at least one .rb file in _plugins/' do
    expect(plugin_files).not_to be_empty
  end

  # Validates: Requirements 1.1, 1.2
  plugin_files.each do |filepath|
    filename = File.basename(filepath)

    describe filename do
      let(:lines) { File.readlines(filepath, chomp: true) }
      let(:first_non_empty_line) { lines.find { |line| !line.strip.empty? } }
      let(:occurrence_count) { lines.count { |line| line.strip == MAGIC_COMMENT } }

      it 'has frozen_string_literal: true as the first non-empty line' do
        expect(first_non_empty_line).to eq(MAGIC_COMMENT),
          "Expected first non-empty line of #{filename} to be '#{MAGIC_COMMENT}', " \
          "got '#{first_non_empty_line}'"
      end

      it 'contains the frozen_string_literal comment exactly once' do
        expect(occurrence_count).to eq(1),
          "Expected '#{MAGIC_COMMENT}' to appear exactly once in #{filename}, " \
          "found #{occurrence_count} occurrences"
      end
    end
  end

  # Property-based iteration: verify the invariant holds across 100 random
  # samplings of the plugin file set (satisfies minimum 100 iterations requirement).
  # Each iteration picks a random plugin file and checks both properties.
  it 'holds for 100 random samplings of plugin files' do
    expect(plugin_files.length).to be > 0

    100.times do
      filepath = plugin_files.sample
      lines = File.readlines(filepath, chomp: true)

      first_non_empty = lines.find { |line| !line.strip.empty? }
      expect(first_non_empty).to eq(MAGIC_COMMENT),
        "Random sample #{File.basename(filepath)}: first non-empty line was '#{first_non_empty}'"

      count = lines.count { |line| line.strip == MAGIC_COMMENT }
      expect(count).to eq(1),
        "Random sample #{File.basename(filepath)}: comment appeared #{count} times"
    end
  end
end
