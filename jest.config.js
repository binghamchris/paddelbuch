/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/_tests'],
  testMatch: [
    '**/*.test.js',
    '**/*.property.test.js'
  ],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'assets/js/**/*.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  // Coverage floor (Requirements 6.3, 6.4). Set a few points below the measured
  // coverage so the gate ratchets without forcing an otherwise-passing build to fail;
  // `npm test -- --coverage` exits non-zero if coverage drops below these values.
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 60,
      functions: 75,
      lines: 75
    }
  },
  verbose: true,
  // Ensure vendor assets + fonts exist before any test file runs
  globalSetup: '<rootDir>/_tests/globalSetup.js',
  // Property-based tests may need more time
  testTimeout: 30000
};
