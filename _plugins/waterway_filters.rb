# frozen_string_literal: true

# Custom Liquid filters for waterway menu sorting and limiting
# Implements Property 5: Waterway Menu Sorting and Limiting
# Implements Property 6: Waterway List Alphabetical Sorting
# Validates: Requirements 4.1, 4.2, 4.3, 4.4

module Jekyll
  module WaterwayFilters
    # Get top N lakes sorted by area (descending)
    # Lakes are waterways with paddlingEnvironmentType_slug == "see"
    def top_lakes_by_area(waterways, locale, limit = 10)
      return [] if waterways.nil? || waterways.empty?
      
      waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'see' && w['showInMenu'] == true }
        .sort_by { |w| -(w['area'] || 0) }
        .first(limit)
        .sort_by { |w| w['name'].to_s.downcase }
    end
    
    # Get top N rivers sorted by length (descending)
    # Rivers are waterways with paddlingEnvironmentType_slug == "fluss"
    def top_rivers_by_length(waterways, locale, limit = 10)
      return [] if waterways.nil? || waterways.empty?
      
      waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' && w['showInMenu'] == true }
        .sort_by { |w| -(w['length'] || 0) }
        .first(limit)
        .sort_by { |w| w['name'].to_s.downcase }
    end
    
    # Sort waterways alphabetically by name (ascending)
    # Implements Property 6: Waterway List Alphabetical Sorting
    # Validates: Requirements 4.3, 4.4
    def sort_waterways_alphabetically(waterways)
      return [] if waterways.nil? || waterways.empty?
      
      waterways.sort_by { |w| w['name'].to_s.downcase }
    end
    
    # Get all lakes for a locale, sorted alphabetically by name
    # Lakes are waterways with paddlingEnvironmentType_slug == "see"
    # Implements Property 6: Waterway List Alphabetical Sorting
    # Validates: Requirements 4.3
    def lakes_alphabetically(waterways, locale)
      return [] if waterways.nil? || waterways.empty?
      
      waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'see' }
        .sort_by { |w| w['name'].to_s.downcase }
    end
    
    # Get all rivers for a locale, sorted alphabetically by name
    # Rivers are waterways with paddlingEnvironmentType_slug == "fluss"
    # Implements Property 6: Waterway List Alphabetical Sorting
    # Validates: Requirements 4.4
    def rivers_alphabetically(waterways, locale)
      return [] if waterways.nil? || waterways.empty?
      
      waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' }
        .sort_by { |w| w['name'].to_s.downcase }
    end
  end
end

Liquid::Template.register_filter(Jekyll::WaterwayFilters)
