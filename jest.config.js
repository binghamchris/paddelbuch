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
    'jekyll-assets/js/**/*.js',
    '_plugins/**/*.rb',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Property-based tests may need more time
  testTimeout: 30000
};
