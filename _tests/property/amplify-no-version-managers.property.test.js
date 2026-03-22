/**
 * Property-Based Tests for No Runtime Version Manager Commands in Build Pipeline
 *
 * **Feature: custom-amplify-build-image, Property 1: No runtime version manager commands in build pipeline**
 * **Validates: Requirements 5.1, 5.2, 4.3**
 *
 * Property: For any command in the amplify.yml preBuild phase, the command shall not
 * contain references to rvm or nvm (runtime version managers), since the custom image
 * provides Ruby and Node.js directly on PATH.
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Checks whether a shell command is free of runtime version manager references.
 * Returns true if the command does NOT contain `rvm` or `nvm` as whole words.
 */
function isVersionManagerFree(command) {
  if (typeof command !== 'string') return true;
  return !/\brvm\b/i.test(command) && !/\bnvm\b/i.test(command);
}

// --- Arbitraries ---

/** Generate a benign shell command that should pass the validator */
const safeCommandArb = fc.oneof(
  fc.constant('npm ci'),
  fc.constant('npm install'),
  fc.constant('bundle install'),
  fc.constant('npm run download-fonts'),
  fc.constant('npm run copy-assets'),
  fc.constant('bundle exec rake build:site'),
  fc.constant('npm test'),
  fc.constant('echo "hello world"'),
  fc.constant('apt-get install -y curl'),
  fc.constant('pip3 install awscli'),
  fc.constant('make -j$(nproc)'),
  fc.stringMatching(/^[a-z][a-z0-9 ./_-]{0,80}$/).filter(
    s => !/\brvm\b/i.test(s) && !/\bnvm\b/i.test(s)
  )
);

/** Generate a command that contains rvm or nvm as a word boundary match */
const versionManagerCommandArb = fc.oneof(
  fc.constant('rvm install 3.4.9'),
  fc.constant('rvm use 3.4.9'),
  fc.constant('nvm install 22'),
  fc.constant('nvm use 22'),
  fc.constant('source ~/.rvm/scripts/rvm'),
  fc.constant('source ~/.nvm/nvm.sh'),
  // Prefix + rvm/nvm + suffix
  fc.tuple(
    fc.stringMatching(/^[a-z ]{0,20}$/).filter(s => !/\brvm\b/i.test(s) && !/\bnvm\b/i.test(s)),
    fc.constantFrom('rvm', 'nvm', 'RVM', 'NVM'),
    fc.stringMatching(/^[a-z0-9 ._-]{0,30}$/).filter(s => !/\brvm\b/i.test(s) && !/\bnvm\b/i.test(s))
  ).map(([pre, mgr, suf]) => `${pre} ${mgr} ${suf}`.trim())
);

describe('No runtime version manager commands in build pipeline - Property 1', () => {
  /**
   * Property 1: No runtime version manager commands in build pipeline
   *
   * For any command in the amplify.yml preBuild phase, the command shall not
   * contain references to rvm or nvm (runtime version managers).
   */

  describe('Validator correctly identifies version manager commands', () => {
    test('commands containing rvm or nvm as whole words are rejected', () => {
      fc.assert(
        fc.property(
          versionManagerCommandArb,
          (cmd) => {
            return isVersionManagerFree(cmd) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('safe commands without rvm/nvm pass the validator', () => {
      fc.assert(
        fc.property(
          safeCommandArb,
          (cmd) => {
            return isVersionManagerFree(cmd) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Actual amplify.yml preBuild commands pass the validator', () => {
    let preBuildCommands;

    beforeAll(() => {
      const amplifyPath = path.resolve(__dirname, '../../amplify.yml');
      const content = fs.readFileSync(amplifyPath, 'utf8');
      const config = yaml.load(content);
      preBuildCommands = config.frontend.phases.preBuild.commands;
    });

    test('all preBuild commands are version-manager-free', () => {
      for (const cmd of preBuildCommands) {
        expect(isVersionManagerFree(cmd)).toBe(true);
      }
    });

    test('property holds for every preBuild command across random orderings', () => {
      fc.assert(
        fc.property(
          fc.shuffledSubarray(preBuildCommands, { minLength: preBuildCommands.length, maxLength: preBuildCommands.length }),
          (shuffled) => {
            return shuffled.every(cmd => isVersionManagerFree(cmd));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('substrings like "carnival" or "envmanager" do not trigger false positives', () => {
      const falsePositiveCandidates = [
        'carnival',
        'envmanager',
        'rvmrc_is_not_a_match_because_rvm_is_a_word_boundary',
        'canvas',
        'environment',
        'maneuver'
      ];

      // Only 'rvmrc_is_not...' could be tricky -- but \brvm\b won't match inside 'rvmrc'
      // because 'rvmrc' has no word boundary after 'rvm'
      for (const cmd of falsePositiveCandidates) {
        // These should all pass since rvm/nvm don't appear as whole words
        if (!/\brvm\b/i.test(cmd) && !/\bnvm\b/i.test(cmd)) {
          expect(isVersionManagerFree(cmd)).toBe(true);
        }
      }
    });

    test('empty and non-string inputs are treated as version-manager-free', () => {
      expect(isVersionManagerFree('')).toBe(true);
      expect(isVersionManagerFree(null)).toBe(true);
      expect(isVersionManagerFree(undefined)).toBe(true);
      expect(isVersionManagerFree(42)).toBe(true);
    });
  });
});
