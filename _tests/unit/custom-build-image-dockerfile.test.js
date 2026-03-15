const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOCKERFILE_PATH = path.join(ROOT, 'infrastructure/Dockerfile');

let dockerfile;

beforeAll(() => {
  dockerfile = fs.readFileSync(DOCKERFILE_PATH, 'utf8');
});

describe('Dockerfile structure', () => {
  // Requirement 2.1: Amazon Linux 2023 base image
  test('uses amazonlinux:2023 as base image', () => {
    expect(dockerfile).toMatch(/^FROM\s+amazonlinux:2023/m);
  });

  // Requirement 2.2: Ruby 3.4.9 compiled from source
  test('downloads ruby-3.4.9.tar.gz source archive', () => {
    expect(dockerfile).toMatch(/ruby-3\.4\.9\.tar\.gz/);
  });

  test('configures Ruby with --disable-install-doc', () => {
    expect(dockerfile).toMatch(/\.\/configure\s+--disable-install-doc/);
  });

  test('compiles Ruby with make', () => {
    expect(dockerfile).toMatch(/make\s+-j/);
    expect(dockerfile).toMatch(/make\s+install/);
  });

  // Requirement 2.3: Node.js 22 binary installation
  test('installs Node.js 22 from official binary archive', () => {
    expect(dockerfile).toMatch(/node-v22\.\d+\.\d+-linux-x64/);
  });

  // Requirement 2.4: COPYs Gemfile and Gemfile.lock
  test('copies Gemfile and Gemfile.lock', () => {
    expect(dockerfile).toMatch(/COPY\s+Gemfile\s+Gemfile\.lock/);
  });

  // Requirement 2.5: COPYs package.json and package-lock.json
  test('copies package.json and package-lock.json', () => {
    expect(dockerfile).toMatch(/COPY\s+package\.json\s+package-lock\.json/);
  });

  // Requirement 2.4: Runs bundle install
  test('runs bundle install', () => {
    expect(dockerfile).toMatch(/bundle\s+install/);
  });

  // Requirement 2.5: Runs npm ci
  test('runs npm ci', () => {
    expect(dockerfile).toMatch(/npm\s+ci/);
  });

  // Requirement 2.6: Sets PATH environment variable
  test('sets PATH environment variable', () => {
    expect(dockerfile).toMatch(/ENV\s+PATH=/);
  });
});
