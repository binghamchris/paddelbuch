/**
 * Minimal CSS cascade resolver for layout tests.
 *
 * jsdom has no layout engine and ignores @media in getComputedStyle, so it
 * cannot say which declaration wins at a given window width. This helper
 * does that for a compiled (compressed) stylesheet:
 *
 *   - parseCss(css)            -> ordered rules with their @media conditions
 *   - mediaMatches(query, env) -> evaluates the media queries the site uses
 *   - specificity(selector)    -> [ids, classes, types]
 *   - createResolver(rules)    -> resolve(element, property, env), the winning
 *                                 declared value (undefined when nothing applies)
 *
 * Cascade order: !important beats normal, then specificity, then source order.
 * Shorthands that can set the queried longhands are expanded (overflow,
 * padding, padding-block, inset). Inheritance and initial values are not
 * modelled, so callers only query non-inherited properties and treat
 * `undefined` as "no rule applies".
 *
 * Unsupported media features throw, so a new kind of query in the stylesheet
 * fails loudly instead of being silently mis-evaluated.
 */

'use strict';

// Split `text` on `sep` at top level (outside quotes and parentheses).
function splitTopLevel(text, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      buf += ch;
      if (ch === '\\') { buf += text[++i] || ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

function parseDeclarations(body) {
  return splitTopLevel(body, ';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(d => {
      const colon = d.indexOf(':');
      if (colon < 0) return null;
      const prop = d.slice(0, colon).trim().toLowerCase();
      let value = d.slice(colon + 1).trim();
      const important = /!\s*important\s*$/i.test(value);
      if (important) value = value.replace(/\s*!\s*important\s*$/i, '').trim();
      return { prop, value, important };
    })
    .filter(Boolean);
}

/**
 * Parses a stylesheet into ordered style rules.
 * Each rule: { order, media: string[] (every enclosing @media prelude),
 *              selectors: string[], declarations: [{prop, value, important}] }
 * Rules inside @supports are kept (the site's targets support what it tests);
 * rules inside @keyframes, @font-face and other at-rules are dropped.
 */
function parseCss(css) {
  const rules = [];
  const stack = []; // preludes of the open blocks
  let quote = null;
  let parens = 0;
  let buf = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      buf += ch;
      if (ch === '\\') { buf += css[++i] || ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') parens++;
    if (ch === ')') parens--;
    if (parens > 0) { buf += ch; continue; }
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const prelude = stack.pop();
      if (prelude !== undefined && !prelude.startsWith('@')) {
        const atRules = stack.filter(s => s.startsWith('@'));
        const dropped = atRules.some(s => !/^@(media|supports)\b/i.test(s));
        if (!dropped) {
          rules.push({
            order: rules.length,
            media: atRules.filter(s => /^@media\b/i.test(s)),
            selectors: splitTopLevel(prelude, ',').map(s => s.trim()).filter(Boolean),
            declarations: parseDeclarations(buf)
          });
        }
      }
      buf = '';
    } else if (ch === ';' && stack.length > 0 && stack[stack.length - 1].startsWith('@')
               && !/^@(media|supports)\b/i.test(stack[stack.length - 1])) {
      buf = '';
    } else if (ch === ';' && stack.length === 0) {
      buf = ''; // top-level statements such as @charset
    } else {
      buf += ch;
    }
  }
  return rules;
}

function px(value) {
  const m = /^(-?[\d.]+)px$/.exec(value.trim());
  if (!m) throw new Error(`css-cascade: unsupported media length "${value}"`);
  return parseFloat(m[1]);
}

function featureMatches(feature, env) {
  const [rawName, rawValue] = feature.split(':').map(s => s && s.trim());
  const name = rawName.toLowerCase();
  switch (name) {
    case 'min-width': return env.width >= px(rawValue);
    case 'max-width': return env.width <= px(rawValue);
    case 'min-height': return env.height >= px(rawValue);
    case 'max-height': return env.height <= px(rawValue);
    case 'prefers-reduced-motion':
      return (env.reducedMotion ? 'reduce' : 'no-preference') === rawValue;
    default:
      throw new Error(`css-cascade: unsupported media feature "${feature}"`);
  }
}

/**
 * Evaluates one @media prelude (with or without the "@media" keyword) for
 * env = { width, height, reducedMotion }. The media type is "screen".
 */
function mediaMatches(query, env) {
  const q = query.replace(/^@media\s*/i, '').trim();
  return splitTopLevel(q, ',').some(part => {
    let p = part.trim();
    let negate = false;
    if (/^not\s/i.test(p)) { negate = true; p = p.replace(/^not\s+/i, ''); }
    p = p.replace(/^only\s+/i, '');
    const type = /^([a-z]+)/i.exec(p);
    let ok = true;
    if (type && !/^and$/i.test(type[1])) {
      const t = type[1].toLowerCase();
      if (t === 'print') ok = false;
      else if (t !== 'screen' && t !== 'all') {
        throw new Error(`css-cascade: unsupported media type "${t}"`);
      }
    }
    const features = p.match(/\(([^()]*)\)/g) || [];
    for (const f of features) {
      if (!featureMatches(f.slice(1, -1), env)) ok = false;
    }
    return negate ? !ok : ok;
  });
}

function compareSpec(x, y) {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Selector specificity as [ids, classes/attributes/pseudo-classes, types/pseudo-elements]. */
function specificity(selector) {
  let a = 0;
  let b = 0;
  let c = 0;
  let s = selector;
  // Functional pseudo-classes: :where() counts 0, the others take their most
  // specific argument. Arguments may themselves contain one level of parens.
  s = s.replace(/:(not|is|has|where|matches)\(((?:[^()]|\([^()]*\))*)\)/gi, (m, fn, arg) => {
    if (fn.toLowerCase() !== 'where') {
      const best = splitTopLevel(arg, ',').map(x => specificity(x.trim())).sort(compareSpec).pop();
      a += best[0]; b += best[1]; c += best[2];
    }
    return ' ';
  });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ' '; });
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, () => { c++; return ' '; });
  s = s.replace(/:(before|after|first-line|first-letter)\b/gi, () => { c++; return ' '; });
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, () => { b++; return ' '; });
  s = s.replace(/#(?:\\.|[\w-])+/g, () => { a++; return ' '; });
  s = s.replace(/\.(?:\\.|[\w-])+/g, () => { b++; return ' '; });
  (s.match(/[a-zA-Z][\w-]*/g) || []).forEach(() => { c++; });
  return [a, b, c];
}

function boxValues(value) {
  const v = splitTopLevel(value.trim(), ' ').filter(Boolean);
  const [t, r = t, bt = t, l = r] = v;
  return { top: t, right: r, bottom: bt, left: l };
}

/** Longhands set by one declaration, as [[longhand, value], ...]. */
function expand(prop, value) {
  switch (prop) {
    case 'overflow': {
      const [x, y = x] = splitTopLevel(value.trim(), ' ').filter(Boolean);
      return [['overflow-x', x], ['overflow-y', y]];
    }
    case 'padding': {
      const v = boxValues(value);
      return [['padding-top', v.top], ['padding-right', v.right], ['padding-bottom', v.bottom], ['padding-left', v.left]];
    }
    case 'padding-block': {
      const [start, end = start] = splitTopLevel(value.trim(), ' ').filter(Boolean);
      return [['padding-top', start], ['padding-bottom', end]];
    }
    case 'padding-block-start': return [['padding-top', value]];
    case 'padding-block-end': return [['padding-bottom', value]];
    case 'inset': {
      const v = boxValues(value);
      return [['top', v.top], ['right', v.right], ['bottom', v.bottom], ['left', v.left]];
    }
    case 'max-block-size': return [['max-height', value]];
    case 'block-size': return [['height', value]];
    default: return [[prop, value]];
  }
}

// Selectors that never style the element itself in its resting state.
function appliesToElementAtRest(selector) {
  return !/::|:(before|after|first-line|first-letter|hover|focus|focus-visible|focus-within|active|visited)\b/i.test(selector);
}

/**
 * Returns resolve(element, property, env) over the given parsed rules.
 * Matching is done with the element's own `matches()` (jsdom), so the
 * element must belong to a document whose structure mirrors the page.
 */
function createResolver(rules) {
  const matchCache = new WeakMap();

  function matchingDeclarations(el) {
    if (matchCache.has(el)) return matchCache.get(el);
    const found = [];
    for (const rule of rules) {
      let best = null;
      for (const sel of rule.selectors) {
        if (!appliesToElementAtRest(sel)) continue;
        let ok = false;
        try { ok = el.matches(sel); } catch (e) { ok = false; }
        if (ok) {
          const sp = specificity(sel);
          if (!best || compareSpec(sp, best) > 0) best = sp;
        }
      }
      if (!best) continue;
      for (const d of rule.declarations) {
        for (const [longhand, value] of expand(d.prop, d.value)) {
          found.push({ longhand, value, important: d.important, spec: best, order: rule.order, media: rule.media });
        }
      }
    }
    matchCache.set(el, found);
    return found;
  }

  return function resolve(el, property, env) {
    let winner = null;
    for (const d of matchingDeclarations(el)) {
      if (d.longhand !== property) continue;
      if (!d.media.every(m => mediaMatches(m, env))) continue;
      if (!winner) { winner = d; continue; }
      if (d.important !== winner.important) { if (d.important) winner = d; continue; }
      const cmp = compareSpec(d.spec, winner.spec);
      if (cmp > 0 || (cmp === 0 && d.order > winner.order)) winner = d;
    }
    return winner ? winner.value : undefined;
  };
}

module.exports = { parseCss, mediaMatches, specificity, createResolver, splitTopLevel };
