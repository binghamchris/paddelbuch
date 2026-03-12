# frozen_string_literal: true

# Property-based and unit tests for TileGenerator spatial logic methods
# **Validates: Requirements 2.11**

require 'spec_helper'
require 'json'

RSpec.describe Jekyll::TileGenerator, 'spatial logic' do
  let(:generator) { described_class.new }

  # Constants mirrored from TileGenerator
  NORTH = 47.8
  SOUTH = 45.8
  EAST  = 10.5
  WEST  = 5.9
  TILE_LAT = 0.25
  TILE_LON = 0.46
  GRID_COLS = ((EAST - WEST) / TILE_LON).ceil   # 10
  GRID_ROWS = ((NORTH - SOUTH) / TILE_LAT).ceil # 8

  before do
    # Set instance variables needed by spatial methods
    generator.instance_variable_set(:@grid_cols, GRID_COLS)
    generator.instance_variable_set(:@grid_rows, GRID_ROWS)
  end

  # ── 1. get_tile_bounds — Property-based ────────────────────────────
  describe '#get_tile_bounds' do
    it 'computes correct bounds for any valid tile coordinate' do
      property_of {
        x = range(0, GRID_COLS - 1)
        y = range(0, GRID_ROWS - 1)
        [x, y]
      }.check(100) { |x, y|
        bounds = generator.send(:get_tile_bounds, x, y)

        expected_north = NORTH - (y * TILE_LAT)
        expected_south = NORTH - ((y + 1) * TILE_LAT)
        expected_east  = WEST + ((x + 1) * TILE_LON)
        expected_west  = WEST + (x * TILE_LON)

        expect(bounds['north']).to be_within(1e-10).of(expected_north)
        expect(bounds['south']).to be_within(1e-10).of(expected_south)
        expect(bounds['east']).to be_within(1e-10).of(expected_east)
        expect(bounds['west']).to be_within(1e-10).of(expected_west)

        expect(bounds['north']).to be > bounds['south'],
          "north (#{bounds['north']}) must be > south (#{bounds['south']}) for tile [#{x},#{y}]"
        expect(bounds['east']).to be > bounds['west'],
          "east (#{bounds['east']}) must be > west (#{bounds['west']}) for tile [#{x},#{y}]"
      }
    end
  end

  # ── 2. get_tile_for_point — Property-based ─────────────────────────
  describe '#get_tile_for_point' do
    it 'returns valid tile coords whose bounds contain the original point for points inside Switzerland' do
      property_of {
        # Generate random lat/lon strictly inside Switzerland bounds
        lat = SOUTH + (range(1, 1998) / 1000.0)  # 45.801..47.798
        lon = WEST + (range(1, 4598) / 1000.0)    # 5.901..10.498
        [lat, lon]
      }.check(100) { |lat, lon|
        item = { 'location' => { 'lat' => lat, 'lon' => lon } }
        result = generator.send(:get_tile_for_point, item)

        expect(result).not_to be_nil, "Expected tile coords for point (#{lat}, #{lon})"
        x, y = result

        expect(x).to be_between(0, GRID_COLS - 1)
        expect(y).to be_between(0, GRID_ROWS - 1)

        # Verify the tile's bounds contain the original point
        bounds = generator.send(:get_tile_bounds, x, y)
        expect(lat).to be <= bounds['north']
        expect(lat).to be >= bounds['south']
        expect(lon).to be <= bounds['east']
        expect(lon).to be >= bounds['west']
      }
    end

    it 'returns nil for points outside Switzerland bounds' do
      property_of {
        # Generate points clearly outside Switzerland
        quadrant = choose(:north, :south, :east, :west_side)
        case quadrant
        when :north
          lat = NORTH + (range(1, 500) / 100.0)
          lon = WEST + (range(0, 460) / 100.0)
        when :south
          lat = SOUTH - (range(1, 500) / 100.0)
          lon = WEST + (range(0, 460) / 100.0)
        when :east
          lat = SOUTH + (range(0, 200) / 100.0)
          lon = EAST + (range(1, 500) / 100.0)
        when :west_side
          lat = SOUTH + (range(0, 200) / 100.0)
          lon = WEST - (range(1, 500) / 100.0)
        end
        [lat, lon]
      }.check(40) { |lat, lon|
        item = { 'location' => { 'lat' => lat, 'lon' => lon } }
        result = generator.send(:get_tile_for_point, item)
        expect(result).to be_nil, "Expected nil for out-of-bounds point (#{lat}, #{lon})"
      }
    end

    it 'returns nil when location is missing' do
      expect(generator.send(:get_tile_for_point, {})).to be_nil
      expect(generator.send(:get_tile_for_point, { 'location' => nil })).to be_nil
      expect(generator.send(:get_tile_for_point, { 'location' => {} })).to be_nil
    end
  end

  # ── 3. point_in_bounds? — Unit tests ───────────────────────────────
  describe '#point_in_bounds?' do
    it 'returns true for points inside Switzerland' do
      expect(generator.send(:point_in_bounds?, 47.0, 8.0)).to be true
      expect(generator.send(:point_in_bounds?, 46.5, 7.5)).to be true
    end

    it 'returns true for boundary points (exactly on edges)' do
      expect(generator.send(:point_in_bounds?, NORTH, EAST)).to be true
      expect(generator.send(:point_in_bounds?, SOUTH, WEST)).to be true
      expect(generator.send(:point_in_bounds?, NORTH, WEST)).to be true
      expect(generator.send(:point_in_bounds?, SOUTH, EAST)).to be true
    end

    it 'returns false for points outside Switzerland' do
      expect(generator.send(:point_in_bounds?, 48.0, 8.0)).to be false   # north of bounds
      expect(generator.send(:point_in_bounds?, 45.0, 8.0)).to be false   # south of bounds
      expect(generator.send(:point_in_bounds?, 47.0, 11.0)).to be false  # east of bounds
      expect(generator.send(:point_in_bounds?, 47.0, 5.0)).to be false   # west of bounds
    end
  end

  # ── 4. calculate_centroid — Unit tests ─────────────────────────────
  describe '#calculate_centroid' do
    it 'returns the point itself for a Point geometry' do
      geojson = { 'type' => 'Point', 'coordinates' => [8.0, 47.0] }
      result = generator.send(:calculate_centroid, geojson)
      expect(result).to eq([47.0, 8.0])
    end

    it 'returns average of all coordinates for a LineString' do
      geojson = {
        'type' => 'LineString',
        'coordinates' => [[7.0, 46.0], [9.0, 48.0]]
      }
      result = generator.send(:calculate_centroid, geojson)
      expect(result[0]).to be_within(1e-10).of(47.0) # avg lat
      expect(result[1]).to be_within(1e-10).of(8.0)   # avg lon
    end

    it 'returns average of all ring coordinates for a Polygon' do
      geojson = {
        'type' => 'Polygon',
        'coordinates' => [
          [[7.0, 46.0], [9.0, 46.0], [9.0, 48.0], [7.0, 48.0], [7.0, 46.0]]
        ]
      }
      result = generator.send(:calculate_centroid, geojson)
      # lats: [46,46,48,48,46] → avg=46.8, lons: [7,9,9,7,7] → avg=7.8
      expect(result[0]).to be_within(1e-10).of(46.8)
      expect(result[1]).to be_within(1e-10).of(7.8)
    end

    it 'returns average across all polygons for a MultiPolygon' do
      geojson = {
        'type' => 'MultiPolygon',
        'coordinates' => [
          [[[6.0, 46.0], [8.0, 46.0], [8.0, 48.0], [6.0, 48.0]]],
          [[[8.0, 46.0], [10.0, 46.0], [10.0, 48.0], [8.0, 48.0]]]
        ]
      }
      result = generator.send(:calculate_centroid, geojson)
      # All 8 coords: lons=[6,8,8,6,8,10,10,8]=64/8=8.0, lats=[46,46,48,48,46,46,48,48]=376/8=47.0
      expect(result[0]).to be_within(1e-10).of(47.0)
      expect(result[1]).to be_within(1e-10).of(8.0)
    end

    it 'returns average across all sub-geometries for a GeometryCollection' do
      geojson = {
        'type' => 'GeometryCollection',
        'geometries' => [
          { 'type' => 'Point', 'coordinates' => [7.0, 46.0] },
          { 'type' => 'Point', 'coordinates' => [9.0, 48.0] }
        ]
      }
      result = generator.send(:calculate_centroid, geojson)
      expect(result[0]).to be_within(1e-10).of(47.0)
      expect(result[1]).to be_within(1e-10).of(8.0)
    end

    it 'returns nil for nil geometry' do
      result = generator.send(:calculate_centroid, { 'type' => nil, 'coordinates' => nil })
      expect(result).to be_nil
    end

    it 'returns nil for empty coordinates' do
      result = generator.send(:calculate_centroid, { 'type' => 'LineString', 'coordinates' => [] })
      expect(result).to be_nil
    end
  end

  # ── 5. extract_coordinates — Unit tests ────────────────────────────
  describe '#extract_coordinates' do
    it 'extracts coordinates from a Point' do
      geojson = { 'type' => 'Point', 'coordinates' => [8.0, 47.0] }
      expect(generator.send(:extract_coordinates, geojson)).to eq([[8.0, 47.0]])
    end

    it 'extracts coordinates from a LineString' do
      coords = [[7.0, 46.0], [8.0, 47.0], [9.0, 48.0]]
      geojson = { 'type' => 'LineString', 'coordinates' => coords }
      expect(generator.send(:extract_coordinates, geojson)).to eq(coords)
    end

    it 'extracts coordinates from a Polygon' do
      ring = [[7.0, 46.0], [9.0, 46.0], [9.0, 48.0], [7.0, 48.0], [7.0, 46.0]]
      geojson = { 'type' => 'Polygon', 'coordinates' => [ring] }
      expect(generator.send(:extract_coordinates, geojson)).to eq(ring)
    end

    it 'extracts coordinates from a MultiPoint' do
      coords = [[7.0, 46.0], [8.0, 47.0]]
      geojson = { 'type' => 'MultiPoint', 'coordinates' => coords }
      expect(generator.send(:extract_coordinates, geojson)).to eq(coords)
    end

    it 'extracts coordinates from a MultiLineString' do
      geojson = {
        'type' => 'MultiLineString',
        'coordinates' => [
          [[7.0, 46.0], [8.0, 47.0]],
          [[9.0, 48.0], [10.0, 47.0]]
        ]
      }
      result = generator.send(:extract_coordinates, geojson)
      expect(result).to eq([[7.0, 46.0], [8.0, 47.0], [9.0, 48.0], [10.0, 47.0]])
    end

    it 'extracts coordinates from a MultiPolygon' do
      geojson = {
        'type' => 'MultiPolygon',
        'coordinates' => [
          [[[6.0, 46.0], [8.0, 46.0], [8.0, 48.0]]],
          [[[8.0, 46.0], [10.0, 46.0], [10.0, 48.0]]]
        ]
      }
      result = generator.send(:extract_coordinates, geojson)
      expect(result).to eq([[6.0, 46.0], [8.0, 46.0], [8.0, 48.0], [8.0, 46.0], [10.0, 46.0], [10.0, 48.0]])
    end

    it 'extracts coordinates from a GeometryCollection' do
      geojson = {
        'type' => 'GeometryCollection',
        'geometries' => [
          { 'type' => 'Point', 'coordinates' => [7.0, 46.0] },
          { 'type' => 'LineString', 'coordinates' => [[8.0, 47.0], [9.0, 48.0]] }
        ]
      }
      result = generator.send(:extract_coordinates, geojson)
      expect(result).to eq([[7.0, 46.0], [8.0, 47.0], [9.0, 48.0]])
    end

    it 'extracts coordinates from a Feature' do
      geojson = {
        'type' => 'Feature',
        'geometry' => { 'type' => 'Point', 'coordinates' => [8.0, 47.0] }
      }
      expect(generator.send(:extract_coordinates, geojson)).to eq([[8.0, 47.0]])
    end

    it 'extracts coordinates from a FeatureCollection' do
      geojson = {
        'type' => 'FeatureCollection',
        'features' => [
          { 'type' => 'Feature', 'geometry' => { 'type' => 'Point', 'coordinates' => [7.0, 46.0] } },
          { 'type' => 'Feature', 'geometry' => { 'type' => 'Point', 'coordinates' => [9.0, 48.0] } }
        ]
      }
      result = generator.send(:extract_coordinates, geojson)
      expect(result).to eq([[7.0, 46.0], [9.0, 48.0]])
    end
  end

  # ── 6. get_data_for_locale — Unit tests ────────────────────────────
  describe '#get_data_for_locale' do
    let(:site) do
      s = double('Jekyll::Site')
      allow(s).to receive(:data).and_return(site_data)
      s
    end
    let(:site_data) { {} }

    before do
      generator.instance_variable_set(:@site, site)
      generator.instance_variable_set(:@locale_cache, {})
    end

    it 'filters array data by locale field' do
      site_data['spots'] = [
        { 'name' => 'Spot A', 'locale' => 'de' },
        { 'name' => 'Spot B', 'locale' => 'en' },
        { 'name' => 'Spot C', 'locale' => 'de' }
      ]
      result = generator.send(:get_data_for_locale, 'spots', 'de')
      expect(result.size).to eq(2)
      expect(result.map { |s| s['name'] }).to contain_exactly('Spot A', 'Spot C')
    end

    it 'filters array data by node_locale field' do
      site_data['notices'] = [
        { 'name' => 'Notice A', 'node_locale' => 'de' },
        { 'name' => 'Notice B', 'node_locale' => 'en' }
      ]
      result = generator.send(:get_data_for_locale, 'notices', 'en')
      expect(result.size).to eq(1)
      expect(result.first['name']).to eq('Notice B')
    end

    it 'returns hash sub-key for hash data' do
      site_data['protected_areas'] = {
        'de' => [{ 'name' => 'Area DE' }],
        'en' => [{ 'name' => 'Area EN' }]
      }
      result = generator.send(:get_data_for_locale, 'protected_areas', 'de')
      expect(result).to eq([{ 'name' => 'Area DE' }])
    end

    it 'returns empty array for missing hash locale' do
      site_data['protected_areas'] = { 'de' => [{ 'name' => 'Area DE' }] }
      result = generator.send(:get_data_for_locale, 'protected_areas', 'fr')
      expect(result).to eq([])
    end

    it 'caches results — second call returns same object' do
      site_data['spots'] = [
        { 'name' => 'Spot A', 'locale' => 'de' }
      ]
      first_call = generator.send(:get_data_for_locale, 'spots', 'de')
      second_call = generator.send(:get_data_for_locale, 'spots', 'de')
      expect(first_call).to equal(second_call) # same object identity
    end
  end
end
