# Locale filtering plugin for Jekyll
# Provides filters and utilities for filtering content by locale

module Jekyll
  module LocaleFilter
    # Filter an array of items by locale
    # Usage: {{ site.data.spots | filter_by_locale: site.lang }}
    def filter_by_locale(items, locale)
      return [] unless items.is_a?(Array)
      return items if locale.nil? || locale.empty?
      
      items.select do |item|
        item_locale = item['locale'] || item[:locale]
        item_locale.nil? || item_locale == locale || item_locale == '*'
      end
    end
    
    # Get localized data file
    # Usage: {{ site.data | localized_data: 'spots', site.lang }}
    def localized_data(data, key, locale)
      return nil unless data.is_a?(Hash)
      
      # Try locale-specific key first (e.g., spots_de)
      localized_key = "#{key}_#{locale}"
      return data[localized_key] if data[localized_key]
      
      # Fall back to base key
      data[key]
    end
    
    # Get translation from i18n
    # Usage: {{ 'nav.spots' | t }}
    def t(key)
      site = @context.registers[:site]
      lang = site.config['lang'] || site.config['default_lang'] || 'de'
      
      # Load translations
      translations = site.data['translations'] || {}
      lang_translations = translations[lang] || {}
      
      # Navigate nested keys
      keys = key.to_s.split('.')
      result = lang_translations
      
      keys.each do |k|
        result = result[k] if result.is_a?(Hash)
        break unless result
      end
      
      result || key
    end
    
    # Format date according to locale
    # Usage: {{ page.date | localized_date }}
    def localized_date(date, format = nil)
      return '' unless date
      
      site = @context.registers[:site]
      lang = site.config['lang'] || site.config['default_lang'] || 'de'
      
      # Parse date if string
      date = Date.parse(date.to_s) if date.is_a?(String)
      
      # Get format from config or use default
      if format.nil?
        format = case lang
                 when 'de' then '%d.%m.%Y'
                 when 'en' then '%d/%m/%Y'
                 else '%Y-%m-%d'
                 end
      end
      
      date.strftime(format)
    rescue ArgumentError
      date.to_s
    end
    
    # Check if content matches current locale
    # Usage: {% if item | matches_locale: site.lang %}
    def matches_locale(item, locale)
      return true if locale.nil? || locale.empty?
      
      item_locale = item['locale'] || item[:locale]
      item_locale.nil? || item_locale == locale || item_locale == '*'
    end
  end
end

Liquid::Template.register_filter(Jekyll::LocaleFilter)
