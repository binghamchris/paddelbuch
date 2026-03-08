const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FONTS_CSS = path.join(ROOT, 'assets/css/vendor/fonts.css');
const CSS_DIR = path.dirname(FONTS_CSS);

const EXPECTED_FACES = [
  { family: 'Fredoka', weight: '300' },
  { family: 'Fredoka', weight: '400' },
  { family: 'Fredoka', weight: '500' },
  { family: 'Quicksand', weight: '400' },
  { family: 'Quicksand', weight: '500' },
  { family: 'Quicksand', weight: '700' },
];

describe('download-google-fonts.js output', () => {
  let css;

  beforeAll(() => {
    css = fs.readFileSync(FONTS_CSS, 'utf-8');
  });

  test('fonts.css contains exactly 6 @font-face declarations', () => {
    const matches = css.match(/@font-face\s*\{/g);
    expect(matches).not.toBeNull();
    expect(matches).toHaveLength(6);
  });

  test.each(EXPECTED_FACES)(
    'contains @font-face for $family weight $weight',
    ({ family, weight }) => {
      const regex = new RegExp(
        `@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*font-weight:\\s*${weight}[^}]*\\}`,
        's'
      );
      expect(css).toMatch(regex);
    }
  );

  test('all url() paths resolve to existing font files', () => {
    const urlPattern = /url\(['"]?([^'")]+)['"]?\)/g;
    let match;
    const paths = [];

    while ((match = urlPattern.exec(css)) !== null) {
      paths.push(match[1]);
    }

    expect(paths.length).toBeGreaterThanOrEqual(6);

    for (const relPath of paths) {
      const resolved = path.resolve(CSS_DIR, relPath);
      expect(fs.existsSync(resolved)).toBe(true);
    }
  });
});
