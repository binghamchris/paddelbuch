/**
 * SCSS Compile Parity
 *
 * **Feature: quality-and-tooling-hardening, Property 2: SCSS migration preserves compiled output**
 * **Validates: Requirements 2.2, 2.5**
 *
 * After migrating the first-party SCSS from `@import` to `@use`/`@forward`
 * (Task 10), the compiled `application.css` must be unchanged and the first-party
 * SCSS must no longer emit `@import` deprecation warnings.
 *
 * This test compiles `assets/css/application.scss` with Dart Sass the same way
 * jekyll-sass-converter does (front matter stripped, `style: compressed`,
 * loadPaths = [_sass, node_modules]) and checks:
 *   1. The compiled output equals the Task 0 baseline fixture
 *      (`_tests/fixtures/application.baseline.css`), both as a rule set and
 *      byte-for-byte. The fixture is the pre-migration compiled output captured
 *      with this same Dart Sass version; regenerate it deliberately only if the
 *      compiled CSS legitimately changes.
 *   2. No first-party SCSS file contains an `@import` statement.
 *   3. No `@import` deprecation warning originates from first-party SCSS (every
 *      such warning comes from third-party Bootstrap under node_modules).
 */

const fs = require('fs');
const path = require('path');
const sass = require('sass');
const fc = require('fast-check');

const projectRoot = path.join(__dirname, '..', '..');
const scssEntry = path.join(projectRoot, 'assets', 'css', 'application.scss');
const baselineFixture = path.join(__dirname, '..', 'fixtures', 'application.baseline.css');

// Compile application.scss the way jekyll-sass-converter does.
function compileApplication() {
  let src = fs.readFileSync(scssEntry, 'utf-8');
  // Strip the leading Jekyll YAML front matter (--- ... ---).
  src = src.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');

  const warnings = [];
  const result = sass.compileString(src, {
    style: 'compressed',
    loadPaths: [path.join(projectRoot, '_sass'), path.join(projectRoot, 'node_modules')],
    logger: {
      warn(message, opts) {
        const span = opts && opts.span;
        const url = span && span.url ? String(span.url) : '';
        warnings.push({ message: String(message), url });
      }
    }
  });
  return { css: result.css, warnings };
}

// Split compressed CSS into top-level rule chunks (nested @media blocks stay whole).
function toRuleSet(css) {
  const cleaned = css.replace(/^\uFEFF/, '');
  const rules = [];
  let depth = 0;
  let buf = '';
  for (const ch of cleaned) {
    buf += ch;
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rules.push(buf);
        buf = '';
      }
    }
  }
  if (buf.trim()) {
    rules.push(buf);
  }
  return rules;
}

// Recursively collect first-party SCSS files (assets/css + _sass).
function firstPartyScssFiles() {
  const files = [scssEntry];
  const sassDir = path.join(projectRoot, '_sass');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.scss')) {
        files.push(full);
      }
    }
  };
  walk(sassDir);
  return files;
}

describe('SCSS compile parity (Property 2)', () => {
  let compiled;
  let baseline;

  beforeAll(() => {
    compiled = compileApplication();
    baseline = fs.readFileSync(baselineFixture, 'utf-8');
  });

  it('compiles application.scss without throwing', () => {
    expect(typeof compiled.css).toBe('string');
    expect(compiled.css.length).toBeGreaterThan(1000);
  });

  it('produces the same set of compiled rules as the Task 0 baseline', () => {
    const compiledRules = toRuleSet(compiled.css).sort();
    const baselineRules = toRuleSet(baseline).sort();
    expect(compiledRules).toEqual(baselineRules);
  });

  it('produces compiled CSS byte-identical to the Task 0 baseline', () => {
    // Strongest form of "effective compiled rules equal the baseline": the
    // @import -> @use/@forward migration changed neither the rules nor their order.
    expect(compiled.css).toBe(baseline);
  });

  it('every baseline rule is present in the compiled output (sampled)', () => {
    const compiledRules = new Set(toRuleSet(compiled.css));
    const baselineRules = toRuleSet(baseline);
    fc.assert(
      fc.property(fc.constantFrom(...baselineRules), (rule) => {
        expect(compiledRules.has(rule)).toBe(true);
      }),
      { verbose: true, numRuns: 100 }
    );
  });

  it('every compiled rule is present in the baseline (sampled)', () => {
    const baselineRules = new Set(toRuleSet(baseline));
    const compiledRules = toRuleSet(compiled.css);
    fc.assert(
      fc.property(fc.constantFrom(...compiledRules), (rule) => {
        expect(baselineRules.has(rule)).toBe(true);
      }),
      { verbose: true, numRuns: 100 }
    );
  });

  it('contains no @import statements in any first-party SCSS file', () => {
    const offenders = [];
    for (const file of firstPartyScssFiles()) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        // Match an actual @import rule, not the token inside a // comment.
        if (/^\s*@import\b/.test(line)) {
          offenders.push(`${path.relative(projectRoot, file)}:${idx + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('emits no first-party @import deprecation warning', () => {
    const importWarnings = compiled.warnings.filter((w) =>
      /@import rules are deprecated/i.test(w.message)
    );
    // Any @import deprecation must come from third-party Bootstrap (node_modules).
    // A warning with no span URL would belong to the entry file (first-party).
    const firstParty = importWarnings.filter((w) => !w.url.includes('node_modules'));
    expect(firstParty).toEqual([]);
  });
});
