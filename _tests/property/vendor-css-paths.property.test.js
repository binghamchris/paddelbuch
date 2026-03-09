/**
 * Property-Based Tests for Vendor CSS Path Validity
 *
 * **Feature: local-asset-bundling, Property 1: Vendor CSS path validity**
 * **Validates: Requirements 3.5, 5.5**
 *
 * For any url() reference in any vendor CSS file (leaflet.css, L.Control.Locate.min.css,
 * fonts.css), the referenced path SHALL resolve to an existing file relative to the CSS
 * file's location in the assets directory.
 *
 * - data: URIs are filtered out (inline, no file resolution needed)
 * - VML behavior references like url(#default#VML) are filtered out (IE-specific, not file paths)
 * - sourceMappingURL comments are filtered out (not asset references)
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

const VENDOR_CSS_DIR = path.join(__dirname, '..', '..', 'assets', 'css', 'vendor');

const CSS_FILES = ['leaflet.css', 'L.Control.Locate.min.css', 'fonts.css'];

// Extract all url() values from CSS content, filtering out non-file references
function extractFileUrls(cssContent) {
  const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  const urls = [];
  let match;
  while ((match = urlRegex.exec(cssContent)) !== null) {
    const url = match[1].trim();
    // Skip data: URIs (inline content)
    if (url.startsWith('data:')) continue;
    // Skip VML behavior references (IE-specific, e.g. #default#VML)
    if (url.startsWith('#')) continue;
    urls.push(url);
  }
  return urls;
}

// Build a list of { cssFile, url, resolvedPath } for all file-referencing url() values
const allUrlEntries = [];

for (const cssFile of CSS_FILES) {
  const cssPath = path.join(VENDOR_CSS_DIR, cssFile);
  if (!fs.existsSync(cssPath)) continue;
  const content = fs.readFileSync(cssPath, 'utf-8');
  const urls = extractFileUrls(content);
  for (const url of urls) {
    const resolvedPath = path.resolve(VENDOR_CSS_DIR, url);
    allUrlEntries.push({ cssFile, url, resolvedPath });
  }
}

describe('Vendor CSS Path Validity (Property 1)', () => {
  it('should have extracted at least one file URL from vendor CSS files', () => {
    expect(allUrlEntries.length).toBeGreaterThan(0);
  });

  it('every url() file reference in vendor CSS resolves to an existing file', () => {
    // Direct assertion: ALL extracted file URLs must resolve
    for (const entry of allUrlEntries) {
      const exists = fs.existsSync(entry.resolvedPath);
      if (!exists) {
        fail(`${entry.cssFile}: url("${entry.url}") -> ${entry.resolvedPath} does not exist`);
      }
    }
  });

  it('arbitrary selections from extracted URLs all resolve to existing files', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allUrlEntries),
        (entry) => {
          const exists = fs.existsSync(entry.resolvedPath);
          if (!exists) {
            throw new Error(
              `${entry.cssFile}: url("${entry.url}") resolved to ${entry.resolvedPath} which does not exist`
            );
          }
        }
      ),
      { verbose: true, numRuns: 100 }
    );
  });

  it('should cover all three vendor CSS files', () => {
    const filesWithUrls = new Set(allUrlEntries.map((e) => e.cssFile));
    // leaflet.css has image references, fonts.css has font references
    // L.Control.Locate.min.css only has data: URIs so it may not appear
    expect(filesWithUrls.has('leaflet.css')).toBe(true);
    expect(filesWithUrls.has('fonts.css')).toBe(true);
  });
});
