/**
 * Builds a jsdom document whose element structure mirrors a built details page.
 *
 * The real layout files are used, so renaming a class or moving the details
 * pane in a layout changes what the tests see:
 *   - `_layouts/<type>.html` is placed into `_layouts/default.html` at
 *     `{{ content }}`, with the body class the default layout derives from
 *     the layout's `pageName` front matter;
 *   - `{% include %}` tags are replaced by the include's file, recursively;
 *   - remaining Liquid is removed (both branches of a conditional are kept,
 *     which only adds elements and never removes the ones under test).
 *
 * Also exports the compiled stylesheet and the site's $menu-height.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const projectRoot = path.join(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(projectRoot, rel), 'utf-8');
}

function splitFrontMatter(src) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(src);
  if (!m) return { frontMatter: {}, body: src };
  const frontMatter = {};
  m[1].split('\n').forEach(line => {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line.trim());
    if (kv) frontMatter[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  });
  return { frontMatter, body: src.slice(m[0].length) };
}

function inlineIncludes(html, depth = 0) {
  if (depth > 6) return html;
  return html.replace(/{%-?\s*include\s+([\w./-]+\.html)[^%]*-?%}/g, (m, name) => {
    const file = path.join(projectRoot, '_includes', name);
    if (!fs.existsSync(file)) return '';
    return inlineIncludes(fs.readFileSync(file, 'utf-8'), depth + 1);
  });
}

function stripLiquid(html) {
  return html
    .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, '')
    .replace(/{%-?\s*(raw|endraw)\s*-?%}/g, '')
    .replace(/{%-?[\s\S]*?-?%}/g, '')
    .replace(/{{-?[\s\S]*?-?}}/g, 'x');
}

/** Returns { document, pageName } for 'spot' | 'waterway' | 'obstacle' | 'notice'. */
function buildDetailPage(type) {
  const { frontMatter, body } = splitFrontMatter(read(`_layouts/${type}.html`));
  const pageName = frontMatter.pageName;
  if (!pageName) throw new Error(`_layouts/${type}.html has no pageName front matter`);
  let html = splitFrontMatter(read('_layouts/default.html')).body;
  if (!/{{\s*content\s*}}/.test(html)) throw new Error('default layout has no {{ content }}');
  html = html.replace(/{{\s*content\s*}}/, () => body);
  // The default layout builds the body class from page.pageName / page.slug.
  html = html.replace(/{{\s*page\.pageName\s*}}/g, pageName).replace(/{{\s*page\.slug\s*}}/g, 'test-slug');
  html = stripLiquid(inlineIncludes(html));
  const dom = new JSDOM(html);
  return { document: dom.window.document, pageName };
}

function compileApplicationCss() {
  const sass = require('sass');
  let src = read('assets/css/application.scss');
  src = src.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  return sass.compileString(src, {
    style: 'compressed',
    loadPaths: [path.join(projectRoot, '_sass'), path.join(projectRoot, 'node_modules')],
    logger: { warn() {} }
  }).css;
}

/** $menu-height from _sass/settings/_dimensions.scss, in px. */
function menuHeightPx() {
  const m = /\$menu-height:\s*([\d.]+)px/.exec(read('_sass/settings/_dimensions.scss'));
  if (!m) throw new Error('$menu-height not found in _dimensions.scss');
  return parseFloat(m[1]);
}

// The details page types: layout name, page-scoped body class, details pane class.
const DETAIL_PAGES = [
  { type: 'spot', pageClass: 'page-spot-details', paneClass: 'spot-description' },
  { type: 'waterway', pageClass: 'page-waterway-details', paneClass: 'waterway-details' },
  { type: 'obstacle', pageClass: 'page-obstacle-details', paneClass: 'obstacle-description' },
  { type: 'notice', pageClass: 'page-notice-details', paneClass: 'notice-description' }
];

module.exports = { buildDetailPage, compileApplicationCss, menuHeightPx, DETAIL_PAGES, projectRoot };
