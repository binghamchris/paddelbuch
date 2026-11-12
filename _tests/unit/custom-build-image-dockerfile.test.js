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

  // Requirement 2.2: Ruby compiled from source (version parity with
  // .ruby-version is checked in custom-build-image-version-parity.test.js)
  test('downloads ruby-4.0.9.tar.gz source archive', () => {
    expect(dockerfile).toMatch(/ruby\/4\.0\/ruby-4\.0\.9\.tar\.gz/);
  });

  test('configures Ruby with --disable-install-doc', () => {
    expect(dockerfile).toMatch(/\.\/configure\s+--disable-install-doc/);
  });

  test('compiles Ruby with make', () => {
    expect(dockerfile).toMatch(/make\s+-j/);
    expect(dockerfile).toMatch(/make\s+install/);
  });

  // Requirement 2.3: Node.js 26 binary installation
  test('installs Node.js 26 from official binary archive', () => {
    expect(dockerfile).toMatch(/node-v26\.\d+\.\d+-linux-x64/);
  });

  // Node.js 25+ official Linux binaries need the libatomic runtime; without it
  // `node` fails to start ("libatomic.so.1: cannot open shared object file").
  test('installs libatomic for the Node.js binary', () => {
    expect(dockerfile).toMatch(/dnf install[\s\S]*\blibatomic\b[\s\S]*dnf clean all/);
  });

  // amplify.yml exports LANG/LC_ALL=en_US.UTF-8; the base image only ships
  // C.utf8, so without this Ruby's default external encoding is US-ASCII.
  test('installs the en_US.UTF-8 locale', () => {
    expect(dockerfile).toMatch(/dnf install[\s\S]*\bglibc-langpack-en\b[\s\S]*dnf clean all/);
  });

  test('the Node.js major matches package.json engines', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const major = dockerfile.match(/node-v(\d+)\.\d+\.\d+-linux-x64/)[1];
    expect(pkg.engines.node).toBe(`>=${major}`);
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
