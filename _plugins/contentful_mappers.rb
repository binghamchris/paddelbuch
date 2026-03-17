# frozen_string_literal: true

require 'uri'

# Custom mappers for Contentful entries
# Transforms Contentful entries into Jekyll-friendly data structures (hashes)
# Each mapper is a module method that takes a Contentful entry and returns a hash
#
# When entries are fetched with locale: '*', fields are accessed via
# entry.fields_with_locales which returns { field_name: { locale: value } }.
# The flatten_entry method produces one hash per locale so downstream consumers
# (ApiGenerator, templates, LocaleFilter) receive rows with a plain 'locale' field.

module ContentfulMappers
  LOCALES = %w[de en].freeze

  MARK_TAG_MAP = {
    'code' => 'code',
    'bold' => 'strong',
    'italic' => 'em',
    'underline' => 'u'
  }.freeze

  SAFE_URI_SCHEMES = %w[http https mailto tel].freeze

  module_function

  # ---------------------------------------------------------------------------
  # HTML sanitization helpers
  # ---------------------------------------------------------------------------

  def html_escape(text)
    text.to_s
        .gsub('&', '&amp;')
        .gsub('<', '&lt;')
        .gsub('>', '&gt;')
        .gsub('"', '&quot;')
        .gsub("'", '&#39;')
  end

  def safe_uri?(uri)
    return false if uri.nil? || uri.strip.empty?
    scheme = URI.parse(uri).scheme&.downcase
    scheme.nil? || SAFE_URI_SCHEMES.include?(scheme)
  rescue URI::InvalidURIError
    false
  end

  # ---------------------------------------------------------------------------
  # Locale-aware field helpers
  # ---------------------------------------------------------------------------

  # Resolve a field value for a given locale from the fields_with_locales hash.
  # Falls back through the fallback chain: de -> en (Contentful default locale).
  def resolve_field(fields, field_name, locale)
    locale_sym = locale.to_sym
    field_hash = fields[field_name]
    return nil if field_hash.nil?

    if field_hash.is_a?(Hash)
      # Standard locale-wrapped field: { locale_sym: value }
      field_hash[locale_sym] || field_hash[:en]
    elsif field_hash.respond_to?(:[])
      # Non-Hash object that supports [] access (e.g., Contentful SDK locale wrapper)
      # Try locale lookup; fall back to the object itself if lookup fails
      begin
        field_hash[locale_sym] || field_hash[:en] || field_hash
      rescue TypeError, NoMethodError
        field_hash
      end
    else
      # Raw field value with no locale wrapping — return directly
      field_hash
    end
  end

  def extract_slug(fields, entry)
    slug = resolve_field(fields, :slug, 'en')
    slug || entry.sys[:id]
  end

  # Format a timestamp (Time or DateTime) to ISO 8601 UTC string without milliseconds.
  # Handles both Time (which has .utc) and DateTime (which does not).
  def format_timestamp(ts)
    return nil if ts.nil?

    if ts.respond_to?(:utc)
      ts.utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    elsif ts.respond_to?(:new_offset)
      ts.new_offset(0).strftime('%Y-%m-%dT%H:%M:%SZ')
    else
      ts.to_s
    end
  end

  def extract_location(location_field)
    return nil unless location_field
    { 'lat' => location_field.lat, 'lon' => location_field.lon }
  end

  def extract_reference_slug(ref)
    return nil unless ref
    if ref.respond_to?(:fields_with_locales)
      fwl = ref.fields_with_locales
      slug_hash = fwl[:slug]
      slug = slug_hash[:en] || slug_hash.values.first if slug_hash.is_a?(Hash)
      slug || ref.sys[:id]
    elsif ref.respond_to?(:slug)
      ref.slug rescue ref.sys[:id]
    else
      ref.sys[:id] rescue nil
    end
  end

  def extract_reference_slugs(refs)
    return [] unless refs.is_a?(Array)
    refs.map { |r| extract_reference_slug(r) }.compact
  end

  def extract_rich_text_html(field)
    return nil unless field

    if field.is_a?(Hash) && field['raw']
      # Contentful rich text with 'raw' JSON string — parse and render the document
      begin
        doc = JSON.parse(field['raw'])
        if doc.is_a?(Hash) && doc['nodeType'] == 'document' && doc['content']
          render_rich_text(doc['content'])
        elsif doc.is_a?(Hash) && doc['content']
          render_rich_text(doc['content'])
        else
          nil
        end
      rescue JSON::ParserError => e
        Jekyll.logger.warn 'ContentfulMappers:', "Failed to parse rich text JSON: #{e.message}"
        nil
      end
    elsif field.is_a?(Hash) && field['content']
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
        text = html_escape(node_value)
        node_marks = node.is_a?(Hash) ? (node['marks'] || []) : []
        node_marks.each do |mark|
          tag = MARK_TAG_MAP[mark['type']]
          text = "<#{tag}>#{text}</#{tag}>" if tag
        end
        text
      when 'hyperlink'
        uri = node_data.is_a?(Hash) ? node_data['uri'] : (node_data.respond_to?(:uri) ? node_data.uri : '')
        inner = render_rich_text(node_content)
        if safe_uri?(uri)
          "<a href=\"#{html_escape(uri)}\">#{inner}</a>"
        else
          "<span>#{inner}</span>"
        end
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
      when 'table'
        "<table>#{render_rich_text(node_content)}</table>"
      when 'table-row'
        "<tr>#{render_rich_text(node_content)}</tr>"
      when 'table-cell'
        "<td>#{render_rich_text(node_content)}</td>"
      when 'table-header-cell'
        "<th>#{render_rich_text(node_content)}</th>"
      else
        render_rich_text(node_content) if node_content
      end
    end.compact.join
  end

  # ---------------------------------------------------------------------------
  # Raw data helpers for API use
  # ---------------------------------------------------------------------------

  # Serialize a Contentful rich text field to its raw JSON string for API output.
  # Returns nil if the field is nil, the JSON string if already in 'raw' format,
  # or a JSON-serialized string of the rich text document.
  def serialize_raw_rich_text(field)
    return nil if field.nil?

    if field.is_a?(Hash) && field.key?('raw')
      # Already in Contentful raw format — return the raw JSON string
      field['raw']
    elsif field.is_a?(Hash) && (field.key?('content') || field.key?('nodeType'))
      # Rich text document hash — serialize to JSON string
      JSON.generate(field)
    elsif field.respond_to?(:content) && field.respond_to?(:node_type)
      # Contentful SDK rich text object — attempt to serialize
      JSON.generate(field)
    else
      nil
    end
  end

  # ---------------------------------------------------------------------------
  # Entry flattening — produces one hash per locale from a locale: '*' entry
  # ---------------------------------------------------------------------------

  # Flatten a single Contentful entry (fetched with locale: '*') into an array
  # of per-locale hashes using the specified mapper method.
  # Optional extra_args are passed through to the mapper method.
  def flatten_entry(entry, mapper_method, *extra_args)
    fields = entry.fields_with_locales
    sys = entry.sys

    LOCALES.map do |locale|
      base = {
        'locale' => locale,
        'createdAt' => format_timestamp(sys[:created_at]),
        'updatedAt' => format_timestamp(sys[:updated_at]),
      }
      mapped = send(mapper_method, entry, fields, locale, *extra_args)
      base.merge(mapped)
    end
  end

  # ---------------------------------------------------------------------------
  # Content type mappers
  # Each receives (entry, fields, locale) where fields = entry.fields_with_locales
  # ---------------------------------------------------------------------------

  def map_spot(entry, fields, locale, *_extra)
    desc_field = resolve_field(fields, :description, locale)
    {
      'slug' => extract_slug(fields, entry),
      'name' => resolve_field(fields, :name, locale),
      'description' => extract_rich_text_html(desc_field),
      '_raw_description' => serialize_raw_rich_text(desc_field),
      'location' => extract_location(resolve_field(fields, :location, locale)),
      'approximateAddress' => resolve_field(fields, :approximate_address, locale),
      'country' => resolve_field(fields, :country, locale),
      'confirmed' => resolve_field(fields, :confirmed, locale) || false,
      'rejected' => resolve_field(fields, :rejected, locale) || false,
      'waterway_slug' => extract_reference_slug(resolve_field(fields, :waterway, locale)),
      'spotType_slug' => extract_reference_slug(resolve_field(fields, :spot_type, locale)),
      'paddlingEnvironmentType_slug' => extract_reference_slug(resolve_field(fields, :paddling_environment_type, locale)),
      'paddleCraftTypes' => extract_reference_slugs(resolve_field(fields, :paddle_craft_type, locale)),
      'eventNotices' => extract_reference_slugs(resolve_field(fields, :event_notices, locale)),
      'obstacles' => extract_reference_slugs(resolve_field(fields, :obstacles, locale)),
      'dataSourceType_slug' => extract_reference_slug(resolve_field(fields, :data_source_type, locale)),
      'dataLicenseType_slug' => extract_reference_slug(resolve_field(fields, :data_license_type, locale)),
      'spotTipType_slugs' => extract_reference_slugs(resolve_field(fields, :spot_tips, locale))
    }
  end

  def map_waterway(entry, fields, locale, *_extra)
    geometry_field = resolve_field(fields, :geometry, locale)
    {
      'slug' => extract_slug(fields, entry),
      'name' => resolve_field(fields, :name, locale),
      'length' => resolve_field(fields, :length, locale),
      'area' => resolve_field(fields, :area, locale),
      'geometry' => geometry_field&.to_json,
      '_raw_geometry' => geometry_field,
      'showInMenu' => resolve_field(fields, :show_in_menu, locale) || false,
      'paddlingEnvironmentType_slug' => extract_reference_slug(resolve_field(fields, :paddling_environment_type, locale)),
      'dataSourceType_slug' => extract_reference_slug(resolve_field(fields, :data_source_type, locale)),
      'dataLicenseType_slug' => extract_reference_slug(resolve_field(fields, :data_license_type, locale))
    }
  end

  def map_obstacle(entry, fields, locale, *_extra)
    desc_field = resolve_field(fields, :description, locale)
    portage_desc_field = resolve_field(fields, :portage_description, locale)
    geometry_field = resolve_field(fields, :geometry, locale)
    portage_route_field = resolve_field(fields, :portage_route, locale)
    {
      'slug' => extract_slug(fields, entry),
      'name' => resolve_field(fields, :name, locale),
      'description' => extract_rich_text_html(desc_field),
      '_raw_description' => serialize_raw_rich_text(desc_field),
      'geometry' => geometry_field&.to_json,
      '_raw_geometry' => geometry_field,
      'portageRoute' => portage_route_field&.to_json,
      '_raw_portageRoute' => portage_route_field,
      'portageDistance' => resolve_field(fields, :portage_distance, locale),
      'portageDescription' => extract_rich_text_html(portage_desc_field),
      '_raw_portageDescription' => serialize_raw_rich_text(portage_desc_field),
      'isPortageNecessary' => resolve_field(fields, :is_portage_necessary, locale) || false,
      'isPortagePossible' => resolve_field(fields, :is_portage_possible, locale) || false,
      'obstacleType_slug' => extract_reference_slug(resolve_field(fields, :obstacle_type, locale)),
      'waterway_slug' => extract_reference_slug(resolve_field(fields, :waterway, locale)),
      'spots' => extract_reference_slugs(resolve_field(fields, :spots, locale)),
      'dataSourceType_slug' => extract_reference_slug(resolve_field(fields, :data_source_type, locale)),
      'dataLicenseType_slug' => extract_reference_slug(resolve_field(fields, :data_license_type, locale))
    }
  end

  def map_protected_area(entry, fields, locale, *_extra)
    desc_field = resolve_field(fields, :description, locale)
    geometry_field = resolve_field(fields, :geometry, locale)
    {
      'slug' => extract_slug(fields, entry),
      'name' => resolve_field(fields, :name, locale),
      'description' => extract_rich_text_html(desc_field),
      '_raw_description' => serialize_raw_rich_text(desc_field),
      'geometry' => geometry_field&.to_json,
      '_raw_geometry' => geometry_field,
      'isAreaMarked' => resolve_field(fields, :is_area_marked, locale) || false,
      'protectedAreaType_slug' => extract_reference_slug(resolve_field(fields, :protected_area_type, locale)),
      'waterway' => extract_reference_slugs(resolve_field(fields, :waterway, locale)),
      'dataSourceType_slug' => extract_reference_slug(resolve_field(fields, :data_source_type, locale)),
      'dataLicenseType_slug' => extract_reference_slug(resolve_field(fields, :data_license_type, locale))
    }
  end

  def map_event_notice(entry, fields, locale, *_extra)
    desc_field = resolve_field(fields, :description, locale)
    affected_area_field = resolve_field(fields, :affected_area, locale)
    {
      'slug' => extract_slug(fields, entry),
      'name' => resolve_field(fields, :name, locale),
      'description' => extract_rich_text_html(desc_field),
      '_raw_description' => serialize_raw_rich_text(desc_field),
      'location' => extract_location(resolve_field(fields, :location, locale)),
      'affectedArea' => affected_area_field&.to_json,
      '_raw_affectedArea' => affected_area_field,
      'startDate' => resolve_field(fields, :start_date, locale)&.iso8601,
      'endDate' => resolve_field(fields, :end_date, locale)&.iso8601,
      'waterways' => extract_reference_slugs(resolve_field(fields, :waterway, locale)),
      'spot' => extract_reference_slugs(resolve_field(fields, :spot, locale)),
      'dataSourceType_slug' => extract_reference_slug(resolve_field(fields, :data_source_type, locale)),
      'dataLicenseType_slug' => extract_reference_slug(resolve_field(fields, :data_license_type, locale))
    }
  end

  def map_type(entry, fields, locale, content_type = nil)
    result = {
      'slug' => extract_slug(fields, entry),
      'name_de' => resolve_field(fields, :name, 'de'),
      'name_en' => resolve_field(fields, :name, 'en')
    }

    # Add type-specific fields for API use
    case content_type
    when 'paddleCraftType', 'dataSourceType'
      desc_field = resolve_field(fields, :description, locale)
      result['_raw_description'] = serialize_raw_rich_text(desc_field)
    when 'dataLicenseType'
      result['summaryUrl'] = resolve_field(fields, :summary_url, locale)
      result['fullTextUrl'] = resolve_field(fields, :full_text_url, locale)
    when 'spotTipType'
      desc_field = resolve_field(fields, :description, locale)
      result['description_de'] = extract_rich_text_html(resolve_field(fields, :description, 'de'))
      result['description_en'] = extract_rich_text_html(resolve_field(fields, :description, 'en'))
      result['_raw_description'] = serialize_raw_rich_text(desc_field)
    end

    result
  end

  def map_static_page(entry, fields, locale, *_extra)
    menu = resolve_field(fields, :menu, locale)
    {
      'slug' => extract_slug(fields, entry),
      'title' => resolve_field(fields, :title, locale),
      'menu' => menu,
      'menu_slug' => menu_to_slug(menu),
      'page_body' => extract_rich_text_html(resolve_field(fields, :page_contents, locale)),
      'menuOrder' => resolve_field(fields, :menu_order, locale) || 0
    }
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
