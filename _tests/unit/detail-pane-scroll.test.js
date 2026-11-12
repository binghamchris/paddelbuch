/**
 * Details pages: on wide screens the details pane scrolls, not the page
 *
 * **Feature: spot-details-pane-scroll**
 *
 * From 992px up the map fills the window below the header. This test compiles
 * the real stylesheet and requires, for each of the four details page types:
 *   - inside the `min-width: 992px` block, the details pane is capped at the
 *     map's height, scrolls on its own, and is the containing block for
 *     absolutely placed content (otherwise .visually-hidden labels escape the
 *     pane and stretch the page);
 *   - inside that block, `main` drops the global 2em !important bottom padding
 *     (otherwise a white strip below the map makes the page scroll);
 *   - none of this appears outside that block, so the stacked layout below
 *     992px is unchanged.
 */

const fs = require('fs');
const path = require('path');
const sass = require('sass');

const projectRoot = path.join(__dirname, '..', '..');

function compileApplication() {
  let src = fs.readFileSync(path.join(projectRoot, 'assets', 'css', 'application.scss'), 'utf-8');
  src = src.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  return sass.compileString(src, {
    style: 'compressed',
    loadPaths: [path.join(projectRoot, '_sass'), path.join(projectRoot, 'node_modules')],
    logger: { warn() {} }
  }).css;
}

// Rules as { media, selectors[], decl } with media = the enclosing @media prelude or ''.
function allRules(css) {
  const rules = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const selector = stack.pop();
      if (selector !== undefined && !selector.startsWith('@')) {
        const media = stack.filter(s => s.startsWith('@media')).join(' ');
        rules.push({ media, selectors: selector.split(',').map(s => s.trim()), decl: buf });
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  return rules;
}

const PAGES = [
  ['spot', '.page-spot-details', '.spot-description'],
  ['waterway', '.page-waterway-details', '.waterway-details'],
  ['obstacle', '.page-obstacle-details', '.obstacle-description'],
  ['notice', '.page-notice-details', '.notice-description']
];

const WIDE = '@media screen and (min-width: 992px)';

describe('details pane scrolls on wide screens', () => {
  const rules = allRules(compileApplication());
  const declFor = (selector, inWide) => rules
    .filter(r => r.selectors.includes(selector) && (inWide ? r.media === WIDE : r.media === ''))
    .map(r => r.decl)
    .join(';');

  test.each(PAGES)('%s: the pane is capped at the map height and scrolls', (_type, page, pane) => {
    const decl = declFor(`${page} ${pane}`, true);
    expect(decl).toMatch(/overflow-y:auto/);
    expect(decl).toMatch(/max-height:calc\(100svh - 65px\)/);
    expect(decl).toMatch(/position:relative/);
  });

  test.each(PAGES)('%s: main drops its bottom padding on wide screens', (_type, page) => {
    expect(declFor(`${page} main`, true)).toMatch(/padding-bottom:0 !important/);
  });

  test.each(PAGES)('%s: the map height matches the pane cap', (_type, page) => {
    expect(declFor(`${page} .map`, true)).toMatch(/height:calc\(100svh - 65px\)/);
  });

  test.each(PAGES)('%s: none of it applies outside the wide-screen block', (_type, page, pane) => {
    const outside = rules.filter(r => r.media !== WIDE &&
      (r.selectors.includes(`${page} ${pane}`) || r.selectors.includes(`${page} main`)));
    outside.forEach(r => {
      expect(r.decl).not.toMatch(/max-height|overflow-y|position:relative|padding-bottom:0 !important/);
    });
  });
});
