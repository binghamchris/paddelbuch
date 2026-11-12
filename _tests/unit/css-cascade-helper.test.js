/**
 * Unit tests for _tests/helpers/css-cascade.js
 *
 * **Feature: spot-details-pane-scroll**
 *
 * The details-pane layout tests rely on this resolver to say which
 * declaration wins at a given window width. A wrong resolver would make those
 * tests pass or fail for the wrong reason, so its rules are pinned here with
 * known cases, including the exact shapes the site's stylesheet uses.
 */

const { JSDOM } = require('jsdom');
const { parseCss, mediaMatches, specificity, createResolver } = require('../helpers/css-cascade');

function doc(html) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document;
}

describe('parseCss', () => {
  test('keeps source order, selector lists and every enclosing @media prelude', () => {
    const rules = parseCss('a,b{color:red}@media(min-width: 992px){@supports (display:grid){.x{top:0}}}.y{left:1px !important}');
    expect(rules.map(r => r.selectors)).toEqual([['a', 'b'], ['.x'], ['.y']]);
    expect(rules[1].media).toEqual(['@media(min-width: 992px)']);
    expect(rules[2].declarations).toEqual([{ prop: 'left', value: '1px', important: true }]);
    expect(rules.map(r => r.order)).toEqual([0, 1, 2]);
  });

  test('ignores braces and semicolons inside strings and url()', () => {
    const rules = parseCss('.a{background:url("data:image/svg+xml;utf8,<svg>{}</svg>");content:"a;b{"}.b{top:0}');
    expect(rules).toHaveLength(2);
    expect(rules[0].declarations.map(d => d.prop)).toEqual(['background', 'content']);
  });

  test('drops rules inside @keyframes and @font-face', () => {
    const rules = parseCss('@font-face{font-family:x;src:url(a.woff2)}@keyframes k{0%{top:0}to{top:1px}}.a{top:2px}');
    expect(rules.map(r => r.selectors)).toEqual([['.a']]);
  });
});

describe('mediaMatches', () => {
  const at = (width, extra = {}) => ({ width, height: 800, reducedMotion: false, ...extra });

  test.each([
    ['@media screen and (min-width: 992px)', 991, false],
    ['@media screen and (min-width: 992px)', 992, true],
    ['@media screen and (max-width: 992px)', 992, true],
    ['@media screen and (max-width: 992px)', 993, false],
    ['@media(max-width: 991.98px)', 991, true],
    ['@media(max-width: 991.98px)', 992, false],
    ['@media print', 1440, false],
    ['@media(prefers-reduced-motion: reduce)', 1440, false],
    ['@media(prefers-reduced-motion: no-preference)', 1440, true],
    ['@media(max-width: 991.98px)and (prefers-reduced-motion: reduce)', 500, false],
    ['@media (min-width: 2000px), (max-width: 400px)', 390, true]
  ])('%s at %ipx -> %s', (query, width, expected) => {
    expect(mediaMatches(query, at(width))).toBe(expected);
  });

  test('reduced-motion preference is honoured when set', () => {
    expect(mediaMatches('@media(prefers-reduced-motion: reduce)', at(500, { reducedMotion: true }))).toBe(true);
  });

  test('unsupported features fail loudly rather than being guessed', () => {
    expect(() => mediaMatches('@media (orientation: portrait)', at(500))).toThrow(/unsupported media feature/);
    expect(() => mediaMatches('@media (min-width: 60em)', at(500))).toThrow(/unsupported media length/);
  });
});

describe('specificity', () => {
  test.each([
    ['main', [0, 0, 1]],
    ['.page-spot-details main', [0, 1, 1]],
    ['.page-spot-details .spot-description', [0, 2, 0]],
    ['#site-navbar > .container-fluid', [1, 1, 0]],
    ['.row>*', [0, 1, 0]],
    ['a:hover', [0, 1, 1]],
    ['p::before', [0, 0, 2]],
    ['.a:not(#b)', [1, 1, 0]],
    [':where(.a) .b', [0, 1, 0]],
    ['input[type=checkbox]', [0, 1, 1]]
  ])('%s -> %j', (selector, expected) => {
    expect(specificity(selector)).toEqual(expected);
  });
});

describe('createResolver', () => {
  const env = { width: 1440, height: 900, reducedMotion: false };
  const resolveOn = (css, html, selector, prop, e = env) => {
    const d = doc(html);
    return createResolver(parseCss(css))(d.querySelector(selector), prop, e);
  };

  test('later rule wins at equal specificity', () => {
    expect(resolveOn('.a{top:1px}.a{top:2px}', '<div class="a"></div>', '.a', 'top')).toBe('2px');
  });

  test('higher specificity beats later source order', () => {
    expect(resolveOn('.p .a{top:1px}.a{top:2px}', '<div class="p"><div class="a"></div></div>', '.a', 'top')).toBe('1px');
  });

  test('!important beats higher specificity; among !important, specificity decides', () => {
    expect(resolveOn('#i{top:1px}.a{top:2px !important}', '<div id="i" class="a"></div>', '.a', 'top')).toBe('2px');
    expect(resolveOn('.p main{padding-bottom:0 !important}main{padding-bottom:2em !important}',
      '<div class="p"><main></main></div>', 'main', 'padding-bottom')).toBe('0');
  });

  test('declarations only apply when every enclosing @media matches', () => {
    const css = '.a{top:1px}@media(min-width: 992px){.a{top:2px}}';
    expect(resolveOn(css, '<div class="a"></div>', '.a', 'top', { ...env, width: 991 })).toBe('1px');
    expect(resolveOn(css, '<div class="a"></div>', '.a', 'top', { ...env, width: 992 })).toBe('2px');
  });

  test('shorthands set their longhands, and a later shorthand overrides an earlier longhand', () => {
    const html = '<div class="a"></div>';
    expect(resolveOn('.a{overflow-y:auto}.a{overflow:hidden}', html, '.a', 'overflow-y')).toBe('hidden');
    expect(resolveOn('.a{overflow:hidden auto}', html, '.a', 'overflow-y')).toBe('auto');
    expect(resolveOn('.a{padding-bottom:2em}.a{padding:0 1em}', html, '.a', 'padding-bottom')).toBe('0');
    expect(resolveOn('.a{padding:1px 2px 3px 4px}', html, '.a', 'padding-bottom')).toBe('3px');
    expect(resolveOn('.a{padding-block:1px 5px}', html, '.a', 'padding-bottom')).toBe('5px');
    expect(resolveOn('.a{max-block-size:10px}', html, '.a', 'max-height')).toBe('10px');
  });

  test('hover/focus and pseudo-element rules do not style the element at rest', () => {
    expect(resolveOn('.a:hover{top:1px}.a::before{top:2px}', '<div class="a"></div>', '.a', 'top')).toBeUndefined();
  });

  test('returns undefined when nothing applies', () => {
    expect(resolveOn('.b{top:1px}', '<div class="a"></div>', '.a', 'top')).toBeUndefined();
  });
});
