# frozen_string_literal: true

# Target: jekyll-multiple-languages-plugin 1.8.x, addresses Ruby 3.4+ String.new(nil) removal
#
# Ruby 3.4 no longer allows String.new(nil). The plugin's TranslatedString class
# inherits from String and calls super(value) where value can be nil when a
# translation key is missing. This patch ensures nil is converted to an empty string.

module I18nPatch
  @patched = false

  def self.patched?
    @patched
  end

  def self.patched!
    @patched = true
  end
end

i18n_spec = Gem.loaded_specs['jekyll-multiple-languages-plugin']
i18n_version = i18n_spec&.version&.to_s

Jekyll::Hooks.register :site, :after_init do |site|
  next if I18nPatch.patched?

  if i18n_version && !i18n_version.start_with?('1.8')
    Jekyll.logger.warn 'I18nPatch:', "jekyll-multiple-languages-plugin #{i18n_version} detected, patch targets 1.8.x — skipping patch"
    I18nPatch.patched!
    next
  end

  if defined?(TranslatedString)
    TranslatedString.class_eval do
      def initialize(*several_variants, key)
        safe_variants = several_variants.map { |v| v.nil? ? '' : v }
        super(*safe_variants)
        @key = key
      end
    end
  end

  I18nPatch.patched!
end
