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
    # Usage with format: {{ page.date | localized_date: 'long' }}
    # 
    # Property 19: Date Locale Formatting
    # For any date displayed in the application, the format shall match the current locale:
    # 'en-GB' format for English locale (DD/MM/YYYY), 'de-CH' format for German locale (DD.MM.YYYY)
    #
    # Requirements: 8.5
    # - Format dates as 'en-GB' for English locale
    # - Format dates as 'de-CH' for German locale
    def localized_date(date, format_type = nil)
      return '' unless date
      
      site = @context.registers[:site]
      lang = site.config['lang'] || site.config['default_lang'] || 'de'
      
      # Parse date if string
      date = parse_date_value(date)
      return '' unless date
      
      # Get format based on locale and format type
      format = get_date_format(lang, format_type)
      
      date.strftime(format)
    rescue ArgumentError, TypeError
      date.to_s
    end

    # Format date with time according to locale
    # Usage: {{ page.date | localized_datetime }}
    #
    # Property 19: Date Locale Formatting
    # Requirements: 8.5
    def localized_datetime(date, format_type = nil)
      return '' unless date
      
      site = @context.registers[:site]
      lang = site.config['lang'] || site.config['default_lang'] || 'de'
      
      # Parse date if string
      date = parse_datetime_value(date)
      return '' unless date
      
      # Get format based on locale and format type
      format = get_datetime_format(lang, format_type)
      
      date.strftime(format)
    rescue ArgumentError, TypeError
      date.to_s
    end

    private

    # Parse a date value into a Date object
    def parse_date_value(date)
      return date if date.is_a?(Date)
      return date.to_date if date.is_a?(Time) || date.is_a?(DateTime)
      return Date.parse(date.to_s) if date.is_a?(String)
      nil
    rescue ArgumentError
      nil
    end

    # Parse a date value into a Time object (preserves time component)
    def parse_datetime_value(date)
      return date if date.is_a?(Time)
      return date.to_time if date.is_a?(DateTime)
      return Time.parse(date.to_s) if date.is_a?(String)
      return date.to_time if date.is_a?(Date)
      nil
    rescue ArgumentError
      nil
    end

    # Get date format string based on locale and format type
    # Property 19: Date Locale Formatting
    def get_date_format(lang, format_type)
      formats = {
        'de' => {
          nil => '%d.%m.%Y',           # Default: DD.MM.YYYY (de-CH format)
          'short' => '%d.%m.%Y',       # DD.MM.YYYY
          'long' => '%d. %B %Y',       # DD. Month YYYY
          'iso' => '%Y-%m-%d'          # YYYY-MM-DD
        },
        'en' => {
          nil => '%d/%m/%Y',           # Default: DD/MM/YYYY (en-GB format)
          'short' => '%d/%m/%Y',       # DD/MM/YYYY
          'long' => '%d %B %Y',        # DD Month YYYY
          'iso' => '%Y-%m-%d'          # YYYY-MM-DD
        }
      }
      
      locale_formats = formats[lang] || formats['de']
      locale_formats[format_type] || locale_formats[nil]
    end

    # Get datetime format string based on locale and format type
    # Property 19: Date Locale Formatting
    def get_datetime_format(lang, format_type)
      formats = {
        'de' => {
          nil => '%d.%m.%Y %H:%M',           # Default: DD.MM.YYYY HH:MM
          'short' => '%d.%m.%Y %H:%M',       # DD.MM.YYYY HH:MM
          'long' => '%d. %B %Y, %H:%M Uhr',  # DD. Month YYYY, HH:MM Uhr
          'iso' => '%Y-%m-%dT%H:%M:%S',      # ISO 8601
          'notice_updated' => '%-d. %B %Y um %H:%M'  # D. Month YYYY um HH:MM
        },
        'en' => {
          nil => '%d/%m/%Y %H:%M',           # Default: DD/MM/YYYY HH:MM
          'short' => '%d/%m/%Y %H:%M',       # DD/MM/YYYY HH:MM
          'long' => '%d %B %Y, %H:%M',       # DD Month YYYY, HH:MM
          'iso' => '%Y-%m-%dT%H:%M:%S',      # ISO 8601
          'notice_updated' => '%-d %B %Y at %H:%M'   # D Month YYYY at HH:MM
        }
      }
      
      locale_formats = formats[lang] || formats['de']
      locale_formats[format_type] || locale_formats[nil]
    end

    public
    
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
