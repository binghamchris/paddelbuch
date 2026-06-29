/**
 * @jest-environment jsdom
 *
 * Feature: quality-and-tooling-hardening, Property 3: Geo constants agree across Ruby and JS
 * Validates: Requirements 3.1, 3.4
 *
 * The Switzerland bounds and tile-size steps have a single authoritative source
 * (_config.yml map.bounds / map.tile_size). spatial-utils.js obtains them from the
 * build-time geo-constants JSON block; tile_generator.rb reads them from site config.
 * For any in-bounds point, the JS pointToTile and the Ruby get_tile_for_point produce
 * the same tile (x, y). This test verifies the JS side against a shared reference
 * formula computed from the _config.yml constants; spec/plugins/tile_generator_geo_spec.rb
 * verifies the Ruby side against the identical formula and constants.
 */

const fs = require('fs');
const path = require('path');
const fc = require('fast-check');

const ROOT = path.resolve(__dirname, '../..');

// Read the authoritative geo constants from _config.yml (the single source of truth).
function loadConfigGeoConstants() {
  const text = fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8');
  const findNum = (re, label) => {
    const m = text.match(re);
    if (!m) throw new Error('Could not parse ' + label + ' from _config.yml');
    return parseFloat(m[1]);
  };
  // north/south/east/west occur only under map.bounds
  const bounds = {
    north: findNum(/^\s*north:\s*([0-9.]+)/m, 'bounds.north'),
    south: findNum(/^\s*south:\s*([0-9.]+)/m, 'bounds.south'),
    east: findNum(/^\s*east:\s*([0-9.]+)/m, 'bounds.east'),
    west: findNum(/^\s*west:\s*([0-9.]+)/m, 'bounds.west')
  };
  // tile_size block: lat then lon
  const tm = text.match(/tile_size:\s*\n\s*lat:\s*([0-9.]+)\s*\n\s*lon:\s*([0-9.]+)/);
  if (!tm) throw new Error('Could not parse tile_size from _config.yml');
  const tileSize = { lat: parseFloat(tm[1]), lon: parseFloat(tm[2]) };
  return { bounds, tileSize };
}

// Shared reference tile formula (identical to Ruby reference_tile in the RSpec twin).
function referenceTile(lat, lon, bounds, tileSize, gridCols, gridRows) {
  let x = Math.floor((lon - bounds.west) / tileSize.lon);
  let y = Math.floor((bounds.north - lat) / tileSize.lat);
  x = Math.max(0, Math.min(x, gridCols - 1));
  y = Math.max(0, Math.min(y, gridRows - 1));
  return { x: x, y: y };
}

let SU;
let config;
let gridCols;
let gridRows;

beforeAll(() => {
  config = loadConfigGeoConstants();
  gridCols = Math.ceil((config.bounds.east - config.bounds.west) / config.tileSize.lon);
  gridRows = Math.ceil((config.bounds.north - config.bounds.south) / config.tileSize.lat);

  // Inject the geo constants exactly as _includes/geo-constants.html would at build time.
  document.body.innerHTML =
    '<script type="application/json" id="paddelbuch-geo-constants">' +
    JSON.stringify({ bounds: config.bounds, tileSize: config.tileSize }) +
    '</script>';

  require('../../assets/js/spatial-utils.js');
  SU = window.PaddelbuchSpatialUtils;
});

describe('Property 3: Geo constants agree across Ruby and JS', () => {
  test('spatial-utils reads the authoritative geo constants from the injected JSON block', () => {
    expect(SU.SWITZERLAND_BOUNDS).toEqual(config.bounds);
    expect(SU.TILE_SIZE).toEqual(config.tileSize);
    expect(SU.GRID_COLS).toBe(gridCols);
    expect(SU.GRID_ROWS).toBe(gridRows);
  });

  test('pointToTile matches the shared reference formula for in-bounds points', () => {
    fc.assert(
      fc.property(
        fc.double({ min: config.bounds.south, max: config.bounds.north, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: config.bounds.west, max: config.bounds.east, noNaN: true, noDefaultInfinity: true }),
        (lat, lon) => {
          const tile = SU.pointToTile(lat, lon);
          const ref = referenceTile(lat, lon, config.bounds, config.tileSize, gridCols, gridRows);
          return tile !== null && tile.x === ref.x && tile.y === ref.y;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pointToTile returns null for out-of-bounds points', () => {
    expect(SU.pointToTile(config.bounds.north + 5, config.bounds.west + 1)).toBeNull();
    expect(SU.pointToTile(config.bounds.south - 5, config.bounds.west + 1)).toBeNull();
    expect(SU.pointToTile(config.bounds.south + 1, config.bounds.east + 5)).toBeNull();
  });
});
