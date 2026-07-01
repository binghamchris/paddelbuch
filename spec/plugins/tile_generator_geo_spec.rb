# frozen_string_literal: true

require 'spec_helper'
require 'yaml'

# Feature: quality-and-tooling-hardening, Property 3: Geo constants agree across Ruby and JS
# Validates: Requirements 3.1, 3.4
#
# The Tile_Generator derives its Switzerland bounds and tile-size from the single
# authoritative source (_config.yml map.bounds / map.tile_size). For any in-bounds point,
# get_tile_for_point must equal the shared reference tile formula computed from those same
# constants -- the identical formula used by the browser Spatial_Utils_Module
# (assets/js/spatial-utils.js #pointToTile, exercised by the fast-check twin
# _tests/property/geo-constants-parity.property.test.js), so the two languages agree.
RSpec.describe 'TileGenerator geo-constant agreement (Property 3)' do
  # Shared reference tile formula (identical to referenceTile() in the JS twin).
  def reference_tile(lat, lon, bounds, tile_size, grid_cols, grid_rows)
    x = ((lon - bounds[:west]) / tile_size[:lon]).floor
    y = ((bounds[:north] - lat) / tile_size[:lat]).floor
    x = [[x, 0].max, grid_cols - 1].min
    y = [[y, 0].max, grid_rows - 1].min
    [x, y]
  end

  let(:config_path) { File.expand_path('../../_config.yml', __dir__) }
  let(:config) { YAML.safe_load_file(config_path) }
  let(:site) { Struct.new(:config).new(config) }
  let(:generator) { Jekyll::TileGenerator.new }
  let(:bounds) { generator.send(:resolve_bounds, site) }
  let(:tile_size) { generator.send(:resolve_tile_size, site) }
  let(:grid_cols) { ((bounds[:east] - bounds[:west]) / tile_size[:lon]).ceil }
  let(:grid_rows) { ((bounds[:north] - bounds[:south]) / tile_size[:lat]).ceil }

  before do
    generator.instance_variable_set(:@bounds, bounds)
    generator.instance_variable_set(:@tile_size, tile_size)
    generator.instance_variable_set(:@grid_cols, grid_cols)
    generator.instance_variable_set(:@grid_rows, grid_rows)
  end

  it 'sources bounds and tile size from the _config.yml map block (single source of truth)' do
    expect(config.dig('map', 'bounds')).to include('north', 'south', 'east', 'west')
    expect(config.dig('map', 'tile_size')).to include('lat', 'lon')

    expect(bounds).to eq(
      north: config['map']['bounds']['north'].to_f,
      south: config['map']['bounds']['south'].to_f,
      east: config['map']['bounds']['east'].to_f,
      west: config['map']['bounds']['west'].to_f
    )
    expect(tile_size).to eq(
      lat: config['map']['tile_size']['lat'].to_f,
      lon: config['map']['tile_size']['lon'].to_f
    )
  end

  it 'Property 3: get_tile_for_point matches the shared reference formula for in-bounds points' do
    property_of {
      Rantly {
        lat_frac = range(0, 1_000_000) / 1_000_000.0
        lon_frac = range(0, 1_000_000) / 1_000_000.0
        [lat_frac, lon_frac]
      }
    }.check(100) do |(lat_frac, lon_frac)|
      lat = bounds[:south] + (lat_frac * (bounds[:north] - bounds[:south]))
      lon = bounds[:west] + (lon_frac * (bounds[:east] - bounds[:west]))
      item = { 'location' => { 'lat' => lat, 'lon' => lon } }

      result = generator.send(:get_tile_for_point, item)
      expected = reference_tile(lat, lon, bounds, tile_size, grid_cols, grid_rows)

      expect(result).to eq(expected)
    end
  end
end
