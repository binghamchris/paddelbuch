/**
 * Jest global setup: ensure vendor assets and fonts exist before any test suite runs.
 * This prevents ordering issues when parallel test files depend on these files.
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function globalSetup() {
  const ROOT = path.resolve(__dirname, '..');
  execSync(`node scripts/copy-vendor-assets.js`, { cwd: ROOT, stdio: 'pipe' });
  execSync(`node scripts/download-google-fonts.js`, { cwd: ROOT, stdio: 'pipe' });
};
