/**
 * @jest-environment jsdom
 */

/**
 * Requirement 3, generalised: no 2xx payload shape may cause markers to be hidden
 * except a genuine array of zero results.
 *
 * This is the assertion that would catch a future "helpful" coercion of the
 * response body. The specific bug it generalises: parseResults used to accept
 * anything with a numeric `length`, so `{}`, a string, or an error object all
 * produced zero slugs -- indistinguishable from a real empty result, which made
 * the caller apply the no-match sentinel and hide every marker. A backend fault
 * presented as "no spots match your search".
 */

const fc = require('fast-check');
const path = require('path');

const MODULE_PATH = path.join(__dirname, '..', '..', 'assets', 'js', 'semantic-search.js');

function loadModule() {
  let mod;
  jest.isolateModules(() => {
    mod = require(MODULE_PATH);
  });
  return mod || window.PaddelbuchSemanticSearch;
}

describe('parseResults payload robustness', () => {
  let search;

  beforeEach(() => {
    document.body.innerHTML = '';
    search = loadModule();
  });

  test('any non-array payload is rejected rather than read as an empty result', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(0),
          fc.constant(''),
          fc.boolean(),
          fc.integer(),
          fc.double({ noNaN: false }),
          fc.string(),
          fc.object(),
          fc.dictionary(fc.string(), fc.string()),
          // The shapes that used to slip through: non-arrays carrying a numeric
          // `length`, which is exactly what the old duck-type check accepted.
          fc.record({ length: fc.nat() }),
          fc.constant({ length: 0 }),
          fc.constant({ message: 'Forbidden' }),
          fc.constant({ results: [] })
        ),
        (payload) => {
          expect(() => search._parseResults(payload)).toThrow();
        }
      ),
      { numRuns: 300 }
    );
  });

  test('a genuine array is accepted, whatever it contains', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.object(),
            fc.record({ slug: fc.string({ minLength: 1 }) }),
            fc.record({
              slug: fc.string({ minLength: 1 }),
              location: fc.record({ lat: fc.double(), lon: fc.double() })
            })
          ),
          { maxLength: 30 }
        ),
        (payload) => {
          expect(() => search._parseResults(payload)).not.toThrow();
        }
      ),
      { numRuns: 300 }
    );
  });

  test('only entries with a usable slug become selection keys', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant(null),
            fc.constant({}),
            fc.record({ slug: fc.constant('') }),
            fc.record({ slug: fc.string({ minLength: 1 }) })
          ),
          { maxLength: 40 }
        ),
        (payload) => {
          const parsed = search._parseResults(payload);
          const expected = payload.filter((e) => e && e.slug).length;
          expect(parsed.slugs.length).toBe(expected);
          parsed.slugs.forEach((s) => expect(typeof s).toBe('string'));
        }
      ),
      { numRuns: 300 }
    );
  });

  test('only finite coordinate pairs are kept, so bounds cannot be poisoned', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            slug: fc.string({ minLength: 1 }),
            location: fc.oneof(
              fc.constant(null),
              fc.constant({}),
              fc.record({ lat: fc.constant(NaN), lon: fc.constant(0) }),
              fc.record({ lat: fc.constant(Infinity), lon: fc.constant(0) }),
              fc.record({ lat: fc.constant('46.1'), lon: fc.constant('7.1') }),
              fc.record({ lat: fc.double({ noNaN: true, noDefaultInfinity: true }),
                lon: fc.double({ noNaN: true, noDefaultInfinity: true }) })
            )
          }),
          { maxLength: 30 }
        ),
        (payload) => {
          const parsed = search._parseResults(payload);
          parsed.locations.forEach((loc) => {
            expect(Number.isFinite(loc.lat)).toBe(true);
            expect(Number.isFinite(loc.lon)).toBe(true);
          });
        }
      ),
      { numRuns: 300 }
    );
  });

  test('an empty array stays a valid successful result, not a failure', () => {
    // The distinction the whole requirement rests on: [] means "nothing matched"
    // and must keep working, while a non-array means "the backend misbehaved".
    expect(() => search._parseResults([])).not.toThrow();
    expect(search._parseResults([])).toEqual({ slugs: [], locations: [] });
  });
});
