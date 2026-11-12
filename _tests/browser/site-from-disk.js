/**
 * Serves the built site (_site/) to a Playwright page from disk.
 *
 * Every request to ORIGIN is answered from _site/ (a trailing slash maps to
 * index.html); every request to any other origin is answered with an empty
 * 204, so tests are hermetic and send nothing to third parties.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const SITE = path.join(PROJECT_ROOT, '_site');
const ORIGIN = 'http://paddelbuch.test';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.xml': 'application/xml'
};

function assertSiteBuilt() {
  if (!fs.existsSync(path.join(SITE, 'index.html'))) {
    throw new Error('No built site in _site/. Run `bundle exec rake build:site` first.');
  }
}

async function serveSite(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' });
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(SITE, rel));
    if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({
      status: 200,
      body: fs.readFileSync(file),
      contentType: TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
    });
  });
}

// The largest built page of each details type, by file size (a proxy for
// the longest description/content), so real long panes are exercised.
function largestPages(dir, count) {
  const base = path.join(SITE, dir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .map(slug => path.join(base, slug, 'index.html'))
    .filter(f => fs.existsSync(f))
    .map(f => ({ f, size: fs.statSync(f).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, count)
    .map(({ f }) => '/' + path.relative(SITE, path.dirname(f)).split(path.sep).join('/') + '/');
}

// The Content-Security-Policy that Amplify sends, read from the deploy
// template, with the semantic search host left empty (as when search is off).
function deployedCsp() {
  const tpl = fs.readFileSync(path.join(PROJECT_ROOT, 'deploy/frontend-deploy.yaml'), 'utf-8');
  // A folded block scalar (`value: >-`): the indented lines that follow,
  // joined with single spaces.
  const m = /- key: Content-Security-Policy\n(\s*)value: >-\n((?:\1  .*\n)+)/.exec(tpl);
  if (!m) throw new Error('Content-Security-Policy not found in deploy/frontend-deploy.yaml');
  return m[2].split('\n').map(l => l.trim()).filter(Boolean).join(' ')
    .replace(/\s*\$\{[A-Za-z]+\}/g, '');
}

// Like serveSite, but HTML responses carry the deployed CSP, and requests to
// the hosts in `allowHosts` go out to the network instead of getting a 204.
async function serveSiteWithCsp(context, { allowHosts = [] } = {}) {
  const csp = deployedCsp();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      return allowHosts.includes(url.hostname) ? route.continue() : route.fulfill({ status: 204, body: '' });
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(SITE, rel));
    if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return route.fulfill({ status: 404, body: '' });
    }
    const headers = { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    if (rel.endsWith('.html')) headers['content-security-policy'] = csp;
    return route.fulfill({ status: 200, body: fs.readFileSync(file), headers });
  });
}

function menuHeightPx() {
  const scss = fs.readFileSync(path.join(PROJECT_ROOT, '_sass/settings/_dimensions.scss'), 'utf-8');
  return parseFloat(/\$menu-height:\s*([\d.]+)px/.exec(scss)[1]);
}

module.exports = { ORIGIN, SITE, assertSiteBuilt, serveSite, serveSiteWithCsp, deployedCsp, largestPages, menuHeightPx };
