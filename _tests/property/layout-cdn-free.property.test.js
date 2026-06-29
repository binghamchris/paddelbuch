/**
 * Property-Based Tests for Layout CDN-Free References
 *
 * **Feature: local-asset-bundling, Property 2: Layout contains no external CDN references**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 *
 * **Feature: quality-and-tooling-hardening, Property 8: CDN-free detection with allowlist**
 * **Validates: Requirements 7.6**
 *
 * This test reads _layouts/default.html and verifies that:
 * 1. No href or src attribute contains any banned CDN domain (original Property 2).
 * 2. Every href/src reference is either a local path or a host on an explicit
 *    allowlist; any other external host fails (Property 8). This broadened check
 *    inspects ALL host-bearing URLs, including query-string forms such as
 *    "min.js?events&beacon" that an extension-only filter would skip.
 *
 * Banned CDN domains: cdn.jsdelivr.net, unpkg.com, fonts.googleapis.com, fonts.gstatic.com
 * Allowlisted external hosts: tinylytics.app (analytics, permitted by the deployed CSP).
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

// External hosts that are intentionally permitted. The deployed Content Security
// Policy allows https://tinylytics.app for analytics (script-src + connect-src),
// so a reference to that exact host is allowed; every other external host is not.
const ALLOWED_EXTERNAL_HOSTS = ['tinylytics.app'];

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

/**
 * Return the external host of a reference, or null when the reference is local
 * (a relative path or a Liquid-templated value that resolves to a site-local URL).
 *
 * Handles both scheme-qualified URLs (http://host, https://host) and
 * protocol-relative URLs (//host). A single leading slash ("/assets/...") is a
 * local absolute path and yields null.
 */
function externalHostOf(rawUrl) {
  const url = String(rawUrl).trim();
  let m = url.match(/^https?:\/\/([^/?#]+)/i);
  if (m) {
    return m[1].toLowerCase();
  }
  m = url.match(/^\/\/([^/?#]+)/);
  if (m) {
    return m[1].toLowerCase();
  }
  return null;
}

function isAllowedHost(host) {
  return ALLOWED_EXTERNAL_HOSTS.indexOf(host) !== -1;
}

/**
 * Classify a single href/src reference as one of:
 *   - 'local'       : no external host (relative path or templated site-local URL)
 *   - 'allowlisted' : an external host that is on ALLOWED_EXTERNAL_HOSTS
 *   - 'external'    : any other external host (disallowed)
 */
function classifyReference(rawUrl) {
  const host = externalHostOf(rawUrl);
  if (host === null) {
    return { kind: 'local', host: null };
  }
  return { kind: isAllowedHost(host) ? 'allowlisted' : 'external', host: host };
}

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

describe('CDN-Free Detection with Host Allowlist (Property 8)', () => {
  describe('Real layout host inspection', () => {
    it('classifies every href/src reference as local or allowlisted (no disallowed external host)', () => {
      const disallowed = extractedUrls
        .map((url) => ({ url, ...classifyReference(url) }))
        .filter((ref) => ref.kind === 'external');

      expect(disallowed).toEqual([]);
    });

    it('detects the intentional analytics reference and classifies it allowlisted (including the .js?query form)', () => {
      // The broadened detector must see host-bearing URLs that an extension-only
      // filter would miss, e.g. "https://tinylytics.app/.../min.js?events&beacon".
      const externalRefs = extractedUrls
        .map((url) => ({ url, ...classifyReference(url) }))
        .filter((ref) => ref.host !== null);

      // The only external host present today is the allowlisted analytics host.
      expect(externalRefs.length).toBeGreaterThan(0);
      for (const ref of externalRefs) {
        expect(ref.kind).toBe('allowlisted');
        expect(ALLOWED_EXTERNAL_HOSTS).toContain(ref.host);
      }

      // Confirm at least one detected reference carries a query string, proving
      // the detector no longer depends on a trailing-extension match.
      expect(externalRefs.some((ref) => ref.url.includes('?'))).toBe(true);
    });
  });

  describe('Local and allowlisted references are accepted', () => {
    it('never classifies a local path or an allowlisted host as a disallowed external', () => {
      const localPaths = fc.constantFrom(
        '/assets/css/application.css',
        '/assets/js/vendor/leaflet.js',
        'assets/js/spatial-utils.js',
        '/assets/images/logo-favicon.svg',
        "{{ '/assets/css/application.css' | relative_url }}",
        '{{ site.url }}{{ page.url }}',
        '#main-content'
      );

      const allowlistedUrls = fc
        .tuple(
          fc.constantFrom('https://', 'http://', '//'),
          fc.constantFrom(...ALLOWED_EXTERNAL_HOSTS),
          fc.constantFrom(
            '/embed/DWSnjEu6fgk9s2Yu2H4a/min.js?events&beacon',
            '/min.js?events',
            '/embed/x.js',
            '/style.css',
            '/'
          )
        )
        .map(([protocol, host, suffix]) => `${protocol}${host}${suffix}`);

      fc.assert(
        fc.property(fc.oneof(localPaths, allowlistedUrls), (url) => {
          expect(classifyReference(url).kind).not.toBe('external');
        }),
        { verbose: true, numRuns: 100 }
      );
    });
  });

  describe('Any other external host is rejected', () => {
    it('classifies every non-allowlisted external host as a disallowed external', () => {
      const otherHost = fc.domain().filter((d) => {
        const host = d.toLowerCase();
        return !isAllowedHost(host);
      });

      fc.assert(
        fc.property(
          otherHost,
          fc.constantFrom('https://', 'http://', '//'),
          fc.constantFrom('/lib.js', '/style.css?v=1', '/font.woff2', '/main.js?cache=1', '/'),
          (host, protocol, suffix) => {
            const url = `${protocol}${host}${suffix}`;
            const result = classifyReference(url);
            expect(result.kind).toBe('external');
            expect(result.host).toBe(host.toLowerCase());
          }
        ),
        { verbose: true, numRuns: 100 }
      );
    });

    it('rejects the known banned CDN domains via the allowlist classifier', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...BANNED_DOMAINS),
          fc.constantFrom('https://', 'http://', '//'),
          (host, protocol) => {
            const result = classifyReference(`${protocol}${host}/some-lib.min.js?v=1`);
            expect(result.kind).toBe('external');
          }
        ),
        { verbose: true, numRuns: 100 }
      );
    });
  });
});
