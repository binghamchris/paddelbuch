# Monkey-patch for jekyll-multiple-languages-plugin v1.8.0 compatibility with Ruby 3.4
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

Jekyll::Hooks.register :site, :after_init do |site|
  next if I18nPatch.patched?

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
