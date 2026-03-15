const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(ROOT, 'infrastructure/build-and-push.sh');

let scriptContent;

beforeAll(() => {
  scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
});

describe('build-and-push.sh script', () => {
  // Requirement 3.1: Script uses strict error handling
  test('uses set -euo pipefail for strict error handling', () => {
    expect(scriptContent).toMatch(/^set -euo pipefail$/m);
  });

  // Requirement 3.1: Uses paddelbuch-dev AWS profile
  test('uses paddelbuch-dev AWS profile', () => {
    expect(scriptContent).toMatch(/PROFILE=paddelbuch-dev/);
  });

  // Requirement 3.1: Targets eu-central-1 region
  test('targets eu-central-1 region', () => {
    expect(scriptContent).toMatch(/REGION=eu-central-1/);
  });

  // Requirement 3.2: Contains docker build command
  test('contains docker build command', () => {
    expect(scriptContent).toMatch(/docker build\b/);
  });

  // Requirement 3.3: Contains docker tag command
  test('contains docker tag command', () => {
    expect(scriptContent).toMatch(/docker tag\b/);
  });

  // Requirement 3.4: Contains docker push command
  test('contains docker push command', () => {
    expect(scriptContent).toMatch(/docker push\b/);
  });

  // Requirement 3.3: Tags with latest
  test('tags image with latest', () => {
    expect(scriptContent).toMatch(/:latest/);
  });

  // Requirement 3.3: Tags with timestamp format YYYYMMDDHHmmss
  test('generates timestamp tag using date +%Y%m%d%H%M%S', () => {
    expect(scriptContent).toMatch(/date \+%Y%m%d%H%M%S/);
  });
});
