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
        waterways: [build_reference('aare'), build_reference('thunersee')]
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
        content: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'About page content.' }] }] },
        menu_order: 2
      )
      entry = build_entry(fields)

      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      expect(result['slug']).to eq('about-us')
      expect(result['title']).to eq('Über uns')
      expect(result['menu']).to eq('Über')
      expect(result['menu_slug']).to eq('ueber')
      expect(result['content']).to eq('<p>About page content.</p>')
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
      # Inject the non-Hash locale wrapper directly for the :content field
      fields[:content] = locale_wrapper

      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      # We EXPECT this to produce non-empty HTML content, but the bug causes nil
      expect(result['content']).to_not be_nil
      expect(result['content']).to_not be_empty
      expect(result['content']).to include('This is static page content.')
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
      fields[:content] = { en: rt_object }

      entry = build_entry(fields)
      result = ContentfulMappers.map_static_page(entry, fields, 'de')

      # This should work because the locale wrapper IS a Hash
      expect(result['content']).to_not be_nil
      expect(result['content']).to_not be_empty
      expect(result['content']).to include('Object-style rich text.')
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
end
