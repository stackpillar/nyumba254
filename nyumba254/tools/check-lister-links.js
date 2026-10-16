#!/usr/bin/env node
// Fails if any file builds a legacy /storefront?seller= or ?handle= URL by hand.
// Use nkListerPageUrl() (nk-shared.js) instead. Run: node tools/check-lister-links.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skipDirs = new Set(['node_modules', '.git', '.wrangler', 'supabase', 'tools']);
const allowed = new Set(['nk-shared.js', path.join('src', 'index.js'), 'storefront', 'nk-ctrl-7f3k2x9', 'dashboard.js']);
const pattern = /\/storefront\?(?:seller|handle)=/;
const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(full);
      continue;
    }
    const rel = path.relative(root, full);
    if (/\.bak|\.prepatch|\.(png|jpe?g|webp|svg|ico|mp3|woff2?)$/i.test(entry.name) || allowed.has(rel)) continue;
    fs.readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (pattern.test(line)) failures.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
}

walk(root);
if (failures.length) {
  console.error('Hand-built Lister Page URLs found:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('OK: no hand-built Lister Page URLs.');
