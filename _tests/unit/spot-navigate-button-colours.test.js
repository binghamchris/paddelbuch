/**
 * Spot details: the Navigate button shares the Copy buttons' colours
 *
 * **Feature: detail-close-button**
 * **Validates: Requirement 1.12**
 *
 * On its own, `.navigate-btn` loses to Bootstrap's `.btn:hover` and
 * `.btn:focus-visible`, which made it transparent with dark text on hover and
 * focus. The fix gives it the Copy buttons' rules. This test compiles the real
 * stylesheet and requires that, for the base, hover and active states, the
 * Navigate selector sits in the SAME rule as the Copy selector, so the two
 * cannot drift apart.
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

// Top-level rules as [selectorList[], declarations] pairs (media blocks skipped).
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let buf = '';
  for (const ch of css) {
    buf += ch;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const open = buf.indexOf('{');
        const selector = buf.slice(0, open).trim();
        if (!selector.startsWith('@')) {
          rules.push([selector.split(',').map(s => s.trim()), buf.slice(open + 1, -1)]);
        }
        buf = '';
      }
    }
  }
  return rules;
}

describe('spot details Navigate button colours', () => {
  const rules = topLevelRules(compileApplication());

  test.each([
    ['base', ''],
    ['hover', ':hover'],
    ['active', ':active']
  ])('%s state: Navigate shares the Copy button rule', (_label, state) => {
    const copy = '.page-spot-details .clipboard-btn.copy-btn' + state;
    const navigate = '.page-spot-details .spot-title .navigate-btn' + state;
    const copyRules = rules.filter(([selectors]) => selectors.includes(copy));

    expect(copyRules.length).toBeGreaterThan(0);
    copyRules.forEach(([selectors]) => expect(selectors).toContain(navigate));
  });

  test('the shared base and hover rules set background, border and text colour', () => {
    const declarationsFor = selector => rules
      .filter(([selectors]) => selectors.includes(selector))
      .map(([, decl]) => decl)
      .join(';');
    ['', ':hover'].forEach(state => {
      const decl = declarationsFor('.page-spot-details .spot-title .navigate-btn' + state);
      expect(decl).toMatch(/background-color:/);
      expect(decl).toMatch(/border-color:/);
      expect(decl).toMatch(/color:#fff/);
    });
  });
});
