/**
 * Property-Based Tests for Layout CDN-Free References
 *
 * **Feature: local-asset-bundling, Property 2: Layout contains no external CDN references**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 *
 * This test reads _layouts/default.html and verifies that:
 * 1. No href or src attribute contains any banned CDN domain
 * 2. All CSS/JS/font asset references use local relative paths
 *
 * Banned CDN domains: cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com, fonts.gstatic.com
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

// Read the layout file once for all tests
const layoutPath = path.join(__dirname, '..', '..', '_layouts', 'default.html');
const layoutSource = fs.readFileSync(layoutPath, 'utf-8');

// Banned CDN domains that must not appear in any asset reference
const BANNED_DOMAINS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Extract all href and src attribute values from the HTML source.
// Uses double-quote matching to handle Liquid template syntax with inner single quotes,
// e.g. href="{{ '/assets/css/vendor/fonts.css' | relative_url }}"
const ATTR_REGEX = /(?:href|src)="([^"]+)"/gi;
const extractedUrls = [];
let match;
while ((match = ATTR_REGEX.exec(layoutSource)) !== null) {
  extractedUrls.push(match[1]);
}

// Filter to CSS/JS/font asset references by checking for known extensions within the value
const assetUrls = extractedUrls.filter((url) =>
  /\.(css|js|woff2?|ttf|eot|otf)['"\s|}]/i.test(url)
);

describe('Layout CDN-Free References (Property 2)', () => {
  describe('No extracted URL contains any banned CDN domain', () => {
    it('should have extracted at least one URL from the layout', () => {
      expect(extractedUrls.length).toBeGreaterThan(0);
    });

    it('should not contain any banned CDN domain in any href or src attribute', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...BANNED_DOMAINS),
          (bannedDomain) => {
            for (const url of extractedUrls) {
              expect(url).not.toContain(bannedDomain);
            }
          }
        ),
        { verbose: true, numRuns: 100 }
      );
    });
  });

  describe('Arbitrary banned domain substrings do not appear in URLs', () => {
    it('should not match any generated CDN-like domain pattern in extracted URLs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...BANNED_DOMAINS),
          fc.constantFrom('https://', 'http://', '//'),
          (domain, protocol) => {
            const fullUrl = `${protocol}${domain}`;
            for (const url of extractedUrls) {
              expect(url).not.toContain(fullUrl);
            }
          }
        ),
        { verbose: true, numRuns: 100 }
      );
    });
  });

  describe('All CSS/JS asset references use local relative paths', () => {
    it('should have extracted at least one CSS or JS asset URL', () => {
      expect(assetUrls.length).toBeGreaterThan(0);
    });

    it('should reference all CSS/JS assets via local paths', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...assetUrls),
          (assetUrl) => {
            // Local paths use Liquid template syntax ({{ ... }}) or start with /assets/
            const isLocalPath =
              assetUrl.startsWith('{{') ||
              assetUrl.startsWith('/assets/') ||
              assetUrl.startsWith('assets/') ||
              assetUrl.includes('relative_url');

            const isExternalUrl =
              assetUrl.startsWith('http://') ||
              assetUrl.startsWith('https://') ||
              assetUrl.startsWith('//');

            expect(isExternalUrl).toBe(false);
            expect(isLocalPath).toBe(true);
          }
        ),
        { verbose: true, numRuns: 100 }
      );
    });
  });
});
