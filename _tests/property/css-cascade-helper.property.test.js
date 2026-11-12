/**
 * Property tests for _tests/helpers/css-cascade.js
 *
 * **Feature: spot-details-pane-scroll**
 *
 * Metamorphic properties of the cascade resolver over generated stylesheets:
 *   1. Adding a rule whose @media does not match never changes the result.
 *   2. Appending a matching !important rule with a selector at least as
 *      specific as every other always wins.
 *   3. The winner is the declaration ranked highest by (important,
 *      specificity, source order), computed independently by sorting.
 */

const fc = require('fast-check');
const { JSDOM } = require('jsdom');
const { parseCss, createResolver, specificity } = require('../helpers/css-cascade');

const document = new JSDOM('<!DOCTYPE html><body><div id="o" class="p"><main id="m" class="a b"></main></div></body>')
  .window.document;
const target = document.querySelector('main');

// Selectors that all match <main>, with differing specificity.
const SELECTORS = ['main', '.a', '.a.b', '.p main', '.p .a', '#m', '#o main', 'div > main', '*'];
const ENV = { width: 1200, height: 800, reducedMotion: false };

const ruleArb = fc.record({
  selector: fc.constantFrom(...SELECTORS),
  value: fc.integer({ min: 0, max: 999 }).map(n => `${n}px`),
  important: fc.boolean(),
  minWidth: fc.option(fc.integer({ min: 300, max: 2000 }), { nil: null })
});

function toCss(rules) {
  return rules.map(r => {
    const body = `${r.selector}{top:${r.value}${r.important ? ' !important' : ''}}`;
    return r.minWidth === null ? body : `@media(min-width: ${r.minWidth}px){${body}}`;
  }).join('');
}

const resolveTop = rules => createResolver(parseCss(toCss(rules)))(target, 'top', ENV);

describe('css-cascade resolver properties', () => {
  test('a rule whose media does not match never changes the result', () => {
    fc.assert(fc.property(fc.array(ruleArb, { maxLength: 12 }), ruleArb, fc.nat(12), (rules, extra, at) => {
      const nonMatching = { ...extra, minWidth: ENV.width + 1 };
      const withExtra = [...rules];
      withExtra.splice(Math.min(at, rules.length), 0, nonMatching);
      expect(resolveTop(withExtra)).toBe(resolveTop(rules));
    }), { numRuns: 200 });
  });

  test('an appended matching !important rule of maximal specificity wins', () => {
    fc.assert(fc.property(fc.array(ruleArb, { maxLength: 12 }), (rules) => {
      const winner = { selector: '#o main', value: '1234px', important: true, minWidth: null };
      expect(resolveTop([...rules, winner])).toBe('1234px');
    }), { numRuns: 200 });
  });

  test('the winner is the highest-ranked applicable declaration', () => {
    fc.assert(fc.property(fc.array(ruleArb, { minLength: 1, maxLength: 12 }), (rules) => {
      const ranked = rules
        .map((r, order) => ({ ...r, order, spec: specificity(r.selector) }))
        .filter(r => r.minWidth === null || ENV.width >= r.minWidth)
        .sort((x, y) => (x.important - y.important)
          || (x.spec[0] - y.spec[0]) || (x.spec[1] - y.spec[1]) || (x.spec[2] - y.spec[2])
          || (x.order - y.order));
      const expected = ranked.length ? ranked[ranked.length - 1].value : undefined;
      expect(resolveTop(rules)).toBe(expected);
    }), { numRuns: 300 });
  });
});
