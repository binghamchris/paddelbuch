# frozen_string_literal: true

require 'spec_helper'

RSpec.describe ContentfulMappers do
  # --- Test helpers ---

  def build_sys(overrides = {})
    {
      id: 'test-id-123',
      locale: 'de',
      created_at: Time.parse('2025-01-10T08:30:00Z'),
      updated_at: Time.parse('2025-01-15T10:00:00Z')
    }.merge(overrides)
  end

  def build_entry(fields = {}, sys_overrides = {})
    entry = double('Entry')
    allow(entry).to receive(:sys).and_return(build_sys(sys_overrides))
    allow(entry).to receive(:respond_to?).with(anything).and_return(false)

    fields.each do |name, value|
      allow(entry).to receive(:respond_to?).with(name).and_return(true)
      allow(entry).to receive(name).and_return(value)
    end

    entry
  end

  def build_reference(slug)
    ref = double("Ref:#{slug}")
    allow(ref).to receive(:respond_to?).with(anything).and_return(false)
    allow(ref).to receive(:respond_to?).with(:slug).and_return(true)
    allow(ref).to receive(:slug).and_return(slug)
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

  # --- safe_field ---

  describe '.safe_field' do
    it 'returns the field value when entry responds to it' do
      entry = build_entry(name: 'Test Spot')
      expect(ContentfulMappers.safe_field(entry, :name)).to eq('Test Spot')
    end

    it 'returns nil when entry does not respond to the field' do
      entry = build_entry({})
      expect(ContentfulMappers.safe_field(entry, :nonexistent)).to be_nil
    end

    it 'returns nil when the field raises an error' do
      entry = build_entry({})
      allow(entry).to receive(:respond_to?).with(:bad_field).and_return(true)
      allow(entry).to receive(:bad_field).and_raise(StandardError, 'field error')
      expect(ContentfulMappers.safe_field(entry, :bad_field)).to be_nil
    end
  end

  # --- extract_slug ---

  describe '.extract_slug' do
    it 'returns the slug field when present' do
      entry = build_entry(slug: 'my-spot')
      expect(ContentfulMappers.extract_slug(entry)).to eq('my-spot')
    end

    it 'falls back to sys[:id] when slug is missing' do
      entry = build_entry({}, { id: 'fallback-sys-id' })
      expect(ContentfulMappers.extract_slug(entry)).to eq('fallback-sys-id')
    end
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
    it 'returns the slug of a reference' do
      ref = build_reference('waterway-slug')
      expect(ContentfulMappers.extract_reference_slug(ref)).to eq('waterway-slug')
    end

    it 'falls back to sys[:id] when reference has no slug' do
      ref = double('Ref')
      allow(ref).to receive(:respond_to?).with(anything).and_return(false)
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
      # nil ref returns nil from extract_reference_slug, compact removes it
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

    it 'converts an unordered list' do
      field = {
        'content' => [
          { 'nodeType' => 'unordered-list', 'content' => [
            { 'nodeType' => 'list-item', 'content' => [
              { 'nodeType' => 'paragraph', 'content' => [
                { 'nodeType' => 'text', 'value' => 'Item 1' }
              ] }
            ] },
            { 'nodeType' => 'list-item', 'content' => [
              { 'nodeType' => 'paragraph', 'content' => [
                { 'nodeType' => 'text', 'value' => 'Item 2' }
              ] }
            ] }
          ] }
        ]
      }
      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>')
    end

    it 'converts an ordered list' do
      field = {
        'content' => [
          { 'nodeType' => 'ordered-list', 'content' => [
            { 'nodeType' => 'list-item', 'content' => [
              { 'nodeType' => 'paragraph', 'content' => [
                { 'nodeType' => 'text', 'value' => 'First' }
              ] }
            ] }
          ] }
        ]
      }
      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<ol><li><p>First</p></li></ol>')
    end

    it 'converts headings (h1, h2, h3)' do
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

    it 'handles entry-like rich text objects with .content method' do
      inner = double('TextNode')
      allow(inner).to receive(:is_a?).with(Hash).and_return(false)
      allow(inner).to receive(:respond_to?).with(:node_type).and_return(true)
      allow(inner).to receive(:node_type).and_return('text')
      allow(inner).to receive(:respond_to?).with(:content).and_return(false)
      allow(inner).to receive(:respond_to?).with(:value).and_return(true)
      allow(inner).to receive(:value).and_return('rich content')
      allow(inner).to receive(:respond_to?).with(:data).and_return(false)

      para = double('ParagraphNode')
      allow(para).to receive(:is_a?).with(Hash).and_return(false)
      allow(para).to receive(:respond_to?).with(:node_type).and_return(true)
      allow(para).to receive(:node_type).and_return('paragraph')
      allow(para).to receive(:respond_to?).with(:content).and_return(true)
      allow(para).to receive(:content).and_return([inner])
      allow(para).to receive(:respond_to?).with(:value).and_return(false)
      allow(para).to receive(:respond_to?).with(:data).and_return(false)

      field = double('RichTextField')
      allow(field).to receive(:is_a?).with(Hash).and_return(false)
      allow(field).to receive(:respond_to?).with(:content).and_return(true)
      allow(field).to receive(:content).and_return([para])

      expect(ContentfulMappers.extract_rich_text_html(field)).to eq('<p>rich content</p>')
    end
  end

  # --- base_fields ---

  describe '.base_fields' do
    it 'extracts locale, createdAt, updatedAt from sys' do
      entry = build_entry({})
      result = ContentfulMappers.base_fields(entry)
      expect(result['locale']).to eq('de')
      expect(result['createdAt']).to eq('2025-01-10T08:30:00Z')
      expect(result['updatedAt']).to eq('2025-01-15T10:00:00Z')
    end

    it 'falls back to entry.locale when sys[:locale] is nil' do
      entry = build_entry({ locale: 'en' }, { locale: nil })
      result = ContentfulMappers.base_fields(entry)
      expect(result['locale']).to eq('en')
    end

    it 'returns nil timestamps when sys times are nil' do
      entry = build_entry({}, { created_at: nil, updated_at: nil })
      result = ContentfulMappers.base_fields(entry)
      expect(result['createdAt']).to be_nil
      expect(result['updatedAt']).to be_nil
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

  # --- map_spot ---

  describe '.map_spot' do
    it 'maps a fully populated spot entry' do
      entry = build_entry({
        slug: 'thunersee-spiez',
        name: { 'de' => 'Thunersee Spiez', 'en' => 'Lake Thun Spiez' },
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'A launch point.' }] }] },
        location: build_location(46.6863, 7.6803),
        approximate_address: 'Seestrasse, 3700 Spiez',
        country: 'CH',
        confirmed: true,
        rejected: false,
        waterway: build_reference('thunersee'),
        spot_type: build_reference('launch-point'),
        paddling_environment_type: build_reference('lake'),
        paddle_craft_types: [build_reference('kayak'), build_reference('sup')],
        event_notices: [build_reference('notice-1')],
        obstacles: [],
        data_source_type: build_reference('community'),
        data_license_type: build_reference('cc-by-sa')
      })

      result = ContentfulMappers.map_spot(entry)

      expect(result['slug']).to eq('thunersee-spiez')
      expect(result['name']).to eq({ 'de' => 'Thunersee Spiez', 'en' => 'Lake Thun Spiez' })
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
      expect(result['locale']).to eq('de')
      expect(result['createdAt']).to eq('2025-01-10T08:30:00Z')
      expect(result['updatedAt']).to eq('2025-01-15T10:00:00Z')
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_spot(entry)

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
      entry = build_entry({
        slug: 'thunersee',
        name: { 'de' => 'Thunersee', 'en' => 'Lake Thun' },
        length: 17.5,
        area: 48.4,
        geometry: geo,
        show_in_menu: true,
        paddling_environment_type: build_reference('lake'),
        data_source_type: build_reference('official'),
        data_license_type: build_reference('cc-by-sa')
      })

      result = ContentfulMappers.map_waterway(entry)

      expect(result['slug']).to eq('thunersee')
      expect(result['name']).to eq({ 'de' => 'Thunersee', 'en' => 'Lake Thun' })
      expect(result['length']).to eq(17.5)
      expect(result['area']).to eq(48.4)
      expect(result['geometry']).to eq('{"type":"Polygon","coordinates":[[7.0,46.0]]}')
      expect(result['showInMenu']).to be true
      expect(result['paddlingEnvironmentType_slug']).to eq('lake')
      expect(result['dataSourceType_slug']).to eq('official')
      expect(result['dataLicenseType_slug']).to eq('cc-by-sa')
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_waterway(entry)

      expect(result['slug']).to eq('test-id-123')
      expect(result['geometry']).to be_nil
      expect(result['showInMenu']).to be false
    end
  end

  # --- map_obstacle ---

  describe '.map_obstacle' do
    it 'maps a fully populated obstacle entry' do
      entry = build_entry({
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
      })

      result = ContentfulMappers.map_obstacle(entry)

      expect(result['slug']).to eq('weir-munsingen')
      expect(result['name']).to eq('Wehr Münsingen')
      expect(result['description']).to eq('<p>A weir.</p>')
      expect(result['geometry']).to eq('{"type":"Point","coordinates":[7.5,46.8]}')
      expect(result['portageRoute']).to eq('{"type":"LineString","coordinates":[[7.5,46.8],[7.51,46.81]]}')
      expect(result['portageDistance']).to eq(150)
      expect(result['portageDescription']).to eq('<p>Carry left.</p>')
      expect(result['isPortageNecessary']).to be true
      expect(result['isPortagePossible']).to be true
      expect(result['obstacleType_slug']).to eq('weir')
      expect(result['waterway_slug']).to eq('aare')
      expect(result['spots']).to eq(%w[spot-1 spot-2])
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_obstacle(entry)

      expect(result['slug']).to eq('test-id-123')
      expect(result['isPortageNecessary']).to be false
      expect(result['isPortagePossible']).to be false
      expect(result['spots']).to eq([])
    end
  end

  # --- map_protected_area ---

  describe '.map_protected_area' do
    it 'maps a fully populated protected area entry' do
      entry = build_entry({
        slug: 'nature-reserve-aaredelta',
        name: 'Naturschutzgebiet Aaredelta',
        geometry: build_geometry('{"type":"Polygon","coordinates":[[7.6,46.7]]}'),
        is_area_marked: true,
        protected_area_type: build_reference('nature-reserve')
      })

      result = ContentfulMappers.map_protected_area(entry)

      expect(result['slug']).to eq('nature-reserve-aaredelta')
      expect(result['name']).to eq('Naturschutzgebiet Aaredelta')
      expect(result['geometry']).to eq('{"type":"Polygon","coordinates":[[7.6,46.7]]}')
      expect(result['isAreaMarked']).to be true
      expect(result['protectedAreaType_slug']).to eq('nature-reserve')
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_protected_area(entry)

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

      entry = build_entry({
        slug: 'flood-warning-aare',
        name: 'Hochwasserwarnung Aare',
        description: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'Flooding expected.' }] }] },
        location: build_location(46.95, 7.45),
        affected_area: build_geometry('{"type":"Polygon","coordinates":[[7.4,46.9]]}'),
        start_date: start_date,
        end_date: end_date,
        waterways: [build_reference('aare'), build_reference('thunersee')]
      })

      result = ContentfulMappers.map_event_notice(entry)

      expect(result['slug']).to eq('flood-warning-aare')
      expect(result['name']).to eq('Hochwasserwarnung Aare')
      expect(result['description']).to eq('<p>Flooding expected.</p>')
      expect(result['location']).to eq({ 'lat' => 46.95, 'lon' => 7.45 })
      expect(result['affectedArea']).to eq('{"type":"Polygon","coordinates":[[7.4,46.9]]}')
      expect(result['startDate']).to eq('2025-03-01T00:00:00Z')
      expect(result['endDate']).to eq('2025-03-31T23:59:59Z')
      expect(result['waterways']).to eq(%w[aare thunersee])
    end

    it 'handles missing fields gracefully' do
      entry = build_entry({})
      result = ContentfulMappers.map_event_notice(entry)

      expect(result['slug']).to eq('test-id-123')
      expect(result['startDate']).to be_nil
      expect(result['endDate']).to be_nil
      expect(result['waterways']).to eq([])
    end
  end

  # --- map_type ---

  describe '.map_type' do
    it 'maps a type entry with name_de and name_en' do
      entry = build_entry({
        slug: 'launch-point',
        name_de: 'Einstiegsort',
        name_en: 'Launch Point'
      })

      result = ContentfulMappers.map_type(entry)

      expect(result['slug']).to eq('launch-point')
      expect(result['name_de']).to eq('Einstiegsort')
      expect(result['name_en']).to eq('Launch Point')
    end

    it 'falls back to name field when name_de/name_en are missing' do
      entry = build_entry({ slug: 'kayak', name: 'Kayak' })

      result = ContentfulMappers.map_type(entry)

      expect(result['slug']).to eq('kayak')
      expect(result['name_de']).to eq('Kayak')
      expect(result['name_en']).to eq('Kayak')
    end

    it 'handles all fields missing' do
      entry = build_entry({})
      result = ContentfulMappers.map_type(entry)

      expect(result['slug']).to eq('test-id-123')
      expect(result['name_de']).to be_nil
      expect(result['name_en']).to be_nil
    end
  end

  # --- map_static_page ---

  describe '.map_static_page' do
    it 'maps a fully populated static page entry' do
      entry = build_entry({
        slug: 'about-us',
        title: 'Über uns',
        menu: 'Über',
        content: { 'content' => [{ 'nodeType' => 'paragraph', 'content' => [{ 'nodeType' => 'text', 'value' => 'About page content.' }] }] },
        menu_order: 2
      })

      result = ContentfulMappers.map_static_page(entry)

      expect(result['slug']).to eq('about-us')
      expect(result['title']).to eq('Über uns')
      expect(result['menu']).to eq('Über')
      expect(result['menu_slug']).to eq('ueber')
      expect(result['content']).to eq('<p>About page content.</p>')
      expect(result['menuOrder']).to eq(2)
    end

    it 'defaults menuOrder to 0 when missing' do
      entry = build_entry({ slug: 'page', title: 'Page' })
      result = ContentfulMappers.map_static_page(entry)

      expect(result['menuOrder']).to eq(0)
    end

    it 'defaults menu_slug to "seiten" when menu is nil' do
      entry = build_entry({ slug: 'page' })
      result = ContentfulMappers.map_static_page(entry)

      expect(result['menu_slug']).to eq('seiten')
    end

    it 'maps "Offene Daten" menu to "offene-daten" slug' do
      entry = build_entry({ slug: 'data', menu: 'Offene Daten' })
      result = ContentfulMappers.map_static_page(entry)

      expect(result['menu_slug']).to eq('offene-daten')
    end
  end

  # --- Nil references across mappers ---

  describe 'nil reference handling' do
    it 'map_spot handles nil single references' do
      entry = build_entry({
        slug: 'test',
        waterway: nil,
        spot_type: nil,
        paddling_environment_type: nil,
        data_source_type: nil,
        data_license_type: nil
      })
      result = ContentfulMappers.map_spot(entry)

      expect(result['waterway_slug']).to be_nil
      expect(result['spotType_slug']).to be_nil
      expect(result['paddlingEnvironmentType_slug']).to be_nil
      expect(result['dataSourceType_slug']).to be_nil
      expect(result['dataLicenseType_slug']).to be_nil
    end

    it 'map_obstacle handles nil waterway and obstacle_type references' do
      entry = build_entry({
        slug: 'test',
        waterway: nil,
        obstacle_type: nil
      })
      result = ContentfulMappers.map_obstacle(entry)

      expect(result['waterway_slug']).to be_nil
      expect(result['obstacleType_slug']).to be_nil
    end

    it 'map_protected_area handles nil protectedAreaType reference' do
      entry = build_entry({ slug: 'test', protected_area_type: nil })
      result = ContentfulMappers.map_protected_area(entry)

      expect(result['protectedAreaType_slug']).to be_nil
    end
  end
end
