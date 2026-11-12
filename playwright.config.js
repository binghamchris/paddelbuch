// Playwright config for the local-only browser layout tests (`npm run test:browser`).
//
// These tests are NOT part of `npm test` or the Amplify build: they need a
// built site in _site/ and a Playwright browser on this machine
// (`npx playwright install --only-shell chromium`, once per Playwright version).
//
// Pages are served straight from _site/ through request interception, so no
// web server runs, and every request to another origin is answered empty, so
// a run sends nothing to Tinylytics, the tile servers or anywhere else.
//
// PW_NO_SANDBOX=1 launches Chromium without its own sandbox. Only use it in an
// environment where the sandboxed browser cannot start (some agent sandboxes).

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './_tests/browser',
  testMatch: '**/*.browser.spec.js',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results/playwright',
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    launchOptions: process.env.PW_NO_SANDBOX === '1'
      ? { chromiumSandbox: false, args: ['--disable-gpu'] }
      : {}
  },
  projects: [{ name: 'chromium' }]
});
