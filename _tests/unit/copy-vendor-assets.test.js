const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/copy-vendor-assets.js');

const EXPECTED_FILES = [
  'assets/js/vendor/bootstrap.bundle.min.js',
  'assets/js/vendor/leaflet.js',
  'assets/js/vendor/L.Control.Locate.min.js',
  'assets/css/vendor/leaflet.css',
  'assets/css/vendor/L.Control.Locate.min.css',
];

const EXPECTED_DIRS = [
  'assets/js/vendor',
  'assets/css/vendor',
  'assets/css/vendor/images',
];

const LEAFLET_IMAGES = [
  'assets/css/vendor/images/layers-2x.png',
  'assets/css/vendor/images/layers.png',
  'assets/css/vendor/images/marker-icon-2x.png',
  'assets/css/vendor/images/marker-icon.png',
  'assets/css/vendor/images/marker-shadow.png',
];

function cleanVendorDirs() {
  for (const dir of ['assets/js/vendor', 'assets/css/vendor']) {
    const full = path.join(ROOT, dir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

describe('copy-vendor-assets.js', () => {
  beforeAll(() => {
    // Global setup already ensures vendor dirs exist; just re-run the script
    // to verify it works (idempotent copy).
    execSync(`node ${SCRIPT}`, { cwd: ROOT, stdio: 'pipe' });
  });

  afterAll(() => {
    // Restore vendor assets and fonts.css so downstream test suites find them
    execSync(`node ${SCRIPT}`, { cwd: ROOT, stdio: 'pipe' });
    execSync(`node ${path.join(ROOT, 'scripts/download-google-fonts.js')}`, { cwd: ROOT, stdio: 'pipe' });
  });

  describe('destination directories', () => {
    test.each(EXPECTED_DIRS)('creates %s', (dir) => {
      const full = path.join(ROOT, dir);
      expect(fs.existsSync(full)).toBe(true);
      expect(fs.statSync(full).isDirectory()).toBe(true);
    });
  });

  describe('file copies', () => {
    test.each(EXPECTED_FILES)('copies %s to correct destination', (dest) => {
      const full = path.join(ROOT, dest);
      expect(fs.existsSync(full)).toBe(true);
      expect(fs.statSync(full).size).toBeGreaterThan(0);
    });

    test.each(LEAFLET_IMAGES)('copies leaflet image %s', (dest) => {
      const full = path.join(ROOT, dest);
      expect(fs.existsSync(full)).toBe(true);
      expect(fs.statSync(full).size).toBeGreaterThan(0);
    });

    test('copied files match their source content', () => {
      const pairs = [
        ['node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', 'assets/js/vendor/bootstrap.bundle.min.js'],
        ['node_modules/leaflet/dist/leaflet.js', 'assets/js/vendor/leaflet.js'],
        ['node_modules/leaflet/dist/leaflet.css', 'assets/css/vendor/leaflet.css'],
      ];
      for (const [src, dest] of pairs) {
        const srcBuf = fs.readFileSync(path.join(ROOT, src));
        const destBuf = fs.readFileSync(path.join(ROOT, dest));
        expect(srcBuf.equals(destBuf)).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    test('exits with non-zero code when a source file is missing', () => {
      // Temporarily rename a source file to simulate it being missing.
      // We do NOT call cleanVendorDirs() here to avoid destroying files
      // that parallel test suites depend on.
      const target = path.join(ROOT, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js');
      const backup = target + '.bak';

      fs.renameSync(target, backup);

      try {
        expect(() => {
          execSync(`node ${SCRIPT}`, { cwd: ROOT, stdio: 'pipe' });
        }).toThrow();
      } finally {
        fs.renameSync(backup, target);
        // Re-run the copy script to ensure vendor dirs are fully intact
        execSync(`node ${SCRIPT}`, { cwd: ROOT, stdio: 'pipe' });
      }
    });
  });
});
