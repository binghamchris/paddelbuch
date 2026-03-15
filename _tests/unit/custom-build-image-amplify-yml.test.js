const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '../..');
const AMPLIFY_YML_PATH = path.join(ROOT, 'amplify.yml');

let config;
let preBuildCommands;
let buildCommands;

beforeAll(() => {
  const raw = fs.readFileSync(AMPLIFY_YML_PATH, 'utf8');
  config = yaml.load(raw);
  preBuildCommands = config.frontend.phases.preBuild.commands;
  buildCommands = config.frontend.phases.build.commands;
});

describe('Simplified amplify.yml', () => {
  // Requirement 5.1: No RVM commands in preBuild
  test('preBuild contains no rvm commands', () => {
    const rvmCommands = preBuildCommands.filter((cmd) => /\brvm\b/.test(cmd));
    expect(rvmCommands).toEqual([]);
  });

  // Requirement 5.2: No NVM commands in preBuild
  test('preBuild contains no nvm commands', () => {
    const nvmCommands = preBuildCommands.filter((cmd) => /\bnvm\b/.test(cmd));
    expect(nvmCommands).toEqual([]);
  });

  // Requirement 5.3: npm ci present in preBuild
  test('preBuild includes npm ci', () => {
    const hasNpmCi = preBuildCommands.some((cmd) => cmd.includes('npm ci'));
    expect(hasNpmCi).toBe(true);
  });

  // Requirement 5.4: bundle install present in preBuild
  test('preBuild includes bundle install', () => {
    const hasBundleInstall = preBuildCommands.some((cmd) => cmd.includes('bundle install'));
    expect(hasBundleInstall).toBe(true);
  });

  // Requirement 5.5: download-fonts and copy-assets present in preBuild
  test('preBuild includes npm run download-fonts', () => {
    const has = preBuildCommands.some((cmd) => cmd.includes('npm run download-fonts'));
    expect(has).toBe(true);
  });

  test('preBuild includes npm run copy-assets', () => {
    const has = preBuildCommands.some((cmd) => cmd.includes('npm run copy-assets'));
    expect(has).toBe(true);
  });

  // Requirement 5.6: build commands present
  test('build includes bundle exec rake build:site', () => {
    const has = buildCommands.some((cmd) => cmd.includes('bundle exec rake build:site'));
    expect(has).toBe(true);
  });

  test('build includes npm test', () => {
    const has = buildCommands.some((cmd) => cmd.includes('npm test'));
    expect(has).toBe(true);
  });

  // Requirement 5.7: artifacts and cache preserved
  test('artifacts baseDirectory is _site', () => {
    expect(config.frontend.artifacts.baseDirectory).toBe('_site');
  });

  test('cache paths are preserved', () => {
    const cachePaths = config.frontend.cache.paths;
    expect(cachePaths).toContain('vendor/**/*');
    expect(cachePaths).toContain('node_modules/**/*');
    expect(cachePaths).toContain('_data/**/*');
    expect(cachePaths).toContain('.jekyll-cache/**/*');
  });
});
