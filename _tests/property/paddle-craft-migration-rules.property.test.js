/**
 * Property-Based Tests: Paddle craft type migration rule
 *
 * These tests model the pure additive migration rule implemented in Ruby at
 * `scripts/add_paddle_craft_type_references.rb` (the `PaddleCraftTypeMigration`
 * module: `LEGACY_TO_NEW`, `additions_for`, `apply`). The JS model below MUST
 * mirror the Ruby logic EXACTLY so the same algorithm is exercised on both
 * sides (as noted in the design's Testing Strategy).
 *
 * The migration is:
 *   - Additive: `apply(existing)` is always a superset of `existing`.
 *   - Rule-driven: a new slug is added only when a mapped legacy slug is present.
 *   - Duplicate-safe: a target new slug already present is never added again.
 *   - Idempotent: `apply(apply(x)) == apply(x)`.
 *
 * The model helpers are defined at top-level so subsequent tasks (8.4 Property 10,
 * 8.5 Property 11) can append additional `describe`/`it` blocks to THIS file that
 * reuse `LEGACY_TO_NEW`, `additionsFor`, and `applyMigration`.
 */

const fc = require('fast-check');

// ---------------------------------------------------------------------------
// Pure migration model (mirrors PaddleCraftTypeMigration in the Ruby script)
// ---------------------------------------------------------------------------

// Ordered mapping from each legacy craft-type slug to the new craft-type slug
// that should be added when the legacy slug is present on a spot.
// Insertion order matches the Ruby `LEGACY_TO_NEW` hash exactly.
const LEGACY_TO_NEW = {
  'kanadier': 'hardshell',
  'seekajak': 'hardshell',
  'stand-up-paddle-board': 'klappbar-und-aufblasbar'
};

// The two new craft-type slugs (targets of the migration).
const NEW_SLUGS = ['hardshell', 'klappbar-und-aufblasbar'];

// Legacy slugs that trigger an addition.
const LEGACY_SLUGS = Object.keys(LEGACY_TO_NEW);

/**
 * Given a spot's current craft-type slugs, return the ordered list of new slugs
 * to add. Mirrors Ruby `PaddleCraftTypeMigration.additions_for`:
 *   - a mapping is triggered only when its legacy slug is present (6.2, 6.3)
 *   - a target new slug already present is skipped (no duplicate) (6.6)
 *   - a target new slug is added at most once per run (dedupe)
 *   - when no legacy slug matches, the result is empty (no-op) (6.5)
 */
function additionsFor(existingSlugs) {
  const existing = Array.from(existingSlugs);
  const adds = [];
  for (const legacy of Object.keys(LEGACY_TO_NEW)) {
    const newSlug = LEGACY_TO_NEW[legacy];
    if (!existing.includes(legacy)) continue;   // triggers only on legacy match
    if (existing.includes(newSlug)) continue;   // Requirement 6.6 - no duplicate
    if (adds.includes(newSlug)) continue;       // dedupe within a single run
    adds.push(newSlug);
  }
  return adds;
}

/**
 * Return the applied result: the existing slugs plus any additions. Mirrors Ruby
 * `PaddleCraftTypeMigration.apply` (`existing + additions_for(existing)`), so the
 * result is always a superset of the existing references (additive - 6.4).
 */
function applyMigration(existingSlugs) {
  const existing = Array.from(existingSlugs);
  return existing.concat(additionsFor(existing));
}

// ---------------------------------------------------------------------------
// Generators: random arrays of craft-type slugs mixing legacy, new, and
// unrelated slugs (in any order, with possible repeats).
// ---------------------------------------------------------------------------

// An "unrelated" slug that is neither a legacy nor a new craft-type slug.
const unrelatedSlugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,14}$/)
  .filter(function (s) {
    return LEGACY_SLUGS.indexOf(s) === -1 && NEW_SLUGS.indexOf(s) === -1;
  });

// A single slug drawn from legacy, new, or unrelated pools.
const anySlugArb = fc.oneof(
  fc.constantFrom.apply(fc, LEGACY_SLUGS),
  fc.constantFrom.apply(fc, NEW_SLUGS),
  unrelatedSlugArb
);

// A random array of craft-type slugs (possibly empty, possibly with repeats).
const existingSlugsArb = fc.array(anySlugArb, { minLength: 0, maxLength: 10 });

describe('Paddle craft migration - Property 9: rule-correct and additive', function () {
  // Feature: paddlecraft-types-change, Property 9: Migration is rule-correct and additive
  // Validates: Requirements 6.2, 6.3, 6.4
  it('apply() adds new slugs per legacy rule and retains every existing slug', function () {
    fc.assert(
      fc.property(existingSlugsArb, function (existing) {
        const result = applyMigration(existing);

        // (a) result contains `hardshell` iff the existing set contains
        //     `kanadier` or `seekajak` (relative to additions) -- i.e. it is
        //     present because it was already there or a legacy trigger added it.
        const expectHardshell =
          existing.includes('hardshell') ||
          existing.includes('kanadier') ||
          existing.includes('seekajak');
        if (result.includes('hardshell') !== expectHardshell) {
          return false;
        }

        // (b) result contains `klappbar-und-aufblasbar` if the existing set
        //     contains `stand-up-paddle-board` (and, symmetrically, exactly when
        //     it was already present or the SUP trigger added it).
        const expectKlappbar =
          existing.includes('klappbar-und-aufblasbar') ||
          existing.includes('stand-up-paddle-board');
        if (result.includes('klappbar-und-aufblasbar') !== expectKlappbar) {
          return false;
        }

        // (c) result is a SUPERSET of existing -- every existing slug is retained.
        for (const slug of existing) {
          if (!result.includes(slug)) {
            return false;
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Paddle craft migration - Property 10: no-op without legacy matches and never duplicates', function () {
  // Feature: paddlecraft-types-change, Property 10: Migration is a no-op without legacy matches and never duplicates
  // Validates: Requirements 6.5, 6.6

  // Boundary generator (a): slug sets containing NONE of the legacy trigger
  // slugs (only new slugs and/or unrelated slugs, possibly empty, with repeats).
  const noLegacySlugsArb = fc.array(
    fc.oneof(fc.constantFrom.apply(fc, NEW_SLUGS), unrelatedSlugArb),
    { minLength: 0, maxLength: 10 }
  );

  it('apply() is a no-op (returns the existing set unchanged) when no legacy slug is present', function () {
    fc.assert(
      fc.property(noLegacySlugsArb, function (existing) {
        // No legacy trigger => additions_for is empty => result equals existing.
        const result = applyMigration(existing);
        return (
          result.length === existing.length &&
          result.every(function (slug, i) {
            return slug === existing[i];
          })
        );
      }),
      { numRuns: 100 }
    );
  });

  // Boundary generator (b): sets where a legacy trigger AND its target new slug
  // are BOTH already present, mixed with arbitrary other slugs (any order/repeats).
  const legacyWithTargetPresentArb = fc
    .constantFrom.apply(fc, LEGACY_SLUGS)
    .chain(function (legacy) {
      const target = LEGACY_TO_NEW[legacy];
      return fc
        .array(anySlugArb, { minLength: 0, maxLength: 8 })
        .map(function (others) {
          // Ensure both the legacy trigger and its target new slug are present.
          return { target: target, existing: others.concat([legacy, target]) };
        });
    });

  it('apply() never adds a duplicate when the target new slug is already present', function () {
    fc.assert(
      fc.property(legacyWithTargetPresentArb, function (scenario) {
        const target = scenario.target;
        const existing = scenario.existing;
        const result = applyMigration(existing);

        const countIn = function (arr) {
          return arr.filter(function (slug) {
            return slug === target;
          }).length;
        };

        // The count of the target new slug must be unchanged (no duplicate added),
        // and the result must still retain every existing slug (superset).
        return (
          countIn(result) === countIn(existing) &&
          existing.every(function (slug) {
            return result.includes(slug);
          })
        );
      }),
      { numRuns: 100 }
    );
  });
});

describe('Paddle craft migration - Property 11: migration is idempotent', function () {
  // Feature: paddlecraft-types-change, Property 11: Migration is idempotent
  // Validates: Requirements 6.7
  it('apply(apply(x)) deep-equals apply(x) over random existing slug sets', function () {
    fc.assert(
      fc.property(existingSlugsArb, function (existing) {
        const once = applyMigration(existing);
        const twice = applyMigration(once);

        // A second run over an already-migrated set must produce the identical
        // ordered result (dedupe against existing references => no-op re-run).
        return (
          twice.length === once.length &&
          twice.every(function (slug, i) {
            return slug === once[i];
          })
        );
      }),
      { numRuns: 100 }
    );
  });
});

module.exports = {
  LEGACY_TO_NEW,
  NEW_SLUGS,
  LEGACY_SLUGS,
  additionsFor,
  applyMigration,
  unrelatedSlugArb,
  anySlugArb,
  existingSlugsArb
};
