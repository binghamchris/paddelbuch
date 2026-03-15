const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOCKERFILE_PATH = path.join(ROOT, 'infrastructure/Dockerfile');
const RUBY_VERSION_PATH = path.join(ROOT, '.ruby-version');

let dockerfileContent;
let dockerfileLines;
let rubyVersionContent;

beforeAll(() => {
  dockerfileContent = fs.readFileSync(DOCKERFILE_PATH, 'utf8');
  dockerfileLines = dockerfileContent.split('\n');
  rubyVersionContent = fs.readFileSync(RUBY_VERSION_PATH, 'utf8').trim();
});

describe('Version parity checks', () => {
  // Requirement 7.2: Ruby version in Dockerfile matches .ruby-version file
  test('Ruby version in Dockerfile matches .ruby-version file', () => {
    // .ruby-version contains "ruby-3.4.9" — extract the numeric version
    const rubyVersion = rubyVersionContent.replace(/^ruby-/, '');

    // Dockerfile downloads ruby-<version>.tar.gz
    const rubyTarMatch = dockerfileContent.match(/ruby-([\d.]+)\.tar\.gz/);
    expect(rubyTarMatch).not.toBeNull();
    expect(rubyTarMatch[1]).toBe(rubyVersion);
  });

  // Requirement 7.3: Node.js major version in Dockerfile is 22
  test('Node.js major version in Dockerfile is 22', () => {
    const nodeMatch = dockerfileContent.match(/node-v(\d+)\.\d+\.\d+-linux-x64/);
    expect(nodeMatch).not.toBeNull();
    expect(nodeMatch[1]).toBe('22');
  });

  // Requirement 7.4: Gemfile and Gemfile.lock are copied before bundle install
  test('COPY Gemfile appears before RUN bundle install', () => {
    const copyGemfileLine = dockerfileLines.findIndex(
      (line) => /^COPY\s+.*Gemfile/.test(line)
    );
    const bundleInstallLine = dockerfileLines.findIndex(
      (line) => /^RUN\s+bundle\s+install/.test(line)
    );

    expect(copyGemfileLine).toBeGreaterThanOrEqual(0);
    expect(bundleInstallLine).toBeGreaterThanOrEqual(0);
    expect(copyGemfileLine).toBeLessThan(bundleInstallLine);
  });

  // Requirement 7.5: package.json and package-lock.json are copied before npm ci
  test('COPY package.json appears before RUN npm ci', () => {
    const copyPackageLine = dockerfileLines.findIndex(
      (line) => /^COPY\s+.*package\.json/.test(line)
    );
    const npmCiLine = dockerfileLines.findIndex(
      (line) => /^RUN\s+npm\s+ci/.test(line)
    );

    expect(copyPackageLine).toBeGreaterThanOrEqual(0);
    expect(npmCiLine).toBeGreaterThanOrEqual(0);
    expect(copyPackageLine).toBeLessThan(npmCiLine);
  });
});
