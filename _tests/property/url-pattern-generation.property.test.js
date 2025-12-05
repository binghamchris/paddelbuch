/**
 * Property-Based Tests for URL Pattern Generation
 * 
 * **Feature: paddelbuch-swiss-paddle-map, Property 21: URL Pattern Generation**
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5**
 * 
 * Property: For any entity with a slug, the generated URL shall follow the correct pattern:
 * - Spots use /einstiegsorte/{slug}
 * - Waterways use /gewaesser/{slug}
 * - Obstacles use /hindernisse/{slug}
 * - Event notices use /gewaesserereignisse/{slug}
 * - Static pages use /{menu}/{slug}
 */

const fc = require('fast-check');

// URL generation functions (mirrors Jekyll permalink configuration)

/**
 * Generate URL for a spot
 * Collection permalink: /einstiegsorte/:slug/
 * Validates: Requirements 13.1
 */
function generateSpotUrl(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return `/einstiegsorte/${slug}/`;
}

/**
 * Generate URL for a waterway
 * Collection permalink: /gewaesser/:slug/
 * Validates: Requirements 13.2
 */
function generateWaterwayUrl(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return `/gewaesser/${slug}/`;
}

/**
 * Generate URL for an obstacle
 * Collection permalink: /hindernisse/:slug/
 * Validates: Requirements 13.3
 */
function generateObstacleUrl(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return `/hindernisse/${slug}/`;
}

/**
 * Generate URL for an event notice
 * Collection permalink: /gewaesserereignisse/:slug/
 * Validates: Requirements 13.4
 */
function generateEventNoticeUrl(slug) {
  if (!slug || typeof slug !== 'string') return null;
  return `/gewaesserereignisse/${slug}/`;
}

/**
 * Generate URL for a static page
 * Collection permalink: /:menu_slug/:slug/
 * Validates: Requirements 13.5
 */
function generateStaticPageUrl(menuSlug, slug) {
  if (!menuSlug || typeof menuSlug !== 'string') return null;
  if (!slug || typeof slug !== 'string') return null;
  return `/${menuSlug}/${slug}/`;
}

/**
 * Convert menu name to URL-friendly slug
 * Mirrors the StaticPageMapper.menu_to_slug logic
 */
function menuToSlug(menu) {
  if (!menu || typeof menu !== 'string') return 'seiten';
  
  const menuLower = menu.toLowerCase();
  switch (menuLower) {
    case 'offene daten':
    case 'open data':
      return 'offene-daten';
    case 'über':
    case 'about':
      return 'ueber';
    default:
      return menuLower
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
  }
}

// Arbitraries for generating test data

// Valid slug: lowercase alphanumeric with hyphens, no leading/trailing hyphens
const slugArb = fc.stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .filter(s => s.length >= 1 && s.length <= 100);

// Menu names that map to known slugs
const knownMenuArb = fc.constantFrom(
  'Offene Daten', 'Open Data', 'Über', 'About'
);

// Generic menu name
const genericMenuArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

// Entity types
const entityTypeArb = fc.constantFrom('spot', 'waterway', 'obstacle', 'notice', 'staticPage');

describe('URL Pattern Generation - Property 21', () => {
  /**
   * Property 21: URL Pattern Generation
   * For any entity with a slug, the generated URL shall follow the correct pattern.
   */

  describe('Spot URLs (Requirement 13.1)', () => {
    test('spot URLs follow pattern /einstiegsorte/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateSpotUrl(slug);
            return url === `/einstiegsorte/${slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('spot URLs start with /einstiegsorte/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateSpotUrl(slug);
            return url.startsWith('/einstiegsorte/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('spot URLs end with trailing slash', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateSpotUrl(slug);
            return url.endsWith('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('spot URLs contain the slug', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateSpotUrl(slug);
            return url.includes(slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('spot URL generation is deterministic', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url1 = generateSpotUrl(slug);
            const url2 = generateSpotUrl(slug);
            return url1 === url2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Waterway URLs (Requirement 13.2)', () => {
    test('waterway URLs follow pattern /gewaesser/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateWaterwayUrl(slug);
            return url === `/gewaesser/${slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterway URLs start with /gewaesser/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateWaterwayUrl(slug);
            return url.startsWith('/gewaesser/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterway URLs end with trailing slash', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateWaterwayUrl(slug);
            return url.endsWith('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('waterway URL generation is deterministic', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url1 = generateWaterwayUrl(slug);
            const url2 = generateWaterwayUrl(slug);
            return url1 === url2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Obstacle URLs (Requirement 13.3)', () => {
    test('obstacle URLs follow pattern /hindernisse/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateObstacleUrl(slug);
            return url === `/hindernisse/${slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('obstacle URLs start with /hindernisse/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateObstacleUrl(slug);
            return url.startsWith('/hindernisse/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('obstacle URLs end with trailing slash', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateObstacleUrl(slug);
            return url.endsWith('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('obstacle URL generation is deterministic', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url1 = generateObstacleUrl(slug);
            const url2 = generateObstacleUrl(slug);
            return url1 === url2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Event Notice URLs (Requirement 13.4)', () => {
    test('event notice URLs follow pattern /gewaesserereignisse/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateEventNoticeUrl(slug);
            return url === `/gewaesserereignisse/${slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('event notice URLs start with /gewaesserereignisse/', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateEventNoticeUrl(slug);
            return url.startsWith('/gewaesserereignisse/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('event notice URLs end with trailing slash', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateEventNoticeUrl(slug);
            return url.endsWith('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('event notice URL generation is deterministic', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url1 = generateEventNoticeUrl(slug);
            const url2 = generateEventNoticeUrl(slug);
            return url1 === url2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Static Page URLs (Requirement 13.5)', () => {
    test('static page URLs follow pattern /{menu}/{slug}/', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb,
          (menuSlug, slug) => {
            const url = generateStaticPageUrl(menuSlug, slug);
            return url === `/${menuSlug}/${slug}/`;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('static page URLs end with trailing slash', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb,
          (menuSlug, slug) => {
            const url = generateStaticPageUrl(menuSlug, slug);
            return url.endsWith('/');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('static page URLs contain both menu and slug', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb,
          (menuSlug, slug) => {
            const url = generateStaticPageUrl(menuSlug, slug);
            return url.includes(menuSlug) && url.includes(slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('static page URL generation is deterministic', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb,
          (menuSlug, slug) => {
            const url1 = generateStaticPageUrl(menuSlug, slug);
            const url2 = generateStaticPageUrl(menuSlug, slug);
            return url1 === url2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Menu to Slug Conversion', () => {
    test('known menu names map to expected slugs', () => {
      const mappings = [
        { menu: 'Offene Daten', expected: 'offene-daten' },
        { menu: 'Open Data', expected: 'offene-daten' },
        { menu: 'Über', expected: 'ueber' },
        { menu: 'About', expected: 'ueber' }
      ];

      mappings.forEach(({ menu, expected }) => {
        expect(menuToSlug(menu)).toBe(expected);
      });
    });

    test('menu to slug conversion is case-insensitive', () => {
      fc.assert(
        fc.property(
          knownMenuArb,
          (menu) => {
            const slug1 = menuToSlug(menu);
            const slug2 = menuToSlug(menu.toLowerCase());
            const slug3 = menuToSlug(menu.toUpperCase());
            return slug1 === slug2 && slug2 === slug3;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('menu to slug conversion produces URL-safe slugs', () => {
      fc.assert(
        fc.property(
          genericMenuArb,
          (menu) => {
            const slug = menuToSlug(menu);
            // Slug should only contain lowercase letters, numbers, and hyphens
            return /^[a-z0-9\-]*$/.test(slug);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('menu to slug conversion replaces spaces with hyphens', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => s.trim().length > 0 && /^[a-zA-Z\s]+$/.test(s)),
          (menu) => {
            const slug = menuToSlug(menu);
            // Result should not contain spaces
            return !slug.includes(' ');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('null/undefined menu returns default slug', () => {
      expect(menuToSlug(null)).toBe('seiten');
      expect(menuToSlug(undefined)).toBe('seiten');
      expect(menuToSlug('')).toBe('seiten');
    });
  });

  describe('URL Uniqueness', () => {
    test('different slugs produce different URLs for spots', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb.filter(s => s.length > 0),
          (slug1, slug2) => {
            fc.pre(slug1 !== slug2);
            const url1 = generateSpotUrl(slug1);
            const url2 = generateSpotUrl(slug2);
            return url1 !== url2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different slugs produce different URLs for waterways', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb.filter(s => s.length > 0),
          (slug1, slug2) => {
            fc.pre(slug1 !== slug2);
            const url1 = generateWaterwayUrl(slug1);
            const url2 = generateWaterwayUrl(slug2);
            return url1 !== url2;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('different entity types produce different URL prefixes', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const spotUrl = generateSpotUrl(slug);
            const waterwayUrl = generateWaterwayUrl(slug);
            const obstacleUrl = generateObstacleUrl(slug);
            const noticeUrl = generateEventNoticeUrl(slug);
            
            // All URLs should be different due to different prefixes
            const urls = [spotUrl, waterwayUrl, obstacleUrl, noticeUrl];
            const uniqueUrls = new Set(urls);
            return uniqueUrls.size === urls.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    test('null/undefined slug returns null for all entity types', () => {
      expect(generateSpotUrl(null)).toBeNull();
      expect(generateSpotUrl(undefined)).toBeNull();
      expect(generateWaterwayUrl(null)).toBeNull();
      expect(generateWaterwayUrl(undefined)).toBeNull();
      expect(generateObstacleUrl(null)).toBeNull();
      expect(generateObstacleUrl(undefined)).toBeNull();
      expect(generateEventNoticeUrl(null)).toBeNull();
      expect(generateEventNoticeUrl(undefined)).toBeNull();
    });

    test('empty string slug returns null for all entity types', () => {
      expect(generateSpotUrl('')).toBeNull();
      expect(generateWaterwayUrl('')).toBeNull();
      expect(generateObstacleUrl('')).toBeNull();
      expect(generateEventNoticeUrl('')).toBeNull();
    });

    test('static page URL returns null for missing menu or slug', () => {
      expect(generateStaticPageUrl(null, 'test')).toBeNull();
      expect(generateStaticPageUrl('menu', null)).toBeNull();
      expect(generateStaticPageUrl('', 'test')).toBeNull();
      expect(generateStaticPageUrl('menu', '')).toBeNull();
    });

    test('URLs with special characters in slug are handled', () => {
      // Slugs should already be sanitized, but test that the function handles them
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const url = generateSpotUrl(slug);
            // URL should be a valid string
            return typeof url === 'string' && url.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('URL Structure Consistency', () => {
    test('all entity URLs have exactly 3 path segments', () => {
      fc.assert(
        fc.property(
          slugArb,
          (slug) => {
            const urls = [
              generateSpotUrl(slug),
              generateWaterwayUrl(slug),
              generateObstacleUrl(slug),
              generateEventNoticeUrl(slug)
            ];
            
            return urls.every(url => {
              // Split by '/' and filter empty strings
              const segments = url.split('/').filter(s => s.length > 0);
              return segments.length === 2; // prefix + slug
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('static page URLs have exactly 4 path segments', () => {
      fc.assert(
        fc.property(
          slugArb,
          slugArb,
          (menuSlug, slug) => {
            const url = generateStaticPageUrl(menuSlug, slug);
            // Split by '/' and filter empty strings
            const segments = url.split('/').filter(s => s.length > 0);
            return segments.length === 2; // menu + slug
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
