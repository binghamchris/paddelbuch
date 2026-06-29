/**
 * Jest Configuration / Coverage Gate
 *
 * **Feature: quality-and-tooling-hardening, Property 7: Coverage threshold enforcement**
 * **Validates: Requirements 6.3, 6.4**
 *
 * A coverageThreshold floor is configured, so `npm test -- --coverage` exits non-zero
 * when measured coverage drops below it and exits zero at or above it. This unit test
 * asserts the gate is present and well-formed (positive percentages for every metric).
 */

const config = require('../../jest.config.js');

describe('Property 7: Coverage threshold enforcement', () => {
  test('jest config defines a coverageThreshold.global floor', () => {
    expect(config).toHaveProperty('coverageThreshold');
    expect(config.coverageThreshold).toHaveProperty('global');
  });

  test('every coverage metric has a positive percentage floor', () => {
    const global = config.coverageThreshold.global;
    ['statements', 'branches', 'functions', 'lines'].forEach((metric) => {
      expect(typeof global[metric]).toBe('number');
      expect(global[metric]).toBeGreaterThan(0);
      expect(global[metric]).toBeLessThanOrEqual(100);
    });
  });

  test('coverage is collected from first-party browser JavaScript', () => {
    expect(Array.isArray(config.collectCoverageFrom)).toBe(true);
    expect(config.collectCoverageFrom).toContain('assets/js/**/*.js');
  });
});
