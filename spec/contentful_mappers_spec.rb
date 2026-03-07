# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ContentfulMappers do
  # --- Test helpers ---
  # Mappers now receive (entry, fields, locale) where fields = entry.fields_with_locales
  # fields is a hash of { field_name_sym: { locale_sym: value } }

  def build_sys(overrides = {})
    {
      id: 'test-id-123',
      created_at: Time.parse('2025-01-10T08:30:00Z'),
      updated_at: Time.parse('2025-01-15T10:00:00Z')
    }.merge(overrides)
  end

  # Build a minimal entry double with sys and fields_with_locales
  def build_entry(fields_with_locales = {}, sys_overrides = {})
    entry = double('Entry')
    allow(entry).to receive(:sys).and_return(build_sys(sys_overrides))
    allow(entry).to receive(:fields_with_locales).and_return(fields_with_locales)
    entry
  end

  # Build a fields_with_locales hash from simple key-value pairs.
  # Values can be plain (stored under :en) or locale hashes like { de: 'x', en: 'y' }
  def build_fields(hash)
    result = {}
    hash.each do |key, value|
      if value.is_a?(Hash) && value.keys.all? { |k| k.is_a?(Symbol) && k.to_s.length == 2 }
        result[key] = value
      else
        # Store under :en (the space default locale)
        result[key] = { en: value }
      end
    end
    result
  end

  def build_reference(slug)
    ref = double("Ref:#{slug}")
    allow(ref).to receive(:respond_to?).with(anything).and_return(false)
    allow(ref).to receive(:respond_to?).with(:fields_with_locales).and_return(true)
    allow(ref).to receive(:fields_with_locales).and_return({ slug: { en: slug } })
    allow(ref).to receive(:sys).and_return({ id: slug })
    ref
  end

  def build_location(lat, lon)
    loc = double('Location')
    allow(loc).to receive(:lat).and_return(lat)
    allow(loc).to receive(:lon).and_return(lon)
    loc
  end

  def build_geometry(json = '{"type":"Point","coordinates":[7.68,46.69]}')
    geo = double('Geometry')
    allow(geo).to receive(:to_json).and_return(json)
    geo
  end

  # --- extract_location ---

  describe '.extract_location' do
    it 'returns lat/lon hash for a valid location' do
      loc = build_location(46.6863, 7.6803)
      result = ContentfulMappers.extract_location(loc)
      expect(result).to eq({ 'lat' => 46.6863, 'lon' => 7.6803 })
    end

    it 'returns nil when location is nil' do
      expect(ContentfulMappers.extract_location(nil)).to be_nil
    end
  end

  # --- extract_reference_slug / extract_reference_slugs ---

  describe '.extract_reference_slug' do
    it 'returns the slug of a reference with fields_with_locales' do
      ref = build_reference('waterway-slug')
      expect(ContentfulMappers.extract_reference_slug(ref)).to eq('waterway-slug')
    end

    it 'falls back to sys[:id] when reference has no slug in fields_with_locales' do
      ref = double('Ref')
      allow(ref).to receive(:respond_to?).with(anything).and_return(false)
      allow(ref).to receive(:respond_to?).with(:fields_with_locales).and_return(true)
      allow(ref).to receive(:fields_with_locales).and_return({})
      allow(ref).to receive(:sys).and_return({ id: 'ref-sys-id' })
      expect(ContentfulMappers.extract_reference_slug(ref)).to eq('ref-sys-id')
    end

    it 'returns nil when reference is nil' do
      expect(ContentfulMappers.extract_reference_slug(nil)).to be_nil
    end
  end

  describe '.extract_reference_slugs' do
    it 'returns slugs from an array of references' do
      refs = [build_reference('a'), build_reference('b')]
      expect(ContentfulMappers.extract_reference_slugs(refs)).to eq(%w[a b])
    end

    it 'returns empty array when refs is nil' do
      expect(ContentfulMappers.extract_reference_slugs(nil)).to eq([])
    end

    it 'returns empty array when refs is not an array' do
      expect(ContentfulMappers.extract_reference_slugs('not-array')).to eq([])
    end

    it 'compacts nil references' do
      refs = [build_reference('a'), nil, build_reference('c')]
      result = ContentfulMappers.extract_reference_slugs(refs)
      expect(result).to include('a', 'c')
    end
  end

  # --- extract_rich_text_html ---

  describe '.extract_rich_text_html' do
    it 'returns nil for nil input' do
      expect(ContentfulMappers.extract_rich_text_html(nil)).to be_nil
    end

    it 'converts a paragraph with text' do
      field = {
        'content' => [
          { 'nodeType' => 'paragraph', 'content' => [
            { 'nodeType' => 'text', 'value' => 'Hello world' }
          ] }
        ]
      }
      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<p>Hello world</p>')
    end

    it 'converts a hyperlink' do
      field = {
        'content' => [
          { 'nodeType' => 'paragraph', 'content' => [
            { 'nodeType' => 'hyperlink', 'data' => { 'uri' => 'https://example.com' }, 'content' => [
              { 'nodeType' => 'text', 'value' => 'click here' }
            ] }
          ] }
        ]
      }
      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<p><a href="https://example.com">click here</a></p>')
    end

    it 'converts lists and headings' do
      field = {
        'content' => [
          { 'nodeType' => 'heading-1', 'content' => [{ 'nodeType' => 'text', 'value' => 'H1' }] },
          { 'nodeType' => 'heading-2', 'content' => [{ 'nodeType' => 'text', 'value' => 'H2' }] },
          { 'nodeType' => 'heading-3', 'content' => [{ 'nodeType' => 'text', 'value' => 'H3' }] }
        ]
      }
      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<h1>H1</h1><h2>H2</h2><h3>H3</h3>')
    end

    it 'converts a plain string via to_s' do
      expect(ContentfulMappers.extract_rich_text_html('plain text')).to eq('plain text')
    end

    context 'with Contentful raw JSON format' do
      it 'parses a raw JSON document with paragraphs' do
        field = {
          'raw' => '{"nodeType":"document","data":{},"content":[{"nodeType":"paragraph","data":{},"content":[{"nodeType":"text","value":"Page content here.","marks":[],"data":{}}]}]}'
        }
        expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<p>Page content here.</p>')
      end

      it 'parses a raw JSON document with multiple paragraphs' do
        doc = {
          'nodeType' => 'document',
          'content' => [
            { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'First paragraph.' }] },
            { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Second paragraph.' }] }
          ]
        }
        field = { 'raw' => JSON.generate(doc) }
        expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<p>First paragraph.</p><p>Second paragraph.</p>')
      end

      it 'parses a raw JSON document with headings and links' do
        doc = {
          'nodeType' => 'document',
          'content' => [
            { 'nodeType' => 'heading-2', 'content' => [{ 'nodeType' => 'text', 'value' => 'Section Title' }] },
            { 'nodeType' => 'paragraph', 'content' => [
              { 'nodeType' => 'text', 'value' => 'Visit ' },
              { 'nodeType' => 'hyperlink', 'data' => { 'uri' => 'https://example.com' }, 'content' => [
                { 'nodeType' => 'text', 'value' => 'our site' }
              ] }
            ] }
          ]
        }
        field = { 'raw' => JSON.generate(doc) }
        expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<h2>Section Title</h2><p>Visit <a href="https://example.com">our site</a></p>')
      end

      it 'returns nil for invalid raw JSON' do
        field = { 'raw' => 'not valid json{{{' }
        expect(ContentfulMappers.extract_rich_text_html(field)).to be_nil
      end

      it 'returns nil when raw JSON has no content array' do
        field = { 'raw' => '{"nodeType":"document"}' }
        expect(ContentfulMappers.extract_rich_text_html(field)).to be_nil
      end
    end

    context 'with raw JSON containing a table' do
      it 'parses and renders table HTML from raw JSON document' do
        doc = {
          'nodeType' => 'document',
          'data' => {},
          'content' => [
            { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
              { 'nodeType' => 'text', 'value' => 'Before table.', 'marks' => [], 'data' => {} }
            ] },
            { 'nodeType' => 'table', 'data' => {}, 'content' => [
              { 'nodeType' => 'table-row', 'data' => {}, 'content' => [
                { 'nodeType' => 'table-header-cell', 'data' => {}, 'content' => [
                  { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                    { 'nodeType' => 'text', 'value' => 'Field', 'marks' => [], 'data' => {} }
                  ] }
                ] },
                { 'nodeType' => 'table-header-cell', 'data' => {}, 'content' => [
                  { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                    { 'nodeType' => 'text', 'value' => 'Description', 'marks' => [], 'data' => {} }
                  ] }
                ] }
              ] },
              { 'nodeType' => 'table-row', 'data' => {}, 'content' => [
                { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                  { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                    { 'nodeType' => 'text', 'value' => 'name', 'marks' => [], 'data' => {} }
                  ] }
                ] },
                { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                  { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                    { 'nodeType' => 'text', 'value' => 'The spot name', 'marks' => [], 'data' => {} }
                  ] }
                ] }
              ] }
            ] },
            { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
              { 'nodeType' => 'text', 'value' => 'After table.', 'marks' => [], 'data' => {} }
            ] }
          ]
        }
        field = { 'raw' => JSON.generate(doc) }
        result = ContentfulMappers.extract_rich_text_html(field)

        expect(result).to include('<p>Before table.</p>')
        expect(result).to include('<p>After table.</p>')
        expect(result).to include('<table>')
        expect(result).to include('</table>')
        expect(result).to include('<tr>')
        expect(result).to include('<th><p>Field</p></th>')
        expect(result).to include('<th><p>Description</p></th>')
        expect(result).to include('<td><p>name</p></td>')
        expect(result).to include('<td><p>The spot name</p></td>')
      end
    end
  end

  # --- resolve_field ---

  describe '.resolve_field' do
    it 'returns the value for the requested locale' do
      fields = { name: { de: 'Thunersee', en: 'Lake Thun' } }
      expect(ContentfulMappers.resolve_field(fields, :name, 'de')).to eq('Thunersee')
      expect(ContentfulMappers.resolve_field(fields, :name, 'en')).to eq('Lake Thun')
    end

    it 'falls back to :en when requested locale is missing' do
      fields = { name: { en: 'Lake Thun' } }
      expect(ContentfulMappers.resolve_field(fields, :name, 'de')).to eq('Lake Thun')
    end

    it 'returns nil when field is not in the hash' do
      expect(ContentfulMappers.resolve_field({}, :name, 'de')).to be_nil
    end

    it 'returns the value directly when field value is not a locale hash' do
      fields = { name: 'not a locale hash' }
      expect(ContentfulMappers.resolve_field(fields, :name, 'de')).to eq('not a locale hash')
    end
  end

  # --- menu_to_slug ---

  describe '.menu_to_slug' do
    it 'returns "seiten" for nil menu' do
      expect(ContentfulMappers.menu_to_slug(nil)).to eq('seiten')
    end

    it 'maps "Offene Daten" to "offene-daten"' do
      expect(ContentfulMappers.menu_to_slug('Offene Daten')).to eq('offene-daten')
    end

    it 'maps "Open Data" to "offene-daten"' do
      expect(ContentfulMappers.menu_to_slug('Open Data')).to eq('offene-daten')
    end

    it 'maps "Über" to "ueber"' do
      expect(ContentfulMappers.menu_to_slug('Über')).to eq('ueber')
    end

    it 'maps "About" to "ueber"' do
      expect(ContentfulMappers.menu_to_slug('About')).to eq('ueber')
    end

    it 'slugifies unknown menus' do
      expect(ContentfulMappers.menu_to_slug('My Custom Menu')).to eq('my-custom-menu')
    end
  end

  # --- flatten_entry ---

  describe '.flatten_entry' do
    it 'produces one hash per locale' do
      fields = build_fields(slug: 'test-spot', name: { de: 'Test DE', en: 'Test EN' })
      entry = build_entry(fields)
      results = ContentfulMappers.flatten_entry(entry, :map_spot)

      expect(results.length).to eq(2)
      expect(results[0]['locale']).to eq('de')
      expect(results[1]['locale']).to eq('en')
    end

    it 'resolves locale-specific field values' do
      fields = build_fields(slug: 'my-spot', name: { de: 'Mein Ort', en: 'My Spot' })
      entry = build_entry(fields)
      results = ContentfulMappers.flatten_entry(entry, :map_spot)

      expect(results[0]['name']).to eq('Mein Ort')
      expect(results[1]['name']).to eq('My Spot')
    end

    it 'includes sys timestamps in each row' do
      fields = build_fields(slug: 'ts-test')
      entry = build_entry(fields)
      results = ContentfulMappers.flatten_entry(entry, :map_spot)

      results.each do |row|
        expect(row['createdAt']).to eq('2025-01-10T08:30:00Z')
        expect(row['updatedAt']).to eq('2025-01-15T10:00:00Z')
      end
    end
  end

  # --- map_spot ---

  describe '.map_spot' do
    it 'maps a fully populated spot entry' do
      fields = build_fields(
        slug: 'thunersee-spiez',
        name: { de: 'Thunersee Spiez', en: 'Lake Thun Spiez' },
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A launch point.' }] }] },
        location: build_location(46.6863, 7.6803),
        approximate_address: 'Seestrasse, 3700 Spiez',
        country: 'CH',
        confirmed: true,
        rejected: false,
        waterway: build_reference('thunersee'),
        spot_type: build_reference('launch-point'),
        paddling_environment_type: build_reference('lake'),
        paddle_craft_type: [build_reference('kayak'), build_reference('sup')],
        event_notices: [build_reference('notice-1')],
        obstacles: [],
        data_source_type: build_reference('community'),
        data_license_type: build_reference('cc-by-sa')
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_spot(entry, fields, 'de')

      expect(result['slug']).to eq('thunersee-spiez')
      expect(result['name']).to eq('Thunersee Spiez')
      expect(result['description']).to eq('<p>A launch point.</p>')
      expect(result['location']).to eq({ 'lat' => 46.6863, 'lon' => 7.6803 })
      expect(result['approximateAddress']).to eq('Seestrasse, 3700 Spiez')
      expect(result['country']).to eq('CH')
      expect(result['confirmed']).to be true
      expect(result['rejected']).to be false
      expect(result['waterway_slug']).to eq('thunersee')
      expect(result['spotType_slug']).to eq('launch-point')
      expect(result['paddlingEnvironmentType_slug']).to eq('lake')
      expect(result['paddleCraftTypes']).to eq(%w[kayak sup])
      expect(result['eventNotices']).to eq(['notice-1'])
      expect(result['obstacles']).to eq([])
      expect(result['dataSourceType_slug']).to eq('community')
      expect(result['dataLicenseType_slug']).to eq('cc-by-sa')
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_spot(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['name']).to be_nil
      expect(result['description']).to be_nil
      expect(result['location']).to be_nil
      expect(result['confirmed']).to be false
      expect(result['rejected']).to be false
      expect(result['paddleCraftTypes']).to eq([])
    end
  end

  # --- map_waterway ---

  describe '.map_waterway' do
    it 'maps a fully populated waterway entry' do
      geo = build_geometry('{"type":"Polygon","coordinates":[[7.0,46.0]]}')
      fields = build_fields(
        slug: 'thunersee',
        name: { de: 'Thunersee', en: 'Lake Thun' },
        length: 17.5,
        area: 48.4,
        geometry: geo,
        show_in_menu: true,
        paddling_environment_type: build_reference('lake'),
        data_source_type: build_reference('official'),
        data_license_type: build_reference('cc-by-sa')
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_waterway(entry, fields, 'de')

      expect(result['slug']).to eq('thunersee')
      expect(result['name']).to eq('Thunersee')
      expect(result['length']).to eq(17.5)
      expect(result['area']).to eq(48.4)
      expect(result['geometry']).to eq('{"type":"Polygon","coordinates":[[7.0,46.0]]}')
      expect(result['showInMenu']).to be true
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_waterway(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['geometry']).to be_nil
      expect(result['showInMenu']).to be false
    end
  end

  # --- map_obstacle ---

  describe '.map_obstacle' do
    it 'maps a fully populated obstacle entry' do
      fields = build_fields(
        slug: 'weir-munsingen',
        name: 'Wehr Münsingen',
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A weir.' }] }] },
        geometry: build_geometry('{"type":"Point","coordinates":[7.5,46.8]}'),
        portage_route: build_geometry('{"type":"LineString","coordinates":[[7.5,46.8],[7.51,46.81]]}'),
        portage_distance: 150,
        portage_description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Carry left.' }] }] },
        is_portage_necessary: true,
        is_portage_possible: true,
        obstacle_type: build_reference('weir'),
        waterway: build_reference('aare'),
        spots: [build_reference('spot-1'), build_reference('spot-2')]
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_obstacle(entry, fields, 'de')

      expect(result['slug']).to eq('weir-munsingen')
      expect(result['name']).to eq('Wehr Münsingen')
      expect(result['description']).to eq('<p>A weir.</p>')
      expect(result['portageDistance']).to eq(150)
      expect(result['isPortageNecessary']).to be true
      expect(result['isPortagePossible']).to be true
      expect(result['obstacleType_slug']).to eq('weir')
      expect(result['waterway_slug']).to eq('aare')
      expect(result['spots']).to eq(%w[spot-1 spot-2])
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_obstacle(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['isPortageNecessary']).to be false
      expect(result['isPortagePossible']).to be false
      expect(result['spots']).to eq([])
    end
  end

  # --- map_protected_area ---

  describe '.map_protected_area' do
    it 'maps a fully populated protected area entry' do
      fields = build_fields(
        slug: 'nature-reserve-aaredelta',
        name: 'Naturschutzgebiet Aaredelta',
        geometry: build_geometry('{"type":"Polygon","coordinates":[[7.6,46.7]]}'),
        is_area_marked: true,
        protected_area_type: build_reference('nature-reserve')
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_protected_area(entry, fields, 'de')

      expect(result['slug']).to eq('nature-reserve-aaredelta')
      expect(result['name']).to eq('Naturschutzgebiet Aaredelta')
      expect(result['isAreaMarked']).to be true
      expect(result['protectedAreaType_slug']).to eq('nature-reserve')
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_protected_area(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['isAreaMarked']).to be false
      expect(result['protectedAreaType_slug']).to be_nil
    end
  end

  # --- map_event_notice ---

  describe '.map_event_notice' do
    it 'maps a fully populated event notice entry' do
      start_date = double('StartDate')
      allow(start_date).to receive(:iso8601).and_return('2025-03-01T00:00:00Z')
      end_date = double('EndDate')
      allow(end_date).to receive(:iso8601).and_return('2025-03-31T23:59:59Z')

      fields = build_fields(
        slug: 'flood-warning-aare',
        name: 'Hochwasserwarnung Aare',
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Flooding expected.' }] }] },
        location: build_location(46.95, 7.45),
        affected_area: build_geometry('{"type":"Polygon","coordinates":[[7.4,46.9]]}'),
        start_date: start_date,
        end_date: end_date,
        waterway: [build_reference('aare'), build_reference('thunersee')]
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_event_notice(entry, fields, 'de')

      expect(result['slug']).to eq('flood-warning-aare')
      expect(result['name']).to eq('Hochwasserwarnung Aare')
      expect(result['description']).to eq('<p>Flooding expected.</p>')
      expect(result['location']).to eq({ 'lat' => 46.95, 'lon' => 7.45 })
      expect(result['startDate']).to eq('2025-03-01T00:00:00Z')
      expect(result['endDate']).to eq('2025-03-31T23:59:59Z')
      expect(result['waterways']).to eq(%w[aare thunersee])
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_event_notice(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['startDate']).to be_nil
      expect(result['endDate']).to be_nil
      expect(result['waterways']).to eq([])
    end
  end

  # --- map_type ---

  describe '.map_type' do
    it 'maps a type entry with localized names' do
      fields = build_fields(
        slug: 'launch-point',
        name: { de: 'Einstiegsort', en: 'Launch Point' }
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_type(entry, fields, 'de')

      expect(result['slug']).to eq('launch-point')
      expect(result['name_de']).to eq('Einstiegsort')
      expect(result['name_en']).to eq('Launch Point')
    end

    it 'handles all fields missing' do
      entry = build_entry({})
      result = ContentfulMappers.map_type(entry, {}, 'de')

      expect(result['slug']).to eq('test-id-123')
      expect(result['name_de']).to be_nil
      expect(result['name_en']).to be_nil
    end
  end

  # --- map_static_page ---

  describe '.map_static_page' do
    it 'maps a fully populated static page entry' do
      fields = build_fields(
        slug: 'about-us',
        title: 'Über uns',
        menu: 'Über',
        page_contents: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'About page content.' }] }] },
        menu_order: 2
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      expect(result['slug']).to eq('about-us')
      expect(result['title']).to eq('Über uns')
      expect(result['menu']).to eq('Über')
      expect(result['menu_slug']).to eq('ueber')
      expect(result['page_body']).to eq('<p>About page content.</p>')
      expect(result['menuOrder']).to eq(2)
    end

    it 'defaults menuOrder to 0 when missing' do
      fields = build_fields(slug: 'page', title: 'Page')
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      expect(result['menuOrder']).to eq(0)
    end

    it 'defaults menu_slug to "seiten" when menu is nil' do
      fields = build_fields(slug: 'page')
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      expect(result['menu_slug']).to eq('seiten')
    end

    it 'handles rich text content as Hash with content key' do
      rich_text = { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Hello' }] }] }
      fields = build_fields(slug: 'test', title: 'Test', page_contents: rich_text)
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')
      expect(result['page_body']).to eq('<p>Hello</p>')
    end

    it 'handles rich text content in Contentful raw JSON format' do
      raw_doc = {
        'nodeType' => 'document',
        'data' => {},
        'content' => [
          { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
            { 'nodeType' => 'text', 'value' => 'Willkommen auf der Seite.', 'marks' => [], 'data' => {} }
          ] },
          { 'nodeType' => 'heading-2', 'data' => {}, 'content' => [
            { 'nodeType' => 'text', 'value' => 'Abschnitt', 'marks' => [], 'data' => {} }
          ] },
          { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
            { 'nodeType' => 'text', 'value' => 'Mehr Inhalt hier.', 'marks' => [], 'data' => {} }
          ] }
        ]
      }
      rich_text = { 'raw' => JSON.generate(raw_doc) }
      fields = build_fields(slug: 'projekt', title: { de: 'Das Projekt', en: 'The Project' }, page_contents: { de: rich_text, en: rich_text })
      entry = build_entry(fields)

      result = ContentfulMappers.map_static_page(entry, fields, 'de')
      expect(result['page_body']).to include('<p>Willkommen auf der Seite.</p>')
      expect(result['page_body']).to include('<h2>Abschnitt</h2>')
      expect(result['page_body']).to include('<p>Mehr Inhalt hier.</p>')
      expect(result['title']).to eq('Das Projekt')
    end

    it 'handles rich text content as object with .content method' do
      rt_object = Object.new
      rt_object.define_singleton_method(:content) { [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Object content' }] }] }
      fields = build_fields(slug: 'test', title: 'Test')
      fields[:page_contents] = { en: rt_object }
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')
      expect(result['page_body']).to eq('<p>Object content</p>')
    end

    it 'handles nil content field gracefully' do
      fields = build_fields(slug: 'test', title: 'Test')
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')
      expect(result['page_body']).to be_nil
    end

    it 'resolves content for both de and en locales' do
      de_rt = { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'German content' }] }] }
      en_rt = { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'English content' }] }] }
      fields = build_fields(slug: 'test', title: { de: 'Test DE', en: 'Test EN' })
      fields[:page_contents] = { de: de_rt, en: en_rt }
      entry = build_entry(fields)

      de_result = ContentfulMappers.map_static_page(entry, fields, 'de')
      en_result = ContentfulMappers.map_static_page(entry, fields, 'en')
      expect(de_result['page_body']).to eq('<p>German content</p>')
      expect(en_result['page_body']).to eq('<p>English content</p>')
    end

    it 'renders table HTML in page_body from rich text with tables' do
      rich_text = {
        'content' => [
          { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Data schema fields:' }] },
          { 'nodeType' => 'table', 'content' => [
            { 'nodeType' => 'table-row', 'content' => [
              { 'nodeType' => 'table-header-cell', 'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Field' }] }
              ] },
              { 'nodeType' => 'table-header-cell', 'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Type' }] }
              ] }
            ] },
            { 'nodeType' => 'table-row', 'content' => [
              { 'nodeType' => 'table-cell', 'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'name' }] }
              ] },
              { 'nodeType' => 'table-cell', 'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'String' }] }
              ] }
            ] }
          ] }
        ]
      }
      fields = build_fields(slug: 'daten-schema', title: 'Daten Schema', menu: 'Offene Daten', page_contents: rich_text)
      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      expect(result['page_body']).to include('<p>Data schema fields:</p>')
      expect(result['page_body']).to include('<table>')
      expect(result['page_body']).to include('<th><p>Field</p></th>')
      expect(result['page_body']).to include('<th><p>Type</p></th>')
      expect(result['page_body']).to include('<td><p>name</p></td>')
      expect(result['page_body']).to include('<td><p>String</p></td>')
      expect(result['menu_slug']).to eq('offene-daten')
    end
  end

  # --- Bug exploration: content mapping failure for non-Hash locale wrappers ---

  describe '.map_static_page content mapping bug exploration' do
    # Simulates a Contentful SDK object that wraps locale values but is NOT a plain Hash.
    # It responds to [] with locale keys, but is_a?(Hash) returns false.
    # This is the scenario that triggers the bug in resolve_field.
    let(:rich_text_document) do
      {
        'content' => [
          { 'nodeType' => 'paragraph', 'content' => [
            { 'nodeType' => 'text', 'value' => 'This is static page content.' }
          ] }
        ]
      }
    end

    it 'BUG EXPLORATION: returns nil content when locale wrapper is not a plain Hash' do
      # Create a locale wrapper object that responds to [] but is NOT is_a?(Hash)
      # This simulates how the Contentful SDK may return rich text fields
      locale_wrapper = Object.new
      locale_wrapper.define_singleton_method(:[]) do |key|
        rich_text = {
          'content' => [
            { 'nodeType' => 'paragraph', 'content' => [
              { 'nodeType' => 'text', 'value' => 'This is static page content.' }
            ] }
          ]
        }
        key == :en ? rich_text : nil
      end

      fields = build_fields(slug: 'datenlizenzen', title: 'Datenlizenzen', menu: 'Offene Daten')
      # Inject the non-Hash locale wrapper directly for the :page_contents field
      fields[:page_contents] = locale_wrapper

      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      # We EXPECT this to produce non-empty HTML content, but the bug causes nil
      expect(result['page_body']).to_not be_nil
      expect(result['page_body']).to_not be_empty
      expect(result['page_body']).to include('This is static page content.')
    end

    it 'BUG EXPLORATION: object-style rich text in a proper Hash locale wrapper works' do
      # Create a rich text object that responds to .content (object-style)
      rt_object = Object.new
      rt_object.define_singleton_method(:content) do
        [
          { 'nodeType' => 'paragraph', 'content' => [
            { 'nodeType' => 'text', 'value' => 'Object-style rich text.' }
          ] }
        ]
      end

      # Wrap in a proper Hash locale wrapper — this SHOULD pass resolve_field's guard
      fields = build_fields(slug: 'projekt', title: 'Das Projekt', menu: 'Über')
      fields[:page_contents] = { en: rt_object }

      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      # This should work because the locale wrapper IS a Hash
      expect(result['page_body']).to_not be_nil
      expect(result['page_body']).to_not be_empty
      expect(result['page_body']).to include('Object-style rich text.')
    end
  end

  # --- Bug exploration: table node types not rendered as HTML table elements ---

  describe '.render_rich_text table node handling' do
    it 'renders a simple table with one row and one table-cell' do
      content = [
        {
          'nodeType' => 'table',
          'content' => [
            {
              'nodeType' => 'table-row',
              'content' => [
                {
                  'nodeType' => 'table-cell',
                  'content' => [
                    { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Cell text' }] }
                  ]
                }
              ]
            }
          ]
        }
      ]
      result = ContentfulMappers.render_rich_text(content)

      expect(result).to include('<table>')
      expect(result).to include('</table>')
      expect(result).to include('<tr>')
      expect(result).to include('</tr>')
      expect(result).to include('<td>')
      expect(result).to include('</td>')
      expect(result).to include('<p>Cell text</p>')
    end

    it 'renders a table with table-header-cell nodes' do
      content = [
        {
          'nodeType' => 'table',
          'content' => [
            {
              'nodeType' => 'table-row',
              'content' => [
                {
                  'nodeType' => 'table-header-cell',
                  'content' => [
                    { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Header 1' }] }
                  ]
                },
                {
                  'nodeType' => 'table-header-cell',
                  'content' => [
                    { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Header 2' }] }
                  ]
                }
              ]
            }
          ]
        }
      ]
      result = ContentfulMappers.render_rich_text(content)

      expect(result).to include('<table>')
      expect(result).to include('<th>')
      expect(result).to include('</th>')
      expect(result).to include('<p>Header 1</p>')
      expect(result).to include('<p>Header 2</p>')
    end

    it 'renders a multi-row table' do
      content = [
        {
          'nodeType' => 'table',
          'content' => [
            {
              'nodeType' => 'table-row',
              'content' => [
                { 'nodeType' => 'table-cell', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'R1C1' }] }] },
                { 'nodeType' => 'table-cell', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'R1C2' }] }] }
              ]
            },
            {
              'nodeType' => 'table-row',
              'content' => [
                { 'nodeType' => 'table-cell', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'R2C1' }] }] },
                { 'nodeType' => 'table-cell', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'R2C2' }] }] }
              ]
            }
          ]
        }
      ]
      result = ContentfulMappers.render_rich_text(content)

      expect(result).to include('<table>')
      expect(result.scan('<tr>').length).to eq(2)
      expect(result.scan('<td>').length).to eq(4)
      expect(result).to include('<p>R1C1</p>')
      expect(result).to include('<p>R2C2</p>')
    end

    it 'renders a mixed document with paragraphs before and after a table' do
      content = [
        { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Before table' }] },
        {
          'nodeType' => 'table',
          'content' => [
            {
              'nodeType' => 'table-row',
              'content' => [
                { 'nodeType' => 'table-cell', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Cell' }] }] }
              ]
            }
          ]
        },
        { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'After table' }] }
      ]
      result = ContentfulMappers.render_rich_text(content)

      expect(result).to include('<p>Before table</p>')
      expect(result).to include('<p>After table</p>')
      expect(result).to include('<table>')
      expect(result).to include('<tr>')
      expect(result).to include('<td>')
      expect(result).to include('<p>Cell</p>')
    end

    it '[PBT-exploration] renders correct table HTML tags for any random table structure' do
      # **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
      property_of {
        num_rows = range(1, 5)
        total_td = 0
        total_th = 0

        rows = Array.new(num_rows) do
          num_cells = range(1, 4)
          cells = Array.new(num_cells) do
            cell_type = boolean ? 'table-cell' : 'table-header-cell'
            text = sized(range(1, 20)) { string(:alpha) }
            if cell_type == 'table-cell'
              total_td += 1
            else
              total_th += 1
            end
            {
              'nodeType' => cell_type,
              'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => text }] }
              ]
            }
          end
          { 'nodeType' => 'table-row', 'content' => cells }
        end

        content = [{ 'nodeType' => 'table', 'content' => rows }]
        [content, num_rows, total_td, total_th]
      }.check(100) { |content, num_rows, td_count, th_count|
        result = ContentfulMappers.render_rich_text(content)

        expect(result.scan('<table>').length).to eq(1), "Expected 1 <table> tag, got #{result.scan('<table>').length}"
        expect(result.scan('</table>').length).to eq(1), "Expected 1 </table> tag, got #{result.scan('</table>').length}"
        expect(result.scan('<tr>').length).to eq(num_rows), "Expected #{num_rows} <tr> tags, got #{result.scan('<tr>').length}"
        expect(result.scan('<td>').length).to eq(td_count), "Expected #{td_count} <td> tags, got #{result.scan('<td>').length}"
        expect(result.scan('<th>').length).to eq(th_count), "Expected #{th_count} <th> tags, got #{result.scan('<th>').length}"
      }
    end
  end

  # --- Fix checking: table rendering correctness (PBT-fix) ---

  describe 'Fix checking: table rendering correctness' do
    it '[PBT-fix] renders correct HTML table tags for any random table structure' do
      # **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
      property_of {
        num_rows = range(1, 5)
        total_td = 0
        total_th = 0
        cell_texts = []

        rows = Array.new(num_rows) do
          num_cells = range(1, 4)
          cells = Array.new(num_cells) do
            cell_type = boolean ? 'table-cell' : 'table-header-cell'
            text = sized(range(1, 20)) { string(:alpha) }
            cell_texts << text
            if cell_type == 'table-cell'
              total_td += 1
            else
              total_th += 1
            end
            {
              'nodeType' => cell_type,
              'content' => [
                { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => text }] }
              ]
            }
          end
          { 'nodeType' => 'table-row', 'content' => cells }
        end

        content = [{ 'nodeType' => 'table', 'content' => rows }]
        [content, num_rows, total_td, total_th, cell_texts]
      }.check(100) { |content, num_rows, td_count, th_count, cell_texts|
        result = ContentfulMappers.render_rich_text(content)

        # Exactly 1 <table> and 1 </table>
        expect(result.scan('<table>').length).to eq(1), "Expected 1 <table>, got #{result.scan('<table>').length}"
        expect(result.scan('</table>').length).to eq(1), "Expected 1 </table>, got #{result.scan('</table>').length}"

        # Number of <tr> tags equals number of rows
        expect(result.scan('<tr>').length).to eq(num_rows), "Expected #{num_rows} <tr>, got #{result.scan('<tr>').length}"

        # Number of <td> tags equals number of table-cell nodes
        expect(result.scan('<td>').length).to eq(td_count), "Expected #{td_count} <td>, got #{result.scan('<td>').length}"

        # Number of <th> tags equals number of table-header-cell nodes
        expect(result.scan('<th>').length).to eq(th_count), "Expected #{th_count} <th>, got #{result.scan('<th>').length}"

        # Output starts with <table> and ends with </table>
        expect(result).to start_with('<table>'), "Expected output to start with <table>"
        expect(result).to end_with('</table>'), "Expected output to end with </table>"

        # Each cell's text content appears in the output
        cell_texts.each do |text|
          expect(result).to include(text), "Expected output to include cell text '#{text}'"
        end
      }
    end
  end

  # --- Preservation: non-table rendering unchanged ---

  describe 'Preservation: non-table rendering unchanged' do
    # **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

    # Mapping from node types to their expected HTML tags
    NODE_TAG_MAP = {
      'paragraph'      => %w[<p> </p>],
      'heading-1'      => %w[<h1> </h1>],
      'heading-2'      => %w[<h2> </h2>],
      'heading-3'      => %w[<h3> </h3>],
      'unordered-list'  => %w[<ul> </ul>],
      'ordered-list'    => %w[<ol> </ol>]
    }.freeze

    it '[PBT-preservation] non-table documents render correct HTML with no table tags' do
      property_of {
        num_nodes = range(1, 5)
        # Track which node types and text values we generate
        expected_types = []
        expected_texts = []

        nodes = Array.new(num_nodes) do
          node_kind = choose('paragraph', 'heading-1', 'heading-2', 'heading-3',
                             'unordered-list', 'ordered-list', 'hyperlink-in-paragraph')

          case node_kind
          when 'paragraph'
            text = sized(range(1, 15)) { string(:alpha) }
            expected_types << 'paragraph'
            expected_texts << text
            { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => text }] }

          when 'heading-1', 'heading-2', 'heading-3'
            text = sized(range(1, 15)) { string(:alpha) }
            expected_types << node_kind
            expected_texts << text
            { 'nodeType' => node_kind, 'content' => [{ 'nodeType' => 'text', 'value' => text }] }

          when 'unordered-list', 'ordered-list'
            num_items = range(1, 3)
            items = Array.new(num_items) do
              item_text = sized(range(1, 15)) { string(:alpha) }
              expected_texts << item_text
              {
                'nodeType' => 'list-item',
                'content' => [
                  { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => item_text }] }
                ]
              }
            end
            expected_types << node_kind
            { 'nodeType' => node_kind, 'content' => items }

          when 'hyperlink-in-paragraph'
            link_text = sized(range(1, 15)) { string(:alpha) }
            href = "https://#{sized(range(3, 10)) { string(:alpha) }}.com"
            expected_types << 'hyperlink-in-paragraph'
            expected_texts << link_text
            {
              'nodeType' => 'paragraph',
              'content' => [
                {
                  'nodeType' => 'hyperlink',
                  'data' => { 'uri' => href },
                  'content' => [{ 'nodeType' => 'text', 'value' => link_text }]
                }
              ]
            }
          end
        end

        [nodes, expected_types, expected_texts]
      }.check(100) { |nodes, expected_types, expected_texts|
        result = ContentfulMappers.render_rich_text(nodes)

        # No table tags should appear in non-table documents
        expect(result).not_to include('<table>'), "Non-table document should not contain <table>"
        expect(result).not_to include('</table>'), "Non-table document should not contain </table>"
        expect(result).not_to include('<tr>'), "Non-table document should not contain <tr>"
        expect(result).not_to include('</tr>'), "Non-table document should not contain </tr>"
        expect(result).not_to include('<td>'), "Non-table document should not contain <td>"
        expect(result).not_to include('</td>'), "Non-table document should not contain </td>"
        expect(result).not_to include('<th>'), "Non-table document should not contain <th>"
        expect(result).not_to include('</th>'), "Non-table document should not contain </th>"

        # All generated text content appears in the output
        expected_texts.each do |text|
          expect(result).to include(text), "Expected output to include text '#{text}'"
        end

        # Verify correct HTML tags for each node type present
        expected_types.each do |node_type|
          case node_type
          when 'paragraph'
            expect(result).to include('<p>'), "Expected <p> tag for paragraph node"
            expect(result).to include('</p>'), "Expected </p> tag for paragraph node"
          when 'heading-1'
            expect(result).to include('<h1>'), "Expected <h1> tag for heading-1 node"
            expect(result).to include('</h1>'), "Expected </h1> tag for heading-1 node"
          when 'heading-2'
            expect(result).to include('<h2>'), "Expected <h2> tag for heading-2 node"
            expect(result).to include('</h2>'), "Expected </h2> tag for heading-2 node"
          when 'heading-3'
            expect(result).to include('<h3>'), "Expected <h3> tag for heading-3 node"
            expect(result).to include('</h3>'), "Expected </h3> tag for heading-3 node"
          when 'unordered-list'
            expect(result).to include('<ul>'), "Expected <ul> tag for unordered-list node"
            expect(result).to include('</ul>'), "Expected </ul> tag for unordered-list node"
            expect(result).to include('<li>'), "Expected <li> tag for list items"
          when 'ordered-list'
            expect(result).to include('<ol>'), "Expected <ol> tag for ordered-list node"
            expect(result).to include('</ol>'), "Expected </ol> tag for ordered-list node"
            expect(result).to include('<li>'), "Expected <li> tag for list items"
          when 'hyperlink-in-paragraph'
            expect(result).to include('<a href='), "Expected <a> tag for hyperlink node"
            expect(result).to include('</a>'), "Expected </a> tag for hyperlink node"
            expect(result).to include('<p>'), "Expected <p> wrapper for hyperlink paragraph"
          end
        end
      }
    end
  end

  # --- Preservation unit tests: non-table rendering ---

  describe 'Preservation unit tests: non-table rendering' do
    it 'renders a paragraph with text' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Hello' }] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>Hello</p>')
    end

    it 'renders heading-1' do
      content = [{ 'nodeType' => 'heading-1', 'content' => [{ 'nodeType' => 'text', 'value' => 'Title' }] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<h1>Title</h1>')
    end

    it 'renders heading-2' do
      content = [{ 'nodeType' => 'heading-2', 'content' => [{ 'nodeType' => 'text', 'value' => 'Subtitle' }] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<h2>Subtitle</h2>')
    end

    it 'renders heading-3' do
      content = [{ 'nodeType' => 'heading-3', 'content' => [{ 'nodeType' => 'text', 'value' => 'Section' }] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<h3>Section</h3>')
    end

    it 'renders a hyperlink with URI inside a paragraph' do
      content = [
        {
          'nodeType' => 'paragraph',
          'content' => [
            {
              'nodeType' => 'hyperlink',
              'data' => { 'uri' => 'https://example.com' },
              'content' => [{ 'nodeType' => 'text', 'value' => 'link' }]
            }
          ]
        }
      ]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><a href="https://example.com">link</a></p>')
    end

    it 'renders an unordered list' do
      content = [
        {
          'nodeType' => 'unordered-list',
          'content' => [
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Item 1' }] }] },
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Item 2' }] }] }
          ]
        }
      ]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>')
    end

    it 'renders an ordered list' do
      content = [
        {
          'nodeType' => 'ordered-list',
          'content' => [
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Item 1' }] }] },
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Item 2' }] }] }
          ]
        }
      ]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<ol><li><p>Item 1</p></li><li><p>Item 2</p></li></ol>')
    end

    it 'renders a mixed document with all non-table node types' do
      content = [
        { 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Intro' }] },
        { 'nodeType' => 'heading-1', 'content' => [{ 'nodeType' => 'text', 'value' => 'Main Title' }] },
        {
          'nodeType' => 'unordered-list',
          'content' => [
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A' }] }] },
            { 'nodeType' => 'list-item', 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'B' }] }] }
          ]
        },
        {
          'nodeType' => 'paragraph',
          'content' => [
            { 'nodeType' => 'hyperlink', 'data' => { 'uri' => 'https://example.com' }, 'content' => [{ 'nodeType' => 'text', 'value' => 'click' }] }
          ]
        }
      ]
      expected = '<p>Intro</p><h1>Main Title</h1><ul><li><p>A</p></li><li><p>B</p></li></ul><p><a href="https://example.com">click</a></p>'
      expect(ContentfulMappers.render_rich_text(content)).to eq(expected)
    end
  end

  # --- Nil reference handling ---

  describe 'nil reference handling' do
    it 'map_spot handles nil single references' do
      fields = build_fields(
        slug: 'test',
        waterway: nil,
        spot_type: nil,
        paddling_environment_type: nil,
        data_source_type: nil,
        data_license_type: nil
      )
      entry = build_entry(fields)
      result = ContentfulMappers.map_spot(entry, fields, 'de')

      expect(result['waterway_slug']).to be_nil
      expect(result['spotType_slug']).to be_nil
      expect(result['paddlingEnvironmentType_slug']).to be_nil
      expect(result['dataSourceType_slug']).to be_nil
      expect(result['dataLicenseType_slug']).to be_nil
    end

    it 'map_obstacle handles nil waterway and obstacle_type references' do
      fields = build_fields(slug: 'test', waterway: nil, obstacle_type: nil)
      entry = build_entry(fields)
      result = ContentfulMappers.map_obstacle(entry, fields, 'de')

      expect(result['waterway_slug']).to be_nil
      expect(result['obstacleType_slug']).to be_nil
    end

    it 'map_protected_area handles nil protectedAreaType reference' do
      fields = build_fields(slug: 'test', protected_area_type: nil)
      entry = build_entry(fields)
      result = ContentfulMappers.map_protected_area(entry, fields, 'de')

      expect(result['protectedAreaType_slug']).to be_nil
    end
  end

  # --- Bug exploration: marks on text nodes ---

  describe 'Bug exploration: marks on text nodes' do
    MARK_TO_TAG = { 'code' => 'code', 'bold' => 'strong', 'italic' => 'em', 'underline' => 'u' }.freeze

    it '[PBT-exploration] marked text nodes render with correct HTML tags' do
      # **Validates: Property 1**
      property_of {
        text = sized(range(1, 20)) { string(:alpha) }
        all_marks = %w[code bold italic underline]
        # Generate a random non-empty subset of mark types
        subset = all_marks.select { boolean }
        subset = [all_marks.sample] if subset.empty?
        [text, subset]
      }.check(100) { |text, marks|
        text_node = {
          'nodeType' => 'text',
          'value' => text,
          'marks' => marks.map { |m| { 'type' => m } }
        }
        content = [{ 'nodeType' => 'paragraph', 'content' => [text_node] }]
        result = ContentfulMappers.render_rich_text(content)

        # The text value must appear in the output
        expect(result).to include(text), "Expected output to include text '#{text}'"

        # Each mark type must produce its corresponding HTML tag
        marks.each do |mark_type|
          tag = MARK_TO_TAG[mark_type]
          expect(result).to include("<#{tag}>"), "Expected <#{tag}> tag for mark '#{mark_type}'"
          expect(result).to include("</#{tag}>"), "Expected </#{tag}> tag for mark '#{mark_type}'"
        end
      }
    end
  end

  # --- Fix checking: individual mark types ---

  describe 'Fix checking: individual mark types' do
    it 'wraps text with code mark in <code> tags' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'slug', 'marks' => [{ 'type' => 'code' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><code>slug</code></p>')
    end

    it 'wraps text with bold mark in <strong> tags' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'important', 'marks' => [{ 'type' => 'bold' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><strong>important</strong></p>')
    end

    it 'wraps text with italic mark in <em> tags' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'note', 'marks' => [{ 'type' => 'italic' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><em>note</em></p>')
    end

    it 'wraps text with underline mark in <u> tags' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'term', 'marks' => [{ 'type' => 'underline' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><u>term</u></p>')
    end
  end

  # --- Fix checking: multiple simultaneous marks ---

  describe 'Fix checking: multiple simultaneous marks' do
    it 'nests bold and code marks' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'term', 'marks' => [{ 'type' => 'bold' }, { 'type' => 'code' }] }
      ] }]
      result = ContentfulMappers.render_rich_text(content)
      expect(result).to eq('<p><code><strong>term</strong></code></p>')
    end

    it 'nests italic and underline marks' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'note', 'marks' => [{ 'type' => 'italic' }, { 'type' => 'underline' }] }
      ] }]
      result = ContentfulMappers.render_rich_text(content)
      expect(result).to eq('<p><u><em>note</em></u></p>')
    end

    it 'nests all four mark types' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'all', 'marks' => [
          { 'type' => 'bold' }, { 'type' => 'italic' }, { 'type' => 'underline' }, { 'type' => 'code' }
        ] }
      ] }]
      result = ContentfulMappers.render_rich_text(content)
      expect(result).to eq('<p><code><u><em><strong>all</strong></em></u></code></p>')
    end
  end

  # --- Fix checking: mark edge cases ---

  describe 'Fix checking: mark edge cases' do
    it 'renders plain text when marks array is empty' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'plain', 'marks' => [] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>plain</p>')
    end

    it 'renders plain text when marks key is missing' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'no marks key' }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>no marks key</p>')
    end

    it 'ignores unknown mark types' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'test', 'marks' => [{ 'type' => 'strikethrough' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>test</p>')
    end

    it 'applies known marks and ignores unknown marks in the same node' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'mixed', 'marks' => [{ 'type' => 'bold' }, { 'type' => 'strikethrough' }] }
      ] }]
      result = ContentfulMappers.render_rich_text(content)
      expect(result).to include('<strong>')
      expect(result).not_to include('strikethrough')
    end
  end

  # --- Fix checking: marked text in various containers ---

  describe 'Fix checking: marked text in various containers' do
    it 'renders code-marked text inside a paragraph' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'slug', 'marks' => [{ 'type' => 'code' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><code>slug</code></p>')
    end

    it 'renders bold-marked text inside a heading' do
      content = [{ 'nodeType' => 'heading-2', 'content' => [
        { 'nodeType' => 'text', 'value' => 'Title', 'marks' => [{ 'type' => 'bold' }] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<h2><strong>Title</strong></h2>')
    end

    it 'renders code-marked text inside a table cell' do
      content = [{ 'nodeType' => 'table', 'content' => [
        { 'nodeType' => 'table-row', 'content' => [
          { 'nodeType' => 'table-cell', 'content' => [
            { 'nodeType' => 'paragraph', 'content' => [
              { 'nodeType' => 'text', 'value' => 'field_name', 'marks' => [{ 'type' => 'code' }] }
            ] }
          ] }
        ] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<table><tr><td><p><code>field_name</code></p></td></tr></table>')
    end

    it 'renders italic-marked text inside a hyperlink' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'hyperlink', 'data' => { 'uri' => 'https://example.com' }, 'content' => [
          { 'nodeType' => 'text', 'value' => 'click here', 'marks' => [{ 'type' => 'italic' }] }
        ] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><a href="https://example.com"><em>click here</em></a></p>')
    end
  end

  # --- Fix checking: marks PBT ---

  describe 'Fix checking: marks PBT' do
    MARK_TO_TAG_FIX = { 'code' => 'code', 'bold' => 'strong', 'italic' => 'em', 'underline' => 'u' }.freeze

    it '[PBT-fix] each mark type produces its HTML tag for random text and mark subsets' do
      # **Validates: Property 1**
      property_of {
        text = sized(range(1, 20)) { string(:alpha) }
        all_marks = %w[code bold italic underline]
        subset = all_marks.select { boolean }
        [text, subset]
      }.check(100) { |text, marks|
        text_node = {
          'nodeType' => 'text',
          'value' => text,
          'marks' => marks.map { |m| { 'type' => m } }
        }
        content = [{ 'nodeType' => 'paragraph', 'content' => [text_node] }]
        result = ContentfulMappers.render_rich_text(content)

        # Text value must always be present
        expect(result).to include(text), "Expected output to include text '#{text}'"

        # Each mark's HTML tag must appear
        marks.each do |mark_type|
          tag = MARK_TO_TAG_FIX[mark_type]
          expect(result).to include("<#{tag}>"), "Expected <#{tag}> for mark '#{mark_type}'"
          expect(result).to include("</#{tag}>"), "Expected </#{tag}> for mark '#{mark_type}'"
        end

        # If no marks, no mark tags should appear
        if marks.empty?
          MARK_TO_TAG_FIX.values.each do |tag|
            expect(result).not_to include("<#{tag}>"), "Expected no <#{tag}> for unmarked text"
          end
        end
      }
    end
  end

  # --- Preservation: unmarked text renders as plain text ---

  describe 'Preservation: unmarked text renders as plain text' do
    it 'renders text with empty marks array as plain text in a paragraph' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'Hello world', 'marks' => [] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>Hello world</p>')
    end

    it 'renders text without marks key as plain text in a paragraph' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'text', 'value' => 'No marks key' }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p>No marks key</p>')
    end

    it 'renders unmarked text in a heading as plain text' do
      content = [{ 'nodeType' => 'heading-1', 'content' => [
        { 'nodeType' => 'text', 'value' => 'Title', 'marks' => [] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<h1>Title</h1>')
    end

    it 'renders unmarked text in a hyperlink as plain text' do
      content = [{ 'nodeType' => 'paragraph', 'content' => [
        { 'nodeType' => 'hyperlink', 'data' => { 'uri' => 'https://example.com' }, 'content' => [
          { 'nodeType' => 'text', 'value' => 'link text', 'marks' => [] }
        ] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<p><a href="https://example.com">link text</a></p>')
    end

    it 'renders unmarked text in a table cell as plain text' do
      content = [{ 'nodeType' => 'table', 'content' => [
        { 'nodeType' => 'table-row', 'content' => [
          { 'nodeType' => 'table-cell', 'content' => [
            { 'nodeType' => 'paragraph', 'content' => [
              { 'nodeType' => 'text', 'value' => 'cell value', 'marks' => [] }
            ] }
          ] }
        ] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<table><tr><td><p>cell value</p></td></tr></table>')
    end

    it 'renders unmarked text in a list item as plain text' do
      content = [{ 'nodeType' => 'unordered-list', 'content' => [
        { 'nodeType' => 'list-item', 'content' => [
          { 'nodeType' => 'paragraph', 'content' => [
            { 'nodeType' => 'text', 'value' => 'item text', 'marks' => [] }
          ] }
        ] }
      ] }]
      expect(ContentfulMappers.render_rich_text(content)).to eq('<ul><li><p>item text</p></li></ul>')
    end
  end

  # --- Preservation: no marks PBT ---

  describe 'Preservation: no marks PBT' do
    MARK_TAGS = %w[code strong em u].freeze

    it '[PBT-preservation] random documents with no marks produce no mark tags and preserve all text' do
      # **Validates: Property 2**
      property_of {
        num_nodes = range(1, 5)
        texts = []

        nodes = Array.new(num_nodes) do
          node_kind = choose('paragraph', 'heading-1', 'heading-2', 'heading-3',
                             'table-single-cell', 'list-item-in-ul')

          case node_kind
          when 'paragraph', 'heading-1', 'heading-2', 'heading-3'
            text = sized(range(1, 15)) { string(:alpha) }
            texts << text
            { 'nodeType' => node_kind, 'content' => [
              { 'nodeType' => 'text', 'value' => text, 'marks' => [] }
            ] }
          when 'table-single-cell'
            text = sized(range(1, 15)) { string(:alpha) }
            texts << text
            { 'nodeType' => 'table', 'content' => [
              { 'nodeType' => 'table-row', 'content' => [
                { 'nodeType' => 'table-cell', 'content' => [
                  { 'nodeType' => 'paragraph', 'content' => [
                    { 'nodeType' => 'text', 'value' => text, 'marks' => [] }
                  ] }
                ] }
              ] }
            ] }
          when 'list-item-in-ul'
            text = sized(range(1, 15)) { string(:alpha) }
            texts << text
            { 'nodeType' => 'unordered-list', 'content' => [
              { 'nodeType' => 'list-item', 'content' => [
                { 'nodeType' => 'paragraph', 'content' => [
                  { 'nodeType' => 'text', 'value' => text, 'marks' => [] }
                ] }
              ] }
            ] }
          end
        end

        [nodes, texts]
      }.check(100) { |nodes, texts|
        result = ContentfulMappers.render_rich_text(nodes)

        # No mark tags should appear
        MARK_TAGS.each do |tag|
          expect(result).not_to include("<#{tag}>"), "Unmarked document should not contain <#{tag}>"
          expect(result).not_to include("</#{tag}>"), "Unmarked document should not contain </#{tag}>"
        end

        # All text content must be preserved
        texts.each do |text|
          expect(result).to include(text), "Expected output to include text '#{text}'"
        end
      }
    end
  end

  # --- Integration: original bug scenario - code marks in table ---

  describe 'Integration: original bug scenario - code marks in table' do
    it 'renders code-marked field names in a data schema table through extract_rich_text_html' do
      # Simulates the /en/offene-daten/daten-schema/ page content
      doc = {
        'nodeType' => 'document',
        'data' => {},
        'content' => [
          { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
            { 'nodeType' => 'text', 'value' => 'The following table describes the data schema:', 'marks' => [], 'data' => {} }
          ] },
          { 'nodeType' => 'table', 'data' => {}, 'content' => [
            { 'nodeType' => 'table-row', 'data' => {}, 'content' => [
              { 'nodeType' => 'table-header-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'Field', 'marks' => [{ 'type' => 'bold' }], 'data' => {} }
                ] }
              ] },
              { 'nodeType' => 'table-header-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'Description', 'marks' => [{ 'type' => 'bold' }], 'data' => {} }
                ] }
              ] }
            ] },
            { 'nodeType' => 'table-row', 'data' => {}, 'content' => [
              { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'slug', 'marks' => [{ 'type' => 'code' }], 'data' => {} }
                ] }
              ] },
              { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'Unique identifier for the spot', 'marks' => [], 'data' => {} }
                ] }
              ] }
            ] },
            { 'nodeType' => 'table-row', 'data' => {}, 'content' => [
              { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'name', 'marks' => [{ 'type' => 'code' }], 'data' => {} }
                ] }
              ] },
              { 'nodeType' => 'table-cell', 'data' => {}, 'content' => [
                { 'nodeType' => 'paragraph', 'data' => {}, 'content' => [
                  { 'nodeType' => 'text', 'value' => 'Display name of the spot', 'marks' => [], 'data' => {} }
                ] }
              ] }
            ] }
          ] }
        ]
      }

      field = { 'raw' => JSON.generate(doc) }
      result = ContentfulMappers.extract_rich_text_html(field)

      # Verify the intro paragraph
      expect(result).to include('<p>The following table describes the data schema:</p>')

      # Verify table structure
      expect(result).to include('<table>')
      expect(result).to include('</table>')

      # Verify header cells have bold marks
      expect(result).to include('<th><p><strong>Field</strong></p></th>')
      expect(result).to include('<th><p><strong>Description</strong></p></th>')

      # THE KEY ASSERTIONS: code-marked field names render with <code> tags
      expect(result).to include('<code>slug</code>')
      expect(result).to include('<code>name</code>')

      # Verify unmarked description text is plain
      expect(result).to include('Unique identifier for the spot')
      expect(result).to include('Display name of the spot')
    end
  end
end

