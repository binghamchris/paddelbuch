# frozen_string_literal: true

# Tests for I18nPatch — Ruby 3.4 nil-safety monkey-patch for TranslatedString
# **Validates: Requirements 2.10**

require 'spec_helper'

# Define a minimal TranslatedString class (inheriting from String) if the
# jekyll-multiple-languages-plugin gem is not loaded in the test environment.
# This mirrors the real class's constructor signature: initialize(value, key).
unless defined?(TranslatedString)
  class TranslatedString < String
    attr_reader :key

    def initialize(value, key)
      super(value)
      @key = key
    end
  end
end

RSpec.describe 'I18nPatch' do
  # Helper: find and invoke only the i18n_patch :after_init hook.
  # We identify it by source location to avoid triggering unrelated hooks
  # (e.g. env_loader).
  def trigger_i18n_hook(site)
    hooks = Jekyll::Hooks.instance_variable_get(:@registry)
    after_init_hooks = hooks.dig(:site, :after_init) || []
    i18n_hook = after_init_hooks.find do |hook|
      hook.source_location&.first&.include?('i18n_patch')
    end
    raise 'i18n_patch hook not found in registry' unless i18n_hook

    i18n_hook.call(site)
  end

  let(:site) { double('Jekyll::Site') }

  before do
    # Reset the patched flag so each test starts clean
    I18nPatch.instance_variable_set(:@patched, false)

    # Re-define the original (unpatched) initialize so the patch can be applied fresh
    TranslatedString.class_eval do
      define_method(:initialize) do |value, key|
        super(value)
        @key = key
      end
    end
  end

  describe 'after hook fires' do
    before { trigger_i18n_hook(site) }

    it 'does not raise when TranslatedString is created with nil value' do
      expect { TranslatedString.new(nil, 'some.key') }.not_to raise_error
    end

    it 'converts nil value to empty string' do
      ts = TranslatedString.new(nil, 'some.key')
      expect(ts.to_s).to eq('')
    end

    it 'still works with a normal string value' do
      ts = TranslatedString.new('hello', 'greeting.key')
      expect(ts.to_s).to eq('hello')
      expect(ts.key).to eq('greeting.key')
    end

    it 'sets I18nPatch.patched? to true' do
      expect(I18nPatch.patched?).to be true
    end
  end

  describe 'idempotency' do
    it 'second hook execution is a no-op' do
      trigger_i18n_hook(site)
      expect(I18nPatch.patched?).to be true

      # Capture the initialize method after first patch
      patched_method = TranslatedString.instance_method(:initialize)

      # Fire the hook again
      trigger_i18n_hook(site)

      # The initialize method should be the same object (not re-patched)
      expect(TranslatedString.instance_method(:initialize)).to eq(patched_method)
      expect(I18nPatch.patched?).to be true
    end
  end
end
