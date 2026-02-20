# Custom mappers for Contentful entries
# Transforms Contentful entries into Jekyll-friendly data structures (hashes)
# Each mapper is a module method that takes a Contentful entry and returns a hash

module ContentfulMappers
  module_function

  # Safely access a field on a Contentful entry, returning nil on errors
  def safe_field(entry, field_name)
    entry.respond_to?(field_name) ? entry.send(field_name) : nil
  rescue StandardError
    nil
  end

  def extract_slug(entry)
    safe_field(entry, :slug) || entry.sys[:id]
  end

  def extract_location(location_field)
    return nil unless location_field
    { 'lat' => location_field.lat, 'lon' => location_field.lon }
  end

  def extract_reference_slug(ref)
    return nil unless ref
    safe_field(ref, :slug) || ref.sys[:id]
  end

  def extract_reference_slugs(refs)
    return [] unless refs.is_a?(Array)
    refs.map { |r| extract_reference_slug(r) }.compact
  end

  def extract_rich_text_html(field)
    return nil unless field
    if field.is_a?(Hash) && field['content']
      render_rich_text(field['content'])
    elsif field.respond_to?(:content)
      render_rich_text(field.content)
    else
      field.to_s
    end
  end

  def render_rich_text(content)
    return '' unless content
    content.map do |node|
      node_type = node.is_a?(Hash) ? node['nodeType'] : (node.respond_to?(:node_type) ? node.node_type : nil)
      node_content = node.is_a?(Hash) ? node['content'] : (node.respond_to?(:content) ? node.content : nil)
      node_value = node.is_a?(Hash) ? node['value'] : (node.respond_to?(:value) ? node.value : nil)
      node_data = node.is_a?(Hash) ? (node['data'] || {}) : (node.respond_to?(:data) ? node.data : {})

      case node_type
      when 'paragraph'
        "<p>#{render_rich_text(node_content)}</p>"
      when 'text'
        node_value.to_s
      when 'hyperlink'
        uri = node_data.is_a?(Hash) ? node_data['uri'] : (node_data.respond_to?(:uri) ? node_data.uri : '')
        "<a href=\"#{uri}\">#{render_rich_text(node_content)}</a>"
      when 'unordered-list'
        "<ul>#{render_rich_text(node_content)}</ul>"
      when 'ordered-list'
        "<ol>#{render_rich_text(node_content)}</ol>"
      when 'list-item'
        "<li>#{render_rich_text(node_content)}</li>"
      when 'heading-1'
        "<h1>#{render_rich_text(node_content)}</h1>"
      when 'heading-2'
        "<h2>#{render_rich_text(node_content)}</h2>"
      when 'heading-3'
        "<h3>#{render_rich_text(node_content)}</h3>"
      else
        render_rich_text(node_content) if node_content
      end
    end.compact.join
  end

  def base_fields(entry)
    {
      'locale' => entry.sys[:locale] || safe_field(entry, :locale),
      'createdAt' => entry.sys[:created_at]&.iso8601,
      'updatedAt' => entry.sys[:updated_at]&.iso8601
    }
  end

  # --- Content type mappers ---

  def map_spot(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name' => safe_field(entry, :name),
      'description' => extract_rich_text_html(safe_field(entry, :description)),
      'location' => extract_location(safe_field(entry, :location)),
      'approximateAddress' => safe_field(entry, :approximate_address),
      'country' => safe_field(entry, :country),
      'confirmed' => safe_field(entry, :confirmed) || false,
      'rejected' => safe_field(entry, :rejected) || false,
      'waterway_slug' => extract_reference_slug(safe_field(entry, :waterway)),
      'spotType_slug' => extract_reference_slug(safe_field(entry, :spot_type)),
      'paddlingEnvironmentType_slug' => extract_reference_slug(safe_field(entry, :paddling_environment_type)),
      'paddleCraftTypes' => extract_reference_slugs(safe_field(entry, :paddle_craft_types)),
      'eventNotices' => extract_reference_slugs(safe_field(entry, :event_notices)),
      'obstacles' => extract_reference_slugs(safe_field(entry, :obstacles)),
      'dataSourceType_slug' => extract_reference_slug(safe_field(entry, :data_source_type)),
      'dataLicenseType_slug' => extract_reference_slug(safe_field(entry, :data_license_type))
    )
  end

  def map_waterway(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name' => safe_field(entry, :name),
      'length' => safe_field(entry, :length),
      'area' => safe_field(entry, :area),
      'geometry' => safe_field(entry, :geometry)&.to_json,
      'showInMenu' => safe_field(entry, :show_in_menu) || false,
      'paddlingEnvironmentType_slug' => extract_reference_slug(safe_field(entry, :paddling_environment_type)),
      'dataSourceType_slug' => extract_reference_slug(safe_field(entry, :data_source_type)),
      'dataLicenseType_slug' => extract_reference_slug(safe_field(entry, :data_license_type))
    )
  end

  def map_obstacle(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name' => safe_field(entry, :name),
      'description' => extract_rich_text_html(safe_field(entry, :description)),
      'geometry' => safe_field(entry, :geometry)&.to_json,
      'portageRoute' => safe_field(entry, :portage_route)&.to_json,
      'portageDistance' => safe_field(entry, :portage_distance),
      'portageDescription' => extract_rich_text_html(safe_field(entry, :portage_description)),
      'isPortageNecessary' => safe_field(entry, :is_portage_necessary) || false,
      'isPortagePossible' => safe_field(entry, :is_portage_possible) || false,
      'obstacleType_slug' => extract_reference_slug(safe_field(entry, :obstacle_type)),
      'waterway_slug' => extract_reference_slug(safe_field(entry, :waterway)),
      'spots' => extract_reference_slugs(safe_field(entry, :spots))
    )
  end

  def map_protected_area(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name' => safe_field(entry, :name),
      'geometry' => safe_field(entry, :geometry)&.to_json,
      'isAreaMarked' => safe_field(entry, :is_area_marked) || false,
      'protectedAreaType_slug' => extract_reference_slug(safe_field(entry, :protected_area_type))
    )
  end

  def map_event_notice(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name' => safe_field(entry, :name),
      'description' => extract_rich_text_html(safe_field(entry, :description)),
      'location' => extract_location(safe_field(entry, :location)),
      'affectedArea' => safe_field(entry, :affected_area)&.to_json,
      'startDate' => safe_field(entry, :start_date)&.iso8601,
      'endDate' => safe_field(entry, :end_date)&.iso8601,
      'waterways' => extract_reference_slugs(safe_field(entry, :waterways))
    )
  end

  def map_type(entry)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'name_de' => safe_field(entry, :name_de) || safe_field(entry, :name),
      'name_en' => safe_field(entry, :name_en) || safe_field(entry, :name)
    )
  end

  def map_static_page(entry)
    menu = safe_field(entry, :menu)
    base_fields(entry).merge(
      'slug' => extract_slug(entry),
      'title' => safe_field(entry, :title),
      'menu' => menu,
      'menu_slug' => menu_to_slug(menu),
      'content' => extract_rich_text_html(safe_field(entry, :content)),
      'menuOrder' => safe_field(entry, :menu_order) || 0
    )
  end

  def menu_to_slug(menu)
    return 'seiten' unless menu
    case menu.downcase
    when 'offene daten', 'open data'
      'offene-daten'
    when 'über', 'about'
      'ueber'
    else
      menu.downcase.gsub(/\s+/, '-').gsub(/[^a-z0-9\-]/, '')
    end
  end
end
