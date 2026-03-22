/**
 * ASCII Compliance Test
 *
 * Prevents regressions where problematic non-ASCII characters (em-dashes,
 * box-drawing, arrows, etc.) sneak into source files via editors or AI
 * assistants. German umlauts and other legitimate content characters are
 * explicitly allowed.
 *
 * - SCSS files: strict ASCII-only (no German content expected)
 * - All other scanned files: blocklist of known-problematic characters
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Typographic / decorative characters that should never appear in source
const BLOCKED_CHARS = /[\u2014\u2013\u2015\u2012\u2500-\u257F\u2190-\u21FF\u2260\u2264\u2265\u00B0\u2018\u2019\u201C\u201D\u2026]/;
// \u2014  em-dash
// \u2013  en-dash
// \u2015  horizontal bar
// \u2012  figure dash
// \u2500-\u257F  box-drawing characters
// \u2190-\u21FF  arrows
// \u2260  not-equal sign
// \u2264  less-than-or-equal
// \u2265  greater-than-or-equal
// \u00B0  degree sign
// \u2018  left single curly quote
// \u2019  right single curly quote
// \u201C  left double curly quote
// \u201D  right double curly quote
// \u2026  horizontal ellipsis

// Non-ASCII regex for strict ASCII-only files (SCSS)
const NON_ASCII = /[^\x00-\x7F]/;

function collectFiles(dir, pattern, exclude) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (exclude && exclude.test(entry.name)) continue;
      results.push(...collectFiles(full, pattern, exclude));
    } else if (pattern.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function scanFile(filePath, regex) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];
  lines.forEach((line, i) => {
    if (regex.test(line)) {
      violations.push({ line: i + 1, text: line.trimEnd() });
    }
  });
  return violations;
}

describe('ASCII compliance', () => {
  describe('SCSS files must be strict ASCII', () => {
    const scssFiles = collectFiles(path.join(ROOT, '_sass'), /\.scss$/);

    test.each(scssFiles.map(f => [path.relative(ROOT, f), f]))(
      '%s',
      (_rel, filePath) => {
        const violations = scanFile(filePath, NON_ASCII);
        if (violations.length) {
          const report = violations
            .map(v => `  L${v.line}: ${v.text}`)
            .join('\n');
          throw new Error(`Non-ASCII characters found:\n${report}`);
        }
      }
    );
  });

  describe('Source files must not contain problematic Unicode', () => {
    const dirs = [
      { dir: path.join(ROOT, '_plugins'), pattern: /\.rb$/ },
      { dir: path.join(ROOT, 'assets', 'js'), pattern: /\.js$/, exclude: /vendor/ },
      { dir: path.join(ROOT, 'scripts'), pattern: /\.(rb|js)$/ },
      { dir: path.join(ROOT, '_scripts'), pattern: /\.py$/ },
    ];

    const files = dirs.flatMap(({ dir, pattern, exclude }) => collectFiles(dir, pattern, exclude));

    test.each(files.map(f => [path.relative(ROOT, f), f]))(
      '%s',
      (_rel, filePath) => {
        const violations = scanFile(filePath, BLOCKED_CHARS);
        if (violations.length) {
          const report = violations
            .map(v => `  L${v.line}: ${v.text}`)
            .join('\n');
          throw new Error(`Blocked Unicode characters found:\n${report}`);
        }
      }
    );
  });
});
