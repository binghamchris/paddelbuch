#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'assets/fonts');
const CSS_DIR = path.join(ROOT, 'assets/css/vendor');

const FONT_FAMILIES = [
  { family: 'Fredoka', weights: [300, 400, 500] },
  { family: 'Quicksand', weights: [400, 500, 700] },
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Build individual Google Fonts URLs — one per family+weight.
 * Requesting a single weight forces the API to return a static (non-variable) font file.
 */
function buildGoogleFontsUrls() {
  const urls = [];
  for (const { family, weights } of FONT_FAMILIES) {
    for (const weight of weights) {
      urls.push(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`);
    }
  }
  return urls;
}


function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), headers: res.headers }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse the Google Fonts CSS response into font entries.
 * Google Fonts returns multiple @font-face blocks per weight (one per unicode-range subset).
 * We only keep the "latin" subset for each family+weight to produce one file per weight.
 */
function parseFontEntries(css) {
  const entries = [];
  // Split on comment lines like /* latin */ to identify subsets
  const sections = css.split(/\/\*\s*([^*]+?)\s*\*\//);

  // sections alternates: [preamble, subsetName, cssBlock, subsetName, cssBlock, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const subsetName = sections[i].trim();
    const block = sections[i + 1] || '';

    if (subsetName !== 'latin') continue;

    const familyMatch = block.match(/font-family:\s*'([^']+)'/);
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const urlMatch = block.match(/url\(([^)]+\.woff2)\)/);

    if (familyMatch && weightMatch && urlMatch) {
      entries.push({
        family: familyMatch[1],
        weight: parseInt(weightMatch[1], 10),
        url: urlMatch[1],
      });
    }
  }

  return entries;
}

function localFileName(family, weight) {
  return `${family.toLowerCase()}-${weight}.woff2`;
}

function generateFontsCss(entries) {
  return entries
    .map(
      ({ family, weight }) =>
        `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('../../fonts/${localFileName(family, weight)}') format('woff2');
}`
    )
    .join('\n\n')
    + '\n';
}

async function main() {
  try {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    fs.mkdirSync(CSS_DIR, { recursive: true });

    const cssUrls = buildGoogleFontsUrls();
    const allEntries = [];

    // Fetch CSS for each family+weight individually to get static font files
    for (const cssUrl of cssUrls) {
      console.log(`Fetching: ${cssUrl}`);
      const cssResponse = await httpsGet(cssUrl);
      const contentType = cssResponse.headers['content-type'] || '';

      if (!contentType.includes('text/css')) {
        console.error(`Unexpected content-type for CSS: ${contentType}`);
        process.exit(1);
      }

      const cssText = cssResponse.body.toString('utf-8');
      const entries = parseFontEntries(cssText);

      if (entries.length === 0) {
        console.error(`No font entries found for: ${cssUrl}`);
        process.exit(1);
      }

      allEntries.push(...entries);
    }

    console.log(`\nFound ${allEntries.length} font entries total.`);

    // Download each font file
    for (const entry of allEntries) {
      const fileName = localFileName(entry.family, entry.weight);
      const destPath = path.join(FONTS_DIR, fileName);

      console.log(`Downloading ${entry.family} ${entry.weight} -> assets/fonts/${fileName}`);
      const fontResponse = await httpsGet(entry.url);
      const fontContentType = fontResponse.headers['content-type'] || '';

      if (!fontContentType.includes('font/woff2') && !fontContentType.includes('application/octet-stream')) {
        console.error(`Unexpected content-type for font ${fileName}: ${fontContentType}`);
        process.exit(1);
      }

      fs.writeFileSync(destPath, fontResponse.body);
      console.log(`  Saved: assets/fonts/${fileName} (${fontResponse.body.length} bytes)`);
    }

    // Generate fonts.css
    const fontsCss = generateFontsCss(allEntries);
    const fontsCssPath = path.join(CSS_DIR, 'fonts.css');
    fs.writeFileSync(fontsCssPath, fontsCss);
    console.log(`\nGenerated: assets/css/vendor/fonts.css`);

    console.log('\nAll Google Fonts downloaded successfully.');
  } catch (err) {
    console.error(`\nFailed to download Google Fonts: ${err.message}`);
    process.exit(1);
  }
}


main();
