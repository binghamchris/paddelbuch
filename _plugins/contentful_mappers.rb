# Custom mappers for jekyll-contentful-data-import plugin
# These mappers transform Contentful entries into Jekyll-friendly data structures

module Jekyll
  module Contentful
    module Mappers
      # Base mapper with common functionality
      class BaseMapper < Base
        def map
          result = super
          
          # Add locale information
          result['locale'] = entry.locale || 'de'
          
          # Add timestamps
          result['createdAt'] = entry.sys[:created_at]&.iso8601
          result['updatedAt'] = entry.sys[:updated_at]&.iso8601
          
          result
        end
        
        protected
        
        def extract_slug(entry)
          entry.fields[:slug] || entry.sys[:id]
        end
        
        def extract_location(location_field)
          return nil unless location_field
          {
            'lat' => location_field.lat,
            'lon' => location_field.lon
          }
        end
        
        def extract_reference_slug(reference)
          return nil unless reference
          reference.fields[:slug] || reference.sys[:id]
        end
        
        def extract_reference_slugs(references)
          return [] unless references
          references.map { |ref| extract_reference_slug(ref) }.compact
        end
        
        def extract_rich_text(field)
          return nil unless field
          # Convert Contentful rich text to HTML
          # This is a simplified version - may need enhancement for complex content
          if field.is_a?(Hash) && field['content']
            render_rich_text(field['content'])
          else
            field.to_s
          end
        end
        
        def render_rich_text(content)
          return '' unless content
          content.map do |node|
            case node['nodeType']
            when 'paragraph'
              "<p>#{render_rich_text(node['content'])}</p>"
            when 'text'
              node['value']
            when 'hyperlink'
              "<a href=\"#{node['data']['uri']}\">#{render_rich_text(node['content'])}</a>"
            when 'unordered-list'
              "<ul>#{render_rich_text(node['content'])}</ul>"
            when 'ordered-list'
              "<ol>#{render_rich_text(node['content'])}</ol>"
            when 'list-item'
              "<li>#{render_rich_text(node['content'])}</li>"
            when 'heading-1'
              "<h1>#{render_rich_text(node['content'])}</h1>"
            when 'heading-2'
              "<h2>#{render_rich_text(node['content'])}</h2>"
            when 'heading-3'
              "<h3>#{render_rich_text(node['content'])}</h3>"
            else
              render_rich_text(node['content']) if node['content']
            end
          end.join
        end
      end
      
      # Mapper for Spot content type
      class SpotMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name'] = fields[:name]
          result['description'] = extract_rich_text(fields[:description])
          result['location'] = extract_location(fields[:location])
          result['approximateAddress'] = fields[:approximate_address] || fields[:approximateAddress]
          result['country'] = fields[:country]
          result['confirmed'] = fields[:confirmed] || false
          result['rejected'] = fields[:rejected] || false
          
          # References
          result['waterway_slug'] = extract_reference_slug(fields[:waterway])
          result['spotType_slug'] = extract_reference_slug(fields[:spot_type] || fields[:spotType])
          result['paddlingEnvironmentType_slug'] = extract_reference_slug(fields[:paddling_environment_type] || fields[:paddlingEnvironmentType])
          result['paddleCraftTypes'] = extract_reference_slugs(fields[:paddle_craft_types] || fields[:paddleCraftTypes])
          result['eventNotices'] = extract_reference_slugs(fields[:event_notices] || fields[:eventNotices])
          result['obstacles'] = extract_reference_slugs(fields[:obstacles])
          result['dataSourceType_slug'] = extract_reference_slug(fields[:data_source_type] || fields[:dataSourceType])
          result['dataLicenseType_slug'] = extract_reference_slug(fields[:data_license_type] || fields[:dataLicenseType])
          
          result
        end
      end
      
      # Mapper for Waterway content type
      class WaterwayMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name'] = fields[:name]
          result['length'] = fields[:length]
          result['area'] = fields[:area]
          result['geometry'] = fields[:geometry]&.to_json
          result['showInMenu'] = fields[:show_in_menu] || fields[:showInMenu] || false
          
          # References
          result['paddlingEnvironmentType_slug'] = extract_reference_slug(fields[:paddling_environment_type] || fields[:paddlingEnvironmentType])
          result['dataSourceType_slug'] = extract_reference_slug(fields[:data_source_type] || fields[:dataSourceType])
          result['dataLicenseType_slug'] = extract_reference_slug(fields[:data_license_type] || fields[:dataLicenseType])
          
          result
        end
      end
      
      # Mapper for Obstacle content type
      class ObstacleMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name'] = fields[:name]
          result['description'] = extract_rich_text(fields[:description])
          result['geometry'] = fields[:geometry]&.to_json
          result['portageRoute'] = fields[:portage_route]&.to_json || fields[:portageRoute]&.to_json
          result['portageDistance'] = fields[:portage_distance] || fields[:portageDistance]
          result['portageDescription'] = extract_rich_text(fields[:portage_description] || fields[:portageDescription])
          result['isPortageNecessary'] = fields[:is_portage_necessary] || fields[:isPortageNecessary] || false
          result['isPortagePossible'] = fields[:is_portage_possible] || fields[:isPortagePossible] || false
          
          # References
          result['obstacleType_slug'] = extract_reference_slug(fields[:obstacle_type] || fields[:obstacleType])
          result['waterway_slug'] = extract_reference_slug(fields[:waterway])
          result['spots'] = extract_reference_slugs(fields[:spots])
          
          result
        end
      end
      
      # Mapper for ProtectedArea content type
      class ProtectedAreaMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name'] = fields[:name]
          result['geometry'] = fields[:geometry]&.to_json
          result['isAreaMarked'] = fields[:is_area_marked] || fields[:isAreaMarked] || false
          
          # References
          result['protectedAreaType_slug'] = extract_reference_slug(fields[:protected_area_type] || fields[:protectedAreaType])
          
          result
        end
      end
      
      # Mapper for WaterwayEventNotice content type
      class WaterwayEventNoticeMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name'] = fields[:name]
          result['description'] = extract_rich_text(fields[:description])
          result['location'] = extract_location(fields[:location])
          result['affectedArea'] = fields[:affected_area]&.to_json || fields[:affectedArea]&.to_json
          result['startDate'] = fields[:start_date]&.iso8601 || fields[:startDate]&.iso8601
          result['endDate'] = fields[:end_date]&.iso8601 || fields[:endDate]&.iso8601
          
          # References
          result['waterways'] = extract_reference_slugs(fields[:waterways])
          
          result
        end
      end
      
      # Mapper for dimension/type content types
      class TypeMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['name_de'] = fields[:name_de] || fields[:name]
          result['name_en'] = fields[:name_en] || fields[:name]
          
          result
        end
      end
      
      # Mapper for StaticPage content type
      class StaticPageMapper < BaseMapper
        def map
          result = super
          fields = entry.fields
          
          result['slug'] = extract_slug(entry)
          result['title'] = fields[:title]
          result['menu'] = fields[:menu]
          result['content'] = extract_rich_text(fields[:content])
          result['order'] = fields[:order] || 0
          
          result
        end
      end
    end
  end
end
