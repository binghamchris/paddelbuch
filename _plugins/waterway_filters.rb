# Custom Liquid filters for waterway menu sorting and limiting
# Implements Property 5: Waterway Menu Sorting and Limiting
# Validates: Requirements 4.1, 4.2

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
    end
    
    # Get top N rivers sorted by length (descending)
    # Rivers are waterways with paddlingEnvironmentType_slug == "fluss"
    def top_rivers_by_length(waterways, locale, limit = 10)
      return [] if waterways.nil? || waterways.empty?
      
      waterways
        .select { |w| w['locale'] == locale && w['paddlingEnvironmentType_slug'] == 'fluss' && w['showInMenu'] == true }
        .sort_by { |w| -(w['length'] || 0) }
        .first(limit)
    end
    
    # Sort waterways alphabetically by name
    def sort_waterways_alphabetically(waterways)
      return [] if waterways.nil? || waterways.empty?
      
      waterways.sort_by { |w| w['name'].to_s.downcase }
    end
  end
end

Liquid::Template.register_filter(Jekyll::WaterwayFilters)
