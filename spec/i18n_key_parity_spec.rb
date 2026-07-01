# frozen_string_literal: true

require 'spec_helper'
require 'yaml'
require 'set'

# Feature: quality-and-tooling-hardening, Property 5: Translation key parity
# Validates: Requirements 5.1, 5.2
#
# Flattens _i18n/de.yml and _i18n/en.yml into sets of dotted key paths and asserts
# the two sets are identical. When they diverge, the offending key paths are
# reported so the missing translations can be located quickly.
RSpec.describe 'i18n translation key parity' do
  # Recursively flattens a nested hash into a list of dotted key paths.
  # Non-Hash values (strings, nil, arrays) terminate a path and become leaves.
  def flatten_keys(value, prefix = '')
    return [prefix] unless value.is_a?(Hash)

    value.flat_map do |key, sub|
      child_prefix = prefix.empty? ? key.to_s : "#{prefix}.#{key}"
      flatten_keys(sub, child_prefix)
    end
  end

  let(:i18n_dir) { File.expand_path('../_i18n', __dir__) }
  let(:de_data) { YAML.safe_load_file(File.join(i18n_dir, 'de.yml')) }
  let(:en_data) { YAML.safe_load_file(File.join(i18n_dir, 'en.yml')) }
  let(:de_keys) { flatten_keys(de_data).to_set }
  let(:en_keys) { flatten_keys(en_data).to_set }

  it 'has no key paths present in de.yml but missing from en.yml' do
    missing = (de_keys - en_keys).sort
    expect(missing).to be_empty,
      "Key paths in de.yml missing from en.yml:\n  #{missing.join("\n  ")}"
  end

  it 'has no key paths present in en.yml but missing from de.yml' do
    missing = (en_keys - de_keys).sort
    expect(missing).to be_empty,
      "Key paths in en.yml missing from de.yml:\n  #{missing.join("\n  ")}"
  end

  it 'has identical key-path sets in both locales (Property 5)' do
    expect(de_keys).to eq(en_keys)
  end

  # Property 5 (Rantly): for any sampled key path from the union of both files,
  # the path must exist in BOTH locales. This holds if and only if the key sets
  # are equal, and surfaces a concrete counterexample key on failure.
  it 'Property 5: any sampled key path exists in both locales' do
    de = flatten_keys(de_data).to_set
    en = flatten_keys(en_data).to_set
    all_keys = (de | en).to_a

    skip 'no translation keys found' if all_keys.empty?

    property_of {
      Rantly { all_keys[range(0, all_keys.size - 1)] }
    }.check(100) do |key|
      expect(de).to include(key),
        "Key '#{key}' present in en.yml but missing from de.yml"
      expect(en).to include(key),
        "Key '#{key}' present in de.yml but missing from en.yml"
    end
  end
end
