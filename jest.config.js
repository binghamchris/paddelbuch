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
  verbose: true,
  // Ensure vendor assets + fonts exist before any test file runs
  globalSetup: '<rootDir>/_tests/globalSetup.js',
  // Property-based tests may need more time
  testTimeout: 30000
};
