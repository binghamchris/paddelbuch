#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DEST_DIRS = [
  'assets/js/vendor',
  'assets/css/vendor',
  'assets/css/vendor/images',
];

const FILE_COPIES = [
  {
    src: 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
    dest: 'assets/js/vendor/bootstrap.bundle.min.js',
  },
  {
    src: 'node_modules/leaflet/dist/leaflet.js',
    dest: 'assets/js/vendor/leaflet.js',
  },
  {
    src: 'node_modules/leaflet/dist/leaflet.css',
    dest: 'assets/css/vendor/leaflet.css',
  },
  {
    src: 'node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.js',
    dest: 'assets/js/vendor/L.Control.Locate.min.js',
  },
  {
    src: 'node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.css',
    dest: 'assets/css/vendor/L.Control.Locate.min.css',
  },
];

function createDirectories() {
  for (const dir of DEST_DIRS) {
    const fullPath = path.join(ROOT, dir);
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function copyFiles() {
  for (const { src, dest } of FILE_COPIES) {
    const srcPath = path.join(ROOT, src);
    const destPath = path.join(ROOT, dest);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: ${src} -> ${dest}`);
  }
}

function copyLeafletImages() {
  const imagesDir = path.join(ROOT, 'node_modules/leaflet/dist/images');
  const destDir = path.join(ROOT, 'assets/css/vendor/images');

  const files = fs.readdirSync(imagesDir).filter((f) => f.endsWith('.png'));

  for (const file of files) {
    const srcPath = path.join(imagesDir, file);
    const destPath = path.join(destDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied: node_modules/leaflet/dist/images/${file} -> assets/css/vendor/images/${file}`);
  }
}

function main() {
  try {
    createDirectories();
    copyFiles();
    copyLeafletImages();
    console.log('\nAll vendor assets copied successfully.');
  } catch (err) {
    console.error(`\nFailed to copy vendor assets: ${err.message}`);
    process.exit(1);
  }
}

main();
