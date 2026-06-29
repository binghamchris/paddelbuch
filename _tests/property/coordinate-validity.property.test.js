/**
 * Property-Based Tests for Coordinate Validity
 *
 * **Feature: quality-and-tooling-hardening, Property 9: Coordinate validity**
 * **Validates: Requirements 8.4**
 *
 * For any marker coordinate, the validity check shall treat a finite number
 * (including exactly 0) as present, and shall reject null, undefined, NaN and
 * Infinity (and any non-number type). Out-of-bounds coordinates are a separate
 * concern (detected/logged, never used to reject a value here).
 */

const fc = require('fast-check');

// spatial-utils.js attaches its API to `this` (module.exports in Node CJS).
const mod = require('../../assets/js/spatial-utils.js');
const PaddelbuchSpatialUtils = mod.PaddelbuchSpatialUtils || mod || global.PaddelbuchSpatialUtils;

const { isValidCoordinate, hasValidCoordinates } = PaddelbuchSpatialUtils;

describe('Property 9: Coordinate validity', () => {
  // Finite numbers (including 0 and negatives)
  const finiteNumberArb = fc.oneof(
    fc.integer({ min: -1000000, max: 1000000 }),
    fc.double({ min: -1000000, max: 1000000, noNaN: true, noDefaultInfinity: true })
  );

  // Non-finite / non-number values that must always be rejected
  const invalidArb = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity),
    fc.string(),
    fc.boolean(),
    fc.object(),
    fc.array(fc.integer())
  );

  it('treats any finite number (including 0) as a valid coordinate', () => {
    fc.assert(
      fc.property(finiteNumberArb, (value) => {
        return isValidCoordinate(value) === true;
      }),
      { numRuns: 100 }
    );
  });

  it('treats exactly 0 (and -0) as present', () => {
    expect(isValidCoordinate(0)).toBe(true);
    expect(isValidCoordinate(-0)).toBe(true);
    expect(hasValidCoordinates(0, 0)).toBe(true);
  });

  it('rejects null, undefined, NaN, Infinity and -Infinity', () => {
    [null, undefined, NaN, Infinity, -Infinity].forEach((v) => {
      expect(isValidCoordinate(v)).toBe(false);
    });
  });

  it('rejects any non-number type', () => {
    fc.assert(
      fc.property(invalidArb, (value) => {
        return isValidCoordinate(value) === false;
      }),
      { numRuns: 100 }
    );
  });

  it('hasValidCoordinates: a 0 lat or lon with the other finite is treated as present', () => {
    fc.assert(
      fc.property(finiteNumberArb, (other) => {
        return hasValidCoordinates(0, other) === true &&
               hasValidCoordinates(other, 0) === true;
      }),
      { numRuns: 100 }
    );
  });

  it('hasValidCoordinates: rejects the pair when either value is invalid', () => {
    fc.assert(
      fc.property(finiteNumberArb, invalidArb, (valid, bad) => {
        return hasValidCoordinates(valid, bad) === false &&
               hasValidCoordinates(bad, valid) === false;
      }),
      { numRuns: 100 }
    );
  });
});
